import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  ToolGatewayService,
  SafeIntegrationProviderResponse,
} from '../tool-gateway.service';
import {
  IntegrationProviderConfig,
  IntegrationProviderKey,
  IntegrationAuthType,
  ToolPolicy,
  ToolKey,
} from '../entities';
import { AiAuditEvent } from '../../ai-admin/entities';
import { EncryptionService } from '../../ai-admin/encryption';
import { SsrfGuardService } from '../../notification-engine/services/ssrf-guard.service';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';

// ── Mocks ────────────────────────────────────────────────────────────────

const TENANT_ID = '00000000-0000-0000-0000-000000000001';

function mockProvider(
  overrides: Partial<IntegrationProviderConfig> = {},
): IntegrationProviderConfig {
  return {
    id: 'provider-1',
    tenantId: TENANT_ID,
    providerKey: IntegrationProviderKey.SERVICENOW,
    displayName: 'Test SN',
    isEnabled: true,
    baseUrl: 'https://test.service-now.com',
    authType: IntegrationAuthType.BASIC,
    usernameEncrypted: 'enc-user',
    passwordEncrypted: 'enc-pass',
    tokenEncrypted: null,
    customHeadersEncrypted: null,
    isDeleted: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    tenant: null as never,
    ...overrides,
  };
}

function mockPolicy(overrides: Partial<ToolPolicy> = {}): ToolPolicy {
  return {
    id: 'policy-1',
    tenantId: TENANT_ID,
    isToolsEnabled: true,
    allowedTools: [
      ToolKey.SERVICENOW_QUERY_INCIDENTS,
      ToolKey.SERVICENOW_QUERY_TABLE,
    ],
    rateLimitPerMinute: 60,
    maxToolCallsPerRun: 10,
    createdAt: new Date(),
    updatedAt: new Date(),
    tenant: null as never,
    ...overrides,
  };
}

const mockQueryBuilder = {
  where: jest.fn().mockReturnThis(),
  andWhere: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  getMany: jest.fn().mockResolvedValue([]),
  getOne: jest.fn().mockResolvedValue(null),
  getCount: jest.fn().mockResolvedValue(0),
};

function freshQb() {
  return {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue([]),
    getOne: jest.fn().mockResolvedValue(null),
    getCount: jest.fn().mockResolvedValue(0),
  };
}

const mockProviderRepo = {
  createQueryBuilder: jest.fn(() => freshQb()),
  create: jest.fn((data: Record<string, unknown>) => data),
  save: jest.fn((data: Record<string, unknown>) => Promise.resolve(data)),
  findOne: jest.fn(),
};

const mockPolicyRepo = {
  findOne: jest.fn(),
  create: jest.fn((data: Record<string, unknown>) => data),
  save: jest.fn((data: Record<string, unknown>) => Promise.resolve(data)),
};

const mockAuditRepo = {
  create: jest.fn((data: Record<string, unknown>) => data),
  save: jest.fn((data: Record<string, unknown>) => Promise.resolve(data)),
};

const mockEncryptionService = {
  encrypt: jest.fn((v: string) => `enc:${v}`),
  decrypt: jest.fn((v: string) => v.replace('enc:', '')),
};

const mockSsrfGuardService = {
  validateUrl: jest.fn(() => ({ valid: true })),
};

