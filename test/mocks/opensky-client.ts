import { vi } from 'vitest';
import type { OpenSkyClientWrapper } from '@core/utils/opensky-client.js';

// Routes GET calls by exact path (query params aside) so each test only has to describe the
// OpenSky responses it cares about, instead of mocking axios end to end. Throws on any unmocked
// path so a test's assumptions about which OpenSky endpoints get called are enforced, not just
// assumed.
export function createMockOpenSkyClient(responses: Record<string, unknown> = {}) {
  const get = vi.fn(async (url: string) => {
    if (Object.prototype.hasOwnProperty.call(responses, url)) {
      return { data: responses[url] };
    }
    throw new Error(`Unexpected OpenSky request: ${url}`);
  });

  const openSkyClient = { getClient: () => ({ get }) } as unknown as OpenSkyClientWrapper;
  return { openSkyClient, get };
}
