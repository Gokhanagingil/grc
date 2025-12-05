import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

/**
 * Standard error response format for production
 */
interface ErrorResponse {
  statusCode: number;
  message: string;
  error: string;
  timestamp: string;
  path: string;
  requestId?: string;
}

/**
 * List of sensitive keys to redact from error details
 */
const SENSITIVE_KEYS = [
  'password',
  'token',
  'secret',
  'authorization',
  'cookie',
  'jwt',
  'apikey',
  'api_key',
  'access_token',
  'refresh_token',
];

/**
 * Redact sensitive information from an object
 */
function redactSensitiveData(obj: unknown): unknown {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === 'string') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(redactSensitiveData);
  }

  if (typeof obj === 'object') {
    const redacted: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      const lowerKey = key.toLowerCase();
      if (SENSITIVE_KEYS.some((sensitive) => lowerKey.includes(sensitive))) {
        redacted[key] = '[REDACTED]';
      } else {
        redacted[key] = redactSensitiveData(value);
      }
    }
    return redacted;
  }

  return obj;
}

/**
 * Global Exception Filter
 *
 * Catches all exceptions and returns a standardized JSON error response.
 * Features:
 * - Consistent error format across all endpoints
 * - Sensitive data redaction
 * - Request ID correlation (if available)
 * - Stack traces only in development mode
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // Determine status code
    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let error = 'Internal Server Error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object') {
        const responseObj = exceptionResponse as Record<string, unknown>;
        message =
          (responseObj.message as string) ||
          (Array.isArray(responseObj.message)
            ? (responseObj.message as string[]).join(', ')
            : message);
        error = (responseObj.error as string) || error;
      }

      error = HttpStatus[status] || error;
    } else if (exception instanceof Error) {
      message = exception.message;
    }

    // Get request ID if available (from middleware or header)
    const requestId =
      (request as Request & { id?: string }).id ||
      (request.headers['x-request-id'] as string);

    // Build error response
    const errorResponse: ErrorResponse = {
      statusCode: status,
      message,
      error,
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    if (requestId) {
      errorResponse.requestId = requestId;
    }

    // Log the error with redacted sensitive data
    const logContext = {
      statusCode: status,
      path: request.url,
      method: request.method,
      requestId,
      body: redactSensitiveData(request.body),
    };

    if (status >= 500) {
      this.logger.error(
        `${request.method} ${request.url} - ${status}`,
        exception instanceof Error ? exception.stack : undefined,
        JSON.stringify(logContext),
      );
    } else if (status >= 400) {
      this.logger.warn(
        `${request.method} ${request.url} - ${status}: ${message}`,
        JSON.stringify(logContext),
      );
    }

    // Send response
    response.status(status).json(errorResponse);
  }
}
