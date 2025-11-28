/**
 * NormalizationPipe Test Suite
 * 
 * Tests for the global normalization pipe that transforms incoming request data.
 * 
 * This test suite verifies:
 * - Empty string → undefined conversion
 * - UUID normalization (empty → undefined, invalid → error)
 * - Array normalization (comma-separated string → array)
 * - Boolean normalization (string "true"/"1" → boolean)
 * - Date normalization (various formats → ISO string)
 * - Deep normalization for nested objects
 */

import { NormalizationPipe } from './normalization.pipe';
import {
  normalizeEmpty,
  normalizeUUID,
  normalizeArray,
  normalizeBoolean,
  normalizeDate,
  looksLikeUUID,
} from './normalization.utils';
import { BadRequestException } from '@nestjs/common';

describe('NormalizationPipe', () => {
  let pipe: NormalizationPipe;

  beforeEach(() => {
    pipe = new NormalizationPipe();
  });

  describe('normalizeEmpty', () => {
    it('should convert empty string to undefined', () => {
      expect(normalizeEmpty('')).toBeUndefined();
      expect(normalizeEmpty('   ')).toBeUndefined();
      expect(normalizeEmpty(null)).toBeUndefined();
    });

    it('should preserve non-empty values', () => {
      expect(normalizeEmpty('test')).toBe('test');
      expect(normalizeEmpty(123)).toBe(123);
      expect(normalizeEmpty(true)).toBe(true);
    });
  });

  describe('normalizeUUID', () => {
    it('should convert empty string to undefined', () => {
      expect(normalizeUUID('')).toBeUndefined();
      expect(normalizeUUID(null)).toBeUndefined();
    });

    it('should accept valid UUID', () => {
      const uuid = '217492b2-f814-4ba0-ae50-4e4f8ecf6216';
      expect(normalizeUUID(uuid)).toBe(uuid);
    });

    it('should throw BadRequestException for invalid UUID', () => {
      expect(() => normalizeUUID('not-a-uuid', 'testField')).toThrow(
        BadRequestException,
      );
      expect(() => normalizeUUID('123', 'testField')).toThrow(
        BadRequestException,
      );
    });
  });

  describe('normalizeArray', () => {
    it('should convert empty string to undefined', () => {
      expect(normalizeArray('')).toBeUndefined();
      expect(normalizeArray(null)).toBeUndefined();
    });

    it('should accept array as-is', () => {
      const arr = ['a', 'b', 'c'];
      expect(normalizeArray(arr)).toEqual(arr);
    });

    it('should convert comma-separated string to array', () => {
      expect(normalizeArray('a,b,c')).toEqual(['a', 'b', 'c']);
      expect(normalizeArray('a, b, c')).toEqual(['a', 'b', 'c']);
      expect(normalizeArray('  a  ,  b  ,  c  ')).toEqual(['a', 'b', 'c']);
    });

    it('should filter out empty values', () => {
      expect(normalizeArray('a,,b')).toEqual(['a', 'b']);
      expect(normalizeArray('a, ,b')).toEqual(['a', 'b']);
    });

    it('should convert single value to array', () => {
      expect(normalizeArray('single')).toEqual(['single']);
    });
  });

  describe('normalizeBoolean', () => {
    it('should convert empty string to undefined', () => {
      expect(normalizeBoolean('')).toBeUndefined();
      expect(normalizeBoolean(null)).toBeUndefined();
    });

    it('should accept boolean as-is', () => {
      expect(normalizeBoolean(true)).toBe(true);
      expect(normalizeBoolean(false)).toBe(false);
    });

    it('should convert string "true"/"1" to true', () => {
      expect(normalizeBoolean('true')).toBe(true);
      expect(normalizeBoolean('1')).toBe(true);
      expect(normalizeBoolean('yes')).toBe(true);
      expect(normalizeBoolean('on')).toBe(true);
      expect(normalizeBoolean('TRUE')).toBe(true);
    });

    it('should convert string "false"/"0" to false', () => {
      expect(normalizeBoolean('false')).toBe(false);
      expect(normalizeBoolean('0')).toBe(false);
      expect(normalizeBoolean('no')).toBe(false);
      expect(normalizeBoolean('off')).toBe(false);
      expect(normalizeBoolean('FALSE')).toBe(false);
    });

    it('should convert number 1 to true, 0 to false', () => {
      expect(normalizeBoolean(1)).toBe(true);
      expect(normalizeBoolean(0)).toBe(false);
      expect(normalizeBoolean(42)).toBe(true);
    });

    it('should return undefined for invalid boolean strings', () => {
      expect(normalizeBoolean('maybe')).toBeUndefined();
      expect(normalizeBoolean('invalid')).toBeUndefined();
    });
  });

  describe('normalizeDate', () => {
    it('should convert empty string to undefined', () => {
      expect(normalizeDate('')).toBeUndefined();
      expect(normalizeDate(null)).toBeUndefined();
    });

    it('should accept Date object', () => {
      const date = new Date('2024-01-01');
      const result = normalizeDate(date);
      expect(result).toBe(date.toISOString());
    });

    it('should accept ISO string', () => {
      const iso = '2024-01-01T00:00:00.000Z';
      const result = normalizeDate(iso);
      expect(result).toBe(new Date(iso).toISOString());
    });

    it('should accept YYYY-MM-DD format', () => {
      const result = normalizeDate('2024-01-01');
      expect(result).toBe(new Date('2024-01-01').toISOString());
    });

    it('should accept MM/DD/YYYY format', () => {
      const result = normalizeDate('01/01/2024');
      expect(result).toBe(new Date('2024-01-01').toISOString());
    });

    it('should accept timestamp number', () => {
      const timestamp = new Date('2024-01-01').getTime();
      const result = normalizeDate(timestamp);
      expect(result).toBe(new Date(timestamp).toISOString());
    });

    it('should throw BadRequestException for invalid date', () => {
      expect(() => normalizeDate('invalid-date', 'testField')).toThrow(
        BadRequestException,
      );
      expect(() => normalizeDate('13/45/2024', 'testField')).toThrow(
        BadRequestException,
      );
    });
  });

  describe('looksLikeUUID', () => {
    it('should return true for valid UUID format', () => {
      expect(looksLikeUUID('217492b2-f814-4ba0-ae50-4e4f8ecf6216')).toBe(true);
      expect(looksLikeUUID('00000000-0000-0000-0000-000000000000')).toBe(true);
    });

    it('should return false for invalid formats', () => {
      expect(looksLikeUUID('not-a-uuid')).toBe(false);
      expect(looksLikeUUID('123')).toBe(false);
      expect(looksLikeUUID('')).toBe(false);
    });
  });

  describe('NormalizationPipe integration', () => {
    class TestDto {
      id?: string;
      name!: string;
      email?: string;
      isActive?: boolean;
      tags?: string[];
      createdAt?: string;
    }

    it('should normalize empty strings to undefined', () => {
      const input = {
        id: '',
        name: 'Test',
        email: '   ',
      };
      const result = pipe.transform(input, {
        type: 'body',
        metatype: TestDto,
        data: '',
      } as any);
      expect(result.id).toBeUndefined();
      expect(result.name).toBe('Test');
      expect(result.email).toBeUndefined();
    });

    it('should normalize UUID fields', () => {
      const input = {
        id: '217492b2-f814-4ba0-ae50-4e4f8ecf6216',
        name: 'Test',
      };
      const result = pipe.transform(input, {
        type: 'body',
        metatype: TestDto,
        data: '',
      } as any);
      expect(result.id).toBe('217492b2-f814-4ba0-ae50-4e4f8ecf6216');
    });

    it('should normalize boolean fields', () => {
      const input = {
        name: 'Test',
        isActive: 'true',
      };
      const result = pipe.transform(input, {
        type: 'body',
        metatype: TestDto,
        data: '',
      } as any);
      expect(result.isActive).toBe(true);
    });

    it('should normalize array fields (comma-separated)', () => {
      const input = {
        name: 'Test',
        tags: 'tag1,tag2,tag3',
      };
      const result = pipe.transform(input, {
        type: 'body',
        metatype: TestDto,
        data: '',
      } as any);
      expect(result.tags).toEqual(['tag1', 'tag2', 'tag3']);
    });

    it('should normalize nested objects', () => {
      class NestedDto {
        user?: {
          id?: string;
          name?: string;
        };
      }

      const input = {
        user: {
          id: '',
          name: 'John',
        },
      };
      const result = pipe.transform(input, {
        type: 'body',
        metatype: NestedDto,
        data: '',
      } as any);
      expect(result.user.id).toBeUndefined();
      expect(result.user.name).toBe('John');
    });

    it('should normalize comma-separated string to array', () => {
      class TestDto {
        tags?: string[];
      }

      const input = {
        tags: 'tag1,tag2,tag3',
      };
      const result = pipe.transform(input, {
        type: 'body',
        metatype: TestDto,
        data: '',
      } as any);
      expect(result.tags).toEqual(['tag1', 'tag2', 'tag3']);
    });

    it('should normalize UUID fields with empty string', () => {
      class TestDto {
        user_id?: string;
        process_id?: string;
      }

      const input = {
        user_id: '',
        process_id: '217492b2-f814-4ba0-ae50-4e4f8ecf6216',
      };
      const result = pipe.transform(input, {
        type: 'body',
        metatype: TestDto,
        data: '',
      } as any);
      expect(result.user_id).toBeUndefined();
      expect(result.process_id).toBe('217492b2-f814-4ba0-ae50-4e4f8ecf6216');
    });

    it('should normalize date fields with various formats', () => {
      class TestDto {
        due_date?: string;
        created_at?: string;
      }

      const input1 = {
        due_date: '2024-01-01',
      };
      const result1 = pipe.transform(input1, {
        type: 'body',
        metatype: TestDto,
        data: '',
      } as any);
      expect(result1.due_date).toMatch(/^2024-01-01T/);

      const input2 = {
        due_date: '01/01/2024',
      };
      const result2 = pipe.transform(input2, {
        type: 'body',
        metatype: TestDto,
        data: '',
      } as any);
      expect(result2.due_date).toMatch(/^2024-01-01T/);
    });

    it('should normalize boolean fields with string values', () => {
      class TestDto {
        is_active?: boolean;
        has_permission?: boolean;
      }

      const input = {
        is_active: 'true',
        has_permission: '1',
      };
      const result = pipe.transform(input, {
        type: 'body',
        metatype: TestDto,
        data: '',
      } as any);
      expect(result.is_active).toBe(true);
      expect(result.has_permission).toBe(true);
    });

    it('should handle complex nested objects with arrays', () => {
      class StepDto {
        step?: number;
        title?: string;
        owner?: string;
      }

      class TestDto {
        steps?: StepDto[];
      }

      const input = {
        steps: [
          {
            step: 1,
            title: 'Step 1',
            owner: '',
          },
          {
            step: 2,
            title: 'Step 2',
            owner: 'user-id',
          },
        ],
      };
      const result = pipe.transform(input, {
        type: 'body',
        metatype: TestDto,
        data: '',
      } as any);
      expect(result.steps[0].owner).toBeUndefined();
      expect(result.steps[1].owner).toBe('user-id');
    });
  });
});

