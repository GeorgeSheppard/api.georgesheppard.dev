import { OpenAPIHono } from '@hono/zod-openapi';
import { AdminContext } from '@core/types/context.js';
import { listMiseUsers } from './endpoints/list-mise-users/list-mise-users.js';
import { listMiseUsersRoute } from './endpoints/list-mise-users/list-mise-users-definition.js';
import { getMiseUser } from './endpoints/get-mise-user/get-mise-user.js';
import { getMiseUserRoute } from './endpoints/get-mise-user/get-mise-user-definition.js';
import { transferMiseData } from './endpoints/transfer-mise-data/transfer-mise-data.js';
import { transferMiseDataRoute } from './endpoints/transfer-mise-data/transfer-mise-data-definition.js';

export function registerRoutes(app: OpenAPIHono) {
  app.openapi(listMiseUsersRoute, async (c) => {
    const result = await listMiseUsers(c as unknown as AdminContext);
    return c.json(result, 200);
  });

  app.openapi(getMiseUserRoute, async (c) => {
    const { userId } = c.req.valid('param');
    const result = await getMiseUser(c as unknown as AdminContext, userId);
    return c.json(result, 200);
  });

  app.openapi(transferMiseDataRoute, async (c) => {
    const request = c.req.valid('json');
    const result = await transferMiseData(c as unknown as AdminContext, request);
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
