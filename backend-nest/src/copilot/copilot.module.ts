import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { TenantsModule } from '../tenants/tenants.module';
import { AuthModule } from '../auth/auth.module';
import {
  CopilotIncidentIndex,
  CopilotKbIndex,
  CopilotLearningEvent,
} from './entities';
import { ServiceNowClientService } from './servicenow';
import { SuggestService } from './suggest';
import { ApplyService } from './apply';
import { LearningService } from './learning';
import { IndexingService } from './indexing';
import { CopilotController } from './copilot.controller';

@Module({
  imports: [
    ConfigModule,
    TenantsModule,
    AuthModule,
    TypeOrmModule.forFeature([
      CopilotIncidentIndex,
      CopilotKbIndex,
      CopilotLearningEvent,
    ]),
  ],
  controllers: [CopilotController],
  providers: [
    ServiceNowClientService,
    SuggestService,
    ApplyService,
    LearningService,
    IndexingService,
  ],
  exports: [ServiceNowClientService],
})
export class CopilotModule {}
