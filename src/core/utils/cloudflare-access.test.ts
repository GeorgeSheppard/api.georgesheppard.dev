import { describe, it, expect, beforeAll } from 'vitest';
import { createLocalJWKSet, exportJWK, generateKeyPair, JWTVerifyGetKey, SignJWT } from 'jose';
import {
  AccessConfig,
  AccessDeniedError,
  getAccessConfig,
  parseAllowedEmails,
  verifyAccessJwt,
} from './cloudflare-access.js';

const accessConfig: AccessConfig = {
  teamDomain: 'https://team.cloudflareaccess.com',
  audience: 'admin-aud',
  allowedEmails: ['admin@example.com'],
};

type PrivateKey = Awaited<ReturnType<typeof generateKeyPair>>['privateKey'];

let privateKey: PrivateKey;
let otherPrivateKey: PrivateKey;
let getKey: JWTVerifyGetKey;

beforeAll(async () => {
  const keyPair = await generateKeyPair('RS256');
  privateKey = keyPair.privateKey;
  otherPrivateKey = (await generateKeyPair('RS256')).privateKey;
  const jwk = { ...(await exportJWK(keyPair.publicKey)), kid: 'test-key', alg: 'RS256' };
  getKey = createLocalJWKSet({ keys: [jwk] });
});

function signToken(
  claims: Record<string, unknown> = {},
  options: { key?: PrivateKey; issuer?: string; audience?: string; expiresIn?: string } = {}
) {
  return new SignJWT({ type: 'app', email: 'admin@example.com', ...claims })
    .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
    .setIssuer(options.issuer ?? accessConfig.teamDomain)
    .setAudience(options.audience ?? accessConfig.audience)
    .setIssuedAt()
    .setExpirationTime(options.expiresIn ?? '5m')
    .sign(options.key ?? privateKey);
}

describe('verifyAccessJwt', () => {
  it('returns the email for a valid admin token', async () => {
    const token = await signToken();

    await expect(verifyAccessJwt(token, accessConfig, getKey)).resolves.toBe('admin@example.com');
  });

  it('matches allowed emails case-insensitively', async () => {
    const token = await signToken({ email: 'Admin@Example.com' });

    await expect(verifyAccessJwt(token, accessConfig, getKey)).resolves.toBe('admin@example.com');
  });

  it('rejects a token signed by a different key', async () => {
    const token = await signToken({}, { key: otherPrivateKey });

    await expect(verifyAccessJwt(token, accessConfig, getKey)).rejects.toThrow();
  });

  it('rejects a token for a different Access application', async () => {
    const token = await signToken({}, { audience: 'another-app' });

    await expect(verifyAccessJwt(token, accessConfig, getKey)).rejects.toThrow();
  });

  it('rejects a token from a different team', async () => {
    const token = await signToken({}, { issuer: 'https://evil.cloudflareaccess.com' });

    await expect(verifyAccessJwt(token, accessConfig, getKey)).rejects.toThrow();
  });

  it('rejects an expired token', async () => {
    const token = await signToken({}, { expiresIn: '-1m' });

    await expect(verifyAccessJwt(token, accessConfig, getKey)).rejects.toThrow();
  });

  it('rejects an unsigned token', async () => {
    const [, payload] = (await signToken()).split('.');
    const header = Buffer.from(JSON.stringify({ alg: 'none' })).toString('base64url');

    await expect(verifyAccessJwt(`${header}.${payload}.`, accessConfig, getKey)).rejects.toThrow();
  });

  it('rejects an email that is not allowed', async () => {
    const token = await signToken({ email: 'someone@example.com' });

    await expect(verifyAccessJwt(token, accessConfig, getKey)).rejects.toThrow(AccessDeniedError);
  });

  it('rejects service tokens without an email', async () => {
    const token = await signToken({ email: undefined });

    await expect(verifyAccessJwt(token, accessConfig, getKey)).rejects.toThrow(AccessDeniedError);
  });

  it('rejects org-level tokens', async () => {
    const token = await signToken({ type: 'org' });

    await expect(verifyAccessJwt(token, accessConfig, getKey)).rejects.toThrow(AccessDeniedError);
  });
});

describe('parseAllowedEmails', () => {
  it('splits, trims, lowercases and drops empty entries', () => {
    expect(parseAllowedEmails(' A@example.com, ,b@example.com ')).toEqual([
      'a@example.com',
      'b@example.com',
    ]);
  });

  it('returns an empty list when unset', () => {
    expect(parseAllowedEmails(undefined)).toEqual([]);
  });
});

describe('getAccessConfig', () => {
  it('reads the configuration from the environment', () => {
    expect(getAccessConfig()).toEqual({
      teamDomain: 'https://test-team.cloudflareaccess.com',
      audience: 'test-admin-aud',
      allowedEmails: ['admin@example.com'],
    });
  });
});
