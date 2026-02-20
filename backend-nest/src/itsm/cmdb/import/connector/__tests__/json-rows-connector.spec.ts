import { JsonRowsConnector } from '../connectors/json-rows.connector';

describe('JsonRowsConnector', () => {
  const connector = new JsonRowsConnector();

  it('returns rows from body', async () => {
    const rows = [
      { name: 'Server-01', ip: '192.168.1.1' },
      { name: 'Server-02', ip: '192.168.1.2' },
    ];

    const result = await connector.fetch({ body: rows });

    expect(result.rows).toEqual(rows);
    expect(result.metadata?.totalFetched).toBe(2);
    expect(result.metadata?.source).toBe('inline-json');
  });

  it('returns empty array when no body', async () => {
    const result = await connector.fetch({});
    expect(result.rows).toEqual([]);
    expect(result.metadata?.totalFetched).toBe(0);
  });
});
