import { AxiosInstance } from 'axios';
import { getRouteSequence, TflRouteSequence } from './tfl-api.js';

// Route/Sequence is TfL's timetabled topology, not live data — it only changes on genuine
// service alterations (new stations, a branch closing), not hour to hour, so a long TTL is safe
// and saves a real network round-trip on every "add station" dialog open.
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

interface CacheEntry {
  data: Promise<TflRouteSequence>;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

export async function getCachedRouteSequence(
  client: AxiosInstance,
  lineId: string,
  direction: 'inbound' | 'outbound'
): Promise<TflRouteSequence> {
  const key = `${lineId}:${direction}`;
  const cached = cache.get(key);

  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  const data = getRouteSequence(client, lineId, direction);
  cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });

  try {
    return await data;
  } catch (error) {
    // Don't cache a failed fetch — let the next request retry against TfL instead of being
    // stuck returning the same error for the rest of the TTL.
    cache.delete(key);
    throw error;
  }
}

/** Test-only: clears all cached entries so tests don't leak state into each other. */
export function clearRouteSequenceCache(): void {
  cache.clear();
}
