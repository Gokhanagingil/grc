import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import { SysWebhookEndpoint } from '../entities/sys-webhook-endpoint.entity';
import {
  SysNotificationDelivery,
  DeliveryStatus,
} from '../entities/sys-notification-delivery.entity';
import { SsrfGuardService } from './ssrf-guard.service';
import { StructuredLoggerService } from '../../common/logger';

interface WebhookPayload {
  eventName: string;
  tableName?: string | null;
  recordId?: string | null;
  tenantId: string;
  timestamp: string;
  data: Record<string, unknown>;
}

const INITIAL_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 60000;
const BACKOFF_MULTIPLIER = 2;

@Injectable()
export class WebhookDeliveryService {
  private readonly logger: StructuredLoggerService;

  constructor(
    @InjectRepository(SysWebhookEndpoint)
    private readonly endpointRepository: Repository<SysWebhookEndpoint>,
    @InjectRepository(SysNotificationDelivery)
    private readonly deliveryRepository: Repository<SysNotificationDelivery>,
    private readonly ssrfGuard: SsrfGuardService,
  ) {
    this.logger = new StructuredLoggerService();
    this.logger.setContext('WebhookDeliveryService');
  }

  async deliverWebhook(
    tenantId: string,
    endpointId: string,
    payload: WebhookPayload,
    deliveryId: string,
  ): Promise<void> {
    const endpoint = await this.endpointRepository.findOne({
      where: { id: endpointId, tenantId, isActive: true },
    });

    if (!endpoint) {
      await this.deliveryRepository.update(deliveryId, {
        status: DeliveryStatus.FAILED,
        lastError: 'Webhook endpoint not found or inactive',
        attempts: 1,
      });
      return;
    }

    const urlValidation = this.ssrfGuard.validateUrl(endpoint.baseUrl, {
      allowInsecure: endpoint.allowInsecure,
    });

    if (!urlValidation.valid) {
      this.logger.warn('SSRF guard blocked webhook delivery', {
        endpointId,
        reason: urlValidation.reason,
      });
      await this.deliveryRepository.update(deliveryId, {
        status: DeliveryStatus.FAILED,
        lastError: `SSRF protection: ${urlValidation.reason}`,
        attempts: 1,
      });
      return;
    }

    await this.attemptDelivery(endpoint, payload, deliveryId, 0);
  }

  async deliverToAllEndpoints(
    tenantId: string,
    payload: WebhookPayload,
    deliveryId: string,
  ): Promise<void> {
    const endpoints = await this.endpointRepository.find({
      where: { tenantId, isActive: true },
    });

    if (endpoints.length === 0) {
      this.logger.log('No active webhook endpoints for tenant', { tenantId });
      await this.deliveryRepository.update(deliveryId, {
        status: DeliveryStatus.SENT,
        lastError: 'No active webhook endpoints',
        attempts: 1,
      });
      return;
    }

    for (const endpoint of endpoints) {
      const urlValidation = this.ssrfGuard.validateUrl(endpoint.baseUrl, {
        allowInsecure: endpoint.allowInsecure,
      });

      if (!urlValidation.valid) {
        this.logger.warn('SSRF guard blocked webhook endpoint', {
          endpointId: endpoint.id,
          reason: urlValidation.reason,
        });
        continue;
      }

      await this.attemptDelivery(endpoint, payload, deliveryId, 0);
    }
  }

