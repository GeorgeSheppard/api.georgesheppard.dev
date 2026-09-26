import { z } from 'zod';
import { Context } from 'hono';
import { getStateByIcao24 } from '../../utils/opensky-api.js';
import { searchFlightsByIdent, FlightAwareFlight } from '../../utils/flightaware-api.js';

export const FlightDetailsQuerySchema = z.object({
  icao24: z.string().min(1).describe('24-bit ICAO transponder address from the area search'),
  callsign: z
    .string()
    .optional()
    .describe('Callsign from the area search, used to look up route/airline details'),
});

export type FlightDetailsQuery = z.infer<typeof FlightDetailsQuerySchema>;

const PositionSchema = z
  .object({
    latitude: z.number(),
    longitude: z.number(),
    onGround: z.boolean(),
    altitudeMeters: z.number().nullable(),
    velocityMetersPerSecond: z.number().nullable(),
    headingDegrees: z.number().nullable(),
    verticalRateMetersPerSecond: z.number().nullable(),
  })
  .nullable();

const AirportSchema = z
  .object({
    code: z.string().nullable(),
    name: z.string().nullable(),
    city: z.string().nullable(),
  })
  .nullable();

const RouteSchema = z
  .object({
    faFlightId: z.string(),
    operator: z.string().nullable().describe('Operating airline'),
    aircraftType: z.string().nullable(),
    registration: z.string().nullable(),
    origin: AirportSchema,
    destination: AirportSchema,
    status: z.string(),
    scheduledOut: z.string().nullable(),
    estimatedOut: z.string().nullable(),
    actualOut: z.string().nullable(),
    scheduledIn: z.string().nullable(),
    estimatedIn: z.string().nullable(),
    actualIn: z.string().nullable(),
  })
  .nullable();

export const FlightDetailsResponseSchema = z.object({
  icao24: z.string(),
  callsign: z.string().nullable(),
  position: PositionSchema,
  route: RouteSchema.describe('Route/airline details, null when no match could be found'),
});

export type FlightDetailsResponse = z.infer<typeof FlightDetailsResponseSchema>;

// Of the flights AeroAPI returns for a callsign (past, current, and scheduled), the one actually
// in progress right now is the one without an actual arrival time yet, preferring the most
// recently departed if several match.
function pickCurrentFlight(flights: FlightAwareFlight[]): FlightAwareFlight | null {
  const inProgress = flights
    .filter((flight) => !flight.actualIn)
    .sort((a, b) => (b.actualOut ?? '').localeCompare(a.actualOut ?? ''));
  return inProgress[0] ?? flights[0] ?? null;
}

export async function flightDetails(
  c: Context,
  input: FlightDetailsQuery
): Promise<FlightDetailsResponse> {
  const openSkyClient = c.get('openSkyClient');
  const flightAwareClient = c.get('flightAwareClient');

  const state = await getStateByIcao24(openSkyClient.getClient(), input.icao24);
  const callsign = input.callsign?.trim() || state?.callsign || null;

  // Route/airline enrichment is a nice-to-have on top of the live position: while FlightAware
  // isn't configured, or there's no callsign to look up, this endpoint still returns position.
  const flights =
    callsign && flightAwareClient.isConfigured()
      ? await searchFlightsByIdent(flightAwareClient.getClient(), callsign)
      : [];
  const flight = pickCurrentFlight(flights);

  return {
    icao24: input.icao24,
    callsign,
    position:
      state?.latitude != null && state?.longitude != null
        ? {
            latitude: state.latitude,
            longitude: state.longitude,
            onGround: state.onGround,
            altitudeMeters: state.baroAltitudeMeters,
            velocityMetersPerSecond: state.velocityMetersPerSecond,
            headingDegrees: state.trueTrackDegrees,
            verticalRateMetersPerSecond: state.verticalRateMetersPerSecond,
          }
        : null,
    route: flight
      ? {
          faFlightId: flight.faFlightId,
          operator: flight.operator,
          aircraftType: flight.aircraftType,
          registration: flight.registration,
          origin: flight.origin,
          destination: flight.destination,
          status: flight.status,
          scheduledOut: flight.scheduledOut,
          estimatedOut: flight.estimatedOut,
          actualOut: flight.actualOut,
          scheduledIn: flight.scheduledIn,
          estimatedIn: flight.estimatedIn,
          actualIn: flight.actualIn,
        }
      : null,
  };
}
