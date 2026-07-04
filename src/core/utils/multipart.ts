import { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { convertHeicToJpeg, isHeicFile } from './heic-converter.js';

export interface UploadedFile {
  filename: string;
  mimetype: string;
  data: Buffer;
}

export const MAX_UPLOAD_SIZE_BYTES = 50 * 1024 * 1024;

export async function parseMultipartFiles(
  c: Context,
  fieldName: string,
  maxSize = MAX_UPLOAD_SIZE_BYTES
): Promise<UploadedFile[]> {
  const formData = await c.req.formData();
  const files: UploadedFile[] = [];

  for (const [key, value] of formData.entries()) {
    if (key === fieldName && value instanceof File) {
      if (value.size > maxSize) {
        throw new HTTPException(400, {
          message: `File too large: ${value.size} bytes (max: ${maxSize})`,
        });
      }

      let data: Buffer = Buffer.from(await value.arrayBuffer());
      let mimetype = value.type;

      if (isHeicFile(mimetype, value.name)) {
        data = await convertHeicToJpeg(data);
        mimetype = 'image/jpeg';
      }

      files.push({ filename: value.name, mimetype, data });
    }
  }

  return files;
}
