import { AxiosInstance, isAxiosError } from 'axios';
import { logger } from '@core/telemetry/logger.js';
import { getOperatorName } from './flightaware-api.js';

// Airline names effectively never change, so each code is looked up at most once per process.
const cache = new Map<string, string | null>();

// Airline callsigns are the operator's 3-letter ICAO code followed by the flight number
// (e.g. "BAW123"), unlike private registrations (e.g. "GABCD") or other ad-hoc callsigns.
export function airlineCodeFromCallsign(callsign: string | null): string | null {
  return callsign?.match(/^([A-Z]{3})\d/)?.[1] ?? null;
}

// Never throws: a transient failure just means no name this time, and is retried next request.
export async function getAirlineName(client: AxiosInstance, code: string): Promise<string | null> {
  if (cache.has(code)) {
    return cache.get(code) ?? null;
  }

  try {
    const name = await getOperatorName(client, code);
    cache.set(code, name);
    return name;
  } catch (error) {
    // An unknown code won't become known later, so don't pay for the lookup again.
    if (isAxiosError(error) && error.response?.status === 404) {
      cache.set(code, null);
      return null;
    }
    logger.warn(`Failed to look up airline name for ${code}`, error);
    return null;
  }
}

export function clearAirlineNameCache() {
  cache.clear();
}
