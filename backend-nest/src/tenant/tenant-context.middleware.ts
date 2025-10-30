import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { DataSource } from 'typeorm';

@Injectable()
export class TenantContextMiddleware implements NestMiddleware {
  constructor(private readonly dataSource: DataSource) {}

  async use(req: Request, _res: Response, next: NextFunction) {
    // Resolve tenant id from JWT/headers; fallback to 'default' for dev
    // In real flow, replace this with actual tenant resolution
    const tenantId = (req.headers['x-tenant-id'] as string) || null;
    if (tenantId) {
      try {
        await this.dataSource.query(`SELECT set_config('app.tenant_id', $1, true)`, [tenantId]);
      } catch {
        // ignore if connection not ready
      }
    }
    next();
  }
}


