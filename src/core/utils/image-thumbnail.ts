import sharp from 'sharp';

// Originals are kept at full resolution — the OpenAI vision extraction needs that detail to
// read book spines reliably — but the profile page only ever displays them as small squares,
// so there's no reason to ship the full multi-MB original there too.
const THUMBNAIL_MAX_DIMENSION = 640;
const THUMBNAIL_JPEG_QUALITY = 80;

export interface Thumbnail {
  buffer: Buffer;
  contentType: string;
}

export async function createThumbnail(data: Buffer): Promise<Thumbnail> {
  const buffer = await sharp(data)
    .rotate() // apply EXIF orientation before it gets stripped, so photos stay right-side up
    .resize({
      width: THUMBNAIL_MAX_DIMENSION,
      height: THUMBNAIL_MAX_DIMENSION,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .jpeg({ quality: THUMBNAIL_JPEG_QUALITY, mozjpeg: true })
    .toBuffer();

  return { buffer, contentType: 'image/jpeg' };
}
