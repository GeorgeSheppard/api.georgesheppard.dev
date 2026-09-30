import { describe, it, expect, vi, beforeEach } from 'vitest';
import { flightDetails } from './flight-details.js';
import { createMockContext } from '@test/utils/mock-context.js';
import type { Context } from 'hono';
import type { OpenSkyState } from '../../utils/opensky-api.js';
import type { FlightAwareFlight } from '../../utils/flightaware-api.js';

vi.mock('../../utils/opensky-api.js');
vi.mock('../../utils/flightaware-api.js');
vi.mock('../../utils/airline-names.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../utils/airline-names.js')>()),
  getAirlineName: vi.fn(),
}));

import { getStateByIcao24 } from '../../utils/opensky-api.js';
import { searchFlightsByIdent } from '../../utils/flightaware-api.js';
import { getAirlineName } from '../../utils/airline-names.js';

function mockContext({ configured = true }: { configured?: boolean } = {}) {
  return createMockContext<Context>({
    openSkyClient: { getClient: () => ({}) },
    flightAwareClient: { getClient: () => ({}), isConfigured: () => configured },
  });
}

const state: OpenSkyState = {
  icao24: '4ca7b3',
  callsign: 'BAW123',
  originCountry: 'United Kingdom',
  longitude: 0.1,
  latitude: 51.5,
  baroAltitudeMeters: 10000,
  onGround: false,
  velocityMetersPerSecond: 230,
  trueTrackDegrees: 90,
  verticalRateMetersPerSecond: 0,
  geoAltitudeMeters: 10100,
};

const inProgressFlight: FlightAwareFlight = {
  faFlightId: 'BAW123-1700000000-airline-0001',
  ident: 'BAW123',
  operator: 'BAW',
  aircraftType: 'A320',
  registration: 'G-EUUA',
  origin: { code: 'EGLL', iataCode: 'LHR', name: 'London Heathrow', city: 'London' },
  destination: { code: 'LFPG', iataCode: 'CDG', name: 'Paris Charles de Gaulle', city: 'Paris' },
  status: 'En Route',
  scheduledOut: '2026-09-26T09:00:00Z',
  estimatedOut: '2026-09-26T09:05:00Z',
  actualOut: '2026-09-26T09:05:00Z',
  scheduledIn: '2026-09-26T10:15:00Z',
  estimatedIn: '2026-09-26T10:20:00Z',
  actualIn: null,
};

const landedFlight: FlightAwareFlight = {
  ...inProgressFlight,
  faFlightId: 'BAW123-1699900000-airline-0001',
  actualOut: '2026-09-25T09:05:00Z',
  actualIn: '2026-09-25T10:20:00Z',
};

describe('flightDetails handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getAirlineName).mockResolvedValue('British Airways');
  });

  it('should merge live position with the in-progress flight route', async () => {
    vi.mocked(getStateByIcao24).mockResolvedValue(state);
    vi.mocked(searchFlightsByIdent).mockResolvedValue([landedFlight, inProgressFlight]);

    const result = await flightDetails(mockContext(), { icao24: '4ca7b3' });

    expect(result).toEqual({
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
    });
  });

  it('should look up the callsign reported by OpenSky when none is provided', async () => {
    vi.mocked(getStateByIcao24).mockResolvedValue(state);
    vi.mocked(searchFlightsByIdent).mockResolvedValue([]);

    await flightDetails(mockContext(), { icao24: '4ca7b3' });

    expect(searchFlightsByIdent).toHaveBeenCalledWith(expect.anything(), 'BAW123');
  });

  it('should prefer the explicitly given callsign over the one from OpenSky', async () => {
    vi.mocked(getStateByIcao24).mockResolvedValue(state);
    vi.mocked(searchFlightsByIdent).mockResolvedValue([]);

    await flightDetails(mockContext(), { icao24: '4ca7b3', callsign: 'BAW456' });

    expect(searchFlightsByIdent).toHaveBeenCalledWith(expect.anything(), 'BAW456');
  });

  it('should return a null position when the aircraft is no longer visible to OpenSky', async () => {
    vi.mocked(getStateByIcao24).mockResolvedValue(null);
    vi.mocked(searchFlightsByIdent).mockResolvedValue([]);

    const result = await flightDetails(mockContext(), { icao24: '4ca7b3', callsign: 'BAW123' });

    expect(result.position).toBeNull();
  });

  it('should return a null route when no matching flight is found', async () => {
    vi.mocked(getStateByIcao24).mockResolvedValue(state);
    vi.mocked(searchFlightsByIdent).mockResolvedValue([]);

    const result = await flightDetails(mockContext(), { icao24: '4ca7b3' });

    expect(result.route).toBeNull();
  });

  it('should not call FlightAware when no callsign is available from either source', async () => {
    vi.mocked(getStateByIcao24).mockResolvedValue({ ...state, callsign: null });

    const result = await flightDetails(mockContext(), { icao24: '4ca7b3' });

    expect(searchFlightsByIdent).not.toHaveBeenCalled();
    expect(result.route).toBeNull();
  });

  it('should still return the live position, with a null route, when FlightAware is not configured', async () => {
    vi.mocked(getStateByIcao24).mockResolvedValue(state);

    const result = await flightDetails(mockContext({ configured: false }), { icao24: '4ca7b3' });

    expect(searchFlightsByIdent).not.toHaveBeenCalled();
    expect(result.position).not.toBeNull();
    expect(result.route).toBeNull();
  });

  it('should use the matched flight operator as the airline code', async () => {
    vi.mocked(getStateByIcao24).mockResolvedValue(state);
    vi.mocked(searchFlightsByIdent).mockResolvedValue([{ ...inProgressFlight, operator: 'SHT' }]);

    const result = await flightDetails(mockContext(), { icao24: '4ca7b3' });

    expect(getAirlineName).toHaveBeenCalledWith(expect.anything(), 'SHT');
    expect(result.airline?.code).toBe('SHT');
  });

  it('should derive the airline from the callsign when no flight is matched', async () => {
    vi.mocked(getStateByIcao24).mockResolvedValue(state);
    vi.mocked(searchFlightsByIdent).mockResolvedValue([]);

    const result = await flightDetails(mockContext(), { icao24: '4ca7b3' });

    expect(result.airline).toEqual({ code: 'BAW', name: 'British Airways' });
  });

  it('should still return the position and airline when the FlightAware flight lookup fails', async () => {
    vi.mocked(getStateByIcao24).mockResolvedValue(state);
    vi.mocked(searchFlightsByIdent).mockRejectedValue(
      new Error('Request failed with status code 400')
    );

    const result = await flightDetails(mockContext(), { icao24: '4ca7b3' });

    expect(result.position).not.toBeNull();
    expect(result.route).toBeNull();
    expect(result.airline).toEqual({ code: 'BAW', name: 'British Airways' });
  });

  it('should return the airline code without a name when FlightAware is not configured', async () => {
    vi.mocked(getStateByIcao24).mockResolvedValue(state);

    const result = await flightDetails(mockContext({ configured: false }), { icao24: '4ca7b3' });

    expect(getAirlineName).not.toHaveBeenCalled();
    expect(result.airline).toEqual({ code: 'BAW', name: null });
  });

  it('should return a null airline for non-airline callsigns', async () => {
    vi.mocked(getStateByIcao24).mockResolvedValue({ ...state, callsign: 'GABCD' });
    vi.mocked(searchFlightsByIdent).mockResolvedValue([]);

    const result = await flightDetails(mockContext(), { icao24: '4ca7b3' });

    expect(getAirlineName).not.toHaveBeenCalled();
    expect(result.airline).toBeNull();
  });
});
