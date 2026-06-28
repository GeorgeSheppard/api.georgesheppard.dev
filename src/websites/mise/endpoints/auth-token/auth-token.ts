import { z } from 'zod';
import { signJwt } from '@core/utils/jwt.js';

export const AuthTokenResponseSchema = z.object({
  token: z.string().describe('JWT token for MCP authentication'),
  userId: z.string().describe('User ID'),
});

export type AuthTokenResponse = z.infer<typeof AuthTokenResponseSchema>;

export async function authToken(userId: string): Promise<AuthTokenResponse> {
  const token = await signJwt(userId);

  return {
    token,
    userId,
  };
}
