import {
  Injectable,
  Optional,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MultiTenantServiceBase } from '../../common/multi-tenant-service.base';
import { ItsmIncidentCi } from './incident-ci.entity';
import { ItsmIncident } from './incident.entity';
import { CmdbCi } from '../cmdb/ci/ci.entity';
import { CmdbServiceCi } from '../cmdb/service-ci/cmdb-service-ci.entity';
import { CmdbService as CmdbServiceEntity } from '../cmdb/service/cmdb-service.entity';
import { CmdbServiceOffering } from '../cmdb/service-offering/cmdb-service-offering.entity';
import {
  IncidentCiFilterDto,
  INCIDENT_CI_SORTABLE_FIELDS,
} from './dto/incident-ci-filter.dto';
import {
  PaginatedResponse,
  createPaginatedResponse,
} from '../../grc/dto/pagination.dto';
import { AuditService } from '../../audit/audit.service';
import { ChoiceService } from '../choice/choice.service';

export interface ImpactSummary {
  affectedCis: {
    count: number;
    topClasses: { className: string; count: number }[];
    criticalCount: number;
  };
  impactedServices: {
    serviceId: string;
    name: string;
    criticality: string | null;
    status: string;
    offeringsCount: number;
    isBoundToIncident: boolean;
  }[];
  impactedOfferings: {
    offeringId: string;
    name: string;
    serviceId: string;
    serviceName: string;
    status: string;
    isInferred: boolean;
  }[];
}

@Injectable()
export class IncidentCiService extends MultiTenantServiceBase<ItsmIncidentCi> {
  constructor(
    @InjectRepository(ItsmIncidentCi)
    repository: Repository<ItsmIncidentCi>,
    @InjectRepository(ItsmIncident)
    private readonly incidentRepo: Repository<ItsmIncident>,
    @InjectRepository(CmdbCi)
    private readonly ciRepo: Repository<CmdbCi>,
    @InjectRepository(CmdbServiceCi)
    private readonly serviceCiRepo: Repository<CmdbServiceCi>,
    @InjectRepository(CmdbServiceEntity)
    private readonly cmdbServiceRepo: Repository<CmdbServiceEntity>,
    @InjectRepository(CmdbServiceOffering)
    private readonly cmdbOfferingRepo: Repository<CmdbServiceOffering>,
    @Optional() private readonly auditService?: AuditService,
    @Optional() private readonly choiceService?: ChoiceService,
  ) {
    super(repository);
  }

  async addAffectedCi(
    tenantId: string,
    userId: string,
    incidentId: string,
    ciId: string,
    relationshipType: string,
    impactScope?: string,
  ): Promise<ItsmIncidentCi> {
    const incident = await this.incidentRepo.findOne({
      where: { id: incidentId, tenantId, isDeleted: false },
    });
    if (!incident) {
      throw new NotFoundException(
        `Incident with ID ${incidentId} not found in this tenant`,
      );
    }

    const ci = await this.ciRepo.findOne({
      where: { id: ciId, tenantId, isDeleted: false },
    });
    if (!ci) {
      throw new NotFoundException(
        `CI with ID ${ciId} not found in this tenant`,
      );
    }

    if (this.choiceService) {
      const data: Record<string, unknown> = { relationshipType };
      if (impactScope) {
        data.impactScope = impactScope;
      }
      const errors = await this.choiceService.validateChoiceFields(
        tenantId,
        'itsm_incident_ci',
        data,
      );
      this.choiceService.throwIfInvalidChoices(errors);
    }

    const existing = await this.repository.findOne({
      where: {
        tenantId,
        incidentId,
        ciId,
        relationshipType,
        isDeleted: false,
      },
    });

    if (existing) {
      throw new BadRequestException(
        `CI link already exists with relationship type '${relationshipType}'`,
      );
    }

    const entity = await this.createForTenant(tenantId, {
      incidentId,
      ciId,
      relationshipType,
      impactScope: impactScope || null,
      createdBy: userId,
      isDeleted: false,
    });

    await this.auditService?.recordCreate(
      'ItsmIncidentCi',
      entity,
      userId,
      tenantId,
    );

    return this.findOneWithRelations(
      tenantId,
      entity.id,
    ) as Promise<ItsmIncidentCi>;
  }

