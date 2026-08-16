import { describe, it, expect, beforeEach } from 'vitest';
import { createTestApp } from '@test/utils/app.js';
import { createMockTflClient } from '@test/mocks/tfl-client.js';
import { _resetStationLinesCacheForTests } from '../../utils/station-lines-cache.js';
import type { ListStationsResponse } from './list-stations.js';

const EARLS_COURT = '940GZZLUECT';

// getAllStations warms an in-process cache the first time it's used, by fetching every tube line
// and every stop on it — reset it before each test so one test's TfL responses can't leak into
// the next.
beforeEach(() => {
  _resetStationLinesCacheForTests();
});

describe('GET /tfl/stations', () => {
  it('returns every tube station with the lines serving it, sorted by name', async () => {
    const { tflClient, get } = createMockTflClient({
      '/Line/Mode/tube': [
        { id: 'district', name: 'District' },
        { id: 'circle', name: 'Circle' },
      ],
      '/Line/district/StopPoints': [
        { id: EARLS_COURT, commonName: "Earl's Court Underground Station" },
        { id: '940GZZLUWIM', commonName: 'Wimbledon Underground Station' },
      ],
      '/Line/circle/StopPoints': [
        { id: EARLS_COURT, commonName: "Earl's Court Underground Station" },
      ],
    });
    const app = await createTestApp({ tflClient });

    const response = await app.request('http://localhost/tfl/stations');

    expect(response.status).toBe(200);
    expect(get).toHaveBeenCalledWith('/Line/Mode/tube');
    expect(get).toHaveBeenCalledWith('/Line/district/StopPoints');
    expect(get).toHaveBeenCalledWith('/Line/circle/StopPoints');
    expect(await response.json()).toEqual({
      stations: [
        {
          id: EARLS_COURT,
          name: "Earl's Court Underground Station",
          lines: [
            { lineId: 'district', lineName: 'District' },
            { lineId: 'circle', lineName: 'Circle' },
          ],
        },
        {
          id: '940GZZLUWIM',
          name: 'Wimbledon Underground Station',
          lines: [{ lineId: 'district', lineName: 'District' }],
        },
      ],
    });
  });

  it('returns an empty list rather than an error if TfL is unavailable', async () => {
    const { tflClient } = createMockTflClient();
    const app = await createTestApp({ tflClient });

    const response = await app.request('http://localhost/tfl/stations');

    expect(response.status).toBe(200);
    const body = (await response.json()) as ListStationsResponse;
    expect(body).toEqual({ stations: [] });
  });
});
