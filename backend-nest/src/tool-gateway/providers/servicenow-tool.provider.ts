import { Logger } from '@nestjs/common';
import { EncryptionService } from '../../ai-admin/encryption';
import { IntegrationProviderConfig, IntegrationAuthType } from '../entities';

/**
 * ServiceNow Table Allowlist
 *
 * Only these tables can be queried through the Tool Gateway.
 * This is a security measure to prevent arbitrary data access.
 */
const ALLOWED_TABLES = new Set([
  'incident',
  'change_request',
  'cmdb_ci',
  'problem',
  'kb_knowledge',
  'sc_req_item',
  'sys_user',
]);

/**
 * Safe field sets per table.
 * If a table is not listed here, only sys_id and a minimal set are returned.
 */
const SAFE_FIELDS: Record<string, string[]> = {
  incident: [
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
  ],
  change_request: [
    'sys_id',
    'number',
    'short_description',
    'description',
    'state',
    'type',
    'risk',
    'impact',
    'priority',
    'category',
    'assignment_group',
    'assigned_to',
    'start_date',
    'end_date',
    'opened_at',
    'closed_at',
    'sys_created_on',
    'sys_updated_on',
  ],
  cmdb_ci: [
    'sys_id',
    'name',
    'sys_class_name',
    'operational_status',
    'environment',
    'category',
    'subcategory',
    'owned_by',
    'managed_by',
    'sys_created_on',
    'sys_updated_on',
  ],
  problem: [
    'sys_id',
    'number',
    'short_description',
    'state',
    'priority',
    'category',
    'assignment_group',
    'assigned_to',
    'sys_created_on',
    'sys_updated_on',
  ],
  kb_knowledge: [
    'sys_id',
    'number',
    'short_description',
    'text',
    'category',
    'workflow_state',
    'sys_created_on',
    'sys_updated_on',
  ],
  sc_req_item: [
    'sys_id',
    'number',
    'short_description',
    'state',
    'priority',
    'sys_created_on',
    'sys_updated_on',
  ],
  sys_user: [
    'sys_id',
    'user_name',
    'name',
    'email',
    'title',
    'department',
    'active',
  ],
};

const DEFAULT_FIELDS = ['sys_id', 'number', 'short_description'];

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 20;
const MAX_QUERY_LENGTH = 1000;
const SYS_ID_PATTERN = /^[a-f0-9]{32}$/i;

export interface ToolRunResult {
  success: boolean;
  data: unknown;
  meta: {
    table?: string;
    totalCount?: number;
    limit?: number;
    offset?: number;
    recordCount?: number;
  };
  error?: string;
}

/**
 * ServiceNow Tool Provider
 *
 * Implements read-only ServiceNow tools that execute through the Tool Gateway.
 * All access goes through governed provider config with encrypted credentials.
 *
 * Security:
 * - Strict table allowlist
 * - Safe field sets per table
 * - sysparm_query length caps
 * - sys_id format validation
 * - No write operations
 */
export class ServiceNowToolProvider {
  private readonly logger = new Logger(ServiceNowToolProvider.name);

  constructor(private readonly encryptionService: EncryptionService) {}

  /**
   * Execute a tool against ServiceNow
   */
  async execute(
    toolKey: string,
    input: Record<string, unknown>,
    config: IntegrationProviderConfig,
  ): Promise<ToolRunResult> {
    switch (toolKey) {
      case 'SERVICENOW_QUERY_TABLE':
        return this.queryTable(input, config);
      case 'SERVICENOW_GET_RECORD':
        return this.getRecord(input, config);
      case 'SERVICENOW_QUERY_INCIDENTS':
        return this.queryTable({ ...input, table: 'incident' }, config);
      case 'SERVICENOW_QUERY_CHANGES':
        return this.queryTable({ ...input, table: 'change_request' }, config);
      default:
        return {
          success: false,
          data: null,
          meta: {},
          error: `Unknown tool key: ${toolKey}`,
        };
    }
  }

