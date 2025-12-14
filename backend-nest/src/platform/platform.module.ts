import { Module } from '@nestjs/common';
import { ModulesController } from './controllers/modules.controller';
import { FormLayoutsController } from './controllers/form-layouts.controller';
import { UiPoliciesController } from './controllers/ui-policies.controller';

/**
 * Platform Module
 *
 * Provides stub endpoints for Platform Core features to prevent 404 errors.
 * These are minimal implementations that return safe defaults.
 *
 * Endpoints:
 * - /platform/modules/* - Module management stubs
 * - /platform/form-layouts/* - Form layout stubs
 * - /platform/ui-policies/* - UI policy stubs
 */
@Module({
  controllers: [ModulesController, FormLayoutsController, UiPoliciesController],
  providers: [],
})
export class PlatformModule {}