  async removeAffectedCi(
    tenantId: string,
    userId: string,
    incidentId: string,
    linkId: string,
  ): Promise<boolean> {
    const existing = await this.repository.findOne({
      where: { id: linkId, tenantId, incidentId, isDeleted: false },
    });

    if (!existing) {
      return false;
    }

    await this.updateForTenant(tenantId, existing.id, {
      isDeleted: true,
      updatedBy: userId,
    } as Partial<Omit<ItsmIncidentCi, 'id' | 'tenantId'>>);

    await this.auditService?.recordDelete(
      'ItsmIncidentCi',
      existing,
      userId,
      tenantId,
    );

    return true;
  }

  async findAffectedCis(
    tenantId: string,
    incidentId: string,
    filterDto: IncidentCiFilterDto,
  ): Promise<PaginatedResponse<ItsmIncidentCi>> {
    const {
      page = 1,
      pageSize = 20,
      sortBy = 'createdAt',
      sortOrder = 'DESC',
      search,
      relationshipType,
      impactScope,
    } = filterDto;

    const qb = this.repository.createQueryBuilder('ic');
    qb.leftJoinAndSelect('ic.ci', 'ci');
    qb.leftJoinAndSelect('ci.ciClass', 'ciClass');

    qb.where('ic.tenantId = :tenantId', { tenantId });
    qb.andWhere('ic.incidentId = :incidentId', { incidentId });
    qb.andWhere('ic.isDeleted = :isDeleted', { isDeleted: false });

    if (relationshipType) {
      qb.andWhere('ic.relationshipType = :relationshipType', {
        relationshipType,
      });
    }

    if (impactScope) {
      qb.andWhere('ic.impactScope = :impactScope', { impactScope });
    }

    if (search) {
      qb.andWhere('(ci.name ILIKE :search OR ci.description ILIKE :search)', {
        search: `%${search}%`,
      });
    }

    const total = await qb.getCount();

    const validSortBy = INCIDENT_CI_SORTABLE_FIELDS.includes(sortBy)
      ? sortBy
      : 'createdAt';
    const validSortOrder = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    qb.orderBy(`ic.${validSortBy}`, validSortOrder);

    qb.skip((page - 1) * pageSize);
    qb.take(pageSize);

    const items = await qb.getMany();

    return createPaginatedResponse(items, total, page, pageSize);
  }

