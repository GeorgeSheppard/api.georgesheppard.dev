import { jwtVerify, createRemoteJWKSet, JWTPayload, decodeProtectedHeader } from 'jose';
import { config } from '@config/index.js';

export interface CognitoJwtPayload extends JWTPayload {
  sub: string;
  token_use?: string;
  client_id?: string;
  aud?: string | string[];
}

const jwksUrl = `https://cognito-idp.${config.COGNITO_REGION}.amazonaws.com/${config.COGNITO_USER_POOL_ID}/.well-known/jwks.json`;
const jwks = config.COGNITO_USER_POOL_ID ? createRemoteJWKSet(new URL(jwksUrl)) : null;

export async function verifyCognitoJwt(token: string): Promise<CognitoJwtPayload> {
  if (!jwks) {
    throw new Error('Cognito JWKS not initialized');
  }

  // Debug: log the token header and JWKS URL
  try {
    const header = decodeProtectedHeader(token);
    console.log('Token header:', header);
    console.log('JWKS URL:', jwksUrl);
  } catch (e) {
    console.log('Failed to decode token header:', e);
  }

  const issuer = `https://cognito-idp.${config.COGNITO_REGION}.amazonaws.com/${config.COGNITO_USER_POOL_ID}`;

  const verified = await jwtVerify(token, jwks, {
    issuer,
  });

  const payload = verified.payload as unknown as CognitoJwtPayload;

  // Validate token_use claim - should be 'access' or 'id'
  if (!payload.token_use || !['access', 'id'].includes(payload.token_use)) {
    throw new Error('Invalid token_use claim');
  }

  // For ID tokens, verify aud matches client ID
  // For access tokens, verify client_id matches
  if (payload.token_use === 'id') {
    const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
    if (!aud.includes(config.COGNITO_CLIENT_ID)) {
      throw new Error(`Invalid aud claim. Expected ${config.COGNITO_CLIENT_ID}, got ${aud}`);
    }
  } else if (payload.token_use === 'access') {
    if (payload.client_id !== config.COGNITO_CLIENT_ID) {
      throw new Error(
        `Invalid client_id claim. Expected ${config.COGNITO_CLIENT_ID}, got ${payload.client_id}`
      );
    }
  }

  return payload;
}

export function extractUserIdFromCognitoToken(payload: CognitoJwtPayload): string {
  return payload.sub;
}
