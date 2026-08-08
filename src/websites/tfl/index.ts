import { OpenAPIHono } from '@hono/zod-openapi';
import { searchStations } from './endpoints/search-stations/search-stations.js';
import { searchStationsRoute } from './endpoints/search-stations/search-stations-definition.js';
import { getArrivals } from './endpoints/get-arrivals/get-arrivals.js';
import { getArrivalsRoute } from './endpoints/get-arrivals/get-arrivals-definition.js';
import { getBranches } from './endpoints/get-branches/get-branches.js';
import { getBranchesRoute } from './endpoints/get-branches/get-branches-definition.js';

export function registerRoutes(app: OpenAPIHono) {
  app.openapi(searchStationsRoute, async (c) => {
    const query = c.req.valid('query');
    const result = await searchStations(c, query);
    return c.json(result, 200);
  });

  app.openapi(getArrivalsRoute, async (c) => {
    const query = c.req.valid('query');
    const result = await getArrivals(c, query);
    return c.json(result, 200);
  });

  app.openapi(getBranchesRoute, async (c) => {
    const query = c.req.valid('query');
    const result = await getBranches(c, query);
    return c.json(result, 200);
  });
}
