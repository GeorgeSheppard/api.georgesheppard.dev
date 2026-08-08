import { describe, it, expect, vi, beforeEach } from 'vitest';
import { searchStations } from './search-stations.js';
import { createMockContext } from '@test/utils/mock-context.js';
import type { Context } from 'hono';

vi.mock('../../utils/tfl-api.js');

import { searchStopPoints } from '../../utils/tfl-api.js';

function mockContext() {
  return createMockContext<Context>({
    tflClient: { getClient: () => ({}) },
  });
}

describe('searchStations handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return tube stations matching the query', async () => {
    vi.mocked(searchStopPoints).mockResolvedValue([
      { id: '940GZZLUOXC', name: 'Oxford Circus Underground Station', modes: ['tube', 'bus'] },
      { id: '490000173C', name: 'Oxford Street Bus Stop', modes: ['bus'] },
    ]);

    const result = await searchStations(mockContext(), { query: 'Oxford' });

    expect(result).toEqual({
      stations: [{ id: '940GZZLUOXC', name: 'Oxford Circus Underground Station' }],
    });
    expect(searchStopPoints).toHaveBeenCalledWith(expect.anything(), 'Oxford');
  });

  it('should return an empty list when there are no tube matches', async () => {
    vi.mocked(searchStopPoints).mockResolvedValue([]);

    const result = await searchStations(mockContext(), { query: 'Nonexistent' });

    expect(result).toEqual({ stations: [] });
  });
});
