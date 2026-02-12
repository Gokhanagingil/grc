import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StructuredLoggerService } from '../../common/logger';
import { sanitizeString } from '../../common/logger/log-sanitizer';

export interface ServiceNowConfig {
  instanceUrl: string;
  username: string;
  password: string;
  incidentTable: string;
  kbTable: string;
}

export interface SnIncident {
  sys_id: string;
  number: string;
  short_description: string;
  description: string;
  state: string;
  impact: string;
  urgency: string;
  priority: string;
  category: string;
  assignment_group: string;
  assigned_to: string;
  service_offering: string;
  business_service: string;
  opened_at: string;
  resolved_at: string;
  closed_at: string;
  close_code: string;
  close_notes: string;
  sys_created_on: string;
  sys_updated_on: string;
  work_notes: string;
  comments: string;
}

export interface SnKbArticle {
  sys_id: string;
  number: string;
  short_description: string;
  text: string;
  category: string;
  workflow_state: string;
  sys_created_on: string;
  sys_updated_on: string;
}

export interface SnListResponse<T> {
  result: T[];
}

export interface SnSingleResponse<T> {
  result: T;
}

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;
const RATE_LIMIT_STATUS = 429;

@Injectable()
export class ServiceNowClientService {
  private readonly logger: StructuredLoggerService;

  constructor(private readonly configService: ConfigService) {
    this.logger = new StructuredLoggerService();
    this.logger.setContext('ServiceNowClient');
  }

  getTenantConfig(tenantId: string): ServiceNowConfig | null {
    const prefix = `SERVICENOW_${tenantId.replace(/-/g, '_').toUpperCase()}`;
    const instanceUrl =
      this.configService.get<string>(`${prefix}_INSTANCE_URL`) ||
      this.configService.get<string>('SERVICENOW_INSTANCE_URL');
    const username =
      this.configService.get<string>(`${prefix}_USERNAME`) ||
      this.configService.get<string>('SERVICENOW_USERNAME');
    const password =
      this.configService.get<string>(`${prefix}_PASSWORD`) ||
      this.configService.get<string>('SERVICENOW_PASSWORD');

    if (!instanceUrl || !username || !password) {
      return null;
    }

    return {
      instanceUrl: instanceUrl.replace(/\/+$/, ''),
      username,
      password,
      incidentTable:
        this.configService.get<string>(`${prefix}_INCIDENT_TABLE`) ||
        this.configService.get<string>('SERVICENOW_INCIDENT_TABLE') ||
        'incident',
      kbTable:
        this.configService.get<string>(`${prefix}_KB_TABLE`) ||
        this.configService.get<string>('SERVICENOW_KB_TABLE') ||
        'kb_knowledge',
    };
  }

  private async fetchWithRetry(
    url: string,
    options: RequestInit,
    tenantId: string,
    attempt = 1,
  ): Promise<Response> {
    const safeUrl = sanitizeString(url);
    try {
      const response = await fetch(url, options);

      if (response.status === RATE_LIMIT_STATUS) {
        if (attempt <= MAX_RETRIES) {
          const retryAfter = response.headers.get('Retry-After');
          const delay = retryAfter
            ? parseInt(retryAfter, 10) * 1000
            : BASE_DELAY_MS * Math.pow(2, attempt - 1);
          this.logger.warn('ServiceNow rate limited, retrying', {
            tenantId,
            attempt,
            delay,
            url: safeUrl,
          });
          await this.sleep(delay);
          return this.fetchWithRetry(url, options, tenantId, attempt + 1);
        }
        throw new Error(
          `ServiceNow rate limit exceeded after ${MAX_RETRIES} retries`,
        );
      }

      if (response.status >= 500 && attempt <= MAX_RETRIES) {
        const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
        this.logger.warn('ServiceNow server error, retrying', {
          tenantId,
          attempt,
          status: response.status,
          url: safeUrl,
        });
        await this.sleep(delay);
        return this.fetchWithRetry(url, options, tenantId, attempt + 1);
      }

      return response;
    } catch (error) {
      if (
        attempt <= MAX_RETRIES &&
        !(
          error instanceof TypeError &&
          (error.message || '').includes('rate limit')
        )
      ) {
        const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
        this.logger.warn('ServiceNow request failed, retrying', {
          tenantId,
          attempt,
          error: error instanceof Error ? error.message : String(error),
          url: safeUrl,
        });
        await this.sleep(delay);
        return this.fetchWithRetry(url, options, tenantId, attempt + 1);
      }
      throw error;
    }
  }

