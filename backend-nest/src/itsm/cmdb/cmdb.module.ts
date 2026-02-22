import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../../audit/audit.module';
import { AuthModule } from '../../auth/auth.module';
import { TenantsModule } from '../../tenants/tenants.module';

import { CmdbCiClass } from './ci-class/ci-class.entity';
import { CiClassService } from './ci-class/ci-class.service';
import { CiClassInheritanceService } from './ci-class/ci-class-inheritance.service';
import { CiClassController } from './ci-class/ci-class.controller';

import { CmdbCi } from './ci/ci.entity';
import { CiService } from './ci/ci.service';
import { CiAttributeValidationService } from './ci/ci-attribute-validation.service';
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

import { CmdbServiceCi } from './service-ci/cmdb-service-ci.entity';
import { CmdbServiceCiService } from './service-ci/cmdb-service-ci.service';
import { CmdbServiceCiController } from './service-ci/cmdb-service-ci.controller';

import { SysChoice } from '../choice/sys-choice.entity';
import { ChoiceService } from '../choice/choice.service';

import { TopologyService } from './topology/topology.service';
import { TopologyController } from './topology/topology.controller';

import { CmdbRelationshipType } from './relationship-type/relationship-type.entity';
import { RelationshipTypeService } from './relationship-type/relationship-type.service';
import { RelationshipTypeController } from './relationship-type/relationship-type.controller';
import { RelationshipSemanticsValidationService } from './relationship-type/relationship-semantics-validation.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CmdbCiClass,
      CmdbCi,
      CmdbCiRel,
      CmdbService,
      CmdbServiceOffering,
      CmdbServiceCi,
      SysChoice,
      CmdbRelationshipType,
    ]),
    AuditModule,
    AuthModule,
    TenantsModule,
  ],
  providers: [
    CiClassService,
    CiClassInheritanceService,
    CiService,
    CiAttributeValidationService,
    CiRelService,
    CmdbServiceService,
    CmdbServiceOfferingService,
    CmdbServiceCiService,
    ChoiceService,
    TopologyService,
    RelationshipTypeService,
    RelationshipSemanticsValidationService,
  ],
  controllers: [
    CiClassController,
    CiController,
    CiRelController,
    CmdbServiceController,
    CmdbServiceOfferingController,
    CmdbServiceCiController,
    TopologyController,
    RelationshipTypeController,
  ],
  exports: [
    CiClassService,
    CiClassInheritanceService,
    CiService,
    CiRelService,
    CmdbServiceService,
    CmdbServiceOfferingService,
    CmdbServiceCiService,
    TopologyService,
    RelationshipTypeService,
  ],
})
export class CmdbModule {}
