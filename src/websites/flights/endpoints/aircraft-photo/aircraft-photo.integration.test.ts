import { describe, it, expect } from 'vitest';
import { createTestApp } from '@test/utils/app.js';
import { createMockPlanespottersClient } from '@test/mocks/planespotters-client.js';

describe('GET /flights/photo', () => {
  it('returns the first photo of the aircraft with its attribution', async () => {
    const { planespottersClient } = createMockPlanespottersClient({
      '/photos/hex/40697b': {
        photos: [
          {
            id: '1941042',
            thumbnail: {
              src: 'https://t.plnspttrs.net/07900/1941042_570ca1c4b7_t.jpg',
              size: { width: 200, height: 133 },
            },
            thumbnail_large: {
              src: 'https://t.plnspttrs.net/07900/1941042_570ca1c4b7_280.jpg',
              size: { width: 420, height: 280 },
            },
            link: 'https://www.planespotters.net/photo/1941042/g-euyp?utm_source=api',
            photographer: 'Gerrit Griem',
          },
        ],
      },
    });
    const app = await createTestApp({ planespottersClient });

    const response = await app.request('http://localhost/flights/photo?icao24=40697b');

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      photo: {
        url: 'https://t.plnspttrs.net/07900/1941042_570ca1c4b7_280.jpg',
        width: 420,
        height: 280,
        photographer: 'Gerrit Griem',
        link: 'https://www.planespotters.net/photo/1941042/g-euyp?utm_source=api',
      },
    });
  });

  it('returns a null photo when the aircraft has none', async () => {
    const { planespottersClient } = createMockPlanespottersClient({
      '/photos/hex/40697b': { photos: [] },
    });
    const app = await createTestApp({ planespottersClient });

    const response = await app.request('http://localhost/flights/photo?icao24=40697b');

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ photo: null });
  });

  it('returns 400 when icao24 is missing', async () => {
    const { planespottersClient } = createMockPlanespottersClient();
    const app = await createTestApp({ planespottersClient });

    const response = await app.request('http://localhost/flights/photo');

    expect(response.status).toBe(400);
  });
});
