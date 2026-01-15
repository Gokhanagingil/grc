import { Injectable, LoggerService as NestLoggerService } from '@nestjs/common';

/**
 * Log levels for structured logging
 */
export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  DEBUG = 'debug',
  VERBOSE = 'verbose',
}

/**
 * Structured log entry interface
 */
export interface StructuredLogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  correlationId?: string;
  tenantId?: string;
  userId?: string;
  path?: string;
  method?: string;
  latencyMs?: number;
  statusCode?: number;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
  context?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Log level priority for filtering
 */
const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  [LogLevel.ERROR]: 0,
  [LogLevel.WARN]: 1,
  [LogLevel.INFO]: 2,
  [LogLevel.DEBUG]: 3,
  [LogLevel.VERBOSE]: 4,
};

/**
 * Structured Logger Service
 *
 * Provides JSON-formatted structured logging with automatic context enrichment.
 * Includes correlation ID, tenant ID, user ID, path, and latency in every log entry.
 *
 * Supports LOG_LEVEL environment variable to filter logs:
 * - error: Only errors
 * - warn: Errors and warnings
 * - info: Errors, warnings, and info (default)
 * - debug: All except verbose
 * - verbose: All logs
 *
 * This is a DEFAULT scoped service (singleton) that can be used anywhere.
 * For request-scoped logging with automatic context, use the StructuredLoggerService
 * injected in controllers/services that have access to the request context.
 */
@Injectable()
export class StructuredLoggerService implements NestLoggerService {
  private context?: string;
  private static globalCorrelationId?: string;
  private static globalTenantId?: string;
  private static globalUserId?: string;
  private static globalPath?: string;
  private static globalMethod?: string;
  private static logLevel: LogLevel = LogLevel.INFO;

  constructor() {
    // Initialize log level from environment variable
    const envLogLevel = process.env.LOG_LEVEL?.toLowerCase() as LogLevel;
    if (envLogLevel && Object.values(LogLevel).includes(envLogLevel)) {
      StructuredLoggerService.logLevel = envLogLevel;
    }
  }

  /**
   * Set global context for the current request (used by middleware)
   */
  static setRequestContext(context: {
    correlationId?: string;
    tenantId?: string;
    userId?: string;
    path?: string;
    method?: string;
  }): void {
    this.globalCorrelationId = context.correlationId;
    this.globalTenantId = context.tenantId;
    this.globalUserId = context.userId;
    this.globalPath = context.path;
    this.globalMethod = context.method;
  }

  /**
   * Clear global context after request completes
   */
  static clearRequestContext(): void {
    this.globalCorrelationId = undefined;
    this.globalTenantId = undefined;
    this.globalUserId = undefined;
    this.globalPath = undefined;
    this.globalMethod = undefined;
  }

  /**
   * Set the context (module/class name) for this logger instance
   */
  setContext(context: string): void {
    this.context = context;
  }

  /**
   * Create a child logger with a specific context
   */
  createChildLogger(context: string): StructuredLoggerService {
    const child = new StructuredLoggerService();
    child.setContext(context);
    return child;
  }

  /**
   * Log an error message
   */
  error(message: string, trace?: string, context?: string): void;
  error(message: string, metadata?: Record<string, unknown>): void;
  error(
    message: string,
    traceOrMetadata?: string | Record<string, unknown>,
    context?: string,
  ): void {
    const entry = this.createLogEntry(LogLevel.ERROR, message, context);

    if (typeof traceOrMetadata === 'string') {
      entry.error = {
        name: 'Error',
        message: message,
        stack: traceOrMetadata,
      };
    } else if (traceOrMetadata) {
      entry.metadata = traceOrMetadata;
      if (traceOrMetadata.error instanceof Error) {
        entry.error = {
          name: traceOrMetadata.error.name,
          message: traceOrMetadata.error.message,
          stack: traceOrMetadata.error.stack,
        };
      }
    }

    this.writeLog(entry);
  }

