import { z } from 'zod';
import { Context } from 'hono';
import { searchStopPoints } from '../../utils/tfl-api.js';
import { getStationLines } from '../../utils/station-lines-cache.js';

export const SearchStationsQuerySchema = z.object({
  query: z.string().min(1).describe('Station name to search for'),
});

export type SearchStationsQuery = z.infer<typeof SearchStationsQuerySchema>;

export const LineDirectionSchema = z.object({
  lineId: z.string().describe('TfL Line ID'),
  lineName: z.string().describe('Line name'),
  direction: z.string().describe('Direction (inbound or outbound)'),
});

export type LineDirection = z.infer<typeof LineDirectionSchema>;

export const StationSchema = z.object({
  id: z.string().describe('TfL StopPoint ID'),
  name: z.string().describe('Station name'),
  lines: z.array(LineDirectionSchema).describe('Available lines and directions at this station'),
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

  const stations = matches
    .filter((match) => match.modes.includes('tube'))
    .map((match) => ({
      id: match.id,
      name: match.name,
      lines: getStationLines(match.id),
    }));

  return { stations };
}
