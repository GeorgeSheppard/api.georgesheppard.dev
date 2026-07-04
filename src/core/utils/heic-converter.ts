import convert from 'heic-convert';

const HEIC_MIME_TYPES = new Set(['image/heic', 'image/heif']);
const HEIC_EXTENSION_PATTERN = /\.(heic|heif)$/i;

export function isHeicFile(mimetype: string, filename: string): boolean {
  return HEIC_MIME_TYPES.has(mimetype.toLowerCase()) || HEIC_EXTENSION_PATTERN.test(filename);
}

export async function convertHeicToJpeg(data: Buffer): Promise<Buffer> {
  const output = await convert({ buffer: data, format: 'JPEG', quality: 0.9 });
  return Buffer.from(output);
}
