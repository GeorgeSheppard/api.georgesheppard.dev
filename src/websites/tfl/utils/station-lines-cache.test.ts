import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./tfl-api.js');

import { getTubeLines, getLineRouteSequence, getStopPointArrivals } from './tfl-api.js';
import type { TflArrival } from './tfl-api.js';
import {
  getStationLines,
  warmStationLinesCache,
  _resetStationLinesCacheForTests,
} from './station-lines-cache.js';

const client = {} as never;
const EMPTY_SEQUENCE = { stopPointSequences: [], orderedLineRoutes: [] };

function sequenceOf(
  stops: Array<{ id: string; name: string }>,
  branches: string[][]
): {
  stopPointSequences: { stopPoint: { id: string; name: string }[] }[];
  orderedLineRoutes: { naptanIds: string[] }[];
} {
  return {
    stopPointSequences: [{ stopPoint: stops }],
    orderedLineRoutes: branches.map((naptanIds) => ({ naptanIds })),
  };
}

function mockSequences(byDirection: Record<string, ReturnType<typeof sequenceOf>>) {
  vi.mocked(getLineRouteSequence).mockImplementation(async (_client, _lineId, direction) => {
    return byDirection[direction] ?? EMPTY_SEQUENCE;
  });
}

function arrival(overrides: Partial<TflArrival>): TflArrival {
  return {
    lineId: 'district',
    lineName: 'District',
    platformName: 'Eastbound - Platform 1',
    direction: 'inbound',
    destinationName: '',
    timeToStation: 60,
    expectedArrival: '',
    currentLocation: '',
    modeName: 'tube',
    ...overrides,
  };
}

