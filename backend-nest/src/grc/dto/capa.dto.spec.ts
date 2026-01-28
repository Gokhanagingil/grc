/**
 * CAPA DTO Transform Tests
 *
 * Tests the case-insensitive enum normalization for CAPA DTOs.
 * The transform converts lowercase/mixed case enum values to uppercase
 * to match PostgreSQL enum values (e.g., "high" -> "HIGH").
 */

import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  CreateCapaDto,
  UpdateCapaDto,
  CapaFilterDto,
  CreateCapaFromSoaItemDto,
} from './capa.dto';
import { CAPAPriority, SourceType } from '../enums';

describe('CAPA DTO Transforms', () => {
  describe('CreateCapaDto', () => {
    describe('priority field normalization', () => {
      it('should transform lowercase "high" to "HIGH"', async () => {
        const dto = plainToInstance(CreateCapaDto, {
          title: 'Test CAPA',
          issueId: '00000000-0000-0000-0000-000000000001',
          priority: 'high',
        });

        expect(dto.priority).toBe('HIGH');
        const errors = await validate(dto);
        const priorityErrors = errors.filter((e) => e.property === 'priority');
        expect(priorityErrors).toHaveLength(0);
      });

      it('should transform mixed case "High" to "HIGH"', async () => {
        const dto = plainToInstance(CreateCapaDto, {
          title: 'Test CAPA',
          issueId: '00000000-0000-0000-0000-000000000001',
          priority: 'High',
        });

        expect(dto.priority).toBe('HIGH');
        const errors = await validate(dto);
        const priorityErrors = errors.filter((e) => e.property === 'priority');
        expect(priorityErrors).toHaveLength(0);
      });

      it('should keep uppercase "HIGH" as "HIGH"', async () => {
        const dto = plainToInstance(CreateCapaDto, {
          title: 'Test CAPA',
          issueId: '00000000-0000-0000-0000-000000000001',
          priority: 'HIGH',
        });

        expect(dto.priority).toBe('HIGH');
        const errors = await validate(dto);
        const priorityErrors = errors.filter((e) => e.property === 'priority');
        expect(priorityErrors).toHaveLength(0);
      });

      it('should transform all valid priority values', async () => {
        const testCases = [
          { input: 'low', expected: CAPAPriority.LOW },
          { input: 'medium', expected: CAPAPriority.MEDIUM },
          { input: 'high', expected: CAPAPriority.HIGH },
          { input: 'critical', expected: CAPAPriority.CRITICAL },
          { input: 'LOW', expected: CAPAPriority.LOW },
          { input: 'MEDIUM', expected: CAPAPriority.MEDIUM },
          { input: 'HIGH', expected: CAPAPriority.HIGH },
          { input: 'CRITICAL', expected: CAPAPriority.CRITICAL },
        ];

        for (const { input, expected } of testCases) {
          const dto = plainToInstance(CreateCapaDto, {
            title: 'Test CAPA',
            issueId: '00000000-0000-0000-0000-000000000001',
            priority: input,
          });

          expect(dto.priority).toBe(expected);
          const errors = await validate(dto);
          const priorityErrors = errors.filter(
            (e) => e.property === 'priority',
          );
          expect(priorityErrors).toHaveLength(0);
        }
      });

      it('should reject invalid priority values after normalization', async () => {
        const dto = plainToInstance(CreateCapaDto, {
          title: 'Test CAPA',
          issueId: '00000000-0000-0000-0000-000000000001',
          priority: 'urgent',
        });

        expect(dto.priority).toBe('URGENT');
        const errors = await validate(dto);
        const priorityErrors = errors.filter((e) => e.property === 'priority');
        expect(priorityErrors.length).toBeGreaterThan(0);
      });

      it('should trim whitespace before transforming', async () => {
        const dto = plainToInstance(CreateCapaDto, {
          title: 'Test CAPA',
          issueId: '00000000-0000-0000-0000-000000000001',
          priority: '  high  ',
        });

        expect(dto.priority).toBe('HIGH');
        const errors = await validate(dto);
        const priorityErrors = errors.filter((e) => e.property === 'priority');
        expect(priorityErrors).toHaveLength(0);
      });
    });

    describe('sourceType field normalization', () => {
      it('should transform lowercase "soa_item" to "SOA_ITEM"', () => {
        const dto = plainToInstance(CreateCapaDto, {
          title: 'Test CAPA',
          issueId: '00000000-0000-0000-0000-000000000001',
          sourceType: 'soa_item',
        });

        expect(dto.sourceType).toBe(SourceType.SOA_ITEM);
      });
    });
  });

  describe('UpdateCapaDto', () => {
    it('should transform lowercase priority to uppercase', async () => {
      const dto = plainToInstance(UpdateCapaDto, {
        priority: 'medium',
      });

      expect(dto.priority).toBe('MEDIUM');
      const errors = await validate(dto);
      const priorityErrors = errors.filter((e) => e.property === 'priority');
      expect(priorityErrors).toHaveLength(0);
    });
  });

  describe('CapaFilterDto', () => {
    it('should transform lowercase priority filter to uppercase', async () => {
      const dto = plainToInstance(CapaFilterDto, {
        priority: 'critical',
      });

      expect(dto.priority).toBe('CRITICAL');
      const errors = await validate(dto);
      const priorityErrors = errors.filter((e) => e.property === 'priority');
      expect(priorityErrors).toHaveLength(0);
    });
  });

  describe('CreateCapaFromSoaItemDto', () => {
    it('should transform lowercase priority to uppercase', async () => {
      const dto = plainToInstance(CreateCapaFromSoaItemDto, {
        title: 'Test CAPA from SOA',
        priority: 'low',
      });

      expect(dto.priority).toBe('LOW');
      const errors = await validate(dto);
      const priorityErrors = errors.filter((e) => e.property === 'priority');
      expect(priorityErrors).toHaveLength(0);
    });
  });
});
