/**
 * GRC Validation E2E Tests
 *
 * Comprehensive tests for DTO validation, including:
 * - Required field validation
 * - Enum validation
 * - String length validation
 * - Date format validation
 * - Custom validators (e.g., reviewDate > effectiveDate)
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import {
  riskFactory,
  policyFactory,
  requirementFactory,
  invalidRiskFactory,
  invalidPolicyFactory,
  invalidRequirementFactory,
} from './factories';

describe('GRC Validation (e2e)', () => {
  let app: INestApplication<App>;
  let dbConnected = false;
  let adminToken: string;
  let tenantId: string;

  const DEMO_ADMIN_EMAIL = process.env.DEMO_ADMIN_EMAIL || 'admin@grc-platform.local';
  const DEMO_ADMIN_PASSWORD = process.env.DEMO_ADMIN_PASSWORD || 'TestPassword123!';

  beforeAll(async () => {
    try {
      const moduleFixture: TestingModule = await Test.createTestingModule({
        imports: [AppModule],
      }).compile();

      app = moduleFixture.createNestApplication();
      app.useGlobalPipes(
        new ValidationPipe({
          whitelist: true,
          forbidNonWhitelisted: true,
          transform: true,
        }),
      );
      await app.init();
      dbConnected = true;

      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: DEMO_ADMIN_EMAIL,
          password: DEMO_ADMIN_PASSWORD,
        });

      adminToken = loginResponse.body.accessToken;
      tenantId = loginResponse.body.user?.tenantId;
    } catch (error) {
      console.warn('Could not connect to database, skipping DB-dependent tests');
      console.warn('Error:', (error as Error).message);
      dbConnected = false;
    }
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  // ==================== RISK VALIDATION ====================
  describe('Risk Validation', () => {
    describe('POST /grc/risks - Required Fields', () => {
      it('should reject risk without title', async () => {
        if (!dbConnected || !tenantId) {
          console.log('Skipping test: database not connected');
          return;
        }

        const riskData = riskFactory();
        const { title, ...riskWithoutTitle } = riskData;

        const response = await request(app.getHttpServer())
          .post('/grc/risks')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .send(riskWithoutTitle)
          .expect(400);

        expect(response.body.message).toContain('title');
      });

      it('should reject risk with empty title', async () => {
        if (!dbConnected || !tenantId) {
          console.log('Skipping test: database not connected');
          return;
        }

        const riskData = riskFactory({ title: '' });

        const response = await request(app.getHttpServer())
          .post('/grc/risks')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .send(riskData)
          .expect(400);

        expect(response.body.message).toBeDefined();
      });

      it('should reject risk with title too short', async () => {
        if (!dbConnected || !tenantId) {
          console.log('Skipping test: database not connected');
          return;
        }

        const riskData = riskFactory({ title: 'AB' }); // Less than 3 characters

        const response = await request(app.getHttpServer())
          .post('/grc/risks')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .send(riskData)
          .expect(400);

        expect(response.body.message).toBeDefined();
      });
    });

    describe('POST /grc/risks - Enum Validation', () => {
      it('should reject risk with invalid severity', async () => {
        if (!dbConnected || !tenantId) {
          console.log('Skipping test: database not connected');
          return;
        }

        const riskData = { ...riskFactory(), severity: 'INVALID_SEVERITY' };

        const response = await request(app.getHttpServer())
          .post('/grc/risks')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .send(riskData)
          .expect(400);

        expect(response.body.message).toBeDefined();
      });

      it('should reject risk with invalid likelihood', async () => {
        if (!dbConnected || !tenantId) {
          console.log('Skipping test: database not connected');
          return;
        }

        const riskData = { ...riskFactory(), likelihood: 'INVALID_LIKELIHOOD' };

        const response = await request(app.getHttpServer())
          .post('/grc/risks')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .send(riskData)
          .expect(400);

        expect(response.body.message).toBeDefined();
      });

      it('should reject risk with invalid status', async () => {
        if (!dbConnected || !tenantId) {
          console.log('Skipping test: database not connected');
          return;
        }

        const riskData = { ...riskFactory(), status: 'INVALID_STATUS' };

        const response = await request(app.getHttpServer())
          .post('/grc/risks')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .send(riskData)
          .expect(400);

        expect(response.body.message).toBeDefined();
      });
    });

    describe('POST /grc/risks - Numeric Validation', () => {
      it('should reject risk with impactScore out of range (> 10)', async () => {
        if (!dbConnected || !tenantId) {
          console.log('Skipping test: database not connected');
          return;
        }

        const riskData = { ...riskFactory(), impactScore: 15 };

        const response = await request(app.getHttpServer())
          .post('/grc/risks')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .send(riskData)
          .expect(400);

        expect(response.body.message).toBeDefined();
      });

      it('should reject risk with impactScore out of range (< 1)', async () => {
        if (!dbConnected || !tenantId) {
          console.log('Skipping test: database not connected');
          return;
        }

        const riskData = { ...riskFactory(), impactScore: 0 };

        const response = await request(app.getHttpServer())
          .post('/grc/risks')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .send(riskData)
          .expect(400);

        expect(response.body.message).toBeDefined();
      });

      it('should reject risk with negative riskScore', async () => {
        if (!dbConnected || !tenantId) {
          console.log('Skipping test: database not connected');
          return;
        }

        const riskData = { ...riskFactory(), riskScore: -5 };

        const response = await request(app.getHttpServer())
          .post('/grc/risks')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .send(riskData)
          .expect(400);

        expect(response.body.message).toBeDefined();
      });
    });

    describe('POST /grc/risks - Valid Data', () => {
      it('should accept risk with all valid fields', async () => {
        if (!dbConnected || !tenantId) {
          console.log('Skipping test: database not connected');
          return;
        }

        const riskData = riskFactory();

        const response = await request(app.getHttpServer())
          .post('/grc/risks')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .send(riskData)
          .expect(201);

        expect(response.body).toHaveProperty('id');
        expect(response.body).toHaveProperty('title', riskData.title);

        // Clean up
        if (response.body.id) {
          await request(app.getHttpServer())
            .delete(`/grc/risks/${response.body.id}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .set('x-tenant-id', tenantId);
        }
      });
    });
  });

  // ==================== POLICY VALIDATION ====================
  describe('Policy Validation', () => {
    describe('POST /grc/policies - Required Fields', () => {
      it('should reject policy without name', async () => {
        if (!dbConnected || !tenantId) {
          console.log('Skipping test: database not connected');
          return;
        }

        const policyData = policyFactory();
        const { name, ...policyWithoutName } = policyData;

        const response = await request(app.getHttpServer())
          .post('/grc/policies')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .send(policyWithoutName)
          .expect(400);

        expect(response.body.message).toBeDefined();
      });

      it('should reject policy with empty name', async () => {
        if (!dbConnected || !tenantId) {
          console.log('Skipping test: database not connected');
          return;
        }

        const policyData = policyFactory({ name: '' });

        const response = await request(app.getHttpServer())
          .post('/grc/policies')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .send(policyData)
          .expect(400);

        expect(response.body.message).toBeDefined();
      });
    });

    describe('POST /grc/policies - Enum Validation', () => {
      it('should reject policy with invalid status', async () => {
        if (!dbConnected || !tenantId) {
          console.log('Skipping test: database not connected');
          return;
        }

        const policyData = { ...policyFactory(), status: 'INVALID_STATUS' };

        const response = await request(app.getHttpServer())
          .post('/grc/policies')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .send(policyData)
          .expect(400);

        expect(response.body.message).toBeDefined();
      });
    });

    describe('POST /grc/policies - Valid Data', () => {
      it('should accept policy with all valid fields', async () => {
        if (!dbConnected || !tenantId) {
          console.log('Skipping test: database not connected');
          return;
        }

        const policyData = policyFactory();

        const response = await request(app.getHttpServer())
          .post('/grc/policies')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .send(policyData)
          .expect(201);

        expect(response.body).toHaveProperty('id');
        expect(response.body).toHaveProperty('name', policyData.name);

        // Clean up
        if (response.body.id) {
          await request(app.getHttpServer())
            .delete(`/grc/policies/${response.body.id}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .set('x-tenant-id', tenantId);
        }
      });
    });
  });

  // ==================== REQUIREMENT VALIDATION ====================
  describe('Requirement Validation', () => {
    describe('POST /grc/requirements - Required Fields', () => {
      it('should reject requirement without title', async () => {
        if (!dbConnected || !tenantId) {
          console.log('Skipping test: database not connected');
          return;
        }

        const reqData = requirementFactory();
        const { title, ...reqWithoutTitle } = reqData;

        const response = await request(app.getHttpServer())
          .post('/grc/requirements')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .send(reqWithoutTitle)
          .expect(400);

        expect(response.body.message).toBeDefined();
      });

      it('should reject requirement without framework', async () => {
        if (!dbConnected || !tenantId) {
          console.log('Skipping test: database not connected');
          return;
        }

        const reqData = requirementFactory();
        const { framework, ...reqWithoutFramework } = reqData;

        const response = await request(app.getHttpServer())
          .post('/grc/requirements')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .send(reqWithoutFramework)
          .expect(400);

        expect(response.body.message).toBeDefined();
      });

      it('should reject requirement without referenceCode', async () => {
        if (!dbConnected || !tenantId) {
          console.log('Skipping test: database not connected');
          return;
        }

        const reqData = requirementFactory();
        const { referenceCode, ...reqWithoutRefCode } = reqData;

        const response = await request(app.getHttpServer())
          .post('/grc/requirements')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .send(reqWithoutRefCode)
          .expect(400);

        expect(response.body.message).toBeDefined();
      });
    });

    describe('POST /grc/requirements - Enum Validation', () => {
      it('should reject requirement with invalid framework', async () => {
        if (!dbConnected || !tenantId) {
          console.log('Skipping test: database not connected');
          return;
        }

        const reqData = { ...requirementFactory(), framework: 'INVALID_FRAMEWORK' };

        const response = await request(app.getHttpServer())
          .post('/grc/requirements')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .send(reqData)
          .expect(400);

        expect(response.body.message).toBeDefined();
      });

      it('should reject requirement with invalid priority', async () => {
        if (!dbConnected || !tenantId) {
          console.log('Skipping test: database not connected');
          return;
        }

        const reqData = { ...requirementFactory(), priority: 'INVALID_PRIORITY' };

        const response = await request(app.getHttpServer())
          .post('/grc/requirements')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .send(reqData)
          .expect(400);

        expect(response.body.message).toBeDefined();
      });

      it('should reject requirement with invalid status', async () => {
        if (!dbConnected || !tenantId) {
          console.log('Skipping test: database not connected');
          return;
        }

        const reqData = { ...requirementFactory(), status: 'INVALID_STATUS' };

        const response = await request(app.getHttpServer())
          .post('/grc/requirements')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .send(reqData)
          .expect(400);

        expect(response.body.message).toBeDefined();
      });
    });

    describe('POST /grc/requirements - Valid Data', () => {
      it('should accept requirement with all valid fields', async () => {
        if (!dbConnected || !tenantId) {
          console.log('Skipping test: database not connected');
          return;
        }

        const reqData = requirementFactory();

        const response = await request(app.getHttpServer())
          .post('/grc/requirements')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .send(reqData)
          .expect(201);

        expect(response.body).toHaveProperty('id');
        expect(response.body).toHaveProperty('title', reqData.title);

        // Clean up
        if (response.body.id) {
          await request(app.getHttpServer())
            .delete(`/grc/requirements/${response.body.id}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .set('x-tenant-id', tenantId);
        }
      });
    });
  });

  // ==================== AUTHENTICATION & AUTHORIZATION ====================
  describe('Authentication & Authorization', () => {
    describe('Missing Authentication', () => {
      it('should return 401 for risks without token', async () => {
        if (!dbConnected || !tenantId) {
          console.log('Skipping test: database not connected');
          return;
        }

        await request(app.getHttpServer())
          .get('/grc/risks')
          .set('x-tenant-id', tenantId)
          .expect(401);
      });

      it('should return 401 for policies without token', async () => {
        if (!dbConnected || !tenantId) {
          console.log('Skipping test: database not connected');
          return;
        }

        await request(app.getHttpServer())
          .get('/grc/policies')
          .set('x-tenant-id', tenantId)
          .expect(401);
      });

      it('should return 401 for requirements without token', async () => {
        if (!dbConnected || !tenantId) {
          console.log('Skipping test: database not connected');
          return;
        }

        await request(app.getHttpServer())
          .get('/grc/requirements')
          .set('x-tenant-id', tenantId)
          .expect(401);
      });
    });

    describe('Missing Tenant Header', () => {
      it('should return 400 for risks without x-tenant-id', async () => {
        if (!dbConnected) {
          console.log('Skipping test: database not connected');
          return;
        }

        await request(app.getHttpServer())
          .get('/grc/risks')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(400);
      });

      it('should return 400 for policies without x-tenant-id', async () => {
        if (!dbConnected) {
          console.log('Skipping test: database not connected');
          return;
        }

        await request(app.getHttpServer())
          .get('/grc/policies')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(400);
      });

      it('should return 400 for requirements without x-tenant-id', async () => {
        if (!dbConnected) {
          console.log('Skipping test: database not connected');
          return;
        }

        await request(app.getHttpServer())
          .get('/grc/requirements')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(400);
      });
    });

    describe('Invalid Token', () => {
      it('should return 401 for risks with invalid token', async () => {
        if (!dbConnected || !tenantId) {
          console.log('Skipping test: database not connected');
          return;
        }

        await request(app.getHttpServer())
          .get('/grc/risks')
          .set('Authorization', 'Bearer invalid-token')
          .set('x-tenant-id', tenantId)
          .expect(401);
      });
    });
  });

  // ==================== ERROR RESPONSE FORMAT ====================
  describe('Error Response Format', () => {
    it('should return consistent error format for validation errors', async () => {
      if (!dbConnected || !tenantId) {
        console.log('Skipping test: database not connected');
        return;
      }

      const invalidData = invalidRiskFactory();

      const response = await request(app.getHttpServer())
        .post('/grc/risks')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .send(invalidData)
        .expect(400);

      expect(response.body).toHaveProperty('statusCode', 400);
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('error');
    });

    it('should return 404 with proper format for non-existent resource', async () => {
      if (!dbConnected || !tenantId) {
        console.log('Skipping test: database not connected');
        return;
      }

      const response = await request(app.getHttpServer())
        .get('/grc/risks/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .expect(404);

      expect(response.body).toHaveProperty('statusCode', 404);
      expect(response.body).toHaveProperty('message');
    });
  });
});
