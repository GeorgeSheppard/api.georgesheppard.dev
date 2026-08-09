import { AxiosInstance } from 'axios';
import { logger } from '@core/telemetry/logger.js';
import {
  getTubeLines,
  getLineRouteSequence,
  getStopPointArrivals,
  TflArrival,
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
  // Compass direction as shown on platform signage and tube maps (e.g. "Northbound"). This is a
  // fixed physical fact — the platform doesn't move — but the only way TfL exposes it is via live
  // arrivals' platformName (checked: it's absent from every static StopPoint/Route endpoint), so
  // observing it depends on a train having been there to report it. Missing here just means we
  // haven't observed it *yet*, not that it doesn't exist — getStationLines keeps retrying for
  // exactly the entries that are still missing it. inbound/outbound doesn't map to a fixed compass
  // direction for every line (Jubilee flips from Northbound/Southbound on the Stanmore branch to
  // Eastbound/Westbound further along), so this can't be hardcoded per line — it's per-station.
  compass?: string;
}

const COMPASS_DIRECTIONS = ['Northbound', 'Southbound', 'Eastbound', 'Westbound'];

function extractCompassDirection(platformName: string): string | undefined {
  return COMPASS_DIRECTIONS.find((d) => platformName.includes(d));
}

// Fills in `compass` on any entries that don't have it yet, from a batch of live arrivals for the
// station they belong to. Mutates in place so both the bulk warmup pass and the later per-station
// top-up share one matching rule.
function applyCompassFromArrivals(lines: LineDirection[], arrivals: TflArrival[]): void {
  for (const line of lines) {
    if (line.compass) continue;
    const match = arrivals.find((a) => a.lineId === line.lineId && a.direction === line.direction);
    const compass = match && extractCompassDirection(match.platformName);
    if (compass) {
      line.compass = compass;
    }
  }
}

// Best-effort enrichment with real platform compass directions, one live arrivals call per
// station. Never throws and never blocks the topology data being usable — a station with no
// live arrival at build time (or any other failure) just keeps its `towards`-based fallback
// label for now; getStationLines tops these up opportunistically afterwards.
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
        applyCompassFromArrivals(lines, arrivals);
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

// Stations currently being topped up, so concurrent requests for the same station don't each
// fire their own arrivals call. Not a one-shot flag — a station with no live arrivals right now
// (e.g. queried outside service hours) keeps being retried on later requests for it, since the
// compass direction is a permanent fact we just haven't observed yet, not a fact that stops
// existing. Self-terminates once every entry for the station has a compass direction.
const inFlightCompassTopUps = new Map<string, Promise<void>>();

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

// Fire-and-forget: tries to fill in any still-missing compass directions for this station from a
// fresh live arrivals call, mutating the cached entries in place so the next lookup benefits.
// Never blocks the caller and never throws. Safe to call on every request for a station — it's a
// no-op once complete, and de-duped against a top-up already in flight.
function topUpCompassDirections(
  client: AxiosInstance,
  stationId: string,
  lines: LineDirection[]
): void {
  if (lines.every((line) => line.compass) || inFlightCompassTopUps.has(stationId)) {
    return;
  }

  const attempt = getStopPointArrivals(client, stationId)
    .then((arrivals) => applyCompassFromArrivals(lines, arrivals))
    .catch((error) => {
      logger.warn(`Failed to top up compass directions for station ${stationId}`, error);
    })
    .finally(() => {
      inFlightCompassTopUps.delete(stationId);
    });

  inFlightCompassTopUps.set(stationId, attempt);
}

export async function getStationLines(
  client: AxiosInstance,
  stationId: string
): Promise<LineDirection[]> {
  if (!isLoaded) {
    await loadCache(client);
  }
  const lines = cache.get(stationId);
  if (lines) {
    topUpCompassDirections(client, stationId, lines);
  }
  return lines ?? [];
}

// Test-only: resets the module-level singleton so each test starts from a clean cache.
export function _resetStationLinesCacheForTests(): void {
  cache = new Map();
  isLoaded = false;
  inFlightLoad = null;
  inFlightCompassTopUps.clear();
}
