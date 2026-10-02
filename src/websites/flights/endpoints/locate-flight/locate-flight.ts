import { z } from 'zod';
import { Context } from 'hono';
import { getAllStates, OpenSkyState } from '../../utils/opensky-api.js';
import { FlightAwareFlightWithLinks, getFlightById } from '../../utils/flightaware-api.js';
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
    'Set when the flight has not departed yet and its aircraft was found flying in to operate it'
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

const notFound: LocateFlightResult = { status: 200, body: { aircraft: null, inboundFlight: null } };

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

  const states = await getAllStates(c.get('openSkyClient').getClient());
  const leg = inbound ?? target;
  const state = findByCallsign(states, callsignOf(leg));
  if (!state) {
    return notFound;
  }

  return {
    status: 200,
    body: { aircraft: toAircraft(state), inboundFlight: inbound ? inbound.flight : null },
  };
}
