import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AxiosError, AxiosHeaders, AxiosInstance } from 'axios';
import { airlineCodeFromCallsign, clearAirlineNameCache, getAirlineName } from './airline-names.js';

vi.mock('./flightaware-api.js');

import { getOperatorName } from './flightaware-api.js';

const client = {} as AxiosInstance;

function notFound() {
  return new AxiosError('Not Found', '404', undefined, undefined, {
    status: 404,
    statusText: 'Not Found',
    data: {},
    headers: {},
    config: { headers: new AxiosHeaders() },
  });
}

describe('airlineCodeFromCallsign', () => {
  it('should return the ICAO prefix of an airline callsign', () => {
    expect(airlineCodeFromCallsign('BAW123')).toBe('BAW');
    expect(airlineCodeFromCallsign('EZY45QK')).toBe('EZY');
  });

  it('should return null for non-airline callsigns', () => {
    expect(airlineCodeFromCallsign('GABCD')).toBeNull();
    expect(airlineCodeFromCallsign('WORKS 7')).toBeNull();
    expect(airlineCodeFromCallsign(null)).toBeNull();
  });
});

describe('getAirlineName', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearAirlineNameCache();
  });

  it('should look up each code only once', async () => {
    vi.mocked(getOperatorName).mockResolvedValue('British Airways');

    expect(await getAirlineName(client, 'BAW')).toBe('British Airways');
    expect(await getAirlineName(client, 'BAW')).toBe('British Airways');
    expect(getOperatorName).toHaveBeenCalledTimes(1);
  });

  it('should remember unknown codes', async () => {
    vi.mocked(getOperatorName).mockRejectedValue(notFound());

    expect(await getAirlineName(client, 'XXX')).toBeNull();
    expect(await getAirlineName(client, 'XXX')).toBeNull();
    expect(getOperatorName).toHaveBeenCalledTimes(1);
  });

  it('should retry after a transient failure', async () => {
    vi.mocked(getOperatorName)
      .mockRejectedValueOnce(new Error('timeout'))
      .mockResolvedValueOnce('British Airways');

    expect(await getAirlineName(client, 'BAW')).toBeNull();
    expect(await getAirlineName(client, 'BAW')).toBe('British Airways');
  });
});
