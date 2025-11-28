/**
 * WebSocket Payload Helper
 * Standardizes WebSocket event payloads across the application
 */

export type WsEventSource = 'risk-scoring' | 'cap-lifecycle' | 'audit-lifecycle' | 'bcm-lifecycle';

export interface WsPayload<T = unknown> {
  event: string;
  tenantId: string;
  source: WsEventSource;
  ts: string; // ISO timestamp
  data: T;
}

/**
 * Build a standardized WebSocket payload
 */
export function buildWsPayload<T>(
  event: string,
  tenantId: string,
  source: WsEventSource,
  data: T,
): WsPayload<T> {
  return {
    event,
    tenantId,
    source,
    ts: new Date().toISOString(),
    data,
  };
}

