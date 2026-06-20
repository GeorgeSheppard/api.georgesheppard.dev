import { OpenAPIHono } from '@hono/zod-openapi';
import { cors } from 'hono/cors';
import { config } from '@config/index.js';
import { registerLoginRoute } from './routes/login.js';
import { registerCallbackRoute } from './routes/callback.js';
import { registerSessionRoute } from './routes/session.js';
import { registerLogoutRoute } from './routes/logout.js';

export function registerAuthRoutes(app: OpenAPIHono) {
  app.use(
    '/auth/*',
    cors({
      origin: [config.FRONTEND_URL_DEV, config.FRONTEND_URL_PROD],
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
