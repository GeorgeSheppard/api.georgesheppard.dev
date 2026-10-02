import { describe, it, expect, vi, beforeEach } from 'vitest';
import { locateFlight } from './locate-flight.js';
import { createMockContext } from '@test/utils/mock-context.js';
import type { Context } from 'hono';
import type { OpenSkyState } from '../../utils/opensky-api.js';
import type { FlightAwareFlight, FlightAwareFlightWithLinks } from '../../utils/flightaware-api.js';

vi.mock('../../utils/opensky-api.js');
vi.mock('../../utils/flightaware-api.js');

import { getAllStates } from '../../utils/opensky-api.js';
import { getFlightById, getLastPosition } from '../../utils/flightaware-api.js';

function mockContext({ configured = true }: { configured?: boolean } = {}) {
  return createMockContext<Context>({
    openSkyClient: { getClient: () => ({}) },
    flightAwareClient: { getClient: () => ({}), isConfigured: () => configured },
  });
}

const baseFlight: FlightAwareFlight = {
  faFlightId: 'AFR1681-1790753880-airline-559p',
  ident: 'AFR1681',
  operator: 'AFR',
  aircraftType: 'BCS3',
  registration: null,
  origin: { code: 'EGLL', iataCode: 'LHR', name: 'London Heathrow', city: 'London' },
  destination: { code: 'LFPG', iataCode: 'CDG', name: 'Charles de Gaulle/Roissy', city: 'Paris' },
  status: 'Scheduled',
  scheduledOut: '2026-10-02T07:55:00Z',
  estimatedOut: '2026-10-02T07:55:00Z',
  actualOut: null,
  scheduledIn: '2026-10-02T09:15:00Z',
  estimatedIn: '2026-10-02T09:11:00Z',
  actualIn: null,
};

const inboundFlight: FlightAwareFlight = {
  ...baseFlight,
  faFlightId: 'AFR1680-1790753880-airline-123p',
  ident: 'AFR1680',
  registration: 'F-HPNP',
  origin: baseFlight.destination,
  destination: baseFlight.origin,
  status: 'En Route / On Time',
  scheduledOut: '2026-10-02T05:30:00Z',
  actualOut: '2026-10-02T05:34:00Z',
};

const withLinks = (
  flight: FlightAwareFlight,
  links: Partial<Omit<FlightAwareFlightWithLinks, 'flight'>> = {}
): FlightAwareFlightWithLinks => ({ flight, atcIdent: null, inboundFaFlightId: null, ...links });

const state = (icao24: string, callsign: string, onGround = false): OpenSkyState => ({
  icao24,
  callsign,
  originCountry: 'France',
  longitude: 1.5,
  latitude: 50.2,
  baroAltitudeMeters: 10000,
  onGround,
  velocityMetersPerSecond: 230,
  trueTrackDegrees: 320,
  verticalRateMetersPerSecond: 0,
  geoAltitudeMeters: 10100,
});

const notFound = {
  aircraft: null,
  inboundFlight: null,
  lastKnownPosition: null,
  watchCallsigns: [],
};

const found = (icao24: string, callsign: string, inbound: FlightAwareFlight | null = null) => ({
  aircraft: aircraft(icao24, callsign),
  inboundFlight: inbound,
  lastKnownPosition: null,
  watchCallsigns: [],
});

