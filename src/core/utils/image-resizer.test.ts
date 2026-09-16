import { describe, it, expect } from 'vitest';
import sharp from 'sharp';
import { resizeAndCompressImage } from './image-resizer.js';

async function makePng(width: number, height: number): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 3, background: { r: 100, g: 150, b: 200 } },
  })
    .png()
    .toBuffer();
}

describe('resizeAndCompressImage', () => {
  it('downsizes an oversized image and re-encodes it as a smaller JPEG', async () => {
    const original = await makePng(3000, 2000);

    const { buffer, contentType } = await resizeAndCompressImage(original);

    expect(contentType).toBe('image/jpeg');
    const metadata = await sharp(buffer).metadata();
    expect(metadata.format).toBe('jpeg');
    expect(metadata.width).toBeLessThanOrEqual(1600);
    expect(metadata.height).toBeLessThanOrEqual(1600);
    expect(buffer.length).toBeLessThan(original.length);
  });

  it('preserves aspect ratio while capping the longest side', async () => {
    const original = await makePng(3200, 1600);

    const { buffer } = await resizeAndCompressImage(original);

    const metadata = await sharp(buffer).metadata();
    expect(metadata.width).toBe(1600);
    expect(metadata.height).toBe(800);
  });

  it('does not upscale an image already smaller than the max dimension', async () => {
    const original = await makePng(400, 300);

    const { buffer } = await resizeAndCompressImage(original);

    const metadata = await sharp(buffer).metadata();
    expect(metadata.width).toBe(400);
    expect(metadata.height).toBe(300);
  });
});
