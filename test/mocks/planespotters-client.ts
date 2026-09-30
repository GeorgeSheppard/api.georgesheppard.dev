import { vi } from 'vitest';
import type { PlanespottersClientWrapper } from '@core/utils/planespotters-client.js';

// Routes GET calls by exact path so each test only has to describe the Planespotters responses it
// cares about. Throws on any unmocked path so a test's assumptions about which endpoints get
// called are enforced, not just assumed.
export function createMockPlanespottersClient(responses: Record<string, unknown> = {}) {
  const get = vi.fn(async (url: string) => {
    if (Object.prototype.hasOwnProperty.call(responses, url)) {
      return { data: responses[url] };
    }
    throw new Error(`Unexpected Planespotters request: ${url}`);
  });

  const planespottersClient = {
    getClient: () => ({ get }),
  } as unknown as PlanespottersClientWrapper;
  return { planespottersClient, get };
}
