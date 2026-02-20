import { HttpPullConnector } from '../connectors/http-pull.connector';

describe('HttpPullConnector', () => {
  const connector = new HttpPullConnector();

  it('throws when no url is provided', async () => {
    await expect(connector.fetch({})).rejects.toThrow(
      'HTTP_PULL connector requires a url in config',
    );
  });

  it('throws for non-http protocols', async () => {
    await expect(
      connector.fetch({ url: 'ftp://example.com/data' }),
    ).rejects.toThrow('HTTP_PULL connector only supports http/https');
  });

  it('throws for unsupported methods', async () => {
    await expect(
      connector.fetch({ url: 'https://example.com/data', method: 'DELETE' }),
    ).rejects.toThrow('HTTP_PULL connector only supports GET and POST');
  });

  describe('SSRF protection', () => {
    it('blocks localhost', async () => {
      await expect(
        connector.fetch({ url: 'http://localhost/data' }),
      ).rejects.toThrow('does not allow requests to private/internal');
    });

    it('blocks 127.0.0.1', async () => {
      await expect(
        connector.fetch({ url: 'http://127.0.0.1/data' }),
      ).rejects.toThrow('does not allow requests to private/internal');
    });

    it('blocks 10.x.x.x range', async () => {
      await expect(
        connector.fetch({ url: 'http://10.0.0.1/data' }),
      ).rejects.toThrow('does not allow requests to private/internal');
    });

    it('blocks 172.16.x.x range', async () => {
      await expect(
        connector.fetch({ url: 'http://172.16.0.1/data' }),
      ).rejects.toThrow('does not allow requests to private/internal');
    });

    it('blocks 192.168.x.x range', async () => {
      await expect(
        connector.fetch({ url: 'http://192.168.1.1/data' }),
      ).rejects.toThrow('does not allow requests to private/internal');
    });

    it('blocks 169.254.x.x (link-local/metadata)', async () => {
      await expect(
        connector.fetch({ url: 'http://169.254.169.254/latest/meta-data/' }),
      ).rejects.toThrow('does not allow requests to private/internal');
    });

    it('blocks 0.0.0.0', async () => {
      await expect(
        connector.fetch({ url: 'http://0.0.0.0/data' }),
      ).rejects.toThrow('does not allow requests to private/internal');
    });

    it('blocks .local domains', async () => {
      await expect(
        connector.fetch({ url: 'http://myserver.local/data' }),
      ).rejects.toThrow('does not allow requests to private/internal');
    });

    it('blocks .internal domains', async () => {
      await expect(
        connector.fetch({ url: 'http://backend.internal/data' }),
      ).rejects.toThrow('does not allow requests to private/internal');
    });
  });
});
