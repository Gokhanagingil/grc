/**
 * Major Incident Controller — Response Contract Tests
 *
 * Validates that the MI controller returns raw entities/results,
 * relying on the global ResponseTransformInterceptor for envelope wrapping.
 *
 * The standard API envelope is: { success: true, data: <payload> }
 * Controllers must NOT manually wrap in { data: ... } to avoid double-wrapping.
 */
import { NotFoundException } from '@nestjs/common';
import { MajorIncidentController } from './major-incident.controller';
import { MajorIncidentService } from './major-incident.service';
import { ItsmMajorIncident } from './major-incident.entity';
import {
  MajorIncidentStatus,
  MajorIncidentSeverity,
} from './major-incident.enums';

describe('MajorIncidentController — Response Contract', () => {
  let controller: MajorIncidentController;
  let service: jest.Mocked<MajorIncidentService>;

  const mockTenantId = '00000000-0000-0000-0000-000000000001';

  const mockMi: Partial<ItsmMajorIncident> = {
    id: 'dddd0600-0000-0000-0000-000000000010',
    tenantId: mockTenantId,
    number: 'MI-SCEN-001',
    title: 'Online Banking Platform Complete Outage',
    description: 'Total loss of online banking services',
    status: MajorIncidentStatus.INVESTIGATING,
    severity: MajorIncidentSeverity.SEV1,
    commanderId: null,
    communicationsLeadId: null,
    techLeadId: null,
    bridgeUrl: null,
    bridgeChannel: null,
    bridgeStartedAt: null,
    bridgeEndedAt: null,
    customerImpactSummary: null,
    businessImpactSummary: null,
    primaryServiceId: null,
    primaryOfferingId: null,
    declaredAt: new Date(),
    resolvedAt: null,
    closedAt: null,
    resolutionSummary: null,
    resolutionCode: null,
    sourceIncidentId: null,
    metadata: null,
    isDeleted: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: 'system',
  };

  beforeEach(() => {
    service = {
      findOne: jest.fn(),
      findWithFilters: jest.fn(),
      declare: jest.fn(),
      update: jest.fn(),
      softDelete: jest.fn(),
      getStatistics: jest.fn(),
      getTimeline: jest.fn(),
      createTimelineUpdate: jest.fn(),
      getLinks: jest.fn(),
      linkRecord: jest.fn(),
      unlinkRecord: jest.fn(),
    } as unknown as jest.Mocked<MajorIncidentService>;

    // Instantiate controller directly — bypasses guard DI for pure contract tests
    controller = new MajorIncidentController(service);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findOne (GET :id) — detail contract', () => {
    it('should return the entity directly, not wrapped in { data }', async () => {
      service.findOne.mockResolvedValue(mockMi as ItsmMajorIncident);

      const result = await controller.findOne(mockTenantId, mockMi.id!);

      // Controller must return the entity directly — the global
      // ResponseTransformInterceptor will wrap it as { success: true, data: entity }
      expect(result).toBe(mockMi);
      expect(result).not.toHaveProperty('data');
      expect(result.title).toBe('Online Banking Platform Complete Outage');
      expect(result.number).toBe('MI-SCEN-001');
      expect(result.status).toBe(MajorIncidentStatus.INVESTIGATING);
    });

    it('should throw NotFoundException when MI does not exist', async () => {
      service.findOne.mockResolvedValue(null);

      await expect(
        controller.findOne(mockTenantId, 'missing-id'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should include title and shortDescription-relevant fields in detail response', async () => {
      service.findOne.mockResolvedValue(mockMi as ItsmMajorIncident);

      const result = await controller.findOne(mockTenantId, mockMi.id!);

      // These fields must be present for the scenario-pack smoke test contract
      expect(typeof result.title).toBe('string');
      expect(result.title.length).toBeGreaterThan(0);
    });
  });

  describe('getStatistics — no manual data wrapper', () => {
    it('should return statistics directly', async () => {
      const stats = { total: 5, DECLARED: 2, INVESTIGATING: 3 };
      service.getStatistics.mockResolvedValue(stats);

      const result = await controller.getStatistics(mockTenantId);

      expect(result).toEqual(stats);
    });
  });

  describe('declare (POST) — no manual data wrapper', () => {
    it('should return the created entity directly', async () => {
      service.declare.mockResolvedValue(mockMi as ItsmMajorIncident);

      const result = await controller.declare(
        mockTenantId,
        { user: { id: 'user-1' } },
        { title: 'Test MI' },
      );

      expect(result).toBe(mockMi);
    });
  });

  describe('update (PATCH :id) — no manual data wrapper', () => {
    it('should return the updated entity directly', async () => {
      const updated = {
        ...mockMi,
        title: 'Updated Title',
      } as ItsmMajorIncident;
      service.update.mockResolvedValue(updated);

      const result = await controller.update(
        mockTenantId,
        { user: { id: 'user-1' } },
        mockMi.id!,
        { title: 'Updated Title' },
      );

      expect(result).toBe(updated);
    });
  });

  describe('remove (DELETE :id) — no manual data wrapper', () => {
    it('should return { deleted: true } directly', async () => {
      service.softDelete.mockResolvedValue(true);

      const result = await controller.remove(
        mockTenantId,
        { user: { id: 'user-1' } },
        mockMi.id!,
      );

      expect(result).toEqual({ deleted: true });
      expect(result).not.toHaveProperty('data');
    });
  });

  describe('getLinks (GET :id/links) — no manual data wrapper', () => {
    it('should return links array directly', async () => {
      const mockLinks = [{ id: 'link-1', linkType: 'INCIDENT' }];
      service.findOne.mockResolvedValue(mockMi as ItsmMajorIncident);
      service.getLinks.mockResolvedValue(mockLinks as never);

      const result = await controller.getLinks(mockTenantId, mockMi.id!);

      expect(result).toBe(mockLinks);
    });
  });
});
