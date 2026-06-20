import { describe, it, expect, vi } from 'vitest';

vi.mock('@core/utils/cognito-oauth.js');
import { buildLogoutUrl } from '@core/utils/cognito-oauth.js';
import { logout } from './logout.js';

describe('logout handler', () => {
  it('returns success and the cognito logout url, using the default frontend when no redirect_uri given', () => {
    vi.mocked(buildLogoutUrl).mockReturnValue('https://cognito.example.com/logout');

    const result = logout();

    expect(result).toEqual({
      success: true,
      cognitoLogoutUrl: 'https://cognito.example.com/logout',
    });
    expect(buildLogoutUrl).toHaveBeenCalledWith('http://localhost:3000');
  });

  it('uses the requested redirect_uri when its origin is allowed', () => {
    vi.mocked(buildLogoutUrl).mockReturnValue('https://cognito.example.com/logout');

    logout('https://my-life-nu.vercel.app/signed-out');

    expect(buildLogoutUrl).toHaveBeenCalledWith('https://my-life-nu.vercel.app/signed-out');
  });

  it('falls back to the default frontend when redirect_uri origin is not allowed', () => {
    vi.mocked(buildLogoutUrl).mockReturnValue('https://cognito.example.com/logout');

    logout('https://evil.example.com');

    expect(buildLogoutUrl).toHaveBeenCalledWith('http://localhost:3000');
  });
});
