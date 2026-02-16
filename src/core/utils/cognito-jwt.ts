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
