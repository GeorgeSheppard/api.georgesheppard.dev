import { OpenAPIHono } from '@hono/zod-openapi';
import { searchArea } from './endpoints/search-area/search-area.js';
import { searchAreaRoute } from './endpoints/search-area/search-area-definition.js';
import { searchFlight } from './endpoints/search-flight/search-flight.js';
import { searchFlightRoute } from './endpoints/search-flight/search-flight-definition.js';
import { flightDetails } from './endpoints/flight-details/flight-details.js';
import { flightDetailsRoute } from './endpoints/flight-details/flight-details-definition.js';

export function registerRoutes(app: OpenAPIHono) {
  app.openapi(searchAreaRoute, async (c) => {
    const query = c.req.valid('query');
    const result = await searchArea(c, query);
    return c.json(result, 200);
  });

  app.openapi(searchFlightRoute, async (c) => {
    const query = c.req.valid('query');
    const result = await searchFlight(c, query);
    switch (result.status) {
      case 200:
        return c.json(result.body, 200);
      case 501:
        return c.json(result.body, 501);
    }
  });

  app.openapi(flightDetailsRoute, async (c) => {
    const query = c.req.valid('query');
    const result = await flightDetails(c, query);
    return c.json(result, 200);
  });
}
