import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SysPublishedApi } from './entities/sys-published-api.entity';
import { SysApiKey } from './entities/sys-api-key.entity';
import { SysApiAuditLog } from './entities/sys-api-audit-log.entity';
import { ApiCatalogService } from './services/api-catalog.service';
import { ApiGatewayService } from './services/api-gateway.service';
import { ApiCatalogController } from './api-catalog.controller';
import { ApiKeyController } from './api-key.controller';
import { PublicApiGatewayController } from './public-api-gateway.controller';
import { GuardsModule } from '../common/guards';

@Module({
  imports: [
    TypeOrmModule.forFeature([SysPublishedApi, SysApiKey, SysApiAuditLog]),
    GuardsModule,
  ],
  controllers: [
    ApiCatalogController,
    ApiKeyController,
    PublicApiGatewayController,
  ],
  providers: [ApiCatalogService, ApiGatewayService],
  exports: [ApiCatalogService, ApiGatewayService],
})
export class ApiCatalogModule {}
