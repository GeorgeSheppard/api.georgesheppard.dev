import { z } from 'zod';
import { Context } from 'hono';
import { searchFlightsByIdent } from '../../utils/flightaware-api.js';

export const SearchFlightQuerySchema = z.object({
  flightNumber: z.string().min(1).describe('Flight number, e.g. "BA123"'),
});

export type SearchFlightQuery = z.infer<typeof SearchFlightQuerySchema>;

const AirportSchema = z
  .object({
    code: z.string().nullable(),
    name: z.string().nullable(),
    city: z.string().nullable(),
  })
  .nullable();

export const FlightResultSchema = z.object({
  faFlightId: z.string().describe('Opaque identifier to pass to the flight details endpoint'),
  ident: z.string(),
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
});

export const SearchFlightResponseSchema = z.object({
  flights: z.array(FlightResultSchema),
});

export type SearchFlightResponse = z.infer<typeof SearchFlightResponseSchema>;

export async function searchFlight(
  c: Context,
  input: SearchFlightQuery
): Promise<SearchFlightResponse> {
  const flightAwareClient = c.get('flightAwareClient');
  const flights = await searchFlightsByIdent(flightAwareClient.getClient(), input.flightNumber);

  return { flights };
}
