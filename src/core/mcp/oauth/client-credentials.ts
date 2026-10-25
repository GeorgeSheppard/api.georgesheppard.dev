import { SignJWT, jwtVerify, EncryptJWT, jwtDecrypt } from 'jose';
import { createHash } from 'node:crypto';
import { config } from '@config/index.js';

const signingSecret = new TextEncoder().encode(config.JWT_SECRET);
const encryptionKey = createHash('sha256').update(`${config.JWT_SECRET}:mcp-oauth`).digest();

/**
 * The client_id we hand back from DCR is a self-describing signed token
 * carrying the real Cognito client id and the redirect URIs the MCP client
 * registered. This means we never need to persist registered clients
 * ourselves - Cognito is the only store, and the client_id is the lookup key.
 */
export interface McpClientId {
  cognitoClientId: string;
  redirectUris: string[];
}

export async function encodeClientId(data: McpClientId): Promise<string> {
  return new SignJWT({ cid: data.cognitoClientId, ru: data.redirectUris })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .sign(signingSecret);
}

export async function decodeClientId(token: string): Promise<McpClientId> {
  const { payload } = await jwtVerify(token, signingSecret);
  return {
    cognitoClientId: payload.cid as string,
    redirectUris: payload.ru as string[],
  };
}

const AUTH_CODE_TTL_SECONDS = 60;

/**
 * Our own short-lived authorization code, issued at /mcp/callback once we've
 * completed the Cognito leg, and redeemed at /mcp/token. Carries the
 * authenticated user and the PKCE challenge so we never need server-side
 * storage for in-flight authorization requests.
 */
export interface McpAuthCode {
  userId: string;
  clientId: string;
  codeChallenge: string;
}

export async function encodeAuthCode(data: McpAuthCode): Promise<string> {
  return new EncryptJWT({ sub: data.userId, cid: data.clientId, cc: data.codeChallenge })
    .setProtectedHeader({ alg: 'dir', enc: 'A256GCM' })
    .setIssuedAt()
    .setExpirationTime(`${AUTH_CODE_TTL_SECONDS}s`)
    .encrypt(encryptionKey);
}

export async function decodeAuthCode(token: string): Promise<McpAuthCode> {
  const { payload } = await jwtDecrypt(token, encryptionKey);
  return {
    userId: payload.sub as string,
    clientId: payload.cid as string,
    codeChallenge: payload.cc as string,
  };
}

const AUTHORIZE_REQUEST_TTL_SECONDS = 600;

/**
 * Holds the in-flight /mcp/authorize request (state, PKCE challenge, the MCP
 * client's real redirect_uri) in an encrypted cookie while the user
 * completes login on Cognito's hosted UI.
 */
export interface McpAuthorizeRequest {
  clientId: string;
  redirectUri: string;
  state: string;
  nonce: string;
  codeChallenge: string;
}

export async function encodeAuthorizeRequest(data: McpAuthorizeRequest): Promise<string> {
  return new EncryptJWT({ ...data })
    .setProtectedHeader({ alg: 'dir', enc: 'A256GCM' })
    .setIssuedAt()
    .setExpirationTime(`${AUTHORIZE_REQUEST_TTL_SECONDS}s`)
    .encrypt(encryptionKey);
}

export async function decodeAuthorizeRequest(token: string): Promise<McpAuthorizeRequest> {
  const { payload } = await jwtDecrypt(token, encryptionKey);
  return payload as unknown as McpAuthorizeRequest;
}
