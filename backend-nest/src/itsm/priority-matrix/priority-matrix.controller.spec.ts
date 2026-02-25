import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PriorityMatrixController } from './priority-matrix.controller';
import { PriorityMatrixService } from './priority-matrix.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../tenants/guards/tenant.guard';
import { PermissionsGuard } from '../../auth/permissions/permissions.guard';

describe('PriorityMatrixController', () => {
  let controller: PriorityMatrixController;
  let service: jest.Mocked<PriorityMatrixService>;

  const mockTenantId = '00000000-0000-0000-0000-000000000001';

  beforeEach(async () => {
    const mockService = {
      getMatrix: jest.fn(),
      computePriority: jest.fn(),
      upsertMatrix: jest.fn(),
      seedDefaultIfEmpty: jest.fn(),
    };

    const noopGuard = { canActivate: () => true };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PriorityMatrixController],
      providers: [
        { provide: PriorityMatrixService, useValue: mockService },
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

    controller = module.get<PriorityMatrixController>(PriorityMatrixController);
    service = module.get(PriorityMatrixService);
  });

  describe('evaluate', () => {
    it('returns computed priority for valid impact+urgency', async () => {
      service.computePriority.mockResolvedValue('P1');

      const result = await controller.evaluate(mockTenantId, 'HIGH', 'HIGH');

      expect(result).toEqual({
        impact: 'HIGH',
        urgency: 'HIGH',
        priority: 'P1',
      });
      expect(service.computePriority).toHaveBeenCalledWith(
        mockTenantId,
        'HIGH',
        'HIGH',
      );
    });

    it('throws BadRequestException when tenantId is missing', async () => {
      await expect(controller.evaluate('', 'HIGH', 'HIGH')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException when impact is missing', async () => {
      await expect(
        controller.evaluate(mockTenantId, '', 'HIGH'),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when urgency is missing', async () => {
      await expect(
        controller.evaluate(mockTenantId, 'HIGH', ''),
      ).rejects.toThrow(BadRequestException);
    });

    it('returns P3 fallback for unknown combinations', async () => {
      service.computePriority.mockResolvedValue('P3');

      const result = await controller.evaluate(
        mockTenantId,
        'CRITICAL',
        'HIGH',
      );

      expect(result).toEqual({
        impact: 'CRITICAL',
        urgency: 'HIGH',
        priority: 'P3',
      });
    });
  });

  describe('getMatrix', () => {
    it('returns matrix rows for tenant', async () => {
      const mockRows = [
        { impact: 'HIGH', urgency: 'HIGH', priority: 'P1', label: null },
        { impact: 'HIGH', urgency: 'MEDIUM', priority: 'P2', label: null },
      ];
      service.getMatrix.mockResolvedValue(mockRows);

      const result = await controller.getMatrix(mockTenantId);

      expect(result).toEqual(mockRows);
      expect(service.getMatrix).toHaveBeenCalledWith(mockTenantId);
    });

    it('throws BadRequestException when tenantId is missing', async () => {
      await expect(controller.getMatrix('')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('seedDefault', () => {
    it('seeds default matrix when empty', async () => {
      service.seedDefaultIfEmpty.mockResolvedValue(true);

      const result = await controller.seedDefault(mockTenantId, {
        user: { id: 'user-1' },
      });

      expect(result).toEqual({ seeded: true });
      expect(service.seedDefaultIfEmpty).toHaveBeenCalledWith(
        mockTenantId,
        'user-1',
      );
    });

    it('returns seeded=false when matrix already exists', async () => {
      service.seedDefaultIfEmpty.mockResolvedValue(false);

      const result = await controller.seedDefault(mockTenantId, {
        user: { id: 'user-1' },
      });

      expect(result).toEqual({ seeded: false });
    });
  });
});
