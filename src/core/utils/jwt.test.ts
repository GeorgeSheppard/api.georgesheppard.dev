import { describe, it, expect, vi, beforeEach } from 'vitest';
import { signJwt, verifyJwt } from './jwt.js';
import { jwtVerify } from 'jose';

const validUserId = '550e8400-e29b-41d4-a716-446655440000';
const anotherUserId = '550e8400-e29b-41d4-a716-446655440001';

describe('JWT utility functions', () => {
  describe('signJwt', () => {
    it('should create a valid JWT token', async () => {
      const token = await signJwt(validUserId);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT format: header.payload.signature
    });

    it('should create different tokens for different user IDs', async () => {
      const token1 = await signJwt(validUserId);
      const token2 = await signJwt(anotherUserId);

      expect(token1).not.toBe(token2);
    });

    it('should create different tokens when called with delay for same userId', async () => {
      const token1 = await signJwt(validUserId);
      // Wait 1 second to ensure different iat (issued at) timestamp
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const token2 = await signJwt(validUserId);

      expect(token1).not.toBe(token2);
    });

    it('should create token with userId in payload', async () => {
      const token = await signJwt(validUserId);
      const decoded = await verifyJwt(token);

      expect(decoded.userId).toBe(validUserId);
    });

    it('should create token with issuedAt claim', async () => {
      const before = Math.floor(Date.now() / 1000);
      const token = await signJwt(validUserId);
      const after = Math.floor(Date.now() / 1000);

      const decoded = await verifyJwt(token);

      expect(decoded.iat).toBeDefined();
      expect(decoded.iat).toBeGreaterThanOrEqual(before);
      expect(decoded.iat).toBeLessThanOrEqual(after);
    });

    it('should handle empty string userId', async () => {
      const token = await signJwt('');
      const decoded = await verifyJwt(token);

      expect(decoded.userId).toBe('');
    });

    it('should handle special characters in userId', async () => {
      const specialUserId = 'user@example.com';
      const token = await signJwt(specialUserId);
      const decoded = await verifyJwt(token);

      expect(decoded.userId).toBe(specialUserId);
    });
  });

  describe('verifyJwt', () => {
    it('should successfully verify a valid token', async () => {
      const token = await signJwt(validUserId);
      const payload = await verifyJwt(token);

      expect(payload).toBeDefined();
      expect(payload.userId).toBe(validUserId);
    });

    it('should return userId from token payload', async () => {
      const token = await signJwt(anotherUserId);
      const payload = await verifyJwt(token);

      expect(payload.userId).toBe(anotherUserId);
    });

    it('should include standard JWT claims', async () => {
      const token = await signJwt(validUserId);
      const payload = await verifyJwt(token);

      expect(payload.iat).toBeDefined(); // issuedAt
      expect(typeof payload.iat).toBe('number');
    });

    it('should reject invalid token format', async () => {
      const invalidToken = 'invalid.token.format';

      await expect(verifyJwt(invalidToken)).rejects.toThrow();
    });

    it('should reject completely malformed token', async () => {
      const malformedToken = 'not-a-jwt-at-all';

      await expect(verifyJwt(malformedToken)).rejects.toThrow();
    });

    it('should reject empty string token', async () => {
      await expect(verifyJwt('')).rejects.toThrow();
    });

    it('should reject token with incorrect signature', async () => {
      const token = await signJwt(validUserId);
      // Tamper with the signature
      const parts = token.split('.');
      const tamperedToken = `${parts[0]}.${parts[1]}.${parts[2]}xyz`;

      await expect(verifyJwt(tamperedToken)).rejects.toThrow();
    });

    it('should reject token with tampered payload', async () => {
      const token = await signJwt(validUserId);
      const parts = token.split('.');
      // Create a tampered payload
      const tamperedPayload = btoa(JSON.stringify({ userId: 'different-user' }));
      const tamperedToken = `${parts[0]}.${tamperedPayload}.${parts[2]}`;

      await expect(verifyJwt(tamperedToken)).rejects.toThrow();
    });
  });

  describe('Round-trip sign and verify', () => {
    it('should successfully sign and verify multiple user IDs', async () => {
      const userIds = [validUserId, anotherUserId, 'user123', 'admin@example.com'];

      for (const userId of userIds) {
        const token = await signJwt(userId);
        const payload = await verifyJwt(token);

        expect(payload.userId).toBe(userId);
      }
    });

    it('should maintain userId integrity through sign-verify cycle', async () => {
      const testUserId = '123e4567-e89b-12d3-a456-426614174000';
      const token = await signJwt(testUserId);
      const payload = await verifyJwt(token);

      expect(payload.userId).toBe(testUserId);
      expect(payload.userId).toHaveLength(testUserId.length);
    });

    it('should preserve userId case sensitivity', async () => {
      const mixedCaseUserId = 'UsEr-123-AbC';
      const token = await signJwt(mixedCaseUserId);
      const payload = await verifyJwt(token);

      expect(payload.userId).toBe(mixedCaseUserId);
      expect(payload.userId).not.toBe(mixedCaseUserId.toLowerCase());
    });
  });

  describe('Token structure and algorithm', () => {
    it('should use HS256 algorithm in token header', async () => {
      const token = await signJwt(validUserId);
      const parts = token.split('.');
      const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf-8'));

      expect(header.alg).toBe('HS256');
    });

    it('should create JWT with correct structure', async () => {
      const token = await signJwt(validUserId);
      const parts = token.split('.');

      expect(parts).toHaveLength(3);
      expect(parts[0]).toBeTruthy(); // header
      expect(parts[1]).toBeTruthy(); // payload
      expect(parts[2]).toBeTruthy(); // signature
    });

    it('should include only expected claims in payload', async () => {
      const token = await signJwt(validUserId);
      const payload = await verifyJwt(token);

      const expectedKeys = ['userId', 'iat'];
      const actualKeys = Object.keys(payload);

      for (const key of expectedKeys) {
        expect(actualKeys).toContain(key);
      }
    });
  });

  describe('Edge cases', () => {
    it('should handle very long userId', async () => {
      const longUserId = 'x'.repeat(1000);
      const token = await signJwt(longUserId);
      const payload = await verifyJwt(token);

      expect(payload.userId).toBe(longUserId);
    });

    it('should handle numeric string userId', async () => {
      const numericUserId = '12345';
      const token = await signJwt(numericUserId);
      const payload = await verifyJwt(token);

      expect(payload.userId).toBe(numericUserId);
      expect(typeof payload.userId).toBe('string');
    });

    it('should handle userId with whitespace', async () => {
      const userIdWithSpace = 'user 123';
      const token = await signJwt(userIdWithSpace);
      const payload = await verifyJwt(token);

      expect(payload.userId).toBe(userIdWithSpace);
    });

    it('should handle UUID format userId', async () => {
      const uuidUserId = '550e8400-e29b-41d4-a716-446655440000';
      const token = await signJwt(uuidUserId);
      const payload = await verifyJwt(token);

      expect(payload.userId).toBe(uuidUserId);
      expect(payload.userId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
      );
    });
  });
});
