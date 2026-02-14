---
name: development-workflow
description: Post-code-change verification and quality checks
---

# Development Workflow Skill

## Overview

After making code changes to this project, always complete a standard verification workflow before committing. This ensures consistent code quality, passing tests, and proper documentation.

## Required Workflow Steps

After writing or modifying code, execute these steps in order:

### 1. Fix Linting Issues

```bash
pnpm lint:fix
```

This runs TypeScript compilation and ESLint to identify and fix:
- Type errors
- Unused imports
- Code style issues
- Formatting inconsistencies

**Do not proceed** if errors remain (as opposed to warnings).

### 2. Format Code

```bash
pnpm format
```

This runs Prettier to ensure consistent code formatting:
- Indentation
- Line length
- Quote style
- Trailing commas

### 3. Regenerate OpenAPI Specification

```bash
pnpm generate:openapi
```

**When to run**: Always, but especially important when:
- Adding new endpoints
- Modifying endpoint schemas
- Changing endpoint paths or methods
- Updating request/response types

This script:
- Validates that `@hono/zod-openapi` definitions are correct
- Generates updated OpenAPI spec in `generated/openapi/`
- Requires all environment variables in `.env.test` to be set
- Will fail if Cognito config is missing from `.env.test`

### 4. Run Unit Tests

```bash
pnpm test
```

Verify that all unit tests pass:
- Tests for endpoint handlers
- Tests for utility functions
- Tests for business logic

**Do not proceed** if tests fail. Debug and fix failing tests before committing.

### 5. Commit with Clear Message

```bash
git add <specific files>
git commit -m "Brief description of changes"
```

Include the session URL at the end:
```
git commit -m "Fix authentication bug

- Updated JWT validation logic
- Added new error handling for expired tokens

https://claude.ai/code/session_xxxx
```

## Environment Variable Requirements

For the workflow to complete successfully:

- **`.env.test` must be configured** with all required environment variables, even if using dummy values
- This file is used by:
  - `pnpm test` (unit and integration tests)
  - `pnpm generate:openapi` (OpenAPI generation)
  - Test fixtures and setup

### Adding New Required Variables

When adding a new required environment variable:

1. Add to `src/config/env.ts` (Zod schema)
2. Add to `.env.example` (with placeholder)
3. Add to `.env.test` (with test value)
4. Run `pnpm generate:openapi` to verify it works
5. Run `pnpm test` to verify tests work

See the `env` skill for detailed patterns.

## Common Issues

### "pnpm generate:openapi" Fails with Invalid Environment Variables

**Cause**: `.env.test` is missing required variables or has incorrect values

**Fix**: Check `.env.test` and ensure all required variables from `src/config/env.ts` are set

### Tests Fail After Code Changes

**Cause**: Code changes broke existing functionality or tests need updating

**Fix**:
- Review the failing test output
- Update code or tests as needed
- Re-run `pnpm test` to verify

### Lint Errors After Code Changes

**Cause**: TypeScript or ESLint violations introduced

**Fix**: Run `pnpm lint:fix` to auto-fix, then manually fix remaining issues

## Optional: Full Verification Suite

For significant changes, also run integration tests:

```bash
pnpm test:integration
```

This runs tests against real containers (PostgreSQL, RabbitMQ, DynamoDB) and takes longer, but provides comprehensive validation.

## Quick Reference

```bash
# Full development workflow
pnpm lint:fix && \
pnpm format && \
pnpm generate:openapi && \
pnpm test && \
git add . && \
git commit -m "Your commit message"
```

## See Also

- `env` skill: Environment variable patterns and setup
- `endpoint-creation` skill: Creating new endpoints (handles tests automatically)
- `integration-tests` skill: Running comprehensive integration tests
