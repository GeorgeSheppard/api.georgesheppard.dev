import { describe, it, expect, beforeEach } from 'vitest';
import { createTestApp } from '@test/utils/app.js';
import { createMockTflClient } from '@test/mocks/tfl-client.js';
import { _resetStationLinesCacheForTests } from '../../utils/station-lines-cache.js';
import type { SearchStationsResponse } from './search-stations.js';

const EARLS_COURT = '940GZZLUECT';

// getStationLines warms an in-process cache the first time it's used, by fetching every tube
// line and every stop on it — reset it before each test so one test's TfL responses can't leak
// into the next.
beforeEach(() => {
  _resetStationLinesCacheForTests();
});

describe('GET /tfl/stations', () => {
  it('returns tube stations matching the query with the lines that serve them', async () => {
    const { tflClient, get } = createMockTflClient({
      '/StopPoint/Search/Earls%20Court': {
        matches: [{ id: EARLS_COURT, name: "Earl's Court", modes: ['tube'] }],
      },
      '/Line/Mode/tube': [
        { id: 'district', name: 'District' },
        { id: 'circle', name: 'Circle' },
      ],
      '/Line/district/StopPoints': [
        { id: EARLS_COURT, commonName: "Earl's Court Underground Station" },
      ],
      '/Line/circle/StopPoints': [
        { id: EARLS_COURT, commonName: "Earl's Court Underground Station" },
      ],
    });
    const app = await createTestApp({ tflClient });

    const response = await app.request('http://localhost/tfl/stations?query=Earls%20Court');

    expect(response.status).toBe(200);
    expect(get).toHaveBeenCalledWith('/StopPoint/Search/Earls%20Court', {
      params: { modes: 'tube' },
    });
    expect(await response.json()).toEqual({
      stations: [
        {
          id: EARLS_COURT,
          name: "Earl's Court",
          lines: [
            { lineId: 'district', lineName: 'District' },
            { lineId: 'circle', lineName: 'Circle' },
          ],
        },
      ],
    });
  });

  it('excludes non-tube matches, e.g. a bus stop with the same name', async () => {
    const { tflClient } = createMockTflClient({
      '/StopPoint/Search/Victoria': {
        matches: [
          { id: '490000173VC', name: 'Victoria Bus Station', modes: ['bus'] },
          { id: '940GZZLUVIC', name: 'Victoria Underground Station', modes: ['tube'] },
        ],
      },
      '/Line/Mode/tube': [{ id: 'victoria', name: 'Victoria' }],
      '/Line/victoria/StopPoints': [
        { id: '940GZZLUVIC', commonName: 'Victoria Underground Station' },
      ],
    });
    const app = await createTestApp({ tflClient });

    const response = await app.request('http://localhost/tfl/stations?query=Victoria');

    const body = (await response.json()) as SearchStationsResponse;
    expect(body.stations).toHaveLength(1);
    expect(body.stations[0].id).toBe('940GZZLUVIC');
  });

  it('resolves a multi-modal HUB StopPoint to its tube child before looking up lines', async () => {
    const { tflClient } = createMockTflClient({
      '/StopPoint/Search/Tottenham%20Hale': {
        matches: [{ id: 'HUBTOM', name: 'Tottenham Hale', modes: ['tube'] }],
      },
      '/StopPoint/HUBTOM': {
        id: 'HUBTOM',
        children: [
          { id: '490G000667', modes: ['bus'] },
          { id: '940GZZLUTMH', modes: ['tube'] },
        ],
      },
      '/Line/Mode/tube': [{ id: 'victoria', name: 'Victoria' }],
      '/Line/victoria/StopPoints': [
        { id: '940GZZLUTMH', commonName: 'Tottenham Hale Underground Station' },
      ],
    });
    const app = await createTestApp({ tflClient });

    const response = await app.request('http://localhost/tfl/stations?query=Tottenham%20Hale');

    const body = (await response.json()) as SearchStationsResponse;
    expect(body.stations).toEqual([
      {
        id: '940GZZLUTMH',
        name: 'Tottenham Hale',
        lines: [{ lineId: 'victoria', lineName: 'Victoria' }],
      },
    ]);
  });

  it('returns 400 when query is missing', async () => {
    const { tflClient } = createMockTflClient();
    const app = await createTestApp({ tflClient });

    const response = await app.request('http://localhost/tfl/stations');

    expect(response.status).toBe(400);
  });
});
