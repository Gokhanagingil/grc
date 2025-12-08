# API Gateway & Reverse Proxy Architecture

## Overview

The GRC+ITSM platform uses NGINX as a unified API gateway and reverse proxy, providing a single-origin architecture where all frontend and API requests go through port 80. This eliminates CORS issues, simplifies corporate firewall configurations, and provides a foundation for production-level security, logging, and scaling.

## Architecture

Browser -> NGINX (Port 80) -> Backend (internal port 3002)

The NGINX server handles:
- Frontend static files at /
- API reverse proxy at /api/*
- Health checks at /health and /api-health

## Benefits

### Security
- Single entry point: All traffic goes through NGINX, simplifying security monitoring
- Backend isolation: Backend API is not directly accessible from the internet
- Rate limiting: Protects against brute-force attacks on auth endpoints
- Security headers: CSP, X-Frame-Options, X-Content-Type-Options, etc.
- Request size limits: Prevents large payload attacks

### Corporate Network Compatibility
- Single port: Only port 80 needs to be open (or 443 for HTTPS)
- No CORS issues: Same-origin requests eliminate cross-origin complications
- Firewall friendly: No need to whitelist multiple ports

### Operational
- Centralized logging: All requests logged at the gateway level
- Correlation IDs: Request tracing across frontend and backend
- Health monitoring: Unified health check endpoints
- Scalability: Easy to add load balancing, caching, or additional backends

## Route Mappings

| Frontend Request | Backend Destination | Description |
|-----------------|---------------------|-------------|
| /api/auth/* | http://backend:3002/auth/* | Authentication (login, register, refresh) |
| /api/users/* | http://backend:3002/users/* | User management |
| /api/grc/* | http://backend:3002/grc/* | GRC domain (risks, policies, requirements) |
| /api/itsm/* | http://backend:3002/itsm/* | ITSM domain (incidents) |
| /api/dashboard/* | http://backend:3002/dashboard/* | Dashboard analytics |
| /api/health/* | http://backend:3002/health/* | Backend health checks |
| /api/tenants/* | http://backend:3002/tenants/* | Multi-tenancy |
| /api/settings/* | http://backend:3002/settings/* | System settings |
| /api/metrics/* | http://backend:3002/metrics/* | Prometheus metrics |

## Configuration Files

### NGINX Configuration (frontend/nginx.conf)

The NGINX configuration includes:

1. Rate Limiting Zones
   - auth_limit: 10 requests/second for authentication endpoints
   - api_limit: 50 requests/second for general API endpoints

2. Upstream Definition
   - Backend service on internal Docker network
   - Connection keepalive for performance

3. Security Headers
   - X-Frame-Options: SAMEORIGIN
   - X-Content-Type-Options: nosniff
   - X-XSS-Protection: 1; mode=block
   - Referrer-Policy: strict-origin-when-cross-origin
   - Content-Security-Policy (configured for React/MUI)
   - Permissions-Policy

4. Proxy Configuration
   - JWT Authorization header forwarding
   - Correlation ID forwarding (X-Correlation-ID, X-Request-ID)
   - Tenant ID forwarding (X-Tenant-ID)
   - Client IP forwarding (X-Real-IP, X-Forwarded-For)

### Docker Compose (docker-compose.staging.yml)

Key changes for API gateway architecture:

1. Backend Service
   - Uses expose instead of ports (internal network only)
   - CORS configured for internal Docker network

2. Frontend Service
   - REACT_APP_API_URL=/api (relative path)
   - Serves as both web server and API gateway

## Deployment

### Starting the Stack

    # Build and start all services
    docker compose -f docker-compose.staging.yml up -d --build

    # View logs
    docker compose -f docker-compose.staging.yml logs -f

    # Rebuild after changes
    docker compose -f docker-compose.staging.yml up -d --build --force-recreate

### Accessing the Application

| Endpoint | URL | Description |
|----------|-----|-------------|
| Frontend | http://<host>/ | React SPA |
| API | http://<host>/api/* | All API requests |
| NGINX Health | http://<host>/health | NGINX health check |
| Backend Health | http://<host>/api-health | Backend health proxy |

### Verifying the Setup

1. Check NGINX is serving frontend:
   curl -I http://localhost/
   # Should return 200 OK with security headers

2. Check API proxy is working:
   curl http://localhost/api/health/live
   # Should return backend health status

3. Verify backend is NOT directly accessible:
   curl http://localhost:3002/health/live
   # Should fail (connection refused)

4. Check security headers:
   curl -I http://localhost/
   # Should include X-Frame-Options, X-Content-Type-Options, CSP, etc.

## Frontend Configuration

The frontend uses the REACT_APP_API_URL environment variable to determine the API base URL:

    // src/services/api.ts
    const API_BASE_URL = process.env.REACT_APP_API_URL || '/api';

For staging/production deployments, this is set to /api at build time via Docker build args, enabling the single-origin architecture.

For local development, you can either:
1. Use /api with a local NGINX proxy
2. Set REACT_APP_API_URL=http://localhost:3001/api for direct backend access

## Troubleshooting

### Common Issues

1. 502 Bad Gateway
   - Backend container not running or unhealthy
   - Check: docker compose logs backend

2. CORS Errors
   - Ensure frontend is using /api prefix, not direct backend URL
   - Check browser network tab for request URLs

3. Rate Limiting (429)
   - Too many requests to auth endpoints
   - Wait and retry, or adjust rate limits in nginx.conf

4. Connection Refused on Port 3002
   - This is expected! Backend is internal-only
   - Use /api/* routes through NGINX

### Debugging

    # Check NGINX logs
    docker compose logs frontend

    # Check backend logs
    docker compose logs backend

    # Test internal connectivity
    docker compose exec frontend wget -qO- http://backend:3002/health/live

    # Check NGINX configuration
    docker compose exec frontend nginx -t

## Security Considerations

### Production Recommendations

1. Enable HTTPS: Add SSL/TLS termination at NGINX
2. Strengthen CSP: Tighten Content-Security-Policy for your specific needs
3. Add WAF: Consider adding a Web Application Firewall
4. Monitor rate limits: Adjust based on actual traffic patterns
5. Log analysis: Set up log aggregation and alerting

### Rate Limiting Tuning

Current defaults:
- Auth endpoints: 10 requests/second, burst 20
- API endpoints: 50 requests/second, burst 100

Adjust in nginx.conf based on your traffic patterns.

## Migration from Direct Backend Access

If migrating from a setup where the frontend directly accessed the backend:

1. Update frontend build: Set REACT_APP_API_URL=/api
2. Update Docker Compose: Remove backend port exposure
3. Update NGINX config: Add reverse proxy configuration
4. Test thoroughly: Verify all API endpoints work through the gateway
5. Update documentation: Inform users of new access patterns

## Related Documentation

- [Staging Docker Overview](./STAGING-DOCKER-OVERVIEW.md)
- [Security and Secrets Guide](./SECURITY-AND-SECRETS-GUIDE.md)
- [Observability and Health Checks](./OBSERVABILITY-AND-HEALTHCHECKS.md)
- [GRC Deployment and Environments](./GRC-DEPLOYMENT-AND-ENVIRONMENTS.md)
