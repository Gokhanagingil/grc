/**
 * NestJS Proxy Route Tests
 *
 * Tests the Express → NestJS proxy functionality.
 * Uses mocked fetch to avoid requiring a running NestJS server.
 */

const request = require('supertest');

// Mock fetch before requiring the app
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Now require the app after mocking fetch
const app = require('../server');

describe('NestJS Proxy Routes', () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  describe('GET /api/nest/health', () => {
    it('should proxy health check to NestJS and return success', async () => {
      // Mock successful NestJS health response
      mockFetch.mockResolvedValueOnce({
        status: 200,
        headers: {
          get: (name) => (name === 'content-type' ? 'application/json' : null),
        },
        json: async () => ({
          status: 'ok',
          info: {
            database: { status: 'up' },
          },
        }),
      });

      const response = await request(app).get('/api/nest/health').expect(200);

      expect(response.body).toHaveProperty('status', 'ok');
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/health/ready'),
        expect.any(Object)
      );
    });

    it('should return 502 when NestJS is unavailable', async () => {
      // Mock network error
      mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'));

      const response = await request(app).get('/api/nest/health').expect(502);

      expect(response.body).toHaveProperty('error', 'Bad Gateway');
      expect(response.body).toHaveProperty(
        'message',
        'NestJS backend is not available'
      );
    });
  });

  describe('Header Forwarding', () => {
    it('should forward Authorization header to NestJS', async () => {
      mockFetch.mockResolvedValueOnce({
        status: 200,
        headers: {
          get: (name) => (name === 'content-type' ? 'application/json' : null),
        },
        json: async () => ({ success: true }),
      });

      await request(app)
        .get('/api/nest/users/me')
        .set('Authorization', 'Bearer test-token')
        .expect(200);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-token',
          }),
        })
      );
    });

    it('should forward x-tenant-id header to NestJS', async () => {
      mockFetch.mockResolvedValueOnce({
        status: 200,
        headers: {
          get: (name) => (name === 'content-type' ? 'application/json' : null),
        },
        json: async () => ({ success: true }),
      });

      await request(app)
        .get('/api/nest/tenants/current')
        .set('x-tenant-id', 'test-tenant-uuid')
        .expect(200);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'x-tenant-id': 'test-tenant-uuid',
          }),
        })
      );
    });
  });

  describe('HTTP Method Proxying', () => {
    it('should proxy POST requests with body', async () => {
      mockFetch.mockResolvedValueOnce({
        status: 201,
        headers: {
          get: (name) => (name === 'content-type' ? 'application/json' : null),
        },
        json: async () => ({ id: 'new-id', created: true }),
      });

      const response = await request(app)
        .post('/api/nest/risks')
        .send({ title: 'Test Risk', severity: 'high' })
        .expect(201);

      expect(response.body).toHaveProperty('created', true);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/risks'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ title: 'Test Risk', severity: 'high' }),
        })
      );
    });

    it('should proxy PUT requests', async () => {
      mockFetch.mockResolvedValueOnce({
        status: 200,
        headers: {
          get: (name) => (name === 'content-type' ? 'application/json' : null),
        },
        json: async () => ({ updated: true }),
      });

      await request(app)
        .put('/api/nest/risks/123')
        .send({ title: 'Updated Risk' })
        .expect(200);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/risks/123'),
        expect.objectContaining({
          method: 'PUT',
        })
      );
    });

    it('should proxy DELETE requests', async () => {
      mockFetch.mockResolvedValueOnce({
        status: 204,
        headers: {
          get: () => null,
        },
        text: async () => '',
      });

      await request(app).delete('/api/nest/risks/123').expect(204);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/risks/123'),
        expect.objectContaining({
          method: 'DELETE',
        })
      );
    });
  });

  describe('Error Response Proxying', () => {
    it('should proxy 401 Unauthorized from NestJS', async () => {
      mockFetch.mockResolvedValueOnce({
        status: 401,
        headers: {
          get: (name) => (name === 'content-type' ? 'application/json' : null),
        },
        json: async () => ({
          statusCode: 401,
          message: 'Unauthorized',
        }),
      });

      const response = await request(app).get('/api/nest/users/me').expect(401);

      expect(response.body).toHaveProperty('message', 'Unauthorized');
    });

    it('should proxy 403 Forbidden from NestJS', async () => {
      mockFetch.mockResolvedValueOnce({
        status: 403,
        headers: {
          get: (name) => (name === 'content-type' ? 'application/json' : null),
        },
        json: async () => ({
          statusCode: 403,
          message: 'Forbidden resource',
        }),
      });

      const response = await request(app)
        .get('/api/nest/admin-only')
        .set('Authorization', 'Bearer user-token')
        .expect(403);

      expect(response.body).toHaveProperty('message', 'Forbidden resource');
    });

    it('should proxy 404 Not Found from NestJS', async () => {
      mockFetch.mockResolvedValueOnce({
        status: 404,
        headers: {
          get: (name) => (name === 'content-type' ? 'application/json' : null),
        },
        json: async () => ({
          statusCode: 404,
          message: 'Not Found',
        }),
      });

      const response = await request(app)
        .get('/api/nest/nonexistent')
        .expect(404);

      expect(response.body).toHaveProperty('message', 'Not Found');
    });
  });
});
