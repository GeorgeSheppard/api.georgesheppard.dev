import { describe, it, expect } from 'vitest';
import { resolveRedirectUri } from './redirect.js';

describe('resolveRedirectUri', () => {
  it('returns the default frontend when no uri is requested', () => {
    expect(resolveRedirectUri(undefined)).toBe('http://localhost:3000');
  });

  it('returns the requested uri when its origin is in the allowlist', () => {
    expect(resolveRedirectUri('https://mise.georgesheppard.dev/dashboard')).toBe(
      'https://mise.georgesheppard.dev/dashboard'
    );
    expect(resolveRedirectUri('http://localhost:3000/some/path')).toBe(
      'http://localhost:3000/some/path'
    );
  });

  it('falls back to the default when the origin is not allowed', () => {
    expect(resolveRedirectUri('https://evil.example.com')).toBe('http://localhost:3000');
  });

  it('falls back to the default when the uri is not a valid url', () => {
    expect(resolveRedirectUri('not-a-url')).toBe('http://localhost:3000');
  });
});
