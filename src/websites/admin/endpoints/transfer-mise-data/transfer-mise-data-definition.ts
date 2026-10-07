import { createRoute } from '@hono/zod-openapi';
import {
  AdminErrorSchema,
  adminHeadersSchema,
  adminRouteConfig,
  unauthorizedResponse,
} from '../../schemas.js';
import {
  TransferMiseDataRequestSchema,
  TransferMiseDataResponseSchema,
} from './transfer-mise-data.js';

export const transferMiseDataRoute = createRoute({
  method: 'post',
  path: '/admin/mise/transfer',
  ...adminRouteConfig,
  description: 'Copy recipes, their images and optionally the meal plan from one user to another',
  request: {
    headers: adminHeadersSchema,
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
    404: {
      content: { 'application/json': { schema: AdminErrorSchema } },
      description: 'Selected recipes not found for the source user',
    },
    ...unauthorizedResponse,
  },
});
