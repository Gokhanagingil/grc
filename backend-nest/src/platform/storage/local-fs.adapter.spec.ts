import { ConfigService } from '@nestjs/config';
import * as os from 'os';
import * as path from 'path';
import { LocalFsAdapter } from './local-fs.adapter';
import * as fs from 'fs';

describe('LocalFsAdapter', () => {
  let adapter: LocalFsAdapter;
  let mockConfigService: jest.Mocked<ConfigService>;
  const testDir = path.join(os.tmpdir(), 'local-fs-adapter-test');

  beforeEach(() => {
    mockConfigService = {
      get: jest.fn(),
    } as unknown as jest.Mocked<ConfigService>;

    // Clean up test directory before each test
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  afterEach(() => {
    // Clean up test directory after each test
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('constructor', () => {
    it('should use ATTACHMENT_STORAGE_PATH when configured', () => {
      mockConfigService.get.mockReturnValue(testDir);
      adapter = new LocalFsAdapter(mockConfigService);

      expect(adapter.getBasePath()).toBe(testDir);
    });

    it('should use default production path when NODE_ENV is production', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      mockConfigService.get.mockReturnValue(undefined);

      adapter = new LocalFsAdapter(mockConfigService);

      expect(adapter.getBasePath()).toBe(
        LocalFsAdapter.DEFAULT_PRODUCTION_PATH,
      );

      process.env.NODE_ENV = originalEnv;
    });

    it('should use default dev path when NODE_ENV is not production', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      mockConfigService.get.mockReturnValue(undefined);

      adapter = new LocalFsAdapter(mockConfigService);

      expect(adapter.getBasePath()).toBe(LocalFsAdapter.DEFAULT_DEV_PATH);

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('static constants', () => {
    it('should have correct default production path', () => {
      expect(LocalFsAdapter.DEFAULT_PRODUCTION_PATH).toBe('/app/data/uploads');
    });

    it('should have correct fallback path', () => {
      expect(LocalFsAdapter.FALLBACK_PATH).toBe('/tmp/uploads');
    });

    it('should have correct default dev path', () => {
      expect(LocalFsAdapter.DEFAULT_DEV_PATH).toBe('./uploads');
    });
  });

  describe('EACCES fallback behavior', () => {
    const isChmodSupported = process.platform !== 'win32';

    it('should fall back to /tmp/uploads when primary path is not writable', async () => {
      if (!isChmodSupported) {
        return;
      }
      // Create a read-only directory to simulate EACCES (chmod is POSIX-only)
      const readOnlyDir = path.join(testDir, 'readonly');
      fs.mkdirSync(readOnlyDir, { recursive: true });

      const targetDir = path.join(readOnlyDir, 'uploads');
      fs.mkdirSync(targetDir, { recursive: true });

      fs.chmodSync(readOnlyDir, 0o444);

      try {
        mockConfigService.get.mockReturnValue(
          path.join(readOnlyDir, 'new-uploads'),
        );
        adapter = new LocalFsAdapter(mockConfigService);

        await new Promise((resolve) => setTimeout(resolve, 100));

        expect(adapter.isUsingFallback()).toBe(true);
        expect(adapter.getBasePath()).toBe(LocalFsAdapter.FALLBACK_PATH);
      } finally {
        fs.chmodSync(readOnlyDir, 0o755);
      }
    });

    it('should not use fallback when primary path is writable', async () => {
      const writableDir = path.join(testDir, 'writable');
      mockConfigService.get.mockReturnValue(writableDir);

      adapter = new LocalFsAdapter(mockConfigService);

      // Wait for async initialization
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(adapter.isUsingFallback()).toBe(false);
      expect(adapter.getBasePath()).toBe(writableDir);
      expect(adapter.isStorageAvailable()).toBe(true);
    });

    it('should report storage as available after successful fallback', async () => {
      if (!isChmodSupported) {
        return;
      }
      const readOnlyDir = path.join(testDir, 'readonly2');
      fs.mkdirSync(readOnlyDir, { recursive: true });
      fs.chmodSync(readOnlyDir, 0o444);

      try {
        mockConfigService.get.mockReturnValue(
          path.join(readOnlyDir, 'new-uploads'),
        );
        adapter = new LocalFsAdapter(mockConfigService);

        await new Promise((resolve) => setTimeout(resolve, 100));

        expect(adapter.isStorageAvailable()).toBe(true);
      } finally {
        fs.chmodSync(readOnlyDir, 0o755);
      }
    });
  });

  describe('file operations', () => {
    beforeEach(async () => {
      mockConfigService.get.mockReturnValue(testDir);
      adapter = new LocalFsAdapter(mockConfigService);
      // Wait for async initialization
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    it('should store and retrieve a file', async () => {
      const testContent = Buffer.from('test content');
      const key = 'tenant-123/test-file.txt';

      await adapter.put(testContent, key, 'text/plain');

      expect(await adapter.exists(key)).toBe(true);

      const stream = await adapter.getStream(key);
      const chunks: Buffer[] = [];
      for await (const chunk of stream) {
        chunks.push(chunk as Buffer);
      }
      const retrieved = Buffer.concat(chunks);
      expect(retrieved.toString()).toBe('test content');
    });

    it('should delete a file', async () => {
      const testContent = Buffer.from('test content');
      const key = 'tenant-123/delete-test.txt';

      await adapter.put(testContent, key, 'text/plain');
      expect(await adapter.exists(key)).toBe(true);

      await adapter.delete(key);
      expect(await adapter.exists(key)).toBe(false);
    });

    it('should get file metadata', async () => {
      const testContent = Buffer.from('test content for metadata');
      const key = 'tenant-123/metadata-test.txt';

      await adapter.put(testContent, key, 'text/plain');

      const metadata = await adapter.getMetadata(key);
      expect(metadata).not.toBeNull();
      expect(metadata?.key).toBe(key);
      expect(metadata?.size).toBe(testContent.length);
      expect(metadata?.lastModified).toBeDefined();
      expect(typeof metadata?.lastModified?.getTime).toBe('function');
    });

    it('should return null metadata for non-existent file', async () => {
      const metadata = await adapter.getMetadata('non-existent-file.txt');
      expect(metadata).toBeNull();
    });

    it('should prevent path traversal attacks', async () => {
      const maliciousKey = '../../../etc/passwd';

      await expect(
        adapter.put(Buffer.from('malicious'), maliciousKey, 'text/plain'),
      ).rejects.toThrow('path traversal detected');
    });
  });
});
