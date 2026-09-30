import { AxiosInstance } from 'axios';

export interface AircraftPhoto {
  url: string;
  width: number;
  height: number;
  photographer: string;
  link: string;
}

interface PlanespottersRawThumbnail {
  src: string;
  size: { width: number; height: number };
}

interface PlanespottersRawPhoto {
  thumbnail_large: PlanespottersRawThumbnail;
  link: string;
  photographer: string;
}

interface PlanespottersPhotosResponse {
  photos?: PlanespottersRawPhoto[];
}

// Looks up by the transponder address rather than registration, since that's always known and
// identifies the exact airframe.
export async function getPhotoByIcao24(
  client: AxiosInstance,
  icao24: string
): Promise<AircraftPhoto | null> {
  const { data } = await client.get<PlanespottersPhotosResponse>(
    `/photos/hex/${encodeURIComponent(icao24)}`
  );
  const photo = data.photos?.[0];
  if (!photo) {
    return null;
  }
  return {
    url: photo.thumbnail_large.src,
    width: photo.thumbnail_large.size.width,
    height: photo.thumbnail_large.size.height,
    photographer: photo.photographer,
    link: photo.link,
  };
}
