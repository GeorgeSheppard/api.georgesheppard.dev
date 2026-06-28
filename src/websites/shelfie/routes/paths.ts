/**
 * CENTRALIZED ROUTE PATHS
 * All HTTP route paths defined here to prevent overlaps
 * Import these constants in route handler files
 * Using Hono's OpenAPI path format with curly braces
 */
export const ROUTES = {
  // Recommendations
  GET_RECOMMENDATION_BY_ID: '/api/recommendations/{id}',
  ADD_EMAIL: '/api/recommendations/add-email',
  DELETE_EMAIL: '/api/recommendations/delete-email',
  FROM_BOOKCASE: '/api/recommendations/from-bookcase',

  // Cron (Protected)
  QUEUE_DUE_RECOMMENDATIONS: '/api/queue-due-recommendations',
  REEXTRACT_RECURRING_BOOKS: '/api/reextract-recurring-books',
} as const;
