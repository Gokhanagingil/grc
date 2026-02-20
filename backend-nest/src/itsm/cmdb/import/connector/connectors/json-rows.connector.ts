import {
  Connector,
  ConnectorType,
  ConnectorConfig,
  ConnectorResult,
} from '../connector.types';

export class JsonRowsConnector implements Connector {
  type = ConnectorType.JSON_ROWS;

  fetch(config: ConnectorConfig): Promise<ConnectorResult> {
    const rows = (config.body as Record<string, unknown>[]) || [];
    return Promise.resolve({
      rows,
      metadata: {
        totalFetched: rows.length,
        fetchedAt: new Date().toISOString(),
        source: 'inline-json',
      },
    });
  }
}
