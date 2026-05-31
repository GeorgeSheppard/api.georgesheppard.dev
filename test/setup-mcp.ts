import { vi } from 'vitest';

// Mock Cognito JWT verification to always fail, allowing fallback to internal JWT
vi.mock('@core/utils/cognito-jwt.js', () => ({
  verifyCognitoJwt: vi.fn().mockRejectedValue(new Error('Cognito verification disabled in tests')),
}));
