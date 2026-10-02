import { z } from 'zod';
import { Context } from 'hono';
import { getAllStates, OpenSkyState } from '../../utils/opensky-api.js';
import {
  FlightAwareFlightWithLinks,
  getFlightById,
  getLastPosition,
} from '../../utils/flightaware-api.js';
import { logger } from '@core/telemetry/logger.js';
import { AircraftSchema } from '../search-area/search-area.js';
import {
  FlightResultSchema,
  NotImplementedResponseSchema,
} from '../search-flight/search-flight.js';

export const LocateFlightQuerySchema = z.object({
  faFlightId: z.string().min(1).describe('Flight identifier from a flight search result'),
});

export type LocateFlightQuery = z.infer<typeof LocateFlightQuerySchema>;

export const LocateFlightResponseSchema = z.object({
  aircraft: AircraftSchema.nullable().describe(
    'The aircraft operating this flight, null when it is not being tracked or not yet known'
  ),
  inboundFlight: FlightResultSchema.nullable().describe(
    "The aircraft's previous flight, when the flight hasn't departed and that's where it was looked for"
  ),
  lastKnownPosition: z
    .object({
      latitude: z.number(),
      longitude: z.number(),
      headingDegrees: z.number().nullable(),
      seenAt: z.string().describe('When FlightAware last received a position'),
    })
    .nullable()
    .describe(
      'Where FlightAware last saw the aircraft, when it is not live (e.g. its transponder is off)'
    ),
  watchCallsigns: z
    .array(z.string())
    .describe(
      'Callsigns the aircraft may broadcast once its transponder is back on; empty when found'
    ),
});

export type LocateFlightResponse = z.infer<typeof LocateFlightResponseSchema>;

export type LocateFlightResult =
  | { status: 200; body: LocateFlightResponse }
  | { status: 501; body: z.infer<typeof NotImplementedResponseSchema> };

type PositionedState = OpenSkyState & { latitude: number; longitude: number };

const normalise = (callsign: string) => callsign.replace(/\s+/g, '').toUpperCase();

const callsignOf = ({ flight, atcIdent }: FlightAwareFlightWithLinks) => atcIdent ?? flight.ident;

// A callsign is occasionally still broadcast by the previous leg's aircraft on the ground, so
// prefer the one that's airborne.
function findByCallsign(states: OpenSkyState[], callsign: string): PositionedState | undefined {
  const wanted = normalise(callsign);
  return states
    .filter(
      (state): state is PositionedState =>
        state.callsign !== null &&
        normalise(state.callsign) === wanted &&
        state.latitude !== null &&
        state.longitude !== null
    )
    .sort((a, b) => Number(a.onGround) - Number(b.onGround))[0];
}

const toAircraft = (state: PositionedState) => ({
  icao24: state.icao24,
  callsign: state.callsign,
  latitude: state.latitude,
  longitude: state.longitude,
  onGround: state.onGround,
  altitudeMeters: state.baroAltitudeMeters,
  velocityMetersPerSecond: state.velocityMetersPerSecond,
  headingDegrees: state.trueTrackDegrees,
  verticalRateMetersPerSecond: state.verticalRateMetersPerSecond,
});

const notFound: LocateFlightResult = {
  status: 200,
  body: { aircraft: null, inboundFlight: null, lastKnownPosition: null, watchCallsigns: [] },
};

export async function locateFlight(
  c: Context,
  input: LocateFlightQuery
): Promise<LocateFlightResult> {
  const flightAwareClient = c.get('flightAwareClient');
  if (!flightAwareClient.isConfigured()) {
    return {
      status: 501,
      body: { error: 'Locating flights is not available: FlightAware is not configured yet' },
    };
  }
  const client = flightAwareClient.getClient();

  const target = await getFlightById(client, input.faFlightId);
  if (!target) {
    return notFound;
  }

  // Before departure the aircraft is usually still flying its previous leg under that leg's
  // callsign. Its own callsign isn't trusted yet either, since an earlier flight with the same
  // number may be in the air right now.
  const departed = target.flight.actualOut !== null;
  const inbound =
    !departed && target.inboundFaFlightId
      ? await getFlightById(client, target.inboundFaFlightId)
      : null;
  if (!departed && !inbound) {
    return notFound;
  }

  const leg = inbound ?? target;
  const inboundFlight = inbound ? inbound.flight : null;
  const states = await getAllStates(c.get('openSkyClient').getClient());
  const state = findByCallsign(states, callsignOf(leg));
  if (state) {
    return {
      status: 200,
      body: {
        aircraft: toAircraft(state),
        inboundFlight,
        lastKnownPosition: null,
        watchCallsigns: [],
      },
    };
  }

  // Not live, e.g. parked with its transponder off, so fall back to where FlightAware last saw
  // it. A missing position just means the client has nowhere to point at.
  const position = await getLastPosition(client, leg.flight.faFlightId).catch((error) => {
    logger.warn(`FlightAware position lookup failed for ${leg.flight.faFlightId}`, error);
    return null;
  });

  return {
    status: 200,
    body: {
      aircraft: null,
      inboundFlight,
      lastKnownPosition: position && {
        latitude: position.latitude,
        longitude: position.longitude,
        headingDegrees: position.headingDegrees,
        seenAt: position.timestamp,
      },
      // When it wakes up it'll broadcast either the leg it was last on or, once it's being
      // readied for it, the flight that was searched for.
      watchCallsigns: [...new Set([callsignOf(leg), callsignOf(target)])],
    },
  };
}
