import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';

describe('Risk E2E', () => {
  let app: INestApplication;
  let accessToken: string;
  const tenantA = '217492b2-f814-4ba0-ae50-4e4f8ecf6216';
  const tenantB = '00000000-0000-0000-0000-000000000001';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    // Login to get token
    const loginResponse = await request(app.getHttpServer())
      .post('/api/v2/auth/login')
      .send({ email: 'admin@local', password: 'Admin!123' })
      .expect(200);

    accessToken = loginResponse.body.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Tenant Guard', () => {
    it('should return 400/401 without x-tenant-id header', () => {
      return request(app.getHttpServer())
        .get('/api/v2/risk/risks')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(400);
    });

    it('should return 200 with valid tenant header', () => {
      return request(app.getHttpServer())
        .get('/api/v2/risk/risks')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-id', tenantA)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('items');
          expect(res.body).toHaveProperty('total');
        });
    });
  });

  describe('CRUD Operations', () => {
    let riskId: string;

    it('should create a risk (POST)', () => {
      return request(app.getHttpServer())
        .post('/api/v2/risk')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-id', tenantA)
        .send({
          title: 'Test Risk Tenant A',
          description: 'E2E test risk',
          category: 'Security',
          severity: 'High',
        })
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('id');
          expect(res.body.title).toBe('Test Risk Tenant A');
          expect(res.body.tenant_id).toBe(tenantA);
          riskId = res.body.id;
        });
    });

    it('should get risk by id (GET)', () => {
      return request(app.getHttpServer())
        .get(`/api/v2/risk/${riskId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-id', tenantA)
        .expect(200)
        .expect((res) => {
          expect(res.body.id).toBe(riskId);
          expect(res.body.tenant_id).toBe(tenantA);
        });
    });

    it('should update risk (PATCH)', () => {
      return request(app.getHttpServer())
        .patch(`/api/v2/risk/${riskId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-id', tenantA)
        .send({ severity: 'Critical' })
        .expect(200)
        .expect((res) => {
          expect(res.body.severity).toBe('Critical');
        });
    });

    it('should delete risk (DELETE)', () => {
      return request(app.getHttpServer())
        .delete(`/api/v2/risk/${riskId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-id', tenantA)
        .expect(200);
    });
  });

  describe('Multi-Tenant Isolation', () => {
    let tenantARiskId: string;

    beforeAll(async () => {
      // Create risk in Tenant A
      const createResponse = await request(app.getHttpServer())
        .post('/api/v2/risk')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-id', tenantA)
        .send({
          title: 'Tenant A Risk',
          description: 'Isolated to Tenant A',
          category: 'Security',
        })
        .expect(201);

      tenantARiskId = createResponse.body.id;
    });

    it('should not list Tenant A risks in Tenant B', () => {
      return request(app.getHttpServer())
        .get('/api/v2/risk/risks')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-id', tenantB)
        .expect(200)
        .expect((res) => {
          expect(res.body.items).toHaveLength(0);
          expect(res.body.total).toBe(0);
        });
    });

    it('should not get Tenant A risk with Tenant B header', () => {
      return request(app.getHttpServer())
        .get(`/api/v2/risk/${tenantARiskId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-id', tenantB)
        .expect(404);
    });
  });
});
