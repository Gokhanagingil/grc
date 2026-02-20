import { CsvConnector } from '../connectors/csv.connector';

describe('CsvConnector', () => {
  const connector = new CsvConnector();

  it('parses CSV with headers', async () => {
    const result = await connector.fetch({
      body: 'name,ip,status\nServer-01,192.168.1.1,active\nServer-02,192.168.1.2,inactive',
    });

    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]).toEqual({
      name: 'Server-01',
      ip: '192.168.1.1',
      status: 'active',
    });
    expect(result.rows[1]).toEqual({
      name: 'Server-02',
      ip: '192.168.1.2',
      status: 'inactive',
    });
  });

  it('parses CSV without headers', async () => {
    const result = await connector.fetch({
      body: 'Server-01,192.168.1.1\nServer-02,192.168.1.2',
      csvHasHeader: false,
    });

    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]).toEqual({
      col_0: 'Server-01',
      col_1: '192.168.1.1',
    });
  });

  it('handles custom delimiter', async () => {
    const result = await connector.fetch({
      body: 'name;ip\nServer-01;192.168.1.1',
      csvDelimiter: ';',
    });

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toEqual({
      name: 'Server-01',
      ip: '192.168.1.1',
    });
  });

  it('handles quoted fields with commas', async () => {
    const result = await connector.fetch({
      body: 'name,description\nServer-01,"Main server, production"',
    });

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toEqual({
      name: 'Server-01',
      description: 'Main server, production',
    });
  });

  it('returns empty array for empty input', async () => {
    const result = await connector.fetch({ body: '' });
    expect(result.rows).toHaveLength(0);
  });

  it('handles escaped quotes', async () => {
    const result = await connector.fetch({
      body: 'name,note\nServer-01,"He said ""hello"""',
    });

    expect(result.rows[0]).toEqual({
      name: 'Server-01',
      note: 'He said "hello"',
    });
  });
});
