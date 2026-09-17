import { OpenAPIHono } from '@hono/zod-openapi';
import { registerGetByIdRoute } from './routes/recommendations/get-by-id.js';
import { registerAddEmailRoute } from './routes/recommendations/add-email.js';
import { registerDeleteEmailRoute } from './routes/recommendations/delete-email.js';
import { registerFromBookcaseRoute } from './routes/recommendations/from-bookcase.js';
import { registerQueueCronRoute } from './routes/queue-cron.js';
import { registerReextractRecurringBooksRoute } from './routes/reextract-recurring-books.js';
import { registerGetProfileRoute } from './routes/profile/get-profile.js';
import { registerGetImageRoute } from './routes/profile/get-image.js';
import { registerAddImagesRoute } from './routes/profile/add-images.js';
import { registerDeleteImageRoute } from './routes/profile/delete-image.js';
import { registerUpdatePreferencesRoute } from './routes/profile/update-preferences.js';
import { registerGetRecentRecommendationsRoute } from './routes/profile/get-recent-recommendations.js';

export function registerShelfieRoutes(app: OpenAPIHono) {
  registerGetByIdRoute(app);
  registerAddEmailRoute(app);
  registerDeleteEmailRoute(app);
  registerFromBookcaseRoute(app);
  registerQueueCronRoute(app);
  registerReextractRecurringBooksRoute(app);
  registerGetProfileRoute(app);
  registerGetImageRoute(app);
  registerAddImagesRoute(app);
  registerDeleteImageRoute(app);
  registerUpdatePreferencesRoute(app);
  registerGetRecentRecommendationsRoute(app);
}
