import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../../audit/audit.module';
import { AuthModule } from '../../auth/auth.module';
import { TenantsModule } from '../../tenants/tenants.module';

import { CmdbCiClass } from './ci-class/ci-class.entity';
import { CiClassService } from './ci-class/ci-class.service';
import { CiClassController } from './ci-class/ci-class.controller';

import { CmdbCi } from './ci/ci.entity';
import { CiService } from './ci/ci.service';
import { CiController } from './ci/ci.controller';

import { CmdbCiRel } from './ci-rel/ci-rel.entity';
import { CiRelService } from './ci-rel/ci-rel.service';
import { CiRelController } from './ci-rel/ci-rel.controller';

import { CmdbService } from './service/cmdb-service.entity';
import { CmdbServiceService } from './service/cmdb-service.service';
import { CmdbServiceController } from './service/cmdb-service.controller';

import { CmdbServiceOffering } from './service-offering/cmdb-service-offering.entity';
import { CmdbServiceOfferingService } from './service-offering/cmdb-service-offering.service';
import { CmdbServiceOfferingController } from './service-offering/cmdb-service-offering.controller';

import { SysChoice } from '../choice/sys-choice.entity';
import { ChoiceService } from '../choice/choice.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CmdbCiClass,
      CmdbCi,
      CmdbCiRel,
      CmdbService,
      CmdbServiceOffering,
      SysChoice,
    ]),
    AuditModule,
    AuthModule,
    TenantsModule,
  ],
  providers: [
    CiClassService,
    CiService,
    CiRelService,
    CmdbServiceService,
    CmdbServiceOfferingService,
    ChoiceService,
  ],
  controllers: [
    CiClassController,
    CiController,
    CiRelController,
    CmdbServiceController,
    CmdbServiceOfferingController,
  ],
  exports: [
    CiClassService,
    CiService,
    CiRelService,
    CmdbServiceService,
    CmdbServiceOfferingService,
  ],
})
export class CmdbModule {}
