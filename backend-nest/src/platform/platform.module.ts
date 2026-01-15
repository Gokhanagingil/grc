import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MulterModule } from '@nestjs/platform-express';
import { ModulesController } from './controllers/modules.controller';
import { FormLayoutsController } from './controllers/form-layouts.controller';
import { UiPoliciesController } from './controllers/ui-policies.controller';
import { AttachmentController } from './controllers/attachment.controller';
import { ListViewController } from './controllers/list-view.controller';
import { ExportController } from './controllers/export.controller';
import { TenantsModule } from '../tenants/tenants.module';
import { AuthModule } from '../auth/auth.module';
import { Attachment } from './entities/attachment.entity';
import { ListView, ListViewColumn } from './entities/list-view.entity';
import { AttachmentService } from './services/attachment.service';
import { ListViewService } from './services/list-view.service';
import { ExportService } from './services/export.service';
import { LocalFsAdapter, STORAGE_ADAPTER } from './storage';

/**
 * Platform Module
 *
 * Provides Platform Core features including:
 * - Universal Attachments: File attachment management for any record
 * - List Views: Persistent column management with gear icon UI
 * - Export: CSV/XLSX export with view + filter + sort support
 * - Module management stubs
 * - Form layout stubs
 * - UI policy stubs
 *
 * Security:
 * - All routes require JWT authentication (JwtAuthGuard)
 * - All routes require valid tenant access (TenantGuard validates x-tenant-id header)
 * - Write operations require appropriate permissions
 *
 * Endpoints:
 * - /grc/attachments/* - Universal attachment management
 * - /grc/list-views/* - List view management
 * - /grc/export - Data export
 * - /platform/modules/* - Module management stubs
 * - /platform/form-layouts/* - Form layout stubs
 * - /platform/ui-policies/* - UI policy stubs
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Attachment, ListView, ListViewColumn]),
    MulterModule.register({
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB default, can be overridden by config
      },
    }),
    TenantsModule,
    forwardRef(() => AuthModule),
  ],
  controllers: [
    ModulesController,
    FormLayoutsController,
    UiPoliciesController,
    AttachmentController,
    ListViewController,
    ExportController,
  ],
  providers: [
    AttachmentService,
    ListViewService,
    ExportService,
    {
      provide: STORAGE_ADAPTER,
      useClass: LocalFsAdapter,
    },
  ],
  exports: [AttachmentService, ListViewService, ExportService],
})
export class PlatformModule {}
