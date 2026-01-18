import { SetMetadata } from '@nestjs/common';

/**
 * Metadata key for public routes
 */
export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Public Decorator
 *
 * Use this decorator to mark a route as public, bypassing JWT authentication.
 * Must be used in conjunction with JwtAuthGuard which checks for this metadata.
 *
 * @example
 * ```typescript
 * @Public()
 * @Post('frontend-error')
 * reportError() { ... }
 * ```
 *
 * Security note: Only use this for endpoints that genuinely need to be
 * accessible without authentication (e.g., telemetry endpoints that may
 * receive errors before the user is logged in).
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
