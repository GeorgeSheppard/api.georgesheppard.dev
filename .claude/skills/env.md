---
name: env
description: Adding and using environment variables
---

# Environment Variables & Config Skill

## Overview

This project uses **centralized environment variable validation** with Zod. All environment variables are validated once at application boot in `@src/config/index.js`, and the validated config is exported as a singleton. This ensures type safety and guaranteed availability of all required values.

## Key Principles

1. **Validated at Boot**: Environment variables are validated once when the application starts using the Zod schema in `@src/config/env.js`
2. **Import Centralized Config**: Always import from `@src/config/index.js`, not `process.env` directly
3. **No Null Checks Needed**: All config values are guaranteed to exist after validation—do not add null checks
4. **No Default Values**: Environment variables should not have default values (except `NODE_ENV` for development convenience). Each service must be configured explicitly
5. **Type Safe**: The config object is fully typed by Zod, providing IDE autocomplete and type checking

## Usage Patterns

### ✅ Correct: Import Centralized Config

```typescript
import { config } from '@config/index.js';

// Use directly—values are guaranteed to exist
const server = serve({
  port: config.PORT,
});

const db = await createDatabaseClient(config.DATABASE_URL);
```

### ✅ Correct: Pass to Factory/Constructor

```typescript
import { config } from '@config/index.js';

// Pass config values to factories during initialization
class EmailService {
  constructor() {
    this.apiKey = config.MAILGUN_API_KEY;
  }
}

const emailService = new EmailService();
```

### ❌ Wrong: Calling validateEnv() Repeatedly

```typescript
// DON'T: validateEnv() should only be called once at boot
import { validateEnv } from '@src/config/env.js';

const env = validateEnv(); // ❌ Wasteful
```

### ❌ Wrong: Direct process.env Access

```typescript
// DON'T: Access process.env directly
const port = process.env.PORT; // ❌ Not type safe, no validation
```

### ❌ Wrong: Null Checks

```typescript
// DON'T: Add null checks—all values are guaranteed
const value = config.API_KEY || 'default'; // ❌ Unnecessary
if (!config.DATABASE_URL) { ... } // ❌ Unnecessary
```

## Adding New Environment Variables

1. **Add to Zod Schema** in `@src/config/env.js`:
   ```typescript
   const envSchema = z.object({
     // ... existing fields
     NEW_VAR: z.string(), // Required
     OPTIONAL_VAR: z.string().optional(), // Optional
   });
   ```

2. **Update Example Files**:
   - Add the new variable to `@.env.example` with a descriptive placeholder value
   - Add the new variable to `@.env.test` with a dummy test value
   - Include comments explaining what the variable is for (see existing examples)

3. **Update Documentation** in `.claude/CLAUDE.md` if adding a new service or pattern

4. **Import and Use**:
   ```typescript
   import { config } from '@config/index.js';

   const value = config.NEW_VAR; // Type safe!
   ```

## Special Cases

### Build-Time Configuration (Drizzle)

`drizzle.config.ts` is the only exception—it runs at build time before the main application boots and must use `process.env` directly:

```typescript
import 'dotenv/config';

export default defineConfig({
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
```

This is acceptable only for static build-time configurations.

### Test Setup

Tests may dynamically mutate config after test containers start:

```typescript
import { config } from '@config/index.js';

// In test setup, after containers start
config.DATABASE_URL = postgresContainer.getConnectionUri();
config.RABBITMQ_URL = rabbitmqContainer.getAmqpUrl();
```

This is acceptable only in test setup files.

## Environment Variables Reference

See `@src/config/env.js` for the complete schema. Common variables:

- **Server**: `NODE_ENV`, `PORT`
- **Database**: `DATABASE_HOST`, `DATABASE_PORT`, `DATABASE_USER`, `DATABASE_PASSWORD`, `DATABASE_DB`, `DATABASE_URL`, `DATABASE_MIGRATIONS_PATH`
- **Queue**: `RABBITMQ_HOST`, `RABBITMQ_PORT`, `RABBITMQ_USER`, `RABBITMQ_PASSWORD`, `RABBITMQ_URL`
- **API Keys**: `API_KEY`, `MAILGUN_API_KEY`, `OPENAI_API_KEY`
- **Encryption**: `ENCRYPTION_KEY` (32 bytes), `ENCRYPTION_IV` (16 bytes)
- **External Services**: `TEXT_EXTRACTOR_URL`

## Common Mistakes to Avoid

| ❌ Wrong | ✅ Correct | Reason |
|---------|----------|--------|
| `process.env.API_KEY` | `config.API_KEY` | Type safety & validation |
| `const val = validateEnv()` | Import from `@config/index.js` | Avoid redundant validation |
| `config.VALUE \|\| 'default'` | `config.VALUE` | All values are guaranteed |
| `if (!config.VALUE)` | Direct use | No null checks needed |
| Adding defaults in schema | Required values only | Catch missing env vars early |
