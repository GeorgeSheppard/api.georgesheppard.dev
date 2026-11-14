import { OpenAPIHono } from '@hono/zod-openapi';
import { config } from '@config/index.js';
import { createSiloJob, QueueFullError } from './endpoints/create-job/create-job.js';
import { createJobRoute } from './endpoints/create-job/create-job-definition.js';
import { getSiloJob } from './endpoints/get-job/get-job.js';
import { getJobRoute } from './endpoints/get-job/get-job-definition.js';
import { siloOriginGuard } from './origin.js';

export function registerRoutes(app: OpenAPIHono) {
  app.use('/silo/*', siloOriginGuard);

  app.openapi(createJobRoute, async (c) => {
    try {
      const result = await createSiloJob(
        c.get('databaseClient'),
        c.get('queueClient'),
        c.req.valid('json'),
        config.SILO_MAX_QUEUED_JOBS
      );
      return c.json(result, 202);
    } catch (e) {
      if (e instanceof QueueFullError) return c.json({ error: e.message }, 429);
      throw e;
    }
  });

  app.openapi(getJobRoute, async (c) => {
    const job = await getSiloJob(c.get('databaseClient'), c.req.valid('param').id);
    return job ? c.json(job, 200) : c.json({ error: 'Job not found' }, 404);
  });
}
