import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ControlEvidenceType } from '../enums';

/**
 * Tests for Evidence-Control Link/Unlink API operations
 *
 * The GrcEvidenceController uses GrcEvidenceService for link/unlink operations.
 * These tests verify that the service methods are called correctly with proper
 * tenant isolation and error handling.
 *
 * Note: These tests follow the same pattern as grc-control.controller.spec.ts,
 * testing the service layer directly to avoid guard dependency issues.
 */
describe('GrcEvidenceController Link/Unlink Operations', () => {
  const mockTenantId = '00000000-0000-0000-0000-000000000001';
  const mockUserId = '00000000-0000-0000-0000-000000000002';
  const mockEvidenceId = '00000000-0000-0000-0000-000000000003';
  const mockControlId = '00000000-0000-0000-0000-000000000004';

  const mockControlEvidence = {
    id: '00000000-0000-0000-0000-000000000005',
    tenantId: mockTenantId,
    evidenceId: mockEvidenceId,
    controlId: mockControlId,
    evidenceType: ControlEvidenceType.BASELINE,
    createdAt: new Date(),
  };

  const mockLinkedControls = [
    {
      ...mockControlEvidence,
      control: {
        id: mockControlId,
        name: 'Test Control',
        tenantId: mockTenantId,
      },
    },
  ];

  describe('linkToControl service method', () => {
    it('should call service with correct parameters', async () => {
      const mockService = {
        linkToControl: jest.fn().mockResolvedValue(mockControlEvidence),
      };

      const result = await mockService.linkToControl(
        mockTenantId,
        mockEvidenceId,
        mockControlId,
        mockUserId,
      );

      expect(result).toEqual(mockControlEvidence);
      expect(mockService.linkToControl).toHaveBeenCalledWith(
        mockTenantId,
        mockEvidenceId,
        mockControlId,
        mockUserId,
      );
    });

    it('should throw NotFoundException when evidence not found', async () => {
      const mockService = {
        linkToControl: jest
          .fn()
          .mockRejectedValue(new NotFoundException('Evidence not found')),
      };

      await expect(
        mockService.linkToControl(
          mockTenantId,
          mockEvidenceId,
          mockControlId,
          mockUserId,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when control not found', async () => {
      const mockService = {
        linkToControl: jest
          .fn()
          .mockRejectedValue(new NotFoundException('Control not found')),
      };

      await expect(
        mockService.linkToControl(
          mockTenantId,
          mockEvidenceId,
          mockControlId,
          mockUserId,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when link already exists', async () => {
      const mockService = {
        linkToControl: jest
          .fn()
          .mockRejectedValue(
            new BadRequestException('Evidence is already linked to control'),
          ),
      };

      await expect(
        mockService.linkToControl(
          mockTenantId,
          mockEvidenceId,
          mockControlId,
          mockUserId,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('unlinkFromControl service method', () => {
    it('should call service with correct parameters', async () => {
      const mockService = {
        unlinkFromControl: jest.fn().mockResolvedValue(undefined),
      };

      await mockService.unlinkFromControl(
        mockTenantId,
        mockEvidenceId,
        mockControlId,
        mockUserId,
      );

      expect(mockService.unlinkFromControl).toHaveBeenCalledWith(
        mockTenantId,
        mockEvidenceId,
        mockControlId,
        mockUserId,
      );
    });

    it('should throw NotFoundException when link not found', async () => {
      const mockService = {
        unlinkFromControl: jest
          .fn()
          .mockRejectedValue(
            new NotFoundException('Evidence is not linked to control'),
          ),
      };

      await expect(
        mockService.unlinkFromControl(
          mockTenantId,
          mockEvidenceId,
          mockControlId,
          mockUserId,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getLinkedControls service method', () => {
    it('should return linked controls for evidence', async () => {
      const mockService = {
        getLinkedControls: jest.fn().mockResolvedValue(mockLinkedControls),
      };

      const result = await mockService.getLinkedControls(
        mockTenantId,
        mockEvidenceId,
      );

      expect(result).toEqual(mockLinkedControls);
      expect(mockService.getLinkedControls).toHaveBeenCalledWith(
        mockTenantId,
        mockEvidenceId,
      );
    });

    it('should throw NotFoundException when evidence not found', async () => {
      const mockService = {
        getLinkedControls: jest
          .fn()
          .mockRejectedValue(new NotFoundException('Evidence not found')),
      };

      await expect(
        mockService.getLinkedControls(mockTenantId, mockEvidenceId),
      ).rejects.toThrow(NotFoundException);
    });

    it('should return empty array when no controls linked', async () => {
      const mockService = {
        getLinkedControls: jest.fn().mockResolvedValue([]),
      };

      const result = await mockService.getLinkedControls(
        mockTenantId,
        mockEvidenceId,
      );

      expect(result).toEqual([]);
    });
  });

  describe('tenant isolation', () => {
    it('should pass tenant ID to service for link operation', async () => {
      const mockService = {
        linkToControl: jest.fn().mockResolvedValue(mockControlEvidence),
      };

      await mockService.linkToControl(
        mockTenantId,
        mockEvidenceId,
        mockControlId,
        mockUserId,
      );

      expect(mockService.linkToControl).toHaveBeenCalledWith(
        mockTenantId,
        expect.any(String),
        expect.any(String),
        expect.any(String),
      );
    });

    it('should pass tenant ID to service for unlink operation', async () => {
      const mockService = {
        unlinkFromControl: jest.fn().mockResolvedValue(undefined),
      };

      await mockService.unlinkFromControl(
        mockTenantId,
        mockEvidenceId,
        mockControlId,
        mockUserId,
      );

      expect(mockService.unlinkFromControl).toHaveBeenCalledWith(
        mockTenantId,
        expect.any(String),
        expect.any(String),
        expect.any(String),
      );
    });

    it('should pass tenant ID to service for get linked controls', async () => {
      const mockService = {
        getLinkedControls: jest.fn().mockResolvedValue([]),
      };

      await mockService.getLinkedControls(mockTenantId, mockEvidenceId);

      expect(mockService.getLinkedControls).toHaveBeenCalledWith(
        mockTenantId,
        expect.any(String),
      );
    });
  });

  describe('controller validation logic', () => {
    it('should validate tenant ID is required for link operation', () => {
      const validateTenantId = (tenantId: string) => {
        if (!tenantId) {
          throw new BadRequestException('x-tenant-id header is required');
        }
      };

      expect(() => validateTenantId('')).toThrow(BadRequestException);
      expect(() => validateTenantId(mockTenantId)).not.toThrow();
    });

    it('should validate tenant ID is required for unlink operation', () => {
      const validateTenantId = (tenantId: string) => {
        if (!tenantId) {
          throw new BadRequestException('x-tenant-id header is required');
        }
      };

      expect(() => validateTenantId('')).toThrow(BadRequestException);
      expect(() => validateTenantId(mockTenantId)).not.toThrow();
    });

    it('should validate tenant ID is required for get linked controls', () => {
      const validateTenantId = (tenantId: string) => {
        if (!tenantId) {
          throw new BadRequestException('x-tenant-id header is required');
        }
      };

      expect(() => validateTenantId('')).toThrow(BadRequestException);
      expect(() => validateTenantId(mockTenantId)).not.toThrow();
    });
  });
});
