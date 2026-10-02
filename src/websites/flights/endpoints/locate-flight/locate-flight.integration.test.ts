import { describe, it, expect } from 'vitest';
import { createTestApp } from '@test/utils/app.js';
import { createMockOpenSkyClient } from '@test/mocks/opensky-client.js';
import { createMockFlightAwareClient } from '@test/mocks/flightaware-client.js';
import { RateLimitedError } from '@core/utils/rate-limited-error.js';

const stateVector = (icao24: string, callsign: string) => [
  icao24,
  callsign,
  'France',
  1700000000,
  1700000000,
  1.5,
  50.2,
  10000,
  false,
  230,
  320,
  0,
  null,
  10100,
  null,
  false,
  0,
];

const rawFlight = (overrides: Record<string, unknown>) => ({
  fa_flight_id: 'AFR1681-1790753880-airline-559p',
  ident: 'AFR1681',
  atc_ident: null,
  inbound_fa_flight_id: null,
  operator: 'AFR',
  aircraft_type: 'BCS3',
  registration: null,
  origin: { code: 'EGLL', code_iata: 'LHR', name: 'London Heathrow', city: 'London' },
  destination: {
    code: 'LFPG',
    code_iata: 'CDG',
    name: 'Charles de Gaulle/Roissy',
    city: 'Paris',
  },
  status: 'Scheduled',
  scheduled_out: '2026-10-02T07:55:00Z',
  estimated_out: '2026-10-02T07:55:00Z',
  actual_out: null,
  scheduled_in: '2026-10-02T09:15:00Z',
  estimated_in: '2026-10-02T09:11:00Z',
  actual_in: null,
  ...overrides,
});

const expectedAircraft = (icao24: string, callsign: string) => ({
  icao24,
  callsign,
  latitude: 50.2,
  longitude: 1.5,
  onGround: false,
  altitudeMeters: 10000,
  velocityMetersPerSecond: 230,
  headingDegrees: 320,
  verticalRateMetersPerSecond: 0,
});

const states = {
  '/states/all': {
    time: 1700000000,
    states: [stateVector('400abc', 'AFR1681 '), stateVector('39e68b', 'AFR1680 ')],
  },
};

