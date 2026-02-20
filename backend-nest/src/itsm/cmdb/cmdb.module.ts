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

import { SysChoice } from '../choice/sys-choice.entity';
import { ChoiceService } from '../choice/choice.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([CmdbCiClass, CmdbCi, CmdbCiRel, SysChoice]),
    AuditModule,
    AuthModule,
    TenantsModule,
  ],
  providers: [CiClassService, CiService, CiRelService, ChoiceService],
  controllers: [CiClassController, CiController, CiRelController],
  exports: [CiClassService, CiService, CiRelService],
})
export class CmdbModule {}
