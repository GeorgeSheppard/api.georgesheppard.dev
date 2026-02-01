/**
 * DynamoDB utility functions for recipe operations
 */
import { DynamoDBDocument, QueryCommandInput } from '@aws-sdk/lib-dynamodb';
import { IRecipe, RecipeUuid } from '@core/types/recipes.js';
import { config } from '@config/index.js';

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

    const result = await client.query(params);

    // Remove DynamoDB metadata fields (UserId, Item) and return recipes
    return (result.Items ?? []).map(
      ({ UserId: _userId, Item: _item, ...recipe }) => recipe as IRecipe
    );
  } catch (error) {
    console.error('Failed to query recipes from DynamoDB:', error);
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
    console.error('Failed to get recipe from DynamoDB:', error);
    throw error;
  }
}
