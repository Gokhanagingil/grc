import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { DataSource } from 'typeorm';
import { TenantSetting } from '../src/settings/tenant-setting.entity';

/**
 * Settings E2E Tests
 *
 * Tests the settings functionality including:
 * - System settings retrieval
 * - Tenant-specific settings with fallback
 * - Admin-only access control
 */
describe('Settings (e2e)', () => {
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
      .expect(201);

    authToken = loginResponse.body.accessToken;
    tenantId = loginResponse.body.user.tenantId;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /settings/system', () => {
    it('should return all system settings for admin user', async () => {
      const response = await request(app.getHttpServer())
        .get('/settings/system')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('settings');
      expect(Array.isArray(response.body.settings)).toBe(true);

      // Check that default settings were seeded
      const keys = response.body.settings.map((s: { key: string }) => s.key);
      expect(keys).toContain('maxLoginAttempts');
      expect(keys).toContain('defaultLocale');
    });

    it('should reject unauthenticated requests', async () => {
      await request(app.getHttpServer()).get('/settings/system').expect(401);
    });
  });

  describe('GET /settings/effective', () => {
    it('should return system setting when no tenant override exists', async () => {
      const response = await request(app.getHttpServer())
        .get('/settings/effective?key=maxLoginAttempts')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('key', 'maxLoginAttempts');
      expect(response.body).toHaveProperty('value', '5');
      expect(response.body).toHaveProperty('source', 'system');
    });

    it('should return tenant setting when override exists', async () => {
      if (!tenantId) {
        console.log('Skipping tenant override test - no tenant ID available');
        return;
      }

      // Create a tenant-specific setting
      const tenantSettingRepo = dataSource.getRepository(TenantSetting);
      await tenantSettingRepo.save({
        tenantId,
        key: 'maxLoginAttempts',
        value: '10',
      });

      const response = await request(app.getHttpServer())
        .get('/settings/effective?key=maxLoginAttempts')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-tenant-id', tenantId)
        .expect(200);

      expect(response.body).toHaveProperty('key', 'maxLoginAttempts');
      expect(response.body).toHaveProperty('value', '10');
      expect(response.body).toHaveProperty('source', 'tenant');

      // Clean up
      await tenantSettingRepo.delete({ tenantId, key: 'maxLoginAttempts' });
    });

    it('should return null for non-existent setting', async () => {
      const response = await request(app.getHttpServer())
        .get('/settings/effective?key=nonExistentSetting')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('key', 'nonExistentSetting');
      expect(response.body).toHaveProperty('value', null);
      expect(response.body).toHaveProperty('source', 'none');
    });

    it('should require key parameter', async () => {
      await request(app.getHttpServer())
        .get('/settings/effective')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);
    });
  });

  describe('GET /settings/tenant', () => {
    it('should require x-tenant-id header', async () => {
      await request(app.getHttpServer())
        .get('/settings/tenant')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);
    });

    it('should return tenant settings when header is provided', async () => {
      if (!tenantId) {
        console.log('Skipping tenant settings test - no tenant ID available');
        return;
      }

      const response = await request(app.getHttpServer())
        .get('/settings/tenant')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-tenant-id', tenantId)
        .expect(200);

      expect(response.body).toHaveProperty('settings');
      expect(Array.isArray(response.body.settings)).toBe(true);
    });
  });
});