  /**
   * Log a warning message
   */
  warn(message: string, context?: string): void;
  warn(message: string, metadata?: Record<string, unknown>): void;
  warn(
    message: string,
    contextOrMetadata?: string | Record<string, unknown>,
  ): void {
    const entry = this.createLogEntry(
      LogLevel.WARN,
      message,
      typeof contextOrMetadata === 'string' ? contextOrMetadata : undefined,
    );

    if (typeof contextOrMetadata === 'object') {
      entry.metadata = contextOrMetadata;
    }

    this.writeLog(entry);
  }

  /**
   * Log an info message
   */
  log(message: string, context?: string): void;
  log(message: string, metadata?: Record<string, unknown>): void;
  log(
    message: string,
    contextOrMetadata?: string | Record<string, unknown>,
  ): void {
    const entry = this.createLogEntry(
      LogLevel.INFO,
      message,
      typeof contextOrMetadata === 'string' ? contextOrMetadata : undefined,
    );

    if (typeof contextOrMetadata === 'object') {
      entry.metadata = contextOrMetadata;
    }

    this.writeLog(entry);
  }

  /**
   * Log a debug message
   */
  debug(message: string, context?: string): void;
  debug(message: string, metadata?: Record<string, unknown>): void;
  debug(
    message: string,
    contextOrMetadata?: string | Record<string, unknown>,
  ): void {
    const entry = this.createLogEntry(
      LogLevel.DEBUG,
      message,
      typeof contextOrMetadata === 'string' ? contextOrMetadata : undefined,
    );

    if (typeof contextOrMetadata === 'object') {
      entry.metadata = contextOrMetadata;
    }

    this.writeLog(entry);
  }

  /**
   * Log a verbose message
   */
  verbose(message: string, context?: string): void;
  verbose(message: string, metadata?: Record<string, unknown>): void;
  verbose(
    message: string,
    contextOrMetadata?: string | Record<string, unknown>,
  ): void {
    const entry = this.createLogEntry(
      LogLevel.VERBOSE,
      message,
      typeof contextOrMetadata === 'string' ? contextOrMetadata : undefined,
    );

    if (typeof contextOrMetadata === 'object') {
      entry.metadata = contextOrMetadata;
    }

    this.writeLog(entry);
  }

  /**
   * Log a request completion event with latency
   */
  logRequest(
    statusCode: number,
    latencyMs: number,
    metadata?: Record<string, unknown>,
  ): void {
    const entry = this.createLogEntry(LogLevel.INFO, 'request.completed');
    entry.statusCode = statusCode;
    entry.latencyMs = latencyMs;

    if (metadata) {
      entry.metadata = metadata;
    }

    this.writeLog(entry);
  }

  /**
   * Create a structured log entry with context
   */
  private createLogEntry(
    level: LogLevel,
    message: string,
    context?: string,
  ): StructuredLogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      correlationId: StructuredLoggerService.globalCorrelationId,
      tenantId: StructuredLoggerService.globalTenantId,
      userId: StructuredLoggerService.globalUserId,
      path: StructuredLoggerService.globalPath,
      method: StructuredLoggerService.globalMethod,
      context: context || this.context,
    };
  }

  /**
   * Check if a log level should be written based on current log level setting
   */
  private shouldLog(level: LogLevel): boolean {
    const currentPriority =
      LOG_LEVEL_PRIORITY[StructuredLoggerService.logLevel];
    const messagePriority = LOG_LEVEL_PRIORITY[level];
    return messagePriority <= currentPriority;
  }

  /**
   * Write the log entry to stdout as JSON
   */
  private writeLog(entry: StructuredLogEntry): void {
    // Check if this log level should be written
    if (!this.shouldLog(entry.level)) {
      return;
    }

    // Remove undefined values for cleaner output
    const cleanEntry = Object.fromEntries(
      Object.entries(entry).filter(([, v]) => v !== undefined),
    );

    // Use appropriate console method based on level
    switch (entry.level) {
      case LogLevel.ERROR:
        console.error(JSON.stringify(cleanEntry));
        break;
      case LogLevel.WARN:
        console.warn(JSON.stringify(cleanEntry));
        break;
      case LogLevel.DEBUG:
      case LogLevel.VERBOSE:
        console.debug(JSON.stringify(cleanEntry));
        break;
      default:
        console.log(JSON.stringify(cleanEntry));
    }
  }
}
