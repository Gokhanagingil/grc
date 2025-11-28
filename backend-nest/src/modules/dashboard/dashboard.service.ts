import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  StandardEntity,
  StandardClauseEntity,
  ControlLibraryEntity,
  RiskCatalogEntity,
  StandardMappingEntity,
} from '../../entities/app';
import { PolicyEntity } from '../../entities/app/policy.entity';
import { RequirementEntity } from '../compliance/comp.entity';
import { RiskInstanceEntity } from '../../entities/app/risk-instance.entity';
import { EntityTypeEntity } from '../../entities/app/entity-type.entity';
import { tenantWhere } from '../../common/tenant/tenant-query.util';

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(StandardEntity)
    private readonly standardRepo: Repository<StandardEntity>,
    @InjectRepository(StandardClauseEntity)
    private readonly clauseRepo: Repository<StandardClauseEntity>,
    @InjectRepository(ControlLibraryEntity)
    private readonly controlRepo: Repository<ControlLibraryEntity>,
    @InjectRepository(RiskCatalogEntity)
    private readonly riskCatalogRepo: Repository<RiskCatalogEntity>,
    @InjectRepository(StandardMappingEntity)
    private readonly mappingRepo: Repository<StandardMappingEntity>,
    @InjectRepository(PolicyEntity)
    private readonly policyRepo: Repository<PolicyEntity>,
    @InjectRepository(RequirementEntity)
    private readonly requirementRepo: Repository<RequirementEntity>,
    @InjectRepository(RiskInstanceEntity)
    private readonly riskInstanceRepo: Repository<RiskInstanceEntity>,
    @InjectRepository(EntityTypeEntity)
    private readonly entityTypeRepo: Repository<EntityTypeEntity>,
  ) {}

  async getOverview(tenantId: string) {
    const dataFoundations = {
      standards: 0,
      clauses: 0,
      clausesSynthetic: 0,
      controls: 0,
      risks: 0,
      mappings: 0,
      mappingsSynthetic: 0,
      policies: 0,
      requirements: 0,
      riskCatalog: 0,
      riskInstances: 0,
      entityTypes: 0,
    };

    // Count each field separately with try/catch
    try {
      dataFoundations.standards = await this.standardRepo.count({
        where: { tenant_id: tenantId },
      });
    } catch (error: any) {
      console.warn(
        'dashboard counts error (standards):',
        error?.message || error,
      );
    }

    try {
      dataFoundations.clauses = await this.clauseRepo.count({
        where: { tenant_id: tenantId },
      });
    } catch (error: any) {
      console.warn(
        'dashboard counts error (clauses):',
        error?.message || error,
      );
    }

    try {
      dataFoundations.clausesSynthetic = await this.clauseRepo.count({
        where: { tenant_id: tenantId, synthetic: true },
      });
    } catch (error: any) {
      console.warn(
        'dashboard counts error (clausesSynthetic):',
        error?.message || error,
      );
    }

    try {
      dataFoundations.controls = await this.controlRepo.count({
        where: { tenant_id: tenantId },
      });
    } catch (error: any) {
      console.warn(
        'dashboard counts error (controls):',
        error?.message || error,
      );
    }

    try {
      dataFoundations.risks = await this.riskCatalogRepo.count({
        where: { tenant_id: tenantId },
      });
    } catch (error: any) {
      console.warn('dashboard counts error (risks):', error?.message || error);
    }

    try {
      dataFoundations.mappings = await this.mappingRepo.count({
        where: { tenant_id: tenantId },
      });
    } catch (error: any) {
      console.warn(
        'dashboard counts error (mappings):',
        error?.message || error,
      );
    }

    try {
      dataFoundations.mappingsSynthetic = await this.mappingRepo.count({
        where: { tenant_id: tenantId, synthetic: true },
      });
    } catch (error: any) {
      console.warn(
        'dashboard counts error (mappingsSynthetic):',
        error?.message || error,
      );
    }

    // Count policies
    try {
      dataFoundations.policies = await this.policyRepo.count({
        where: { ...tenantWhere(tenantId) },
      });
    } catch (error: any) {
      console.warn('dashboard counts error (policies):', error?.message || error);
    }

    // Count requirements
    try {
      dataFoundations.requirements = await this.requirementRepo.count({
        where: { ...tenantWhere(tenantId) },
      });
    } catch (error: any) {
      console.warn('dashboard counts error (requirements):', error?.message || error);
    }

    // Count risk catalog
    try {
      dataFoundations.riskCatalog = await this.riskCatalogRepo.count({
        where: { tenant_id: tenantId },
      });
    } catch (error: any) {
      console.warn('dashboard counts error (riskCatalog):', error?.message || error);
    }

    // Count risk instances
    try {
      dataFoundations.riskInstances = await this.riskInstanceRepo.count({
        where: { ...tenantWhere(tenantId) },
      });
    } catch (error: any) {
      console.warn('dashboard counts error (riskInstances):', error?.message || error);
    }

    // Count entity types
    try {
      dataFoundations.entityTypes = await this.entityTypeRepo.count({
        where: { ...tenantWhere(tenantId) },
      });
    } catch (error: any) {
      console.warn('dashboard counts error (entityTypes):', error?.message || error);
    }

    return {
      tenantId,
      dataFoundations,
      health: {
        status: 'ok' as const,
        time: new Date().toISOString(),
      },
    };
  }
}
