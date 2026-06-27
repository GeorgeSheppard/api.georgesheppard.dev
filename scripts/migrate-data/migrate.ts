#!/usr/bin/env tsx

/**
 * Data Migration Script
 *
 * This script migrates recipes and meal plans from one user account to another.
 *
 * Usage (environment variables):
 *   Set SOURCE_ACCOUNT and TARGET_ACCOUNT in .env:
 *     SOURCE_ACCOUNT="Bearer eyJ..."
 *     TARGET_ACCOUNT="Bearer eyJ..."
 *   Then run:
 *     pnpm tsx scripts/migrate-data/migrate.ts
 *
 * Usage (command-line arguments):
 *   pnpm tsx scripts/migrate-data/migrate.ts <source-token> <target-token>
 *
 * Where:
 *   - source-token: MCP JWT token for the source account (without "Bearer " prefix)
 *   - target-token: MCP JWT token for the target account (without "Bearer " prefix)
 */

import { decodeJwt } from 'jose';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb';
import { S3Client, CopyObjectCommand } from '@aws-sdk/client-s3';
import {
  getAllRecipesForUser,
  updateRecipe,
  getMealPlanForUser,
  putMealPlanForUser,
} from '@core/dynamodb/utilities.js';
import { IRecipe } from '@core/types/recipes.js';
import { config } from '@config/index.js';

interface JwtPayload {
  userId: string;
  iat?: number;
}

function decodeToken(token: string): { userId: string } {
  try {
    const payload = decodeJwt(token) as JwtPayload;

    if (!payload.userId) {
      throw new Error('Token does not contain userId');
    }

    return { userId: payload.userId };
  } catch (error) {
    throw new Error(
      `Failed to decode token: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Sleep for a specified number of milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Copy an S3 object from source user to target user
 */
async function copyS3Image(
  s3Client: S3Client,
  sourceKey: string,
  targetUserId: string
): Promise<string> {
  // Extract the filename from the source key
  // Source key format: {sourceUserId}/{filename}
  const fileName = sourceKey.split('/').pop();
  if (!fileName) {
    throw new Error(`Invalid S3 key format: ${sourceKey}`);
  }

  // Create target key: {targetUserId}/{filename}
  const targetKey = `${targetUserId}/${fileName}`;

  const command = new CopyObjectCommand({
    Bucket: config.S3_BUCKET_NAME,
    CopySource: `${config.S3_BUCKET_NAME}/${sourceKey}`,
    Key: targetKey,
  });

  await s3Client.send(command);
  return targetKey;
}

async function migrateData(sourceToken: string, targetToken: string): Promise<void> {
  console.log('Starting data migration...\n');

  // Decode tokens to get user IDs
  const source = decodeToken(sourceToken);
  const target = decodeToken(targetToken);

  console.log(`Source User ID: ${source.userId}`);
  console.log(`Target User ID: ${target.userId}\n`);

  // Initialize AWS clients
  const baseDynamoClient = new DynamoDBClient({
    region: config.S3_REGION,
    credentials: {
      accessKeyId: config.S3_ACCESS_KEY_ID,
      secretAccessKey: config.S3_SECRET_ACCESS_KEY,
    },
  });

  const dynamoClient = DynamoDBDocument.from(baseDynamoClient, {
    marshallOptions: {
      removeUndefinedValues: true,
    },
  });

  const s3Client = new S3Client({
    region: config.S3_REGION,
    credentials: {
      accessKeyId: config.S3_ACCESS_KEY_ID,
      secretAccessKey: config.S3_SECRET_ACCESS_KEY,
    },
  });

  try {
    // Step 1: Fetch recipes from source account
    console.log('Fetching recipes from source account...');
    const sourceRecipes = await getAllRecipesForUser(dynamoClient, source.userId);
    console.log(`Found ${sourceRecipes.length} recipes\n`);

    // Step 2: Fetch meal plan from source account
    console.log('Fetching meal plan from source account...');
    const sourceMealPlan = await getMealPlanForUser(dynamoClient, source.userId);
    console.log(`Found meal plan with ${sourceMealPlan.length} entries\n`);

    // Step 3: Copy S3 images and update recipes with new keys (with throttling)
    console.log('Copying S3 images and migrating recipes to target account...');
    console.log('(Processing sequentially to avoid rate limits)\n');
    let totalImagesCopied = 0;
    let recipesProcessed = 0;

    for (const recipe of sourceRecipes) {
      const updatedImages = [];

      // Copy images for this recipe sequentially
      if (recipe.images && recipe.images.length > 0) {
        for (const image of recipe.images) {
          try {
            const newKey = await copyS3Image(s3Client, image.key, target.userId);
            totalImagesCopied++;
            console.log(`  - Copied image: ${image.key} -> ${newKey}`);
            updatedImages.push({
              key: newKey,
              timestamp: image.timestamp,
            });
            // Small delay between S3 operations
            await sleep(100);
          } catch (error) {
            console.error(`  ✗ Failed to copy image ${image.key}:`, error);
            // Keep the original key if copy fails
            updatedImages.push(image);
          }
        }
      }

      const updatedRecipe: IRecipe = {
        ...recipe,
        images: updatedImages.length > 0 ? updatedImages : recipe.images,
      };

      // Upload the recipe to DynamoDB
      console.log(`  - Migrating recipe: ${recipe.name} (${recipe.uuid})`);
      await updateRecipe(dynamoClient, target.userId, updatedRecipe);
      recipesProcessed++;

      // Delay between DynamoDB writes to avoid throttling
      await sleep(1000);
    }

    console.log(
      `\nSuccessfully copied ${totalImagesCopied} images and migrated ${recipesProcessed} recipes\n`
    );

    // Step 5: Upload meal plan to target account
    console.log('Uploading meal plan to target account...');
    await putMealPlanForUser(dynamoClient, target.userId, sourceMealPlan);
    console.log(`Successfully migrated meal plan with ${sourceMealPlan.length} entries\n`);

    console.log('✓ Migration completed successfully!');
  } catch (error) {
    console.error('\n✗ Migration failed:', error instanceof Error ? error.message : String(error));
    throw error;
  } finally {
    // Clean up clients
    baseDynamoClient.destroy();
    s3Client.destroy();
  }
}

// Main execution
const args = process.argv.slice(2);

// Get tokens from environment variables or command-line arguments
let sourceToken = process.env.SOURCE_ACCOUNT;
let targetToken = process.env.TARGET_ACCOUNT;

// Strip "Bearer " prefix if present
if (sourceToken?.startsWith('Bearer ')) {
  sourceToken = sourceToken.slice(7);
}
if (targetToken?.startsWith('Bearer ')) {
  targetToken = targetToken.slice(7);
}

// Fall back to command-line arguments if env vars not set
if (!sourceToken || !targetToken) {
  if (args.length !== 2) {
    console.error('Error: Invalid arguments\n');
    console.error(
      'Usage: pnpm tsx scripts/migrate-data/migrate.ts <source-token> <target-token>\n'
    );
    console.error('Or set SOURCE_ACCOUNT and TARGET_ACCOUNT environment variables in .env\n');
    console.error('Where:');
    console.error('  source-token: MCP JWT token for the source account');
    console.error('  target-token: MCP JWT token for the target account');
    process.exit(1);
  }

  [sourceToken, targetToken] = args;
}

migrateData(sourceToken, targetToken)
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('\nFatal error:', error);
    process.exit(1);
  });
