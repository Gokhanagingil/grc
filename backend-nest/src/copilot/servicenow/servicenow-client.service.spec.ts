import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ServiceNowClientService } from './servicenow-client.service';

describe('ServiceNowClientService', () => {
  let service: ServiceNowClientService;
  let configService: jest.Mocked<ConfigService>;

  const mockTenantId = '00000000-0000-0000-0000-000000000001';
  const differentTenantId = '00000000-0000-0000-0000-000000000099';

  const defaultEnvMap: Record<string, string> = {
    SERVICENOW_INSTANCE_URL: 'https://test.service-now.com',
    SERVICENOW_USERNAME: 'admin',
    SERVICENOW_PASSWORD: 'secret',
    SERVICENOW_INCIDENT_TABLE: 'incident',
    SERVICENOW_KB_TABLE: 'kb_knowledge',
  };

  beforeEach(async () => {
    const mockConfigService = {
      get: jest.fn((key: string) => defaultEnvMap[key] ?? undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ServiceNowClientService,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<ServiceNowClientService>(ServiceNowClientService);
    configService = module.get(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getTenantConfig', () => {
    it('should return global config when tenant-specific env not set', () => {
      const cfg = service.getTenantConfig(mockTenantId);
      expect(cfg).not.toBeNull();
      expect(cfg!.instanceUrl).toBe('https://test.service-now.com');
      expect(cfg!.username).toBe('admin');
      expect(cfg!.password).toBe('secret');
      expect(cfg!.incidentTable).toBe('incident');
      expect(cfg!.kbTable).toBe('kb_knowledge');
    });

    it('should return null when ServiceNow is not configured', () => {
      configService.get.mockReturnValue(undefined);
      const cfg = service.getTenantConfig(mockTenantId);
      expect(cfg).toBeNull();
    });

    it('should strip trailing slashes from instanceUrl', () => {
      configService.get.mockImplementation((key: string) => {
        if (key === 'SERVICENOW_INSTANCE_URL')
          return 'https://test.service-now.com///';
        return defaultEnvMap[key] ?? undefined;
      });
      const cfg = service.getTenantConfig(mockTenantId);
      expect(cfg!.instanceUrl).toBe('https://test.service-now.com');
    });

    it('should prefer tenant-specific config over global', () => {
      const tenantPrefix = `SERVICENOW_${mockTenantId.replace(/-/g, '_').toUpperCase()}`;
      configService.get.mockImplementation((key: string) => {
        if (key === `${tenantPrefix}_INSTANCE_URL`)
          return 'https://tenant1.service-now.com';
        if (key === `${tenantPrefix}_USERNAME`) return 'tenant1_admin';
        if (key === `${tenantPrefix}_PASSWORD`) return 'tenant1_secret';
        return defaultEnvMap[key] ?? undefined;
      });

      const cfg = service.getTenantConfig(mockTenantId);
      expect(cfg!.instanceUrl).toBe('https://tenant1.service-now.com');
      expect(cfg!.username).toBe('tenant1_admin');
    });

    it('should isolate tenant configs - different tenant gets different config', () => {
      const cfg1 = service.getTenantConfig(mockTenantId);
      const cfg2 = service.getTenantConfig(differentTenantId);
      expect(cfg1).toEqual(cfg2);
    });

    it('should reject invalid instanceUrl format', () => {
      configService.get.mockImplementation((key: string) => {
        if (key === 'SERVICENOW_INSTANCE_URL') return 'http://evil.example.com';
        return defaultEnvMap[key] ?? undefined;
      });
      const cfg = service.getTenantConfig(mockTenantId);
      expect(cfg).toBeNull();
    });

    it('should reject non-service-now.com domains', () => {
      configService.get.mockImplementation((key: string) => {
        if (key === 'SERVICENOW_INSTANCE_URL') return 'https://attacker.com';
        return defaultEnvMap[key] ?? undefined;
      });
      const cfg = service.getTenantConfig(mockTenantId);
      expect(cfg).toBeNull();
    });
  });

  describe('listIncidents', () => {
    it('should return empty list when SN not configured', async () => {
      configService.get.mockReturnValue(undefined);
      const result = await service.listIncidents(mockTenantId);
      expect(result).toEqual({ items: [], total: 0 });
    });

    it('should call ServiceNow Table API with correct parameters', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: jest
          .fn()
          .mockResolvedValue({ result: [{ sys_id: '123', number: 'INC001' }] }),
        headers: new Map([['X-Total-Count', '1']]) as unknown as Headers,
        text: jest.fn(),
      };
      (
        mockResponse.headers as unknown as { get: (k: string) => string | null }
      ).get = (key: string) => (key === 'X-Total-Count' ? '1' : null);

      jest
        .spyOn(global, 'fetch')
        .mockResolvedValue(mockResponse as unknown as Response);

      const result = await service.listIncidents(mockTenantId, {
        limit: 10,
        offset: 0,
      });
      expect(result.items).toHaveLength(1);
      expect(result.items[0].sys_id).toBe('123');
      expect(global.fetch).toHaveBeenCalledTimes(1);
      const callUrl = (global.fetch as jest.Mock).mock.calls[0][0] as string;
      expect(callUrl).toContain('sysparm_limit=10');
      expect(callUrl).toContain('sysparm_offset=0');
    });

    it('should include query parameter when provided', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({ result: [] }),
        headers: { get: () => '0' },
        text: jest.fn(),
      };
      jest
        .spyOn(global, 'fetch')
        .mockResolvedValue(mockResponse as unknown as Response);

      await service.listIncidents(mockTenantId, { query: 'active=true' });
      const callUrl = (global.fetch as jest.Mock).mock.calls[0][0] as string;
      expect(callUrl).toContain('sysparm_query=');
    });

    it('should throw on non-OK response', async () => {
      const mockResponse = {
        ok: false,
        status: 401,
        text: jest.fn().mockResolvedValue('Unauthorized'),
        headers: { get: () => null },
      };
      jest
        .spyOn(global, 'fetch')
        .mockResolvedValue(mockResponse as unknown as Response);

      await expect(service.listIncidents(mockTenantId)).rejects.toThrow(
        'ServiceNow API error: 401',
      );
    });
  });

  describe('getIncident', () => {
    it('should return null when SN not configured', async () => {
      configService.get.mockReturnValue(undefined);
      const result = await service.getIncident(mockTenantId, 'a'.repeat(32));
      expect(result).toBeNull();
    });

    it('should return null on 404', async () => {
      const mockResponse = {
        ok: false,
        status: 404,
        headers: { get: () => null },
      };
      jest
        .spyOn(global, 'fetch')
        .mockResolvedValue(mockResponse as unknown as Response);

      const result = await service.getIncident(mockTenantId, 'b'.repeat(32));
      expect(result).toBeNull();
    });

    it('should return incident data on success', async () => {
      const mockIncident = {
        sys_id: 'abc',
        number: 'INC001',
        short_description: 'Test',
      };
      const mockResponse = {
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({ result: mockIncident }),
        headers: { get: () => null },
      };
      jest
        .spyOn(global, 'fetch')
        .mockResolvedValue(mockResponse as unknown as Response);

      const result = await service.getIncident(
        mockTenantId,
        'abc'.padEnd(32, '0'),
      );
      expect(result).toEqual(mockIncident);
    });
  });

  describe('postComment', () => {
    it('should throw when SN not configured', async () => {
      configService.get.mockReturnValue(undefined);
      await expect(
        service.postComment(mockTenantId, 'a'.repeat(32), 'work_notes', 'test'),
      ).rejects.toThrow('ServiceNow not configured for this tenant');
    });

    it('should reject invalid sysId format', async () => {
      await expect(
        service.postComment(
          mockTenantId,
          'invalid/../path',
          'work_notes',
          'test',
        ),
      ).rejects.toThrow('Invalid ServiceNow sys_id format');
    });

    it('should send PATCH with correct field for work_notes', async () => {
      const mockResult = { sys_id: 'sys123', work_notes: 'test note' };
      const mockResponse = {
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({ result: mockResult }),
        headers: { get: () => null },
      };
      jest
        .spyOn(global, 'fetch')
        .mockResolvedValue(mockResponse as unknown as Response);

      const result = await service.postComment(
        mockTenantId,
        'a'.repeat(32),
        'work_notes',
        'test note',
      );
      expect(result).toEqual(mockResult);

      const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
      expect(fetchCall[1].method).toBe('PATCH');
      const body = JSON.parse(fetchCall[1].body);
      expect(body).toEqual({ work_notes: 'test note' });
    });

    it('should send PATCH with correct field for comments', async () => {
      const mockResult = { sys_id: 'sys123', comments: 'customer comment' };
      const mockResponse = {
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({ result: mockResult }),
        headers: { get: () => null },
      };
      jest
        .spyOn(global, 'fetch')
        .mockResolvedValue(mockResponse as unknown as Response);

      await service.postComment(
        mockTenantId,
        'a'.repeat(32),
        'comments',
        'customer comment',
      );
      const body = JSON.parse(
        (global.fetch as jest.Mock).mock.calls[0][1].body,
      );
      expect(body).toEqual({ comments: 'customer comment' });
    });
  });

  describe('retry logic', () => {
    it('should retry on 429 rate limit', async () => {
      const rateLimitResponse = {
        ok: false,
        status: 429,
        headers: { get: () => null },
        text: jest.fn().mockResolvedValue(''),
      };
      const successResponse = {
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({ result: [] }),
        headers: { get: () => '0' },
      };

      jest
        .spyOn(global, 'fetch')
        .mockResolvedValueOnce(rateLimitResponse as unknown as Response)
        .mockResolvedValueOnce(successResponse as unknown as Response);

      const origSleep = (
        service as unknown as { sleep: (ms: number) => Promise<void> }
      ).sleep;
      (service as unknown as Record<string, unknown>).sleep = jest
        .fn()
        .mockResolvedValue(undefined);

      const result = await service.listIncidents(mockTenantId);
      expect(result.items).toEqual([]);
      expect(global.fetch).toHaveBeenCalledTimes(2);

      (service as unknown as Record<string, unknown>).sleep = origSleep;
    });

    it('should retry on 500 server error', async () => {
      const serverErrorResponse = {
        ok: false,
        status: 500,
        headers: { get: () => null },
        text: jest.fn().mockResolvedValue('Internal Server Error'),
      };
      const successResponse = {
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({ result: [{ sys_id: 'x' }] }),
        headers: { get: () => '1' },
      };

      jest
        .spyOn(global, 'fetch')
        .mockResolvedValueOnce(serverErrorResponse as unknown as Response)
        .mockResolvedValueOnce(successResponse as unknown as Response);

      (service as unknown as Record<string, unknown>).sleep = jest
        .fn()
        .mockResolvedValue(undefined);

      const result = await service.listIncidents(mockTenantId);
      expect(result.items).toHaveLength(1);
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('should throw after max retries on persistent rate limit', async () => {
      const rateLimitResponse = {
        ok: false,
        status: 429,
        headers: { get: () => null },
        text: jest.fn().mockResolvedValue(''),
      };

      jest
        .spyOn(global, 'fetch')
        .mockResolvedValue(rateLimitResponse as unknown as Response);
      (service as unknown as Record<string, unknown>).sleep = jest
        .fn()
        .mockResolvedValue(undefined);

      await expect(service.listIncidents(mockTenantId)).rejects.toThrow(
        'rate limit',
      );
    });
  });

  describe('tenant isolation', () => {
    it('should use different credentials per tenant when configured', () => {
      const tenant1Prefix = `SERVICENOW_${mockTenantId.replace(/-/g, '_').toUpperCase()}`;
      const tenant2Prefix = `SERVICENOW_${differentTenantId.replace(/-/g, '_').toUpperCase()}`;

      configService.get.mockImplementation((key: string) => {
        if (key === `${tenant1Prefix}_INSTANCE_URL`)
          return 'https://t1.service-now.com';
        if (key === `${tenant1Prefix}_USERNAME`) return 'user1';
        if (key === `${tenant1Prefix}_PASSWORD`) return 'pass1';
        if (key === `${tenant2Prefix}_INSTANCE_URL`)
          return 'https://t2.service-now.com';
        if (key === `${tenant2Prefix}_USERNAME`) return 'user2';
        if (key === `${tenant2Prefix}_PASSWORD`) return 'pass2';
        return undefined;
      });

      const cfg1 = service.getTenantConfig(mockTenantId);
      const cfg2 = service.getTenantConfig(differentTenantId);

      expect(cfg1!.instanceUrl).toBe('https://t1.service-now.com');
      expect(cfg1!.username).toBe('user1');
      expect(cfg2!.instanceUrl).toBe('https://t2.service-now.com');
      expect(cfg2!.username).toBe('user2');
    });
  });
});
