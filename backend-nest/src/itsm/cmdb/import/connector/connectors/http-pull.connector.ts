import {
  Connector,
  ConnectorType,
  ConnectorConfig,
  ConnectorResult,
} from '../connector.types';

export class HttpPullConnector implements Connector {
  type = ConnectorType.HTTP_PULL;

  async fetch(config: ConnectorConfig): Promise<ConnectorResult> {
    if (!config.url) {
      throw new Error('HTTP_PULL connector requires a url in config');
    }

    const allowedProtocols = ['http:', 'https:'];
    const parsed = new URL(config.url);
    if (!allowedProtocols.includes(parsed.protocol)) {
      throw new Error(
        `HTTP_PULL connector only supports http/https protocols, got: ${parsed.protocol}`,
      );
    }

    const headers: Record<string, string> = {
      Accept: 'application/json',
      ...(config.headers || {}),
    };

    const method = (config.method || 'GET').toUpperCase();
    if (method !== 'GET' && method !== 'POST') {
      throw new Error(
        `HTTP_PULL connector only supports GET and POST methods, got: ${method}`,
      );
    }

    const fetchOptions: RequestInit = {
      method,
      headers,
      signal: AbortSignal.timeout(30_000),
    };

    if (method === 'POST' && config.body) {
      fetchOptions.body = JSON.stringify(config.body);
      headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(config.url, fetchOptions);
    if (!response.ok) {
      throw new Error(
        `HTTP_PULL fetch failed: ${response.status} ${response.statusText}`,
      );
    }

    const data: unknown = await response.json();

    let rows: Record<string, unknown>[];
    if (config.responseRowsPath) {
      rows = this.extractPath(data, config.responseRowsPath);
    } else if (Array.isArray(data)) {
      rows = data as Record<string, unknown>[];
    } else if (
      typeof data === 'object' &&
      data !== null &&
      'items' in data &&
      Array.isArray((data as Record<string, unknown>).items)
    ) {
      rows = (data as Record<string, unknown>).items as Record<
        string,
        unknown
      >[];
    } else {
      throw new Error(
        'HTTP_PULL: response is not an array and no responseRowsPath configured',
      );
    }

    return {
      rows,
      metadata: {
        totalFetched: rows.length,
        fetchedAt: new Date().toISOString(),
        source: config.url,
      },
    };
  }

  private extractPath(data: unknown, path: string): Record<string, unknown>[] {
    const parts = path.split('.');
    let current: unknown = data;
    for (const part of parts) {
      if (current === null || current === undefined) {
        throw new Error(`HTTP_PULL: path "${path}" not found in response`);
      }
      current = (current as Record<string, unknown>)[part];
    }
    if (!Array.isArray(current)) {
      throw new Error(`HTTP_PULL: value at path "${path}" is not an array`);
    }
    return current as Record<string, unknown>[];
  }
}
