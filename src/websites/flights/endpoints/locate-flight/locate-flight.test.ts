import { describe, it, expect, vi, beforeEach } from 'vitest';
import { locateFlight } from './locate-flight.js';
import { createMockContext } from '@test/utils/mock-context.js';
import type { Context } from 'hono';
import type { OpenSkyState } from '../../utils/opensky-api.js';

vi.mock('../../utils/opensky-api.js');

import { getAllStates } from '../../utils/opensky-api.js';

function mockContext() {
  return createMockContext<Context>({
    openSkyClient: { getClient: () => ({}) },
  });
}

const baseState: OpenSkyState = {
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

describe('locateFlight handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return the aircraft broadcasting the callsign', async () => {
    vi.mocked(getAllStates).mockResolvedValue([
      { ...baseState, icao24: '400abc', callsign: 'EZY45' },
      baseState,
    ]);

    const result = await locateFlight(mockContext(), { callsign: 'baw 123' });

    expect(result).toEqual({
      aircraft: {
        icao24: '4ca7b3',
        callsign: 'BAW123',
        latitude: 51.5,
        longitude: 0.1,
        onGround: false,
        altitudeMeters: 10000,
        velocityMetersPerSecond: 230,
        headingDegrees: 90,
        verticalRateMetersPerSecond: 0,
      },
    });
  });

  it('should prefer an airborne aircraft over one on the ground', async () => {
    vi.mocked(getAllStates).mockResolvedValue([
      { ...baseState, icao24: '400abc', onGround: true },
      baseState,
    ]);

    const result = await locateFlight(mockContext(), { callsign: 'BAW123' });

    expect(result.aircraft?.icao24).toBe('4ca7b3');
  });

  it('should ignore aircraft without a position', async () => {
    vi.mocked(getAllStates).mockResolvedValue([{ ...baseState, latitude: null, longitude: null }]);

    const result = await locateFlight(mockContext(), { callsign: 'BAW123' });

    expect(result).toEqual({ aircraft: null });
  });

  it('should return null when no aircraft is broadcasting the callsign', async () => {
    vi.mocked(getAllStates).mockResolvedValue([baseState]);

    const result = await locateFlight(mockContext(), { callsign: 'EZY45' });

    expect(result).toEqual({ aircraft: null });
  });
});
