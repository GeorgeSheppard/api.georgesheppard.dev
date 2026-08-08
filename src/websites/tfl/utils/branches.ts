import { TflRouteSequence } from './tfl-api.js';

export interface Branch {
  /** The branch's actual far terminus, e.g. "Wimbledon Underground Station" */
  terminus: string;
  /** Every station downstream of the boarding stop on this physical branch, in travel order,
   * ending with the terminus — i.e. every value a live arrival's destinationName could
   * legitimately take for a train still following this branch, including ones that short-turn
   * before reaching the terminus. */
  destinations: string[];
}

/**
 * Derives the distinct physical branches available from a given stop, in a given direction,
 * from TfL's Route/Sequence data. Multiple named "orderedLineRoutes" (each a full end-to-end
 * route, e.g. "Wimbledon <-> Upminster" and "Wimbledon <-> Edgware Road") often share an
 * identical downstream path from a station that sits between their divergence points — those
 * collapse into a single branch here, since they're indistinguishable from a boarding
 * passenger's perspective.
 */
export function deriveBranches(routeSequence: TflRouteSequence, stopPointId: string): Branch[] {
  const nameById = new Map<string, string>();
  for (const sequence of routeSequence.stopPointSequences) {
    for (const stopPoint of sequence.stopPoint) {
      nameById.set(stopPoint.id, stopPoint.name);
    }
  }

  const branchByDestinations = new Map<string, Branch>();

  for (const route of routeSequence.orderedLineRoutes) {
    const stopIndex = route.naptanIds.indexOf(stopPointId);
    if (stopIndex === -1 || stopIndex === route.naptanIds.length - 1) continue;

    const destinations = route.naptanIds
      .slice(stopIndex + 1)
      .map((id) => nameById.get(id))
      .filter((name): name is string => Boolean(name));

    if (destinations.length === 0) continue;

    const key = destinations.join('|');
    if (!branchByDestinations.has(key)) {
      branchByDestinations.set(key, {
        terminus: destinations[destinations.length - 1],
        destinations,
      });
    }
  }

  return [...branchByDestinations.values()];
}
