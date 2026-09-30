#!/usr/bin/env tsx

/**
 * Merges recipes and meal plan from a source account into a target account.
 * Recipes whose title already exists on the target are skipped. Dry run by default.
 *
 * Usage:
 *   pnpm tsx scripts/migrate-data/migrate.ts [--apply] [--delete-source] [<source-token> <target-token>]
 *
 * Tokens can also be set via SOURCE_ACCOUNT / TARGET_ACCOUNT env vars (with or without "Bearer ").
 * See README.md for details.
 */

import { randomUUID } from 'node:crypto';
import { decodeJwt } from 'jose';
import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb';
import { S3Client, CopyObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import {
  getAllRecipesForUser,
  updateRecipe,
  deleteRecipe,
  getMealPlanForUser,
  putMealPlanForUser,
} from '@core/dynamodb/utilities.js';
import { createDynamoDBClient } from '@core/dynamodb/client.js';
import { createS3ClientWrapper } from '@core/s3/client.js';
import { IRecipe, Image, RecipeUuid, ComponentUuid } from '@core/types/recipes.js';
import { IMealPlan, IMealPlanRecipe } from '@core/types/meal-plan.js';
import { config } from '@config/index.js';

interface Options {
  apply: boolean;
  deleteSource: boolean;
}

interface RecipeMapping {
  recipeId: RecipeUuid;
  // undefined means component ids are unchanged
  components?: Map<ComponentUuid, ComponentUuid>;
}

function decodeUserId(token: string): string {
  const payload = decodeJwt(token.replace(/^Bearer /, ''));
  if (typeof payload.userId !== 'string') {
    throw new Error('Token does not contain userId');
  }
  return payload.userId;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normaliseTitle(title: string): string {
  return title.trim().replace(/\s+/g, ' ').toLowerCase();
}

function mapDuplicateComponents(
  source: IRecipe,
  target: IRecipe
): Map<ComponentUuid, ComponentUuid> {
  const mapping = new Map<ComponentUuid, ComponentUuid>();
  if (source.components.length === 1 && target.components.length === 1) {
    mapping.set(source.components[0].uuid, target.components[0].uuid);
    return mapping;
  }
  for (const component of source.components) {
    const match = target.components.find(
      (c) => normaliseTitle(c.name) === normaliseTitle(component.name)
    );
    if (match) {
      mapping.set(component.uuid, match.uuid);
    }
  }
  return mapping;
}

function remapPlanRecipe(
  entry: IMealPlanRecipe,
  mappings: Map<RecipeUuid, RecipeMapping>
): IMealPlanRecipe | null {
  const mapping = mappings.get(entry.recipeId);
  if (!mapping) {
    return null;
  }
  const components = entry.components.flatMap((component) => {
    if (!mapping.components) {
      return [component];
    }
    const componentId = mapping.components.get(component.componentId);
    return componentId ? [{ ...component, componentId }] : [];
  });
  return components.length > 0 ? { recipeId: mapping.recipeId, components } : null;
}

function mergeMealPlans(
  source: IMealPlan,
  target: IMealPlan,
  mappings: Map<RecipeUuid, RecipeMapping>
): { merged: IMealPlan; added: number } {
  const byDate = new Map(target.map((day) => [day.date, { ...day, plan: [...day.plan] }]));
  let added = 0;

  for (const day of source) {
    const targetDay = byDate.get(day.date) ?? { date: day.date, plan: [] };
    for (const entry of day.plan) {
      const remapped = remapPlanRecipe(entry, mappings);
      if (remapped && !targetDay.plan.some((p) => p.recipeId === remapped.recipeId)) {
        targetDay.plan.push(remapped);
        added++;
      }
    }
    if (targetDay.plan.length > 0) {
      byDate.set(day.date, targetDay);
    }
  }

  return { merged: [...byDate.values()].sort((a, b) => a.date - b.date), added };
}

async function copyImage(s3: S3Client, image: Image, targetUserId: string): Promise<Image> {
  const fileName = image.key.split('/').pop();
  if (!fileName) {
    throw new Error(`Invalid S3 key format: ${image.key}`);
  }
  const key = `${targetUserId}/${fileName}`;
  await s3.send(
    new CopyObjectCommand({
      Bucket: config.S3_BUCKET_NAME,
      CopySource: `${config.S3_BUCKET_NAME}/${image.key}`,
      Key: key,
    })
  );
  return { key, timestamp: image.timestamp };
}

async function deleteSourceAccount(
  dynamo: DynamoDBDocument,
  s3: S3Client,
  userId: string,
  recipes: IRecipe[]
): Promise<void> {
  console.log('\nDeleting source account data...');
  for (const recipe of recipes) {
    for (const image of recipe.images) {
      await s3.send(new DeleteObjectCommand({ Bucket: config.S3_BUCKET_NAME, Key: image.key }));
      await sleep(100);
    }
    await deleteRecipe(dynamo, userId, recipe.uuid);
    console.log(`  - Deleted recipe: ${recipe.name}`);
    await sleep(1000);
  }
  await dynamo.delete({
    TableName: config.DYNAMODB_TABLE_NAME,
    Key: { UserId: userId, Item: 'MP' },
  });
  console.log('  - Deleted meal plan');
}

async function mergeAccounts(
  sourceToken: string,
  targetToken: string,
  options: Options
): Promise<void> {
  const sourceUserId = decodeUserId(sourceToken);
  const targetUserId = decodeUserId(targetToken);
  if (sourceUserId === targetUserId) {
    throw new Error('Source and target accounts are the same');
  }

  console.log(options.apply ? 'Mode: APPLY\n' : 'Mode: DRY RUN (pass --apply to write)\n');
  console.log(`Source User ID: ${sourceUserId}`);
  console.log(`Target User ID: ${targetUserId}\n`);

  const dynamo = await createDynamoDBClient(
    config.DYNAMODB_REGION,
    config.DYNAMODB_ENDPOINT,
    config.DYNAMODB_ACCESS_KEY_ID,
    config.DYNAMODB_SECRET_ACCESS_KEY
  );
  const s3 = await createS3ClientWrapper(
    config.S3_REGION,
    config.S3_ENDPOINT,
    config.S3_ACCESS_KEY_ID,
    config.S3_SECRET_ACCESS_KEY
  );

  try {
    const [sourceRecipes, targetRecipes, sourceMealPlan, targetMealPlan] = await Promise.all([
      getAllRecipesForUser(dynamo.client, sourceUserId),
      getAllRecipesForUser(dynamo.client, targetUserId),
      getMealPlanForUser(dynamo.client, sourceUserId),
      getMealPlanForUser(dynamo.client, targetUserId),
    ]);
    console.log(`Source: ${sourceRecipes.length} recipes, ${sourceMealPlan.length} meal plan days`);
    console.log(
      `Target: ${targetRecipes.length} recipes, ${targetMealPlan.length} meal plan days\n`
    );

    const targetByTitle = new Map(targetRecipes.map((r) => [normaliseTitle(r.name), r]));
    const usedUuids = new Set(targetRecipes.map((r) => r.uuid));
    const mappings = new Map<RecipeUuid, RecipeMapping>();
    let copied = 0;
    let skipped = 0;
    let imageFailures = 0;

    for (const recipe of sourceRecipes) {
      const duplicate = targetByTitle.get(normaliseTitle(recipe.name));
      if (duplicate) {
        console.log(`  = Skipping duplicate: ${recipe.name}`);
        mappings.set(recipe.uuid, {
          recipeId: duplicate.uuid,
          components: mapDuplicateComponents(recipe, duplicate),
        });
        skipped++;
        continue;
      }

      const uuid = usedUuids.has(recipe.uuid) ? randomUUID() : recipe.uuid;
      usedUuids.add(uuid);
      targetByTitle.set(normaliseTitle(recipe.name), { ...recipe, uuid });
      mappings.set(recipe.uuid, { recipeId: uuid });
      console.log(`  + Copying: ${recipe.name} (${recipe.images.length} images)`);
      copied++;

      if (!options.apply) {
        continue;
      }

      const images: Image[] = [];
      for (const image of recipe.images) {
        try {
          images.push(await copyImage(s3.client, image, targetUserId));
          await sleep(100);
        } catch (error) {
          console.error(`    ✗ Failed to copy image ${image.key}:`, error);
          images.push(image);
          imageFailures++;
        }
      }
      await updateRecipe(dynamo.client, targetUserId, { ...recipe, uuid, images });
      await sleep(1000);
    }

    const { merged, added } = mergeMealPlans(sourceMealPlan, targetMealPlan, mappings);
    console.log(`\nRecipes: ${copied} to copy, ${skipped} duplicates skipped`);
    console.log(`Meal plan: ${added} entries to add (${merged.length} days after merge)`);

    if (!options.apply) {
      console.log('\nDry run complete, nothing was written.');
      return;
    }

    await putMealPlanForUser(dynamo.client, targetUserId, merged);
    console.log('\n✓ Merge completed');

    if (options.deleteSource) {
      if (imageFailures > 0) {
        throw new Error(
          `${imageFailures} image copies failed, not deleting the source account. Re-run to retry.`
        );
      }
      await deleteSourceAccount(dynamo.client, s3.client, sourceUserId, sourceRecipes);
      console.log('✓ Source account data deleted');
    }
  } finally {
    await dynamo.close();
    await s3.close();
  }
}

const args = process.argv.slice(2);
const options: Options = {
  apply: args.includes('--apply'),
  deleteSource: args.includes('--delete-source'),
};
const positional = args.filter((arg) => !arg.startsWith('--'));
const sourceToken = process.env.SOURCE_ACCOUNT ?? positional[0];
const targetToken = process.env.TARGET_ACCOUNT ?? positional[1];

if (!sourceToken || !targetToken) {
  console.error(
    'Usage: pnpm tsx scripts/migrate-data/migrate.ts [--apply] [--delete-source] <source-token> <target-token>'
  );
  console.error('Or set SOURCE_ACCOUNT and TARGET_ACCOUNT environment variables.');
  process.exit(1);
}
if (options.deleteSource && !options.apply) {
  console.error('--delete-source requires --apply');
  process.exit(1);
}

mergeAccounts(sourceToken, targetToken, options)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n✗ Failed:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
