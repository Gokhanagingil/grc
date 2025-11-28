export const METRICS_PORT = Symbol('METRICS_PORT');

export interface MetricsPort {
  incrementCacheHit(): void;
  incrementCacheMiss(): void;
  counter(name: string): void; // generic
}

export class NullMetricsAdapter implements MetricsPort {
  incrementCacheHit(): void {
    /* no-op */
  }
  incrementCacheMiss(): void {
    /* no-op */
  }
  counter(_name: string): void {
    /* no-op */
  }
}

