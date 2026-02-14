import { describe, it, expect, vi, beforeEach } from 'vitest';
import { authToken } from './auth-token.js';

vi.mock('@core/utils/jwt.js');
import { signJwt } from '@core/utils/jwt.js';

const validUserId = '550e8400-e29b-41d4-a716-446655440000';

describe('authToken handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return token and userId', async () => {
    vi.mocked(signJwt).mockResolvedValue('mock-jwt-token');

    const result = await authToken(validUserId);

    expect(result).toEqual({ token: 'mock-jwt-token', userId: validUserId });
  });

  it('should pass userId to signJwt', async () => {
    vi.mocked(signJwt).mockResolvedValue('token');

    await authToken(validUserId);

    expect(signJwt).toHaveBeenCalledWith(validUserId);
  });

  it('should handle different user IDs', async () => {
    const anotherUserId = '550e8400-e29b-41d4-a716-446655440001';
    vi.mocked(signJwt).mockResolvedValue('another-token');

    const result = await authToken(anotherUserId);

    expect(result).toEqual({ token: 'another-token', userId: anotherUserId });
    expect(signJwt).toHaveBeenCalledWith(anotherUserId);
  });

  it('should throw when JWT signing fails', async () => {
    vi.mocked(signJwt).mockRejectedValue(new Error('JWT signing failed'));

    await expect(authToken(validUserId)).rejects.toThrow('JWT signing failed');
  });
});
