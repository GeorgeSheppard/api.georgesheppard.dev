import {
  QueryCommand,
  GetCommand,
  PutCommand,
  DeleteCommand,
} from '@aws-sdk/lib-dynamodb';
import { DynamoDBClientWrapper } from '@core/database/dynamodb-client.js';
import {
  IRecipe,
  IMealPlan,
  RecipeUuid,
  ComponentUuid,
} from '../types/index.js';

export type ItemType = 'R-' | 'MP' | 'S-';

// Default empty meal plan state
const mealPlanEmptyState: IMealPlan = {};

/**
 * Constructs the sort key for a DynamoDB item
 */
function getSortKey(type: ItemType, id?: string): string {
  if (type === 'R-') {
    return `R-${id}`;
  }
  if (type === 'MP') {
    return 'MP';
  }
  if (type === 'S-') {
    return `S-${id}`;
  }
  throw new Error(`Unknown item type: ${type}`);
}

/**
 * Get a single item from DynamoDB
 */
export async function getFromDynamo<T>(
  client: DynamoDBClientWrapper,
  userId: string,
  type: ItemType,
  id?: string
): Promise<T> {
  const command = new GetCommand({
    TableName: client.tableName,
    Key: {
      UserId: userId,
      Item: getSortKey(type, id),
    },
  });

  const result = await client.client.send(command);

  if (!result.Item) {
    throw new Error(
      `Item not found: ${getSortKey(type, id)} for user ${userId}`
    );
  }

  // Remove DynamoDB keys from result
  const item = result.Item as Record<string, unknown>;
  const { UserId: _, Item: __, ...data } = item;
  return data as T;
}

/**
 * Put an item into DynamoDB
 */
export async function putToDynamo(
  client: DynamoDBClientWrapper,
  userId: string,
  type: ItemType,
  item: unknown,
  id?: string
): Promise<void> {
  const itemRecord = (item as Record<string, unknown>) || {};
  const command = new PutCommand({
    TableName: client.tableName,
    Item: {
      UserId: userId,
      Item: getSortKey(type, id),
      ...itemRecord,
    },
  });

  await client.client.send(command);
}

/**
 * Delete an item from DynamoDB
 */
export async function deleteFromDynamo(
  client: DynamoDBClientWrapper,
  userId: string,
  type: ItemType,
  id?: string
): Promise<void> {
  const command = new DeleteCommand({
    TableName: client.tableName,
    Key: {
      UserId: userId,
      Item: getSortKey(type, id),
    },
  });

  await client.client.send(command);
}

/**
 * Query all items of a specific type for a user
 */
export async function queryItemsForUser(
  client: DynamoDBClientWrapper,
  userId: string,
  itemType: ItemType
): Promise<unknown[]> {
  const command = new QueryCommand({
    TableName: client.tableName,
    KeyConditionExpression: 'UserId = :userId AND begins_with(Item, :itemType)',
    ExpressionAttributeValues: {
      ':userId': userId,
      ':itemType': itemType,
    },
  });

  const result = await client.client.send(command);
  return result.Items || [];
}

/**
 * Get a single recipe
 */
export async function getRecipe(
  client: DynamoDBClientWrapper,
  userId: string,
  recipeId: RecipeUuid
): Promise<IRecipe> {
  return getFromDynamo<IRecipe>(client, userId, 'R-', recipeId);
}

/**
 * Get all recipes for a user
 */
export async function getAllRecipesForUser(
  client: DynamoDBClientWrapper,
  userId: string
): Promise<IRecipe[]> {
  const items = await queryItemsForUser(client, userId, 'R-');

  return items.map((item) => {
    const itemRecord = item as Record<string, unknown>;
    const { UserId: _, Item: __, ...recipe } = itemRecord;
    return recipe as unknown as IRecipe;
  });
}

/**
 * Put (create/update) a recipe
 */
export async function putRecipe(
  client: DynamoDBClientWrapper,
  userId: string,
  recipe: IRecipe
): Promise<void> {
  // Remove DynamoDB-specific fields before storing
  const { ...recipeData } = recipe;
  await putToDynamo(client, userId, 'R-', recipeData, recipe.uuid);
}

/**
 * Delete a recipe
 */
export async function deleteRecipe(
  client: DynamoDBClientWrapper,
  userId: string,
  recipeId: RecipeUuid
): Promise<void> {
  await deleteFromDynamo(client, userId, 'R-', recipeId);
}

/**
 * Get a shared recipe by share ID
 */
export async function getSharedRecipe(
  client: DynamoDBClientWrapper,
  shareId: string
): Promise<IRecipe> {
  return getFromDynamo<IRecipe>(client, shareId, 'S-', shareId);
}

/**
 * Put (create) a shared recipe
 */
export async function putSharedRecipe(
  client: DynamoDBClientWrapper,
  shareId: string,
  recipe: IRecipe
): Promise<void> {
  const { ...recipeData } = recipe;
  await putToDynamo(client, shareId, 'S-', recipeData, shareId);
}

/**
 * Get meal plan for a user
 */
export async function getMealPlanForUser(
  client: DynamoDBClientWrapper,
  userId: string
): Promise<IMealPlan> {
  try {
    const mealPlan = await getFromDynamo<IMealPlan>(client, userId, 'MP');
    return mealPlan;
  } catch (err) {
    // Return empty state if not found
    return mealPlanEmptyState;
  }
}

/**
 * Put (create/update) a meal plan for a user
 */
export async function putMealPlanForUser(
  client: DynamoDBClientWrapper,
  userId: string,
  mealPlan: IMealPlan
): Promise<void> {
  await putToDynamo(client, userId, 'MP', mealPlan);
}
