import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { UserEntity } from '../../entities/auth/user.entity';
import { TenantEntity } from '../../entities/tenant/tenant.entity';
import { PolicyEntity } from '../../entities/app/policy.entity';
import { RequirementEntity } from '../compliance/comp.entity';
import { BIAProcessEntity } from '../../entities/app/bia-process.entity';
import { BCPPlanEntity } from '../../entities/app/bcp-plan.entity';
import { BCPExerciseEntity } from '../../entities/app/bcp-exercise.entity';
import { RiskCatalogEntity } from '../../entities/app/risk-catalog.entity';
import { DictionaryEntity } from '../../entities/app/dictionary.entity';
import { RoleEntity } from '../../entities/auth/role.entity';
import { PermissionEntity } from '../../entities/auth/permission.entity';
import { RolePermissionEntity } from '../../entities/auth/role-permission.entity';
import { UserRoleEntity } from '../../entities/auth/user-role.entity';
import { AdminGuard } from './guards/admin.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      UserEntity,
      TenantEntity,
      PolicyEntity,
      RequirementEntity,
      BIAProcessEntity,
      BCPPlanEntity,
      BCPExerciseEntity,
      RiskCatalogEntity,
      DictionaryEntity,
      RoleEntity,
      PermissionEntity,
      RolePermissionEntity,
      UserRoleEntity,
    ]),
  ],
  controllers: [AdminController],
  providers: [AdminService, AdminGuard],
  exports: [AdminService, AdminGuard],
})
export class AdminModule {}

