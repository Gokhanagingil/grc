import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Reflector } from '@nestjs/core';

/**
 * Standard API Success Response
 *
 * All successful responses follow this format for consistency.
 */
export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  meta?: {
    total?: number;
    limit?: number;
    offset?: number;
    page?: number;
    pageSize?: number;
    totalPages?: number;
    [key: string]: unknown;
  };
}

/**
 * Paginated Response from services
 *
 * Expected format from service layer pagination methods.
 */
export interface PaginatedServiceResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * Decorator key for skipping response transformation
 */
export const SKIP_TRANSFORM_KEY = 'skipTransform';

/**
 * Response Transform Interceptor
 *
 * Transforms all successful responses into the standard API response envelope.
 * Handles both regular responses and paginated responses.
 *
 * Success Response Format (non-paginated):
 * {
 *   "success": true,
 *   "data": { ... } or [ ... ]
 * }
 *
 * Success Response Format (paginated - LIST-CONTRACT compliant):
 * {
 *   "success": true,
 *   "data": {
 *     "items": [...],
 *     "total": 100,
 *     "page": 1,
 *     "pageSize": 20,
 *     "totalPages": 5
 *   }
 * }
 */
@Injectable()
export class ResponseTransformInterceptor<T> implements NestInterceptor<
  T,
  ApiSuccessResponse<T>
> {
  constructor(private readonly reflector: Reflector) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<ApiSuccessResponse<T>> {
    // Check if transformation should be skipped
    const skipTransform = this.reflector.getAllAndOverride<boolean>(
      SKIP_TRANSFORM_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (skipTransform) {
      return next.handle() as unknown as Observable<ApiSuccessResponse<T>>;
    }

    return next.handle().pipe(
      map((data: T): ApiSuccessResponse<T> => {
        // Handle null/undefined responses
        if (data === null || data === undefined) {
          return {
            success: true as const,
            data: null as unknown as T,
          };
        }

        // Check if response is already in the standard format
        if (this.isAlreadyTransformed(data)) {
          return data as ApiSuccessResponse<T>;
        }

        // Check if response is a paginated response from service
        if (this.isPaginatedResponse(data)) {
          return this.transformPaginatedResponse(
            data as unknown as PaginatedServiceResponse<unknown>,
          ) as unknown as ApiSuccessResponse<T>;
        }

        // Standard transformation
        return {
          success: true as const,
          data,
        };
      }),
    );
  }

  /**
   * Check if response is already in standard format
   */
  private isAlreadyTransformed(data: unknown): data is ApiSuccessResponse<T> {
    return (
      typeof data === 'object' &&
      data !== null &&
      'success' in data &&
      (data as Record<string, unknown>).success === true &&
      'data' in data
    );
  }

  /**
   * Check if response is a paginated response from service
   */
  private isPaginatedResponse(
    data: unknown,
  ): data is PaginatedServiceResponse<unknown> {
    return (
      typeof data === 'object' &&
      data !== null &&
      'items' in data &&
      'total' in data &&
      ('page' in data || 'pageSize' in data || 'totalPages' in data)
    );
  }

  /**
   * Transform paginated response to LIST-CONTRACT compliant format
   *
   * Returns the full paginated object inside data:
   * {
   *   success: true,
   *   data: { items: [...], total, page, pageSize, totalPages }
   * }
   */
  private transformPaginatedResponse(
    data: PaginatedServiceResponse<unknown>,
  ): ApiSuccessResponse<PaginatedServiceResponse<unknown>> {
    return {
      success: true,
      data: data,
    };
  }
}
