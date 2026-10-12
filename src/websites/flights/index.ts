import { OpenAPIHono } from '@hono/zod-openapi';
import { searchArea } from './endpoints/search-area/search-area.js';
import { searchAreaRoute } from './endpoints/search-area/search-area-definition.js';
import { searchFlight } from './endpoints/search-flight/search-flight.js';
import { searchFlightRoute } from './endpoints/search-flight/search-flight-definition.js';
import { flightDetails } from './endpoints/flight-details/flight-details.js';
import { flightDetailsRoute } from './endpoints/flight-details/flight-details-definition.js';
import { aircraftPhoto } from './endpoints/aircraft-photo/aircraft-photo.js';
import { aircraftPhotoRoute } from './endpoints/aircraft-photo/aircraft-photo-definition.js';
import { locateFlight } from './endpoints/locate-flight/locate-flight.js';
import { locateFlightRoute } from './endpoints/locate-flight/locate-flight-definition.js';

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

  app.openapi(aircraftPhotoRoute, async (c) => {
    const query = c.req.valid('query');
    const result = await aircraftPhoto(c, query);
    return c.json(result, 200);
  });

  app.openapi(locateFlightRoute, async (c) => {
    const query = c.req.valid('query');
    const result = await locateFlight(c, query);
    switch (result.status) {
      case 200:
        return c.json(result.body, 200);
      case 501:
        return c.json(result.body, 501);
    }
  });
}