  /**
   * Test connection to ServiceNow instance
   */
  async testConnection(
    config: IntegrationProviderConfig,
  ): Promise<{ success: boolean; latencyMs: number; message: string }> {
    const startTime = Date.now();
    try {
      const headers = this.buildHeaders(config);
      const baseUrl = config.baseUrl.replace(/\/+$/, '');
      const url = `${baseUrl}/api/now/table/sys_user?sysparm_limit=1&sysparm_fields=sys_id`;

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);

      try {
        const response = await fetch(url, {
          method: 'GET',
          headers,
          signal: controller.signal,
        });
        clearTimeout(timeout);

        const latencyMs = Date.now() - startTime;
        if (response.ok) {
          return {
            success: true,
            latencyMs,
            message: `ServiceNow connection successful (HTTP ${response.status})`,
          };
        }
        return {
          success: false,
          latencyMs,
          message: `ServiceNow returned HTTP ${response.status}`,
        };
      } catch (fetchError) {
        clearTimeout(timeout);
        const errorMessage =
          fetchError instanceof Error ? fetchError.message : 'Unknown error';
        return {
          success: false,
          latencyMs: Date.now() - startTime,
          message: `Connection failed: ${errorMessage}`,
        };
      }
    } catch (err) {
      return {
        success: false,
        latencyMs: Date.now() - startTime,
        message: err instanceof Error ? err.message : 'Unexpected error',
      };
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Private: Tool Implementations
  // ═══════════════════════════════════════════════════════════════════════

  private async queryTable(
    input: Record<string, unknown>,
    config: IntegrationProviderConfig,
  ): Promise<ToolRunResult> {
    const table = typeof input.table === 'string' ? input.table : '';
    if (!table || !ALLOWED_TABLES.has(table)) {
      return {
        success: false,
        data: null,
        meta: {},
        error: `Table "${table}" is not in the allowlist. Allowed: ${[...ALLOWED_TABLES].join(', ')}`,
      };
    }

    const query = typeof input.query === 'string' ? input.query : '';
    if (query.length > MAX_QUERY_LENGTH) {
      return {
        success: false,
        data: null,
        meta: {},
        error: `Query too long (max ${MAX_QUERY_LENGTH} characters)`,
      };
    }

    const requestedFields = Array.isArray(input.fields)
      ? (input.fields as string[])
      : [];
    const safeFieldSet = SAFE_FIELDS[table] || DEFAULT_FIELDS;
    const fields =
      requestedFields.length > 0
        ? requestedFields.filter((f) => safeFieldSet.includes(f))
        : safeFieldSet;

    const rawLimit =
      typeof input.limit === 'number' ? input.limit : DEFAULT_LIMIT;
    const limit = Math.max(1, Math.min(rawLimit, MAX_LIMIT));
    const rawOffset = typeof input.offset === 'number' ? input.offset : 0;
    const offset = Math.max(0, rawOffset);

    const baseUrl = config.baseUrl.replace(/\/+$/, '');
    const params = new URLSearchParams({
      sysparm_limit: String(limit),
      sysparm_offset: String(offset),
      sysparm_fields: fields.join(','),
      sysparm_display_value: 'true',
    });
    if (query) {
      params.set('sysparm_query', query);
    }

    const url = `${baseUrl}/api/now/table/${table}?${params.toString()}`;

    try {
      const headers = this.buildHeaders(config);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);

      const response = await fetch(url, {
        method: 'GET',
        headers,
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!response.ok) {
        return {
          success: false,
          data: null,
          meta: { table },
          error: `ServiceNow returned HTTP ${response.status}`,
        };
      }

      const body = (await response.json()) as { result: unknown[] };
      const records = body.result || [];
      const totalHeader = response.headers.get('X-Total-Count');
      const totalCount = totalHeader
        ? parseInt(totalHeader, 10)
        : records.length;

      return {
        success: true,
        data: { records },
        meta: {
          table,
          totalCount,
          limit,
          offset,
          recordCount: records.length,
        },
      };
    } catch (err) {
      this.logger.error('ServiceNow query failed', {
        table,
        error: err instanceof Error ? err.message : String(err),
      });
      return {
        success: false,
        data: null,
        meta: { table },
        error: err instanceof Error ? err.message : 'Request failed',
      };
    }
  }

  private async getRecord(
    input: Record<string, unknown>,
    config: IntegrationProviderConfig,
  ): Promise<ToolRunResult> {
    const table = typeof input.table === 'string' ? input.table : '';
    if (!table || !ALLOWED_TABLES.has(table)) {
      return {
        success: false,
        data: null,
        meta: {},
        error: `Table "${table}" is not in the allowlist. Allowed: ${[...ALLOWED_TABLES].join(', ')}`,
      };
    }

    const sysId = typeof input.sys_id === 'string' ? input.sys_id : '';
    if (!SYS_ID_PATTERN.test(sysId)) {
      return {
        success: false,
        data: null,
        meta: {},
        error: 'Invalid sys_id format: expected 32 hex characters',
      };
    }

    const requestedFields = Array.isArray(input.fields)
      ? (input.fields as string[])
      : [];
    const safeFieldSet = SAFE_FIELDS[table] || DEFAULT_FIELDS;
    const fields =
      requestedFields.length > 0
        ? requestedFields.filter((f) => safeFieldSet.includes(f))
        : safeFieldSet;

    const baseUrl = config.baseUrl.replace(/\/+$/, '');
    const params = new URLSearchParams({
      sysparm_fields: fields.join(','),
      sysparm_display_value: 'true',
    });

    const url = `${baseUrl}/api/now/table/${table}/${sysId}?${params.toString()}`;

    try {
      const headers = this.buildHeaders(config);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);

      const response = await fetch(url, {
        method: 'GET',
        headers,
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (response.status === 404) {
        return {
          success: false,
          data: null,
          meta: { table },
          error: `Record ${sysId} not found in ${table}`,
        };
      }

      if (!response.ok) {
        return {
          success: false,
          data: null,
          meta: { table },
          error: `ServiceNow returned HTTP ${response.status}`,
        };
      }

      const body = (await response.json()) as { result: unknown };
      return {
        success: true,
        data: { record: body.result },
        meta: { table, recordCount: 1 },
      };
    } catch (err) {
      this.logger.error('ServiceNow getRecord failed', {
        table,
        sysId,
        error: err instanceof Error ? err.message : String(err),
      });
      return {
        success: false,
        data: null,
        meta: { table },
        error: err instanceof Error ? err.message : 'Request failed',
      };
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Private: Auth Header Building
  // ═══════════════════════════════════════════════════════════════════════

  private buildHeaders(
    config: IntegrationProviderConfig,
  ): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };

    if (config.authType === IntegrationAuthType.BASIC) {
      const username = config.usernameEncrypted
        ? this.encryptionService.decrypt(config.usernameEncrypted)
        : null;
      const password = config.passwordEncrypted
        ? this.encryptionService.decrypt(config.passwordEncrypted)
        : null;
      if (username && password) {
        const encoded = Buffer.from(`${username}:${password}`).toString(
          'base64',
        );
        headers['Authorization'] = `Basic ${encoded}`;
      }
    } else if (config.authType === IntegrationAuthType.API_TOKEN) {
      const token = config.tokenEncrypted
        ? this.encryptionService.decrypt(config.tokenEncrypted)
        : null;
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    }

    // Add custom headers if they exist
    if (config.customHeadersEncrypted) {
      const customHeadersJson = this.encryptionService.decrypt(
        config.customHeadersEncrypted,
      );
      if (customHeadersJson) {
        try {
          const customHeaders = JSON.parse(customHeadersJson) as Record<
            string,
            string
          >;
          for (const [key, value] of Object.entries(customHeaders)) {
            headers[key] = value;
          }
        } catch {
          // Invalid JSON — skip custom headers
        }
      }
    }

    return headers;
  }
}
