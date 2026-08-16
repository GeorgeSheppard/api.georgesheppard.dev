import { AxiosInstance } from 'axios';
import { logger } from '@core/telemetry/logger.js';
import { getTubeLines, getLineStopPoints } from './tfl-api.js';

export interface StationLine {
  lineId: string;
  lineName: string;
}

export interface CachedStation {
  id: string;
  name: string;
  lines: StationLine[];
}

// station id -> station + lines serving it, computed once from TfL's static per-line stop point
// lists (not live arrivals) so it's available even when no trains are running.
let cache: Map<string, CachedStation> = new Map();
let isLoaded = false;
let inFlightLoad: Promise<void> | null = null;

async function computeStations(client: AxiosInstance): Promise<Map<string, CachedStation>> {
  const lines = await getTubeLines(client);
  const result = new Map<string, CachedStation>();

  for (const line of lines) {
    const stopPoints = await getLineStopPoints(client, line.id);
    for (const stop of stopPoints) {
      const station = result.get(stop.id) ?? { id: stop.id, name: stop.name, lines: [] };
      station.lines.push({ lineId: line.id, lineName: line.name });
      result.set(stop.id, station);
    }
  }

  return result;
}

// Loads the cache at most once concurrently. Never throws — a failure just leaves the cache
// unloaded so the next call tries again, instead of taking down the caller.
function loadCache(client: AxiosInstance): Promise<void> {
  if (inFlightLoad) {
    return inFlightLoad;
  }

  inFlightLoad = computeStations(client)
    .then((result) => {
      cache = result;
      isLoaded = true;
      logger.info(`TfL station lines cache loaded: ${cache.size} stations`);
    })
    .catch((error) => {
      logger.warn('Failed to load TfL station lines cache, will retry on next request', error);
    })
    .finally(() => {
      inFlightLoad = null;
    });

  return inFlightLoad;
}

// Fire-and-forget warmup — must never block or reject, so a slow/unavailable TfL API can't stop
// the server from starting or take down other TfL endpoints.
export function warmStationLinesCache(client: AxiosInstance): void {
  loadCache(client).catch(() => {
    // loadCache already logs and swallows errors; this is just a safety net.
  });
}

export async function getStationLines(
  client: AxiosInstance,
  stationId: string
): Promise<StationLine[]> {
  if (!isLoaded) {
    await loadCache(client);
  }
  return cache.get(stationId)?.lines ?? [];
}

// Every tube station and the lines serving it — the full dataset the frontend fetches once and
// caches client-side, rather than searching per keystroke.
export async function getAllStations(client: AxiosInstance): Promise<CachedStation[]> {
  if (!isLoaded) {
    await loadCache(client);
  }
  return [...cache.values()].sort((a, b) => a.name.localeCompare(b.name));
}

// Test-only: resets the module-level singleton so each test starts from a clean cache.
export function _resetStationLinesCacheForTests(): void {
  cache = new Map();
  isLoaded = false;
  inFlightLoad = null;
}
