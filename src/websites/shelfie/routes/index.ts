import { OpenAPIHono } from '@hono/zod-openapi';
import { registerGetByIdRoute } from './recommendations/get-by-id.js';
import { registerAddEmailRoute } from './recommendations/add-email.js';
import { registerDeleteEmailRoute } from './recommendations/delete-email.js';
import { registerFromBookcaseRoute } from './recommendations/from-bookcase.js';
import { registerQueueCronRoute } from './queue-cron.js';

export function registerShelfieRoutes(app: OpenAPIHono) {
  registerGetByIdRoute(app);
  registerAddEmailRoute(app);
  registerDeleteEmailRoute(app);
  registerFromBookcaseRoute(app);
  registerQueueCronRoute(app);
}
