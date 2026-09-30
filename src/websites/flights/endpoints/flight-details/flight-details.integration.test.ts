import { describe, it, expect, beforeEach } from 'vitest';
import { createTestApp } from '@test/utils/app.js';
import { createMockOpenSkyClient } from '@test/mocks/opensky-client.js';
import { createMockFlightAwareClient } from '@test/mocks/flightaware-client.js';
import type { FlightDetailsResponse } from './flight-details.js';
import { clearAirlineNameCache } from '../../utils/airline-names.js';

describe('GET /flights/details', () => {
  beforeEach(() => {
    clearAirlineNameCache();
  });

  it('returns merged position and route details for the aircraft', async () => {
    const { openSkyClient } = createMockOpenSkyClient({
      '/states/all': {
        time: 1700000000,
        states: [
          [
            '4ca7b3',
            'BAW123  ',
            'United Kingdom',
            1700000000,
            1700000000,
            0.1,
            51.5,
            10000,
            false,
            230,
            90,
            0,
            null,
            10100,
            null,
            false,
            0,
          ],
        ],
      },
    });
    const { flightAwareClient } = createMockFlightAwareClient({
      '/flights/BAW123': {
        flights: [
          {
            fa_flight_id: 'BAW123-1700000000-airline-0001',
            ident: 'BAW123',
            operator: 'BAW',
            aircraft_type: 'A320',
            registration: 'G-EUUA',
            origin: { code: 'EGLL', name: 'London Heathrow', city: 'London' },
            destination: { code: 'LFPG', name: 'Paris Charles de Gaulle', city: 'Paris' },
            status: 'En Route',
            scheduled_out: '2026-09-26T09:00:00Z',
            estimated_out: '2026-09-26T09:05:00Z',
            actual_out: '2026-09-26T09:05:00Z',
            scheduled_in: '2026-09-26T10:15:00Z',
            estimated_in: '2026-09-26T10:20:00Z',
            actual_in: null,
          },
        ],
      },
      '/operators/BAW': { name: 'British Airways', shortname: 'British Airways' },
    });
    const app = await createTestApp({ openSkyClient, flightAwareClient });

    const response = await app.request('http://localhost/flights/details?icao24=4ca7b3');

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      icao24: '4ca7b3',
      callsign: 'BAW123',
      airline: { code: 'BAW', name: 'British Airways' },
      position: {
        latitude: 51.5,
        longitude: 0.1,
        onGround: false,
        altitudeMeters: 10000,
        velocityMetersPerSecond: 230,
        headingDegrees: 90,
        verticalRateMetersPerSecond: 0,
      },
      route: {
        faFlightId: 'BAW123-1700000000-airline-0001',
        operator: 'BAW',
        aircraftType: 'A320',
        registration: 'G-EUUA',
        origin: { code: 'EGLL', name: 'London Heathrow', city: 'London' },
        destination: { code: 'LFPG', name: 'Paris Charles de Gaulle', city: 'Paris' },
        status: 'En Route',
        scheduledOut: '2026-09-26T09:00:00Z',
        estimatedOut: '2026-09-26T09:05:00Z',
        actualOut: '2026-09-26T09:05:00Z',
        scheduledIn: '2026-09-26T10:15:00Z',
        estimatedIn: '2026-09-26T10:20:00Z',
        actualIn: null,
      },
    });
  });

  it('returns 400 when icao24 is missing', async () => {
    const { openSkyClient } = createMockOpenSkyClient();
    const { flightAwareClient } = createMockFlightAwareClient();
    const app = await createTestApp({ openSkyClient, flightAwareClient });

    const response = await app.request('http://localhost/flights/details');

    expect(response.status).toBe(400);
  });

  it('returns a null route when the aircraft has no known callsign', async () => {
    const { openSkyClient } = createMockOpenSkyClient({
      '/states/all': { time: 1700000000, states: [] },
    });
    const { flightAwareClient } = createMockFlightAwareClient();
    const app = await createTestApp({ openSkyClient, flightAwareClient });

    const response = await app.request('http://localhost/flights/details?icao24=4ca7b3');

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      icao24: '4ca7b3',
      callsign: null,
      airline: null,
      position: null,
      route: null,
    });
  });

  it('still returns the live position, with a null route, when FlightAware is not configured', async () => {
    const { openSkyClient } = createMockOpenSkyClient({
      '/states/all': {
        time: 1700000000,
        states: [
          [
            '4ca7b3',
            'BAW123  ',
            'United Kingdom',
            1700000000,
            1700000000,
            0.1,
            51.5,
            10000,
            false,
            230,
            90,
            0,
            null,
            10100,
            null,
            false,
            0,
          ],
        ],
      },
    });
    const { flightAwareClient } = createMockFlightAwareClient({}, { configured: false });
    const app = await createTestApp({ openSkyClient, flightAwareClient });

    const response = await app.request('http://localhost/flights/details?icao24=4ca7b3');

    expect(response.status).toBe(200);
    const body = (await response.json()) as FlightDetailsResponse;
    expect(body.position).not.toBeNull();
    expect(body.route).toBeNull();
  });
});
