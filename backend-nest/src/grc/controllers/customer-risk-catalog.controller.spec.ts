import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { CustomerRiskCatalogController } from './customer-risk-catalog.controller';
import { CustomerRiskCatalogService } from '../services/customer-risk-catalog.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../tenants/guards/tenant.guard';
import { PermissionsGuard } from '../../auth/permissions/permissions.guard';

const TENANT_A = '00000000-0000-0000-0000-000000000001';
const TENANT_B = '00000000-0000-0000-0000-000000000099';
const USER_ID = '00000000-0000-0000-0000-000000000002';

const mockCatalogRisk = {
  id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  tenantId: TENANT_A,
  code: 'CRK-000001',
  title: 'OS End-of-Support',
  category: 'OS_LIFECYCLE',
  signalType: 'STATIC_FLAG',
  severity: 'CRITICAL',
  likelihoodWeight: 90,
  impactWeight: 85,
  scoreContributionModel: 'FLAT_POINTS',
  scoreValue: 25,
  status: 'ACTIVE',
  source: 'SYSTEM',
  isDeleted: false,
};

const mockBinding = {
  id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  tenantId: TENANT_A,
  catalogRiskId: mockCatalogRisk.id,
  targetType: 'CI',
  targetId: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
  scopeMode: 'DIRECT',
  enabled: true,
  isDeleted: false,
};

