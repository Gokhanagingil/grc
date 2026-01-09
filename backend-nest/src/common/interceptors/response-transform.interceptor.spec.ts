/**
 * Response Transform Interceptor Unit Tests
 *
 * Tests for the response transformation interceptor to ensure
 * paginated responses follow the LIST-CONTRACT specification.
 *
 * LIST-CONTRACT Response Shape:
 * {
 *   success: true,
 *   data: {
 *     items: [...],
 *     total: number,
 *     page: number,
 *     pageSize: number,
 *     totalPages: number
 *   }
 * }
 */

import { ExecutionContext, CallHandler } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { of } from 'rxjs';
import {
  ResponseTransformInterceptor,
  PaginatedServiceResponse,
  ApiSuccessResponse,
} from './response-transform.interceptor';

describe('ResponseTransformInterceptor', () => {
  let interceptor: ResponseTransformInterceptor<unknown>;
  let reflector: Reflector;
  let mockExecutionContext: ExecutionContext;
  let mockCallHandler: CallHandler;

  beforeEach(() => {
    reflector = new Reflector();
    interceptor = new ResponseTransformInterceptor(reflector);

    mockExecutionContext = {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: jest.fn(),
    } as unknown as ExecutionContext;
  });

  describe('Paginated Response Transformation (LIST-CONTRACT)', () => {
    it('should transform paginated response to LIST-CONTRACT format', (done) => {
      const paginatedData: PaginatedServiceResponse<{
        id: string;
        name: string;
      }> = {
        items: [
          { id: '1', name: 'Control 1' },
          { id: '2', name: 'Control 2' },
        ],
        total: 10,
        page: 1,
        pageSize: 20,
        totalPages: 1,
      };

      mockCallHandler = {
        handle: () => of(paginatedData),
      };

      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        next: (result) => {
          // Verify LIST-CONTRACT compliance
          expect(result.success).toBe(true);
          expect(result.data).toBeDefined();

          // data should contain the full paginated object
          const data = result.data as PaginatedServiceResponse<{
            id: string;
            name: string;
          }>;
          expect(data.items).toBeDefined();
          expect(Array.isArray(data.items)).toBe(true);
          expect(data.items.length).toBe(2);
          expect(data.total).toBe(10);
          expect(data.page).toBe(1);
          expect(data.pageSize).toBe(20);
          expect(data.totalPages).toBe(1);

          // meta should NOT be present (LIST-CONTRACT does not use meta)
          expect(
            (result as ApiSuccessResponse<unknown> & { meta?: unknown }).meta,
          ).toBeUndefined();
        },
        complete: () => done(),
      });
    });

    it('should keep items array inside data object (not at data level)', (done) => {
      const paginatedData: PaginatedServiceResponse<{ id: string }> = {
        items: [{ id: '1' }, { id: '2' }, { id: '3' }],
        total: 100,
        page: 2,
        pageSize: 3,
        totalPages: 34,
      };

      mockCallHandler = {
        handle: () => of(paginatedData),
      };

      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        next: (result) => {
          // data should NOT be an array directly
          expect(Array.isArray(result.data)).toBe(false);

          // data should be an object with items property
          const data = result.data as PaginatedServiceResponse<{ id: string }>;
          expect(typeof data).toBe('object');
          expect('items' in data).toBe(true);
          expect(Array.isArray(data.items)).toBe(true);
        },
        complete: () => done(),
      });
    });

    it('should preserve all pagination fields in data object', (done) => {
      const paginatedData: PaginatedServiceResponse<{ id: string }> = {
        items: [{ id: '1' }],
        total: 50,
        page: 3,
        pageSize: 10,
        totalPages: 5,
      };

      mockCallHandler = {
        handle: () => of(paginatedData),
      };

      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        next: (result) => {
          const data = result.data as PaginatedServiceResponse<{ id: string }>;

          // All pagination fields must exist in data
          expect(data.total).toBe(50);
          expect(data.page).toBe(3);
          expect(data.pageSize).toBe(10);
          expect(data.totalPages).toBe(5);
        },
        complete: () => done(),
      });
    });

    it('should handle empty items array correctly', (done) => {
      const paginatedData: PaginatedServiceResponse<{ id: string }> = {
        items: [],
        total: 0,
        page: 1,
        pageSize: 20,
        totalPages: 0,
      };

      mockCallHandler = {
        handle: () => of(paginatedData),
      };

      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        next: (result) => {
          expect(result.success).toBe(true);

          const data = result.data as PaginatedServiceResponse<{ id: string }>;
          expect(data.items).toEqual([]);
          expect(data.total).toBe(0);
          expect(data.totalPages).toBe(0);
        },
        complete: () => done(),
      });
    });
  });

  describe('Non-Paginated Response Transformation', () => {
    it('should wrap non-paginated object in success envelope', (done) => {
      const regularData = { id: '1', name: 'Test Control' };

      mockCallHandler = {
        handle: () => of(regularData),
      };

      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        next: (result) => {
          expect(result.success).toBe(true);
          expect(result.data).toEqual(regularData);
        },
        complete: () => done(),
      });
    });

    it('should wrap array response in success envelope (non-paginated)', (done) => {
      const arrayData = [{ id: '1' }, { id: '2' }];

      mockCallHandler = {
        handle: () => of(arrayData),
      };

      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        next: (result) => {
          expect(result.success).toBe(true);
          expect(result.data).toEqual(arrayData);
        },
        complete: () => done(),
      });
    });

    it('should handle null response', (done) => {
      mockCallHandler = {
        handle: () => of(null),
      };

      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        next: (result) => {
          expect(result.success).toBe(true);
          expect(result.data).toBeNull();
        },
        complete: () => done(),
      });
    });

    it('should handle undefined response', (done) => {
      mockCallHandler = {
        handle: () => of(undefined),
      };

      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        next: (result) => {
          expect(result.success).toBe(true);
          expect(result.data).toBeNull();
        },
        complete: () => done(),
      });
    });
  });

  describe('Already Transformed Response', () => {
    it('should not double-wrap already transformed responses', (done) => {
      const alreadyTransformed = {
        success: true,
        data: { id: '1', name: 'Test' },
      };

      mockCallHandler = {
        handle: () => of(alreadyTransformed),
      };

      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        next: (result) => {
          expect(result).toEqual(alreadyTransformed);
          // Should not have nested success/data
          expect(
            (result.data as { success?: boolean }).success,
          ).toBeUndefined();
        },
        complete: () => done(),
      });
    });
  });

  describe('Skip Transform Decorator', () => {
    it('should skip transformation when SKIP_TRANSFORM_KEY is set', (done) => {
      const rawData = { raw: 'data', notWrapped: true };

      mockCallHandler = {
        handle: () => of(rawData),
      };

      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(true);

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        next: (result) => {
          // Should return raw data without transformation
          expect(result).toEqual(rawData);
          expect((result as { success?: boolean }).success).toBeUndefined();
        },
        complete: () => done(),
      });
    });
  });

  describe('LIST-CONTRACT Regression Tests', () => {
    it('should NOT put items array directly in data (old behavior)', (done) => {
      const paginatedData: PaginatedServiceResponse<{ id: string }> = {
        items: [{ id: '1' }],
        total: 1,
        page: 1,
        pageSize: 20,
        totalPages: 1,
      };

      mockCallHandler = {
        handle: () => of(paginatedData),
      };

      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        next: (result) => {
          // OLD BEHAVIOR (should fail): data was the items array
          // NEW BEHAVIOR (should pass): data is the full paginated object
          expect(Array.isArray(result.data)).toBe(false);
          expect(
            (result.data as PaginatedServiceResponse<{ id: string }>).items,
          ).toBeDefined();
        },
        complete: () => done(),
      });
    });

    it('should NOT have meta field for paginated responses (LIST-CONTRACT)', (done) => {
      const paginatedData: PaginatedServiceResponse<{ id: string }> = {
        items: [{ id: '1' }],
        total: 1,
        page: 1,
        pageSize: 20,
        totalPages: 1,
      };

      mockCallHandler = {
        handle: () => of(paginatedData),
      };

      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        next: (result) => {
          // LIST-CONTRACT does not use meta field
          const resultWithMeta = result as ApiSuccessResponse<unknown> & {
            meta?: unknown;
          };
          expect(resultWithMeta.meta).toBeUndefined();
        },
        complete: () => done(),
      });
    });

    it('should match exact LIST-CONTRACT response shape', (done) => {
      const paginatedData: PaginatedServiceResponse<{
        id: string;
        name: string;
      }> = {
        items: [
          {
            id: '550e8400-e29b-41d4-a716-446655440000',
            name: 'Access Control Review',
          },
        ],
        total: 10,
        page: 1,
        pageSize: 20,
        totalPages: 1,
      };

      mockCallHandler = {
        handle: () => of(paginatedData),
      };

      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        next: (result) => {
          // Verify exact shape matches LIST-CONTRACT.md
          const expectedShape = {
            success: true,
            data: {
              items: expect.any(Array),
              total: expect.any(Number),
              page: expect.any(Number),
              pageSize: expect.any(Number),
              totalPages: expect.any(Number),
            },
          };

          expect(result).toMatchObject(expectedShape);

          // Verify no extra fields
          const resultKeys = Object.keys(result);
          expect(resultKeys).toContain('success');
          expect(resultKeys).toContain('data');
          expect(resultKeys).not.toContain('meta');
        },
        complete: () => done(),
      });
    });
  });
});
