/**
 * DynamoDB utility functions for recipe operations
 */
import {
  DynamoDBDocument,
  QueryCommandInput,
  QueryCommandOutput,
  ScanCommandInput,
} from '@aws-sdk/lib-dynamodb';
import { IRecipe, RecipeUuid } from '@core/types/recipes.js';
import { IMealPlan } from '@core/types/meal-plan.js';
import { config } from '@config/index.js';
import { logger } from '@core/telemetry/logger.js';

/**
 * Get all recipes for a user from DynamoDB
 *
 * Queries DynamoDB for all items where:
 * - UserId = userId (partition key)
 * - Item starts with 'R-' (recipe sort key prefix)
 *
 * @param client - DynamoDB document client
 * @param userId - User ID (Cognito sub)
 * @returns Array of recipes for the user
 */
export async function getAllRecipesForUser(
  client: DynamoDBDocument,
  userId: string
): Promise<IRecipe[]> {
  try {
    const params: QueryCommandInput = {
      TableName: config.DYNAMODB_TABLE_NAME,
      KeyConditionExpression: 'UserId = :userId AND begins_with(#item, :itemPrefix)',
      ExpressionAttributeNames: {
        '#item': 'Item',
      },
      ExpressionAttributeValues: {
        ':userId': userId,
        ':itemPrefix': 'R-',
      },
    };

    const items: NonNullable<QueryCommandOutput['Items']> = [];
    let exclusiveStartKey: Record<string, unknown> | undefined;
    do {
      const result = await client.query({ ...params, ExclusiveStartKey: exclusiveStartKey });
      items.push(...(result.Items ?? []));
      exclusiveStartKey = result.LastEvaluatedKey;
    } while (exclusiveStartKey);

    // Remove DynamoDB metadata fields (UserId, Item) and return recipes
    return items.map(({ UserId: _userId, Item: _item, ...recipe }) => recipe as IRecipe);
  } catch (error) {
    logger.error('Failed to query recipes from DynamoDB:', error);
    throw error;
  }
}

/**
 * Get a single recipe by UUID for a user
 *
 * @param client - DynamoDB document client
 * @param userId - User ID (Cognito sub)
 * @param recipeUuid - Recipe UUID
 * @returns Recipe object or null if not found
 */
export async function getRecipeByUuid(
  client: DynamoDBDocument,
  userId: string,
  recipeUuid: RecipeUuid
): Promise<IRecipe | null> {
  try {
    const result = await client.get({
      TableName: config.DYNAMODB_TABLE_NAME,
      Key: {
        UserId: userId,
        Item: `R-${recipeUuid}`,
      },
    });

    if (!result.Item) {
      return null;
    }

    const { UserId: _userId, Item: _item, ...recipe } = result.Item;
    return recipe as IRecipe;
  } catch (error) {
    logger.error('Failed to get recipe from DynamoDB:', error);
    throw error;
  }
}

/**
 * Create or update a recipe for a user
 *
 * @param client - DynamoDB document client
 * @param userId - User ID (Cognito sub)
 * @param recipe - Recipe object to save
 * @returns Promise<void>
 */
export async function updateRecipe(
  client: DynamoDBDocument,
  userId: string,
  recipe: IRecipe
): Promise<void> {
  try {
    await client.put({
      TableName: config.DYNAMODB_TABLE_NAME,
      Item: {
        UserId: userId,
        Item: `R-${recipe.uuid}`,
        ...recipe,
      },
    });
  } catch (error) {
    logger.error('Failed to update recipe in DynamoDB:', error);
    throw error;
  }
}

/**
 * Delete a recipe for a user
 *
 * @param client - DynamoDB document client
 * @param userId - User ID (Cognito sub)
 * @param recipeUuid - Recipe UUID to delete
 * @returns Promise<void>
 */
export async function deleteRecipe(
  client: DynamoDBDocument,
  userId: string,
  recipeUuid: RecipeUuid
): Promise<void> {
  try {
    await client.delete({
      TableName: config.DYNAMODB_TABLE_NAME,
      Key: {
        UserId: userId,
        Item: `R-${recipeUuid}`,
      },
    });
  } catch (error) {
    logger.error('Failed to delete recipe from DynamoDB:', error);
    throw error;
  }
}

/**
 * Get meal plan for a user
 *
 * Returns the meal plan item with sort key 'MP' for the user.
 * Returns empty object if meal plan doesn't exist yet.
 *
 * @param client - DynamoDB document client
 * @param userId - User ID (Cognito sub)
 * @returns Meal plan object (empty if doesn't exist)
 */
export async function getMealPlanForUser(
  client: DynamoDBDocument,
  userId: string
): Promise<IMealPlan> {
  try {
    const result = await client.get({
      TableName: config.DYNAMODB_TABLE_NAME,
      Key: {
        UserId: userId,
        Item: 'MP',
      },
    });

    if (!result.Item || !result.Item.data) {
      return [];
    }

    return result.Item.data as IMealPlan;
  } catch (error) {
    logger.error('Failed to get meal plan from DynamoDB:', error);
    throw error;
  }
}

/**
 * Update (put) meal plan for a user
 *
 * Replaces the entire meal plan with the provided data.
 * Creates new item if doesn't exist, or updates existing one.
 *
 * @param client - DynamoDB document client
 * @param userId - User ID (Cognito sub)
 * @param mealPlan - Meal plan object to save
 * @returns Promise<void>
 */
export async function putMealPlanForUser(
  client: DynamoDBDocument,
  userId: string,
  mealPlan: IMealPlan
): Promise<void> {
  try {
    await client.put({
      TableName: config.DYNAMODB_TABLE_NAME,
      Item: {
        UserId: userId,
        Item: 'MP',
        data: mealPlan,
      },
    });
  } catch (error) {
    logger.error('Failed to put meal plan in DynamoDB:', error);
    throw error;
  }
}

export interface ItemKey {
  userId: string;
  item: string;
}

/**
 * List the keys of every item in the table. Used by the admin portal to enumerate users;
 * a full scan is acceptable at the table's current size.
 */
export async function scanAllItemKeys(client: DynamoDBDocument): Promise<ItemKey[]> {
  try {
    const params: ScanCommandInput = {
      TableName: config.DYNAMODB_TABLE_NAME,
      ProjectionExpression: 'UserId, #item',
      ExpressionAttributeNames: { '#item': 'Item' },
    };

    const keys: ItemKey[] = [];
    let exclusiveStartKey: Record<string, unknown> | undefined;
    do {
      const result = await client.scan({ ...params, ExclusiveStartKey: exclusiveStartKey });
      for (const item of result.Items ?? []) {
        keys.push({ userId: String(item.UserId), item: String(item.Item) });
      }
      exclusiveStartKey = result.LastEvaluatedKey;
    } while (exclusiveStartKey);

    return keys;
  } catch (error) {
    logger.error('Failed to scan item keys from DynamoDB:', error);
    throw error;
  }
}
