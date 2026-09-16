import { describe, it, expect } from 'vitest';
import sharp from 'sharp';
import { createThumbnail } from './image-thumbnail.js';

async function makePng(width: number, height: number): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 3, background: { r: 100, g: 150, b: 200 } },
  })
    .png()
    .toBuffer();
}

describe('createThumbnail', () => {
  it('downsizes an oversized image and re-encodes it as a smaller JPEG', async () => {
    const original = await makePng(3000, 2000);

    const { buffer, contentType } = await createThumbnail(original);

    expect(contentType).toBe('image/jpeg');
    const metadata = await sharp(buffer).metadata();
    expect(metadata.format).toBe('jpeg');
    expect(metadata.width).toBeLessThanOrEqual(640);
    expect(metadata.height).toBeLessThanOrEqual(640);
    expect(buffer.length).toBeLessThan(original.length);
  });

  it('preserves aspect ratio while capping the longest side', async () => {
    const original = await makePng(3200, 1600);

    const { buffer } = await createThumbnail(original);

    const metadata = await sharp(buffer).metadata();
    expect(metadata.width).toBe(640);
    expect(metadata.height).toBe(320);
  });

  it('does not upscale an image already smaller than the max dimension', async () => {
    const original = await makePng(400, 300);

    const { buffer } = await createThumbnail(original);

    const metadata = await sharp(buffer).metadata();
    expect(metadata.width).toBe(400);
    expect(metadata.height).toBe(300);
  });
});
