import { describe, it, expect, beforeAll } from 'vitest';
import { App } from '../../src/server.js';
import { config } from '@config/index.js';
import { signJwt } from '@core/utils/jwt.js';
import { createTestApp } from '../utils/app.js';

let app: App;
const validUserId = '550e8400-e29b-41d4-a716-446655440000';
const anotherUserId = '550e8400-e29b-41d4-a716-446655440001';

beforeAll(async () => {
  app = await createTestApp({});
});

describe('GET /mcp/hello-protected', () => {
  describe('Success cases', () => {
    it('should return 200 with message, userId, and timestamp when provided valid JWT', async () => {
      const token = await signJwt(validUserId);

      const response = await app.request(
        new Request('http://localhost/mcp/hello-protected', {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })
      );

      expect(response.status).toBe(200);
      const body = (await response.json()) as { message: string; userId: string; timestamp: string };
      expect(body).toHaveProperty('message');
      expect(body).toHaveProperty('userId');
      expect(body).toHaveProperty('timestamp');
      expect(body.userId).toBe(validUserId);
      expect(typeof body.message).toBe('string');
      expect(typeof body.timestamp).toBe('string');
    });

    it('should extract correct userId from JWT', async () => {
      const token = await signJwt(anotherUserId);

      const response = await app.request(
        new Request('http://localhost/mcp/hello-protected', {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })
      );

      const body = (await response.json()) as { userId: string };
      expect(body.userId).toBe(anotherUserId);
    });

    it('should return valid ISO timestamp', async () => {
      const token = await signJwt(validUserId);

      const response = await app.request(
        new Request('http://localhost/mcp/hello-protected', {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })
      );

      const body = (await response.json()) as { timestamp: string };
      const timestamp = new Date(body.timestamp);
      expect(timestamp.getTime()).toBeGreaterThan(0);
    });
  });

  describe('Authentication failures', () => {
    it('should return 401 when Authorization header is missing', async () => {
      const response = await app.request(
        new Request('http://localhost/mcp/hello-protected', {
          method: 'GET',
          headers: {
            // No Authorization header
          },
        })
      );

      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body).toHaveProperty('error');
    });

    it('should return 401 when Authorization header does not have Bearer prefix', async () => {
      const token = await signJwt(validUserId);

      const response = await app.request(
        new Request('http://localhost/mcp/hello-protected', {
          method: 'GET',
          headers: {
            Authorization: token, // Missing "Bearer " prefix
          },
        })
      );

      expect(response.status).toBe(401);
    });

    it('should return 401 when JWT token is invalid', async () => {
      const response = await app.request(
        new Request('http://localhost/mcp/hello-protected', {
          method: 'GET',
          headers: {
            Authorization: 'Bearer invalid.token.here',
          },
        })
      );

      expect(response.status).toBe(401);
    });

    it('should return 401 when JWT signature is tampered with', async () => {
      const token = await signJwt(validUserId);
      // Tamper with the signature
      const tamperedToken = token.slice(0, -10) + '0000000000';

      const response = await app.request(
        new Request('http://localhost/mcp/hello-protected', {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${tamperedToken}`,
          },
        })
      );

      expect(response.status).toBe(401);
    });

    it('should return 401 when JWT payload is tampered with', async () => {
      const token = await signJwt(validUserId);
      const parts = token.split('.');
      // Tamper with the payload (middle part)
      const tamperedToken = parts[0] + '.eyJ1c2VySWQiOiJ0YW1wZXJlZCJ9.' + parts[2];

      const response = await app.request(
        new Request('http://localhost/mcp/hello-protected', {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${tamperedToken}`,
          },
        })
      );

      expect(response.status).toBe(401);
    });

    it('should return 401 when JWT is empty string', async () => {
      const response = await app.request(
        new Request('http://localhost/mcp/hello-protected', {
          method: 'GET',
          headers: {
            Authorization: 'Bearer ',
          },
        })
      );

      expect(response.status).toBe(401);
    });
  });
});
