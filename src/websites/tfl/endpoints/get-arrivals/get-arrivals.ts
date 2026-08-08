import { z } from 'zod';
import { Context } from 'hono';
import { getStopPointArrivals } from '../../utils/tfl-api.js';

const DEFAULT_LIMIT = 3;
// The frontend also uses an unfiltered, high-limit request to discover every line/direction
// combo currently running at a station, so this needs to comfortably cover a busy interchange.
const MAX_LIMIT = 50;

export const GetArrivalsQuerySchema = z.object({
  stopPointId: z.string().min(1).describe('TfL StopPoint ID'),
  lineId: z.string().optional().describe('Filter to a specific line, e.g. "victoria"'),
  direction: z.enum(['inbound', 'outbound']).optional().describe('Filter to a specific direction'),
  // Hono collapses a single query value to a plain string and only produces an array when the
  // same key is repeated, so this accepts either shape — normalized to an array in the handler,
  // below, rather than via .transform() here, which would make the field's TS type technically
  // required-but-possibly-undefined instead of optional and break every caller that omits it.
  destinationName: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .describe(
      'Filter to one or more destinations, e.g. "Wimbledon" — pass multiple to accept every ' +
        'station on a branch (including short-turning trains), useful for branched lines like ' +
        'the District line. Repeat the param for multiple values.'
    ),
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

  const destinationNames = input.destinationName ? [input.destinationName].flat() : undefined;

  const filtered = arrivals
    .filter((arrival) => !input.lineId || arrival.lineId === input.lineId)
    .filter((arrival) => !input.direction || arrival.direction === input.direction)
    .filter((arrival) => !destinationNames || destinationNames.includes(arrival.destinationName))
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
