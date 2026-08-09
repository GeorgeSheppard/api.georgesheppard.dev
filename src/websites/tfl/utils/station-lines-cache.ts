import { AxiosInstance } from 'axios';
import { logger } from '@core/telemetry/logger.js';
import { getTubeLines, getLineRouteSequence, TflLineDirection } from './tfl-api.js';

const DIRECTIONS: TflLineDirection[] = ['inbound', 'outbound'];

export interface LineDirection {
  lineId: string;
  lineName: string;
  direction: string;
  // Terminus station name(s) reached by travelling this direction from this station — e.g. a
  // District line fork means more than one. Raw TfL names (e.g. "Ealing Broadway Underground
  // Station"); display formatting happens at the edge, not here.
  towards: string[];
}

// station id -> lines/directions serving it, computed once from TfL's static route data (not
// live arrivals) so it's available even when no trains are running.
let cache: Map<string, LineDirection[]> = new Map();
let isLoaded = false;
let inFlightLoad: Promise<void> | null = null;

async function computeStationLines(client: AxiosInstance): Promise<Map<string, LineDirection[]>> {
  const lines = await getTubeLines(client);

  // stationId -> "lineId:lineName:direction" -> set of terminus names reachable that way
  const stationEntries = new Map<string, Map<string, Set<string>>>();

  for (const line of lines) {
    for (const direction of DIRECTIONS) {
      const { stopPointSequences, orderedLineRoutes } = await getLineRouteSequence(
        client,
        line.id,
        direction
      );
      const nameById = new Map(
        stopPointSequences.flatMap((seq) => seq.stopPoint.map((s) => [s.id, s.name] as const))
      );
      const key = `${line.id}:${line.name}:${direction}`;

      for (const route of orderedLineRoutes) {
        const ids = route.naptanIds;
        if (ids.length < 2) continue;

        const terminusName = nameById.get(ids[ids.length - 1]);
        if (!terminusName) continue;

        // Exclude the terminus itself: standing there, there's no further travel left in this
        // direction, so it shouldn't be offered as a pick for it.
        for (const stationId of ids.slice(0, -1)) {
          if (!stationEntries.has(stationId)) {
            stationEntries.set(stationId, new Map());
          }
          const perLine = stationEntries.get(stationId)!;
          if (!perLine.has(key)) {
            perLine.set(key, new Set());
          }
          perLine.get(key)!.add(terminusName);
        }
      }
    }
  }

  const result = new Map<string, LineDirection[]>();
  for (const [stationId, perLine] of stationEntries) {
    result.set(
      stationId,
      Array.from(perLine.entries()).map(([key, towards]) => {
        const [lineId, lineName, direction] = key.split(':');
        return { lineId, lineName, direction, towards: Array.from(towards).sort() };
      })
    );
  }
  return result;
}

// Loads the cache at most once concurrently. Never throws — a failure just leaves the cache
// unloaded so the next call tries again, instead of taking down the caller.
function loadCache(client: AxiosInstance): Promise<void> {
  if (inFlightLoad) {
    return inFlightLoad;
  }

  inFlightLoad = computeStationLines(client)
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
): Promise<LineDirection[]> {
  if (!isLoaded) {
    await loadCache(client);
  }
  return cache.get(stationId) ?? [];
}

// Test-only: resets the module-level singleton so each test starts from a clean cache.
export function _resetStationLinesCacheForTests(): void {
  cache = new Map();
  isLoaded = false;
  inFlightLoad = null;
}
