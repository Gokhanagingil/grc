import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CopilotController } from './copilot.controller';
import { ServiceNowClientService } from './servicenow';
import { SuggestService } from './suggest';
import { ApplyService } from './apply';
import { LearningService } from './learning';
import { IndexingService } from './indexing';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../tenants/guards/tenant.guard';
import { PermissionsGuard } from '../auth/permissions/permissions.guard';

/**
 * Regression tests for Copilot controller — suggest endpoint.
 *
 * Issue C: When ServiceNow config is missing, suggest service threw
 * a generic "Incident not found" error → controller mapped it to 404 →
 * frontend showed "An unexpected error occurred".
 *
 * Fix: Service now distinguishes "config missing" from "not found".
 * Controller maps "not configured" → 400 BadRequestException with
 * actionable message so frontend can show clear error.
 */
describe('CopilotController — suggest error handling (regression)', () => {
  let controller: CopilotController;
  let suggestService: jest.Mocked<SuggestService>;

  const mockTenantId = '00000000-0000-0000-0000-000000000001';

  beforeEach(async () => {
    const mockSuggestService = {
      suggest: jest.fn(),
    };

    const mockSnClient = {
      getIncident: jest.fn(),
      listIncidents: jest.fn(),
      getTenantConfig: jest.fn(),
    };

    const mockApplyService = { apply: jest.fn() };
    const mockLearningService = { recordEvent: jest.fn() };
    const mockIndexingService = {
      indexResolvedIncidents: jest.fn(),
      indexKbArticles: jest.fn(),
      getIndexStats: jest.fn(),
    };

    const noopGuard = { canActivate: () => true };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CopilotController],
      providers: [
        { provide: ServiceNowClientService, useValue: mockSnClient },
        { provide: SuggestService, useValue: mockSuggestService },
        { provide: ApplyService, useValue: mockApplyService },
        { provide: LearningService, useValue: mockLearningService },
        { provide: IndexingService, useValue: mockIndexingService },
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

    controller = module.get<CopilotController>(CopilotController);
    suggestService = module.get(SuggestService);
  });

  describe('suggest — success', () => {
    it('should return wrapped result on success', async () => {
      const mockResult = {
        incidentSysId: 'inc123',
        incidentNumber: 'INC0001',
        actionCards: [],
        similarIncidents: [],
        kbSuggestions: [],
        generatedAt: new Date().toISOString(),
      };
      suggestService.suggest.mockResolvedValue(mockResult as any);

      const result = await controller.suggest(mockTenantId, 'inc123', {
        similarLimit: 5,
        kbLimit: 5,
      } as any);

      expect(result).toEqual({ success: true, data: mockResult });
    });
  });

  describe('suggest — config missing → 400 BadRequest', () => {
    it('should throw BadRequestException when SN not configured', async () => {
      suggestService.suggest.mockRejectedValue(
        new Error(
          'ServiceNow integration is not configured for this tenant. Please configure ServiceNow credentials in the admin settings.',
        ),
      );

      await expect(
        controller.suggest(mockTenantId, 'inc123', {} as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('should preserve the actionable config-missing message', async () => {
      const configMsg =
        'ServiceNow integration is not configured for this tenant. Please configure ServiceNow credentials in the admin settings.';
      suggestService.suggest.mockRejectedValue(new Error(configMsg));

      try {
        await controller.suggest(mockTenantId, 'inc123', {} as any);
        fail('Expected BadRequestException');
      } catch (err) {
        expect(err).toBeInstanceOf(BadRequestException);
        expect((err as BadRequestException).message).toContain(
          'not configured',
        );
      }
    });
  });

  describe('suggest — incident not found → 404 NotFoundException', () => {
    it('should throw NotFoundException when incident not found', async () => {
      suggestService.suggest.mockRejectedValue(
        new Error('Incident inc999 not found in ServiceNow or local index'),
      );

      await expect(
        controller.suggest(mockTenantId, 'inc999', {} as any),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('suggest — missing tenant → 400 BadRequest', () => {
    it('should throw BadRequestException when tenantId is empty', async () => {
      await expect(controller.suggest('', 'inc123', {} as any)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('suggest — unknown error is rethrown', () => {
    it('should rethrow non-matching errors', async () => {
      suggestService.suggest.mockRejectedValue(
        new Error('Database connection failed'),
      );

      await expect(
        controller.suggest(mockTenantId, 'inc123', {} as any),
      ).rejects.toThrow('Database connection failed');
    });
  });
});
