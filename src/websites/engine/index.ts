import { OpenAPIHono } from '@hono/zod-openapi';
import { config } from '@config/index.js';
import { createEngineJob, CreateJobError } from './endpoints/create-job/create-job.js';
import { createJobRoute } from './endpoints/create-job/create-job-definition.js';
import { getEngineJob } from './endpoints/get-job/get-job.js';
import { getJobRoute } from './endpoints/get-job/get-job-definition.js';
import { listEngineServers } from './endpoints/list-servers/list-servers.js';
import { listServersRoute } from './endpoints/list-servers/list-servers-definition.js';
import { deleteEngineServer } from './endpoints/delete-server/delete-server.js';
import { deleteServerRoute } from './endpoints/delete-server/delete-server-definition.js';
import { createSweepDeps } from './hosting/provider.js';
import { engineOriginGuard } from './origin.js';

export function registerRoutes(app: OpenAPIHono) {
  app.use('/engine/*', engineOriginGuard);

  app.openapi(createJobRoute, async (c) => {
    try {
      const result = await createEngineJob(
        c.get('databaseClient'),
        c.get('queueClient'),
        c.req.valid('json'),
        { maxQueued: config.ENGINE_MAX_QUEUED_JOBS, maxServers: config.ENGINE_MAX_SERVERS }
      );
      return c.json(result, 202);
    } catch (e) {
      if (e instanceof CreateJobError) return c.json({ error: e.message }, e.status);
      throw e;
    }
  });

  app.openapi(getJobRoute, async (c) => {
    const job = await getEngineJob(
      c.get('databaseClient'),
      c.get('s3Client').client,
      c.req.valid('param').id
    );
    return job ? c.json(job, 200) : c.json({ error: 'Job not found' }, 404);
  });

  app.openapi(listServersRoute, async (c) =>
    c.json(await listEngineServers(c.get('databaseClient')), 200)
  );

  app.openapi(deleteServerRoute, async (c) => {
    const deleted = await deleteEngineServer(
      createSweepDeps(c.get('databaseClient')),
      c.req.valid('param').id
    );
    return deleted
      ? c.json({ deleted: true as const }, 200)
      : c.json({ error: 'Server not found' }, 404);
  });
}
