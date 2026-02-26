import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AiAdminService } from './ai-admin.service';
import {
  AiProviderConfig,
  AiProviderType,
} from './entities/ai-provider-config.entity';
import { AiFeaturePolicy } from './entities/ai-feature-policy.entity';
import {
  AiAuditEvent,
  AiActionType,
  AiAuditStatus,
} from './entities/ai-audit-event.entity';
import { EncryptionService } from './encryption/encryption.service';
import { ConfigService } from '@nestjs/config';

// Mock query builder
const createMockQueryBuilder = (result: unknown = null) => ({
  where: jest.fn().mockReturnThis(),
  andWhere: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  skip: jest.fn().mockReturnThis(),
  take: jest.fn().mockReturnThis(),
  getMany: jest.fn().mockResolvedValue(Array.isArray(result) ? result : []),
  getOne: jest.fn().mockResolvedValue(result),
  getManyAndCount: jest
    .fn()
    .mockResolvedValue([Array.isArray(result) ? result : [], 0]),
});

describe('AiAdminService', () => {
  let service: AiAdminService;
  let providerRepo: Repository<AiProviderConfig>;
  let policyRepo: Repository<AiFeaturePolicy>;
  let auditRepo: Repository<AiAuditEvent>;
  let encryptionService: EncryptionService;

  const TENANT_ID = '00000000-0000-0000-0000-000000000001';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiAdminService,
        {
          provide: getRepositoryToken(AiProviderConfig),
          useValue: {
            create: jest.fn((dto) => ({ id: 'test-id', ...dto })),
            save: jest.fn((entity) =>
              Promise.resolve({
                ...entity,
                id: entity.id || 'test-id',
                createdAt: new Date(),
                updatedAt: new Date(),
              }),
            ),
            findOne: jest.fn(),
            createQueryBuilder: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(AiFeaturePolicy),
          useValue: {
            create: jest.fn((dto) => ({ id: 'policy-id', ...dto })),
            save: jest.fn((entity) =>
              Promise.resolve({
                ...entity,
                id: entity.id || 'policy-id',
                createdAt: new Date(),
                updatedAt: new Date(),
              }),
            ),
            findOne: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(AiAuditEvent),
          useValue: {
            create: jest.fn((dto) => ({ id: 'audit-id', ...dto })),
            save: jest.fn((entity) =>
              Promise.resolve({
                ...entity,
                id: entity.id || 'audit-id',
                createdAt: new Date(),
              }),
            ),
            createQueryBuilder: jest.fn(),
          },
        },
        {
          provide: EncryptionService,
          useValue: {
            encrypt: jest.fn((val) => `encrypted:${val}`),
            decrypt: jest.fn((val) => val.replace('encrypted:', '')),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AiAdminService>(AiAdminService);
    providerRepo = module.get<Repository<AiProviderConfig>>(
      getRepositoryToken(AiProviderConfig),
    );
    policyRepo = module.get<Repository<AiFeaturePolicy>>(
      getRepositoryToken(AiFeaturePolicy),
    );
    auditRepo = module.get<Repository<AiAuditEvent>>(
      getRepositoryToken(AiAuditEvent),
    );
    encryptionService = module.get<EncryptionService>(EncryptionService);
  });

  describe('Provider CRUD', () => {
    it('should never return secrets in provider list response', async () => {
      const mockProvider: Partial<AiProviderConfig> = {
        id: 'p1',
        tenantId: TENANT_ID,
        providerType: AiProviderType.LOCAL,
        displayName: 'Test Local',
        isEnabled: true,
        baseUrl: 'http://localhost:11434',
        modelName: 'llama2',
        requestTimeoutMs: 30000,
        maxTokens: null,
        temperature: null,
        apiKeyEncrypted: 'encrypted:secret-key',
        customHeadersEncrypted: 'encrypted:{"X-Custom": "val"}',
        isDeleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      jest
        .spyOn(providerRepo, 'createQueryBuilder')
        .mockReturnValue(createMockQueryBuilder([mockProvider]) as any);

      const result = await service.listProviders(TENANT_ID);

      expect(result).toHaveLength(1);
      expect(result[0]).not.toHaveProperty('apiKeyEncrypted');
      expect(result[0]).not.toHaveProperty('customHeadersEncrypted');
      expect(result[0].hasApiKey).toBe(true);
      expect(result[0].hasCustomHeaders).toBe(true);
      expect(result[0].displayName).toBe('Test Local');

      // Ensure no value in the response object contains the actual secret
      const responseJson = JSON.stringify(result[0]);
      expect(responseJson).not.toContain('secret-key');
      expect(responseJson).not.toContain('X-Custom');
    });

    it('should never return secrets in single provider response', async () => {
      const mockProvider: Partial<AiProviderConfig> = {
        id: 'p1',
        tenantId: TENANT_ID,
        providerType: AiProviderType.OPENAI,
        displayName: 'Test OpenAI',
        isEnabled: true,
        baseUrl: null,
        modelName: 'gpt-4',
        requestTimeoutMs: 30000,
        maxTokens: 4096,
        temperature: 0.7,
        apiKeyEncrypted: 'encrypted:sk-12345',
        customHeadersEncrypted: null,
        isDeleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      jest
        .spyOn(providerRepo, 'createQueryBuilder')
        .mockReturnValue(createMockQueryBuilder(mockProvider) as any);

      const result = await service.getProvider('p1', TENANT_ID);

      expect(result).not.toHaveProperty('apiKeyEncrypted');
      expect(result).not.toHaveProperty('customHeadersEncrypted');
      expect(result.hasApiKey).toBe(true);
      expect(result.hasCustomHeaders).toBe(false);

      const responseJson = JSON.stringify(result);
      expect(responseJson).not.toContain('sk-12345');
    });

    it('should create a provider and encrypt the API key', async () => {
      const result = await service.createProvider(TENANT_ID, {
        providerType: AiProviderType.LOCAL,
        displayName: 'My Local AI',
        baseUrl: 'http://localhost:11434',
        modelName: 'llama2',
        apiKey: 'my-secret-token',
      });

      expect(encryptionService.encrypt).toHaveBeenCalledWith('my-secret-token');
      expect(result.hasApiKey).toBe(true);
      expect(result).not.toHaveProperty('apiKeyEncrypted');
      const responseJson = JSON.stringify(result);
      expect(responseJson).not.toContain('my-secret-token');
    });

    it('should update a provider and allow secret rotation', async () => {
      const existing: Partial<AiProviderConfig> = {
        id: 'p1',
        tenantId: TENANT_ID,
        providerType: AiProviderType.LOCAL,
        displayName: 'Old Name',
        isEnabled: true,
        baseUrl: 'http://old:11434',
        modelName: 'old-model',
        requestTimeoutMs: 30000,
        maxTokens: null,
        temperature: null,
        apiKeyEncrypted: 'encrypted:old-key',
        customHeadersEncrypted: null,
        isDeleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      jest
        .spyOn(providerRepo, 'createQueryBuilder')
        .mockReturnValue(createMockQueryBuilder(existing) as any);

      const result = await service.updateProvider('p1', TENANT_ID, {
        displayName: 'New Name',
        apiKey: 'new-secret-key',
      });

      expect(encryptionService.encrypt).toHaveBeenCalledWith('new-secret-key');
      expect(result.displayName).toBe('New Name');
      expect(result.hasApiKey).toBe(true);
    });
  });

  describe('Policy CRUD', () => {
    it('should create a new policy when none exists', async () => {
      jest.spyOn(policyRepo, 'findOne').mockResolvedValue(null);

      const result = await service.upsertPolicy(
        TENANT_ID,
        {
          isAiEnabled: true,
          humanApprovalRequiredDefault: false,
          allowedFeatures: { RISK_ADVISORY: true },
        },
        'user-1',
      );

      expect(policyRepo.create).toHaveBeenCalled();
      expect(result.isAiEnabled).toBe(true);
    });

    it('should update existing policy', async () => {
      const existing: Partial<AiFeaturePolicy> = {
        id: 'pol-1',
        tenantId: TENANT_ID,
        isAiEnabled: false,
        humanApprovalRequiredDefault: true,
        allowedFeatures: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      jest
        .spyOn(policyRepo, 'findOne')
        .mockResolvedValue(existing as AiFeaturePolicy);

      const result = await service.upsertPolicy(
        TENANT_ID,
        {
          isAiEnabled: true,
          allowedFeatures: { RISK_ADVISORY: true, INCIDENT_COPILOT: false },
        },
        'user-1',
      );

      expect(result.isAiEnabled).toBe(true);
    });

    it('should return null policy for tenant without one', async () => {
      jest.spyOn(policyRepo, 'findOne').mockResolvedValue(null);
      const result = await service.getPolicy(TENANT_ID);
      expect(result).toBeNull();
    });
  });

  describe('Audit Log', () => {
    it('should query audit events with tenant isolation', async () => {
      const mockQb = createMockQueryBuilder([]);
      jest
        .spyOn(auditRepo, 'createQueryBuilder')
        .mockReturnValue(mockQb as any);

      await service.queryAuditEvents(TENANT_ID, {
        featureKey: 'RISK_ADVISORY',
      });

      expect(mockQb.where).toHaveBeenCalledWith('e.tenant_id = :tenantId', {
        tenantId: TENANT_ID,
      });
      expect(mockQb.andWhere).toHaveBeenCalledWith(
        'e.feature_key = :featureKey',
        { featureKey: 'RISK_ADVISORY' },
      );
    });

    it('should log audit events with correct fields', async () => {
      await service.logAuditEvent({
        tenantId: TENANT_ID,
        userId: 'user-1',
        featureKey: 'SYSTEM',
        providerType: 'LOCAL',
        actionType: AiActionType.TEST_CONNECTION,
        status: AiAuditStatus.SUCCESS,
        latencyMs: 42,
        details: 'Health check passed',
      });

      expect(auditRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: TENANT_ID,
          userId: 'user-1',
          featureKey: 'SYSTEM',
          providerType: 'LOCAL',
          actionType: AiActionType.TEST_CONNECTION,
          status: AiAuditStatus.SUCCESS,
          latencyMs: 42,
        }),
      );
    });
  });

  describe('Test Connection', () => {
    it('should log an audit event for test connection', async () => {
      const mockProvider: Partial<AiProviderConfig> = {
        id: 'p1',
        tenantId: TENANT_ID,
        providerType: AiProviderType.OPENAI,
        displayName: 'Test',
        isEnabled: true,
        baseUrl: null,
        modelName: 'gpt-4',
        requestTimeoutMs: 30000,
        maxTokens: null,
        temperature: null,
        apiKeyEncrypted: 'encrypted:key',
        customHeadersEncrypted: null,
        isDeleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      jest
        .spyOn(providerRepo, 'createQueryBuilder')
        .mockReturnValue(createMockQueryBuilder(mockProvider) as any);

      const result = await service.testConnection('p1', TENANT_ID, 'user-1');

      // Cloud providers return "config valid" in v1
      expect(result.success).toBe(true);
      expect(result.message).toContain('valid');

      // Audit event should have been logged
      expect(auditRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          actionType: AiActionType.TEST_CONNECTION,
          tenantId: TENANT_ID,
          userId: 'user-1',
        }),
      );
    });
  });
});
