# Guards Module Pattern

## Overview

The `GuardsModule` is a shared NestJS module that provides all guard-related dependencies for feature modules. It solves the common NestJS dependency injection issue where guards used in controllers require services that aren't available in the feature module's DI context.

## Problem

When a controller uses guards like `@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)`, NestJS resolves the guard dependencies in the **importing module's context**, not the global AppModule context. This means if `TenantGuard` needs `TenantsService` and `PermissionsGuard` needs `PermissionService`, those services must be available in the module that declares the controller.

Without proper imports, you'll see errors like:
```
Error: Nest can't resolve dependencies of the TenantGuard (?, EventEmitter). 
Please make sure that the argument TenantsService at index [0] is available in the NotificationsModule context.
```

## Solution

The `GuardsModule` re-exports `AuthModule` and `TenantsModule`, making all guard dependencies available with a single import:

```typescript
// src/common/guards/guards.module.ts
import { Module, forwardRef } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { TenantsModule } from '../../tenants/tenants.module';

@Module({
  imports: [forwardRef(() => AuthModule), forwardRef(() => TenantsModule)],
  exports: [AuthModule, TenantsModule],
})
export class GuardsModule {}
```

## Usage

Import `GuardsModule` in any feature module that uses protected routes:

```typescript
import { Module } from '@nestjs/common';
import { GuardsModule } from '../common/guards';
import { MyController } from './my.controller';
import { MyService } from './my.service';

@Module({
  imports: [GuardsModule],
  controllers: [MyController],
  providers: [MyService],
})
export class MyModule {}
```

The controller can then use all guards:

```typescript
import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../tenants/guards/tenant.guard';
import { PermissionsGuard } from '../auth/permissions/permissions.guard';
import { Permissions } from '../auth/permissions/permissions.decorator';
import { Permission } from '../auth/permissions/permission.enum';

@Controller('my-resource')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class MyController {
  @Get()
  @Permissions(Permission.GRC_RISK_READ)
  findAll() {
    // Protected route
  }
}
```

## Dependencies Provided

The `GuardsModule` provides access to:

| Guard | Required Dependencies | Source Module |
|-------|----------------------|---------------|
| `JwtAuthGuard` | JWT strategy, ConfigService | AuthModule |
| `TenantGuard` | TenantsService, EventEmitter2 | TenantsModule |
| `PermissionsGuard` | Reflector, PermissionService | AuthModule |

## Why forwardRef?

The `forwardRef(() => ...)` is used to handle potential circular dependencies between `AuthModule` and `TenantsModule`. This ensures NestJS can resolve the module graph correctly regardless of import order.

## Modules Using GuardsModule

As of FAZ 5:
- `NotificationsModule` - Notification status and test endpoints
- `JobsModule` - Background job management endpoints

## Best Practices

1. **Always use GuardsModule** for new feature modules that need protected routes
2. **Don't import AuthModule and TenantsModule separately** - use GuardsModule for consistency
3. **Keep GuardsModule minimal** - it should only re-export modules, not define new providers
4. **Update this list** when adding new modules that use GuardsModule
