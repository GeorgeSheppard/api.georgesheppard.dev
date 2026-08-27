import { jwtVerify, createRemoteJWKSet, JWTPayload } from 'jose';
import { config } from '@config/index.js';

export interface CognitoJwtPayload extends JWTPayload {
  sub: string;
  token_use?: string;
  client_id?: string;
  aud?: string | string[];
}

const cognitoUrl = `https://cognito-idp.${config.COGNITO_REGION}.amazonaws.com/${config.COGNITO_USER_POOL_ID}`;
const jwksUrl = `${cognitoUrl}/.well-known/jwks.json`;
const jwks = createRemoteJWKSet(new URL(jwksUrl));

export async function verifyCognitoJwt(token: string): Promise<CognitoJwtPayload> {
  const verified = await jwtVerify(token, jwks, {
    issuer: cognitoUrl,
  });

  const payload = verified.payload as unknown as CognitoJwtPayload;
  return payload;
}

export interface CognitoIdTokenPayload extends CognitoJwtPayload {
  email: string;
  nonce?: string;
}

export async function verifyCognitoIdTokenForClient(
  token: string,
  audience: string
): Promise<CognitoIdTokenPayload> {
  const verified = await jwtVerify(token, jwks, {
    issuer: cognitoUrl,
    audience,
  });

  return verified.payload as unknown as CognitoIdTokenPayload;
}

export async function verifyCognitoIdToken(token: string): Promise<CognitoIdTokenPayload> {
  return verifyCognitoIdTokenForClient(token, config.COGNITO_CLIENT_ID);
}
