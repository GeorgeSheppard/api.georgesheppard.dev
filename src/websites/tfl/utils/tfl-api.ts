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

interface TflStopPointChild {
  id: string;
  modes: string[];
}

interface TflStopPointDetail {
  id: string;
  children?: TflStopPointChild[];
}

export interface TflLineStopPoint {
  id: string;
  name: string;
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

export async function getLineArrivals(
  client: AxiosInstance,
  lineId: string,
  stopPointId: string
): Promise<TflArrival[]> {
  const { data } = await client.get<TflArrival[]>(
    `/Line/${encodeURIComponent(lineId)}/Arrivals/${encodeURIComponent(stopPointId)}`
  );
  return data ?? [];
}

// Major interchanges are searched/returned as a multi-modal "HUB" StopPoint (e.g. Tottenham
// Hale's HUBTOM, combining bus/national-rail/tube), but the topology data we key our lines cache
// by (Line/Route/Sequence) only ever uses the underlying per-mode StopPoint id. Resolve a hub id
// down to its tube child so lookups against that cache — and later Arrivals calls — line up. A
// plain per-mode id (the common case) is returned unchanged.
export async function resolveTubeStopPointId(client: AxiosInstance, id: string): Promise<string> {
  if (!id.startsWith('HUB')) return id;

  const { data } = await client.get<TflStopPointDetail>(`/StopPoint/${encodeURIComponent(id)}`);
  const tubeChild = (data.children ?? []).find((child) => child.modes?.includes('tube'));
  return tubeChild?.id ?? id;
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
