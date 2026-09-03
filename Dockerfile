# Production Dockerfile for BucketSpace Node.js & Next.js Backend
FROM node:22-slim AS base
WORKDIR /app

# Install build essentials and corepack
RUN corepack enable && corepack prepare pnpm@latest --activate

# Set production environment flags
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Copy package manifests and workspace configuration
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml* ./
RUN pnpm install --frozen-lockfile

# Copy application source code
COPY . .

# Build production bundle
RUN pnpm run build

# Expose default HTTP port
EXPOSE 3000

# Start long-running Node.js server
CMD ["pnpm", "run", "start"]

