# =============================================================================
# GRC Platform - Frontend Dockerfile
# =============================================================================
# Multi-stage production-ready build for React SPA
#
# Build: docker build -t grc-frontend .
# Run:   docker run -p 80:80 grc-frontend
#
# Environment variables (build-time):
#   - REACT_APP_API_URL: Backend API URL (default: http://localhost:3002)
# =============================================================================

# -----------------------------------------------------------------------------
# Stage 1: Build
# -----------------------------------------------------------------------------
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files first for better layer caching
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build argument for API URL (can be overridden at build time)
ARG REACT_APP_API_URL=http://localhost:3002
ENV REACT_APP_API_URL=$REACT_APP_API_URL

# Build the application
RUN npm run build

# -----------------------------------------------------------------------------
# Stage 2: Production Runtime with Nginx
# -----------------------------------------------------------------------------
FROM nginx:stable-alpine AS production

# Add labels for container metadata
LABEL org.opencontainers.image.title="GRC Platform - Frontend"
LABEL org.opencontainers.image.description="Enterprise GRC (Governance, Risk, Compliance) frontend SPA"
LABEL org.opencontainers.image.vendor="GRC Platform"

# Remove default nginx static assets
RUN rm -rf /usr/share/nginx/html/*

# Copy built assets from builder stage
COPY --from=builder /app/build /usr/share/nginx/html

# Copy custom nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port 80
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:80/ || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
