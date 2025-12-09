const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

// Load and validate configuration (will exit if invalid)
const config = require('./config');

const db = require('./db');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const governanceRoutes = require('./routes/governance');
const riskRoutes = require('./routes/risk');
const complianceRoutes = require('./routes/compliance');
const dashboardRoutes = require('./routes/dashboard');
const todoRoutes = require('./routes/todos');
const dotwalkingRoutes = require('./routes/dotwalking');
const nestProxyRoutes = require('./routes/nest-proxy');
const auditRoutes = require('./routes/audits');
const findingRoutes = require('./routes/findings');
const capaRoutes = require('./routes/capas');
const evidenceRoutes = require('./routes/evidence');

// Platform Core Phase 2 routes
const { aclRoutes, formLayoutRoutes, uiPolicyRoutes, moduleRoutes, searchRoutes, metadataRoutes } = require('./routes/platform');

// Platform Core Phase 7 routes
const requirementsRoutes = require('./routes/requirements');
const metricsRoutes = require('./routes/metrics');

// Platform Core Phase 8 routes
const grcDashboardRoutes = require('./routes/grc-dashboards');

const app = express();

// =============================================================================
// SECURITY MIDDLEWARE
// =============================================================================

// Helmet - Security headers
app.use(helmet());

// CORS - Configured origins (no wildcards in production)
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) {
      return callback(null, true);
    }
    
    if (config.corsOrigins.length === 0) {
      // No origins configured - reject all in production
      return callback(new Error('CORS not allowed'), false);
    }
    
    if (config.corsOrigins.includes(origin)) {
      return callback(null, true);
    }
    
    return callback(new Error(`Origin ${origin} not allowed by CORS`), false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-tenant-id']
};
app.use(cors(corsOptions));

// Request logging
app.use(morgan(config.isProduction ? 'combined' : 'dev'));

// Body parsing with size limits
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// =============================================================================
// RATE LIMITING
// =============================================================================

// Global rate limiter
const globalLimiter = rateLimit({
  windowMs: config.rateLimit.global.windowMs,
  max: config.rateLimit.global.max,
  message: {
    error: 'Too many requests',
    message: 'You have exceeded the rate limit. Please try again later.',
    retryAfter: Math.ceil(config.rateLimit.global.windowMs / 1000)
  },
  standardHeaders: true,
  legacyHeaders: false
});
app.use(globalLimiter);

