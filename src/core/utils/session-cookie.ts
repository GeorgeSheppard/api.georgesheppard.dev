import { EncryptJWT, jwtDecrypt } from 'jose';
import { createHash } from 'node:crypto';
import { config } from '@config/index.js';

export interface SessionData {
  userId: string;
  email: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

const sessionKey = createHash('sha256').update(config.SESSION_SECRET).digest();

export async function encryptSession(data: SessionData): Promise<string> {
  return new EncryptJWT({ ...data })
    .setProtectedHeader({ alg: 'dir', enc: 'A256GCM' })
    .setIssuedAt()
    .encrypt(sessionKey);
}

export async function decryptSession(token: string): Promise<SessionData> {
  const { payload } = await jwtDecrypt(token, sessionKey);
  return payload as unknown as SessionData;
}
