import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { DataSource } from 'typeorm';
import { AuditLog } from '../src/audit/audit-log.entity';

/**
 * Audit Logging E2E Tests
 *
 * Tests the audit logging functionality including:
 * - Audit log creation for authenticated requests
 * - Event emission and handling
 * - Audit log filtering
 */
describe('Audit Logging (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let authToken: string;
  let tenantId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    dataSource = moduleFixture.get<DataSource>(DataSource);

    // Login to get auth token and tenant ID
    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: process.env.DEMO_ADMIN_EMAIL || 'admin@grc-platform.local',
        password: process.env.DEMO_ADMIN_PASSWORD || 'changeme',
      })
      .expect(200);

    // Handle both wrapped (new) and unwrapped (legacy) response formats
    const responseData = loginResponse.body.data ?? loginResponse.body;
    authToken = responseData.accessToken;
    tenantId = responseData.user?.tenantId;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Audit Log Creation', () => {
    it('should create audit log entry for authenticated request', async () => {
      // Clear existing audit logs for clean test
      const auditLogRepo = dataSource.getRepository(AuditLog);
      await auditLogRepo.clear();

      // Make an authenticated request
      await request(app.getHttpServer())
        .get('/users/count')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Wait a bit for async event handling
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Check that audit log was created
      const auditLogs = await auditLogRepo.find({
        order: { createdAt: 'DESC' },
      });

      expect(auditLogs.length).toBeGreaterThan(0);

      const latestLog = auditLogs[0];
      expect(latestLog.action).toContain('GET');
      expect(latestLog.action).toContain('/users/count');
      expect(latestLog.resource).toBe('users');
      expect(latestLog.userId).toBeDefined();
    });

    it('should create audit log entry for login event', async () => {
      const auditLogRepo = dataSource.getRepository(AuditLog);
      await auditLogRepo.clear();

      // Perform login
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: process.env.DEMO_ADMIN_EMAIL || 'admin@grc-platform.local',
          password: process.env.DEMO_ADMIN_PASSWORD || 'changeme',
        })
        .expect(200);

      // Wait for async event handling
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Check for USER_LOGIN audit log
      const loginLogs = await auditLogRepo.find({
        where: { action: 'USER_LOGIN' },
      });

      expect(loginLogs.length).toBeGreaterThan(0);
      expect(loginLogs[0].resource).toBe('auth');
    });

    it('should create audit log entry for tenant access', async () => {
      if (!tenantId) {
        console.log('Skipping tenant access test - no tenant ID available');
        return;
      }

      const auditLogRepo = dataSource.getRepository(AuditLog);
      await auditLogRepo.clear();

      // Make a tenant-protected request
      await request(app.getHttpServer())
        .get('/tenants/current')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-tenant-id', tenantId)
        .expect(200);

      // Wait for async event handling
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Check for TENANT_ACCESS audit log
      const tenantLogs = await auditLogRepo.find({
        where: { action: 'TENANT_ACCESS' },
      });

      expect(tenantLogs.length).toBeGreaterThan(0);
      expect(tenantLogs[0].tenantId).toBe(tenantId);
    });

    it('should NOT create audit log for health endpoints', async () => {
      const auditLogRepo = dataSource.getRepository(AuditLog);
      await auditLogRepo.clear();

      // Make health check requests
      await request(app.getHttpServer()).get('/health/live').expect(200);
      await request(app.getHttpServer()).get('/health/ready').expect(200);

      // Wait for async event handling
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Check that no audit logs were created for health endpoints
      const healthLogs = await auditLogRepo.find({
        where: { resource: 'health' },
      });

      expect(healthLogs.length).toBe(0);
    });
  });

  describe('Audit Log Metadata', () => {
    it('should include request metadata in audit log', async () => {
      const auditLogRepo = dataSource.getRepository(AuditLog);
      await auditLogRepo.clear();

      // Make an authenticated request
      await request(app.getHttpServer())
        .get('/users/count')
        .set('Authorization', `Bearer ${authToken}`)
        .set('User-Agent', 'test-agent')
        .expect(200);

      // Wait for async event handling
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Check metadata
      const auditLogs = await auditLogRepo.find({
        order: { createdAt: 'DESC' },
      });

      expect(auditLogs.length).toBeGreaterThan(0);

      const latestLog = auditLogs[0];
      expect(latestLog.metadata).toBeDefined();
      expect(latestLog.metadata).toHaveProperty('method', 'GET');
      expect(latestLog.metadata).toHaveProperty('path');
      expect(latestLog.metadata).toHaveProperty('userAgent');
    });
  });
});
