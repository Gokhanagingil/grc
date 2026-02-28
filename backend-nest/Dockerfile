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
RUN npm ci --legacy-peer-deps

# Copy source code
COPY . .

# Build the application
RUN npm run build

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

# Copy package files and install production-only dependencies
# Using a clean npm ci --omit=dev avoids the ERESOLVE errors that
# npm prune --production triggers with peerOptional conflicts
COPY --chown=nestjs:nodejs package*.json ./
RUN npm ci --omit=dev --legacy-peer-deps

# Copy built artifacts from builder stage
COPY --from=builder --chown=nestjs:nodejs /app/dist ./dist

# Set environment defaults
ENV NODE_ENV=production
ENV PORT=3002

# Expose the application port
EXPOSE 3002

# Switch to non-root user
USER nestjs

# Health check using Node.js http module (no dependency on curl/wget binaries)
# Uses /health/live for simple liveness (no DB query, fast response)
HEALTHCHECK --interval=10s --timeout=5s --start-period=30s --retries=5 \
    CMD node -e "const http=require('http');const r=http.get('http://localhost:'+(process.env.PORT||3002)+'/health/live',res=>{process.exit(res.statusCode===200?0:1)});r.on('error',()=>process.exit(1));r.setTimeout(3000,()=>{r.destroy();process.exit(1)})"

# Start the application
CMD ["node", "dist/main.js"]
