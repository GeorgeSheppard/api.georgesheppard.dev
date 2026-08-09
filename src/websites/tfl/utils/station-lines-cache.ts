import { AxiosInstance } from 'axios';
import { logger } from '@core/telemetry/logger.js';
import {
  getTubeLines,
  getLineRouteSequence,
  getStopPointArrivals,
  TflLineDirection,
} from './tfl-api.js';

const DIRECTIONS: TflLineDirection[] = ['inbound', 'outbound'];

export interface LineDirection {
  lineId: string;
  lineName: string;
  direction: string;
  // Terminus station name(s) reached by travelling this direction from this station — e.g. a
  // District line fork means more than one. Raw TfL names (e.g. "Ealing Broadway Underground
  // Station"); display formatting happens at the edge, not here.
  towards: string[];
  // Compass direction as shown on platform signage and tube maps (e.g. "Northbound"). Best-effort:
  // derived from live arrivals at cache-build time, so it's only set when a train happened to be
  // there to report it. inbound/outbound doesn't map to a fixed compass direction for every line
  // (Jubilee flips from Northbound/Southbound on the Stanmore branch to Eastbound/Westbound
  // further along), so this can't be hardcoded per line — it's genuinely per-station.
  compass?: string;
}

const COMPASS_DIRECTIONS = ['Northbound', 'Southbound', 'Eastbound', 'Westbound'];

function extractCompassDirection(platformName: string): string | undefined {
  return COMPASS_DIRECTIONS.find((d) => platformName.includes(d));
}

// Best-effort enrichment with real platform compass directions, one live arrivals call per
// station. Never throws and never blocks the topology data being usable — a station with no
// live arrival at build time (or any other failure) just keeps its `towards`-based fallback
// label instead of a compass one.
async function enrichWithCompassDirections(
  client: AxiosInstance,
  result: Map<string, LineDirection[]>
): Promise<void> {
  const stationIds = Array.from(result.keys());
  const CONCURRENCY = 8;
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < stationIds.length) {
      const stationId = stationIds[nextIndex++];
      const lines = result.get(stationId);
      if (!lines) continue;

      try {
        const arrivals = await getStopPointArrivals(client, stationId);
        for (const line of lines) {
          const match = arrivals.find(
            (a) => a.lineId === line.lineId && a.direction === line.direction
          );
          const compass = match && extractCompassDirection(match.platformName);
          if (compass) {
            line.compass = compass;
          }
        }
      } catch (error) {
        logger.warn(`Failed to enrich compass directions for station ${stationId}`, error);
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
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

  try {
    await enrichWithCompassDirections(client, result);
  } catch (error) {
    // Compass labels are a nice-to-have — the topology in `result` is already correct and
    // usable on its own (via `towards`), so a failure here must not fail the whole computation.
    logger.warn('Failed to enrich station lines with compass directions', error);
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
