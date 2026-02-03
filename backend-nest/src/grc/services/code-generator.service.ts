import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { TenantSequence } from '../entities/tenant-sequence.entity';

/**
 * Code prefix mapping for each entity type
 */
export enum CodePrefix {
  RISK = 'RISK',
  POLICY = 'POL',
  REQUIREMENT = 'REQ',
  CONTROL = 'CTL',
  STANDARD = 'STD',
  CLAUSE = 'CLA',
  ISSUE = 'FND',
  AUDIT = 'AUD',
  EVIDENCE = 'EVD',
  PROCESS = 'PRC',
  VIOLATION = 'VIO',
  CONTROL_TEST = 'TST',
  TEST_RESULT = 'RES',
  // ITSM Module Prefixes
  ITSM_INCIDENT = 'INC',
  ITSM_CHANGE = 'CHG',
  ITSM_SERVICE = 'SVC',
}

/**
 * CodeGeneratorService
 *
 * Generates unique, tenant-scoped codes for GRC entities.
 * Uses a sequence table to ensure uniqueness and concurrency safety.
 *
 * Code format: PREFIX-NNNNNN (e.g., RISK-000001, FND-000042)
 */
@Injectable()
export class CodeGeneratorService {
  constructor(
    @InjectRepository(TenantSequence)
    private readonly sequenceRepository: Repository<TenantSequence>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Generate a unique code for an entity type within a tenant
   *
   * Uses a transaction with row-level locking to ensure concurrency safety.
   * If the sequence doesn't exist, it creates one atomically.
   *
   * @param tenantId - The tenant ID
   * @param prefix - The code prefix (e.g., RISK, FND, AUD)
   * @returns The generated code (e.g., RISK-000001)
   */
  async generateCode(tenantId: string, prefix: CodePrefix): Promise<string> {
    return this.dataSource.transaction(async (manager) => {
      const sequenceRepo = manager.getRepository(TenantSequence);

      // Try to get and lock the sequence row
      let sequence = await sequenceRepo
        .createQueryBuilder('seq')
        .setLock('pessimistic_write')
        .where('seq.tenantId = :tenantId', { tenantId })
        .andWhere('seq.sequenceKey = :key', { key: prefix })
        .getOne();

      if (!sequence) {
        // Create new sequence - use raw query to handle race condition
        await manager.query(
          `INSERT INTO "tenant_sequences" (tenant_id, sequence_key, next_value)
           VALUES ($1, $2, 1)
           ON CONFLICT (tenant_id, sequence_key) DO NOTHING`,
          [tenantId, prefix],
        );

        // Re-fetch with lock
        sequence = await sequenceRepo
          .createQueryBuilder('seq')
          .setLock('pessimistic_write')
          .where('seq.tenantId = :tenantId', { tenantId })
          .andWhere('seq.sequenceKey = :key', { key: prefix })
          .getOne();

        if (!sequence) {
          throw new Error(
            `Failed to create sequence for tenant ${tenantId} and prefix ${prefix}`,
          );
        }
      }

      const currentValue = Number(sequence.nextValue);
      const code = this.formatCode(prefix, currentValue);

      // Increment the sequence
      await sequenceRepo.update(sequence.id, {
        nextValue: currentValue + 1,
      });

      return code;
    });
  }

  /**
   * Format a code with the given prefix and number
   *
   * @param prefix - The code prefix
   * @param value - The sequence number
   * @returns Formatted code (e.g., RISK-000001)
   */
  formatCode(prefix: CodePrefix | string, value: number): string {
    return `${prefix}-${value.toString().padStart(6, '0')}`;
  }

  /**
   * Get the next value for a sequence without incrementing
   * Useful for preview/display purposes
   *
   * @param tenantId - The tenant ID
   * @param prefix - The code prefix
   * @returns The next value that would be assigned
   */
  async peekNextValue(tenantId: string, prefix: CodePrefix): Promise<number> {
    const sequence = await this.sequenceRepository.findOne({
      where: { tenantId, sequenceKey: prefix },
    });

    return sequence ? Number(sequence.nextValue) : 1;
  }

  /**
   * Get the current sequence status for a tenant
   * Useful for admin/debugging purposes
   *
   * @param tenantId - The tenant ID
   * @returns Map of prefix to next value
   */
  async getSequenceStatus(tenantId: string): Promise<Map<string, number>> {
    const sequences = await this.sequenceRepository.find({
      where: { tenantId },
    });

    const status = new Map<string, number>();
    for (const seq of sequences) {
      status.set(seq.sequenceKey, Number(seq.nextValue));
    }

    return status;
  }
}
