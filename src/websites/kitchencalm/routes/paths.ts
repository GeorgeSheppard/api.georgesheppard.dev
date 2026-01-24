export const ROUTES = {
  // Recipes
  GET_RECIPES: '/api/kitchencalm/recipes',
  UPDATE_RECIPE: '/api/kitchencalm/recipes',
  DELETE_RECIPE: '/api/kitchencalm/recipes/{id}',
  CREATE_SHARED_RECIPE: '/api/kitchencalm/recipes/shared',
  GET_SHARED_RECIPE: '/api/kitchencalm/recipes/shared/{shareId}',

  // Meal Plan
  GET_MEAL_PLAN: '/api/kitchencalm/meal-plan',
  UPDATE_MEAL_PLAN: '/api/kitchencalm/meal-plan',

  // Storage (S3)
  GET_SIGNED_URL: '/api/kitchencalm/storage/{key}',
  DELETE_STORAGE: '/api/kitchencalm/storage/{key}',
  GET_SIGNED_PUT_URL: '/api/kitchencalm/storage/upload',
} as const;
