import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OpenAPIHono } from '@hono/zod-openapi';

vi.mock('@core/utils/cognito-oauth.js');
import { buildAuthorizeUrl } from '@core/utils/cognito-oauth.js';
import { registerLoginRoute } from './login.js';

describe('login route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('redirects to the cognito authorize url and sets oauth cookies', async () => {
    vi.mocked(buildAuthorizeUrl).mockReturnValue('https://cognito.example.com/oauth2/authorize');

    const app = new OpenAPIHono();
    registerLoginRoute(app);

    const res = await app.request('/auth/login');

    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('https://cognito.example.com/oauth2/authorize');

    const setCookies = res.headers.getSetCookie();
    expect(setCookies.some((c) => c.startsWith('oauth_state='))).toBe(true);
    expect(setCookies.some((c) => c.startsWith('oauth_nonce='))).toBe(true);
    expect(setCookies.some((c) => c.startsWith('oauth_redirect='))).toBe(true);
  });

  it('passes state and nonce through to buildAuthorizeUrl', async () => {
    vi.mocked(buildAuthorizeUrl).mockReturnValue('https://cognito.example.com/oauth2/authorize');

    const app = new OpenAPIHono();
    registerLoginRoute(app);

    await app.request('/auth/login?redirect_uri=https://frontend.example.com/dashboard');

    expect(buildAuthorizeUrl).toHaveBeenCalledWith(
      expect.objectContaining({
        state: expect.any(String),
        nonce: expect.any(String),
        redirectUri: expect.stringContaining('/auth/callback'),
      })
    );
  });

  it('stores the requested redirect_uri cookie when its origin is allowed', async () => {
    vi.mocked(buildAuthorizeUrl).mockReturnValue('https://cognito.example.com/oauth2/authorize');

    const app = new OpenAPIHono();
    registerLoginRoute(app);

    const res = await app.request(
      '/auth/login?redirect_uri=https://kitchencalm.georgesheppard.dev/dashboard'
    );

    expect(
      res.headers
        .getSetCookie()
        .some((c) =>
          c.startsWith('oauth_redirect=https%3A%2F%2Fkitchencalm.georgesheppard.dev%2Fdashboard')
        )
    ).toBe(true);
  });

  it('falls back to the default frontend cookie when redirect_uri origin is not allowed', async () => {
    vi.mocked(buildAuthorizeUrl).mockReturnValue('https://cognito.example.com/oauth2/authorize');

    const app = new OpenAPIHono();
    registerLoginRoute(app);

    const res = await app.request('/auth/login?redirect_uri=https://evil.example.com');

    expect(
      res.headers
        .getSetCookie()
        .some((c) => c.startsWith('oauth_redirect=http%3A%2F%2Flocalhost%3A3000'))
    ).toBe(true);
  });
});
