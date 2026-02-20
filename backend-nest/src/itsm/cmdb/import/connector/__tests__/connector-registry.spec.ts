import { getConnector, getSupportedConnectorTypes } from '../connector-registry';
import { ConnectorType } from '../connector.types';

describe('connector-registry', () => {
  it('returns all supported connector types', () => {
    const types = getSupportedConnectorTypes();
    expect(types).toContain(ConnectorType.JSON_ROWS);
    expect(types).toContain(ConnectorType.CSV);
    expect(types).toContain(ConnectorType.HTTP_PULL);
  });

  it('returns a connector for each registered type', () => {
    expect(getConnector(ConnectorType.JSON_ROWS)).toBeDefined();
    expect(getConnector(ConnectorType.CSV)).toBeDefined();
    expect(getConnector(ConnectorType.HTTP_PULL)).toBeDefined();
  });

  it('throws for unknown connector type', () => {
    expect(() => getConnector('UNKNOWN' as ConnectorType)).toThrow(
      'No connector registered for type',
    );
  });
});
