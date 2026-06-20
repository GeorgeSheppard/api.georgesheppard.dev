import { describe, it, expect, vi } from 'vitest';

vi.mock('@core/utils/cognito-oauth.js');
import { buildLogoutUrl } from '@core/utils/cognito-oauth.js';
import { logout } from './logout.js';

describe('logout handler', () => {
  it('returns success and the cognito logout url', () => {
    vi.mocked(buildLogoutUrl).mockReturnValue('https://cognito.example.com/logout');

    const result = logout();

    expect(result).toEqual({
      success: true,
      cognitoLogoutUrl: 'https://cognito.example.com/logout',
    });
  });
});
