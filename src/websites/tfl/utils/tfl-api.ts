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