const aircraft = (icao24: string, callsign: string) => ({
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

function mockFlights(...flights: FlightAwareFlightWithLinks[]) {
  vi.mocked(getFlightById).mockImplementation(
    async (_client, id) => flights.find(({ flight }) => flight.faFlightId === id) ?? null
  );
}

describe('locateFlight handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should find a departed flight by its own callsign', async () => {
    mockFlights(withLinks({ ...baseFlight, actualOut: '2026-10-02T07:58:00Z' }));
    vi.mocked(getAllStates).mockResolvedValue([state('39e68b', 'AFR1681')]);

    const result = await locateFlight(mockContext(), { faFlightId: baseFlight.faFlightId });

    expect(result).toEqual({ status: 200, body: found('39e68b', 'AFR1681') });
  });

  it('should match the ATC callsign when it differs from the flight number', async () => {
    mockFlights(
      withLinks({ ...baseFlight, actualOut: '2026-10-02T07:58:00Z' }, { atcIdent: 'AFR22KP' })
    );
    vi.mocked(getAllStates).mockResolvedValue([state('39e68b', 'AFR22KP')]);

    const result = await locateFlight(mockContext(), { faFlightId: baseFlight.faFlightId });

    expect(result.body).toEqual(found('39e68b', 'AFR22KP'));
  });

  it('should prefer an airborne aircraft over one on the ground', async () => {
    mockFlights(withLinks({ ...baseFlight, actualOut: '2026-10-02T07:58:00Z' }));
    vi.mocked(getAllStates).mockResolvedValue([
      state('400abc', 'AFR1681', true),
      state('39e68b', 'AFR1681'),
    ]);

    const result = await locateFlight(mockContext(), { faFlightId: baseFlight.faFlightId });

    expect(result.body).toMatchObject({ aircraft: { icao24: '39e68b' } });
  });

  it('should find the aircraft flying in to operate a flight that has not departed', async () => {
    mockFlights(
      withLinks(baseFlight, { inboundFaFlightId: inboundFlight.faFlightId }),
      withLinks(inboundFlight)
    );
    vi.mocked(getAllStates).mockResolvedValue([
      state('400abc', 'AFR1681'),
      state('39e68b', 'AFR1680'),
    ]);

    const result = await locateFlight(mockContext(), { faFlightId: baseFlight.faFlightId });

    expect(result).toEqual({ status: 200, body: found('39e68b', 'AFR1680', inboundFlight) });
  });

  it('should not match its own callsign before departure, since that may be an earlier flight', async () => {
    mockFlights(withLinks(baseFlight));
    vi.mocked(getAllStates).mockResolvedValue([state('400abc', 'AFR1681')]);

    const result = await locateFlight(mockContext(), { faFlightId: baseFlight.faFlightId });

    expect(result.body).toEqual(notFound);
    expect(getAllStates).not.toHaveBeenCalled();
  });

  it('should return where the inbound aircraft was last seen when it is not live', async () => {
    mockFlights(
      withLinks(baseFlight, { inboundFaFlightId: inboundFlight.faFlightId }),
      withLinks({ ...inboundFlight, actualIn: '2026-10-02T06:46:00Z' })
    );
    vi.mocked(getAllStates).mockResolvedValue([state('400abc', 'EZY45')]);
    vi.mocked(getLastPosition).mockResolvedValue({
      latitude: 51.47,
      longitude: -0.45,
      headingDegrees: 270,
      timestamp: '2026-10-02T06:50:00Z',
    });

    const result = await locateFlight(mockContext(), { faFlightId: baseFlight.faFlightId });

    expect(getLastPosition).toHaveBeenCalledWith(expect.anything(), inboundFlight.faFlightId);
    expect(result.body).toEqual({
      aircraft: null,
      inboundFlight: { ...inboundFlight, actualIn: '2026-10-02T06:46:00Z' },
      lastKnownPosition: {
        latitude: 51.47,
        longitude: -0.45,
        headingDegrees: 270,
        seenAt: '2026-10-02T06:50:00Z',
      },
      watchCallsigns: ['AFR1680', 'AFR1681'],
    });
  });

  it('should still say what to watch for when the last position cannot be looked up', async () => {
    mockFlights(withLinks({ ...baseFlight, actualOut: '2026-10-02T07:58:00Z' }));
    vi.mocked(getAllStates).mockResolvedValue([]);
    vi.mocked(getLastPosition).mockRejectedValue(new Error('timeout'));

    const result = await locateFlight(mockContext(), { faFlightId: baseFlight.faFlightId });

    expect(result.body).toEqual({ ...notFound, watchCallsigns: ['AFR1681'] });
  });

  it('should return no aircraft when the flight is unknown', async () => {
    mockFlights();

    const result = await locateFlight(mockContext(), { faFlightId: 'unknown' });

    expect(result.body).toEqual(notFound);
  });

  it('should return 501 when FlightAware is not configured', async () => {
    const result = await locateFlight(mockContext({ configured: false }), {
      faFlightId: baseFlight.faFlightId,
    });

    expect(result.status).toBe(501);
    expect(getFlightById).not.toHaveBeenCalled();
  });
});
