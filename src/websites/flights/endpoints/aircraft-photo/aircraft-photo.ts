import { z } from 'zod';
import { Context } from 'hono';
import { logger } from '@core/telemetry/logger.js';
import { getPhotoByIcao24 } from '../../utils/planespotters-api.js';

export const AircraftPhotoQuerySchema = z.object({
  icao24: z.string().min(1).describe('24-bit ICAO transponder address from the area search'),
});

export type AircraftPhotoQuery = z.infer<typeof AircraftPhotoQuerySchema>;

export const AircraftPhotoResponseSchema = z.object({
  photo: z
    .object({
      url: z.string().describe('Image URL, hosted by Planespotters.net'),
      width: z.number(),
      height: z.number(),
      photographer: z.string().describe('Must be credited wherever the photo is shown'),
      link: z.string().describe('Photo page on Planespotters.net, which the photo must link to'),
    })
    .nullable()
    .describe('A photo of this exact aircraft, null when none is available'),
});

export type AircraftPhotoResponse = z.infer<typeof AircraftPhotoResponseSchema>;

export async function aircraftPhoto(
  c: Context,
  input: AircraftPhotoQuery
): Promise<AircraftPhotoResponse> {
  const planespottersClient = c.get('planespottersClient');

  // A photo is purely decorative, so a Planespotters failure just means no photo.
  const photo = await getPhotoByIcao24(planespottersClient.getClient(), input.icao24).catch(
    (error) => {
      logger.warn(`Planespotters photo lookup failed for ${input.icao24}`, error);
      return null;
    }
  );

  return { photo };
}
