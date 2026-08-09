import { describe, it, expect, vi, beforeEach } from 'vitest';
import { searchStations } from './search-stations.js';
import { createMockContext } from '@test/utils/mock-context.js';
import type { Context } from 'hono';

vi.mock('../../utils/tfl-api.js');
vi.mock('../../utils/station-lines-cache.js');

import { searchStopPoints, resolveTubeStopPointId } from '../../utils/tfl-api.js';
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
    vi.mocked(resolveTubeStopPointId).mockImplementation((_client, id) => Promise.resolve(id));
  });

  it('should return tube stations matching the query, with their lines', async () => {
    vi.mocked(searchStopPoints).mockResolvedValue([
      { id: '940GZZLUOXC', name: 'Oxford Circus Underground Station', modes: ['tube', 'bus'] },
      { id: '490000173C', name: 'Oxford Street Bus Stop', modes: ['bus'] },
    ]);
    vi.mocked(getStationLines).mockResolvedValue([
      {
        lineId: 'victoria',
        lineName: 'Victoria',
        direction: 'inbound',
        towards: ['Brixton Underground Station'],
        compass: 'Southbound',
      },
      {
        lineId: 'victoria',
        lineName: 'Victoria',
        direction: 'outbound',
        towards: ['Walthamstow Central Underground Station'],
      },
    ]);

    const result = await searchStations(mockContext(), { query: 'Oxford' });

    expect(result).toEqual({
      stations: [
        {
          id: '940GZZLUOXC',
          name: 'Oxford Circus Underground Station',
          lines: [
            {
              lineId: 'victoria',
              lineName: 'Victoria',
              direction: 'inbound',
              towards: ['Brixton Underground Station'],
              compass: 'Southbound',
            },
            {
              lineId: 'victoria',
              lineName: 'Victoria',
              direction: 'outbound',
              towards: ['Walthamstow Central Underground Station'],
            },
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

  it('should resolve a HUB StopPoint id to its tube child before looking up lines', async () => {
    vi.mocked(searchStopPoints).mockResolvedValue([
      { id: 'HUBTOM', name: 'Tottenham Hale', modes: ['tube', 'national-rail', 'bus'] },
    ]);
    vi.mocked(resolveTubeStopPointId).mockResolvedValue('940GZZLUTMH');
    vi.mocked(getStationLines).mockResolvedValue([
      {
        lineId: 'victoria',
        lineName: 'Victoria',
        direction: 'outbound',
        towards: ['Walthamstow Central Underground Station'],
      },
    ]);

    const result = await searchStations(mockContext(), { query: 'Tottenham Hale' });

    expect(resolveTubeStopPointId).toHaveBeenCalledWith(expect.anything(), 'HUBTOM');
    expect(getStationLines).toHaveBeenCalledWith(expect.anything(), '940GZZLUTMH');
    expect(result.stations[0].id).toBe('940GZZLUTMH');
    expect(result.stations[0].lines).toHaveLength(1);
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
