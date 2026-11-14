import { PutObjectCommand, type S3Client } from '@aws-sdk/client-s3';
import { config } from '@config/index.js';
import type { DatabaseClient } from '@core/database/client.js';
import { logger } from '@core/telemetry/logger.js';
import { getJob, updateJob } from '../repository.js';
import { runAgent } from './agent.js';
import { buildArtifacts } from './artifacts.js';
import * as C from './config.js';
import type { Builder, ModelClient } from './types.js';

export interface ProcessJobDeps {
  databaseClient: DatabaseClient;
  s3Client: S3Client;
  modelClient: ModelClient;
  builder: Builder;
  model?: string;
}

export const jobPrefix = (jobId: string) => `silo/${jobId}/`;

export async function processSiloJob(jobId: string, deps: ProcessJobDeps): Promise<void> {
  const { databaseClient, s3Client } = deps;
  const job = await getJob(databaseClient, jobId);
  if (!job || job.status !== 'queued') return;

  const logs: string[] = [];
  const log = (message: string) => {
    logs.push(message);
    updateJob(databaseClient, jobId, { logs: [...logs] }).catch((e: unknown) =>
      logger.warn('Failed to persist silo job log', e)
    );
  };

  await updateJob(databaseClient, jobId, { status: 'running' });
  try {
    const out = await runAgent({
      client: deps.modelClient,
      builder: deps.builder,
      description: job.prompt,
      model: deps.model,
      log,
    });
    const prefix = jobPrefix(jobId);
    log('Uploading to storage…');
    const artifacts = await buildArtifacts(prefix, out.files, out.jar, out.meta.name);
    for (const a of artifacts) {
      await s3Client.send(
        new PutObjectCommand({
          Bucket: config.S3_BUCKET_NAME,
          Key: a.key,
          Body: a.body,
          ContentType: a.contentType,
        })
      );
    }
    await updateJob(databaseClient, jobId, {
      status: 'succeeded',
      logs,
      result: {
        pluginId: out.meta.pluginId,
        name: out.meta.name,
        summary: out.summary,
        mcVersion: C.MC_VERSION,
        loader: C.LOADER,
        s3Prefix: prefix,
      },
    });
  } catch (e) {
    logger.error('Silo job failed', e);
    await updateJob(databaseClient, jobId, {
      status: 'failed',
      logs,
      error: e instanceof Error ? e.message : 'Generation failed',
    });
  }
}
