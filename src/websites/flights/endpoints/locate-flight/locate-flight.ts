import { z } from 'zod';
import { Context } from 'hono';
import { getAllStates, OpenSkyState } from '../../utils/opensky-api.js';
import { AircraftSchema } from '../search-area/search-area.js';

export const LocateFlightQuerySchema = z.object({
  callsign: z
    .string()
    .min(1)
    .describe(
      'Callsign as broadcast by the aircraft, e.g. "BAW123" (a flight search result ident)'
    ),
});

export type LocateFlightQuery = z.infer<typeof LocateFlightQuerySchema>;

export const LocateFlightResponseSchema = z.object({
  aircraft: AircraftSchema.nullable().describe(
    'The aircraft currently broadcasting this callsign, null when it is not being tracked'
  ),
});

export type LocateFlightResponse = z.infer<typeof LocateFlightResponseSchema>;

type PositionedState = OpenSkyState & { latitude: number; longitude: number };

const normalise = (callsign: string) => callsign.replace(/\s+/g, '').toUpperCase();

export async function locateFlight(
  c: Context,
  input: LocateFlightQuery
): Promise<LocateFlightResponse> {
  const openSkyClient = c.get('openSkyClient');
  const states = await getAllStates(openSkyClient.getClient());

  const callsign = normalise(input.callsign);
  // A callsign is occasionally still broadcast by the previous leg's aircraft on the ground, so
  // prefer the one that's airborne.
  const state = states
    .filter(
      (state): state is PositionedState =>
        state.callsign !== null &&
        normalise(state.callsign) === callsign &&
        state.latitude !== null &&
        state.longitude !== null
    )
    .sort((a, b) => Number(a.onGround) - Number(b.onGround))[0];

  return {
    aircraft: state
      ? {
          icao24: state.icao24,
          callsign: state.callsign,
          latitude: state.latitude,
          longitude: state.longitude,
          onGround: state.onGround,
          altitudeMeters: state.baroAltitudeMeters,
          velocityMetersPerSecond: state.velocityMetersPerSecond,
          headingDegrees: state.trueTrackDegrees,
          verticalRateMetersPerSecond: state.verticalRateMetersPerSecond,
        }
      : null,
  };
}
