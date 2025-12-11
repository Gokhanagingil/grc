import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Process } from '../entities/process.entity';
import { ControlResult } from '../entities/control-result.entity';
import { ProcessControl } from '../entities/process-control.entity';

/**
 * Process Compliance Score Response
 */
export interface ComplianceScoreResponse {
  processId: string;
  processName: string;
  complianceScore: number;
  compliantResults: number;
  totalResults: number;
  fromDate?: string;
  toDate?: string;
}

/**
 * Compliance Overview Response
 */
export interface ComplianceOverviewResponse {
  processes: ComplianceScoreResponse[];
  overallComplianceScore: number;
  totalCompliantResults: number;
  totalResults: number;
  fromDate?: string;
  toDate?: string;
}

/**
 * ProcessCompliance Service
 *
 * Service for computing compliance scores for processes.
 * Compliance score = numberOfCompliantResults / totalResults (0-1 range)
 */
@Injectable()
export class ProcessComplianceService {
  constructor(
    @InjectRepository(Process)
    private readonly processRepository: Repository<Process>,
    @InjectRepository(ControlResult)
    private readonly resultRepository: Repository<ControlResult>,
    @InjectRepository(ProcessControl)
    private readonly controlRepository: Repository<ProcessControl>,
  ) {}

  /**
   * Calculate compliance score for a single process
   */
  async getComplianceScore(
    tenantId: string,
    processId: string,
    fromDate?: Date,
    toDate?: Date,
  ): Promise<ComplianceScoreResponse | null> {
    // Verify process exists
    const process = await this.processRepository.findOne({
      where: { id: processId, tenantId, isDeleted: false },
    });

    if (!process) {
      return null;
    }

    // Get all control IDs for this process
    const controls = await this.controlRepository.find({
      where: { tenantId, processId, isDeleted: false },
      select: ['id'],
    });

    if (controls.length === 0) {
      return {
        processId,
        processName: process.name,
        complianceScore: 1, // No controls means 100% compliant by default
        compliantResults: 0,
        totalResults: 0,
        fromDate: fromDate?.toISOString(),
        toDate: toDate?.toISOString(),
      };
    }

    const controlIds = controls.map((c) => c.id);

    // Build query for results
    const qb = this.resultRepository.createQueryBuilder('result');
    qb.where('result.tenantId = :tenantId', { tenantId });
    qb.andWhere('result.controlId IN (:...controlIds)', { controlIds });
    qb.andWhere('result.isDeleted = :isDeleted', { isDeleted: false });

    if (fromDate) {
      qb.andWhere('result.executionDate >= :fromDate', { fromDate });
    }

    if (toDate) {
      qb.andWhere('result.executionDate <= :toDate', { toDate });
    }

    const totalResults = await qb.getCount();

    qb.andWhere('result.isCompliant = :isCompliant', { isCompliant: true });
    const compliantResults = await qb.getCount();

    const complianceScore = totalResults > 0 ? compliantResults / totalResults : 1;

    return {
      processId,
      processName: process.name,
      complianceScore: Math.round(complianceScore * 10000) / 10000, // Round to 4 decimal places
      compliantResults,
      totalResults,
      fromDate: fromDate?.toISOString(),
      toDate: toDate?.toISOString(),
    };
  }

  /**
   * Calculate compliance overview for all processes in a tenant
   */
  async getComplianceOverview(
    tenantId: string,
    fromDate?: Date,
    toDate?: Date,
  ): Promise<ComplianceOverviewResponse> {
    // Get all active processes
    const processes = await this.processRepository.find({
      where: { tenantId, isDeleted: false, isActive: true },
    });

    const processScores: ComplianceScoreResponse[] = [];
    let totalCompliantResults = 0;
    let totalResults = 0;

    for (const process of processes) {
      const score = await this.getComplianceScore(
        tenantId,
        process.id,
        fromDate,
        toDate,
      );

      if (score) {
        processScores.push(score);
        totalCompliantResults += score.compliantResults;
        totalResults += score.totalResults;
      }
    }

    const overallComplianceScore =
      totalResults > 0 ? totalCompliantResults / totalResults : 1;

    return {
      processes: processScores,
      overallComplianceScore: Math.round(overallComplianceScore * 10000) / 10000,
      totalCompliantResults,
      totalResults,
      fromDate: fromDate?.toISOString(),
      toDate: toDate?.toISOString(),
    };
  }

  /**
   * Get compliance trend for a process over time
   * Returns compliance scores grouped by time period
   */
  async getComplianceTrend(
    tenantId: string,
    processId: string,
    periodDays: number = 30,
    numberOfPeriods: number = 6,
  ): Promise<{
    processId: string;
    processName: string;
    trend: Array<{
      periodStart: string;
      periodEnd: string;
      complianceScore: number;
      compliantResults: number;
      totalResults: number;
    }>;
  } | null> {
    const process = await this.processRepository.findOne({
      where: { id: processId, tenantId, isDeleted: false },
    });

    if (!process) {
      return null;
    }

    const trend: Array<{
      periodStart: string;
      periodEnd: string;
      complianceScore: number;
      compliantResults: number;
      totalResults: number;
    }> = [];

    const now = new Date();

    for (let i = numberOfPeriods - 1; i >= 0; i--) {
      const periodEnd = new Date(now);
      periodEnd.setDate(periodEnd.getDate() - i * periodDays);

      const periodStart = new Date(periodEnd);
      periodStart.setDate(periodStart.getDate() - periodDays);

      const score = await this.getComplianceScore(
        tenantId,
        processId,
        periodStart,
        periodEnd,
      );

      if (score) {
        trend.push({
          periodStart: periodStart.toISOString(),
          periodEnd: periodEnd.toISOString(),
          complianceScore: score.complianceScore,
          compliantResults: score.compliantResults,
          totalResults: score.totalResults,
        });
      }
    }

    return {
      processId,
      processName: process.name,
      trend,
    };
  }
}
