# =============================================================================
# GRC Platform - NestJS Backend Dockerfile
# =============================================================================
# Multi-stage production-ready build
#
# Build: docker build -t grc-backend-nest .
# Run:   docker run -p 3002:3002 --env-file .env grc-backend-nest
#
# Required environment variables:
#   - JWT_SECRET: Secret key for JWT token signing (required)
#   - DB_HOST: PostgreSQL host (default: localhost)
#   - DB_PORT: PostgreSQL port (default: 5432)
#   - DB_USER: PostgreSQL user (default: postgres)
#   - DB_PASSWORD: PostgreSQL password (default: postgres)
#   - DB_NAME: PostgreSQL database name (default: grc_platform)
# =============================================================================

# -----------------------------------------------------------------------------
# Stage 1: Build
# -----------------------------------------------------------------------------
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files first for better layer caching
COPY package*.json ./

# Install all dependencies (including devDependencies for build)
# --legacy-peer-deps: required because @swc/cli@0.8.0 conflicts with
# @nestjs/cli@11.0.16 peerOptional range (^0.1.62 || ^0.3.0-0.7.x)
RUN npm ci --legacy-peer-deps

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Prune devDependencies after build
RUN npm prune --production

# -----------------------------------------------------------------------------
# Stage 2: Production Runtime
# -----------------------------------------------------------------------------
FROM node:20-alpine AS production

# Add labels for container metadata
LABEL org.opencontainers.image.title="GRC Platform - NestJS Backend"
LABEL org.opencontainers.image.description="Enterprise GRC (Governance, Risk, Compliance) backend API"
LABEL org.opencontainers.image.vendor="GRC Platform"

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001

WORKDIR /app

# Create writable upload directory for attachments
# This ensures /app/data/uploads is writable by the nestjs user (1001)
# even when no volume is mounted (CI smoke tests, ephemeral containers)
RUN mkdir -p /app/data/uploads && chown -R nestjs:nodejs /app/data

# Copy built artifacts and production dependencies from builder
COPY --from=builder --chown=nestjs:nodejs /app/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/package.json ./package.json

# Set environment defaults
ENV NODE_ENV=production
ENV PORT=3002

# Expose the application port
EXPOSE 3002

# Switch to non-root user
USER nestjs

# Health check using the /health/live endpoint
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:${PORT}/health/live || exit 1

# Start the application
CMD ["node", "dist/main.js"]
