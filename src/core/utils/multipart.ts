import { Context } from 'hono';

export interface UploadedFile {
  filename: string;
  mimetype: string;
  data: Buffer;
}

export async function parseMultipartFiles(
  c: Context,
  fieldName: string,
  maxSize = 1073741824
): Promise<UploadedFile[]> {
  const formData = await c.req.formData();
  const files: UploadedFile[] = [];

  for (const [key, value] of formData.entries()) {
    if (key === fieldName && value instanceof File) {
      if (value.size > maxSize) {
        throw new Error(`File too large: ${value.size} bytes (max: ${maxSize})`);
      }

      files.push({
        filename: value.name,
        mimetype: value.type,
        data: Buffer.from(await value.arrayBuffer()),
      });
    }
  }

  return files;
}
