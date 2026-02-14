import { jwtVerify, createRemoteJWKSet, JWTPayload } from 'jose';
import { config } from '@config/index.js';

export interface CognitoJwtPayload extends JWTPayload {
  sub: string;
}

const jwksUrl = `https://cognito-idp.${config.COGNITO_REGION}.amazonaws.com/${config.COGNITO_USER_POOL_ID}/.well-known/jwks.json`;
const jwks = config.COGNITO_USER_POOL_ID ? createRemoteJWKSet(new URL(jwksUrl)) : null;

export async function verifyCognitoJwt(token: string): Promise<CognitoJwtPayload> {
  if (!jwks) {
    throw new Error('Cognito JWKS not initialized');
  }

  const verified = await jwtVerify(token, jwks, {
    issuer: `https://cognito-idp.${config.COGNITO_REGION}.amazonaws.com/${config.COGNITO_USER_POOL_ID}`,
    audience: config.COGNITO_CLIENT_ID,
  });

  return verified.payload as unknown as CognitoJwtPayload;
}

export function extractUserIdFromCognitoToken(payload: CognitoJwtPayload): string {
  return payload.sub;
}