describe('CustomerRiskCatalogController', () => {
  let app: INestApplication;
  let service: Record<string, jest.Mock>;

  beforeAll(async () => {
    service = {
      findWithFilters: jest.fn().mockResolvedValue({
        items: [mockCatalogRisk],
        total: 1,
        page: 1,
        pageSize: 20,
        totalPages: 1,
      }),
      createCatalogRisk: jest.fn().mockResolvedValue(mockCatalogRisk),
      findOneActiveForTenant: jest.fn().mockResolvedValue(mockCatalogRisk),
      updateCatalogRisk: jest.fn().mockResolvedValue(mockCatalogRisk),
      softDeleteCatalogRisk: jest.fn().mockResolvedValue(true),
      createBinding: jest.fn().mockResolvedValue(mockBinding),
      findBindingsForRisk: jest.fn().mockResolvedValue({
        items: [mockBinding],
        total: 1,
        page: 1,
        pageSize: 20,
        totalPages: 1,
      }),
      deleteBinding: jest.fn().mockResolvedValue(true),
      findObservations: jest.fn().mockResolvedValue({
        items: [],
        total: 0,
        page: 1,
        pageSize: 20,
        totalPages: 0,
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CustomerRiskCatalogController],
      providers: [
        { provide: CustomerRiskCatalogService, useValue: service },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (ctx: { switchToHttp: () => { getRequest: () => Record<string, unknown> } }) => {
          const req = ctx.switchToHttp().getRequest();
          req.user = { id: USER_ID };
          return true;
        },
      })
      .overrideGuard(TenantGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(PermissionsGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /grc/customer-risks', () => {
    it('should return paginated list', async () => {
      const res = await request(app.getHttpServer())
        .get('/grc/customer-risks')
        .set('x-tenant-id', TENANT_A)
        .expect(200);

      expect(res.body.items).toHaveLength(1);
      expect(res.body.total).toBe(1);
      expect(service.findWithFilters).toHaveBeenCalledWith(TENANT_A, expect.anything());
    });

    it('should pass filter params to service', async () => {
      await request(app.getHttpServer())
        .get('/grc/customer-risks?status=ACTIVE&severity=CRITICAL&search=OS')
        .set('x-tenant-id', TENANT_A)
        .expect(200);

      expect(service.findWithFilters).toHaveBeenCalledWith(
        TENANT_A,
        expect.objectContaining({
          status: 'ACTIVE',
          severity: 'CRITICAL',
          search: 'OS',
        }),
      );
    });
  });

  describe('POST /grc/customer-risks', () => {
    it('should create a catalog risk', async () => {
      const res = await request(app.getHttpServer())
        .post('/grc/customer-risks')
        .set('x-tenant-id', TENANT_A)
        .send({
          title: 'OS End-of-Support',
          category: 'OS_LIFECYCLE',
          signalType: 'STATIC_FLAG',
          severity: 'CRITICAL',
        })
        .expect(201);

      expect(res.body.title).toBe('OS End-of-Support');
      expect(service.createCatalogRisk).toHaveBeenCalled();
    });

    it('should reject invalid payload', async () => {
      await request(app.getHttpServer())
        .post('/grc/customer-risks')
        .set('x-tenant-id', TENANT_A)
        .send({
          category: 'INVALID_CATEGORY',
        })
        .expect(400);
    });
  });

  describe('GET /grc/customer-risks/:id', () => {
    it('should return a single risk', async () => {
      const res = await request(app.getHttpServer())
        .get(`/grc/customer-risks/${mockCatalogRisk.id}`)
        .set('x-tenant-id', TENANT_A)
        .expect(200);

      expect(res.body.id).toBe(mockCatalogRisk.id);
    });

    it('should return 404 for nonexistent risk', async () => {
      service.findOneActiveForTenant.mockResolvedValueOnce(null);

      await request(app.getHttpServer())
        .get('/grc/customer-risks/nonexistent-id')
        .set('x-tenant-id', TENANT_A)
        .expect(404);
    });
  });

  describe('PATCH /grc/customer-risks/:id', () => {
    it('should update a risk', async () => {
      await request(app.getHttpServer())
        .patch(`/grc/customer-risks/${mockCatalogRisk.id}`)
        .set('x-tenant-id', TENANT_A)
        .send({ title: 'Updated Title' })
        .expect(200);

      expect(service.updateCatalogRisk).toHaveBeenCalled();
    });

    it('should return 404 when updating nonexistent risk', async () => {
      service.updateCatalogRisk.mockResolvedValueOnce(null);

      await request(app.getHttpServer())
        .patch('/grc/customer-risks/nonexistent-id')
        .set('x-tenant-id', TENANT_A)
        .send({ title: 'Test' })
        .expect(404);
    });
  });

  describe('DELETE /grc/customer-risks/:id', () => {
    it('should soft delete a risk', async () => {
      await request(app.getHttpServer())
        .delete(`/grc/customer-risks/${mockCatalogRisk.id}`)
        .set('x-tenant-id', TENANT_A)
        .expect(204);

      expect(service.softDeleteCatalogRisk).toHaveBeenCalled();
    });
  });

  describe('POST /grc/customer-risks/:id/bindings', () => {
    it('should create a binding', async () => {
      const res = await request(app.getHttpServer())
        .post(`/grc/customer-risks/${mockCatalogRisk.id}/bindings`)
        .set('x-tenant-id', TENANT_A)
        .send({
          targetType: 'CI',
          targetId: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
        })
        .expect(201);

      expect(res.body.targetType).toBe('CI');
    });

    it('should reject binding with invalid target type', async () => {
      await request(app.getHttpServer())
        .post(`/grc/customer-risks/${mockCatalogRisk.id}/bindings`)
        .set('x-tenant-id', TENANT_A)
        .send({
          targetType: 'INVALID',
          targetId: 'some-id',
        })
        .expect(400);
    });
  });

  describe('GET /grc/customer-risks/:id/bindings', () => {
    it('should return bindings list', async () => {
      const res = await request(app.getHttpServer())
        .get(`/grc/customer-risks/${mockCatalogRisk.id}/bindings`)
        .set('x-tenant-id', TENANT_A)
        .expect(200);

      expect(res.body.items).toHaveLength(1);
    });
  });

  describe('DELETE /grc/customer-risks/:id/bindings/:bindingId', () => {
    it('should delete a binding', async () => {
      await request(app.getHttpServer())
        .delete(`/grc/customer-risks/${mockCatalogRisk.id}/bindings/${mockBinding.id}`)
        .set('x-tenant-id', TENANT_A)
        .expect(204);
    });

    it('should return 404 for nonexistent binding', async () => {
      service.deleteBinding.mockResolvedValueOnce(false);

      await request(app.getHttpServer())
        .delete(`/grc/customer-risks/${mockCatalogRisk.id}/bindings/nonexistent`)
        .set('x-tenant-id', TENANT_A)
        .expect(404);
    });
  });

  describe('Tenant isolation (negative case)', () => {
    it('should enforce tenant isolation on list endpoint', async () => {
      await request(app.getHttpServer())
        .get('/grc/customer-risks')
        .set('x-tenant-id', TENANT_B)
        .expect(200);

      expect(service.findWithFilters).toHaveBeenCalledWith(TENANT_B, expect.anything());
    });

    it('should enforce tenant isolation on single risk', async () => {
      service.findOneActiveForTenant.mockResolvedValueOnce(null);

      await request(app.getHttpServer())
        .get(`/grc/customer-risks/${mockCatalogRisk.id}`)
        .set('x-tenant-id', TENANT_B)
        .expect(404);
    });
  });
});
