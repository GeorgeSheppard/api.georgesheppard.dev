import { PutObjectCommand, type S3Client } from '@aws-sdk/client-s3';
import { config } from '@config/index.js';
import type { DatabaseClient } from '@core/database/client.js';
import type { EngineJob } from '@core/queue/client.js';
import { logger } from '@core/telemetry/logger.js';
import { getJob, updateJob } from '../repository.js';
import { runAgent } from './agent.js';
import { buildArtifacts } from './artifacts.js';
import * as C from './config.js';
import { writeJobMeta } from './job-meta.js';
import type { Builder, ModelClient } from './types.js';
import { provisionServer, type ProvisionDeps } from '../hosting/provision.js';
import type { EngineJobMeta } from '../types.js';

export interface ProcessJobDeps {
  databaseClient: DatabaseClient;
  s3Client: S3Client;
  modelClient: ModelClient;
  builder: Builder;
  model?: string;
  hosting: Pick<ProvisionDeps, 'provider' | 'maxServers'>;
}

export const jobPrefix = (jobId: string) => `engine/${jobId}/`;

export async function processEngineJob(
  { jobId, prompt }: EngineJob,
  deps: ProcessJobDeps
): Promise<void> {
  const { databaseClient, s3Client } = deps;
  const job = await getJob(databaseClient, jobId);
  if (!job || job.status !== 'queued') return;

  const jobLogger = logger.child({ 'engine.job_id': jobId });
  await updateJob(databaseClient, jobId, { status: 'running' });
  jobLogger.info('Engine job started');
  try {
    const out = await runAgent({
      client: deps.modelClient,
      builder: deps.builder,
      description: prompt,
      model: deps.model,
      log: (message) => jobLogger.info(message),
    });
    const prefix = jobPrefix(jobId);
    jobLogger.info('Uploading to storage');
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
    const meta: EngineJobMeta = {
      pluginId: out.meta.pluginId,
      name: out.meta.name,
      summary: out.summary,
      mcVersion: C.MC_VERSION,
      loader: C.LOADER,
      artifacts: artifacts.map((a) => a.key.slice(prefix.length)),
    };
    await writeJobMeta(s3Client, prefix, meta);
    await updateJob(databaseClient, jobId, { s3Prefix: prefix });
    jobLogger.info('Starting server');
    await provisionServer(jobId, prefix, meta, { databaseClient, s3Client, ...deps.hosting });
    await updateJob(databaseClient, jobId, { status: 'succeeded' });
    jobLogger.info('Engine job succeeded');
  } catch (e) {
    jobLogger.error('Engine job failed', e);
    await updateJob(databaseClient, jobId, {
      status: 'failed',
      error: e instanceof Error ? e.message : 'Generation failed',
    });
  }
}
