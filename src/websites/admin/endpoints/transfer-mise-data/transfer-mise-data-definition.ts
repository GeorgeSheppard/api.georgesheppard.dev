import { createRoute } from '@hono/zod-openapi';
import { adminAuthMiddleware } from '@core/middleware/admin-auth.js';
import { AdminErrorSchema, adminErrorResponses } from '../../schemas.js';
import {
  TransferMiseDataRequestSchema,
  TransferMiseDataResponseSchema,
} from './transfer-mise-data.js';

export const transferMiseDataRoute = createRoute({
  method: 'post',
  path: '/admin/mise/transfer',
  tags: ['admin'],
  description: 'Copy recipes, their images and optionally the meal plan from one user to another',
  middleware: [adminAuthMiddleware],
  request: {
    body: {
      content: { 'application/json': { schema: TransferMiseDataRequestSchema } },
      required: true,
    },
  },
  responses: {
    200: {
      content: { 'application/json': { schema: TransferMiseDataResponseSchema } },
      description: 'Data copied successfully',
    },
    400: {
      content: { 'application/json': { schema: AdminErrorSchema } },
      description: 'Invalid transfer request',
    },
    ...adminErrorResponses,
  },
});
