import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PriorityMatrixEntry } from './priority-matrix.entity';
import { IncidentImpact, IncidentUrgency, IncidentPriority } from '../enums';

/**
 * Default ITIL Priority Matrix (used when no tenant-specific matrix exists).
 *
 * | Impact \ Urgency | HIGH | MEDIUM | LOW  |
 * |------------------|------|--------|------|
 * | HIGH             | P1   | P2     | P3   |
 * | MEDIUM           | P2   | P3     | P4   |
 * | LOW              | P3   | P4     | P4   |
 */
const DEFAULT_MATRIX: Record<string, Record<string, string>> = {
  [IncidentImpact.HIGH]: {
    [IncidentUrgency.HIGH]: IncidentPriority.P1,
    [IncidentUrgency.MEDIUM]: IncidentPriority.P2,
    [IncidentUrgency.LOW]: IncidentPriority.P3,
  },
  [IncidentImpact.MEDIUM]: {
    [IncidentUrgency.HIGH]: IncidentPriority.P2,
    [IncidentUrgency.MEDIUM]: IncidentPriority.P3,
    [IncidentUrgency.LOW]: IncidentPriority.P4,
  },
  [IncidentImpact.LOW]: {
    [IncidentUrgency.HIGH]: IncidentPriority.P3,
    [IncidentUrgency.MEDIUM]: IncidentPriority.P4,
    [IncidentUrgency.LOW]: IncidentPriority.P4,
  },
};

export interface PriorityMatrixRow {
  impact: string;
  urgency: string;
  priority: string;
  label: string | null;
}

@Injectable()
export class PriorityMatrixService {
  constructor(
    @InjectRepository(PriorityMatrixEntry)
    private readonly repo: Repository<PriorityMatrixEntry>,
  ) {}

  /**
   * Get the full priority matrix for a tenant.
   * Returns tenant-specific overrides if they exist, otherwise defaults.
   */
  async getMatrix(tenantId: string): Promise<PriorityMatrixRow[]> {
    const entries = await this.repo.find({
      where: { tenantId, isDeleted: false },
      order: { impact: 'ASC', urgency: 'ASC' },
    });

    if (entries.length > 0) {
      return entries.map((e) => ({
        impact: e.impact,
        urgency: e.urgency,
        priority: e.priority,
        label: e.label,
      }));
    }

    // Return default matrix if no tenant-specific entries exist
    return this.getDefaultMatrix();
  }

  /**
   * Compute priority from impact × urgency using tenant-specific matrix.
   * Falls back to hardcoded ITIL default if no tenant matrix exists.
   *
   * This is the single source of truth for priority computation.
   */
  async computePriority(
    tenantId: string,
    impact: string,
    urgency: string,
  ): Promise<string> {
    // Try tenant-specific matrix first
    const entry = await this.repo.findOne({
      where: { tenantId, impact, urgency, isDeleted: false },
    });

    if (entry) {
      return entry.priority;
    }

    // Fallback to hardcoded default
    return DEFAULT_MATRIX[impact]?.[urgency] ?? IncidentPriority.P3;
  }

  /**
   * Upsert the entire priority matrix for a tenant.
   * Replaces all existing entries with the new matrix.
   */
  async upsertMatrix(
    tenantId: string,
    userId: string,
    rows: Array<{
      impact: string;
      urgency: string;
      priority: string;
      label?: string;
    }>,
  ): Promise<PriorityMatrixRow[]> {
    // Soft-delete existing entries
    await this.repo
      .createQueryBuilder()
      .update(PriorityMatrixEntry)
      .set({ isDeleted: true, updatedBy: userId })
      .where('tenantId = :tenantId', { tenantId })
      .andWhere('isDeleted = false')
      .execute();

    // Insert new entries
    const entities = rows.map((row) =>
      this.repo.create({
        tenantId,
        impact: row.impact,
        urgency: row.urgency,
        priority: row.priority,
        label: row.label ?? null,
        createdBy: userId,
        isDeleted: false,
      }),
    );

    const saved = await this.repo.save(entities);
    return saved.map((e) => ({
      impact: e.impact,
      urgency: e.urgency,
      priority: e.priority,
      label: e.label,
    }));
  }

  /**
   * Seed default ITIL matrix for a tenant if no entries exist.
   * Idempotent - safe to call multiple times.
   */
  async seedDefaultIfEmpty(tenantId: string, userId: string): Promise<boolean> {
    const count = await this.repo.count({
      where: { tenantId, isDeleted: false },
    });

    if (count > 0) return false;

    const defaults = this.getDefaultMatrix();
    const entities = defaults.map((row) =>
      this.repo.create({
        tenantId,
        impact: row.impact,
        urgency: row.urgency,
        priority: row.priority,
        label: row.label,
        createdBy: userId,
        isDeleted: false,
      }),
    );

    await this.repo.save(entities);
    return true;
  }

  private getDefaultMatrix(): PriorityMatrixRow[] {
    const rows: PriorityMatrixRow[] = [];
    const impacts = [
      IncidentImpact.HIGH,
      IncidentImpact.MEDIUM,
      IncidentImpact.LOW,
    ];
    const urgencies = [
      IncidentUrgency.HIGH,
      IncidentUrgency.MEDIUM,
      IncidentUrgency.LOW,
    ];

    for (const impact of impacts) {
      for (const urgency of urgencies) {
        rows.push({
          impact,
          urgency,
          priority: DEFAULT_MATRIX[impact][urgency],
          label: `${impact} impact × ${urgency} urgency`,
        });
      }
    }
    return rows;
  }
}
