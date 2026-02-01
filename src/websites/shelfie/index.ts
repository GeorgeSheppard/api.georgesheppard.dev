import { OpenAPIHono } from '@hono/zod-openapi';
import { registerGetByIdRoute } from './routes/recommendations/get-by-id.js';
import { registerAddEmailRoute } from './routes/recommendations/add-email.js';
import { registerDeleteEmailRoute } from './routes/recommendations/delete-email.js';
import { registerFromBookcaseRoute } from './routes/recommendations/from-bookcase.js';
import { registerQueueCronRoute } from './routes/queue-cron.js';

export function registerShelfieRoutes(app: OpenAPIHono) {
  registerGetByIdRoute(app);
  registerAddEmailRoute(app);
  registerDeleteEmailRoute(app);
  registerFromBookcaseRoute(app);
  registerQueueCronRoute(app);
}
