import { vi } from 'vitest';
import type { FlightAwareClientWrapper } from '@core/utils/flightaware-client.js';

// Routes GET calls by exact path (query params aside) so each test only has to describe the
// FlightAware responses it cares about, instead of mocking axios end to end. Throws on any
// unmocked path so a test's assumptions about which FlightAware endpoints get called are
// enforced, not just assumed.
export function createMockFlightAwareClient(responses: Record<string, unknown> = {}) {
  const get = vi.fn(async (url: string) => {
    if (Object.prototype.hasOwnProperty.call(responses, url)) {
      return { data: responses[url] };
    }
    throw new Error(`Unexpected FlightAware request: ${url}`);
  });

  const flightAwareClient = { getClient: () => ({ get }) } as unknown as FlightAwareClientWrapper;
  return { flightAwareClient, get };
}