describe('ToolGatewayService', () => {
  let service: ToolGatewayService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ToolGatewayService,
        {
          provide: getRepositoryToken(IntegrationProviderConfig),
          useValue: mockProviderRepo,
        },
        { provide: getRepositoryToken(ToolPolicy), useValue: mockPolicyRepo },
        { provide: getRepositoryToken(AiAuditEvent), useValue: mockAuditRepo },
        { provide: EncryptionService, useValue: mockEncryptionService },
        { provide: SsrfGuardService, useValue: mockSsrfGuardService },
      ],
    }).compile();

    service = module.get<ToolGatewayService>(ToolGatewayService);
  });

  // ═══════════════════════════════════════════════════════════════════════
  // 1) Secrets never returned
  // ═══════════════════════════════════════════════════════════════════════

  describe('secrets never returned', () => {
    it('should strip encrypted fields from provider response', async () => {
      const provider = mockProvider();
      const qb = freshQb();
      qb.getMany.mockResolvedValue([provider]);
      mockProviderRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.listProviders(TENANT_ID);
      expect(result).toHaveLength(1);

      const safe = result[0];
      // Must NOT have any encrypted fields
      expect(
        (safe as unknown as Record<string, unknown>).usernameEncrypted,
      ).toBeUndefined();
      expect(
        (safe as unknown as Record<string, unknown>).passwordEncrypted,
      ).toBeUndefined();
      expect(
        (safe as unknown as Record<string, unknown>).tokenEncrypted,
      ).toBeUndefined();
      expect(
        (safe as unknown as Record<string, unknown>).customHeadersEncrypted,
      ).toBeUndefined();

      // Must have boolean flags
      expect(safe.hasUsername).toBe(true);
      expect(safe.hasPassword).toBe(true);
      expect(safe.hasToken).toBe(false);
      expect(safe.hasCustomHeaders).toBe(false);
    });

    it('should mask secrets when creating a provider', async () => {
      mockProviderRepo.save.mockImplementation(
        (data: Record<string, unknown>) =>
          Promise.resolve(
            Object.assign({}, data, {
              id: 'new-id',
              createdAt: new Date(),
              updatedAt: new Date(),
            }),
          ),
      );

      const result = await service.createProvider(TENANT_ID, {
        providerKey: IntegrationProviderKey.SERVICENOW,
        displayName: 'New SN',
        baseUrl: 'https://new.service-now.com',
        authType: IntegrationAuthType.BASIC,
        username: 'admin',
        password: 'secret123',
      });

      // Verify encryption was called
      expect(mockEncryptionService.encrypt).toHaveBeenCalledWith('admin');
      expect(mockEncryptionService.encrypt).toHaveBeenCalledWith('secret123');

      // Verify response has boolean flags, not secrets
      expect(result.hasUsername).toBe(true);
      expect(result.hasPassword).toBe(true);
      expect(
        (result as unknown as Record<string, unknown>).usernameEncrypted,
      ).toBeUndefined();
      expect(
        (result as unknown as Record<string, unknown>).passwordEncrypted,
      ).toBeUndefined();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // 2) SSRF baseUrl validation
  // ═══════════════════════════════════════════════════════════════════════

  describe('SSRF baseUrl validation', () => {
    it('should reject provider creation with SSRF-unsafe URL', async () => {
      mockSsrfGuardService.validateUrl.mockReturnValueOnce({ valid: false } as {
        valid: boolean;
      });

      await expect(
        service.createProvider(TENANT_ID, {
          providerKey: IntegrationProviderKey.SERVICENOW,
          displayName: 'Bad URL',
          baseUrl: 'http://192.168.1.1',
          authType: IntegrationAuthType.BASIC,
        }),
      ).rejects.toThrow(BadRequestException);

      expect(mockSsrfGuardService.validateUrl).toHaveBeenCalledWith(
        'http://192.168.1.1',
      );
    });

    it('should accept provider creation with valid HTTPS URL', async () => {
      mockSsrfGuardService.validateUrl.mockReturnValueOnce({ valid: true });
      mockProviderRepo.save.mockImplementation(
        (data: Record<string, unknown>) =>
          Promise.resolve(
            Object.assign({}, data, {
              id: 'new-id',
              createdAt: new Date(),
              updatedAt: new Date(),
            }),
          ),
      );

      const result = await service.createProvider(TENANT_ID, {
        providerKey: IntegrationProviderKey.SERVICENOW,
        displayName: 'Good URL',
        baseUrl: 'https://good.service-now.com',
        authType: IntegrationAuthType.BASIC,
      });

      expect(result.baseUrl).toBe('https://good.service-now.com');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // 3) ToolPolicy allowlist enforcement
  // ═══════════════════════════════════════════════════════════════════════

  describe('ToolPolicy allowlist enforcement', () => {
    it('should deny tool execution when tools are disabled', async () => {
      mockPolicyRepo.findOne.mockResolvedValueOnce(
        mockPolicy({ isToolsEnabled: false }),
      );

      await expect(
        service.runTool(TENANT_ID, 'user-1', {
          toolKey: ToolKey.SERVICENOW_QUERY_INCIDENTS,
          input: {},
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should deny tool execution when tool is not in allowlist', async () => {
      mockPolicyRepo.findOne.mockResolvedValueOnce(
        mockPolicy({ allowedTools: [ToolKey.SERVICENOW_QUERY_INCIDENTS] }),
      );

      await expect(
        service.runTool(TENANT_ID, 'user-1', {
          toolKey: ToolKey.SERVICENOW_QUERY_CHANGES,
          input: {},
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should deny when no policy exists', async () => {
      mockPolicyRepo.findOne.mockResolvedValueOnce(null);

      await expect(
        service.runTool(TENANT_ID, 'user-1', {
          toolKey: ToolKey.SERVICENOW_QUERY_INCIDENTS,
          input: {},
        }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // 4) Tool run logs audit event
  // ═══════════════════════════════════════════════════════════════════════

  describe('audit logging', () => {
    it('should log audit event on forbidden tool run', async () => {
      mockPolicyRepo.findOne.mockResolvedValueOnce(
        mockPolicy({ isToolsEnabled: false }),
      );

      await expect(
        service.runTool(TENANT_ID, 'user-1', {
          toolKey: ToolKey.SERVICENOW_QUERY_INCIDENTS,
          input: {},
        }),
      ).rejects.toThrow(ForbiddenException);

      expect(mockAuditRepo.create).toHaveBeenCalled();
      expect(mockAuditRepo.save).toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // 5) Provider CRUD
  // ═══════════════════════════════════════════════════════════════════════

  describe('provider CRUD', () => {
    it('should soft-delete a provider', async () => {
      const provider = mockProvider();
      const qb = freshQb();
      qb.getOne.mockResolvedValue(Object.assign({}, provider));
      mockProviderRepo.createQueryBuilder.mockReturnValue(qb);
      mockProviderRepo.save.mockImplementation(
        (data: Record<string, unknown>) => Promise.resolve(data),
      );

      await service.deleteProvider('provider-1', TENANT_ID);

      expect(mockProviderRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ isDeleted: true, isEnabled: false }),
      );
    });

    it('should throw NotFoundException for non-existent provider', async () => {
      const qb = freshQb();
      qb.getOne.mockResolvedValue(null);
      mockProviderRepo.createQueryBuilder.mockReturnValue(qb);

      await expect(
        service.getProvider('non-existent', TENANT_ID),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // 6) Tool status endpoint
  // ═══════════════════════════════════════════════════════════════════════

  describe('getToolStatus', () => {
    it('should return tool status for tenant', async () => {
      mockPolicyRepo.findOne.mockResolvedValueOnce(mockPolicy());
      const qb = freshQb();
      qb.getCount.mockResolvedValue(1);
      mockProviderRepo.createQueryBuilder.mockReturnValue(qb);

      const status = await service.getToolStatus(TENANT_ID);

      expect(status.isToolsEnabled).toBe(true);
      expect(status.availableTools).toEqual([
        ToolKey.SERVICENOW_QUERY_INCIDENTS,
        ToolKey.SERVICENOW_QUERY_TABLE,
      ]);
      expect(status.hasServiceNowProvider).toBe(true);
    });

    it('should return disabled when no policy', async () => {
      mockPolicyRepo.findOne.mockResolvedValueOnce(null);
      const qb = freshQb();
      qb.getCount.mockResolvedValue(0);
      mockProviderRepo.createQueryBuilder.mockReturnValue(qb);

      const status = await service.getToolStatus(TENANT_ID);

      expect(status.isToolsEnabled).toBe(false);
      expect(status.availableTools).toEqual([]);
      expect(status.hasServiceNowProvider).toBe(false);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // 7) Policy upsert validates tool keys
  // ═══════════════════════════════════════════════════════════════════════

  describe('upsertPolicy', () => {
    it('should reject invalid tool keys', async () => {
      await expect(
        service.upsertPolicy(
          TENANT_ID,
          {
            isToolsEnabled: true,
            allowedTools: ['INVALID_TOOL' as ToolKey],
          },
          'user-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should create new policy when none exists', async () => {
      mockPolicyRepo.findOne.mockResolvedValueOnce(null);
      mockPolicyRepo.save.mockImplementation((data: Record<string, unknown>) =>
        Promise.resolve(
          Object.assign({}, data, {
            id: 'new-policy',
            createdAt: new Date(),
            updatedAt: new Date(),
          }),
        ),
      );

      const result = await service.upsertPolicy(
        TENANT_ID,
        {
          isToolsEnabled: true,
          allowedTools: [ToolKey.SERVICENOW_QUERY_INCIDENTS],
        },
        'user-1',
      );

      expect(result.isToolsEnabled).toBe(true);
      expect(result.allowedTools).toEqual([ToolKey.SERVICENOW_QUERY_INCIDENTS]);
    });
  });
});
