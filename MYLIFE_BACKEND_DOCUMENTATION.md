# MyLife/KitchenCalm Backend Documentation

**Project:** MyLife - Recipe Management & Meal Planning Application
**Framework:** Next.js 12 + tRPC (TypeScript RPC)
**Stack:** React 18 + Next.js (full-stack), AWS services, OpenAI
**Database:** AWS DynamoDB (NoSQL)
**Storage:** AWS S3
**Authentication:** AWS Cognito + NextAuth.js v4.3.1

---

## Table of Contents
1. [Project Structure](#project-structure)
2. [Environment Variables](#environment-variables)
3. [tRPC API Endpoints](#trpc-api-endpoints)
4. [AWS Services](#aws-services)
5. [Database Schema](#database-schema)
6. [Core Business Logic](#core-business-logic)
7. [Authentication Flow](#authentication-flow)
8. [Data Flow Examples](#data-flow-examples)

---

## Project Structure

```
MyLife/
├── server/                           # Backend API (tRPC)
│   ├── index.ts                     # tRPC router setup
│   ├── routers/
│   │   ├── recipes/
│   │   │   ├── index.ts             # Recipes router
│   │   │   ├── queries.ts           # Recipe queries
│   │   │   ├── mutations.ts         # Recipe mutations
│   │   │   └── validators/
│   │   │       └── recipe.ts        # Zod validation schema
│   │   ├── mealPlan/
│   │   │   ├── index.ts             # Meal plan router
│   │   │   ├── mutations.ts         # Meal plan mutations
│   │   │   └── validators/
│   │   │       └── mealPlan.ts      # Zod validation schema
│   │   └── s3/
│   │       └── index.ts             # S3 signed URLs router
│   └── middleware.ts                # tRPC middleware (auth context)
├── pages/
│   ├── api/
│   │   ├── trpc/[trpc].ts          # tRPC handler
│   │   └── auth/
│   │       ├── [...nextauth].ts    # NextAuth.js OAuth config
│   │       └── logout.ts           # Logout handler
│   ├── food/
│   │   ├── index.tsx               # Recipes list page
│   │   ├── [recipeUuid].tsx        # Recipe detail page
│   │   └── existingUpload.tsx      # Recipe upload page
│   └── _app.tsx                     # App wrapper (tRPC provider)
├── core/
│   ├── types/
│   │   ├── recipes.ts              # Recipe type definitions
│   │   └── meal_plan.ts            # Meal plan types
│   ├── dynamo/
│   │   └── dynamo_utilities.ts     # DynamoDB CRUD operations
│   ├── s3/
│   │   └── s3_utilities.ts         # S3 operations (get signed URLs, upload, delete)
│   ├── meal_plan/
│   │   └── meal_plan_utilities.ts  # Meal plan helper functions
│   ├── openai/
│   │   ├── recipe_uploader.ts      # GPT-3.5-turbo recipe parsing
│   │   └── prompts.ts              # OpenAI prompts
│   ├── recipes/
│   │   └── units.ts                # Ingredient unit definitions
│   └── aws/
│       └── config.ts               # AWS SDK configuration
├── foodAndGroups/
│   ├── food_foundation.csv         # Ingredient database
│   ├── food_legacy.csv             # Legacy ingredients
│   ├── foodsAndGroups_foundation.json
│   └── foodsAndGroups_legacy.json
├── components/                      # React components
├── styles/                          # SASS stylesheets
├── aws/
│   └── scripts/
│       ├── createDynamoDB.js       # DynamoDB table setup
│       ├── createS3Bucket.js       # S3 bucket setup
│       └── createCognitoUserPool.js # Cognito user pool setup
└── .env.local                       # Environment variables (local dev)
```

---

## Environment Variables

**Note:** All AWS-related variables have both dev and production versions (using `PROD` suffix for production).

### Required Environment Variables

#### **AWS DynamoDB**
| Variable | Type | Description | Example |
|----------|------|-------------|---------|
| `ENV_AWS_DYNAMO_REGION` | string | AWS region for DynamoDB | `eu-west-2` |
| `ENV_AWS_DYNAMO_NAME` | string | DynamoDB table name (dev) | `lifesitetable` |
| `ENV_AWS_DYNAMO_NAME_PROD` | string | DynamoDB table name (production) | `lifesitetableproduction` |
| `ENV_AWS_DYNAMO_ACCESS_KEY` | string | AWS access key ID | (AWS generated) |
| `ENV_AWS_DYNAMO_SECRET_ACCESS_KEY` | string | AWS secret access key | (AWS generated) |

#### **AWS S3**
| Variable | Type | Description | Example |
|----------|------|-------------|---------|
| `ENV_AWS_S3_REGION` | string | AWS region for S3 | `eu-west-2` |
| `ENV_AWS_S3_BUCKET_NAME` | string | S3 bucket name (dev) | `mylifebucket` |
| `ENV_AWS_S3_BUCKET_NAME_PROD` | string | S3 bucket name (production) | `mylifebucketproduction` |
| `ENV_AWS_S3_ACCESS_KEY` | string | AWS access key ID | (AWS generated) |
| `ENV_AWS_S3_SECRET_ACCESS_KEY` | string | AWS secret access key | (AWS generated) |

#### **AWS Cognito**
| Variable | Type | Description | Example |
|----------|------|-------------|---------|
| `ENV_AWS_COGNITO_REGION` | string | AWS region for Cognito | `us-east-1` |
| `ENV_AWS_COGNITO_USER_POOL_NAME` | string | Cognito user pool name | `mylifeuserpool` |
| `ENV_AWS_COGNITO_CLIENT_ID` | string | Cognito app client ID | `5a3siv7gvjhboglusenau7ro9d` |
| `ENV_AWS_COGNITO_CLIENT_SECRET` | string | Cognito app client secret | (AWS generated) |
| `ENV_AWS_COGNITO_CLIENT_ISSUER` | string | Cognito OAuth issuer URL | `https://cognito-idp.us-east-1.amazonaws.com/us-east-1_SgWpLDwvx` |
| `ENV_AWS_COGNITO_DOMAIN_URL` | string | Cognito domain for OAuth | `https://mylifeuserpooldomain.auth.us-east-1.amazoncognito.com` |

#### **Google OAuth** (Optional)
| Variable | Type | Description | Example |
|----------|------|-------------|---------|
| `GOOGLE_ID` | string | Google OAuth app ID | `297433794614-l11qgfas48b59mc0902bh9kqohesendo.apps.googleusercontent.com` |
| `GOOGLE_SECRET` | string | Google OAuth app secret | (Google generated) |

#### **NextAuth.js**
| Variable | Type | Description | Example |
|----------|------|-------------|---------|
| `NEXTAUTH_SECRET` | string | Secret for NextAuth session encryption | (random 32+ char string) |
| `NEXTAUTH_URL` | string | Application URL (auto-detected in production) | `http://localhost:3000` |

#### **OpenAI**
| Variable | Type | Description | Example |
|----------|------|-------------|---------|
| `ENV_OPENAI_SECRET_ACCESS_KEY` | string | OpenAI API key | `sk-...` |

#### **Redirect URLs**
| Variable | Type | Description | Example |
|----------|------|-------------|---------|
| `ENV_LOGIN_LOGOUT_REDIRECT_URL` | string | Redirect URL after login/logout (dev) | `http://localhost:3000` |
| `ENV_LOGIN_LOGOUT_REDIRECT_URL_PROD` | string | Redirect URL (production) | `https://my-life-nu.vercel.app` |

#### **Optional**
| Variable | Type | Description | Example |
|----------|------|-------------|---------|
| `DATABASE_URL` | string | PostgreSQL URL (noted but not used) | `postgresql://postgres:password@localhost:5432/kitchencalm` |

---

## tRPC API Endpoints

The API is built with **tRPC** (TypeScript Remote Procedure Call), which provides type-safe RPC over HTTP/WebSocket at the endpoint `/api/trpc/*`.

### Recipes Router

**Base Path:** `/api/trpc/recipes.*`

#### 1. **recipes.getRecipes**

Get all recipes for authenticated user.

**Authentication:** Required (JWT session)

**Input:** None

**Output:**
```typescript
Map<RecipeUuid, IRecipe>
```

**Response Example:**
```json
{
  "550e8400-e29b-41d4-a716-446655440000": {
    "uuid": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Pasta Carbonara",
    "description": "Classic Italian pasta dish",
    "images": [
      {
        "timestamp": 1704067200000,
        "key": "550e8400-e29b-41d4-a716-446655440000/pasta.jpg"
      }
    ],
    "components": [
      {
        "name": "Main Pasta",
        "uuid": "component-uuid",
        "ingredients": [
          {
            "name": "Spaghetti",
            "quantity": {
              "unit": "GRAM",
              "value": 400
            }
          }
        ],
        "instructions": [
          { "text": "Boil pasta", "optional": false },
          { "text": "Add guanciale", "optional": false }
        ],
        "storeable": true,
        "servings": 2
      }
    ]
  }
}
```

**Services Used:**
- DynamoDB (query user recipes)

---

#### 2. **recipes.deleteRecipe**

Delete a recipe.

**Authentication:** Required

**Input:**
```typescript
{
  uuid: RecipeUuid
}
```

**Output:**
```typescript
void
```

**Services Used:**
- DynamoDB (delete item)

---

#### 3. **recipes.updateRecipe**

Create or update a recipe for authenticated user.

**Authentication:** Required

**Input:**
```typescript
{
  uuid?: RecipeUuid,        // Omit for create, include for update
  name: string,
  description: string,
  images: Array<{
    timestamp: number,
    key: string              // S3 key
  }>,
  components: Array<{
    name: string,
    uuid: string,
    ingredients: Array<{
      name: string,
      quantity: {
        unit: Unit,
        value?: number
      }
    }>,
    instructions: Array<{
      text: string,
      optional?: boolean
    }>,
    storeable?: boolean,
    servings?: number
  }>
}
```

**Output:**
```typescript
void
```

**Services Used:**
- DynamoDB (put/update item)

**Validation:** Zod schema in `server/routers/recipes/validators/recipe.ts`

**Notes:**
- Generates new UUID if not provided (create mode)
- Images must already exist in S3 (get signed URL from `s3.put`)
- Stores items with sort key: `R-{recipeUuid}`

---

#### 4. **recipes.createSharedRecipe**

Create a shareable recipe with public access (no authentication required).

**Authentication:** Not required (public)

**Input:**
```typescript
{
  recipe: IRecipe          // Full recipe object
}
```

**Output:**
```typescript
{
  shareId: string          // Unique share ID (UUID)
}
```

**Services Used:**
- DynamoDB (put shared recipe with special UserId)

**Notes:**
- Creates new UUID for shareId
- Stores with special UserId (the shareId itself)
- User ID: actual user ID → Sort key: `S` (shared marker)
- ShareId UserId: shareId value → Sort key: `S-{sharedRecipeId}`

---

#### 5. **recipes.getSharedRecipe**

Get a shared recipe by ID (public, no authentication).

**Authentication:** Not required

**Input:**
```typescript
{
  shareId: string
}
```

**Output:**
```typescript
IRecipe | null
```

**Response Example:** (Same structure as `getRecipes` single recipe)

**Services Used:**
- DynamoDB (get item with shareId as UserId)

---

### Meal Plan Router

**Base Path:** `/api/trpc/mealPlan.*`

#### 6. **mealPlan.getMealPlan**

Get meal plan for authenticated user (14 days past + 14 days future).

**Authentication:** Required

**Input:** None

**Output:**
```typescript
{
  [dateString: string]: {
    [recipeUuid: string]: Array<{
      componentId: string,
      servings: number
    }>
  }
}
```

**Response Example:**
```json
{
  "Monday - 01/08/2024": {
    "550e8400-e29b-41d4-a716-446655440000": [
      {
        "componentId": "component-uuid-1",
        "servings": 2
      }
    ]
  },
  "Tuesday - 01/09/2024": {
    "550e8400-e29b-41d4-a716-446655440001": [
      {
        "componentId": "component-uuid-2",
        "servings": 1
      }
    ]
  }
}
```

**Services Used:**
- DynamoDB (get meal plan item with sort key `MP`)

**Notes:**
- Returns empty object `{}` if meal plan doesn't exist yet
- Date format: `"DayName - MM/DD/YYYY"` (e.g., `"Monday - 01/08/2024"`)
- Span: 14 days before today through 14 days after today
- Multiple servings of same recipe component supported

---

#### 7. **mealPlan.updateMealPlan**

Update/save meal plan for authenticated user.

**Authentication:** Required

**Input:**
```typescript
{
  mealPlan: {
    [dateString: string]: {
      [recipeUuid: string]: Array<{
        componentId: string,
        servings: number
      }>
    }
  }
}
```

**Output:**
```typescript
void
```

**Services Used:**
- DynamoDB (put item with sort key `MP`)

**Validation:** Zod schema in `server/routers/mealPlan/validators/mealPlan.ts`

**Notes:**
- Replaces entire meal plan with provided data
- Validates meal plan structure before saving
- Special handling: `shared` user write operations silently fail (returns empty array)

---

### S3 Router

**Base Path:** `/api/trpc/s3.*`

#### 8. **s3.getSignedUrl**

Get signed URL for downloading file from S3.

**Authentication:** Not required

**Input:**
```typescript
{
  key: string              // S3 object key
}
```

**Output:**
```typescript
{
  signedUrl: string        // Signed GET URL (valid for limited time)
}
```

**Services Used:**
- S3 (generate signed GET URL)

**Notes:**
- Returns URL valid for read access
- No authentication required (endpoint is public)

---

#### 9. **s3.delete**

Delete file from S3.

**Authentication:** Not required (publicly callable)

**Input:**
```typescript
{
  key: string              // S3 object key
}
```

**Output:**
```typescript
void
```

**Services Used:**
- S3 (delete object)

**Notes:**
- No user validation - any key can be deleted
- Use with caution in production

---

#### 10. **s3.put**

Get signed URL for uploading file to S3.

**Authentication:** Required

**Input:**
```typescript
{
  fileName: string,        // Original filename (used for S3 key)
  contentType: string      // MIME type (e.g., "image/jpeg")
}
```

**Output:**
```typescript
{
  signedUrl: string        // Signed PUT URL (valid for limited time)
}
```

**Services Used:**
- S3 (generate signed PUT URL)

**Flow:**
1. Client calls `s3.put` with filename and content type
2. Server generates signed PUT URL scoped to user (key: `<UserId>/fileName`)
3. Client uploads file directly to S3 using signed URL
4. Client saves S3 key in recipe via `recipes.updateRecipe`

---

## AWS Services

### DynamoDB

**Table Name:**
- Development: `lifesitetable`
- Production: `lifesitetableproduction`

**Region:** `eu-west-2`

**Schema:**
```typescript
{
  AttributeDefinitions: [
    { AttributeName: "UserId", AttributeType: "S" },  // Partition key
    { AttributeName: "Item", AttributeType: "S" }     // Sort key
  ],
  KeySchema: [
    { AttributeName: "UserId", KeyType: "HASH" },
    { AttributeName: "Item", KeyType: "RANGE" }
  ],
  ProvisionedThroughput: {
    ReadCapacityUnits: 1,
    WriteCapacityUnits: 1
  }
}
```

**Access Pattern:**
- `UserId` = AWS Cognito `sub` (unique user identifier)
- `Item` = Sort key with type prefix:
  - Recipes: `R-{recipeUuid}`
  - Meal plan: `MP`
  - Shared recipes: `S-{sharedRecipeId}` (UserId also set to shareId)

**Item Storage:**
- Recipe items stored as JSON with all nested components and ingredients
- Meal plan stored as nested date → recipe → components mapping
- Shared recipes accessible via special UserId = shareId

---

### S3

**Bucket Name:**
- Development: `mylifebucket`
- Production: `mylifebucketproduction`

**Region:** `eu-west-2`

**Configuration:**
- CORS enabled (allow image uploads from browser)
- Versioning enabled (production only)
- Signed URL expiration: Default AWS SDK settings

**Object Structure:**
```
{BucketName}/
├── {UserId}/
│   ├── {fileName}
│   └── {fileName}
└── shared/
    └── {fileName}
```

**Features:**
- User-scoped folders for private images
- Signed URLs for secure browser uploads/downloads
- Public read access via signed URLs

---

### Cognito

**User Pool ID:**
- Development: `us-east-1_SgWpLDwvx`
- Production: `us-east-1_LuP7rq1j2`

**Region:** `us-east-1`

**OAuth Providers:**
1. **Cognito Native** - Email/password authentication
2. **Google** - OAuth 2.0 via Google provider

**Domain:**
- Development: `mylifeuserpooldomain.auth.us-east-1.amazoncognito.com`

**NextAuth Configuration:**
- Provider: AWS Cognito via NextAuth.js v4.3.1
- Session type: JWT-based sessions
- Secret: `NEXTAUTH_SECRET` environment variable
- Callback: `/pages/api/auth/[...nextauth].ts`

**Session Object:**
```typescript
{
  user: {
    email?: string,
    name?: string,
    image?: string
  },
  expires: ISODateString,
  id: string                // Added: User's Cognito sub (UserId)
}
```

---

### OpenAI

**Model:** `gpt-3.5-turbo`

**Organization ID:** `org-hMMscEUj1YdUaZtzh3UPTc8r`

**Use Case:** Parse recipe uploads into structured recipe format

**Function:** `convertUploadToRecipe()` in `core/openai/recipe_uploader.ts`

**System Prompt:** Recipe extraction prompt from `RecipeUploaderPrompt` in `core/openai/prompts.ts`

---

## Database Schema

### Item Structure: Recipe

**DynamoDB Item:**
```json
{
  "UserId": "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
  "Item": "R-550e8400-e29b-41d4-a716-446655440000",
  "uuid": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Pasta Carbonara",
  "description": "Classic Italian pasta with eggs and cheese",
  "images": [
    {
      "timestamp": 1704067200000,
      "key": "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/pasta_carbonara.jpg"
    }
  ],
  "components": [
    {
      "name": "Main Pasta",
      "uuid": "component-uuid-1",
      "ingredients": [
        {
          "name": "Spaghetti",
          "quantity": {
            "unit": "GRAM",
            "value": 400
          }
        },
        {
          "name": "Guanciale",
          "quantity": {
            "unit": "GRAM",
            "value": 200
          }
        },
        {
          "name": "Eggs",
          "quantity": {
            "unit": "NUMBER",
            "value": 3
          }
        }
      ],
      "instructions": [
        {
          "text": "Boil pasta until al dente",
          "optional": false
        },
        {
          "text": "Fry guanciale until crispy",
          "optional": false
        },
        {
          "text": "Beat eggs with cheese",
          "optional": false
        },
        {
          "text": "Combine pasta with guanciale and egg mixture",
          "optional": false
        }
      ],
      "storeable": true,
      "servings": 2
    }
  ]
}
```

**TypeScript Interface:**
```typescript
interface IRecipe {
  uuid: RecipeUuid;
  name: string;
  description: string;
  images: Array<{
    timestamp: number;     // Unix timestamp
    key: string;           // S3 object key
  }>;
  components: Array<{
    name: string;
    uuid: string;
    ingredients: Array<{
      name: string;
      quantity: {
        unit: Unit;
        value?: number;
      };
    }>;
    instructions: Array<{
      text: string;
      optional?: boolean;
    }>;
    storeable?: boolean;   // Can be stored/made in advance
    servings?: number;
  }>;
}
```

---

### Item Structure: Meal Plan

**DynamoDB Item:**
```json
{
  "UserId": "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
  "Item": "MP",
  "Monday - 01/08/2024": {
    "550e8400-e29b-41d4-a716-446655440000": [
      {
        "componentId": "component-uuid-1",
        "servings": 2
      }
    ],
    "550e8400-e29b-41d4-a716-446655440001": [
      {
        "componentId": "component-uuid-2",
        "servings": 1
      }
    ]
  },
  "Tuesday - 01/09/2024": {
    "550e8400-e29b-41d4-a716-446655440000": [
      {
        "componentId": "component-uuid-1",
        "servings": 3
      }
    ]
  }
}
```

**TypeScript Type:**
```typescript
interface IMealPlan {
  [dateString: string]: {
    [recipeUuid: string]: Array<{
      componentId: string;
      servings: number;
    }>;
  };
}
```

**Date Format:** `"DayName - MM/DD/YYYY"` (e.g., `"Monday - 01/08/2024"`)

**Date Range:** 14 days before today to 14 days after today

---

### Ingredient Units

**Available Units:** (`core/recipes/units.ts`)
```typescript
enum Unit {
  NO_UNIT = "NO_UNIT",
  MILLILITER = "MILLILITER",
  LITER = "LITER",
  GRAM = "GRAM",
  KILOGRAM = "KILOGRAM",
  CUP = "CUP",
  TEASPOON = "TEASPOON",
  TABLESPOON = "TABLESPOON",
  NUMBER = "NUMBER"
}
```

---

## Core Business Logic

### DynamoDB Operations

**File:** `core/dynamo/dynamo_utilities.ts`

#### Key Functions:

1. **getFromDynamo(userId, item)**
   - Retrieve single item by UserId and sort key (Item)
   - Returns: `Promise<T | null>`

2. **uploadToDynamo(userId, item, data)**
   - Put or update item in DynamoDB
   - Returns: `Promise<void>`

3. **deleteFromDynamo(userId, item)**
   - Delete item from DynamoDB
   - Returns: `Promise<void>`

4. **getAllRecipesForAUser(userId)**
   - Query all recipes (all items with `Item` prefix `R-`)
   - Returns: `Promise<Map<RecipeUuid, IRecipe>>`

5. **getMealPlanForAUser(userId)**
   - Get meal plan (item with `Item` = `MP`)
   - Returns empty object if doesn't exist
   - Returns: `Promise<IMealPlan>`

6. **putMealPlanForUser(userId, mealPlan)**
   - Save entire meal plan
   - Returns: `Promise<void>`

**Special User Handling:**
- `shared` user can read recipes but write operations silently fail
- Used for public/demo access without authentication

---

### S3 Operations

**File:** `core/s3/s3_utilities.ts`

#### Key Functions:

1. **getS3SignedUrl(key)**
   - Generate signed GET URL for download
   - Returns: `Promise<{ signedUrl: string }>`

2. **getS3SignedPostUrl(userId, fileName, contentType)**
   - Generate signed PUT URL for upload
   - Key: `{userId}/{fileName}`
   - Returns: `Promise<{ signedUrl: string }>`

3. **PutToS3(key, body, contentType)**
   - Direct upload to S3 from server
   - Returns: `Promise<void>`

4. **DeleteFromS3(key)**
   - Delete object from S3
   - Returns: `Promise<void>`

---

### Meal Plan Utilities

**File:** `core/meal_plan/meal_plan_utilities.ts`

#### Key Functions:

1. **addOrUpdatePlan(mealPlan, date, recipeUuid, componentId, servings)**
   - Add or update meal plan entry
   - Returns: Updated `IMealPlan`

2. **mealPlanEmptyState()**
   - Returns empty meal plan spanning -14 to +14 days from today
   - Returns: `IMealPlan` with date strings but empty recipes

3. **dateToDateString(date)**
   - Format: `"DayName - MM/DD/YYYY"`
   - Returns: `string`

4. **createDates()**
   - Generate array of dates from -14 to +14 days
   - Returns: `Date[]`

---

### OpenAI Recipe Parsing

**File:** `core/openai/recipe_uploader.ts`

#### Key Function:

**convertUploadToRecipe(fileContent, fileName)**
- Takes uploaded file content (text or image description)
- Calls GPT-3.5-turbo with recipe extraction prompt
- Returns: `Promise<IRecipe>`

**System Prompt:** Extracts structured recipe from free-form text/image

**Response Format:**
```json
{
  "uuid": "generated-uuid",
  "name": "Recipe name",
  "description": "Short description",
  "images": [],
  "components": [
    {
      "name": "Component name",
      "uuid": "component-uuid",
      "ingredients": [...],
      "instructions": [...],
      "servings": 4
    }
  ]
}
```

---

### Recipe Queries & Mutations

**Query Functions:** `server/routers/recipes/queries.ts`

1. **getRecipesForUser(userId)**
   - Returns: `Map<RecipeUuid, IRecipe>`

2. **getSharedRecipe(shareId)**
   - Returns: `IRecipe | null`

**Mutation Functions:** `server/routers/recipes/mutations.ts`

1. **updateRecipe(userId, recipe)**
   - Creates new UUID if not provided
   - Validates against recipe schema
   - Saves to DynamoDB

2. **deleteRecipe(userId, recipeUuid)**
   - Deletes recipe item from DynamoDB

3. **shareRecipe(userId, recipe)**
   - Creates shareable recipe with unique ID
   - Returns: `{ shareId: string }`
   - Stores with special UserId (the shareId)

---

## Authentication Flow

### NextAuth.js Setup

**File:** `pages/api/auth/[...nextauth].ts`

**Configuration:**
```typescript
{
  providers: [
    CognitoProvider({
      clientId: ENV_AWS_COGNITO_CLIENT_ID,
      clientSecret: ENV_AWS_COGNITO_CLIENT_SECRET,
      issuer: ENV_AWS_COGNITO_CLIENT_ISSUER,
      domain: ENV_AWS_COGNITO_DOMAIN_URL
    }),
    GoogleProvider({
      clientId: GOOGLE_ID,
      clientSecret: GOOGLE_SECRET
    })
  ],
  secret: NEXTAUTH_SECRET,
  callbacks: {
    async jwt(token, user) {
      if (user) token.id = user.id;  // Add Cognito sub to JWT
      return token;
    },
    async session(session, token) {
      session.id = token.id;  // Add to session
      return session;
    }
  },
  pages: {
    signIn: "/auth/signin",
    signOut: "/auth/signout",
    error: "/auth/error"
  }
}
```

### Session Flow

1. **User logs in** via NextAuth (Cognito or Google OAuth)
2. **JWT created** with user data and Cognito `sub` (UserId)
3. **Session cookie** stored in browser
4. **tRPC middleware** extracts session from request
5. **UserId** passed to all tRPC procedures requiring authentication

### tRPC Middleware

**File:** `server/middleware.ts`

```typescript
export const authedProcedure = t.procedure
  .use(async (opts) => {
    const session = await getServerSession();
    if (!session?.id) {
      throw new TRPCError({ code: "UNAUTHORIZED" });
    }
    return opts.next({
      ctx: {
        userId: session.id,  // Cognito sub
        session
      }
    });
  });
```

---

## Data Flow Examples

### Complete Recipe Upload & Storage Flow

```
1. USER UPLOADS RECIPE
   ├─ Frontend: POST image file to signed S3 URL
   │  ├─ Client calls: trpc.s3.put({ fileName, contentType })
   │  ├─ Server generates: Signed PUT URL (userId/fileName)
   │  └─ Client uploads: File to S3 using signed URL
   ├─ Server receives: S3 key in updateRecipe call
   └─ Recipe saved to DynamoDB with S3 image key

2. USER RETRIEVES RECIPES
   ├─ Frontend: trpc.recipes.getRecipes()
   ├─ Server queries: DynamoDB (UserId + R-* sort keys)
   ├─ Returns: Map<RecipeUuid, IRecipe>
   └─ Frontend: Maps S3 keys to signed GET URLs for display

3. USER SHARES RECIPE
   ├─ Frontend: trpc.recipes.createSharedRecipe({ recipe })
   ├─ Server generates: New UUID for shareId
   ├─ Server saves: Recipe with UserId = shareId
   └─ Frontend: Displays link: /food/shareId

4. ANOTHER USER ACCESSES SHARED RECIPE
   ├─ Frontend: trpc.recipes.getSharedRecipe({ shareId })
   ├─ Server queries: DynamoDB (UserId = shareId)
   └─ Returns: IRecipe (no authentication required)
```

### Meal Planning Flow

```
1. USER LOADS MEAL PLAN PAGE
   ├─ Frontend: trpc.mealPlan.getMealPlan()
   ├─ Server queries: DynamoDB (UserId + "MP" sort key)
   └─ Returns: IMealPlan for -14 to +14 days

2. USER ADDS RECIPE TO DATE
   ├─ Frontend: Updates local state with recipeUuid + componentId + servings
   └─ Not yet saved to server

3. USER SAVES MEAL PLAN
   ├─ Frontend: trpc.mealPlan.updateMealPlan({ mealPlan })
   ├─ Server validates: Against Zod schema
   ├─ Server saves: Entire mealPlan to DynamoDB (replaces existing)
   └─ Returns: Success

4. DISPLAY MEAL PLAN
   ├─ Frontend: For each date → for each recipe in plan
   ├─ Fetch recipe details: trpc.recipes.getRecipes()
   ├─ Find matching recipe: map recipeUuid to full recipe
   └─ Display: Recipe name + component with specified servings
```

### Authentication & Protected API Flow

```
1. USER NOT LOGGED IN
   ├─ Visits: /food page
   ├─ NextAuth detects: No session
   └─ Redirects: To login page (/auth/signin)

2. USER LOGS IN
   ├─ Cognito/Google OAuth flow
   ├─ NextAuth creates: JWT session with userId
   ├─ Session stored: HTTP-only cookie
   └─ Redirects: Back to /food page

3. USER ACCESSES PROTECTED tRPC CALL
   ├─ Frontend: trpc.recipes.getRecipes() (authed)
   ├─ Client sends: Request with session cookie
   ├─ Server middleware: Extracts session → gets userId
   ├─ Query DynamoDB: With authenticated userId
   └─ Returns: User's recipes only

4. USER ACCESSES PUBLIC tRPC CALL
   ├─ Frontend: trpc.recipes.getSharedRecipe({ shareId }) (unauthed)
   ├─ Client sends: Request (no session required)
   ├─ Server: No auth check
   └─ Returns: Shared recipe data
```

---

## File Structure Reference

| Component | File Path |
|-----------|-----------|
| tRPC Router | `server/index.ts` |
| Recipes Router | `server/routers/recipes/index.ts` |
| Meal Plan Router | `server/routers/mealPlan/index.ts` |
| S3 Router | `server/routers/s3/index.ts` |
| tRPC Handler | `pages/api/trpc/[trpc].ts` |
| NextAuth Config | `pages/api/auth/[...nextauth].ts` |
| Logout Handler | `pages/api/auth/logout.ts` |
| DynamoDB Utils | `core/dynamo/dynamo_utilities.ts` |
| S3 Utils | `core/s3/s3_utilities.ts` |
| Meal Plan Utils | `core/meal_plan/meal_plan_utilities.ts` |
| OpenAI Integration | `core/openai/recipe_uploader.ts` |
| Recipe Types | `core/types/recipes.ts` |
| Meal Plan Types | `core/types/meal_plan.ts` |
| Units Definition | `core/recipes/units.ts` |
| Recipe Validator | `server/routers/recipes/validators/recipe.ts` |
| Meal Plan Validator | `server/routers/mealPlan/validators/mealPlan.ts` |
| DynamoDB Setup | `aws/scripts/createDynamoDB.js` |
| S3 Setup | `aws/scripts/createS3Bucket.js` |
| Cognito Setup | `aws/scripts/createCognitoUserPool.js` |

---

## Startup Commands

```bash
# Install dependencies
npm install
# or
pnpm install

# Development
npm run dev
# or
pnpm dev

# Runs on: http://localhost:3000

# Build for production
npm run build

# Start production server
npm start

# Lint and type check
npm run lint

# Environment file
# Create .env.local with all required environment variables
```

---

## Key Features Summary

1. **Recipe Management**
   - Create, edit, delete recipes with ingredients and instructions
   - Multiple recipe components with flexible ingredient units
   - Image storage in S3 with browser-based upload

2. **Meal Planning**
   - 28-day view (14 days past + 14 days future)
   - Drag-and-drop recipe components to dates
   - Multiple servings of same recipe supported

3. **Recipe Sharing**
   - Generate shareable links with unique IDs
   - Public access without authentication
   - Separate storage for shared recipes

4. **Smart Recipe Extraction**
   - Upload recipe text or images
   - GPT-3.5-turbo parses into structured format
   - Automatic ingredient unit detection

5. **Authentication**
   - Cognito + NextAuth.js
   - Google OAuth support
   - Session-based security

6. **Data Persistence**
   - DynamoDB for recipes and meal plans
   - S3 for images
   - User-scoped data isolation

---

## Notes for Migration

When migrating from MyLife to the api.georgesheppard.dev monolith:

1. **Separate the concerns:**
   - Backend tRPC logic → Hono endpoints + handlers
   - DynamoDB schema → PostgreSQL schema + migrations
   - S3 operations → Keep or refactor to other storage
   - Cognito auth → Integrate with existing auth system

2. **Expose as MCP tools:**
   - `createRecipe` - Create new recipe
   - `getRecipes` - List recipes
   - `updateMealPlan` - Update meal plan
   - `getSignedS3Url` - Get image URL
   - `convertUploadToRecipe` - Parse recipe from text/image via OpenAI

3. **Environment configuration:**
   - Add DynamoDB → PostgreSQL migration
   - Keep S3 for image storage (or migrate to local storage)
   - Update Cognito integration if needed

4. **Database migration:**
   - Export DynamoDB recipes → JSON
   - Create PostgreSQL schema for recipes and meal plans
   - Migrate historical data if needed