  async getImpactSummary(
    tenantId: string,
    incidentId: string,
  ): Promise<ImpactSummary> {
    const incident = await this.incidentRepo.findOne({
      where: { id: incidentId, tenantId, isDeleted: false },
    });
    if (!incident) {
      throw new NotFoundException(
        `Incident with ID ${incidentId} not found in this tenant`,
      );
    }

    const affectedCiLinks = await this.repository
      .createQueryBuilder('ic')
      .leftJoinAndSelect('ic.ci', 'ci')
      .leftJoinAndSelect('ci.ciClass', 'ciClass')
      .where('ic.tenantId = :tenantId', { tenantId })
      .andWhere('ic.incidentId = :incidentId', { incidentId })
      .andWhere('ic.isDeleted = false')
      .andWhere('ci.isDeleted = false')
      .getMany();

    const classCountMap: Record<string, number> = {};
    let criticalCount = 0;
    const affectedCiIds: string[] = [];

    for (const link of affectedCiLinks) {
      affectedCiIds.push(link.ciId);
      const className = link.ci?.ciClass?.name || 'Unknown';
      classCountMap[className] = (classCountMap[className] || 0) + 1;
      if (link.impactScope === 'service_impacting') {
        criticalCount++;
      }
    }

    const topClasses = Object.entries(classCountMap)
      .map(([className, count]) => ({ className, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const serviceMap = new Map<
      string,
      {
        serviceId: string;
        name: string;
        criticality: string | null;
        status: string;
        offeringsCount: number;
        isBoundToIncident: boolean;
      }
    >();

    if (affectedCiIds.length > 0) {
      const serviceCiLinks = await this.serviceCiRepo
        .createQueryBuilder('sc')
        .leftJoinAndSelect('sc.service', 'svc')
        .where('sc.tenantId = :tenantId', { tenantId })
        .andWhere('sc.ciId IN (:...ciIds)', { ciIds: affectedCiIds })
        .andWhere('sc.isDeleted = false')
        .andWhere('svc.isDeleted = false')
        .getMany();

      const serviceIds: string[] = [];
      for (const link of serviceCiLinks) {
        if (link.service && !serviceMap.has(link.serviceId)) {
          serviceIds.push(link.serviceId);
          serviceMap.set(link.serviceId, {
            serviceId: link.serviceId,
            name: link.service.name,
            criticality: link.service.criticality,
            status: link.service.status,
            offeringsCount: 0,
            isBoundToIncident: link.serviceId === incident.serviceId,
          });
        }
      }

      if (serviceIds.length > 0) {
        const offeringCounts = await this.cmdbOfferingRepo
          .createQueryBuilder('off')
          .select('off.serviceId', 'serviceId')
          .addSelect('COUNT(*)', 'count')
          .where('off.tenantId = :tenantId', { tenantId })
          .andWhere('off.serviceId IN (:...serviceIds)', { serviceIds })
          .andWhere('off.isDeleted = false')
          .groupBy('off.serviceId')
          .getRawMany<{ serviceId: string; count: string }>();

        for (const row of offeringCounts) {
          const entry = serviceMap.get(row.serviceId);
          if (entry) {
            entry.offeringsCount = parseInt(row.count, 10);
          }
        }
      }
    }

    if (incident.serviceId && !serviceMap.has(incident.serviceId)) {
      const boundService = await this.cmdbServiceRepo.findOne({
        where: { id: incident.serviceId, tenantId, isDeleted: false },
      });
      if (boundService) {
        const offCount = await this.cmdbOfferingRepo.count({
          where: {
            serviceId: boundService.id,
            tenantId,
            isDeleted: false,
          },
        });
        serviceMap.set(boundService.id, {
          serviceId: boundService.id,
          name: boundService.name,
          criticality: boundService.criticality,
          status: boundService.status,
          offeringsCount: offCount,
          isBoundToIncident: true,
        });
      }
    }

    const impactedServices = Array.from(serviceMap.values()).sort((a, b) => {
      const critOrder: Record<string, number> = {
        critical: 0,
        high: 1,
        medium: 2,
        low: 3,
      };
      const aCrit = critOrder[(a.criticality || 'low').toLowerCase()] ?? 4;
      const bCrit = critOrder[(b.criticality || 'low').toLowerCase()] ?? 4;
      if (aCrit !== bCrit) return aCrit - bCrit;
      return a.name.localeCompare(b.name);
    });

    const impactedServiceIds = impactedServices.map((s) => s.serviceId);
    let impactedOfferings: ImpactSummary['impactedOfferings'] = [];

    if (impactedServiceIds.length > 0) {
      const offerings = await this.cmdbOfferingRepo
        .createQueryBuilder('off')
        .leftJoinAndSelect('off.service', 'svc')
        .where('off.tenantId = :tenantId', { tenantId })
        .andWhere('off.serviceId IN (:...serviceIds)', {
          serviceIds: impactedServiceIds,
        })
        .andWhere('off.isDeleted = false')
        .orderBy('svc.name', 'ASC')
        .addOrderBy('off.name', 'ASC')
        .getMany();

      impactedOfferings = offerings.map((off) => ({
        offeringId: off.id,
        name: off.name,
        serviceId: off.serviceId,
        serviceName: off.service?.name || '',
        status: off.status,
        isInferred: true,
      }));
    }

    if (
      incident.offeringId &&
      !impactedOfferings.find((o) => o.offeringId === incident.offeringId)
    ) {
      const boundOffering = await this.cmdbOfferingRepo.findOne({
        where: { id: incident.offeringId, tenantId, isDeleted: false },
        relations: ['service'],
      });
      if (boundOffering) {
        impactedOfferings.unshift({
          offeringId: boundOffering.id,
          name: boundOffering.name,
          serviceId: boundOffering.serviceId,
          serviceName: boundOffering.service?.name || '',
          status: boundOffering.status,
          isInferred: false,
        });
      }
    }

    return {
      affectedCis: {
        count: affectedCiLinks.length,
        topClasses,
        criticalCount,
      },
      impactedServices,
      impactedOfferings,
    };
  }

  private async findOneWithRelations(
    tenantId: string,
    id: string,
  ): Promise<ItsmIncidentCi | null> {
    return this.repository.findOne({
      where: { id, tenantId, isDeleted: false },
      relations: ['ci', 'ci.ciClass'],
    });
  }
}
