import { vi } from 'vitest';

// Mock jose's createRemoteJWKSet to prevent external Cognito API calls in tests
vi.mock('jose', async () => {
  const actual = await vi.importActual('jose');
  return {
    ...actual,
    createRemoteJWKSet: vi.fn(() => ({
      getKey: vi.fn().mockRejectedValue(new Error('JWKS not available in tests')),
    })),
  };
});
