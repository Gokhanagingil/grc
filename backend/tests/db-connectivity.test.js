/**
 * Database Connectivity Tests
 * 
 * Tests to verify database connection and basic operations
 */

const request = require('supertest');

// Import app after environment is set up
let app;

beforeAll(async () => {
  // Initialize app with database
  const result = await global.testUtils.initApp();
  app = result.app;
});

describe('Database Connectivity', () => {
  describe('via /api/health/detailed endpoint', () => {
    it('should report database status', async () => {
      const response = await request(app)
        .get('/api/health/detailed');
      
      // Status can be OK or ERROR depending on DB state
      expect(['OK', 'ERROR']).toContain(response.body.checks.database.status);
    });
    
    it('should report database type', async () => {
      const response = await request(app)
        .get('/api/health/detailed');
      
      // In test environment, we use SQLite
      expect(response.body.checks.database.type).toBe('sqlite');
    });
  });
  
  describe('via auth endpoints (implicit DB test)', () => {
    it('should be able to query users table via login', async () => {
      // This tests that the database is accessible and the users table exists
      const response = await request(app)
        .post('/api/auth/login')
        .send({ username: 'nonexistent', password: 'password' })
        .expect('Content-Type', /json/);
      
      // Should get 401 (user not found), not 500 (database error)
      expect(response.status).toBe(401);
      expect(response.body.message).toBe('Invalid credentials');
    });
    
    it('should be able to register a new user (write test)', async () => {
      const userData = global.testUtils.createUserPayload();
      
      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect('Content-Type', /json/);
      
      // Should succeed with 201
      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('message', 'User created successfully');
      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user.username).toBe(userData.username);
    });
    
    it('should prevent duplicate user registration', async () => {
      const userData = global.testUtils.createUserPayload();
      
      // First registration should succeed
      await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(201);
      
      // Second registration with same username should fail
      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(400);
      
      expect(response.body.message).toBe('User already exists');
    });
    
    it('should be able to login with registered user', async () => {
      const userData = global.testUtils.createUserPayload();
      
      // Register user
      await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(201);
      
      // Login with same credentials
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: userData.username,
          password: userData.password
        })
        .expect(200);
      
      expect(response.body).toHaveProperty('message', 'Login successful');
      expect(response.body).toHaveProperty('token');
      expect(response.body.user.username).toBe(userData.username);
    });
  });
});

describe('Database Error Handling', () => {
  it('should return proper error for missing required fields', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .send({ username: 'test' }) // Missing email and password
      .expect(400);
    
    expect(response.body).toHaveProperty('message');
    expect(response.body.message).toContain('required');
  });
});
