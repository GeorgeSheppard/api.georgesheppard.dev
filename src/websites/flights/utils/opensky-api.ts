import { AxiosInstance } from 'axios';

export interface OpenSkyState {
  icao24: string;
  callsign: string | null;
  originCountry: string;
  longitude: number | null;
  latitude: number | null;
  baroAltitudeMeters: number | null;
  onGround: boolean;
  velocityMetersPerSecond: number | null;
  trueTrackDegrees: number | null;
  verticalRateMetersPerSecond: number | null;
  geoAltitudeMeters: number | null;
}

// OpenSky returns each state vector as a fixed-order tuple rather than an object, so field names
// have to be assigned positionally per their documented schema.
type OpenSkyStateVector = [
  string, // icao24
  string | null, // callsign
  string, // origin_country
  number | null, // time_position
  number, // last_contact
  number | null, // longitude
  number | null, // latitude
  number | null, // baro_altitude
  boolean, // on_ground
  number | null, // velocity
  number | null, // true_track
  number | null, // vertical_rate
  number[] | null, // sensors
  number | null, // geo_altitude
  string | null, // squawk
  boolean, // spi
  number, // position_source
];

interface OpenSkyStatesResponse {
  time: number;
  states: OpenSkyStateVector[] | null;
}

function toOpenSkyState(vector: OpenSkyStateVector): OpenSkyState {
  return {
    icao24: vector[0],
    callsign: vector[1]?.trim() || null,
    originCountry: vector[2],
    longitude: vector[5],
    latitude: vector[6],
    baroAltitudeMeters: vector[7],
    onGround: vector[8],
    velocityMetersPerSecond: vector[9],
    trueTrackDegrees: vector[10],
    verticalRateMetersPerSecond: vector[11],
    geoAltitudeMeters: vector[13],
  };
}

export interface BoundingBox {
  minLatitude: number;
  maxLatitude: number;
  minLongitude: number;
  maxLongitude: number;
}

export async function getStatesInBoundingBox(
  client: AxiosInstance,
  boundingBox: BoundingBox
): Promise<OpenSkyState[]> {
  const { data } = await client.get<OpenSkyStatesResponse>('/states/all', {
    params: {
      lamin: boundingBox.minLatitude,
      lamax: boundingBox.maxLatitude,
      lomin: boundingBox.minLongitude,
      lomax: boundingBox.maxLongitude,
    },
  });
  return (data.states ?? []).map(toOpenSkyState);
}

export async function getStateByIcao24(
  client: AxiosInstance,
  icao24: string
): Promise<OpenSkyState | null> {
  const { data } = await client.get<OpenSkyStatesResponse>('/states/all', {
    params: { icao24: icao24.toLowerCase() },
  });
  const [state] = data.states ?? [];
  return state ? toOpenSkyState(state) : null;
}

// OpenSky can't filter by callsign, so this fetches every tracked aircraft worldwide. That costs
// several times the API credits of an area query, so only use it for one-off lookups.
export async function getAllStates(client: AxiosInstance): Promise<OpenSkyState[]> {
  const { data } = await client.get<OpenSkyStatesResponse>('/states/all');
  return (data.states ?? []).map(toOpenSkyState);
}
