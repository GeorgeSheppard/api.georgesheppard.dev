import { TflRouteSequence } from './tfl-api.js';

export interface Branch {
  /** The branch's actual far terminus, e.g. "Wimbledon Underground Station" */
  terminus: string;
  /** Every station downstream of the boarding stop on this physical branch, in travel order,
   * ending with the terminus — i.e. every value a live arrival's destinationName could
   * legitimately take for a train still following this branch, including ones that short-turn
   * before reaching the terminus. */
  destinations: string[];
  /** Display label — usually just the terminus, but disambiguated with TfL's own "via X" naming
   * when another branch from the same stop shares this terminus (e.g. the Northern line's
   * "Morden via Bank" vs "Morden via Charing Cross", which physically diverge for most of their
   * length despite ending at the same station). */
  label: string;
}

interface RawBranch {
  terminus: string;
  destinations: string[];
  /** TfL's own route names that produced this branch, e.g. "Edgware <-> Morden via Bank" —
   * source for the "via X" disambiguation suffix. */
  routeNames: string[];
}

const VIA_SUFFIX = / via (.+)$/i;

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

  const branchByDestinations = new Map<string, RawBranch>();

  for (const route of routeSequence.orderedLineRoutes) {
    const stopIndex = route.naptanIds.indexOf(stopPointId);
    if (stopIndex === -1 || stopIndex === route.naptanIds.length - 1) continue;

    const destinations = route.naptanIds
      .slice(stopIndex + 1)
      .map((id) => nameById.get(id))
      .filter((name): name is string => Boolean(name));

    if (destinations.length === 0) continue;

    const key = destinations.join('|');
    const existing = branchByDestinations.get(key);
    if (existing) {
      existing.routeNames.push(route.name);
    } else {
      branchByDestinations.set(key, {
        terminus: destinations[destinations.length - 1],
        destinations,
        routeNames: [route.name],
      });
    }
  }

  const rawBranches = [...branchByDestinations.values()];
  const branchesByTerminus = new Map<string, RawBranch[]>();
  for (const branch of rawBranches) {
    const group = branchesByTerminus.get(branch.terminus);
    if (group) {
      group.push(branch);
    } else {
      branchesByTerminus.set(branch.terminus, [branch]);
    }
  }

  return rawBranches.map(({ terminus, destinations, routeNames }) => {
    const sharesTerminusWithAnother = branchesByTerminus.get(terminus)!.length > 1;
    if (!sharesTerminusWithAnother) {
      return { terminus, destinations, label: terminus };
    }

    const via = routeNames.map((name) => name.match(VIA_SUFFIX)?.[1]).find(Boolean);
    return { terminus, destinations, label: via ? `${terminus} via ${via}` : terminus };
  });
}
