import { Request } from 'express';
import { ConfigService } from '@nestjs/config';

/**
 * Extract tenant ID from request headers or use default
 * @param req - Express request object
 * @param config - ConfigService instance
 * @returns Tenant ID string
 */
export function getTenantId(req: Request, config: ConfigService): string {
  const headerTenantId = req.headers['x-tenant-id'] as string;
  if (headerTenantId) {
    return headerTenantId;
  }
  return config.get<string>('DEFAULT_TENANT_ID') || '217492b2-f814-4ba0-ae50-4e4f8ecf6216';
}

