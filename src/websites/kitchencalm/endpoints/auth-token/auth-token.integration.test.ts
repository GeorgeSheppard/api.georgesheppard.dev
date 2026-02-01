import { describe, it, expect, beforeAll, vi } from 'vitest';
import { App } from '../../../../server.js';
import { config } from '@config/index.js';
import { verifyJwt } from '@core/utils/jwt.js';
import { createTestApp } from '../../../../../test/utils/app.js';

let app: App;
const validUserId = '550e8400-e29b-41d4-a716-446655440000';
const invalidUserId = 'not-a-uuid';

beforeAll(async () => {
  app = await createTestApp({});
});

describe('POST /mcp/auth/token', () => {
  describe('Success cases', () => {
    it('should return 200 with token and userId when provided valid API key and UUID userId', async () => {
      const response = await app.request(
        new Request('http://localhost/mcp/auth/token', {
          method: 'POST',
          headers: {
            'x-api-key': config.API_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ userId: validUserId }),
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
      const response = await app.request(
        new Request('http://localhost/mcp/auth/token', {
          method: 'POST',
          headers: {
            'x-api-key': config.API_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ userId: validUserId }),
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
        const response1 = await app.request(
          new Request('http://localhost/mcp/auth/token', {
            method: 'POST',
            headers: {
              'x-api-key': config.API_KEY,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ userId: validUserId }),
          })
        );

        // Advance timers by 1.1 seconds to ensure different iat timestamp
        vi.advanceTimersByTime(1100);

        const response2 = await app.request(
          new Request('http://localhost/mcp/auth/token', {
            method: 'POST',
            headers: {
              'x-api-key': config.API_KEY,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ userId: validUserId }),
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
    it('should return 401 when API key is missing', async () => {
      const response = await app.request(
        new Request('http://localhost/mcp/auth/token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ userId: validUserId }),
        })
      );

      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body).toHaveProperty('error');
    });

    it('should return 401 when API key is invalid', async () => {
      const response = await app.request(
        new Request('http://localhost/mcp/auth/token', {
          method: 'POST',
          headers: {
            'x-api-key': 'wrong-api-key',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ userId: validUserId }),
        })
      );

      expect(response.status).toBe(401);
    });
  });

  describe('Validation failures', () => {
    it('should return 400 when userId is not a valid UUID', async () => {
      const response = await app.request(
        new Request('http://localhost/mcp/auth/token', {
          method: 'POST',
          headers: {
            'x-api-key': config.API_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ userId: invalidUserId }),
        })
      );

      expect(response.status).toBe(400);
    });

    it('should return 400 when userId is missing', async () => {
      const response = await app.request(
        new Request('http://localhost/mcp/auth/token', {
          method: 'POST',
          headers: {
            'x-api-key': config.API_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({}),
        })
      );

      expect(response.status).toBe(400);
    });

    it('should return 400 for invalid JSON body', async () => {
      const response = await app.request(
        new Request('http://localhost/mcp/auth/token', {
          method: 'POST',
          headers: {
            'x-api-key': config.API_KEY,
            'Content-Type': 'application/json',
          },
          body: 'invalid json',
        })
      );

      expect(response.status).toBe(400);
    });
  });
});
