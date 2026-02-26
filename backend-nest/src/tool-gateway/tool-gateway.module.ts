import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IntegrationProviderConfig } from './entities/integration-provider-config.entity';
import { ToolPolicy } from './entities/tool-policy.entity';
import { AiAuditEvent } from '../ai-admin/entities/ai-audit-event.entity';
import {
  ToolGatewayAdminController,
  ToolGatewayRuntimeController,
} from './tool-gateway.controller';
import { ToolGatewayService } from './tool-gateway.service';
import { AiAdminModule } from '../ai-admin/ai-admin.module';
import { AuthModule } from '../auth/auth.module';
import { TenantsModule } from '../tenants/tenants.module';
import { NotificationEngineModule } from '../notification-engine/notification-engine.module';

/**
 * Tool Gateway Module
 *
 * Provides the Tool Gateway v1.1 functionality:
 * - Integration provider configuration (ServiceNow)
 * - Tool policy governance (per-tenant)
 * - Runtime tool execution with RBAC + audit
 * - Tool status endpoint for features
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      IntegrationProviderConfig,
      ToolPolicy,
      AiAuditEvent,
    ]),
    AiAdminModule, // For EncryptionService
    AuthModule,
    TenantsModule,
    NotificationEngineModule, // For SsrfGuardService
  ],
  controllers: [ToolGatewayAdminController, ToolGatewayRuntimeController],
  providers: [ToolGatewayService],
  exports: [ToolGatewayService],
})
export class ToolGatewayModule {}
