import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OpenAPIHono } from '@hono/zod-openapi';

vi.mock('@core/utils/session-cookie.js');
vi.mock('@core/utils/cognito-oauth.js');

import { decryptSession, encryptSession } from '@core/utils/session-cookie.js';
import { refreshTokens } from '@core/utils/cognito-oauth.js';
import { registerSessionRoute } from './session.js';

function appWithSession() {
  const app = new OpenAPIHono();
  registerSessionRoute(app);
  return app;
}

describe('session route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when no session cookie is present', async () => {
    const app = appWithSession();

    const res = await app.request('/auth/session');

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'Unauthorized' });
  });

  it('returns 401 and clears cookie when session cannot be decrypted', async () => {
    vi.mocked(decryptSession).mockRejectedValue(new Error('bad token'));

    const app = appWithSession();
    const res = await app.request('/auth/session', { headers: { cookie: 'session=garbage' } });

    expect(res.status).toBe(401);
    expect(res.headers.getSetCookie().some((c) => c.startsWith('session=;'))).toBe(true);
  });

  it('returns the user when the session has not expired', async () => {
    vi.mocked(decryptSession).mockResolvedValue({
      userId: 'user-123',
      email: 'user@example.com',
      accessToken: 'access',
      refreshToken: 'refresh',
      expiresAt: Math.floor(Date.now() / 1000) + 3600,
    });

    const app = appWithSession();
    const res = await app.request('/auth/session', { headers: { cookie: 'session=valid' } });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ user: { id: 'user-123', email: 'user@example.com' } });
    expect(refreshTokens).not.toHaveBeenCalled();
  });

  it('refreshes the session when access token is near expiry', async () => {
    vi.mocked(decryptSession).mockResolvedValue({
      userId: 'user-123',
      email: 'user@example.com',
      accessToken: 'access',
      refreshToken: 'refresh',
      expiresAt: Math.floor(Date.now() / 1000) + 60,
    });
    vi.mocked(refreshTokens).mockResolvedValue({
      access_token: 'new-access',
      id_token: 'id',
      refresh_token: 'new-refresh',
      expires_in: 3600,
      token_type: 'Bearer',
    });
    vi.mocked(encryptSession).mockResolvedValue('new-encrypted-session');

    const app = appWithSession();
    const res = await app.request('/auth/session', { headers: { cookie: 'session=valid' } });

    expect(res.status).toBe(200);
    expect(
      res.headers.getSetCookie().some((c) => c.startsWith('session=new-encrypted-session'))
    ).toBe(true);
  });

  it('returns 401 and clears cookie when refresh fails', async () => {
    vi.mocked(decryptSession).mockResolvedValue({
      userId: 'user-123',
      email: 'user@example.com',
      accessToken: 'access',
      refreshToken: 'refresh',
      expiresAt: Math.floor(Date.now() / 1000) + 60,
    });
    vi.mocked(refreshTokens).mockRejectedValue(new Error('refresh failed'));

    const app = appWithSession();
    const res = await app.request('/auth/session', { headers: { cookie: 'session=valid' } });

    expect(res.status).toBe(401);
    expect(res.headers.getSetCookie().some((c) => c.startsWith('session=;'))).toBe(true);
  });
});
