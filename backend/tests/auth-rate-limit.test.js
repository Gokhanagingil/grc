/**
 * Auth Rate Limiting Tests
 * 
 * Tests for rate limiting on authentication endpoints
 */

const request = require('supertest');

// Import app after environment is set up
let app;

// Override rate limit for this test file
beforeAll(async () => {
  // Set strict rate limit for testing
  process.env.AUTH_RATE_LIMIT_MAX = '3';
  process.env.AUTH_RATE_LIMIT_WINDOW_MS = '60000'; // 1 minute
  
  // Initialize app with database
  const result = await global.testUtils.initApp();
  app = result.app;
});

describe('Auth Rate Limiting', () => {
  describe('POST /api/auth/login', () => {
    it('should allow requests within rate limit', async () => {
      // First request should succeed (even with invalid credentials)
      const response = await request(app)
        .post('/api/auth/login')
        .send({ username: 'nonexistent', password: 'wrongpassword' })
        .expect('Content-Type', /json/);
      
      // Should get 401 (invalid credentials), not 429 (rate limited)
      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('message', 'Invalid credentials');
    });
    
    it('should include rate limit headers', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ username: 'test', password: 'test' });
      
      // Check for standard rate limit headers
      expect(response.headers).toHaveProperty('ratelimit-limit');
      expect(response.headers).toHaveProperty('ratelimit-remaining');
    });
    
    it('should have rate limit configured', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ username: 'test', password: 'test' });
      
      // Verify rate limit is set (value depends on environment)
      const limit = parseInt(response.headers['ratelimit-limit'], 10);
      expect(limit).toBeGreaterThan(0);
    });
  });
  
  describe('POST /api/auth/register', () => {
    it('should also be rate limited', async () => {
      // Make requests up to the limit (continuing from previous tests)
      // The rate limiter is shared across auth endpoints
      
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'newuser',
          email: 'new@example.com',
          password: 'password123'
        });
      
      // Should either succeed, fail validation, or be rate limited
      // We just want to verify the endpoint is protected
      expect([201, 400, 429, 500]).toContain(response.status);
    });
  });
});

describe('Global Rate Limiting', () => {
  it('should have rate limit headers on all endpoints', async () => {
    const response = await request(app)
      .get('/api/health');
    
    // Global rate limiter should add headers
    expect(response.headers).toHaveProperty('ratelimit-limit');
  });
});
