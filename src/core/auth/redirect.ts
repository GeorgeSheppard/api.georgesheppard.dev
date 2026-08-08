export const ALLOWED_FRONTEND_URLS = [
  'http://localhost:3000',
  'http://localhost:5173',
  'https://mise.georgesheppard.dev',
  'https://shelfie.georgesheppard.dev',
  'https://platform.georgesheppard.dev',
];

const allowedOrigins = new Set(ALLOWED_FRONTEND_URLS.map((url) => new URL(url).origin));

// Cloudflare preview deployments, e.g. https://<branch-slug>-mise.georgesheppard98.workers.dev
const PREVIEW_ORIGIN_PATTERN = /^https:\/\/[a-z0-9-]+\.georgesheppard98\.workers\.dev$/;

const defaultRedirectUri = ALLOWED_FRONTEND_URLS[0];

export function isAllowedOrigin(origin: string): boolean {
  return allowedOrigins.has(origin) || PREVIEW_ORIGIN_PATTERN.test(origin);
}

/**
 * Returns `requested` if its origin is in the configured frontend allowlist,
 * otherwise falls back to a default. This lets any allowed frontend (e.g. a
 * local dev branch or Cloudflare preview URL) drive the redirect, instead of
 * switching on NODE_ENV.
 */
export function resolveRedirectUri(requested?: string): string {
  if (!requested) {
    return defaultRedirectUri;
  }

  try {
    if (isAllowedOrigin(new URL(requested).origin)) {
      return requested;
    }
  } catch {
    // invalid URL, fall through to default
  }

  return defaultRedirectUri;
}
