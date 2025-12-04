/**
 * NestJS Backend Proxy Routes
 *
 * This module provides a proxy to forward requests from the Express backend
 * to the NestJS backend. This enables gradual migration of functionality
 * from Express to NestJS while maintaining a single API endpoint for the frontend.
 *
 * Usage:
 * - All requests to /api/nest/* are forwarded to the NestJS backend
 * - Authorization and x-tenant-id headers are preserved
 * - Response status codes and bodies are returned transparently
 *
 * Configuration:
 * - NEST_API_BASE_URL: Base URL for NestJS backend (default: http://localhost:3002)
 */

const express = require('express');
const router = express.Router();
const config = require('../config');

/**
 * Helper function to make HTTP requests to NestJS backend
 * Uses native fetch (available in Node.js 18+) or falls back to http module
 */
async function proxyToNest(req, targetPath) {
  const url = `${config.nestApiBaseUrl}${targetPath}`;

  const headers = {
    'Content-Type': 'application/json',
  };

  // Forward Authorization header if present
  if (req.headers.authorization) {
    headers['Authorization'] = req.headers.authorization;
  }

  // Forward x-tenant-id header if present
  if (req.headers['x-tenant-id']) {
    headers['x-tenant-id'] = req.headers['x-tenant-id'];
  }

  // Forward User-Agent for audit logging
  if (req.headers['user-agent']) {
    headers['User-Agent'] = req.headers['user-agent'];
  }

  // Forward X-Forwarded-For for IP tracking
  const clientIp = req.ip || req.connection?.remoteAddress;
  if (clientIp) {
    headers['X-Forwarded-For'] = clientIp;
  }

  const fetchOptions = {
    method: req.method,
    headers,
  };

  // Include body for POST, PUT, PATCH requests
  if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.body) {
    fetchOptions.body = JSON.stringify(req.body);
  }

  const response = await fetch(url, fetchOptions);

  // Parse response body
  let body;
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    body = await response.json();
  } else {
    body = await response.text();
  }

  return {
    status: response.status,
    body,
    contentType,
  };
}

/**
 * Health check proxy - GET /api/nest/health
 *
 * Forwards to NestJS /health/ready endpoint to verify NestJS backend is running
 * and database connection is healthy.
 */
router.get('/health', async (req, res) => {
  try {
    const result = await proxyToNest(req, '/health/ready');
    res.status(result.status).json(result.body);
  } catch (error) {
    // NestJS backend is not reachable
    res.status(502).json({
      error: 'Bad Gateway',
      message: 'NestJS backend is not available',
      details:
        config.nodeEnv === 'development' ? error.message : undefined,
      nestApiBaseUrl:
        config.nodeEnv === 'development' ? config.nestApiBaseUrl : undefined,
    });
  }
});

/**
 * Catch-all proxy - ALL /api/nest/*
 *
 * Forwards any request to the NestJS backend, preserving:
 * - HTTP method
 * - Request path (minus /api/nest prefix)
 * - Authorization header
 * - x-tenant-id header
 * - Request body
 */
router.all('/*', async (req, res) => {
  try {
    // Remove /api/nest prefix to get the target path
    // req.path will be like /users/me, /tenants/current, etc.
    const targetPath = req.path;

    const result = await proxyToNest(req, targetPath);

    // Set content type if available
    if (result.contentType) {
      res.set('Content-Type', result.contentType);
    }

    res.status(result.status);

    // Send response body
    if (typeof result.body === 'object') {
      res.json(result.body);
    } else {
      res.send(result.body);
    }
  } catch (error) {
    // NestJS backend is not reachable
    res.status(502).json({
      error: 'Bad Gateway',
      message: 'NestJS backend is not available',
      details:
        config.nodeEnv === 'development' ? error.message : undefined,
      nestApiBaseUrl:
        config.nodeEnv === 'development' ? config.nestApiBaseUrl : undefined,
    });
  }
});

module.exports = router;
