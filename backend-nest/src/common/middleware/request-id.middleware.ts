import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

/**
 * X-Request-Id Middleware
 * Generates or preserves request ID for tracing
 */
@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    // Get existing request ID from header, or generate new one
    const requestId = (req.headers['x-request-id'] as string) || uuidv4();

    // Set in request object for use in controllers/services
    (req as any).requestId = requestId;

    // Add to response headers
    res.setHeader('X-Request-Id', requestId);

    next();
  }
}
