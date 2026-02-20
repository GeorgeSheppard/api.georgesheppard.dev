import { describe, it, expect, vi, beforeEach } from 'vitest';
import { parseRecipe, ParseRecipeRequest } from './parse-recipe.js';
import { createMockContext } from '@test/utils/mock-context.js';
import type { ContextWithUserId } from '@core/types/context.js';
import { Unit } from '@core/types/recipes.js';

vi.mock('@core/dynamodb/utilities.js');
vi.mock('../../utils/openai-recipe-parser.js');

import { updateRecipe as updateRecipeInDynamo, getRecipeByUuid } from '@core/dynamodb/utilities.js';
import { parseRecipeWithOpenAI } from '../../utils/openai-recipe-parser.js';

const validUserId = '550e8400-e29b-41d4-a716-446655440000';

const RECIPE_UUID = '550e8400-e29b-41d4-a716-446655440001';
const COMPONENT_UUID = '550e8400-e29b-41d4-a716-446655440002';

const validParsedRecipe = {
  uuid: RECIPE_UUID,
  name: 'Pasta Carbonara',
  description: 'Classic Italian pasta dish',
  images: [],
  components: [
    {
      name: 'Main',
      uuid: COMPONENT_UUID,
      ingredients: [
        { name: 'Spaghetti', quantity: { unit: Unit.GRAM, value: 200 } },
        { name: 'Eggs', quantity: { unit: Unit.NUMBER, value: 2 } },
      ],
      instructions: [
        { text: 'Cook pasta according to package instructions' },
        { text: 'Mix eggs with cheese' },
      ],
    },
  ],
};

function mockContext(userId = validUserId) {
  return createMockContext<ContextWithUserId>({
    userId,
    dynamoClient: { client: {} },
    openaiClient: { getClient: () => ({}) },
  });
}

describe('parseRecipe handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should parse recipe and save to DynamoDB', async () => {
    vi.mocked(parseRecipeWithOpenAI).mockResolvedValue(validParsedRecipe);
    vi.mocked(updateRecipeInDynamo).mockResolvedValue();

    const input: ParseRecipeRequest = { recipeText: 'Make pasta carbonara with eggs' };
    const result = await parseRecipe(mockContext(), input);

    expect(result).toEqual(validParsedRecipe);
    expect(parseRecipeWithOpenAI).toHaveBeenCalledWith(
      input.recipeText,
      expect.any(Object),
      undefined
    );
    expect(updateRecipeInDynamo).toHaveBeenCalledWith({}, validUserId, validParsedRecipe);
  });

  it('should pass dynamoClient to updateRecipe utility', async () => {
    const mockClient = { client: { put: vi.fn() } };
    const c = createMockContext<ContextWithUserId>({
      userId: validUserId,
      dynamoClient: mockClient,
      openaiClient: { getClient: () => ({}) },
    });
    vi.mocked(parseRecipeWithOpenAI).mockResolvedValue(validParsedRecipe);
    vi.mocked(updateRecipeInDynamo).mockResolvedValue();

    await parseRecipe(c, { recipeText: 'Pasta recipe' });

    expect(updateRecipeInDynamo).toHaveBeenCalledWith(
      mockClient.client,
      validUserId,
      validParsedRecipe
    );
  });

  it('should throw when OpenAI parsing fails', async () => {
    vi.mocked(parseRecipeWithOpenAI).mockRejectedValue(new Error('OpenAI API error'));

    await expect(parseRecipe(mockContext(), { recipeText: 'Make pasta' })).rejects.toThrow(
      'OpenAI API error'
    );
  });

  it('should throw when DynamoDB save fails', async () => {
    vi.mocked(parseRecipeWithOpenAI).mockResolvedValue(validParsedRecipe);
    vi.mocked(updateRecipeInDynamo).mockRejectedValue(new Error('DynamoDB error'));

    await expect(parseRecipe(mockContext(), { recipeText: 'Make pasta' })).rejects.toThrow(
      'DynamoDB error'
    );
  });

  it('should return the parsed recipe from OpenAI', async () => {
    const anotherRecipe = {
      ...validParsedRecipe,
      name: 'Different Recipe',
      uuid: '550e8400-e29b-41d4-a716-446655440003',
    };
    vi.mocked(parseRecipeWithOpenAI).mockResolvedValue(anotherRecipe);
    vi.mocked(updateRecipeInDynamo).mockResolvedValue();

    const result = await parseRecipe(mockContext(), { recipeText: 'Different recipe' });

    expect(result.name).toBe('Different Recipe');
    expect(result.uuid).toBe('550e8400-e29b-41d4-a716-446655440003');
  });

  it('should pass the recipeText and OpenAI client to parser', async () => {
    vi.mocked(parseRecipeWithOpenAI).mockResolvedValue(validParsedRecipe);
    vi.mocked(updateRecipeInDynamo).mockResolvedValue();

    const recipeText = 'Detailed recipe instructions go here';
    const context = mockContext();
    await parseRecipe(context, { recipeText });

    expect(parseRecipeWithOpenAI).toHaveBeenCalledWith(
      recipeText,
      context.get('openaiClient').getClient(),
      undefined
    );
  });

  it('should preserve existing images when editing a recipe', async () => {
    const existingImages = [{ timestamp: 1234567890, key: 'image-key-1' }];
    const existingRecipe = { ...validParsedRecipe, images: existingImages };
    const parsedWithoutImages = { ...validParsedRecipe, images: [] };

    vi.mocked(parseRecipeWithOpenAI).mockResolvedValue(parsedWithoutImages);
    vi.mocked(getRecipeByUuid).mockResolvedValue(existingRecipe);
    vi.mocked(updateRecipeInDynamo).mockResolvedValue();

    const input: ParseRecipeRequest = { recipeText: 'Updated recipe', recipeId: RECIPE_UUID };
    const result = await parseRecipe(mockContext(), input);

    expect(result.images).toEqual(existingImages);
    expect(getRecipeByUuid).toHaveBeenCalledWith({}, validUserId, RECIPE_UUID);
    expect(updateRecipeInDynamo).toHaveBeenCalledWith(
      {},
      validUserId,
      expect.objectContaining({ images: existingImages })
    );
  });

  it('should use empty images when editing a recipe with no existing record', async () => {
    vi.mocked(parseRecipeWithOpenAI).mockResolvedValue({ ...validParsedRecipe, images: [] });
    vi.mocked(getRecipeByUuid).mockResolvedValue(null);
    vi.mocked(updateRecipeInDynamo).mockResolvedValue();

    const input: ParseRecipeRequest = { recipeText: 'New recipe', recipeId: RECIPE_UUID };
    const result = await parseRecipe(mockContext(), input);

    expect(result.images).toEqual([]);
  });

  it('should not call getRecipeByUuid when creating a new recipe', async () => {
    vi.mocked(parseRecipeWithOpenAI).mockResolvedValue(validParsedRecipe);
    vi.mocked(updateRecipeInDynamo).mockResolvedValue();

    await parseRecipe(mockContext(), { recipeText: 'New recipe' });

    expect(getRecipeByUuid).not.toHaveBeenCalled();
  });
});
