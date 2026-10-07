import { OpenAPIHono } from '@hono/zod-openapi';
import { transferMiseData } from './endpoints/transfer-mise-data/transfer-mise-data.js';
import { transferMiseDataRoute } from './endpoints/transfer-mise-data/transfer-mise-data-definition.js';

export function registerRoutes(app: OpenAPIHono) {
  app.openapi(transferMiseDataRoute, async (c) => {
    const request = c.req.valid('json');
    const result = await transferMiseData(c, request);
    switch (result.status) {
      case 200:
        return c.json(result.body, 200);
      case 400:
        return c.json(result.body, 400);
      case 404:
        return c.json(result.body, 404);
    }
  });
}
