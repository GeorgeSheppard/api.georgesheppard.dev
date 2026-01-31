import { describe, it, expect, beforeAll } from 'vitest';
import { App } from '../../src/server.js';
import { config } from '@config/index.js';
import { verifyJwt } from '@core/utils/jwt.js';
import { createTestApp } from '../utils/app.js';

let app: App;
const testUserId = '550e8400-e29b-41d4-a716-446655440000';

beforeAll(async () => {
  app = await createTestApp({});
});

describe('MCP Authentication Flow', () => {
  it('should complete full flow: public endpoint -> generate token -> use protected endpoint', async () => {
    // Step 1: Access public endpoint
    const publicResponse = await app.request(
      new Request('http://localhost/mcp/hello', {
        method: 'GET',
      })
    );

    expect(publicResponse.status).toBe(200);
    const publicBody = (await publicResponse.json()) as { message: string };
    expect(publicBody.message).toBe('Hello from MCP!');

    // Step 2: Generate JWT token with API key
    const tokenResponse = await app.request(
      new Request('http://localhost/mcp/auth/token', {
        method: 'POST',
        headers: {
          'x-api-key': config.API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: testUserId }),
      })
    );

    expect(tokenResponse.status).toBe(200);
    const tokenBody = (await tokenResponse.json()) as { token: string; userId: string };
    const token = tokenBody.token;
    expect(tokenBody.userId).toBe(testUserId);

    // Verify token is valid JWT
    const payload = await verifyJwt(token);
    expect(payload.userId).toBe(testUserId);

    // Step 3: Use token to access protected endpoint
    const protectedResponse = await app.request(
      new Request('http://localhost/mcp/hello-protected', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
    );

    expect(protectedResponse.status).toBe(200);
    const protectedBody = (await protectedResponse.json()) as { userId: string; message: string };
    expect(protectedBody.userId).toBe(testUserId);
    expect(typeof protectedBody.message).toBe('string');
  });

  it('should prevent access to protected endpoint without token from public endpoint', async () => {
    // Try to access protected endpoint without generating token first
    const response = await app.request(
      new Request('http://localhost/mcp/hello-protected', {
        method: 'GET',
        headers: {
          // No Authorization header
        },
      })
    );

    expect(response.status).toBe(401);
  });

  it('should fail if API key is wrong when generating token', async () => {
    const response = await app.request(
      new Request('http://localhost/mcp/auth/token', {
        method: 'POST',
        headers: {
          'x-api-key': 'wrong-key',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: testUserId }),
      })
    );

    expect(response.status).toBe(401);
  });

  it('should allow multiple users to have different tokens', async () => {
    const userId1 = '550e8400-e29b-41d4-a716-446655440001';
    const userId2 = '550e8400-e29b-41d4-a716-446655440002';

    // Generate token for user 1
    const token1Response = await app.request(
      new Request('http://localhost/mcp/auth/token', {
        method: 'POST',
        headers: {
          'x-api-key': config.API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: userId1 }),
      })
    );

    const token1Body = (await token1Response.json()) as { token: string };
    const token1 = token1Body.token;

    // Generate token for user 2
    const token2Response = await app.request(
      new Request('http://localhost/mcp/auth/token', {
        method: 'POST',
        headers: {
          'x-api-key': config.API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: userId2 }),
      })
    );

    const token2Body = (await token2Response.json()) as { token: string };
    const token2 = token2Body.token;

    // Tokens should be different
    expect(token1).not.toBe(token2);

    // Use token1 to access protected endpoint and verify userId
    const response1 = await app.request(
      new Request('http://localhost/mcp/hello-protected', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token1}`,
        },
      })
    );

    const body1 = (await response1.json()) as { userId: string };
    expect(body1.userId).toBe(userId1);

    // Use token2 to access protected endpoint and verify userId
    const response2 = await app.request(
      new Request('http://localhost/mcp/hello-protected', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token2}`,
        },
      })
    );

    const body2 = (await response2.json()) as { userId: string };
    expect(body2.userId).toBe(userId2);
  });
});
