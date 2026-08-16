import { OpenAPIHono } from '@hono/zod-openapi';
import { listStations } from './endpoints/list-stations/list-stations.js';
import { listStationsRoute } from './endpoints/list-stations/list-stations-definition.js';
import { getArrivals } from './endpoints/get-arrivals/get-arrivals.js';
import { getArrivalsRoute } from './endpoints/get-arrivals/get-arrivals-definition.js';

export function registerRoutes(app: OpenAPIHono) {
  app.openapi(listStationsRoute, async (c) => {
    const result = await listStations(c);
    return c.json(result, 200);
  });

  app.openapi(getArrivalsRoute, async (c) => {
    const query = c.req.valid('query');
    const result = await getArrivals(c, query);
    return c.json(result, 200);
  });
}
