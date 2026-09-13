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

  // Profile
  GET_PROFILE: '/api/profile/{requestId}',
  GET_PROFILE_IMAGE: '/api/profile/images/{imageId}',
  ADD_PROFILE_IMAGES: '/api/profile/{requestId}/images',
  DELETE_PROFILE_IMAGE: '/api/profile/{requestId}/images/{imageId}',
  UPDATE_PROFILE_PREFERENCES: '/api/profile/{requestId}/preferences',

  // Cron (Protected)
  QUEUE_DUE_RECOMMENDATIONS: '/api/queue-due-recommendations',
  REEXTRACT_RECURRING_BOOKS: '/api/reextract-recurring-books',
} as const;
