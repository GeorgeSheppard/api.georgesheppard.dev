import { OpenAPIHono } from '@hono/zod-openapi';
import { cors } from 'hono/cors';
import { ALLOWED_FRONTEND_URLS } from './redirect.js';
import { registerLoginRoute } from './routes/login.js';
import { registerCallbackRoute } from './routes/callback.js';
import { registerSessionRoute } from './routes/session.js';
import { registerLogoutRoute } from './routes/logout.js';

export function registerAuthRoutes(app: OpenAPIHono) {
  app.use(
    '/auth/*',
    cors({
      origin: ALLOWED_FRONTEND_URLS,
      credentials: true,
      allowMethods: ['GET', 'POST'],
      allowHeaders: ['Content-Type'],
    })
  );

  registerLoginRoute(app);
  registerCallbackRoute(app);
  registerSessionRoute(app);
  registerLogoutRoute(app);
}
