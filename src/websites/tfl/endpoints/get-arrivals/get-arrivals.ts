import { z } from 'zod';
import { Context } from 'hono';
import { getStopPointArrivals } from '../../utils/tfl-api.js';

const DEFAULT_LIMIT = 3;
const MAX_LIMIT = 20;

export const GetArrivalsQuerySchema = z.object({
  stopPointId: z.string().min(1).describe('TfL StopPoint ID'),
  lineId: z.string().optional().describe('Filter to a specific line, e.g. "victoria"'),
  direction: z.enum(['inbound', 'outbound']).optional().describe('Filter to a specific direction'),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(MAX_LIMIT)
    .default(DEFAULT_LIMIT)
    .describe('Maximum number of arrivals to return'),
});

export type GetArrivalsQuery = z.infer<typeof GetArrivalsQuerySchema>;

export const ArrivalSchema = z.object({
  lineId: z.string(),
  lineName: z.string(),
  platformName: z.string(),
  direction: z.string(),
  destinationName: z.string(),
  timeToStationSeconds: z.number().describe('Seconds until arrival'),
  expectedArrival: z.string().describe('ISO timestamp of expected arrival'),
  currentLocation: z
    .string()
    .describe('Human-readable current position of the train, e.g. "At Green Park"'),
});

export const GetArrivalsResponseSchema = z.object({
  arrivals: z.array(ArrivalSchema),
});

export type GetArrivalsResponse = z.infer<typeof GetArrivalsResponseSchema>;

export async function getArrivals(
  c: Context,
  input: GetArrivalsQuery
): Promise<GetArrivalsResponse> {
  const tflClient = c.get('tflClient');
  const arrivals = await getStopPointArrivals(tflClient.getClient(), input.stopPointId);

  const filtered = arrivals
    .filter((arrival) => !input.lineId || arrival.lineId === input.lineId)
    .filter((arrival) => !input.direction || arrival.direction === input.direction)
    .sort((a, b) => a.timeToStation - b.timeToStation)
    .slice(0, input.limit)
    .map((arrival) => ({
      lineId: arrival.lineId,
      lineName: arrival.lineName,
      platformName: arrival.platformName,
      direction: arrival.direction,
      destinationName: arrival.destinationName,
      timeToStationSeconds: arrival.timeToStation,
      expectedArrival: arrival.expectedArrival,
      currentLocation: arrival.currentLocation,
    }));

  return { arrivals: filtered };
}
