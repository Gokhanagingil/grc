import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import { SysPublishedApi } from '../entities/sys-published-api.entity';
import { SysApiKey } from '../entities/sys-api-key.entity';
import { StructuredLoggerService } from '../../common/logger';

const API_KEY_PREFIX_LENGTH = 8;
const API_KEY_BYTES = 32;

@Injectable()
export class ApiCatalogService {
  private readonly logger: StructuredLoggerService;

  constructor(
    @InjectRepository(SysPublishedApi)
    private readonly apiRepository: Repository<SysPublishedApi>,
    @InjectRepository(SysApiKey)
    private readonly keyRepository: Repository<SysApiKey>,
  ) {
    this.logger = new StructuredLoggerService();
    this.logger.setContext('ApiCatalogService');
  }

  async findApisByTenant(
    tenantId: string,
    filters?: {
      isActive?: boolean;
      tableName?: string;
      page?: number;
      pageSize?: number;
    },
  ): Promise<{ items: SysPublishedApi[]; total: number }> {
    const page = filters?.page || 1;
    const pageSize = Math.min(filters?.pageSize || 50, 100);

    const qb = this.apiRepository
      .createQueryBuilder('a')
      .where('a.tenantId = :tenantId', { tenantId });

    if (filters?.isActive !== undefined) {
      qb.andWhere('a.isActive = :isActive', { isActive: filters.isActive });
    }

    if (filters?.tableName) {
      qb.andWhere('a.tableName = :tableName', { tableName: filters.tableName });
    }

    const total = await qb.getCount();
    qb.orderBy('a.createdAt', 'DESC');
    qb.skip((page - 1) * pageSize);
    qb.take(pageSize);

    const items = await qb.getMany();
    return { items, total };
  }

  async findApiByTenant(
    tenantId: string,
    apiId: string,
  ): Promise<SysPublishedApi | null> {
    return this.apiRepository.findOne({
      where: { id: apiId, tenantId },
    });
  }

  async findApiByName(
    tenantId: string,
    name: string,
    version?: string,
  ): Promise<SysPublishedApi | null> {
    return this.apiRepository.findOne({
      where: {
        tenantId,
        name,
        version: version || 'v1',
        isActive: true,
      },
    });
  }

  async createApi(
    tenantId: string,
    data: Partial<SysPublishedApi>,
  ): Promise<SysPublishedApi> {
    const api = this.apiRepository.create({
      ...data,
      tenantId,
    });
    return this.apiRepository.save(api);
  }

  async updateApi(
    tenantId: string,
    apiId: string,
    data: Partial<SysPublishedApi>,
  ): Promise<SysPublishedApi | null> {
    const api = await this.apiRepository.findOne({
      where: { id: apiId, tenantId },
    });
    if (!api) return null;

    Object.assign(api, data);
    return this.apiRepository.save(api);
  }

  async deleteApi(tenantId: string, apiId: string): Promise<boolean> {
    const result = await this.apiRepository.delete({ id: apiId, tenantId });
    return (result.affected || 0) > 0;
  }

  async findKeysByTenant(
    tenantId: string,
    filters?: {
      isActive?: boolean;
      page?: number;
      pageSize?: number;
    },
  ): Promise<{ items: SysApiKey[]; total: number }> {
    const page = filters?.page || 1;
    const pageSize = Math.min(filters?.pageSize || 50, 100);

    const qb = this.keyRepository
      .createQueryBuilder('k')
      .where('k.tenantId = :tenantId', { tenantId });

    if (filters?.isActive !== undefined) {
      qb.andWhere('k.isActive = :isActive', { isActive: filters.isActive });
    }

    const total = await qb.getCount();
    qb.orderBy('k.createdAt', 'DESC');
    qb.skip((page - 1) * pageSize);
    qb.take(pageSize);

    const items = await qb.getMany();
    return { items, total };
  }

  async createKey(
    tenantId: string,
    data: { name: string; scopes?: string[]; expiresAt?: string },
  ): Promise<{ key: SysApiKey; rawKey: string }> {
    const rawKey = `grc_${crypto.randomBytes(API_KEY_BYTES).toString('hex')}`;
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
    const keyPrefix = rawKey.substring(0, API_KEY_PREFIX_LENGTH);

    const key = this.keyRepository.create({
      tenantId,
      name: data.name,
      keyHash,
      keyPrefix,
      scopes: data.scopes || [],
      expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
    });

    const saved = await this.keyRepository.save(key);
    return { key: saved, rawKey };
  }

  async updateKey(
    tenantId: string,
    keyId: string,
    data: Partial<SysApiKey>,
  ): Promise<SysApiKey | null> {
    const key = await this.keyRepository.findOne({
      where: { id: keyId, tenantId },
    });
    if (!key) return null;

    if (data.name !== undefined) key.name = data.name;
    if (data.scopes !== undefined) key.scopes = data.scopes;
    if (data.isActive !== undefined) key.isActive = data.isActive;
    if (data.expiresAt !== undefined) key.expiresAt = data.expiresAt;

    return this.keyRepository.save(key);
  }

  async deleteKey(tenantId: string, keyId: string): Promise<boolean> {
    const result = await this.keyRepository.delete({ id: keyId, tenantId });
    return (result.affected || 0) > 0;
  }

  async validateApiKey(
    rawKey: string,
  ): Promise<{ key: SysApiKey; tenantId: string } | null> {
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

    const key = await this.keyRepository.findOne({
      where: { keyHash, isActive: true },
    });

    if (!key) return null;

    if (key.expiresAt && key.expiresAt < new Date()) {
      return null;
    }

    await this.keyRepository.update(key.id, { lastUsedAt: new Date() });

    return { key, tenantId: key.tenantId };
  }

  generateOpenApiSpec(api: SysPublishedApi): Record<string, unknown> {
    const paths: Record<string, unknown> = {};
    const basePath = `/api/public/v1/${api.name}/records`;

    if (api.allowList) {
      paths[basePath] = {
        ...((paths[basePath] as Record<string, unknown>) || {}),
        get: {
          summary: `List ${api.name} records`,
          parameters: [
            {
              name: 'page',
              in: 'query',
              schema: { type: 'integer', default: 1 },
            },
            {
              name: 'pageSize',
              in: 'query',
              schema: { type: 'integer', default: 50 },
            },
          ],
          responses: {
            '200': {
              description: 'List of records',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      items: { type: 'array', items: { type: 'object' } },
                      total: { type: 'integer' },
                      page: { type: 'integer' },
                      pageSize: { type: 'integer' },
                    },
                  },
                },
              },
            },
          },
          security: [{ ApiKeyAuth: [] }],
        },
      };
    }

    if (api.allowCreate) {
      const existing = (paths[basePath] as Record<string, unknown>) || {};
      paths[basePath] = {
        ...existing,
        post: {
          summary: `Create ${api.name} record`,
          requestBody: {
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: Object.fromEntries(
                    api.allowedFields.write.map((f) => [f, { type: 'string' }]),
                  ),
                },
              },
            },
          },
          responses: {
            '201': { description: 'Record created' },
          },
          security: [{ ApiKeyAuth: [] }],
        },
      };
    }

    return {
      openapi: '3.0.3',
      info: {
        title: `${api.name} API`,
        version: api.version,
        description: api.description || `Published API for ${api.tableName}`,
      },
      servers: [{ url: '/api' }],
      paths,
      components: {
        securitySchemes: {
          ApiKeyAuth: {
            type: 'apiKey',
            in: 'header',
            name: 'X-API-Key',
          },
        },
      },
    };
  }
}
