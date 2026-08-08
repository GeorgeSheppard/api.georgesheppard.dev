import { AxiosInstance } from 'axios';

export interface TflStopPointMatch {
  id: string;
  name: string;
  modes: string[];
}

interface TflSearchResponse {
  matches: TflStopPointMatch[];
}

export interface TflArrival {
  lineId: string;
  lineName: string;
  platformName: string;
  direction: string;
  destinationName: string;
  timeToStation: number;
  expectedArrival: string;
  currentLocation: string;
}

export async function searchStopPoints(
  client: AxiosInstance,
  query: string
): Promise<TflStopPointMatch[]> {
  const { data } = await client.get<TflSearchResponse>(
    `/StopPoint/Search/${encodeURIComponent(query)}`,
    { params: { modes: 'tube' } }
  );
  return data.matches ?? [];
}

export async function getStopPointArrivals(
  client: AxiosInstance,
  stopPointId: string
): Promise<TflArrival[]> {
  const { data } = await client.get<TflArrival[]>(
    `/StopPoint/${encodeURIComponent(stopPointId)}/Arrivals`
  );
  return data ?? [];
}

interface TflRouteSequenceStopPoint {
  id: string;
  name: string;
}

interface TflStopPointSequence {
  stopPoint: TflRouteSequenceStopPoint[];
}

interface TflOrderedLineRoute {
  name: string;
  naptanIds: string[];
}

export interface TflRouteSequence {
  stopPointSequences: TflStopPointSequence[];
  orderedLineRoutes: TflOrderedLineRoute[];
}

export async function getRouteSequence(
  client: AxiosInstance,
  lineId: string,
  direction: 'inbound' | 'outbound'
): Promise<TflRouteSequence> {
  const { data } = await client.get<TflRouteSequence>(
    `/Line/${encodeURIComponent(lineId)}/Route/Sequence/${direction}`,
    { params: { excludeCrowding: true } }
  );
  return data;
}
