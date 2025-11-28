import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../modules/auth/jwt.guard';

@Controller({ path: 'protected', version: '2' })
export class ProtectedController {
  @UseGuards(JwtAuthGuard)
  @Get('ping')
  ping(@Req() req: any) {
    const headerTenant =
      (req.headers?.['x-tenant-id'] as string | undefined)?.trim() ??
      (req.headers?.['X-Tenant-Id'] as string | undefined)?.trim();
    const tenantId = headerTenant && headerTenant.length > 0
      ? headerTenant
      : req.user?.tenantId ??
        null;

    return {
      ok: true,
      tenantId,
      user: {
        id: req.user?.userId ?? req.user?.sub ?? null,
        email: req.user?.email ?? null,
        roles: req.user?.roles ?? [],
        tenantId: req.user?.tenantId ?? tenantId,
      },
      ts: new Date().toISOString(),
    };
  }
}

