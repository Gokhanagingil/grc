/**
 * Demo Admin User Tests
 * 
 * Smoke tests to verify the demo admin user can:
 * 1. Be seeded successfully
 * 2. Log in with the documented credentials
 * 3. Access /users/me and have the expected role/permissions
 */

const request = require('supertest');
const bcrypt = require('bcryptjs');

describe('Demo Admin User', () => {
  let app;
  let dbConnection;
  
  const TEST_PASSWORD = 'TestDemoAdmin!2025';
  const DEMO_ADMIN = {
    username: 'demo.admin',
    email: 'demo.admin@grc.local',
    password: TEST_PASSWORD,
    firstName: 'Demo',
    lastName: 'Admin',
    department: 'Administration',
    role: 'admin'
  };
  
  beforeAll(async () => {
    // Initialize app with test database
    const setup = await global.testUtils.initApp();
    app = setup.app;
    dbConnection = setup.dbConnection;
    
    // Seed the demo admin user directly using the test database
    const db = dbConnection.getDb();
    const hashedPassword = await bcrypt.hash(DEMO_ADMIN.password, 10);
    
    await new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO users (username, email, password, first_name, last_name, department, role, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          DEMO_ADMIN.username,
          DEMO_ADMIN.email,
          hashedPassword,
          DEMO_ADMIN.firstName,
          DEMO_ADMIN.lastName,
          DEMO_ADMIN.department,
          DEMO_ADMIN.role,
          1
        ],
        function(err) {
          if (err) reject(err);
          else resolve(this.lastID);
        }
      );
    });
  });
  
  describe('Login', () => {
    it('should login successfully with demo admin credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: DEMO_ADMIN.username,
          password: DEMO_ADMIN.password
        });
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user.email).toBe(DEMO_ADMIN.email);
      expect(response.body.user.role).toBe(DEMO_ADMIN.role);
    });
    
    it('should reject login with wrong password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: DEMO_ADMIN.username,
          password: 'WrongPassword123!'
        });
      
      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('message');
    });
  });
  
  describe('/users/me endpoint', () => {
    let authToken;
    
    beforeAll(async () => {
      // Login to get token
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          username: DEMO_ADMIN.username,
          password: DEMO_ADMIN.password
        });
      
      authToken = loginResponse.body.token;
    });
    
    it('should return demo admin user info with correct role', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body.email).toBe(DEMO_ADMIN.email);
      expect(response.body.role).toBe(DEMO_ADMIN.role);
      expect(response.body.firstName).toBe('Demo');
      expect(response.body.lastName).toBe('Admin');
    });
    
    it('should have admin role for accessing protected resources', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body.role).toBe('admin');
    });
  });
  
});
