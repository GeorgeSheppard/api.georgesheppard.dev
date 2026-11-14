import { GetObjectCommand, PutObjectCommand, type S3Client } from '@aws-sdk/client-s3';
import { config } from '@config/index.js';
import type { EngineJobMeta } from '../types.js';

const metaKey = (prefix: string) => `${prefix}meta.json`;

export async function writeJobMeta(
  s3: S3Client,
  prefix: string,
  meta: EngineJobMeta
): Promise<void> {
  await s3.send(
    new PutObjectCommand({
      Bucket: config.S3_BUCKET_NAME,
      Key: metaKey(prefix),
      Body: JSON.stringify(meta),
      ContentType: 'application/json',
    })
  );
}

export async function readJobMeta(s3: S3Client, prefix: string): Promise<EngineJobMeta> {
  const res = await s3.send(
    new GetObjectCommand({ Bucket: config.S3_BUCKET_NAME, Key: metaKey(prefix) })
  );
  return JSON.parse((await res.Body?.transformToString()) ?? '{}') as EngineJobMeta;
}
