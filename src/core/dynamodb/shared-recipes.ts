/**
 * Shared recipes utilities for DynamoDB
 * Shared recipes use a special UserId (the shareId itself) to allow public access
 */
import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb';
import { IRecipe } from '@core/types/recipes.js';
import { config } from '@config/index.js';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '@core/telemetry/logger.js';

/**
 * Create a shared recipe (public access)
 * Returns a shareId that can be used to access the recipe
 *
 * @param client - DynamoDB document client
 * @param recipe - Recipe to share
 * @returns Object with shareId (unique share ID)
 */
export async function createSharedRecipe(
  client: DynamoDBDocument,
  recipe: IRecipe
): Promise<{ shareId: string }> {
  try {
    const shareId = uuidv4();

    // Store with shareId as the UserId to make it publicly accessible
    await client.put({
      TableName: config.DYNAMODB_TABLE_NAME,
      Item: {
        UserId: shareId,
        Item: `S-${shareId}`,
        ...recipe,
      },
    });

    return { shareId };
  } catch (error) {
    logger.error('Failed to create shared recipe in DynamoDB:', error);
    throw error;
  }
}

/**
 * Get a shared recipe by shareId (public, no authentication required)
 *
 * @param client - DynamoDB document client
 * @param shareId - Share ID to retrieve
 * @returns Recipe object or null if not found
 */
export async function getSharedRecipe(
  client: DynamoDBDocument,
  shareId: string
): Promise<IRecipe | null> {
  try {
    const result = await client.get({
      TableName: config.DYNAMODB_TABLE_NAME,
      Key: {
        UserId: shareId,
        Item: `S-${shareId}`,
      },
    });

    if (!result.Item) {
      return null;
    }

    const { UserId: _userId, Item: _item, ...recipe } = result.Item;
    return recipe as IRecipe;
  } catch (error) {
    logger.error('Failed to get shared recipe from DynamoDB:', error);
    throw error;
  }
}
