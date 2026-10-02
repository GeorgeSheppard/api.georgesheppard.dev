import { AxiosInstance } from 'axios';

export interface FlightAwareAirport {
  code: string | null;
  iataCode: string | null;
  name: string | null;
  city: string | null;
}

export interface FlightAwareFlight {
  faFlightId: string;
  ident: string;
  operator: string | null;
  aircraftType: string | null;
  registration: string | null;
  origin: FlightAwareAirport | null;
  destination: FlightAwareAirport | null;
  status: string;
  scheduledOut: string | null;
  estimatedOut: string | null;
  actualOut: string | null;
  scheduledIn: string | null;
  estimatedIn: string | null;
  actualIn: string | null;
}

interface FlightAwareRawAirport {
  code: string | null;
  code_iata?: string | null;
  name: string | null;
  city: string | null;
}

interface FlightAwareRawFlight {
  fa_flight_id: string;
  ident: string;
  atc_ident?: string | null;
  inbound_fa_flight_id?: string | null;
  operator: string | null;
  aircraft_type: string | null;
  registration: string | null;
  origin: FlightAwareRawAirport | null;
  destination: FlightAwareRawAirport | null;
  status: string;
  scheduled_out: string | null;
  estimated_out: string | null;
  actual_out: string | null;
  scheduled_in: string | null;
  estimated_in: string | null;
  actual_in: string | null;
}

interface FlightAwareFlightsResponse {
  flights: FlightAwareRawFlight[];
}

function toAirport(airport: FlightAwareRawAirport | null): FlightAwareAirport | null {
  if (!airport) {
    return null;
  }
  return {
    code: airport.code,
    iataCode: airport.code_iata ?? null,
    name: airport.name,
    city: airport.city,
  };
}

function toFlight(flight: FlightAwareRawFlight): FlightAwareFlight {
  return {
    faFlightId: flight.fa_flight_id,
    ident: flight.ident,
    operator: flight.operator,
    aircraftType: flight.aircraft_type,
    registration: flight.registration,
    origin: toAirport(flight.origin),
    destination: toAirport(flight.destination),
    status: flight.status,
    scheduledOut: flight.scheduled_out,
    estimatedOut: flight.estimated_out,
    actualOut: flight.actual_out,
    scheduledIn: flight.scheduled_in,
    estimatedIn: flight.estimated_in,
    actualIn: flight.actual_in,
  };
}

// `ident` accepts a flight number (e.g. "BA123") or an ICAO/IATA callsign as broadcast by an
// aircraft's transponder. AeroAPI returns every matching flight (past, current, and scheduled),
// so callers that want "where is it now" should pick the entry without an actual_in.
export async function searchFlightsByIdent(
  client: AxiosInstance,
  ident: string
): Promise<FlightAwareFlight[]> {
  const { data } = await client.get<FlightAwareFlightsResponse>(
    `/flights/${encodeURIComponent(ident)}`
  );
  return (data.flights ?? []).map(toFlight);
}

export interface FlightAwareFlightWithLinks {
  flight: FlightAwareFlight;
  // The callsign broadcast by the aircraft, when the airline uses one other than the flight number.
  atcIdent: string | null;
  // The aircraft's previous flight, i.e. the one bringing it here to operate this one.
  inboundFaFlightId: string | null;
}

export async function getFlightById(
  client: AxiosInstance,
  faFlightId: string
): Promise<FlightAwareFlightWithLinks | null> {
  const { data } = await client.get<FlightAwareFlightsResponse>(
    `/flights/${encodeURIComponent(faFlightId)}`
  );
  const [flight] = data.flights ?? [];
  return flight
    ? {
        flight: toFlight(flight),
        atcIdent: flight.atc_ident ?? null,
        inboundFaFlightId: flight.inbound_fa_flight_id ?? null,
      }
    : null;
}

export interface FlightAwarePosition {
  latitude: number;
  longitude: number;
  headingDegrees: number | null;
  timestamp: string;
}

interface FlightAwareRawPosition {
  latitude: number;
  longitude: number;
  heading: number | null;
  timestamp: string;
}

interface FlightAwareFlightPositionResponse {
  last_position?: FlightAwareRawPosition | null;
}

// The last position FlightAware received for a flight, which outlives the aircraft's transponder
// going quiet (e.g. once it's parked at the gate).
export async function getLastPosition(
  client: AxiosInstance,
  faFlightId: string
): Promise<FlightAwarePosition | null> {
  const { data } = await client.get<FlightAwareFlightPositionResponse>(
    `/flights/${encodeURIComponent(faFlightId)}/position`
  );
  const position = data.last_position;
  return position
    ? {
        latitude: position.latitude,
        longitude: position.longitude,
        headingDegrees: position.heading ?? null,
        timestamp: position.timestamp,
      }
    : null;
}

interface FlightAwareRawOperator {
  name: string | null;
  shortname: string | null;
}

// `code` is an airline ICAO (e.g. "BAW") or IATA code; `operator` on a flight is the ICAO code.
export async function getOperatorName(client: AxiosInstance, code: string): Promise<string | null> {
  const { data } = await client.get<FlightAwareRawOperator>(
    `/operators/${encodeURIComponent(code)}`
  );
  return data.shortname || data.name || null;
}
