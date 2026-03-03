import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { AiProviderConfig } from './entities/ai-provider-config.entity';
import { AiFeaturePolicy } from './entities/ai-feature-policy.entity';
import { AiAuditEvent } from './entities/ai-audit-event.entity';
import { AiSuggestionsPolicy } from './entities/ai-suggestions-policy.entity';
import { SysUserNotification } from '../notification-engine/entities/sys-user-notification.entity';
import { AiAdminController } from './ai-admin.controller';
import { AiAdminService } from './ai-admin.service';
import { AiSuggestionsService } from './ai-suggestions.service';
import { EncryptionService } from './encryption/encryption.service';
import { AuthModule } from '../auth/auth.module';
import { TenantsModule } from '../tenants/tenants.module';

/**
 * AI Admin Module
 *
 * Provides the AI Control Center v1 functionality:
 * - Provider configuration management
 * - Feature policy governance
 * - Connection health checking
 * - AI audit trail
 * - Config resolution for feature modules
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([AiProviderConfig, AiFeaturePolicy, AiAuditEvent, AiSuggestionsPolicy, SysUserNotification]),
    ConfigModule,
    AuthModule,
    TenantsModule,
  ],
  controllers: [AiAdminController],
  providers: [AiAdminService, AiSuggestionsService, EncryptionService],
  exports: [AiAdminService, AiSuggestionsService, EncryptionService],
})
export class AiAdminModule {}
