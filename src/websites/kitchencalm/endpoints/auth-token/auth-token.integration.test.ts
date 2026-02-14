import { describe, it, expect, beforeAll, vi } from 'vitest';
import { App } from '../../../../server.js';
import { signJwt, verifyJwt } from '@core/utils/jwt.js';
import { createTestApp } from '@test/utils/app.js';

let app: App;
const validUserId = '550e8400-e29b-41d4-a716-446655440000';

beforeAll(async () => {
  app = await createTestApp({});
});

describe('POST /mcp/auth/token', () => {
  describe('Success cases', () => {
    it('should return 200 with token and userId when provided a valid JWT', async () => {
      const cognitoToken = await signJwt(validUserId);

      const response = await app.request(
        new Request('http://localhost/mcp/auth/token', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${cognitoToken}`,
          },
        })
      );

      expect(response.status).toBe(200);
      const body = (await response.json()) as { token: string; userId: string };
      expect(body).toHaveProperty('token');
      expect(body).toHaveProperty('userId');
      expect(body.userId).toBe(validUserId);
      expect(typeof body.token).toBe('string');
    });

    it('should return a valid JWT token that can be verified', async () => {
      const cognitoToken = await signJwt(validUserId);

      const response = await app.request(
        new Request('http://localhost/mcp/auth/token', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${cognitoToken}`,
          },
        })
      );

      const body = (await response.json()) as { token: string };
      const payload = await verifyJwt(body.token);

      expect(payload.userId).toBe(validUserId);
      expect(payload.iat).toBeDefined();
    });

    it('should generate different tokens for different requests', async () => {
      vi.useFakeTimers();

      try {
        const cognitoToken = await signJwt(validUserId);

        const response1 = await app.request(
          new Request('http://localhost/mcp/auth/token', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${cognitoToken}`,
            },
          })
        );

        // Advance timers by 1.1 seconds to ensure different iat timestamp
        vi.advanceTimersByTime(1100);

        const response2 = await app.request(
          new Request('http://localhost/mcp/auth/token', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${cognitoToken}`,
            },
          })
        );

        const body1 = (await response1.json()) as { token: string };
        const body2 = (await response2.json()) as { token: string };

        // Tokens should be different (different iat timestamps)
        expect(body1.token).not.toBe(body2.token);
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe('Authorization failures', () => {
    it('should return 401 when Authorization header is missing', async () => {
      const response = await app.request(
        new Request('http://localhost/mcp/auth/token', {
          method: 'POST',
        })
      );

      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body).toHaveProperty('error');
    });

    it('should return 401 when token is invalid', async () => {
      const response = await app.request(
        new Request('http://localhost/mcp/auth/token', {
          method: 'POST',
          headers: {
            Authorization: 'Bearer invalid-token',
          },
        })
      );

      expect(response.status).toBe(401);
    });

    it('should return 401 when Authorization header format is wrong', async () => {
      const response = await app.request(
        new Request('http://localhost/mcp/auth/token', {
          method: 'POST',
          headers: {
            Authorization: 'Basic some-credentials',
          },
        })
      );

      expect(response.status).toBe(401);
    });
  });
});
