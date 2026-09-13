import { describe, it, expect } from 'vitest';
import { sanitizeCustomPreferences } from './openai-recommender.js';

describe('sanitizeCustomPreferences', () => {
  it('returns null for empty/null/undefined input', () => {
    expect(sanitizeCustomPreferences(null)).toBeNull();
    expect(sanitizeCustomPreferences(undefined)).toBeNull();
    expect(sanitizeCustomPreferences('')).toBeNull();
    expect(sanitizeCustomPreferences('   ')).toBeNull();
  });

  it('trims surrounding whitespace', () => {
    expect(sanitizeCustomPreferences('  more fantasy please  ')).toBe('more fantasy please');
  });

  it('replaces control characters with whitespace', () => {
    expect(sanitizeCustomPreferences('no\x00romance\x1bplease')).toBe('no romance please');
  });

  it('truncates to the max length', () => {
    const result = sanitizeCustomPreferences('a'.repeat(1000));
    expect(result).toHaveLength(500);
  });
});
