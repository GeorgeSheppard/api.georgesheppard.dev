import { describe, it, expect } from 'vitest';
import { createTestApp } from '@test/utils/app.js';
import { createMockFlightAwareClient } from '@test/mocks/flightaware-client.js';
import { RateLimitedError } from '@core/utils/rate-limited-error.js';

describe('GET /flights/search', () => {
  it('returns flights matching the given flight number', async () => {
    const { flightAwareClient } = createMockFlightAwareClient({
      '/flights/BA123': {
        flights: [
          {
            fa_flight_id: 'BAW123-1700000000-airline-0001',
            ident: 'BAW123',
            operator: 'British Airways',
            aircraft_type: 'A320',
            registration: 'G-EUUA',
            origin: { code: 'EGLL', code_iata: 'LHR', name: 'London Heathrow', city: 'London' },
            destination: {
              code: 'LFPG',
              code_iata: 'CDG',
              name: 'Paris Charles de Gaulle',
              city: 'Paris',
            },
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
    });
    const app = await createTestApp({ flightAwareClient });

    const response = await app.request('http://localhost/flights/search?flightNumber=BA123');

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      flights: [
        {
          faFlightId: 'BAW123-1700000000-airline-0001',
          ident: 'BAW123',
          operator: 'British Airways',
          aircraftType: 'A320',
          registration: 'G-EUUA',
          origin: { code: 'EGLL', iataCode: 'LHR', name: 'London Heathrow', city: 'London' },
          destination: {
            code: 'LFPG',
            iataCode: 'CDG',
            name: 'Paris Charles de Gaulle',
            city: 'Paris',
          },
          status: 'En Route',
          scheduledOut: '2026-09-26T09:00:00Z',
          estimatedOut: '2026-09-26T09:05:00Z',
          actualOut: '2026-09-26T09:05:00Z',
          scheduledIn: '2026-09-26T10:15:00Z',
          estimatedIn: '2026-09-26T10:20:00Z',
          actualIn: null,
        },
      ],
    });
  });

  it('returns 429 with a retry time when the FlightAware rate limit is reached', async () => {
    const { flightAwareClient, get } = createMockFlightAwareClient();
    get.mockRejectedValue(new RateLimitedError('FlightAware rate limit reached', 42));
    const app = await createTestApp({ flightAwareClient });

    const response = await app.request('http://localhost/flights/search?flightNumber=BA123');

    expect(response.status).toBe(429);
    expect(await response.json()).toEqual({
      error: 'FlightAware rate limit reached',
      retryAfterSeconds: 42,
    });
  });

  it('returns 400 when flightNumber is missing', async () => {
    const { flightAwareClient } = createMockFlightAwareClient();
    const app = await createTestApp({ flightAwareClient });

    const response = await app.request('http://localhost/flights/search');

    expect(response.status).toBe(400);
  });

  it('returns 501 when FlightAware is not configured', async () => {
    const { flightAwareClient } = createMockFlightAwareClient({}, { configured: false });
    const app = await createTestApp({ flightAwareClient });

    const response = await app.request('http://localhost/flights/search?flightNumber=BA123');

    expect(response.status).toBe(501);
  });
});
