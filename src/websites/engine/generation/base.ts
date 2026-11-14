import { GetObjectCommand, type S3Client } from '@aws-sdk/client-s3';
import JSZip from 'jszip';
import { config } from '@config/index.js';
import { readJobMeta } from './job-meta.js';
import type { EngineJobMeta } from '../types.js';
import type { Files } from './types.js';

const BINARY = /\.(png|ogg|jpg|jpeg|gif|mp3|wav)$/i;

export interface BaseProject {
  meta: EngineJobMeta;
  files: Files;
}

export async function loadBaseProject(s3: S3Client, prefix: string): Promise<BaseProject> {
  const meta = await readJobMeta(s3, prefix);
  const res = await s3.send(
    new GetObjectCommand({ Bucket: config.S3_BUCKET_NAME, Key: `${prefix}source.zip` })
  );
  const zip = await JSZip.loadAsync((await res.Body?.transformToByteArray()) ?? new Uint8Array());
  const files: Files = {};
  for (const [name, entry] of Object.entries(zip.files)) {
    if (entry.dir) continue;
    files[name] = BINARY.test(name) ? await entry.async('nodebuffer') : await entry.async('string');
  }
  return { meta, files };
}
