import { z } from 'zod';
import { Context } from 'hono';
import { searchStopPoints, resolveTubeStopPointId } from '../../utils/tfl-api.js';
import { getStationLines } from '../../utils/station-lines-cache.js';

export const SearchStationsQuerySchema = z.object({
  query: z.string().min(1).describe('Station name to search for'),
});

export type SearchStationsQuery = z.infer<typeof SearchStationsQuerySchema>;

export const StationLineSchema = z.object({
  lineId: z.string().describe('TfL Line ID'),
  lineName: z.string().describe('Line name'),
});

export type StationLine = z.infer<typeof StationLineSchema>;

export const StationSchema = z.object({
  id: z.string().describe('TfL StopPoint ID'),
  name: z.string().describe('Station name'),
  lines: z.array(StationLineSchema).describe('Lines serving this station'),
});

export type Station = z.infer<typeof StationSchema>;

export const SearchStationsResponseSchema = z.object({
  stations: z.array(StationSchema),
});

export type SearchStationsResponse = z.infer<typeof SearchStationsResponseSchema>;

export async function searchStations(
  c: Context,
  input: SearchStationsQuery
): Promise<SearchStationsResponse> {
  const tflClient = c.get('tflClient');
  const matches = await searchStopPoints(tflClient.getClient(), input.query);

  const tubeMatches = matches.filter((match) => match.modes.includes('tube'));
  const stations = await Promise.all(
    tubeMatches.map(async (match) => {
      const id = await resolveTubeStopPointId(tflClient.getClient(), match.id);
      return {
        id,
        name: match.name,
        lines: await getStationLines(tflClient.getClient(), id),
      };
    })
  );

  return { stations };
}