// Strict rate limiter for auth endpoints
const authLimiter = rateLimit({
  windowMs: config.rateLimit.auth.windowMs,
  max: config.rateLimit.auth.max,
  message: {
    error: 'Too many authentication attempts',
    message: 'Too many login/register attempts. Please try again later.',
    retryAfter: Math.ceil(config.rateLimit.auth.windowMs / 1000)
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false
});

// =============================================================================
// ROUTES
// =============================================================================

// Auth routes with strict rate limiting
app.use('/api/auth', authLimiter, authRoutes);

// Other API routes
app.use('/api/users', userRoutes);
app.use('/api/governance', governanceRoutes);
app.use('/api/risk', riskRoutes);
app.use('/api/compliance', complianceRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/todos', todoRoutes);
app.use('/api/dotwalking', dotwalkingRoutes);
app.use('/api/grc/audits', auditRoutes);
app.use('/api/grc/findings', findingRoutes);
app.use('/api/grc/capas', capaRoutes);
app.use('/api/grc/evidence', evidenceRoutes);

// NestJS backend proxy routes
// Forwards requests to NestJS backend for gradual migration
app.use('/api/nest', nestProxyRoutes);

// Platform Core Phase 2 routes
app.use('/api/platform/acl', aclRoutes);
app.use('/api/platform/form-layouts', formLayoutRoutes);
app.use('/api/platform/ui-policies', uiPolicyRoutes);
app.use('/api/platform/modules', moduleRoutes);
app.use('/api/platform/search', searchRoutes);
app.use('/api/platform/metadata', metadataRoutes);

// Platform Core Phase 7 routes
app.use('/api/grc/requirements', requirementsRoutes);
app.use('/api/grc/metrics', metricsRoutes);

// Platform Core Phase 8 routes - Executive Dashboards
app.use('/api/grc/dashboard', grcDashboardRoutes);

// =============================================================================
// HEALTH CHECK ENDPOINT
// =============================================================================

app.get('/api/health', (req, res) => {
  const healthCheck = {
    status: 'OK',
    message: 'GRC Platform API is running',
    timestamp: new Date().toISOString(),
    environment: config.nodeEnv,
    uptime: process.uptime(),
    version: process.env.npm_package_version || '1.0.0'
  };
  
  res.json(healthCheck);
});

// Detailed health check (for monitoring systems)
app.get('/api/health/detailed', async (req, res) => {
  const startTime = Date.now();
  
  // Check database connectivity using unified interface
  let dbStatus = 'OK';
  let dbType = 'unknown';
  try {
    dbType = db.getDbType();
    await db.get('SELECT 1 as check');
  } catch (error) {
    dbStatus = 'ERROR';
  }
  
  const healthCheck = {
    status: dbStatus === 'OK' ? 'OK' : 'DEGRADED',
    message: 'GRC Platform API health check',
    timestamp: new Date().toISOString(),
    environment: config.nodeEnv,
    uptime: process.uptime(),
    responseTime: Date.now() - startTime,
    checks: {
      database: {
        status: dbStatus,
        type: dbType
      },
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB',
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + 'MB'
      }
    }
  };
  
  const statusCode = healthCheck.status === 'OK' ? 200 : 503;
  res.status(statusCode).json(healthCheck);
});

// =============================================================================
// ERROR HANDLING MIDDLEWARE
// =============================================================================

// CORS error handler
app.use((err, req, res, next) => {
  if (err.message && err.message.includes('CORS')) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Cross-Origin Request Blocked',
      details: config.isProduction ? undefined : err.message
    });
  }
  next(err);
});

// Global error handler
app.use((err, req, res, next) => {
  // Log error details (but not to response in production)
  console.error(`[${new Date().toISOString()}] Error:`, {
    message: err.message,
    stack: config.isDevelopment ? err.stack : undefined,
    path: req.path,
    method: req.method
  });
  
  // Determine status code
  const statusCode = err.statusCode || err.status || 500;
  
  // Build error response
  const errorResponse = {
    error: statusCode >= 500 ? 'Internal Server Error' : 'Request Error',
    message: config.isProduction && statusCode >= 500 
      ? 'An unexpected error occurred. Please try again later.'
      : err.message || 'Something went wrong',
    statusCode,
    timestamp: new Date().toISOString()
  };
  
  // Include stack trace only in development
  if (config.isDevelopment) {
    errorResponse.stack = err.stack;
  }
  
  res.status(statusCode).json(errorResponse);
});

// 404 handler (must be last)
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} not found`,
    statusCode: 404,
    timestamp: new Date().toISOString()
  });
});

// =============================================================================
// SERVER STARTUP
// =============================================================================

// Graceful shutdown handler
const gracefulShutdown = (signal) => {
  console.log(`\n${signal} received. Shutting down gracefully...`);
  server.close(() => {
    console.log('HTTP server closed.');
    process.exit(0);
  });
  
  // Force close after 10 seconds
  setTimeout(() => {
    console.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
};

let server;

// Only auto-start server if not in test mode or if run directly
const isTestEnv = process.env.NODE_ENV === 'test';
const isMainModule = require.main === module;

if (!isTestEnv || isMainModule) {
  // Initialize database and start server
  db.init().then(() => {
    server = app.listen(config.port, () => {
      console.log(`\nGRC Platform API server running on port ${config.port}`);
      console.log(`Environment: ${config.nodeEnv}`);
      console.log(`Health check: http://localhost:${config.port}/api/health`);
    });
    
    // Register shutdown handlers
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    
  }).catch(err => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
  });
}

// Export app and db for testing
module.exports = app;
module.exports.db = db;
