import { z } from 'zod';
import { Context } from 'hono';
import { getStatesInBoundingBox } from '../../utils/opensky-api.js';

export const SearchAreaQuerySchema = z.object({
  minLatitude: z.coerce.number().min(-90).max(90).describe('Southern edge of the search box'),
  maxLatitude: z.coerce.number().min(-90).max(90).describe('Northern edge of the search box'),
  minLongitude: z.coerce.number().min(-180).max(180).describe('Western edge of the search box'),
  maxLongitude: z.coerce.number().min(-180).max(180).describe('Eastern edge of the search box'),
});

export type SearchAreaQuery = z.infer<typeof SearchAreaQuerySchema>;

export const AircraftSchema = z.object({
  icao24: z.string().describe('24-bit ICAO transponder address, e.g. "4ca7b3"'),
  callsign: z.string().nullable().describe('Callsign currently broadcast by the aircraft'),
  latitude: z.number(),
  longitude: z.number(),
  onGround: z.boolean(),
  altitudeMeters: z.number().nullable().describe('Barometric altitude in meters'),
  velocityMetersPerSecond: z.number().nullable(),
  headingDegrees: z.number().nullable().describe('True track in degrees, 0 is north'),
  verticalRateMetersPerSecond: z.number().nullable(),
});

export const SearchAreaResponseSchema = z.object({
  aircraft: z.array(AircraftSchema),
});

export type SearchAreaResponse = z.infer<typeof SearchAreaResponseSchema>;

export async function searchArea(c: Context, input: SearchAreaQuery): Promise<SearchAreaResponse> {
  const openSkyClient = c.get('openSkyClient');
  const states = await getStatesInBoundingBox(openSkyClient.getClient(), input);

  // Aircraft with no reported position can't be plotted on a map, so there's nothing useful to
  // return them for.
  const aircraft = states
    .filter(
      (state): state is typeof state & { latitude: number; longitude: number } =>
        state.latitude !== null && state.longitude !== null
    )
    .map((state) => ({
      icao24: state.icao24,
      callsign: state.callsign,
      latitude: state.latitude,
      longitude: state.longitude,
      onGround: state.onGround,
      altitudeMeters: state.baroAltitudeMeters,
      velocityMetersPerSecond: state.velocityMetersPerSecond,
      headingDegrees: state.trueTrackDegrees,
      verticalRateMetersPerSecond: state.verticalRateMetersPerSecond,
    }));

  return { aircraft };
}
