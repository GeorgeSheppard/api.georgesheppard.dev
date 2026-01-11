import { MiddlewareHandler } from 'hono';

export const securityHeaders = (): MiddlewareHandler => {
  return async (c, next) => {
    await next();

    // Helmet-equivalent security headers
    c.header('X-Content-Type-Options', 'nosniff');
    c.header('X-Frame-Options', 'DENY');
    c.header('X-XSS-Protection', '1; mode=block');
    c.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    c.header('Referrer-Policy', 'no-referrer');
  };
};
