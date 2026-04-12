import { vi } from 'vitest';

// Prevent network calls to Cognito JWKS during tests. The jwt-auth middleware
// will catch this and fall through to internal JWT verification.
vi.mock('@core/utils/cognito-jwt.js', () => ({
  verifyCognitoJwt: vi.fn().mockRejectedValue(new Error('Cognito JWT not available in tests')),
}));
