import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./tfl-api.js');

import { getTubeLines, getLineRouteSections } from './tfl-api.js';
import {
  getStationLines,
  warmStationLinesCache,
  _resetStationLinesCacheForTests,
} from './station-lines-cache.js';

const client = {} as never;

describe('station lines cache', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _resetStationLinesCacheForTests();
  });

  it('computes lines/directions per station from line route sections', async () => {
    vi.mocked(getTubeLines).mockResolvedValue([{ id: 'victoria', name: 'Victoria' }]);
    vi.mocked(getLineRouteSections).mockResolvedValue([
      { direction: 'inbound', originator: 'A', destination: 'B' },
      { direction: 'outbound', originator: 'B', destination: 'A' },
    ]);

    const lines = await getStationLines(client, 'A');

    expect(lines).toEqual(
      expect.arrayContaining([
        { lineId: 'victoria', lineName: 'Victoria', direction: 'inbound' },
        { lineId: 'victoria', lineName: 'Victoria', direction: 'outbound' },
      ])
    );
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
    vi.mocked(getLineRouteSections).mockResolvedValue([
      { direction: 'inbound', originator: 'A', destination: 'B' },
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
    vi.mocked(getLineRouteSections).mockResolvedValue([
      { direction: 'inbound', originator: 'A', destination: 'B' },
    ]);

    const firstAttempt = await getStationLines(client, 'A');
    expect(firstAttempt).toEqual([]);

    const secondAttempt = await getStationLines(client, 'A');
    expect(secondAttempt).toEqual([
      { lineId: 'victoria', lineName: 'Victoria', direction: 'inbound' },
    ]);
  });
});
