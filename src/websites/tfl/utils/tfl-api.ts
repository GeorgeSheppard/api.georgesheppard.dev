import { AxiosInstance } from 'axios';

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

export interface TflLineStopPoint {
  id: string;
  name: string;
}

// TfL omits destinationName entirely (not even an empty string) for predictions whose
// destination isn't confirmed yet — trains it can only report as "Check Front of Train" — rather
// than always populating it, which broke callers relying on it always being a string.
export async function getLineArrivals(
  client: AxiosInstance,
  lineId: string,
  stopPointId: string
): Promise<TflArrival[]> {
  const { data } = await client.get<TflArrival[]>(
    `/Line/${encodeURIComponent(lineId)}/Arrivals/${encodeURIComponent(stopPointId)}`
  );
  return (data ?? []).map((arrival) => ({
    ...arrival,
    destinationName: arrival.destinationName || 'Check front of train',
  }));
}

export async function getTubeLines(client: AxiosInstance): Promise<TflLine[]> {
  const { data } = await client.get<TflLine[]>('/Line/Mode/tube');
  return data ?? [];
}

interface TflLineStopPointResponse {
  id: string;
  commonName: string;
}

// Every station served by a line, direction-agnostic — what a rider actually subscribes to.
export async function getLineStopPoints(
  client: AxiosInstance,
  lineId: string
): Promise<TflLineStopPoint[]> {
  const { data } = await client.get<TflLineStopPointResponse[]>(
    `/Line/${encodeURIComponent(lineId)}/StopPoints`
  );
  return (data ?? []).map((stop) => ({ id: stop.id, name: stop.commonName }));
}
