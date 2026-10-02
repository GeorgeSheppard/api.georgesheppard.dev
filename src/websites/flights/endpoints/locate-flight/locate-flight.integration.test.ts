import { describe, it, expect } from 'vitest';
import { createTestApp } from '@test/utils/app.js';
import { createMockOpenSkyClient } from '@test/mocks/opensky-client.js';

const stateVector = (icao24: string, callsign: string) => [
  icao24,
  callsign,
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
];

describe('GET /flights/locate', () => {
  it('returns the aircraft broadcasting the callsign', async () => {
    const { openSkyClient } = createMockOpenSkyClient({
      '/states/all': {
        time: 1700000000,
        states: [stateVector('400abc', 'EZY45   '), stateVector('4ca7b3', 'BAW123  ')],
      },
    });
    const app = await createTestApp({ openSkyClient });

    const response = await app.request('http://localhost/flights/locate?callsign=BAW123');

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
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

  it('returns a null aircraft when the callsign is not being tracked', async () => {
    const { openSkyClient } = createMockOpenSkyClient({
      '/states/all': { time: 1700000000, states: null },
    });
    const app = await createTestApp({ openSkyClient });

    const response = await app.request('http://localhost/flights/locate?callsign=BAW123');

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ aircraft: null });
  });

  it('returns 400 when callsign is missing', async () => {
    const { openSkyClient } = createMockOpenSkyClient();
    const app = await createTestApp({ openSkyClient });

    const response = await app.request('http://localhost/flights/locate');

    expect(response.status).toBe(400);
  });
});
