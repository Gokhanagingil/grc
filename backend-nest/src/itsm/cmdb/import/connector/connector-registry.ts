import { ConnectorType, Connector } from './connector.types';
import { JsonRowsConnector } from './connectors/json-rows.connector';
import { CsvConnector } from './connectors/csv.connector';
import { HttpPullConnector } from './connectors/http-pull.connector';

const registry = new Map<ConnectorType, Connector>();

registry.set(ConnectorType.JSON_ROWS, new JsonRowsConnector());
registry.set(ConnectorType.CSV, new CsvConnector());
registry.set(ConnectorType.HTTP_PULL, new HttpPullConnector());

export function getConnector(type: ConnectorType): Connector {
  const connector = registry.get(type);
  if (!connector) {
    throw new Error(`No connector registered for type: ${type}`);
  }
  return connector;
}

export function getSupportedConnectorTypes(): ConnectorType[] {
  return [...registry.keys()];
}
