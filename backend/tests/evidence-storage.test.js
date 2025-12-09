/**
 * Evidence Storage Tests
 * 
 * Unit tests for LocalEvidenceStorageAdapter and EvidenceShareService
 */

const path = require('path');
const fs = require('fs');
const os = require('os');

// Set up test environment
process.env.NODE_ENV = 'test';
process.env.DB_CLIENT = 'sqlite';
process.env.DB_PATH = ':memory:';

describe('LocalEvidenceStorageAdapter', () => {
  let LocalEvidenceStorageAdapter;
  let adapter;
  let testStorageRoot;

  beforeAll(() => {
    // Create a temporary directory for test storage
    testStorageRoot = path.join(os.tmpdir(), `evidence-test-${Date.now()}`);
    fs.mkdirSync(testStorageRoot, { recursive: true });
    
    // Import the adapter
    LocalEvidenceStorageAdapter = require('../services/storage/LocalEvidenceStorageAdapter');
    adapter = new LocalEvidenceStorageAdapter({ storageRoot: testStorageRoot });
  });

  afterAll(() => {
    // Clean up test storage directory
    if (testStorageRoot && fs.existsSync(testStorageRoot)) {
      fs.rmSync(testStorageRoot, { recursive: true, force: true });
    }
  });

  describe('getBackendType', () => {
    it('should return "local"', () => {
      expect(adapter.getBackendType()).toBe('local');
    });
  });

  describe('saveFile', () => {
    it('should save a file and return storage path, checksum, and file size', async () => {
      const fileBuffer = Buffer.from('Test file content');
      const fileName = 'test-document.txt';
      const mimeType = 'text/plain';
      const context = { userId: 1, evidenceId: 1 };

      const result = await adapter.saveFile(fileBuffer, fileName, mimeType, context);

      expect(result).toHaveProperty('storagePath');
      expect(result).toHaveProperty('checksum');
      expect(result).toHaveProperty('fileSize');
      expect(result.fileSize).toBe(fileBuffer.length);
      expect(result.checksum).toMatch(/^[a-f0-9]{64}$/); // SHA-256 hex string
      expect(result.storagePath).toContain('test-document.txt');
    });

    it('should sanitize dangerous file names', async () => {
      const fileBuffer = Buffer.from('Test content');
      const dangerousFileName = '../../../etc/passwd';
      const mimeType = 'text/plain';
      const context = { userId: 1 };

      const result = await adapter.saveFile(fileBuffer, dangerousFileName, mimeType, context);

      // Should not contain path traversal characters
      expect(result.storagePath).not.toContain('..');
      expect(result.storagePath).not.toContain('/etc/passwd');
    });

    it('should handle files with special characters in name', async () => {
      const fileBuffer = Buffer.from('Test content');
      const specialFileName = 'file with spaces & special (chars).txt';
      const mimeType = 'text/plain';
      const context = { userId: 1 };

      const result = await adapter.saveFile(fileBuffer, specialFileName, mimeType, context);

      expect(result).toHaveProperty('storagePath');
      expect(result.fileSize).toBe(fileBuffer.length);
    });

    it('should create year/month directory structure', async () => {
      const fileBuffer = Buffer.from('Test content');
      const fileName = 'test.txt';
      const mimeType = 'text/plain';
      const context = { userId: 1 };

      const result = await adapter.saveFile(fileBuffer, fileName, mimeType, context);

      const now = new Date();
      const year = now.getFullYear().toString();
      const month = String(now.getMonth() + 1).padStart(2, '0');

      expect(result.storagePath).toContain(year);
      expect(result.storagePath).toContain(month);
    });
  });

  describe('getFileStream', () => {
    it('should return a readable stream for an existing file', async () => {
      // First save a file
      const fileBuffer = Buffer.from('Stream test content');
      const fileName = 'stream-test.txt';
      const mimeType = 'text/plain';
      const context = { userId: 1 };

      const { storagePath } = await adapter.saveFile(fileBuffer, fileName, mimeType, context);

      // Get the stream (async method)
      const stream = await adapter.getFileStream(storagePath);

      expect(stream).toBeDefined();
      expect(typeof stream.pipe).toBe('function'); // Check it's a stream

      // Read the content
      const chunks = [];
      for await (const chunk of stream) {
        chunks.push(chunk);
      }
      const content = Buffer.concat(chunks).toString();
      expect(content).toBe('Stream test content');
    });

    it('should throw error for non-existent file', async () => {
      await expect(adapter.getFileStream('non-existent/path/file.txt')).rejects.toThrow('File not found');
    });

    it('should prevent path traversal attacks', async () => {
      await expect(adapter.getFileStream('../../../etc/passwd')).rejects.toThrow('Invalid storage path');
    });
  });

  describe('deleteFile', () => {
    it('should delete an existing file', async () => {
      // First save a file
      const fileBuffer = Buffer.from('Delete test content');
      const fileName = 'delete-test.txt';
      const mimeType = 'text/plain';
      const context = { userId: 1 };

      const { storagePath } = await adapter.saveFile(fileBuffer, fileName, mimeType, context);

      // Verify file exists
      const exists = await adapter.fileExists(storagePath);
      expect(exists).toBe(true);

      // Delete the file
      await adapter.deleteFile(storagePath);

      // Verify file no longer exists
      const existsAfter = await adapter.fileExists(storagePath);
      expect(existsAfter).toBe(false);
    });

    it('should not throw for non-existent file', async () => {
      await expect(adapter.deleteFile('non-existent/path/file.txt')).resolves.not.toThrow();
    });

    it('should prevent path traversal attacks', async () => {
      await expect(adapter.deleteFile('../../../etc/passwd')).rejects.toThrow('Invalid storage path');
    });
  });

  describe('fileExists', () => {
    it('should return true for existing file', async () => {
      const fileBuffer = Buffer.from('Exists test content');
      const fileName = 'exists-test.txt';
      const mimeType = 'text/plain';
      const context = { userId: 1 };

      const { storagePath } = await adapter.saveFile(fileBuffer, fileName, mimeType, context);

      const exists = await adapter.fileExists(storagePath);
      expect(exists).toBe(true);
    });

    it('should return false for non-existent file', async () => {
      const exists = await adapter.fileExists('non-existent/path/file.txt');
      expect(exists).toBe(false);
    });
  });

  describe('getFileMetadata', () => {
    it('should return file metadata for existing file', async () => {
      const fileBuffer = Buffer.from('Metadata test content');
      const fileName = 'metadata-test.txt';
      const mimeType = 'text/plain';
      const context = { userId: 1 };

      const { storagePath } = await adapter.saveFile(fileBuffer, fileName, mimeType, context);

      const metadata = await adapter.getFileMetadata(storagePath);

      expect(metadata).toHaveProperty('size');
      expect(metadata).toHaveProperty('lastModified');
      expect(metadata.size).toBe(fileBuffer.length);
      expect(metadata.lastModified instanceof Date || !isNaN(new Date(metadata.lastModified))).toBe(true);
    });

    it('should return null for non-existent file', async () => {
      const metadata = await adapter.getFileMetadata('non-existent/path/file.txt');
      expect(metadata).toBeNull();
    });
  });
});

