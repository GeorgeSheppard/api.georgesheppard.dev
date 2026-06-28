import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OpenAPIHono } from '@hono/zod-openapi';

vi.mock('@core/utils/cognito-oauth.js');
vi.mock('@core/utils/cognito-jwt.js');
vi.mock('@core/utils/session-cookie.js');

import { exchangeCodeForTokens } from '@core/utils/cognito-oauth.js';
import { verifyCognitoIdToken } from '@core/utils/cognito-jwt.js';
import { encryptSession } from '@core/utils/session-cookie.js';
import { registerCallbackRoute } from './callback.js';

function appWithCallback() {
  const app = new OpenAPIHono();
  registerCallbackRoute(app);
  return app;
}

describe('callback route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('redirects with auth_failed error when state does not match cookie', async () => {
    const app = appWithCallback();

    const res = await app.request('/auth/callback?code=abc&state=mismatched', {
      headers: { cookie: 'oauth_state=expected-state' },
    });

    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toContain('error=auth_failed');
    expect(exchangeCodeForTokens).not.toHaveBeenCalled();
  });

  it('redirects with auth_failed error when code or state missing', async () => {
    const app = appWithCallback();

    const res = await app.request('/auth/callback');

    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toContain('error=auth_failed');
  });

  it('exchanges code, sets session cookie, and redirects to stored redirect on success', async () => {
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
      nonce: 'expected-nonce',
    });
    vi.mocked(encryptSession).mockResolvedValue('encrypted-session-token');

    const app = appWithCallback();

    const res = await app.request('/auth/callback?code=abc&state=expected-state', {
      headers: {
        cookie:
          'oauth_state=expected-state; oauth_nonce=expected-nonce; oauth_redirect=https://mise.georgesheppard.dev/dashboard',
      },
      redirect: 'manual',
    });

    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('https://mise.georgesheppard.dev/dashboard');
    expect(res.headers.getSetCookie().some((c) => c.startsWith('session='))).toBe(true);
  });

  it('redirects with auth_failed when nonce does not match', async () => {
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
      nonce: 'wrong-nonce',
    });

    const app = appWithCallback();

    const res = await app.request('/auth/callback?code=abc&state=expected-state', {
      headers: {
        cookie: 'oauth_state=expected-state; oauth_nonce=expected-nonce',
      },
    });

    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toContain('error=auth_failed');
  });
});
