import { createRemoteJWKSet, jwtVerify, JWTVerifyGetKey } from 'jose';
import { config } from '@config/index.js';

export interface AccessConfig {
  teamDomain: string;
  audience: string;
  allowedEmails: string[];
}

export function parseAllowedEmails(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter((email) => email.length > 0);
}

// Returns null unless every setting is present, so the admin routes fail closed when misconfigured
export function getAccessConfig(): AccessConfig | null {
  const allowedEmails = parseAllowedEmails(config.ADMIN_EMAILS);
  if (!config.CF_ACCESS_TEAM_DOMAIN || !config.CF_ACCESS_ADMIN_AUD || allowedEmails.length === 0) {
    return null;
  }

  return {
    teamDomain: config.CF_ACCESS_TEAM_DOMAIN.replace(/\/+$/, ''),
    audience: config.CF_ACCESS_ADMIN_AUD,
    allowedEmails,
  };
}

const jwksByTeamDomain = new Map<string, JWTVerifyGetKey>();

function remoteJwks(teamDomain: string): JWTVerifyGetKey {
  let jwks = jwksByTeamDomain.get(teamDomain);
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(`${teamDomain}/cdn-cgi/access/certs`));
    jwksByTeamDomain.set(teamDomain, jwks);
  }
  return jwks;
}

export class AccessDeniedError extends Error {}

/**
 * Verifies a Cloudflare Access application token and returns the authenticated email.
 * Throws if the signature, issuer, audience or expiry are invalid, or the email isn't allowed.
 */
export async function verifyAccessJwt(
  token: string,
  accessConfig: AccessConfig,
  getKey: JWTVerifyGetKey = remoteJwks(accessConfig.teamDomain)
): Promise<string> {
  const { payload } = await jwtVerify(token, getKey, {
    issuer: accessConfig.teamDomain,
    audience: accessConfig.audience,
    algorithms: ['RS256'],
  });

  // Service tokens carry no email, and org-level tokens aren't scoped to this application
  if (payload.type !== 'app' || typeof payload.email !== 'string') {
    throw new AccessDeniedError('Access token is not a user application token');
  }

  const email = payload.email.toLowerCase();
  if (!accessConfig.allowedEmails.includes(email)) {
    throw new AccessDeniedError(`${email} is not an allowed admin`);
  }

  return email;
}