describe('EvidenceShareService', () => {
  let evidenceShareService;
  let db;

  beforeAll(async () => {
    // Initialize database
    const dbConnection = require('../database/connection');
    await dbConnection.init();
    db = require('../db');
    
    // Run Phase 6 migration to create evidence_shares table
    // For testing, we'll create the table directly
    await db.run(`
      CREATE TABLE IF NOT EXISTS evidence_shares (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        evidence_id INTEGER NOT NULL,
        token TEXT NOT NULL UNIQUE,
        expires_at TEXT NOT NULL,
        created_by INTEGER NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        max_downloads INTEGER,
        download_count INTEGER DEFAULT 0
      )
    `);

    // Create evidence table if not exists
    await db.run(`
      CREATE TABLE IF NOT EXISTS evidence (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        finding_id INTEGER,
        audit_id INTEGER,
        title TEXT NOT NULL,
        description TEXT,
        type TEXT DEFAULT 'document',
        storage_type TEXT DEFAULT 'reference',
        storage_ref TEXT,
        storage_path TEXT,
        file_name TEXT,
        mime_type TEXT,
        file_size INTEGER,
        checksum TEXT,
        deleted_at TEXT,
        uploaded_by INTEGER,
        uploaded_at TEXT DEFAULT CURRENT_TIMESTAMP,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    evidenceShareService = require('../services/EvidenceShareService');
  });

  beforeEach(async () => {
    // Clean up tables before each test
    await db.run('DELETE FROM evidence_shares');
    await db.run('DELETE FROM evidence');
  });

  describe('createShare', () => {
    it('should create a share link with valid parameters', async () => {
      // Create test evidence
      await db.run(
        'INSERT INTO evidence (title, storage_path, file_name, mime_type) VALUES (?, ?, ?, ?)',
        ['Test Evidence', 'test/path/file.txt', 'file.txt', 'text/plain']
      );
      const evidence = await db.get('SELECT id FROM evidence ORDER BY id DESC LIMIT 1');

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      const share = await evidenceShareService.createShare({
        evidenceId: evidence.id,
        createdBy: 1,
        expiresAt: expiresAt.toISOString(),
        maxDownloads: 10
      });

      expect(share).toHaveProperty('id');
      expect(share).toHaveProperty('token');
      expect(share).toHaveProperty('shareUrl');
      expect(share.token).toHaveLength(64); // 32 bytes hex = 64 chars
      expect(share.shareUrl).toContain(share.token);
    });

    it('should throw error if expiresAt is in the past', async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);

      await expect(evidenceShareService.createShare({
        evidenceId: 1,
        createdBy: 1,
        expiresAt: pastDate.toISOString()
      })).rejects.toThrow('expiresAt must be in the future');
    });

    it('should throw error if evidenceId is missing', async () => {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      await expect(evidenceShareService.createShare({
        createdBy: 1,
        expiresAt: expiresAt.toISOString()
      })).rejects.toThrow('evidenceId is required');
    });
  });

  describe('validateToken', () => {
    it('should return valid for a valid token', async () => {
      // Create test evidence
      await db.run(
        'INSERT INTO evidence (title, storage_path, file_name, mime_type) VALUES (?, ?, ?, ?)',
        ['Test Evidence', 'test/path/file.txt', 'file.txt', 'text/plain']
      );
      const evidence = await db.get('SELECT id FROM evidence ORDER BY id DESC LIMIT 1');

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      const share = await evidenceShareService.createShare({
        evidenceId: evidence.id,
        createdBy: 1,
        expiresAt: expiresAt.toISOString()
      });

      const validation = await evidenceShareService.validateToken(share.token);

      expect(validation.valid).toBe(true);
      expect(validation.share).toBeDefined();
      expect(validation.evidence).toBeDefined();
    });

    it('should return invalid for expired token', async () => {
      // Create test evidence
      await db.run(
        'INSERT INTO evidence (title, storage_path, file_name, mime_type) VALUES (?, ?, ?, ?)',
        ['Test Evidence', 'test/path/file.txt', 'file.txt', 'text/plain']
      );
      const evidence = await db.get('SELECT id FROM evidence ORDER BY id DESC LIMIT 1');

      // Create share with past expiration (directly in DB to bypass validation)
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);
      const token = 'expired_token_' + Date.now();
      
      await db.run(
        'INSERT INTO evidence_shares (evidence_id, token, expires_at, created_by) VALUES (?, ?, ?, ?)',
        [evidence.id, token, pastDate.toISOString(), 1]
      );

      const validation = await evidenceShareService.validateToken(token);

      expect(validation.valid).toBe(false);
      expect(validation.error).toContain('expired');
    });

    it('should return invalid when download limit reached', async () => {
      // Create test evidence
      await db.run(
        'INSERT INTO evidence (title, storage_path, file_name, mime_type) VALUES (?, ?, ?, ?)',
        ['Test Evidence', 'test/path/file.txt', 'file.txt', 'text/plain']
      );
      const evidence = await db.get('SELECT id FROM evidence ORDER BY id DESC LIMIT 1');

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);
      const token = 'limited_token_' + Date.now();
      
      // Create share with max_downloads = 1 and download_count = 1
      await db.run(
        'INSERT INTO evidence_shares (evidence_id, token, expires_at, created_by, max_downloads, download_count) VALUES (?, ?, ?, ?, ?, ?)',
        [evidence.id, token, expiresAt.toISOString(), 1, 1, 1]
      );

      const validation = await evidenceShareService.validateToken(token);

      expect(validation.valid).toBe(false);
      expect(validation.error).toContain('limit');
    });

    it('should return invalid for non-existent token', async () => {
      const validation = await evidenceShareService.validateToken('non_existent_token');

      expect(validation.valid).toBe(false);
      expect(validation.error).toContain('Invalid');
    });

    it('should return invalid for deleted evidence', async () => {
      // Create test evidence (soft deleted)
      await db.run(
        'INSERT INTO evidence (title, storage_path, file_name, mime_type, deleted_at) VALUES (?, ?, ?, ?, ?)',
        ['Test Evidence', 'test/path/file.txt', 'file.txt', 'text/plain', new Date().toISOString()]
      );
      const evidence = await db.get('SELECT id FROM evidence ORDER BY id DESC LIMIT 1');

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);
      const token = 'deleted_evidence_token_' + Date.now();
      
      await db.run(
        'INSERT INTO evidence_shares (evidence_id, token, expires_at, created_by) VALUES (?, ?, ?, ?)',
        [evidence.id, token, expiresAt.toISOString(), 1]
      );

      const validation = await evidenceShareService.validateToken(token);

      expect(validation.valid).toBe(false);
      expect(validation.error).toContain('deleted');
    });
  });

  describe('incrementDownloadCount', () => {
    it('should increment download count', async () => {
      // Create test evidence
      await db.run(
        'INSERT INTO evidence (title, storage_path, file_name, mime_type) VALUES (?, ?, ?, ?)',
        ['Test Evidence', 'test/path/file.txt', 'file.txt', 'text/plain']
      );
      const evidence = await db.get('SELECT id FROM evidence ORDER BY id DESC LIMIT 1');

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      const share = await evidenceShareService.createShare({
        evidenceId: evidence.id,
        createdBy: 1,
        expiresAt: expiresAt.toISOString()
      });

      // Initial count should be 0
      let shareRecord = await db.get('SELECT download_count FROM evidence_shares WHERE id = ?', [share.id]);
      expect(shareRecord.download_count).toBe(0);

      // Increment
      await evidenceShareService.incrementDownloadCount(share.id);

      // Count should be 1
      shareRecord = await db.get('SELECT download_count FROM evidence_shares WHERE id = ?', [share.id]);
      expect(shareRecord.download_count).toBe(1);
    });
  });
});

describe('generateSecureToken', () => {
  let generateSecureToken;

  beforeAll(() => {
    generateSecureToken = require('../services/EvidenceShareService').generateSecureToken;
  });

  it('should generate a 64-character hex token by default', () => {
    const token = generateSecureToken();
    expect(token).toHaveLength(64);
    expect(token).toMatch(/^[a-f0-9]+$/);
  });

  it('should generate tokens of specified length', () => {
    const token = generateSecureToken(16);
    expect(token).toHaveLength(32); // 16 bytes = 32 hex chars
  });

  it('should generate unique tokens', () => {
    const tokens = new Set();
    for (let i = 0; i < 100; i++) {
      tokens.add(generateSecureToken());
    }
    expect(tokens.size).toBe(100);
  });
});
