import { describe, it, expect, vi, beforeEach } from 'vitest';
import { searchFlight } from './search-flight.js';
import { createMockContext } from '@test/utils/mock-context.js';
import type { Context } from 'hono';
import type { FlightAwareFlight } from '../../utils/flightaware-api.js';

vi.mock('../../utils/flightaware-api.js');

import { searchFlightsByIdent } from '../../utils/flightaware-api.js';

function mockContext() {
  return createMockContext<Context>({
    flightAwareClient: { getClient: () => ({}) },
  });
}

const flight: FlightAwareFlight = {
  faFlightId: 'BAW123-1700000000-airline-0001',
  ident: 'BAW123',
  operator: 'British Airways',
  aircraftType: 'A320',
  registration: 'G-EUUA',
  origin: { code: 'EGLL', name: 'London Heathrow', city: 'London' },
  destination: { code: 'LFPG', name: 'Paris Charles de Gaulle', city: 'Paris' },
  status: 'En Route',
  scheduledOut: '2026-09-26T09:00:00Z',
  estimatedOut: '2026-09-26T09:05:00Z',
  actualOut: '2026-09-26T09:05:00Z',
  scheduledIn: '2026-09-26T10:15:00Z',
  estimatedIn: '2026-09-26T10:20:00Z',
  actualIn: null,
};

describe('searchFlight handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return matching flights', async () => {
    vi.mocked(searchFlightsByIdent).mockResolvedValue([flight]);

    const result = await searchFlight(mockContext(), { flightNumber: 'BA123' });

    expect(result).toEqual({ flights: [flight] });
  });

  it('should search using the given flight number', async () => {
    vi.mocked(searchFlightsByIdent).mockResolvedValue([]);

    await searchFlight(mockContext(), { flightNumber: 'BA123' });

    expect(searchFlightsByIdent).toHaveBeenCalledWith(expect.anything(), 'BA123');
  });

  it('should return an empty list when no flights match', async () => {
    vi.mocked(searchFlightsByIdent).mockResolvedValue([]);

    const result = await searchFlight(mockContext(), { flightNumber: 'ZZ999' });

    expect(result).toEqual({ flights: [] });
  });
});
