import { describe, it, expect } from 'vitest';
import { deriveBranches } from './branches.js';
import type { TflRouteSequence } from './tfl-api.js';
import districtRouteSequence from './__fixtures__/district-route-sequence.json' with { type: 'json' };
import northernRouteSequence from './__fixtures__/northern-route-sequence.json' with { type: 'json' };

// Real TfL District line topology (captured from Line/district/Route/Sequence/inbound, the
// direction where Earl's Court sits ahead of Wimbledon in travel order), trimmed to the
// Wimbledon/Richmond/Ealing Broadway branches meeting at Earl's Court, plus the Edgware
// Road<->Wimbledon route so the dedup-by-shared-tail behaviour is exercised too.
const districtInbound = districtRouteSequence as TflRouteSequence;

const EARLS_COURT = '940GZZLUECT';
const UPMINSTER = '940GZZLUUPM';
const WIMBLEDON = '940GZZLUWIM';

// Real TfL Northern line topology (captured from Line/northern/Route/Sequence/inbound), trimmed
// to the Edgware/High Barnet/Mill Hill East branches meeting at Camden Town, which then splits
// again into "via Bank" and "via Charing Cross" routings to Morden, plus the Battersea Power
// Station extension — a genuine double-branch-point case where two branches can end at the same
// terminus (Morden) via physically different routes.
const northernInbound = northernRouteSequence as TflRouteSequence;

const CAMDEN_TOWN = '940GZZLUCTN';

describe('deriveBranches', () => {
  it("derives the Wimbledon branch from Earl's Court, including short-turn stations", () => {
    const branches = deriveBranches(districtInbound, EARLS_COURT);

    const wimbledonBranch = branches.find((b) => b.terminus === 'Wimbledon Underground Station');
    expect(wimbledonBranch).toBeDefined();
    expect(wimbledonBranch!.destinations).toEqual([
      'West Brompton Underground Station',
      'Fulham Broadway Underground Station',
      'Parsons Green Underground Station',
      'Putney Bridge Underground Station',
      'East Putney Underground Station',
      'Southfields Underground Station',
      'Wimbledon Park Underground Station',
      'Wimbledon Underground Station',
    ]);
    // No other branch from Earl's Court also ends at Wimbledon, so no "via X" disambiguation.
    expect(wimbledonBranch!.label).toBe('Wimbledon Underground Station');
  });

  it('does not mix the Richmond/Ealing Broadway branches into the Wimbledon branch', () => {
    const branches = deriveBranches(districtInbound, EARLS_COURT);

    const wimbledonBranch = branches.find((b) => b.terminus === 'Wimbledon Underground Station')!;
    expect(wimbledonBranch.destinations).not.toContain('Richmond Underground Station');
    expect(wimbledonBranch.destinations).not.toContain('Ealing Broadway Underground Station');

    const richmondBranch = branches.find((b) => b.terminus === 'Richmond Underground Station');
    expect(richmondBranch).toBeDefined();
    expect(richmondBranch!.destinations).not.toContain('Parsons Green Underground Station');
  });

  it('collapses named routes that share an identical downstream path into one branch', () => {
    // "Wimbledon <-> Upminster" and "Wimbledon <-> Edgware Road" both pass through Earl's Court
    // heading toward Wimbledon with an identical downstream path from Earl's Court onward, even
    // though they diverge on the far side (Upminster vs Edgware Road) — from a passenger at
    // Earl's Court's perspective these are the same branch, so only one entry should appear.
    const branches = deriveBranches(districtInbound, EARLS_COURT);
    const wimbledonBranches = branches.filter(
      (b) => b.terminus === 'Wimbledon Underground Station'
    );
    expect(wimbledonBranches).toHaveLength(1);
  });

  it('derives the correct downstream branch for a station before the junction', () => {
    // From Upminster, heading toward Earl's Court and beyond, all three branches are reachable.
    const branches = deriveBranches(districtInbound, UPMINSTER);
    const termini = branches.map((b) => b.terminus).sort();
    expect(termini).toEqual([
      'Ealing Broadway Underground Station',
      'Richmond Underground Station',
      'Wimbledon Underground Station',
    ]);
  });

  it('returns no branches for a station at the very end of every route it appears on', () => {
    // Wimbledon is the final stop of every route that includes it in this fixture — nothing is
    // downstream of it in this direction, so it shouldn't offer any branch to board there.
    const branches = deriveBranches(districtInbound, WIMBLEDON);
    expect(branches).toEqual([]);
  });

  it('returns no branches for an unknown stop point', () => {
    const branches = deriveBranches(districtInbound, 'not-a-real-stop-id');
    expect(branches).toEqual([]);
  });
});

describe('deriveBranches label disambiguation (Northern line)', () => {
  it('disambiguates two branches that share a terminus with TfL\'s own "via X" naming', () => {
    // From Camden Town, both the Bank and Charing Cross routings end at Morden, but take
    // physically different paths through central London — a bare "Morden" label on both would
    // be genuinely ambiguous, unlike District's branches, which all have distinct termini.
    const branches = deriveBranches(northernInbound, CAMDEN_TOWN);
    const mordenBranches = branches.filter((b) => b.terminus === 'Morden Underground Station');

    expect(mordenBranches).toHaveLength(2);
    const labels = mordenBranches.map((b) => b.label).sort();
    expect(labels).toEqual([
      'Morden Underground Station via Bank',
      'Morden Underground Station via Charing Cross',
    ]);
  });

  it('does not disambiguate a branch whose terminus is unique at this stop', () => {
    const branches = deriveBranches(northernInbound, CAMDEN_TOWN);
    const batterseaBranch = branches.find(
      (b) => b.terminus === 'Battersea Power Station Underground Station'
    );

    expect(batterseaBranch).toBeDefined();
    expect(batterseaBranch!.label).toBe('Battersea Power Station Underground Station');
  });
});
