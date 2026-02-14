import { jwtVerify, createRemoteJWKSet } from 'jose';
import { config } from '@config/index.js';

export interface CognitoJwtPayload {
  sub: string;
  email?: string;
  'cognito:username'?: string;
  [key: string]: unknown;
}

const jwksUrl = `https://cognito-idp.${config.COGNITO_REGION}.amazonaws.com/${config.COGNITO_USER_POOL_ID}/.well-known/jwks.json`;
const jwks = config.COGNITO_USER_POOL_ID ? createRemoteJWKSet(new URL(jwksUrl)) : null;

export async function verifyCognitoJwt(token: string): Promise<CognitoJwtPayload> {
  if (!jwks || !config.COGNITO_USER_POOL_ID) {
    throw new Error('Cognito configuration not available');
  }

  const verified = await jwtVerify(token, jwks, {
    issuer: `https://cognito-idp.${config.COGNITO_REGION}.amazonaws.com/${config.COGNITO_USER_POOL_ID}`,
    audience: config.COGNITO_CLIENT_ID,
  });

  return verified.payload as unknown as CognitoJwtPayload;
}

export function extractUserIdFromCognitoToken(payload: CognitoJwtPayload): string {
  // Try different claim names in order of preference
  if (payload['cognito:username']) {
    return payload['cognito:username'] as string;
  }
  if (payload.email) {
    return payload.email as string;
  }
  if (payload.sub) {
    return payload.sub;
  }
  throw new Error('Could not extract userId from Cognito token');
}