  private async attemptDelivery(
    endpoint: SysWebhookEndpoint,
    payload: WebhookPayload,
    deliveryId: string,
    attempt: number,
  ): Promise<void> {
    const maxRetries = endpoint.maxRetries;
    const jsonBody = JSON.stringify(payload);
    const signature = this.signPayload(jsonBody, endpoint.secret);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Webhook-Signature': signature,
      'X-Webhook-Timestamp': payload.timestamp,
      'X-Webhook-Delivery-Id': deliveryId,
      ...endpoint.headers,
    };

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        endpoint.timeoutMs,
      );

      const response = await fetch(endpoint.baseUrl, {
        method: 'POST',
        headers,
        body: jsonBody,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        await this.deliveryRepository.update(deliveryId, {
          status: DeliveryStatus.SENT,
          attempts: attempt + 1,
          lastError: null,
          providerMessageId: `webhook:${endpoint.id}`,
        });
        this.logger.log('Webhook delivered successfully', {
          endpointId: endpoint.id,
          deliveryId,
          statusCode: response.status,
        });
        return;
      }

      const errorMsg = `HTTP ${response.status}: ${response.statusText}`;
      if (attempt < maxRetries) {
        const backoff = this.calculateBackoff(attempt);
        this.logger.warn('Webhook delivery failed, scheduling retry', {
          endpointId: endpoint.id,
          deliveryId,
          attempt: attempt + 1,
          maxRetries,
          nextRetryMs: backoff,
          error: errorMsg,
        });
        await this.deliveryRepository.update(deliveryId, {
          attempts: attempt + 1,
          lastError: errorMsg,
        });
        await this.delay(backoff);
        return this.attemptDelivery(endpoint, payload, deliveryId, attempt + 1);
      }

      await this.deliveryRepository.update(deliveryId, {
        status: DeliveryStatus.FAILED,
        attempts: attempt + 1,
        lastError: `Exhausted retries. Last error: ${errorMsg}`,
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';

      if (attempt < maxRetries) {
        const backoff = this.calculateBackoff(attempt);
        this.logger.warn('Webhook delivery error, scheduling retry', {
          endpointId: endpoint.id,
          deliveryId,
          attempt: attempt + 1,
          maxRetries,
          nextRetryMs: backoff,
          error: errorMsg,
        });
        await this.deliveryRepository.update(deliveryId, {
          attempts: attempt + 1,
          lastError: errorMsg,
        });
        await this.delay(backoff);
        return this.attemptDelivery(endpoint, payload, deliveryId, attempt + 1);
      }

      await this.deliveryRepository.update(deliveryId, {
        status: DeliveryStatus.FAILED,
        attempts: attempt + 1,
        lastError: `Exhausted retries. Last error: ${errorMsg}`,
      });
    }
  }

  signPayload(body: string, secret: string | null): string {
    if (!secret) return 'unsigned';
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(body);
    return `sha256=${hmac.digest('hex')}`;
  }

  verifySignature(body: string, signature: string, secret: string): boolean {
    const expected = this.signPayload(body, secret);
    if (expected.length !== signature.length) return false;
    return crypto.timingSafeEqual(
      Buffer.from(expected),
      Buffer.from(signature),
    );
  }

  private calculateBackoff(attempt: number): number {
    const backoff = INITIAL_BACKOFF_MS * Math.pow(BACKOFF_MULTIPLIER, attempt);
    const jitter = Math.random() * INITIAL_BACKOFF_MS;
    return Math.min(backoff + jitter, MAX_BACKOFF_MS);
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async findEndpointsByTenant(
    tenantId: string,
    filters?: {
      isActive?: boolean;
      page?: number;
      pageSize?: number;
    },
  ): Promise<{ items: SysWebhookEndpoint[]; total: number }> {
    const page = filters?.page || 1;
    const pageSize = Math.min(filters?.pageSize || 50, 100);

    const qb = this.endpointRepository
      .createQueryBuilder('e')
      .where('e.tenantId = :tenantId', { tenantId });

    if (filters?.isActive !== undefined) {
      qb.andWhere('e.isActive = :isActive', { isActive: filters.isActive });
    }

    const total = await qb.getCount();
    qb.orderBy('e.createdAt', 'DESC');
    qb.skip((page - 1) * pageSize);
    qb.take(pageSize);

    const items = await qb.getMany();
    return { items, total };
  }

  async findEndpointByTenant(
    tenantId: string,
    endpointId: string,
  ): Promise<SysWebhookEndpoint | null> {
    return this.endpointRepository.findOne({
      where: { id: endpointId, tenantId },
    });
  }

  async createEndpoint(
    tenantId: string,
    data: Partial<SysWebhookEndpoint>,
  ): Promise<SysWebhookEndpoint> {
    if (data.baseUrl) {
      const validation = this.ssrfGuard.validateUrl(data.baseUrl, {
        allowInsecure: data.allowInsecure,
      });
      if (!validation.valid) {
        throw new Error(`Invalid webhook URL: ${validation.reason}`);
      }
    }

    const endpoint = this.endpointRepository.create({
      ...data,
      tenantId,
    });
    return this.endpointRepository.save(endpoint);
  }

  async updateEndpoint(
    tenantId: string,
    endpointId: string,
    data: Partial<SysWebhookEndpoint>,
  ): Promise<SysWebhookEndpoint | null> {
    const endpoint = await this.endpointRepository.findOne({
      where: { id: endpointId, tenantId },
    });
    if (!endpoint) return null;

    if (data.baseUrl) {
      const validation = this.ssrfGuard.validateUrl(data.baseUrl, {
        allowInsecure: data.allowInsecure ?? endpoint.allowInsecure,
      });
      if (!validation.valid) {
        throw new Error(`Invalid webhook URL: ${validation.reason}`);
      }
    }

    Object.assign(endpoint, data);
    return this.endpointRepository.save(endpoint);
  }

  async deleteEndpoint(tenantId: string, endpointId: string): Promise<boolean> {
    const result = await this.endpointRepository.delete({
      id: endpointId,
      tenantId,
    });
    return (result.affected || 0) > 0;
  }

  async testEndpoint(
    tenantId: string,
    endpointId: string,
  ): Promise<{ success: boolean; statusCode?: number; error?: string }> {
    const endpoint = await this.endpointRepository.findOne({
      where: { id: endpointId, tenantId },
    });

    if (!endpoint) {
      return { success: false, error: 'Endpoint not found' };
    }

    const urlValidation = this.ssrfGuard.validateUrl(endpoint.baseUrl, {
      allowInsecure: endpoint.allowInsecure,
    });

    if (!urlValidation.valid) {
      return {
        success: false,
        error: `SSRF protection: ${urlValidation.reason}`,
      };
    }

    const testPayload: WebhookPayload = {
      eventName: 'webhook.test',
      tableName: null,
      recordId: null,
      tenantId,
      timestamp: new Date().toISOString(),
      data: { test: true, message: 'Webhook connectivity test' },
    };

    const jsonBody = JSON.stringify(testPayload);
    const signature = this.signPayload(jsonBody, endpoint.secret);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        endpoint.timeoutMs,
      );

      const response = await fetch(endpoint.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': signature,
          'X-Webhook-Timestamp': testPayload.timestamp,
          'X-Webhook-Test': 'true',
          ...endpoint.headers,
        },
        body: jsonBody,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      return {
        success: response.ok,
        statusCode: response.status,
        error: response.ok
          ? undefined
          : `HTTP ${response.status}: ${response.statusText}`,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
