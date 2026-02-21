import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { KnownErrorController } from './known-error.controller';
import { KnownErrorService } from './known-error.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../tenants/guards/tenant.guard';
import { PermissionsGuard } from '../../auth/permissions/permissions.guard';

/**
 * Regression tests for Known Error controller.
 *
 * Issue B: Controller was explicitly wrapping responses in { data: ... }
 * on top of the global ResponseTransformInterceptor, causing double-wrapping:
 *   { success: true, data: { data: knownError } }
 * Frontend could not parse the nested structure.
 *
 * Fix: Controller now returns raw objects; interceptor handles wrapping.
 */
describe('KnownErrorController — no double-wrapping (regression)', () => {
  let controller: KnownErrorController;
  let service: jest.Mocked<KnownErrorService>;

  const mockTenantId = '00000000-0000-0000-0000-000000000001';
  const mockUserId = '00000000-0000-0000-0000-000000000002';
  const mockKeId = '00000000-0000-0000-0000-000000000201';

  const mockKnownError = {
    id: mockKeId,
    tenantId: mockTenantId,
    title: 'Known Error: DB Pool',
    symptoms: 'Slow queries',
    rootCause: 'Pool limit too low',
    workaround: 'Restart service',
    permanentFixStatus: 'WORKAROUND_AVAILABLE',
    state: 'DRAFT',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockPaginatedResult = {
    items: [mockKnownError],
    total: 1,
    page: 1,
    pageSize: 20,
    totalPages: 1,
  };

  beforeEach(async () => {
    const mockService = {
      findWithFilters: jest.fn().mockResolvedValue(mockPaginatedResult),
      createKnownError: jest.fn().mockResolvedValue(mockKnownError),
      findOne: jest.fn().mockResolvedValue(mockKnownError),
      updateKnownError: jest.fn().mockResolvedValue(mockKnownError),
      softDeleteKnownError: jest.fn().mockResolvedValue(true),
      validateKnownError: jest.fn().mockResolvedValue(mockKnownError),
      publishKnownError: jest.fn().mockResolvedValue(mockKnownError),
      retireKnownError: jest.fn().mockResolvedValue(mockKnownError),
      reopenKnownError: jest.fn().mockResolvedValue(mockKnownError),
    };

    const noopGuard = { canActivate: () => true };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [KnownErrorController],
      providers: [
        { provide: KnownErrorService, useValue: mockService },
        Reflector,
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(noopGuard)
      .overrideGuard(TenantGuard)
      .useValue(noopGuard)
      .overrideGuard(PermissionsGuard)
      .useValue(noopGuard)
      .compile();

    controller = module.get<KnownErrorController>(KnownErrorController);
    service = module.get(KnownErrorService);
  });

  describe('list', () => {
    it('should return paginated result directly (not wrapped in { data })', async () => {
      const result = await controller.list(mockTenantId, {} as any);

      expect(result).toEqual(mockPaginatedResult);
      // REGRESSION: must NOT be wrapped in { data: ... }
      expect(result).not.toHaveProperty('data');
      expect(result).toHaveProperty('items');
      expect(result).toHaveProperty('total');
    });
  });

  describe('findOne', () => {
    it('should return known error directly (not wrapped in { data })', async () => {
      const result = await controller.findOne(mockTenantId, mockKeId);

      expect(result).toEqual(mockKnownError);
      // REGRESSION: must NOT be wrapped in { data: ... }
      expect(result).toHaveProperty('id', mockKeId);
      expect(result).toHaveProperty('title');
    });

    it('should throw NotFoundException when not found', async () => {
      service.findOne.mockResolvedValue(null as any);

      await expect(
        controller.findOne(mockTenantId, 'nonexistent'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('should return created entity directly (not wrapped in { data })', async () => {
      const dto = { title: 'Test KE', symptoms: 'test' } as any;
      const req = { user: { id: mockUserId } };

      const result = await controller.create(mockTenantId, req, dto);

      expect(result).toEqual(mockKnownError);
      expect(result).toHaveProperty('id');
    });
  });

  describe('update', () => {
    it('should return updated entity directly (not wrapped in { data })', async () => {
      const dto = { title: 'Updated KE' } as any;
      const req = { user: { id: mockUserId } };

      const result = await controller.update(mockTenantId, req, mockKeId, dto);

      expect(result).toEqual(mockKnownError);
      expect(result).toHaveProperty('id');
    });

    it('should throw NotFoundException when update target not found', async () => {
      service.updateKnownError.mockResolvedValue(null as any);
      const req = { user: { id: mockUserId } };

      await expect(
        controller.update(mockTenantId, req, 'nonexistent', {} as any),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('lifecycle actions — no wrapping', () => {
    it('validate should return entity directly', async () => {
      const req = { user: { id: mockUserId } };
      const result = await controller.validate(mockTenantId, req, mockKeId);
      expect(result).toEqual(mockKnownError);
    });

    it('publish should return entity directly', async () => {
      const req = { user: { id: mockUserId } };
      const result = await controller.publish(mockTenantId, req, mockKeId);
      expect(result).toEqual(mockKnownError);
    });

    it('retire should return entity directly', async () => {
      const req = { user: { id: mockUserId } };
      const result = await controller.retire(mockTenantId, req, mockKeId);
      expect(result).toEqual(mockKnownError);
    });

    it('reopen should return entity directly', async () => {
      const req = { user: { id: mockUserId } };
      const result = await controller.reopen(mockTenantId, req, mockKeId, {
        reason: 'Needs fix',
      });
      expect(result).toEqual(mockKnownError);
    });
  });
});
