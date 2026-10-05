import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { AdminEnv } from '@core/types/context.js';

vi.mock('@core/utils/cloudflare-access.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@core/utils/cloudflare-access.js')>()),
  getAccessConfig: vi.fn(),
  verifyAccessJwt: vi.fn(),
}));
import {
  AccessDeniedError,
  getAccessConfig,
  verifyAccessJwt,
} from '@core/utils/cloudflare-access.js';
import { adminAuthMiddleware, ADMIN_ACCESS_JWT_HEADER } from './admin-auth.js';

const accessConfig = {
  teamDomain: 'https://team.cloudflareaccess.com',
  audience: 'admin-aud',
  allowedEmails: ['admin@example.com'],
};

function createApp() {
  const app = new Hono<AdminEnv>();
  app.get('/admin/test', adminAuthMiddleware, (c) => c.json({ email: c.get('adminEmail') }));
  return app;
}

describe('adminAuthMiddleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getAccessConfig).mockReturnValue(accessConfig);
  });

  it('responds 404 when the admin portal is not configured', async () => {
    vi.mocked(getAccessConfig).mockReturnValue(null);

    const res = await createApp().request('/admin/test', {
      headers: { [ADMIN_ACCESS_JWT_HEADER]: 'token' },
    });

    expect(res.status).toBe(404);
    expect(verifyAccessJwt).not.toHaveBeenCalled();
  });

  it('responds 401 without a token', async () => {
    const res = await createApp().request('/admin/test');

    expect(res.status).toBe(401);
    expect(verifyAccessJwt).not.toHaveBeenCalled();
  });

  it('responds 401 when the token fails verification', async () => {
    vi.mocked(verifyAccessJwt).mockRejectedValue(new Error('signature verification failed'));

    const res = await createApp().request('/admin/test', {
      headers: { [ADMIN_ACCESS_JWT_HEADER]: 'bad-token' },
    });

    expect(res.status).toBe(401);
  });

  it('responds 403 when the email is not allowed', async () => {
    vi.mocked(verifyAccessJwt).mockRejectedValue(new AccessDeniedError('not allowed'));

    const res = await createApp().request('/admin/test', {
      headers: { [ADMIN_ACCESS_JWT_HEADER]: 'token' },
    });

    expect(res.status).toBe(403);
  });

  it('passes through with the admin email when the token is valid', async () => {
    vi.mocked(verifyAccessJwt).mockResolvedValue('admin@example.com');

    const res = await createApp().request('/admin/test', {
      headers: { [ADMIN_ACCESS_JWT_HEADER]: 'good-token' },
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ email: 'admin@example.com' });
    expect(verifyAccessJwt).toHaveBeenCalledWith('good-token', accessConfig);
  });

  it('accepts the token Cloudflare Access injects directly', async () => {
    vi.mocked(verifyAccessJwt).mockResolvedValue('admin@example.com');

    const res = await createApp().request('/admin/test', {
      headers: { 'cf-access-jwt-assertion': 'cf-token' },
    });

    expect(res.status).toBe(200);
    expect(verifyAccessJwt).toHaveBeenCalledWith('cf-token', accessConfig);
  });
});
