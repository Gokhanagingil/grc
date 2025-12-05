import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { StructuredLoggerService } from '../logger/structured-logger.service';

/**
 * Header name for correlation ID
 */
export const CORRELATION_ID_HEADER = 'x-correlation-id';

/**
 * Extend Express Request to include correlation context
 */
declare global {
  namespace Express {
    interface Request {
      correlationId?: string;
      tenantId?: string;
      userId?: string;
      requestStartTime?: number;
    }
  }
}

/**
 * Correlation ID Middleware
 *
 * Generates or extracts a correlation ID for each request and:
 * 1. Attaches it to the request object
 * 2. Sets it in the response header
 * 3. Sets it in the global logger context
 *
 * This enables request tracing across all services and logs.
 */
@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    // Get correlation ID from header or generate a new one
    const correlationId = (req.headers[CORRELATION_ID_HEADER] as string) || uuidv4();
    
    // Record request start time
    const requestStartTime = Date.now();

    // Attach to request object
    req.correlationId = correlationId;
    req.requestStartTime = requestStartTime;

    // Set response header
    res.setHeader(CORRELATION_ID_HEADER, correlationId);

    // Extract tenant ID from header (if present)
    const tenantId = req.headers['x-tenant-id'] as string | undefined;
    if (tenantId) {
      req.tenantId = tenantId;
    }

    // Extract user ID from JWT (if authenticated)
    // This will be populated by the auth guard later
    const user = (req as any).user;
    if (user?.id) {
      req.userId = user.id;
    }

    // Set global logger context for this request
    StructuredLoggerService.setRequestContext({
      correlationId,
      tenantId,
      userId: req.userId,
      path: req.path,
      method: req.method,
    });

    // Clear context when response finishes
    res.on('finish', () => {
      StructuredLoggerService.clearRequestContext();
    });

    next();
  }
}
