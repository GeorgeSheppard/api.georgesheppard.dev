import { config } from '@config/index.js';

export interface CognitoTokens {
  access_token: string;
  id_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
}

function tokenEndpoint(): string {
  return `${config.COGNITO_DOMAIN}/oauth2/token`;
}

export function buildAuthorizeUrlForClient(params: {
  clientId: string;
  state: string;
  nonce: string;
  redirectUri: string;
}): string {
  const url = new URL(`${config.COGNITO_DOMAIN}/oauth2/authorize`);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', params.clientId);
  url.searchParams.set('redirect_uri', params.redirectUri);
  url.searchParams.set('state', params.state);
  url.searchParams.set('nonce', params.nonce);
  url.searchParams.set('scope', 'openid email profile');
  return url.toString();
}

export function buildAuthorizeUrl(params: {
  state: string;
  nonce: string;
  redirectUri: string;
}): string {
  return buildAuthorizeUrlForClient({ ...params, clientId: config.COGNITO_CLIENT_ID });
}

export async function exchangeCodeForTokensForClient(params: {
  clientId: string;
  clientSecret?: string;
  code: string;
  redirectUri: string;
}): Promise<CognitoTokens> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: params.clientId,
    code: params.code,
    redirect_uri: params.redirectUri,
  });
  if (params.clientSecret) {
    body.set('client_secret', params.clientSecret);
  }

  const response = await fetch(tokenEndpoint(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!response.ok) {
    throw new Error(`Cognito token exchange failed: ${response.status}`);
  }

  return (await response.json()) as CognitoTokens;
}

export async function exchangeCodeForTokens(
  code: string,
  redirectUri: string
): Promise<CognitoTokens> {
  return exchangeCodeForTokensForClient({
    clientId: config.COGNITO_CLIENT_ID,
    clientSecret: config.COGNITO_CLIENT_SECRET,
    code,
    redirectUri,
  });
}

export async function refreshTokens(refreshToken: string): Promise<CognitoTokens> {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: config.COGNITO_CLIENT_ID,
    client_secret: config.COGNITO_CLIENT_SECRET,
    refresh_token: refreshToken,
  });

  const response = await fetch(tokenEndpoint(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!response.ok) {
    throw new Error(`Cognito token refresh failed: ${response.status}`);
  }

  return (await response.json()) as CognitoTokens;
}

export function buildLogoutUrl(logoutUri: string): string {
  const url = new URL(`${config.COGNITO_DOMAIN}/logout`);
  url.searchParams.set('client_id', config.COGNITO_CLIENT_ID);
  url.searchParams.set('logout_uri', logoutUri);
  return url.toString();
}
