import { Context } from 'hono';
import { z } from 'zod';
import { signJwt } from '@core/utils/jwt.js';

export const AuthTokenResponseSchema = z.object({
  token: z.string().describe('JWT token'),
  userId: z.string().uuid().describe('User ID'),
});

export type AuthTokenResponse = z.infer<typeof AuthTokenResponseSchema>;

export async function authToken(c: Context, userId: string): Promise<AuthTokenResponse> {
  const token = await signJwt(userId);

  return {
    token,
    userId,
  };
}
