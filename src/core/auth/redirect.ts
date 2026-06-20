import { config } from '@config/index.js';

const allowedOrigins = new Set(
  [config.FRONTEND_URL_DEV, config.FRONTEND_URL_PROD].map((url) => new URL(url).origin)
);

const defaultRedirectUri = config.FRONTEND_URL_DEV;

/**
 * Returns `requested` if its origin is in the configured frontend allowlist,
 * otherwise falls back to a default. This lets any allowed frontend (e.g. a
 * local dev branch) drive the redirect, instead of switching on NODE_ENV.
 */
export function resolveRedirectUri(requested?: string): string {
  if (!requested) {
    return defaultRedirectUri;
  }

  try {
    if (allowedOrigins.has(new URL(requested).origin)) {
      return requested;
    }
  } catch {
    // invalid URL, fall through to default
  }

  return defaultRedirectUri;
}
