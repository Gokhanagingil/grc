/**
 * Health Endpoint Tests
 * 
 * Tests for /api/health and /api/health/detailed endpoints
 */

const request = require('supertest');

// Import app after environment is set up
let app;

beforeAll(async () => {
  // Initialize app with database
  const result = await global.testUtils.initApp();
  app = result.app;
});

describe('Health Endpoints', () => {
  describe('GET /api/health', () => {
    it('should return 200 OK with health status', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect('Content-Type', /json/)
        .expect(200);
      
      expect(response.body).toHaveProperty('status', 'OK');
      expect(response.body).toHaveProperty('message', 'GRC Platform API is running');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('environment');
      expect(response.body).toHaveProperty('uptime');
      expect(response.body).toHaveProperty('version');
    });
    
    it('should return valid timestamp in ISO format', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);
      
      const timestamp = new Date(response.body.timestamp);
      expect(timestamp).toBeInstanceOf(Date);
      expect(isNaN(timestamp.getTime())).toBe(false);
    });
    
    it('should return uptime as a positive number', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);
      
      expect(typeof response.body.uptime).toBe('number');
      expect(response.body.uptime).toBeGreaterThan(0);
    });
  });
  
    describe('GET /api/health/detailed', () => {
      it('should return detailed health status', async () => {
        const response = await request(app)
          .get('/api/health/detailed')
          .expect('Content-Type', /json/);
      
        // Status can be 200 (OK) or 503 (DEGRADED) depending on DB state
        expect([200, 503]).toContain(response.status);
        expect(response.body).toHaveProperty('status');
        expect(response.body).toHaveProperty('message', 'GRC Platform API health check');
        expect(response.body).toHaveProperty('timestamp');
        expect(response.body).toHaveProperty('environment');
        expect(response.body).toHaveProperty('uptime');
        expect(response.body).toHaveProperty('responseTime');
        expect(response.body).toHaveProperty('checks');
      });
    
      it('should include database info in checks', async () => {
        const response = await request(app)
          .get('/api/health/detailed');
      
        expect(response.body.checks).toHaveProperty('database');
        expect(response.body.checks.database).toHaveProperty('status');
        expect(response.body.checks.database).toHaveProperty('type');
      });
    
      it('should include memory stats in checks', async () => {
        const response = await request(app)
          .get('/api/health/detailed');
      
        expect(response.body.checks).toHaveProperty('memory');
        expect(response.body.checks.memory).toHaveProperty('used');
        expect(response.body.checks.memory).toHaveProperty('total');
      });
    
      it('should return response time as a non-negative number', async () => {
        const response = await request(app)
          .get('/api/health/detailed');
      
        expect(typeof response.body.responseTime).toBe('number');
        expect(response.body.responseTime).toBeGreaterThanOrEqual(0);
      });
    });
});

describe('404 Handler', () => {
  it('should return 404 for non-existent routes', async () => {
    const response = await request(app)
      .get('/api/nonexistent-route')
      .expect('Content-Type', /json/)
      .expect(404);
    
    expect(response.body).toHaveProperty('error', 'Not Found');
    expect(response.body).toHaveProperty('message');
    expect(response.body).toHaveProperty('statusCode', 404);
    expect(response.body).toHaveProperty('timestamp');
  });
  
  it('should include the attempted route in the error message', async () => {
    const response = await request(app)
      .get('/api/some-random-path')
      .expect(404);
    
    expect(response.body.message).toContain('/api/some-random-path');
  });
});
