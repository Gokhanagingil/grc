/**
 * CAPA Task DTO Transform Tests
 *
 * Tests the case-insensitive enum normalization for CAPA Task DTOs.
 * The transform converts lowercase/mixed case enum values to uppercase
 * to match PostgreSQL enum values (e.g., "pending" -> "PENDING").
 */

import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateCapaTaskStatusDto, CapaTaskFilterDto } from './capa-task.dto';
import { CAPATaskStatus } from '../enums';

describe('CAPA Task DTO Transforms', () => {
  describe('UpdateCapaTaskStatusDto', () => {
    describe('status field normalization', () => {
      it('should transform lowercase "pending" to "PENDING"', async () => {
        const dto = plainToInstance(UpdateCapaTaskStatusDto, {
          status: 'pending',
        });

        expect(dto.status).toBe('PENDING');
        const errors = await validate(dto);
        const statusErrors = errors.filter((e) => e.property === 'status');
        expect(statusErrors).toHaveLength(0);
      });

      it('should transform mixed case "In_Progress" to "IN_PROGRESS"', async () => {
        const dto = plainToInstance(UpdateCapaTaskStatusDto, {
          status: 'In_Progress',
        });

        expect(dto.status).toBe('IN_PROGRESS');
        const errors = await validate(dto);
        const statusErrors = errors.filter((e) => e.property === 'status');
        expect(statusErrors).toHaveLength(0);
      });

      it('should keep uppercase "COMPLETED" as "COMPLETED"', async () => {
        const dto = plainToInstance(UpdateCapaTaskStatusDto, {
          status: 'COMPLETED',
        });

        expect(dto.status).toBe('COMPLETED');
        const errors = await validate(dto);
        const statusErrors = errors.filter((e) => e.property === 'status');
        expect(statusErrors).toHaveLength(0);
      });

      it('should transform all valid status values', async () => {
        const testCases = [
          { input: 'pending', expected: CAPATaskStatus.PENDING },
          { input: 'in_progress', expected: CAPATaskStatus.IN_PROGRESS },
          { input: 'completed', expected: CAPATaskStatus.COMPLETED },
          { input: 'cancelled', expected: CAPATaskStatus.CANCELLED },
          { input: 'PENDING', expected: CAPATaskStatus.PENDING },
          { input: 'IN_PROGRESS', expected: CAPATaskStatus.IN_PROGRESS },
          { input: 'COMPLETED', expected: CAPATaskStatus.COMPLETED },
          { input: 'CANCELLED', expected: CAPATaskStatus.CANCELLED },
        ];

        for (const { input, expected } of testCases) {
          const dto = plainToInstance(UpdateCapaTaskStatusDto, {
            status: input,
          });

          expect(dto.status).toBe(expected);
          const errors = await validate(dto);
          const statusErrors = errors.filter((e) => e.property === 'status');
          expect(statusErrors).toHaveLength(0);
        }
      });

      it('should reject invalid status values after normalization', async () => {
        const dto = plainToInstance(UpdateCapaTaskStatusDto, {
          status: 'invalid_status',
        });

        expect(dto.status).toBe('INVALID_STATUS');
        const errors = await validate(dto);
        const statusErrors = errors.filter((e) => e.property === 'status');
        expect(statusErrors.length).toBeGreaterThan(0);
      });

      it('should trim whitespace before transforming', async () => {
        const dto = plainToInstance(UpdateCapaTaskStatusDto, {
          status: '  pending  ',
        });

        expect(dto.status).toBe('PENDING');
        const errors = await validate(dto);
        const statusErrors = errors.filter((e) => e.property === 'status');
        expect(statusErrors).toHaveLength(0);
      });
    });
  });

  describe('CapaTaskFilterDto', () => {
    it('should transform lowercase status filter to uppercase', async () => {
      const dto = plainToInstance(CapaTaskFilterDto, {
        status: 'in_progress',
      });

      expect(dto.status).toBe('IN_PROGRESS');
      const errors = await validate(dto);
      const statusErrors = errors.filter((e) => e.property === 'status');
      expect(statusErrors).toHaveLength(0);
    });
  });
});
