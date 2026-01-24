import { Context, Next } from 'hono';
import { CognitoJwtVerifier } from 'aws-jwt-verify';
import { config } from '@config/index.js';

export interface CognitoUser {
  userId: string; // from token.sub
  username: string; // from token.username
}

// Create verifier instance (reuse across requests)
let verifier: ReturnType<typeof CognitoJwtVerifier.create> | null = null;

function getVerifier() {
  if (!verifier) {
    verifier = CognitoJwtVerifier.create({
      userPoolId: config.COGNITO_USER_POOL_ID,
      tokenUse: 'access',
      clientId: null, // Accept tokens from any client
    });
  }
  return verifier;
}

export async function cognitoAuthMiddleware(c: Context, next: Next) {
  const authHeader = c.req.header('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Missing or invalid authorization header' }, 401);
  }

  const token = authHeader.substring(7);

  try {
    const verif = getVerifier();
    const payload = await verif.verify(token) as Record<string, unknown>;

    // Extract user information from token
    const user: CognitoUser = {
      userId: String(payload.sub), // This is the UserId for DynamoDB
      username: String(payload.username || payload.sub),
    };

    c.set('cognitoUser', user);
    await next();
  } catch (error) {
    console.error('JWT verification error:', error);
    return c.json({ error: 'Invalid or expired token' }, 401);
  }
}

// Optional middleware for endpoints that can work with or without auth
export async function optionalCognitoAuthMiddleware(c: Context, next: Next) {
  const authHeader = c.req.header('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    c.set('cognitoUser', null);
    await next();
    return;
  }

  const token = authHeader.substring(7);

  try {
    const verif = getVerifier();
    const payload = await verif.verify(token) as Record<string, unknown>;
    const user: CognitoUser = {
      userId: String(payload.sub),
      username: String(payload.username || payload.sub),
    };
    c.set('cognitoUser', user);
  } catch (error) {
    console.error('JWT verification error:', error);
    c.set('cognitoUser', null);
  }

  await next();
}
