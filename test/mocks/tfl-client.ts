import { vi } from 'vitest';
import type { TflClientWrapper } from '@core/utils/tfl-client.js';

// Routes GET calls by exact path (query params aside) so each test only has to describe the TfL
// responses it cares about, instead of mocking axios end to end. Throws on any unmocked path so
// a test's assumptions about which TfL endpoints get called are enforced, not just assumed.
export function createMockTflClient(responses: Record<string, unknown> = {}) {
  const get = vi.fn(async (url: string) => {
    if (Object.prototype.hasOwnProperty.call(responses, url)) {
      return { data: responses[url] };
    }
    throw new Error(`Unexpected TfL request: ${url}`);
  });

  const tflClient = { getClient: () => ({ get }) } as unknown as TflClientWrapper;
  return { tflClient, get };
}
