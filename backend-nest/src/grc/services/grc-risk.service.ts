import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { MultiTenantServiceBase } from '../../common/multi-tenant-service.base';
import { GrcRisk } from '../entities/grc-risk.entity';
import { RiskCreatedEvent, RiskUpdatedEvent } from '../events';
import { RiskStatus, RiskSeverity } from '../enums';

/**
 * GRC Risk Service
 *
 * Multi-tenant service for managing risks.
 * Extends MultiTenantServiceBase for tenant-aware CRUD operations.
 */
@Injectable()
export class GrcRiskService extends MultiTenantServiceBase<GrcRisk> {
  constructor(
    @InjectRepository(GrcRisk)
    repository: Repository<GrcRisk>,
    private readonly eventEmitter: EventEmitter2,
  ) {
    super(repository);
  }

  /**
   * Create a new risk and emit RiskCreatedEvent
   */
  async createRisk(
    tenantId: string,
    userId: string,
    data: Omit<Partial<GrcRisk>, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>,
  ): Promise<GrcRisk> {
    const risk = await this.createForTenant(tenantId, data);

    // Emit domain event
    this.eventEmitter.emit(
      'risk.created',
      new RiskCreatedEvent(risk.id, tenantId, userId, risk.title),
    );

    return risk;
  }

  /**
   * Update a risk and emit RiskUpdatedEvent
   */
  async updateRisk(
    tenantId: string,
    userId: string,
    id: string,
    data: Partial<Omit<GrcRisk, 'id' | 'tenantId'>>,
  ): Promise<GrcRisk | null> {
    const risk = await this.updateForTenant(tenantId, id, data);

    if (risk) {
      // Emit domain event
      this.eventEmitter.emit(
        'risk.updated',
        new RiskUpdatedEvent(risk.id, tenantId, userId, data),
      );
    }

    return risk;
  }

  /**
   * Find risks by status for a tenant
   */
  async findByStatus(tenantId: string, status: RiskStatus): Promise<GrcRisk[]> {
    return this.findAllForTenant(tenantId, {
      where: { status } as FindOptionsWhere<GrcRisk>,
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Find risks by severity for a tenant
   */
  async findBySeverity(
    tenantId: string,
    severity: RiskSeverity,
  ): Promise<GrcRisk[]> {
    return this.findAllForTenant(tenantId, {
      where: { severity } as FindOptionsWhere<GrcRisk>,
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Find high-severity risks (HIGH or CRITICAL)
   */
  async findHighSeverityRisks(tenantId: string): Promise<GrcRisk[]> {
    return this.repository.find({
      where: [
        { tenantId, severity: RiskSeverity.HIGH },
        { tenantId, severity: RiskSeverity.CRITICAL },
      ],
      order: { severity: 'DESC', createdAt: 'DESC' },
    });
  }

  /**
   * Find risks with their associated controls
   */
  async findWithControls(
    tenantId: string,
    id: string,
  ): Promise<GrcRisk | null> {
    return this.repository.findOne({
      where: { id, tenantId },
      relations: ['riskControls', 'riskControls.control'],
    });
  }

  /**
   * Get risk statistics for a tenant
   */
  async getStatistics(tenantId: string): Promise<{
    total: number;
    byStatus: Record<string, number>;
    bySeverity: Record<string, number>;
  }> {
    const risks = await this.findAllForTenant(tenantId);

    const byStatus: Record<string, number> = {};
    const bySeverity: Record<string, number> = {};

    for (const risk of risks) {
      byStatus[risk.status] = (byStatus[risk.status] || 0) + 1;
      bySeverity[risk.severity] = (bySeverity[risk.severity] || 0) + 1;
    }

    return {
      total: risks.length,
      byStatus,
      bySeverity,
    };
  }
}
