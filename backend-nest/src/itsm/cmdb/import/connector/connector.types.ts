export enum ConnectorType {
  JSON_ROWS = 'JSON_ROWS',
  CSV = 'CSV',
  HTTP_PULL = 'HTTP_PULL',
}

export interface ConnectorResult {
  rows: Record<string, unknown>[];
  metadata?: {
    totalFetched: number;
    fetchedAt: string;
    source?: string;
  };
}

export interface ConnectorConfig {
  url?: string;
  headers?: Record<string, string>;
  method?: string;
  body?: unknown;
  csvDelimiter?: string;
  csvHasHeader?: boolean;
  responseRowsPath?: string;
}

export interface Connector {
  type: ConnectorType;
  fetch(config: ConnectorConfig): Promise<ConnectorResult>;
}
