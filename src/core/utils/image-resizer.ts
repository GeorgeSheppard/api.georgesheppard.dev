import sharp from 'sharp';

// Bookcase photos are typically full-resolution phone camera shots (several MB each) even
// though they're only ever displayed as small profile thumbnails or fed to OpenAI vision for
// spine text extraction — neither needs anywhere near the original resolution. Capping the
// longest side and re-encoding as JPEG cuts a ~5MB photo down to a few hundred KB with no
// visible loss for either use case.
const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 82;

export interface ResizedImage {
  buffer: Buffer;
  contentType: string;
}

export async function resizeAndCompressImage(data: Buffer): Promise<ResizedImage> {
  const buffer = await sharp(data)
    .rotate() // apply EXIF orientation before it gets stripped, so photos stay right-side up
    .resize({
      width: MAX_DIMENSION,
      height: MAX_DIMENSION,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
    .toBuffer();

  return { buffer, contentType: 'image/jpeg' };
}
