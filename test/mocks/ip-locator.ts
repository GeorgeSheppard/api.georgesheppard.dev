import { vi } from 'vitest';
import { IpLocator } from '@core/utils/ip-locator.js';
import { Location } from '@core/types/index.js';

export function createMockIpLocator(defaultLocation: Location = Location.Us): IpLocator {
  return {
    getLocation: vi.fn(async (ip: string | undefined) => {
      return Promise.resolve(defaultLocation);
    }),
  };
}
