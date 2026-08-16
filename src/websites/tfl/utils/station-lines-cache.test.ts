import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./tfl-api.js');

import { getTubeLines, getLineStopPoints } from './tfl-api.js';
import {
  getStationLines,
  getAllStations,
  warmStationLinesCache,
  _resetStationLinesCacheForTests,
} from './station-lines-cache.js';

const client = {} as never;

describe('station lines cache', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _resetStationLinesCacheForTests();
  });

  it('returns the line serving a station', async () => {
    vi.mocked(getTubeLines).mockResolvedValue([{ id: 'district', name: 'District' }]);
    vi.mocked(getLineStopPoints).mockResolvedValue([
      { id: 'A', name: 'Upminster Underground Station' },
      { id: 'B', name: "Earl's Court Underground Station" },
    ]);

    const lines = await getStationLines(client, 'B');

    expect(lines).toEqual([{ lineId: 'district', lineName: 'District' }]);
  });

  it('includes a station that is a terminus, unlike the old direction-based cache', async () => {
    vi.mocked(getTubeLines).mockResolvedValue([{ id: 'district', name: 'District' }]);
    vi.mocked(getLineStopPoints).mockResolvedValue([
      { id: 'A', name: 'Upminster Underground Station' },
      { id: 'B', name: 'Ealing Broadway Underground Station' },
    ]);

    const lines = await getStationLines(client, 'B');

    expect(lines).toEqual([{ lineId: 'district', lineName: 'District' }]);
  });

  it('collects every line serving an interchange station', async () => {
    vi.mocked(getTubeLines).mockResolvedValue([
      { id: 'victoria', name: 'Victoria' },
      { id: 'piccadilly', name: 'Piccadilly' },
    ]);
    vi.mocked(getLineStopPoints).mockImplementation(async (_client, lineId) => {
      if (lineId === 'victoria') return [{ id: 'FSY', name: 'Finsbury Park Underground Station' }];
      return [{ id: 'FSY', name: 'Finsbury Park Underground Station' }];
    });

    const lines = await getStationLines(client, 'FSY');

    expect(lines).toEqual([
      { lineId: 'victoria', lineName: 'Victoria' },
      { lineId: 'piccadilly', lineName: 'Piccadilly' },
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
    vi.mocked(getLineStopPoints).mockResolvedValue([
      { id: 'A', name: 'Walthamstow Central Underground Station' },
    ]);

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
    vi.mocked(getLineStopPoints).mockResolvedValue([
      { id: 'A', name: 'Walthamstow Central Underground Station' },
    ]);

    const firstAttempt = await getStationLines(client, 'A');
    expect(firstAttempt).toEqual([]);

    const secondAttempt = await getStationLines(client, 'A');
    expect(secondAttempt).toEqual([{ lineId: 'victoria', lineName: 'Victoria' }]);
  });

  describe('getAllStations', () => {
    it('returns every station with the lines serving it, sorted by name', async () => {
      vi.mocked(getTubeLines).mockResolvedValue([
        { id: 'district', name: 'District' },
        { id: 'circle', name: 'Circle' },
      ]);
      vi.mocked(getLineStopPoints).mockImplementation(async (_client, lineId) => {
        if (lineId === 'district') {
          return [
            { id: 'A', name: 'Wimbledon Underground Station' },
            { id: 'B', name: "Earl's Court Underground Station" },
          ];
        }
        return [{ id: 'B', name: "Earl's Court Underground Station" }];
      });

      const stations = await getAllStations(client);

      expect(stations).toEqual([
        {
          id: 'B',
          name: "Earl's Court Underground Station",
          lines: [
            { lineId: 'district', lineName: 'District' },
            { lineId: 'circle', lineName: 'Circle' },
          ],
        },
        {
          id: 'A',
          name: 'Wimbledon Underground Station',
          lines: [{ lineId: 'district', lineName: 'District' }],
        },
      ]);
    });

    it('returns an empty array without throwing when the TfL API fails', async () => {
      vi.mocked(getTubeLines).mockRejectedValue(new Error('TfL API unavailable'));

      await expect(getAllStations(client)).resolves.toEqual([]);
    });
  });
});
