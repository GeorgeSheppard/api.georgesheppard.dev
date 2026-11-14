import { GetObjectCommand, type S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { config } from '@config/index.js';
import type { DatabaseClient } from '@core/database/client.js';
import { logger } from '@core/telemetry/logger.js';
import {
  countActiveServers,
  getActiveServersForProject,
  insertServer,
  updateServer,
} from '../repository.js';
import { destroyServer } from './sweeper.js';
import type { EngineJobMeta } from '../types.js';
import { cloudInit } from './cloud-init.js';
import type { HostingProvider } from './hetzner-client.js';

export interface ProvisionDeps {
  databaseClient: DatabaseClient;
  s3Client: S3Client;
  provider: HostingProvider;
  maxServers: number;
}

const DOWNLOAD_TTL_SECONDS = 3600;

export const serverName = (jobId: string) => `engine-${jobId.slice(0, 8)}`;

export async function provisionServer(
  jobId: string,
  projectId: string,
  prefix: string,
  meta: EngineJobMeta,
  { databaseClient, s3Client, provider, maxServers }: ProvisionDeps
): Promise<string> {
  if ((await countActiveServers(databaseClient, projectId)) >= maxServers) {
    throw new Error('Too many servers are running right now, try again later');
  }
  const files = await Promise.all(
    meta.artifacts
      .filter((name) => name !== 'source.zip')
      .map(async (name) => ({
        name,
        url: await getSignedUrl(
          s3Client,
          new GetObjectCommand({ Bucket: config.S3_BUCKET_NAME, Key: `${prefix}${name}` }),
          { expiresIn: DOWNLOAD_TTL_SECONDS }
        ),
      }))
  );
  const previous = await getActiveServersForProject(databaseClient, projectId);
  const row = await insertServer(databaseClient, { jobId });
  try {
    const hosted = await provider.createServer({
      name: serverName(jobId),
      userData: cloudInit(files),
    });
    await updateServer(databaseClient, row.id, { hetznerId: hosted.id, ip: hosted.ip ?? null });
  } catch (e) {
    await updateServer(databaseClient, row.id, { status: 'failed' });
    throw e;
  }
  // An iteration replaces the project's running server (its address and world start fresh)
  for (const old of previous) {
    await destroyServer({ databaseClient, provider }, old, 'replaced by a newer version').catch(
      (e: unknown) =>
        logger
          .child({ 'engine.job_id': jobId })
          .error('Failed to delete the replaced server, the sweeper will retry on idle', e)
    );
  }
  return row.id;
}
