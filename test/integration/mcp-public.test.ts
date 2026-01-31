import { describe, it, expect, beforeAll } from 'vitest';
import { App } from '../../src/server.js';
import { createTestApp } from '../utils/app.js';

let app: App;

beforeAll(async () => {
  app = await createTestApp({});
});

describe('GET /mcp/hello', () => {
  it('should return 200 with message and timestamp', async () => {
    const response = await app.request(
      new Request('http://localhost/mcp/hello', {
        method: 'GET',
      })
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as { message: string; timestamp: string };
    expect(body).toHaveProperty('message');
    expect(body).toHaveProperty('timestamp');
    expect(body.message).toBe('Hello from MCP!');
    expect(typeof body.timestamp).toBe('string');
  });

  it('should return valid ISO timestamp', async () => {
    const response = await app.request(
      new Request('http://localhost/mcp/hello', {
        method: 'GET',
      })
    );

    const body = (await response.json()) as { timestamp: string };
    const timestamp = new Date(body.timestamp);
    expect(timestamp.getTime()).toBeGreaterThan(0);
  });

  it('should not require any authentication', async () => {
    const response = await app.request(
      new Request('http://localhost/mcp/hello', {
        method: 'GET',
        headers: {
          // No auth headers
        },
      })
    );

    expect(response.status).toBe(200);
  });
});
