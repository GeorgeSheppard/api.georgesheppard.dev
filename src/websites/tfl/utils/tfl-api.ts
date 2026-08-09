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
  modeName: string;
}

export interface TflLine {
  id: string;
  name: string;
}

export interface TflMatchedStop {
  id: string;
  name: string;
}

export interface TflOrderedLineRoute {
  naptanIds: string[];
}

export interface TflStopPointSequence {
  stopPoint: TflMatchedStop[];
}

export interface TflRouteSequence {
  // The top-level `stations` list is incomplete (TfL omits some interchange stations from it) —
  // stopPointSequences is the one place every station referenced by orderedLineRoutes is
  // guaranteed to have a name.
  stopPointSequences: TflStopPointSequence[];
  orderedLineRoutes: TflOrderedLineRoute[];
}

export type TflLineDirection = 'inbound' | 'outbound';

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
  // Station search is filtered to tube stops, but a searched id can still be a multi-modal "HUB"
  // StopPoint (e.g. major interchanges) whose Arrivals include other modes too — those have their
  // own direction conventions (not TfL's tube inbound/outbound), which would otherwise flow
  // through into /tfl/branches and fail its direction validation.
  return (data ?? []).filter((arrival) => arrival.modeName === 'tube');
}

export async function getTubeLines(client: AxiosInstance): Promise<TflLine[]> {
  const { data } = await client.get<TflLine[]>('/Line/Mode/tube');
  return data ?? [];
}

// Full stop-by-stop sequence for a line in one direction, including every intermediate station
// and each branch's true terminus — unlike /Line/{id}/Route, which only lists terminus-to-terminus
// pairs and misses every station in between.
export async function getLineRouteSequence(
  client: AxiosInstance,
  lineId: string,
  direction: TflLineDirection
): Promise<TflRouteSequence> {
  const { data } = await client.get<TflRouteSequence>(
    `/Line/${encodeURIComponent(lineId)}/Route/Sequence/${direction}`,
    { params: { serviceTypes: 'Regular' } }
  );
  return {
    stopPointSequences: data.stopPointSequences ?? [],
    orderedLineRoutes: data.orderedLineRoutes ?? [],
  };
}
