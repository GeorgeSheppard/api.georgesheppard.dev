import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { isEngineOrigin, engineOriginGuard } from './origin.js';

describe('engine origin', () => {
  it('only allows the engine site', () => {
    expect(isEngineOrigin('https://engine.georgesheppard.dev')).toBe(true);
    expect(isEngineOrigin('https://evil.example')).toBe(false);
    expect(isEngineOrigin('http://localhost:5173')).toBe(false);
    expect(isEngineOrigin('https://mise.georgesheppard.dev')).toBe(false);
    expect(isEngineOrigin(undefined)).toBe(false);
  });

  it('guards requests by Origin header', async () => {
    const app = new Hono();
    app.use('*', engineOriginGuard);
    app.get('/x', (c) => c.text('ok'));
    const headers = (origin?: string) => (origin ? { Origin: origin } : undefined);
    expect(
      (await app.request('/x', { headers: headers('https://engine.georgesheppard.dev') })).status
    ).toBe(200);
    expect((await app.request('/x', { headers: headers('https://evil.example') })).status).toBe(
      403
    );
    expect((await app.request('/x')).status).toBe(403);
  });
});
