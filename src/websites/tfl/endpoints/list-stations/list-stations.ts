import { z } from 'zod';
import { Context } from 'hono';
import { getAllStations } from '../../utils/station-lines-cache.js';

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

export const ListStationsResponseSchema = z.object({
  stations: z.array(StationSchema),
});

export type ListStationsResponse = z.infer<typeof ListStationsResponseSchema>;

// Every tube station and the lines serving it, from the pre-warmed cache. Clients fetch this
// once and cache it themselves (e.g. localStorage) so station lookup and line selection work
// offline — no per-keystroke network request, and no live TfL call on this path at all.
export async function listStations(c: Context): Promise<ListStationsResponse> {
  const tflClient = c.get('tflClient');
  const stations = await getAllStations(tflClient.getClient());
  return { stations };
}
