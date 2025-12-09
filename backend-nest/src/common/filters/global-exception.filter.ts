import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { StructuredLoggerService } from '../logger';

/**
 * Standard API Error Response
 *
 * All error responses follow this format for consistency.
 */
export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
    fieldErrors?: Array<{
      field: string;
      message: string;
    }>;
  };
}

/**
 * Global Exception Filter
 *
 * Catches all exceptions and transforms them into a standard API error response format.
 * This ensures consistent error handling across all endpoints.
 *
 * Error Response Format:
 * {
 *   "success": false,
 *   "error": {
 *     "code": "VALIDATION_ERROR",
 *     "message": "Validation failed",
 *     "details": { ... },
 *     "fieldErrors": [{ "field": "email", "message": "Invalid email format" }]
 *   }
 * }
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new StructuredLoggerService();

  constructor() {
    this.logger.setContext('GlobalExceptionFilter');
  }

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status: number;
    let errorCode: string;
    let message: string;
    let details: Record<string, unknown> | undefined;
    let fieldErrors: Array<{ field: string; message: string }> | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      // Handle validation errors (class-validator)
      if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const responseObj = exceptionResponse as Record<string, unknown>;

        // Extract message
        if (typeof responseObj.message === 'string') {
          message = responseObj.message;
        } else if (Array.isArray(responseObj.message)) {
          // Validation errors from class-validator
          message = 'Validation failed';
          fieldErrors = this.extractFieldErrors(responseObj.message);
        } else {
          message = exception.message;
        }

        // Extract error code
        errorCode = this.getErrorCode(status, responseObj.error as string);

        // Include additional details if present
        if (responseObj.details) {
          details = responseObj.details as Record<string, unknown>;
        }
      } else {
        message =
          typeof exceptionResponse === 'string'
            ? exceptionResponse
            : exception.message;
        errorCode = this.getErrorCode(status);
      }
    } else if (exception instanceof Error) {
      // Unexpected errors
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      errorCode = 'INTERNAL_SERVER_ERROR';
      message = 'An unexpected error occurred';

      // Log the actual error for debugging
      this.logger.error(`Unexpected error: ${exception.message}`, {
        path: request.url,
        method: request.method,
        error: exception,
      });
    } else {
      // Unknown error type
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      errorCode = 'INTERNAL_SERVER_ERROR';
      message = 'An unexpected error occurred';

      this.logger.error('Unknown error type', {
        path: request.url,
        method: request.method,
        exception: String(exception),
      });
    }

    const errorResponse: ApiErrorResponse = {
      success: false,
      error: {
        code: errorCode,
        message,
        ...(details && { details }),
        ...(fieldErrors && { fieldErrors }),
      },
    };

    // Log error for monitoring
    if (status >= 500) {
      this.logger.error(
        `${request.method} ${request.url} - ${status} - ${message}`,
        {
          errorCode,
          correlationId: request.headers['x-correlation-id'],
        },
      );
    } else {
      this.logger.warn(
        `${request.method} ${request.url} - ${status} - ${message}`,
        {
          errorCode,
          correlationId: request.headers['x-correlation-id'],
        },
      );
    }

    response.status(status).json(errorResponse);
  }

  /**
   * Extract field errors from class-validator messages
   */
  private extractFieldErrors(
    messages: unknown[],
  ): Array<{ field: string; message: string }> {
    return messages.map((msg) => {
      if (typeof msg === 'string') {
        // Try to extract field name from message
        const match = msg.match(/^(\w+)\s/);
        return {
          field: match ? match[1] : 'unknown',
          message: msg,
        };
      }
      return {
        field: 'unknown',
        message: String(msg),
      };
    });
  }

  /**
   * Map HTTP status codes to error codes
   */
  private getErrorCode(status: number, error?: string): string {
    if (error) {
      return error.toUpperCase().replace(/\s+/g, '_');
    }

    const statusCodeMap: Record<number, string> = {
      [HttpStatus.BAD_REQUEST]: 'BAD_REQUEST',
      [HttpStatus.UNAUTHORIZED]: 'UNAUTHORIZED',
      [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
      [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
      [HttpStatus.CONFLICT]: 'CONFLICT',
      [HttpStatus.UNPROCESSABLE_ENTITY]: 'VALIDATION_ERROR',
      [HttpStatus.TOO_MANY_REQUESTS]: 'TOO_MANY_REQUESTS',
      [HttpStatus.INTERNAL_SERVER_ERROR]: 'INTERNAL_SERVER_ERROR',
      [HttpStatus.SERVICE_UNAVAILABLE]: 'SERVICE_UNAVAILABLE',
    };

    return statusCodeMap[status] || 'ERROR';
  }
}
