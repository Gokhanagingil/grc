import { SetMetadata } from '@nestjs/common';

/**
 * Metadata key for performance profiling
 */
export const PERF_METADATA_KEY = 'perf:enabled';

/**
 * @Perf() Decorator
 *
 * Marks a controller method for performance profiling.
 * When applied, the PerformanceInterceptor will log detailed timing information
 * including handler execution time, correlation ID, and path.
 *
 * Usage:
 * ```typescript
 * @Get()
 * @Perf()
 * findAll() {
 *   return this.service.findAll();
 * }
 * ```
 */
export const Perf = () => SetMetadata(PERF_METADATA_KEY, true);
