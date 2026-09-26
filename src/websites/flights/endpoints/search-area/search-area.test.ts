import { describe, it, expect, vi, beforeEach } from 'vitest';
import { searchArea } from './search-area.js';
import { createMockContext } from '@test/utils/mock-context.js';
import type { Context } from 'hono';
import type { OpenSkyState } from '../../utils/opensky-api.js';

vi.mock('../../utils/opensky-api.js');

import { getStatesInBoundingBox } from '../../utils/opensky-api.js';

function mockContext() {
  return createMockContext<Context>({
    openSkyClient: { getClient: () => ({}) },
  });
}

const query = {
  minLatitude: 51,
  maxLatitude: 52,
  minLongitude: -1,
  maxLongitude: 1,
};

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

describe('searchArea handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should map aircraft with a known position', async () => {
    vi.mocked(getStatesInBoundingBox).mockResolvedValue([baseState]);

    const result = await searchArea(mockContext(), query);

    expect(result.aircraft).toEqual([
      {
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
    ]);
  });

  it('should drop aircraft with no reported position', async () => {
    vi.mocked(getStatesInBoundingBox).mockResolvedValue([
      { ...baseState, latitude: null, longitude: null },
    ]);

    const result = await searchArea(mockContext(), query);

    expect(result.aircraft).toEqual([]);
  });

  it('should request states scoped to the given bounding box', async () => {
    vi.mocked(getStatesInBoundingBox).mockResolvedValue([]);

    await searchArea(mockContext(), query);

    expect(getStatesInBoundingBox).toHaveBeenCalledWith(expect.anything(), query);
  });

  it('should return an empty list when there are no aircraft', async () => {
    vi.mocked(getStatesInBoundingBox).mockResolvedValue([]);

    const result = await searchArea(mockContext(), query);

    expect(result).toEqual({ aircraft: [] });
  });
});
