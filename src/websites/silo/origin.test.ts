import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { isSiloOrigin, siloOriginGuard } from './origin.js';

describe('silo origin', () => {
  it('only allows the engine site (plus localhost outside production)', () => {
    expect(isSiloOrigin('https://engine.georgesheppard.dev')).toBe(true);
    expect(isSiloOrigin('https://evil.example')).toBe(false);
    expect(isSiloOrigin('https://mise.georgesheppard.dev')).toBe(false);
    expect(isSiloOrigin(undefined)).toBe(false);
  });

  it('guards requests by Origin header', async () => {
    const app = new Hono();
    app.use('*', siloOriginGuard);
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
