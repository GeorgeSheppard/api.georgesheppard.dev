import { awsDynamoDocClient } from './dynamodb-client.js';
import { config } from '@config/index.js';
import { IRecipe } from '@websites/kitchencalm/types/recipes.js';

type ItemType = 'R-' | 'MP';

type RecipeKey = { type: 'R-'; id: string };
type MealPlanKey = { type: 'MP' };
type Keys = RecipeKey | MealPlanKey;

class NotFoundError extends Error {
  constructor(msg: string) {
    super(msg);
    Object.setPrototypeOf(this, NotFoundError.prototype);
  }
}

const getSortKey = (key: Keys) => {
  switch (key.type) {
    case 'R-':
      return `R-${key.id}`;
    case 'MP':
      return 'MP';
  }
};

export const getFromDynamo = async (key: Keys, userId: string) => {
  const result = await awsDynamoDocClient.get({
    TableName: config.AWS_DYNAMO_TABLE_NAME,
    Key: {
      UserId: userId,
      Item: getSortKey(key),
    },
  });

  if (result.$metadata.httpStatusCode !== 200) {
    throw new Error(`Error fetching: ${result.$metadata.httpStatusCode}`);
  }

  if (!result.Item) {
    throw new NotFoundError(`Cannot find item ${getSortKey(key)}`);
  }

  return result;
};

export const getAllItemsForAUser = async (
  userId: string,
  itemType: ItemType
) => {
  return await awsDynamoDocClient.query({
    TableName: config.AWS_DYNAMO_TABLE_NAME,
    KeyConditions: {
      UserId: {
        ComparisonOperator: 'EQ',
        AttributeValueList: [userId],
      },
      Item: {
        ComparisonOperator: 'BEGINS_WITH',
        AttributeValueList: [itemType],
      },
    },
  });
};

export const getAllRecipesForAUser = async (
  userId: string
): Promise<IRecipe[]> => {
  const result = await getAllItemsForAUser(userId, 'R-');
  return result.Items?.map(({ Item, UserId, ...obj }) => obj as IRecipe) ?? [];
};

export const getRecipe = async (
  recipeId: string,
  userId: string
): Promise<IRecipe> => {
  const result = await getFromDynamo({ type: 'R-', id: recipeId }, userId);
  return result.Item as IRecipe;
};
