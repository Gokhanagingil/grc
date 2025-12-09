# =============================================================================
# GRC Platform - Frontend Dockerfile
# =============================================================================
# Multi-stage production build with nginx
#
# Build: docker build -t grc-frontend .
# =============================================================================

# -----------------------------------------------------------------------------
# Stage 1: Build
# -----------------------------------------------------------------------------
FROM node:20-alpine AS builder

WORKDIR /app

# Build arguments for environment variables
ARG REACT_APP_API_URL
ENV REACT_APP_API_URL=${REACT_APP_API_URL}

# Copy package files first for better layer caching
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# -----------------------------------------------------------------------------
# Stage 2: Production Runtime with Nginx
# -----------------------------------------------------------------------------
FROM nginx:alpine AS production

# Add labels for container metadata
LABEL org.opencontainers.image.title="GRC Platform - Frontend"
LABEL org.opencontainers.image.description="Enterprise GRC (Governance, Risk, Compliance) frontend UI"
LABEL org.opencontainers.image.vendor="GRC Platform"

# Copy built files from builder
COPY --from=builder /app/build /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port 80
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost/health || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]

