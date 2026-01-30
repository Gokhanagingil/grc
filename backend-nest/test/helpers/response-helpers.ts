/**
 * Test Response Helpers
 *
 * Shared utilities for handling API responses in E2E tests.
 * These helpers standardize how tests unwrap API responses regardless
 * of whether the ResponseTransformInterceptor envelope is enabled.
 *
 * Usage:
 * - Set DISABLE_RESPONSE_ENVELOPE=true in test environment to disable envelope
 * - Use these helpers to unwrap responses consistently
 *
 * @see app.module.ts for envelope configuration
 * @see LIST-CONTRACT.md for list endpoint response format
 */

/**
 * API Success Response envelope format
 */
export interface ApiEnvelope<T> {
  success: boolean;
  data: T;
}

/**
 * LIST-CONTRACT response format for paginated endpoints
 */
export interface ListContract<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * Unwraps an API response that may or may not be wrapped in an envelope.
 * Handles both { success: true, data: T } and raw T formats.
 *
 * @param response - The response object from supertest
 * @returns The unwrapped data
 *
 * @example
 * const response = await request(app.getHttpServer()).get('/grc/controls');
 * const data = unwrapEnvelope(response);
 */
export function unwrapEnvelope<T>(response: { body: unknown }): T {
  const body = response.body as Record<string, unknown>;

  // Check if response is wrapped in envelope format
  if (
    body &&
    typeof body === 'object' &&
    'success' in body &&
    body.success === true &&
    'data' in body
  ) {
    return body.data as T;
  }

  // Return raw body if not wrapped
  return body as T;
}

/**
 * Unwraps an API response and extracts LIST-CONTRACT data.
 * Handles both envelope-wrapped and raw LIST-CONTRACT formats.
 *
 * @param response - The response object from supertest
 * @returns The LIST-CONTRACT data with items, total, page, pageSize, totalPages
 *
 * @example
 * const response = await request(app.getHttpServer()).get('/grc/controls');
 * const { items, total, page, pageSize, totalPages } = unwrapListContract(response);
 */
export function unwrapListContract<T>(response: {
  body: unknown;
}): ListContract<T> {
  const data = unwrapEnvelope<ListContract<T> | T[]>(response);

  // If data is already in LIST-CONTRACT format
  if (
    data &&
    typeof data === 'object' &&
    !Array.isArray(data) &&
    'items' in data
  ) {
    return data;
  }

  // If data is a raw array (legacy format), wrap it in LIST-CONTRACT
  if (Array.isArray(data)) {
    return {
      items: data,
      total: data.length,
      page: 1,
      pageSize: data.length,
      totalPages: 1,
    };
  }

  // Return as-is if it's already the expected shape
  return data as ListContract<T>;
}

/**
 * Asserts that a response conforms to the LIST-CONTRACT specification.
 * Throws an error with a descriptive message if validation fails.
 *
 * LIST-CONTRACT format:
 * {
 *   "success": true,
 *   "data": {
 *     "items": [...],
 *     "total": number,
 *     "page": number,
 *     "pageSize": number,
 *     "totalPages": number
 *   }
 * }
 *
 * When DISABLE_RESPONSE_ENVELOPE=true, the format is:
 * {
 *   "items": [...],
 *   "total": number,
 *   "page": number,
 *   "pageSize": number,
 *   "totalPages": number
 * }
 *
 * @param response - The response object from supertest
 * @param options - Optional configuration
 * @param options.expectItems - If true, asserts that items array is not empty when total > 0
 * @param options.allowEnvelope - If true, allows envelope format (default: true)
 *
 * @example
 * const response = await request(app.getHttpServer()).get('/grc/controls');
 * assertListContract(response);
 */
export function assertListContract(
  response: { body: unknown },
  options?: { expectItems?: boolean; allowEnvelope?: boolean },
): void {
  const body = response.body as Record<string, unknown>;
  const allowEnvelope = options?.allowEnvelope !== false;

  if (typeof body !== 'object' || body === null) {
    throw new Error('LIST-CONTRACT: Response body must be an object');
  }

  let data: Record<string, unknown>;

  // Check if response is wrapped in envelope
  if ('success' in body && 'data' in body) {
    if (!allowEnvelope) {
      throw new Error(
        'LIST-CONTRACT: Response should not be wrapped in envelope when DISABLE_RESPONSE_ENVELOPE=true',
      );
    }
    if (body.success !== true) {
      throw new Error('LIST-CONTRACT: Response must have success: true');
    }
    if (typeof body.data !== 'object' || body.data === null) {
      throw new Error('LIST-CONTRACT: Response must have data object');
    }
    if (Array.isArray(body.data)) {
      throw new Error(
        'LIST-CONTRACT: data must be an object with items array, not a raw array (old format)',
      );
    }
    data = body.data as Record<string, unknown>;
  } else {
    // Raw LIST-CONTRACT format (no envelope)
    data = body;
  }

  // Validate LIST-CONTRACT fields
  if (!Array.isArray(data.items)) {
    throw new Error('LIST-CONTRACT: items must be an array');
  }
  if (typeof data.total !== 'number') {
    throw new Error('LIST-CONTRACT: total must be a number');
  }
  if (typeof data.page !== 'number') {
    throw new Error('LIST-CONTRACT: page must be a number');
  }
  if (typeof data.pageSize !== 'number') {
    throw new Error('LIST-CONTRACT: pageSize must be a number');
  }
  if (typeof data.totalPages !== 'number') {
    throw new Error('LIST-CONTRACT: totalPages must be a number');
  }

  // Check for forbidden fields
  if ('meta' in body) {
    throw new Error('LIST-CONTRACT: Response must not have meta field');
  }

  // Optional: check that items are present when expected
  if (options?.expectItems && data.items.length === 0 && data.total > 0) {
    throw new Error(
      'LIST-CONTRACT: Expected items but got empty array while total > 0',
    );
  }
}

/**
 * Creates a valid BCM Service payload for testing.
 * Includes all required fields to avoid 400 Bad Request errors.
 *
 * @param overrides - Optional field overrides
 * @returns A valid CreateBcmServiceDto payload
 */
export function createBcmServicePayload(
  overrides?: Partial<{
    name: string;
    description: string;
    criticalityTier: string;
    status: string;
  }>,
): {
  name: string;
  description: string;
  criticalityTier: string;
  status: string;
} {
  return {
    name: overrides?.name ?? `Test BCM Service - ${Date.now()}`,
    description: overrides?.description ?? 'Test service for E2E testing',
    criticalityTier: overrides?.criticalityTier ?? 'TIER_2',
    status: overrides?.status ?? 'ACTIVE',
  };
}

/**
 * Creates a valid BCM Exercise payload for testing.
 * Includes all required fields to avoid 400 Bad Request errors.
 *
 * @param serviceId - The ID of the BCM service to link the exercise to
 * @param overrides - Optional field overrides
 * @returns A valid CreateBcmExerciseDto payload
 */
export function createBcmExercisePayload(
  serviceId: string,
  overrides?: Partial<{
    name: string;
    exerciseType: string;
    status: string;
    scheduledAt: string;
  }>,
): {
  name: string;
  serviceId: string;
  exerciseType: string;
  status: string;
  scheduledAt: string;
} {
  return {
    name: overrides?.name ?? `Test BCM Exercise - ${Date.now()}`,
    serviceId,
    exerciseType: overrides?.exerciseType ?? 'TABLETOP',
    status: overrides?.status ?? 'PLANNED',
    scheduledAt: overrides?.scheduledAt ?? new Date().toISOString(),
  };
}
