/**
 * Post-process OpenAPI spec to extract inline schemas and move them to components/schemas
 * This ensures Orval generates properly typed interfaces instead of inline types
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface OpenAPISpec {
  components?: {
    schemas?: Record<string, unknown>;
  };
  paths?: Record<string, any>;
}

const specPath = path.resolve(__dirname, '../generated/openapi/georgesheppard-spec.json');
const spec: OpenAPISpec = JSON.parse(fs.readFileSync(specPath, 'utf-8'));

// Schemas to extract - these should be moved to components/schemas
const schemasToExtract: Record<string, any> = {
  Quantity: {
    type: 'object',
    properties: {
      unit: {
        type: 'string',
        enum: ['none', 'mL', 'L', 'g', 'kg', 'cup', 'tsp', 'tbsp', 'quantity'],
        description: 'Unit of measurement',
      },
      value: {
        type: 'number',
        description: 'Numeric value',
      },
    },
    required: ['unit'],
  },
  Ingredient: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        description: 'Ingredient name',
      },
      quantity: {
        $ref: '#/components/schemas/Quantity',
      },
    },
    required: ['name', 'quantity'],
  },
  Instruction: {
    type: 'object',
    properties: {
      text: {
        type: 'string',
        description: 'Instruction text',
      },
      optional: {
        type: 'boolean',
        description: 'Whether this step is optional',
      },
    },
    required: ['text'],
  },
  Image: {
    type: 'object',
    properties: {
      timestamp: {
        type: 'number',
        description: 'Image timestamp',
      },
      key: {
        type: 'string',
        description: 'S3 object key',
      },
    },
    required: ['timestamp', 'key'],
  },
  RecipeComponent: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        description: 'Component name',
      },
      uuid: {
        type: 'string',
        format: 'uuid',
        description: 'Component UUID',
      },
      ingredients: {
        type: 'array',
        items: {
          $ref: '#/components/schemas/Ingredient',
        },
        description: 'List of ingredients',
      },
      instructions: {
        type: 'array',
        items: {
          $ref: '#/components/schemas/Instruction',
        },
        description: 'List of instructions',
      },
      storeable: {
        type: 'boolean',
        description: 'Whether component can be made ahead',
      },
      servings: {
        type: 'number',
        description: 'Number of servings',
      },
    },
    required: ['name', 'uuid', 'ingredients', 'instructions'],
  },
  Recipe: {
    type: 'object',
    properties: {
      uuid: {
        type: 'string',
        format: 'uuid',
        description: 'Recipe UUID',
      },
      name: {
        type: 'string',
        description: 'Recipe name',
      },
      description: {
        type: 'string',
        description: 'Recipe description',
      },
      images: {
        type: 'array',
        items: {
          $ref: '#/components/schemas/Image',
        },
        description: 'Recipe images',
      },
      components: {
        type: 'array',
        items: {
          $ref: '#/components/schemas/RecipeComponent',
        },
        description: 'Recipe components',
      },
    },
    required: ['uuid', 'name', 'description', 'images', 'components'],
  },
  UpdateRecipeRequest: {
    type: 'object',
    properties: {
      uuid: {
        type: 'string',
        format: 'uuid',
        description: 'Recipe UUID (omit to generate new)',
      },
      name: {
        type: 'string',
        description: 'Recipe name',
      },
      description: {
        type: 'string',
        description: 'Recipe description',
      },
      images: {
        type: 'array',
        items: {
          $ref: '#/components/schemas/Image',
        },
        description: 'Recipe images',
      },
      components: {
        type: 'array',
        items: {
          $ref: '#/components/schemas/RecipeComponent',
        },
        description: 'Recipe components',
      },
    },
    required: ['name', 'description', 'images', 'components'],
  },
  MealPlanEntry: {
    type: 'object',
    properties: {
      componentId: {
        type: 'string',
        format: 'uuid',
        description: 'Recipe component UUID',
      },
      servings: {
        type: 'number',
        description: 'Number of servings',
      },
    },
    required: ['componentId', 'servings'],
  },
  MealPlanDay: {
    type: 'object',
    additionalProperties: {
      type: 'array',
      items: {
        $ref: '#/components/schemas/MealPlanEntry',
      },
      description: 'Array of component servings for this recipe',
    },
    description: 'Meal plan for a single day, keyed by recipe UUID',
  },
  MealPlan: {
    type: 'object',
    additionalProperties: {
      $ref: '#/components/schemas/MealPlanDay',
    },
    description: 'Complete meal plan, keyed by date string',
  },
};

// Initialize components/schemas if it doesn't exist
if (!spec.components) {
  spec.components = {};
}
if (!spec.components.schemas) {
  spec.components.schemas = {};
}

// Add all schemas to components/schemas
Object.assign(spec.components.schemas, schemasToExtract);

// Function to replace inline schemas with $ref
function replaceInlineSchemas(obj: any, path: string[] = []): any {
  if (Array.isArray(obj)) {
    return obj.map((item, idx) => replaceInlineSchemas(item, [...path, `[${idx}]`]));
  }

  if (typeof obj !== 'object' || obj === null) {
    return obj;
  }

  const result = { ...obj };

  // Skip if already a $ref
  if (result.$ref) {
    return result;
  }

  // Replace inline MealPlanEntry (nested in meal-plan endpoints)
  if (
    result.type === 'object' &&
    result.properties?.componentId?.format === 'uuid' &&
    result.properties?.servings?.type === 'number' &&
    Object.keys(result.properties || {}).length === 2
  ) {
    return { $ref: '#/components/schemas/MealPlanEntry' };
  }

  // Replace inline MealPlanDay (double-nested additionalProperties for meal plan)
  if (
    result.type === 'object' &&
    result.additionalProperties?.type === 'array' &&
    (result.additionalProperties?.items?.$ref === '#/components/schemas/MealPlanEntry' ||
      result.additionalProperties?.items?.properties?.componentId)
  ) {
    return { $ref: '#/components/schemas/MealPlanDay' };
  }

  // Replace inline MealPlan (top-level meal-plan endpoint)
  if (
    result.type === 'object' &&
    result.additionalProperties?.type === 'object' &&
    (result.additionalProperties?.additionalProperties?.type === 'array' ||
      result.additionalProperties?.$ref === '#/components/schemas/MealPlanDay')
  ) {
    return { $ref: '#/components/schemas/MealPlan' };
  }

  // Replace inline Recipe schemas with $ref
  if (
    result.type === 'object' &&
    result.properties?.uuid?.format === 'uuid' &&
    result.properties?.name?.type === 'string' &&
    result.properties?.description?.type === 'string' &&
    result.properties?.images?.type === 'array' &&
    result.properties?.components?.type === 'array' &&
    result.required?.includes('uuid')
  ) {
    return { $ref: '#/components/schemas/Recipe' };
  }

  // Replace inline UpdateRecipeRequest (similar to Recipe but uuid is optional)
  if (
    result.type === 'object' &&
    result.properties?.uuid?.format === 'uuid' &&
    result.properties?.name?.type === 'string' &&
    result.properties?.description?.type === 'string' &&
    result.properties?.images?.type === 'array' &&
    result.properties?.components?.type === 'array' &&
    !result.required?.includes('uuid')
  ) {
    return { $ref: '#/components/schemas/UpdateRecipeRequest' };
  }

  // Replace inline RecipeComponent schemas with $ref
  if (
    result.type === 'object' &&
    result.properties?.uuid?.format === 'uuid' &&
    result.properties?.ingredients?.type === 'array' &&
    result.properties?.instructions?.type === 'array' &&
    result.properties?.name?.type === 'string' &&
    !result.properties?.images // distinguish from Recipe
  ) {
    return { $ref: '#/components/schemas/RecipeComponent' };
  }

  // Replace inline Ingredient schemas
  if (
    result.type === 'object' &&
    result.properties?.name?.type === 'string' &&
    (result.properties?.quantity?.$ref ||
      (result.properties?.quantity?.type === 'object' &&
        result.properties?.quantity?.properties?.unit)) &&
    !result.properties?.uuid // distinguish from other objects
  ) {
    return { $ref: '#/components/schemas/Ingredient' };
  }

  // Replace inline Instruction schemas
  if (
    result.type === 'object' &&
    result.properties?.text?.type === 'string' &&
    result.properties?.optional?.type === 'boolean' &&
    Object.keys(result.properties || {}).length === 2 &&
    !result.properties?.uuid
  ) {
    return { $ref: '#/components/schemas/Instruction' };
  }

  // Replace inline Image schemas
  if (
    result.type === 'object' &&
    result.properties?.timestamp?.type === 'number' &&
    result.properties?.key?.type === 'string' &&
    Object.keys(result.properties || {}).length === 2
  ) {
    return { $ref: '#/components/schemas/Image' };
  }

  // Recursively process all properties
  for (const key in result) {
    if (key !== '$ref' && result[key] !== null && typeof result[key] === 'object') {
      result[key] = replaceInlineSchemas(result[key], [...path, key]);
    }
  }

  return result;
}

// Process all paths
if (spec.paths) {
  for (const pathname in spec.paths) {
    spec.paths[pathname] = replaceInlineSchemas(spec.paths[pathname]);
  }
}

// Write the updated spec
fs.writeFileSync(specPath, JSON.stringify(spec, null, 2) + '\n');
console.log('✓ Extracted schemas to components/schemas');
console.log(`✓ Added ${Object.keys(schemasToExtract).length} reusable schema definitions`);
