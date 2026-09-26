import { describe, it, expect } from 'vitest';
import { createTestApp } from '@test/utils/app.js';
import { createMockOpenSkyClient } from '@test/mocks/opensky-client.js';

describe('GET /flights/area', () => {
  it('returns aircraft within the requested bounding box', async () => {
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
    const app = await createTestApp({ openSkyClient });

    const response = await app.request(
      'http://localhost/flights/area?minLatitude=51&maxLatitude=52&minLongitude=-1&maxLongitude=1'
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      aircraft: [
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
      ],
    });
  });

  it('returns 400 when a bounding box coordinate is missing', async () => {
    const { openSkyClient } = createMockOpenSkyClient();
    const app = await createTestApp({ openSkyClient });

    const response = await app.request(
      'http://localhost/flights/area?minLatitude=51&maxLatitude=52&minLongitude=-1'
    );

    expect(response.status).toBe(400);
  });

  it('returns 400 when a latitude is out of range', async () => {
    const { openSkyClient } = createMockOpenSkyClient();
    const app = await createTestApp({ openSkyClient });

    const response = await app.request(
      'http://localhost/flights/area?minLatitude=51&maxLatitude=200&minLongitude=-1&maxLongitude=1'
    );

    expect(response.status).toBe(400);
  });
});
