export const ALLOWED_FRONTEND_URLS = [
  'http://localhost:3000',
  'https://my-life-nu.vercel.app',
  'https://kitchencalm.georgesheppard.dev',
];

const allowedOrigins = new Set(ALLOWED_FRONTEND_URLS.map((url) => new URL(url).origin));

const defaultRedirectUri = ALLOWED_FRONTEND_URLS[0];

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
