import { describe, it, expect, vi } from 'vitest';
import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';

vi.mock('./heic-converter.js', () => ({
  isHeicFile: (mimetype: string, filename: string) =>
    mimetype === 'image/heic' || filename.toLowerCase().endsWith('.heic'),
  convertHeicToJpeg: vi.fn(async () => Buffer.from('converted-jpeg-data')),
}));

const { parseMultipartFiles, MAX_UPLOAD_SIZE_BYTES } = await import('./multipart.js');
const { convertHeicToJpeg } = await import('./heic-converter.js');

function contextWithFormData(formData: FormData): Context {
  return { req: { formData: async () => formData } } as unknown as Context;
}

describe('parseMultipartFiles', () => {
  it('parses matching files into UploadedFile entries', async () => {
    const formData = new FormData();
    formData.append('bookcase', new Blob([Buffer.from('data')], { type: 'image/jpeg' }), 'a.jpg');
    formData.append('other', new Blob([Buffer.from('ignored')]), 'b.jpg');

    const files = await parseMultipartFiles(contextWithFormData(formData), 'bookcase');

    expect(files).toEqual([
      { filename: 'a.jpg', mimetype: 'image/jpeg', data: Buffer.from('data') },
    ]);
  });

  it('throws a 400 HTTPException when a file exceeds the max size', async () => {
    const formData = new FormData();
    formData.append('bookcase', new Blob([Buffer.from('data')], { type: 'image/jpeg' }), 'a.jpg');

    await expect(parseMultipartFiles(contextWithFormData(formData), 'bookcase', 1)).rejects.toThrow(
      HTTPException
    );
  });

  it('converts HEIC files to JPEG', async () => {
    const formData = new FormData();
    formData.append(
      'bookcase',
      new Blob([Buffer.from('heic-bytes')], { type: 'image/heic' }),
      'a.heic'
    );

    const files = await parseMultipartFiles(contextWithFormData(formData), 'bookcase');

    expect(convertHeicToJpeg).toHaveBeenCalledWith(Buffer.from('heic-bytes'));
    expect(files).toEqual([
      { filename: 'a.heic', mimetype: 'image/jpeg', data: Buffer.from('converted-jpeg-data') },
    ]);
  });

  it('defaults the max size to 50MB', () => {
    expect(MAX_UPLOAD_SIZE_BYTES).toBe(50 * 1024 * 1024);
  });
});
