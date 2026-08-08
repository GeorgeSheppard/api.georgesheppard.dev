# Build stage
FROM node:22-alpine AS builder

WORKDIR /app

# Enable corepack so it installs the exact pnpm version pinned in package.json's
# "packageManager" field, instead of npm's floating "latest" (which can drift out of
# sync with the committed lockfile and break --frozen-lockfile installs)
RUN corepack enable

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install all dependencies (including dev dependencies)
RUN pnpm install --frozen-lockfile

# Copy source code and config files
COPY src ./src
COPY tsconfig.json tsup.config.ts drizzle.config.ts ./

# Build the application
RUN pnpm build

# Runtime stage
FROM node:22-alpine

WORKDIR /app

# Enable corepack so it installs the exact pnpm version pinned in package.json's
# "packageManager" field, instead of npm's floating "latest" (which can drift out of
# sync with the committed lockfile and break --frozen-lockfile installs)
RUN corepack enable

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install only production dependencies
RUN pnpm install --prod --frozen-lockfile

# Copy compiled code from builder
COPY --from=builder /app/dist ./dist

# Copy migrations (required by Drizzle ORM at runtime)
COPY --from=builder /app/src/core/database/migrations ./src/core/database/migrations

# Expose port
EXPOSE 5240

# Start both server and worker
CMD ["sh", "-c", "node dist/index.js & node dist/core/queue/worker.js & wait"]