describe('GET /flights/locate', () => {
  it('returns the aircraft operating a flight in the air', async () => {
    const { openSkyClient } = createMockOpenSkyClient(states);
    const { flightAwareClient } = createMockFlightAwareClient({
      '/flights/AFR1681-1790753880-airline-559p': {
        flights: [rawFlight({ actual_out: '2026-10-02T07:58:00Z', status: 'En Route' })],
      },
    });
    const app = await createTestApp({ openSkyClient, flightAwareClient });

    const response = await app.request(
      'http://localhost/flights/locate?faFlightId=AFR1681-1790753880-airline-559p'
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      aircraft: expectedAircraft('400abc', 'AFR1681'),
      inboundFlight: null,
      lastKnownPosition: null,
      watchCallsigns: [],
    });
  });

  it('returns the aircraft flying in to operate a flight that has not departed', async () => {
    const { openSkyClient } = createMockOpenSkyClient(states);
    const { flightAwareClient } = createMockFlightAwareClient({
      '/flights/AFR1681-1790753880-airline-559p': {
        flights: [rawFlight({ inbound_fa_flight_id: 'AFR1680-1790753880-airline-123p' })],
      },
      '/flights/AFR1680-1790753880-airline-123p': {
        flights: [
          rawFlight({
            fa_flight_id: 'AFR1680-1790753880-airline-123p',
            ident: 'AFR1680',
            registration: 'F-HPNP',
            status: 'En Route / On Time',
            actual_out: '2026-10-02T05:34:00Z',
          }),
        ],
      },
    });
    const app = await createTestApp({ openSkyClient, flightAwareClient });

    const response = await app.request(
      'http://localhost/flights/locate?faFlightId=AFR1681-1790753880-airline-559p'
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      aircraft: expectedAircraft('39e68b', 'AFR1680'),
      inboundFlight: {
        faFlightId: 'AFR1680-1790753880-airline-123p',
        ident: 'AFR1680',
        registration: 'F-HPNP',
      },
    });
  });

  it('returns no aircraft when the flight has not departed and its aircraft is unknown', async () => {
    const { openSkyClient, get } = createMockOpenSkyClient(states);
    const { flightAwareClient } = createMockFlightAwareClient({
      '/flights/AFR1681-1790753880-airline-559p': { flights: [rawFlight({})] },
    });
    const app = await createTestApp({ openSkyClient, flightAwareClient });

    const response = await app.request(
      'http://localhost/flights/locate?faFlightId=AFR1681-1790753880-airline-559p'
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      aircraft: null,
      inboundFlight: null,
      lastKnownPosition: null,
      watchCallsigns: [],
    });
    expect(get).not.toHaveBeenCalled();
  });

  it('returns where the inbound aircraft was last seen when its transponder is off', async () => {
    const { openSkyClient } = createMockOpenSkyClient({
      '/states/all': { time: 1700000000, states: [stateVector('400abc', 'EZY45   ')] },
    });
    const { flightAwareClient } = createMockFlightAwareClient({
      '/flights/AFR1681-1790753880-airline-559p': {
        flights: [rawFlight({ inbound_fa_flight_id: 'AFR1680-1790753880-airline-123p' })],
      },
      '/flights/AFR1680-1790753880-airline-123p': {
        flights: [
          rawFlight({
            fa_flight_id: 'AFR1680-1790753880-airline-123p',
            ident: 'AFR1680',
            status: 'Arrived / Gate Arrival',
            actual_out: '2026-10-02T05:34:00Z',
            actual_in: '2026-10-02T06:46:00Z',
          }),
        ],
      },
      '/flights/AFR1680-1790753880-airline-123p/position': {
        fa_flight_id: 'AFR1680-1790753880-airline-123p',
        last_position: {
          fa_flight_id: 'AFR1680-1790753880-airline-123p',
          altitude: 0,
          altitude_change: '-',
          groundspeed: 0,
          heading: 270,
          latitude: 51.47,
          longitude: -0.45,
          timestamp: '2026-10-02T06:50:00Z',
          update_type: 'A',
        },
      },
    });
    const app = await createTestApp({ openSkyClient, flightAwareClient });

    const response = await app.request(
      'http://localhost/flights/locate?faFlightId=AFR1681-1790753880-airline-559p'
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      aircraft: null,
      inboundFlight: { ident: 'AFR1680', actualIn: '2026-10-02T06:46:00Z' },
      lastKnownPosition: {
        latitude: 51.47,
        longitude: -0.45,
        headingDegrees: 270,
        seenAt: '2026-10-02T06:50:00Z',
      },
      watchCallsigns: ['AFR1680', 'AFR1681'],
    });
  });

  it('returns 429 with a retry time when OpenSky is out of credits', async () => {
    const { openSkyClient, get } = createMockOpenSkyClient();
    get.mockRejectedValue(new RateLimitedError('OpenSky rate limit reached', 3600));
    const { flightAwareClient } = createMockFlightAwareClient({
      '/flights/AFR1681-1790753880-airline-559p': {
        flights: [rawFlight({ actual_out: '2026-10-02T07:58:00Z' })],
      },
    });
    const app = await createTestApp({ openSkyClient, flightAwareClient });

    const response = await app.request(
      'http://localhost/flights/locate?faFlightId=AFR1681-1790753880-airline-559p'
    );

    expect(response.status).toBe(429);
    expect(response.headers.get('Retry-After')).toBe('3600');
    expect(await response.json()).toEqual({
      error: 'OpenSky rate limit reached',
      retryAfterSeconds: 3600,
    });
  });

  it('returns 400 when faFlightId is missing', async () => {
    const { flightAwareClient } = createMockFlightAwareClient();
    const app = await createTestApp({ flightAwareClient });

    const response = await app.request('http://localhost/flights/locate');

    expect(response.status).toBe(400);
  });

  it('returns 501 when FlightAware is not configured', async () => {
    const { flightAwareClient } = createMockFlightAwareClient({}, { configured: false });
    const app = await createTestApp({ flightAwareClient });

    const response = await app.request(
      'http://localhost/flights/locate?faFlightId=AFR1681-1790753880-airline-559p'
    );

    expect(response.status).toBe(501);
  });
});
