import { describe, it, expect, vi, beforeEach } from 'vitest';
import { aircraftPhoto } from './aircraft-photo.js';
import { createMockContext } from '@test/utils/mock-context.js';
import type { Context } from 'hono';
import type { AircraftPhoto } from '../../utils/planespotters-api.js';

vi.mock('../../utils/planespotters-api.js');

import { getPhotoByIcao24 } from '../../utils/planespotters-api.js';

function mockContext() {
  return createMockContext<Context>({
    planespottersClient: { getClient: () => ({}) },
  });
}

const photo: AircraftPhoto = {
  url: 'https://t.plnspttrs.net/07900/1941042_570ca1c4b7_280.jpg',
  width: 420,
  height: 280,
  photographer: 'Gerrit Griem',
  link: 'https://www.planespotters.net/photo/1941042/g-euyp-british-airways-airbus-a320-232-wl',
};

describe('aircraftPhoto handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return the photo for the aircraft', async () => {
    vi.mocked(getPhotoByIcao24).mockResolvedValue(photo);

    const result = await aircraftPhoto(mockContext(), { icao24: '40697b' });

    expect(getPhotoByIcao24).toHaveBeenCalledWith(expect.anything(), '40697b');
    expect(result).toEqual({ photo });
  });

  it('should return a null photo when none is available', async () => {
    vi.mocked(getPhotoByIcao24).mockResolvedValue(null);

    const result = await aircraftPhoto(mockContext(), { icao24: '40697b' });

    expect(result).toEqual({ photo: null });
  });

  it('should return a null photo when Planespotters fails', async () => {
    vi.mocked(getPhotoByIcao24).mockRejectedValue(new Error('Request failed with status code 503'));

    const result = await aircraftPhoto(mockContext(), { icao24: '40697b' });

    expect(result).toEqual({ photo: null });
  });
});
