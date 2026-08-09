import { describe, it, expect, vi, beforeEach } from 'vitest';
import { searchStations } from './search-stations.js';
import { createMockContext } from '@test/utils/mock-context.js';
import type { Context } from 'hono';

vi.mock('../../utils/tfl-api.js');
vi.mock('../../utils/station-lines-cache.js');

import { searchStopPoints } from '../../utils/tfl-api.js';
import { getStationLines } from '../../utils/station-lines-cache.js';

function mockContext() {
  return createMockContext<Context>({
    tflClient: { getClient: () => ({}) },
  });
}

describe('searchStations handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getStationLines).mockResolvedValue([]);
  });

  it('should return tube stations matching the query, with their lines', async () => {
    vi.mocked(searchStopPoints).mockResolvedValue([
      { id: '940GZZLUOXC', name: 'Oxford Circus Underground Station', modes: ['tube', 'bus'] },
      { id: '490000173C', name: 'Oxford Street Bus Stop', modes: ['bus'] },
    ]);
    vi.mocked(getStationLines).mockResolvedValue([
      { lineId: 'victoria', lineName: 'Victoria', direction: 'inbound' },
      { lineId: 'victoria', lineName: 'Victoria', direction: 'outbound' },
    ]);

    const result = await searchStations(mockContext(), { query: 'Oxford' });

    expect(result).toEqual({
      stations: [
        {
          id: '940GZZLUOXC',
          name: 'Oxford Circus Underground Station',
          lines: [
            { lineId: 'victoria', lineName: 'Victoria', direction: 'inbound' },
            { lineId: 'victoria', lineName: 'Victoria', direction: 'outbound' },
          ],
        },
      ],
    });
    expect(searchStopPoints).toHaveBeenCalledWith(expect.anything(), 'Oxford');
  });

  it('should return an empty list when there are no tube matches', async () => {
    vi.mocked(searchStopPoints).mockResolvedValue([]);

    const result = await searchStations(mockContext(), { query: 'Nonexistent' });

    expect(result).toEqual({ stations: [] });
  });

  it('should return an empty lines array when the cache has no data for a station', async () => {
    vi.mocked(searchStopPoints).mockResolvedValue([
      { id: '940GZZLUOXC', name: 'Oxford Circus Underground Station', modes: ['tube'] },
    ]);
    vi.mocked(getStationLines).mockResolvedValue([]);

    const result = await searchStations(mockContext(), { query: 'Oxford' });

    expect(result.stations[0].lines).toEqual([]);
  });
});
