import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@config/index.js', () => ({
  config: { TYPESAFE_API_KEY: 'test-key' },
}));

import { categoriseIngredients } from './ingredient-categoriser.js';

const mockFetch = vi.fn();

function jevResponse(choices: Record<string, string>, ok = true, status = 200) {
  return {
    ok,
    status,
    json: async () => ({
      answers: Object.fromEntries(
        Object.entries(choices).map(([id, choice]) => [id, { type: 'choice', choice }])
      ),
    }),
  };
}

describe('categoriseIngredients', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch);
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should return empty map for empty ingredients list', async () => {
    const result = await categoriseIngredients([]);
    expect(result).toEqual({});
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('should categorise ingredients via Jev', async () => {
    mockFetch.mockResolvedValue(
      jevResponse({
        q0: 'Fresh Meat & Poultry',
        q1: 'Dairy & Eggs',
        q2: 'Fresh Fruit & Vegetables',
      })
    );

    const result = await categoriseIngredients(['Chicken', 'Milk', 'Carrots']);

    expect(result).toEqual({
      Chicken: 'Fresh Meat & Poultry',
      Milk: 'Dairy & Eggs',
      Carrots: 'Fresh Fruit & Vegetables',
    });
  });

  it('should fall back to Other for invalid categories', async () => {
    mockFetch.mockResolvedValue(jevResponse({ q0: 'Invalid Category', q1: 'Dairy & Eggs' }));

    const result = await categoriseIngredients(['Chicken', 'Milk']);

    expect(result).toEqual({ Chicken: 'Other', Milk: 'Dairy & Eggs' });
  });

  it('should fall back to Other for missing answers', async () => {
    mockFetch.mockResolvedValue(jevResponse({ q1: 'Dairy & Eggs' }));

    const result = await categoriseIngredients(['Chicken', 'Milk']);

    expect(result).toEqual({ Chicken: 'Other', Milk: 'Dairy & Eggs' });
  });

  it('should throw when Jev returns an error status', async () => {
    mockFetch.mockResolvedValue(jevResponse({}, false, 429));

    await expect(categoriseIngredients(['Chicken'])).rejects.toThrow('Jev request failed: 429');
  });

  it('should send one choice question per ingredient with the API key', async () => {
    mockFetch.mockResolvedValue(jevResponse({ q0: 'Fresh Meat & Poultry', q1: 'Dairy & Eggs' }));

    await categoriseIngredients(['Chicken', 'Milk']);

    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe('https://api.typesafe.ai/v1/systemone');
    expect(init.headers.Authorization).toBe('Bearer test-key');
    const body = JSON.parse(init.body);
    expect(body.model).toBe('jev-latest');
    expect(Object.keys(body.questions)).toEqual(['q0', 'q1']);
    expect(body.questions.q0.type).toBe('choice');
    expect(body.questions.q0.instructions).toContain('Chicken');
    expect(Object.keys(body.questions.q0.criteria)).toContain('Other');
  });
});