describe('station lines cache', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _resetStationLinesCacheForTests();
    // No live arrivals by default — tests that care about compass enrichment override this.
    vi.mocked(getStopPointArrivals).mockResolvedValue([]);
  });

  it('includes every intermediate station along a branch, not just the termini', async () => {
    vi.mocked(getTubeLines).mockResolvedValue([{ id: 'district', name: 'District' }]);
    mockSequences({
      inbound: sequenceOf(
        [
          { id: 'A', name: 'Upminster Underground Station' },
          { id: 'B', name: "Earl's Court Underground Station" },
          { id: 'C', name: 'Ealing Broadway Underground Station' },
        ],
        [['A', 'B', 'C']]
      ),
    });

    const lines = await getStationLines(client, 'B');

    expect(lines).toEqual([
      {
        lineId: 'district',
        lineName: 'District',
        direction: 'inbound',
        towards: ['Ealing Broadway Underground Station'],
      },
    ]);
  });

  it('labels direction with the actual terminus name, not raw inbound/outbound', async () => {
    vi.mocked(getTubeLines).mockResolvedValue([{ id: 'victoria', name: 'Victoria' }]);
    mockSequences({
      inbound: sequenceOf(
        [
          { id: 'A', name: 'Walthamstow Central Underground Station' },
          { id: 'B', name: 'Brixton Underground Station' },
        ],
        [['A', 'B']]
      ),
    });

    const [line] = await getStationLines(client, 'A');

    expect(line.towards).toEqual(['Brixton Underground Station']);
  });

  it('excludes the terminus station itself — no further travel left in that direction', async () => {
    vi.mocked(getTubeLines).mockResolvedValue([{ id: 'district', name: 'District' }]);
    mockSequences({
      inbound: sequenceOf(
        [
          { id: 'A', name: 'Upminster Underground Station' },
          { id: 'B', name: 'Ealing Broadway Underground Station' },
        ],
        [['A', 'B']]
      ),
    });

    const lines = await getStationLines(client, 'B');

    expect(lines).toEqual([]);
  });

  it('collects multiple termini when branches fork past a station', async () => {
    vi.mocked(getTubeLines).mockResolvedValue([{ id: 'district', name: 'District' }]);
    mockSequences({
      inbound: sequenceOf(
        [
          { id: 'A', name: 'Upminster Underground Station' },
          { id: 'FORK', name: "Earl's Court Underground Station" },
          { id: 'B', name: 'Ealing Broadway Underground Station' },
          { id: 'C', name: 'Richmond Underground Station' },
        ],
        [
          ['A', 'FORK', 'B'],
          ['A', 'FORK', 'C'],
        ]
      ),
    });

    const [line] = await getStationLines(client, 'FORK');

    expect(line.towards).toEqual([
      'Ealing Broadway Underground Station',
      'Richmond Underground Station',
    ]);
  });

  it('returns an empty array for a station with no data, without throwing', async () => {
    vi.mocked(getTubeLines).mockResolvedValue([]);

    const lines = await getStationLines(client, 'unknown-station');

    expect(lines).toEqual([]);
  });

  it('does not throw when the TfL API fails, so the caller never fails because of it', async () => {
    vi.mocked(getTubeLines).mockRejectedValue(new Error('TfL API unavailable'));

    await expect(getStationLines(client, 'A')).resolves.toEqual([]);
  });

  it('warmStationLinesCache never rejects, even when the underlying fetch fails', async () => {
    vi.mocked(getTubeLines).mockRejectedValue(new Error('TfL API unavailable'));

    expect(() => warmStationLinesCache(client)).not.toThrow();
  });

  it('concurrent callers during warmup share a single underlying fetch', async () => {
    vi.mocked(getTubeLines).mockResolvedValue([{ id: 'victoria', name: 'Victoria' }]);
    mockSequences({
      inbound: sequenceOf(
        [
          { id: 'A', name: 'Walthamstow Central Underground Station' },
          { id: 'B', name: 'Brixton Underground Station' },
        ],
        [['A', 'B']]
      ),
    });

    warmStationLinesCache(client);
    const [first, second] = await Promise.all([
      getStationLines(client, 'A'),
      getStationLines(client, 'A'),
    ]);

    expect(first).toEqual(second);
    expect(getTubeLines).toHaveBeenCalledTimes(1);
  });

  it('retries on the next call after a failed load instead of staying broken', async () => {
    vi.mocked(getTubeLines).mockRejectedValueOnce(new Error('TfL API unavailable'));
    vi.mocked(getTubeLines).mockResolvedValueOnce([{ id: 'victoria', name: 'Victoria' }]);
    mockSequences({
      inbound: sequenceOf(
        [
          { id: 'A', name: 'Walthamstow Central Underground Station' },
          { id: 'B', name: 'Brixton Underground Station' },
        ],
        [['A', 'B']]
      ),
    });

    const firstAttempt = await getStationLines(client, 'A');
    expect(firstAttempt).toEqual([]);

    const secondAttempt = await getStationLines(client, 'A');
    expect(secondAttempt).toEqual([
      {
        lineId: 'victoria',
        lineName: 'Victoria',
        direction: 'inbound',
        towards: ['Brixton Underground Station'],
      },
    ]);
  });

  describe('compass direction enrichment', () => {
    it('labels a direction with its real platform compass direction when a live arrival confirms it', async () => {
      vi.mocked(getTubeLines).mockResolvedValue([{ id: 'victoria', name: 'Victoria' }]);
      mockSequences({
        inbound: sequenceOf(
          [
            { id: 'A', name: 'Walthamstow Central Underground Station' },
            { id: 'B', name: 'Brixton Underground Station' },
          ],
          [['A', 'B']]
        ),
      });
      vi.mocked(getStopPointArrivals).mockResolvedValue([
        arrival({
          lineId: 'victoria',
          direction: 'inbound',
          platformName: 'Southbound - Platform 4',
        }),
      ]);

      const [line] = await getStationLines(client, 'A');

      expect(line.compass).toBe('Southbound');
    });

    it('does not set a compass direction that another line/direction genuinely flips (e.g. Jubilee)', async () => {
      // Confirms enrichment is per-station, not hardcoded per-line: same lineId, different
      // stations, different real compass directions.
      vi.mocked(getTubeLines).mockResolvedValue([{ id: 'jubilee', name: 'Jubilee' }]);
      mockSequences({
        outbound: sequenceOf(
          [
            { id: 'STANMORE', name: 'Stanmore Underground Station' },
            { id: 'WSM', name: 'Westminster Underground Station' },
            { id: 'STRATFORD', name: 'Stratford Underground Station' },
          ],
          [['STANMORE', 'WSM', 'STRATFORD']]
        ),
      });
      vi.mocked(getStopPointArrivals).mockImplementation(async (_client, stationId) => {
        if (stationId === 'STANMORE') {
          return [
            arrival({
              lineId: 'jubilee',
              direction: 'outbound',
              platformName: 'Southbound - Platform 1',
            }),
          ];
        }
        if (stationId === 'WSM') {
          return [
            arrival({
              lineId: 'jubilee',
              direction: 'outbound',
              platformName: 'Eastbound - Platform 3',
            }),
          ];
        }
        return [];
      });

      const [stanmoreLine] = await getStationLines(client, 'STANMORE');
      const [westminsterLine] = await getStationLines(client, 'WSM');

      expect(stanmoreLine.compass).toBe('Southbound');
      expect(westminsterLine.compass).toBe('Eastbound');
    });

    it('falls back to the towards-based label (no compass set) when there is no live arrival', async () => {
      vi.mocked(getTubeLines).mockResolvedValue([{ id: 'victoria', name: 'Victoria' }]);
      mockSequences({
        inbound: sequenceOf(
          [
            { id: 'A', name: 'Walthamstow Central Underground Station' },
            { id: 'B', name: 'Brixton Underground Station' },
          ],
          [['A', 'B']]
        ),
      });
      vi.mocked(getStopPointArrivals).mockResolvedValue([]);

      const [line] = await getStationLines(client, 'A');

      expect(line.compass).toBeUndefined();
      expect(line.towards).toEqual(['Brixton Underground Station']);
    });

    it('does not fail the whole cache load when arrivals lookup fails for a station', async () => {
      vi.mocked(getTubeLines).mockResolvedValue([{ id: 'victoria', name: 'Victoria' }]);
      mockSequences({
        inbound: sequenceOf(
          [
            { id: 'A', name: 'Walthamstow Central Underground Station' },
            { id: 'B', name: 'Brixton Underground Station' },
          ],
          [['A', 'B']]
        ),
      });
      vi.mocked(getStopPointArrivals).mockRejectedValue(new Error('arrivals unavailable'));

      const lines = await getStationLines(client, 'A');

      expect(lines).toEqual([
        {
          lineId: 'victoria',
          lineName: 'Victoria',
          direction: 'inbound',
          towards: ['Brixton Underground Station'],
        },
      ]);
    });
  });
});
