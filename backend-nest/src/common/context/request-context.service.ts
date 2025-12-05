import { Injectable, Scope } from '@nestjs/common';
import { randomUUID } from 'crypto';

/**
 * Request Context Service
 *
 * Holds request-scoped context data that can be accessed anywhere via DI.
 * Includes correlation ID, tenant ID, user ID, path, and timing information.
 *
 * This service is REQUEST scoped, meaning a new instance is created for each request.
 */
@Injectable({ scope: Scope.REQUEST })
export class RequestContextService {
  private _correlationId: string;
  private _tenantId: string | null = null;
  private _userId: string | null = null;
  private _path: string = '';
  private _method: string = '';
  private _startTime: number;
  private _userAgent: string = '';
  private _ip: string = '';

    constructor() {
      this._correlationId = randomUUID();
      this._startTime = Date.now();
    }

  // Correlation ID
  get correlationId(): string {
    return this._correlationId;
  }

  set correlationId(value: string) {
    this._correlationId = value;
  }

  // Tenant ID
  get tenantId(): string | null {
    return this._tenantId;
  }

  set tenantId(value: string | null) {
    this._tenantId = value;
  }

  // User ID
  get userId(): string | null {
    return this._userId;
  }

  set userId(value: string | null) {
    this._userId = value;
  }

  // Request path
  get path(): string {
    return this._path;
  }

  set path(value: string) {
    this._path = value;
  }

  // HTTP method
  get method(): string {
    return this._method;
  }

  set method(value: string) {
    this._method = value;
  }

  // Request start time
  get startTime(): number {
    return this._startTime;
  }

  // User agent
  get userAgent(): string {
    return this._userAgent;
  }

  set userAgent(value: string) {
    this._userAgent = value;
  }

  // Client IP
  get ip(): string {
    return this._ip;
  }

  set ip(value: string) {
    this._ip = value;
  }

  /**
   * Calculate elapsed time since request start
   */
  getElapsedMs(): number {
    return Date.now() - this._startTime;
  }

  /**
   * Get context as a plain object for logging
   */
  toLogContext(): Record<string, unknown> {
    return {
      correlationId: this._correlationId,
      tenantId: this._tenantId,
      userId: this._userId,
      path: this._path,
      method: this._method,
      ip: this._ip,
    };
  }
}
