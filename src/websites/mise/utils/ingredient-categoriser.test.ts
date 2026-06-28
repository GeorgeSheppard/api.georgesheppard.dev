import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockCreate = vi.fn();

vi.mock('openai', () => {
  return {
    default: class {
      chat = { completions: { create: mockCreate } };
    },
  };
});

vi.mock('@config/index.js', () => ({
  config: { OPENAI_API_KEY: 'test-key' },
}));

import { categoriseIngredients } from './ingredient-categoriser.js';

describe('categoriseIngredients', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return empty map for empty ingredients list', async () => {
    const result = await categoriseIngredients([]);
    expect(result).toEqual({});
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('should categorise ingredients via OpenAI', async () => {
    mockCreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              Chicken: 'Fresh Meat & Poultry',
              Milk: 'Dairy & Eggs',
              Carrots: 'Fresh Fruit & Vegetables',
            }),
          },
        },
      ],
    });

    const result = await categoriseIngredients(['Chicken', 'Milk', 'Carrots']);

    expect(result).toEqual({
      Chicken: 'Fresh Meat & Poultry',
      Milk: 'Dairy & Eggs',
      Carrots: 'Fresh Fruit & Vegetables',
    });
  });

  it('should fall back to Other for invalid categories', async () => {
    mockCreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              Chicken: 'Invalid Category',
              Milk: 'Dairy & Eggs',
            }),
          },
        },
      ],
    });

    const result = await categoriseIngredients(['Chicken', 'Milk']);

    expect(result).toEqual({
      Chicken: 'Other',
      Milk: 'Dairy & Eggs',
    });
  });

  it('should fall back to Other for missing ingredients in response', async () => {
    mockCreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              Milk: 'Dairy & Eggs',
            }),
          },
        },
      ],
    });

    const result = await categoriseIngredients(['Chicken', 'Milk']);

    expect(result).toEqual({
      Chicken: 'Other',
      Milk: 'Dairy & Eggs',
    });
  });

  it('should throw when OpenAI returns no content', async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: null } }],
    });

    await expect(categoriseIngredients(['Chicken'])).rejects.toThrow('No response from OpenAI');
  });

  it('should use gpt-4.1-mini model with temperature 0', async () => {
    mockCreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({ Chicken: 'Fresh Meat & Poultry' }),
          },
        },
      ],
    });

    await categoriseIngredients(['Chicken']);

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'gpt-4.1-mini',
        temperature: 0,
        response_format: { type: 'json_object' },
      })
    );
  });
});
