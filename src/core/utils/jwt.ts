import { SignJWT, jwtVerify, JWTPayload } from 'jose';
import { config } from '@config/index.js';

export interface JwtPayload extends JWTPayload {
  userId: string;
}

const secret = new TextEncoder().encode(config.JWT_SECRET);

export async function signJwt(userId: string): Promise<string> {
  const token = await new SignJWT({ userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .sign(secret);

  return token;
}

export async function verifyJwt(token: string): Promise<JwtPayload> {
  const verified = await jwtVerify(token, secret);
  const payload = verified.payload as unknown;
  return payload as JwtPayload;
}