  private buildHeaders(cfg: ServiceNowConfig): Record<string, string> {
    const encoded = Buffer.from(`${cfg.username}:${cfg.password}`).toString(
      'base64',
    );
    return {
      Authorization: `Basic ${encoded}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
  }

  async listIncidents(
    tenantId: string,
    params?: { limit?: number; offset?: number; query?: string },
  ): Promise<{ items: SnIncident[]; total: number }> {
    const cfg = this.getTenantConfig(tenantId);
    if (!cfg) {
      this.logger.warn('ServiceNow not configured for tenant', { tenantId });
      return { items: [], total: 0 };
    }

    const limit = params?.limit ?? 20;
    const offset = params?.offset ?? 0;
    const fields = [
      'sys_id',
      'number',
      'short_description',
      'description',
      'state',
      'impact',
      'urgency',
      'priority',
      'category',
      'assignment_group',
      'assigned_to',
      'service_offering',
      'business_service',
      'opened_at',
      'resolved_at',
      'closed_at',
      'sys_created_on',
      'sys_updated_on',
    ].join(',');

    let url = `${cfg.instanceUrl}/api/now/table/${cfg.incidentTable}?sysparm_limit=${limit}&sysparm_offset=${offset}&sysparm_fields=${fields}&sysparm_display_value=true`;
    if (params?.query) {
      url += `&sysparm_query=${encodeURIComponent(params.query)}`;
    }

    const response = await this.fetchWithRetry(
      url,
      { method: 'GET', headers: this.buildHeaders(cfg) },
      tenantId,
    );

    if (!response.ok) {
      const text = await response.text();
      this.logger.error('ServiceNow listIncidents failed', {
        tenantId,
        status: response.status,
        body: sanitizeString(text.substring(0, 500)),
      });
      throw new Error(`ServiceNow API error: ${response.status}`);
    }

    const body = (await response.json()) as SnListResponse<SnIncident>;
    const totalHeader = response.headers.get('X-Total-Count');
    const total = totalHeader
      ? parseInt(totalHeader, 10)
      : (body.result || []).length;

    return { items: body.result || [], total };
  }

  async getIncident(
    tenantId: string,
    sysId: string,
  ): Promise<SnIncident | null> {
    const cfg = this.getTenantConfig(tenantId);
    if (!cfg) {
      this.logger.warn('ServiceNow not configured for tenant', { tenantId });
      return null;
    }

    const url = `${cfg.instanceUrl}/api/now/table/${cfg.incidentTable}/${sysId}?sysparm_display_value=true`;
    const response = await this.fetchWithRetry(
      url,
      { method: 'GET', headers: this.buildHeaders(cfg) },
      tenantId,
    );

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      const text = await response.text();
      this.logger.error('ServiceNow getIncident failed', {
        tenantId,
        sysId,
        status: response.status,
        body: sanitizeString(text.substring(0, 500)),
      });
      throw new Error(`ServiceNow API error: ${response.status}`);
    }

    const body = (await response.json()) as SnSingleResponse<SnIncident>;
    return body.result || null;
  }

  async postComment(
    tenantId: string,
    sysId: string,
    field: 'work_notes' | 'comments',
    text: string,
  ): Promise<SnIncident> {
    const cfg = this.getTenantConfig(tenantId);
    if (!cfg) {
      throw new Error('ServiceNow not configured for this tenant');
    }

    const url = `${cfg.instanceUrl}/api/now/table/${cfg.incidentTable}/${sysId}`;
    const payload: Record<string, string> = {};
    payload[field] = text;

    const response = await this.fetchWithRetry(
      url,
      {
        method: 'PATCH',
        headers: this.buildHeaders(cfg),
        body: JSON.stringify(payload),
      },
      tenantId,
    );

    if (!response.ok) {
      const responseText = await response.text();
      this.logger.error('ServiceNow postComment failed', {
        tenantId,
        sysId,
        field,
        status: response.status,
        body: sanitizeString(responseText.substring(0, 500)),
      });
      throw new Error(`ServiceNow comment API error: ${response.status}`);
    }

    const body = (await response.json()) as SnSingleResponse<SnIncident>;
    return body.result;
  }

  async listKbArticles(
    tenantId: string,
    params?: { limit?: number; query?: string },
  ): Promise<SnKbArticle[]> {
    const cfg = this.getTenantConfig(tenantId);
    if (!cfg) {
      return [];
    }

    const limit = params?.limit ?? 50;
    const fields = [
      'sys_id',
      'number',
      'short_description',
      'text',
      'category',
      'workflow_state',
      'sys_created_on',
      'sys_updated_on',
    ].join(',');

    let url = `${cfg.instanceUrl}/api/now/table/${cfg.kbTable}?sysparm_limit=${limit}&sysparm_fields=${fields}`;
    if (params?.query) {
      url += `&sysparm_query=${encodeURIComponent(params.query)}`;
    }

    const response = await this.fetchWithRetry(
      url,
      { method: 'GET', headers: this.buildHeaders(cfg) },
      tenantId,
    );

    if (!response.ok) {
      this.logger.warn('ServiceNow listKbArticles failed', {
        tenantId,
        status: response.status,
      });
      return [];
    }

    const body = (await response.json()) as SnListResponse<SnKbArticle>;
    return body.result || [];
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
