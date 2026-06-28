import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OpenAPIHono } from '@hono/zod-openapi';

vi.mock('@core/utils/cognito-oauth.js');
vi.mock('@core/utils/cognito-jwt.js');

import {
  exchangeCodeForTokens,
  refreshTokens,
  buildLogoutUrl,
  buildAuthorizeUrl,
} from '@core/utils/cognito-oauth.js';
import { verifyCognitoIdToken } from '@core/utils/cognito-jwt.js';
import { registerAuthRoutes } from './index.js';

function appWithAuth() {
  const app = new OpenAPIHono();
  registerAuthRoutes(app);
  return app;
}

function cookiesFrom(res: Response): string {
  return res.headers
    .getSetCookie()
    .map((c) => decodeURIComponent(c.split(';')[0]))
    .join('; ');
}

describe('auth end-to-end flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(buildAuthorizeUrl).mockReturnValue(
      'https://cognito.example.com/oauth2/authorize?state=x'
    );
  });

  it('completes login -> callback -> session -> logout for a valid Cognito exchange', async () => {
    const app = appWithAuth();

    const loginRes = await app.request(
      '/auth/login?redirect_uri=https://mise.georgesheppard.dev/dashboard',
      {
        redirect: 'manual',
      }
    );
    expect(loginRes.status).toBe(302);
    expect(loginRes.headers.get('location')).toContain('/oauth2/authorize');

    const oauthCookies = cookiesFrom(loginRes);
    const state = /oauth_state=([^;]+)/.exec(oauthCookies)?.[1];
    expect(state).toBeTruthy();

    vi.mocked(exchangeCodeForTokens).mockResolvedValue({
      access_token: 'access',
      id_token: 'id',
      refresh_token: 'refresh',
      expires_in: 3600,
      token_type: 'Bearer',
    });
    vi.mocked(verifyCognitoIdToken).mockResolvedValue({
      sub: 'user-123',
      email: 'user@example.com',
      nonce: /oauth_nonce=([^;]+)/.exec(oauthCookies)?.[1],
    });

    const callbackRes = await app.request(`/auth/callback?code=auth-code&state=${state}`, {
      headers: { cookie: oauthCookies },
      redirect: 'manual',
    });
    expect(callbackRes.status).toBe(302);
    expect(callbackRes.headers.get('location')).toBe('https://mise.georgesheppard.dev/dashboard');

    const sessionCookies = cookiesFrom(callbackRes);
    expect(sessionCookies).toContain('session=');

    const sessionRes = await app.request('/auth/session', {
      headers: { cookie: sessionCookies },
    });
    expect(sessionRes.status).toBe(200);
    expect(await sessionRes.json()).toEqual({
      user: { id: 'user-123', email: 'user@example.com' },
    });

    vi.mocked(buildLogoutUrl).mockReturnValue('https://cognito.example.com/logout');

    const logoutRes = await app.request(
      '/auth/logout?redirect_uri=https://mise.georgesheppard.dev/signed-out',
      { method: 'POST', headers: { cookie: sessionCookies } }
    );
    expect(logoutRes.status).toBe(200);
    expect(await logoutRes.json()).toEqual({
      success: true,
      cognitoLogoutUrl: 'https://cognito.example.com/logout',
    });
    expect(buildLogoutUrl).toHaveBeenCalledWith('https://mise.georgesheppard.dev/signed-out');
    expect(logoutRes.headers.getSetCookie().some((c) => c.startsWith('session=;'))).toBe(true);
  });

  it('rejects callback when state cookie is missing or mismatched, redirecting to default frontend', async () => {
    const app = appWithAuth();

    const res = await app.request('/auth/callback?code=abc&state=tampered', {
      redirect: 'manual',
    });

    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('http://localhost:3000/?error=auth_failed');
    expect(exchangeCodeForTokens).not.toHaveBeenCalled();
  });

  it('falls back to the default frontend when an unrecognised redirect_uri is requested at login', async () => {
    const app = appWithAuth();

    const loginRes = await app.request('/auth/login?redirect_uri=https://evil.example.com', {
      redirect: 'manual',
    });
    const oauthCookies = cookiesFrom(loginRes);
    expect(oauthCookies).toContain('oauth_redirect=http://localhost:3000');

    const state = /oauth_state=([^;]+)/.exec(oauthCookies)?.[1];
    vi.mocked(exchangeCodeForTokens).mockResolvedValue({
      access_token: 'access',
      id_token: 'id',
      refresh_token: 'refresh',
      expires_in: 3600,
      token_type: 'Bearer',
    });
    vi.mocked(verifyCognitoIdToken).mockResolvedValue({
      sub: 'user-123',
      email: 'user@example.com',
      nonce: /oauth_nonce=([^;]+)/.exec(oauthCookies)?.[1],
    });

    const callbackRes = await app.request(`/auth/callback?code=auth-code&state=${state}`, {
      headers: { cookie: oauthCookies },
      redirect: 'manual',
    });
    expect(callbackRes.status).toBe(302);
    expect(callbackRes.headers.get('location')).toBe('http://localhost:3000');
  });

  it('returns 401 and clears the session cookie when no session exists', async () => {
    const app = appWithAuth();

    const res = await app.request('/auth/session');

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'Unauthorized' });
  });

  it('refreshes an expiring session transparently through the full session flow', async () => {
    const app = appWithAuth();

    const loginRes = await app.request('/auth/login', { redirect: 'manual' });
    const oauthCookies = cookiesFrom(loginRes);
    const state = /oauth_state=([^;]+)/.exec(oauthCookies)?.[1];

    vi.mocked(exchangeCodeForTokens).mockResolvedValue({
      access_token: 'access',
      id_token: 'id',
      refresh_token: 'refresh',
      expires_in: 60,
      token_type: 'Bearer',
    });
    vi.mocked(verifyCognitoIdToken).mockResolvedValue({
      sub: 'user-123',
      email: 'user@example.com',
      nonce: /oauth_nonce=([^;]+)/.exec(oauthCookies)?.[1],
    });

    const callbackRes = await app.request(`/auth/callback?code=auth-code&state=${state}`, {
      headers: { cookie: oauthCookies },
      redirect: 'manual',
    });
    const sessionCookies = cookiesFrom(callbackRes);

    vi.mocked(refreshTokens).mockResolvedValue({
      access_token: 'new-access',
      id_token: 'id',
      refresh_token: 'new-refresh',
      expires_in: 3600,
      token_type: 'Bearer',
    });

    const sessionRes = await app.request('/auth/session', { headers: { cookie: sessionCookies } });

    expect(sessionRes.status).toBe(200);
    expect(refreshTokens).toHaveBeenCalledWith('refresh');
    expect(sessionRes.headers.getSetCookie().some((c) => c.startsWith('session='))).toBe(true);
  });

  it('applies the configured CORS policy to auth routes', async () => {
    const app = appWithAuth();

    const res = await app.request('/auth/session', {
      headers: { origin: 'https://mise.georgesheppard.dev' },
    });

    expect(res.headers.get('access-control-allow-origin')).toBe('https://mise.georgesheppard.dev');
    expect(res.headers.get('access-control-allow-credentials')).toBe('true');
  });

  it('does not allow an unrecognised origin through CORS', async () => {
    const app = appWithAuth();

    const res = await app.request('/auth/session', {
      headers: { origin: 'https://evil.example.com' },
    });

    expect(res.headers.get('access-control-allow-origin')).toBeNull();
  });
});
