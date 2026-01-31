import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Readable } from 'stream';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { promisify } from 'util';
import { StorageAdapter, StorageMetadata } from './storage-adapter.interface';

const mkdir = promisify(fs.mkdir);
const unlink = promisify(fs.unlink);
const stat = promisify(fs.stat);
const access = promisify(fs.access);

/**
 * Local Filesystem Storage Adapter
 *
 * Stores files on the local filesystem.
 * Suitable for development and staging environments.
 *
 * Configuration:
 * - ATTACHMENT_STORAGE_PATH: Base directory for file storage
 *
 * Path Resolution Order:
 * 1. ATTACHMENT_STORAGE_PATH env var (if set)
 * 2. /app/data/uploads (production default, writable in container)
 * 3. /tmp/uploads (fallback on EACCES permission errors)
 * 4. ./uploads (development default)
 *
 * Security:
 * - Validates storage keys to prevent path traversal attacks
 * - Creates subdirectories based on tenant ID for isolation
 */
@Injectable()
export class LocalFsAdapter implements StorageAdapter {
  private readonly logger = new Logger(LocalFsAdapter.name);
  private basePath: string;
  private storageAvailable = false;
  private usingFallback = false;

  /** Default production path inside container */
  static readonly DEFAULT_PRODUCTION_PATH = '/app/data/uploads';
  /** Fallback path when primary path has permission issues */
  static readonly FALLBACK_PATH = '/tmp/uploads';
  /** Default development path */
  static readonly DEFAULT_DEV_PATH = './uploads';

  constructor(private readonly configService: ConfigService) {
    const configuredPath = this.configService.get<string>(
      'ATTACHMENT_STORAGE_PATH',
    );
    if (configuredPath) {
      this.basePath = configuredPath;
    } else {
      // In production, prefer /app/data/uploads (writable in container)
      // In development, use ./uploads
      this.basePath =
        process.env.NODE_ENV === 'production'
          ? LocalFsAdapter.DEFAULT_PRODUCTION_PATH
          : LocalFsAdapter.DEFAULT_DEV_PATH;
    }
    this.initializeStorage();
  }

  private initializeStorage(): void {
    setImmediate(() => {
      this.ensureBaseDirectory().catch((err: Error) => {
        this.logger.warn(
          `Storage directory initialization deferred: ${err.message}`,
        );
      });
    });
  }

  /**
   * Ensure the base storage directory exists
   *
   * This method handles permission errors gracefully with fallback to /tmp/uploads.
   * If the primary path fails with EACCES, it will attempt to use the fallback path.
   * This ensures storage works in CI smoke tests and ephemeral containers.
   */
  private async ensureBaseDirectory(): Promise<void> {
    const originalPath = this.basePath;

    try {
      await mkdir(this.basePath, { recursive: true });
      // Verify we can actually write to the directory
      this.verifyWriteAccess(this.basePath);
      this.storageAvailable = true;
      this.logger.log(`Storage directory initialized: ${this.basePath}`);
    } catch (error) {
      const errorCode = (error as NodeJS.ErrnoException).code;

      if (errorCode === 'EACCES' || errorCode === 'EROFS') {
        // Permission denied or read-only filesystem - try fallback to /tmp/uploads
        this.logger.warn(
          `Storage directory permission denied: ${originalPath} (${errorCode}). ` +
            `Falling back to ${LocalFsAdapter.FALLBACK_PATH}`,
        );

        try {
          this.basePath = LocalFsAdapter.FALLBACK_PATH;
          await mkdir(this.basePath, { recursive: true });
          this.verifyWriteAccess(this.basePath);
          this.storageAvailable = true;
          this.usingFallback = true;
          this.logger.log(
            `Storage directory initialized with fallback: ${this.basePath} ` +
              `(original path ${originalPath} was not writable)`,
          );
        } catch (fallbackError) {
          const fallbackCode = (fallbackError as NodeJS.ErrnoException).code;
          this.logger.error(
            `Failed to initialize fallback storage directory ${LocalFsAdapter.FALLBACK_PATH}: ` +
              `${fallbackCode || fallbackError}. File upload/download features will not work.`,
          );
          // Restore original path for error messages
          this.basePath = originalPath;
        }
      } else if (errorCode === 'ENOENT') {
        // Parent directory doesn't exist - try to create it
        this.logger.warn(
          `Storage parent directory does not exist: ${this.basePath}. ` +
            `Attempting to create parent directories...`,
        );
        try {
          await mkdir(path.dirname(this.basePath), { recursive: true });
          await mkdir(this.basePath, { recursive: true });
          this.verifyWriteAccess(this.basePath);
          this.storageAvailable = true;
          this.logger.log(`Storage directory created: ${this.basePath}`);
        } catch (retryError) {
          const retryCode = (retryError as NodeJS.ErrnoException).code;
          // If retry fails with permission error, try fallback
          if (retryCode === 'EACCES' || retryCode === 'EROFS') {
            await this.tryFallbackPath(originalPath);
          } else {
            this.logger.error(
              `Failed to create storage directory after retry: ${retryError}`,
            );
          }
        }
      } else {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        this.logger.error(
          `Failed to create storage directory: ${errorMessage} (code: ${errorCode})`,
        );
      }
    }
  }

  /**
   * Verify write access to a directory by creating and removing a test file.
   * Uses a cryptographically random filename to prevent symlink attacks.
   */
  private verifyWriteAccess(dirPath: string): void {
    // Use random suffix to prevent predictable filename attacks (CWE-377)
    const randomSuffix = crypto.randomBytes(16).toString('hex');
    const testFile = path.join(dirPath, `.write-test-${randomSuffix}`);
    try {
      // Use exclusive flag to fail if file already exists (prevents race conditions)
      fs.writeFileSync(testFile, 'ok', { flag: 'wx', mode: 0o600 });
      fs.unlinkSync(testFile);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      // Clean up test file if it was created but unlink failed
      try {
        fs.unlinkSync(testFile);
      } catch {
        // Ignore cleanup errors
      }
      throw Object.assign(new Error(`Cannot write to ${dirPath}`), {
        code: code || 'EACCES',
      });
    }
  }

  /**
   * Attempt to use the fallback path when primary path fails
   */
  private async tryFallbackPath(originalPath: string): Promise<void> {
    this.logger.warn(
      `Primary storage path ${originalPath} not writable. ` +
        `Falling back to ${LocalFsAdapter.FALLBACK_PATH}`,
    );

    try {
      this.basePath = LocalFsAdapter.FALLBACK_PATH;
      await mkdir(this.basePath, { recursive: true });
      this.verifyWriteAccess(this.basePath);
      this.storageAvailable = true;
      this.usingFallback = true;
      this.logger.log(
        `Storage directory initialized with fallback: ${this.basePath}`,
      );
    } catch (fallbackError) {
      this.logger.error(
        `Failed to initialize fallback storage: ${fallbackError}. ` +
          `File upload/download features will not work.`,
      );
      this.basePath = originalPath;
    }
  }

  /**
   * Check if storage is using the fallback path
   */
  isUsingFallback(): boolean {
    return this.usingFallback;
  }

  /**
   * Get the current storage base path
   */
  getBasePath(): string {
    return this.basePath;
  }

  /**
   * Check if storage is available for use
   */
  isStorageAvailable(): boolean {
    return this.storageAvailable;
  }

  /**
   * Validate storage key to prevent path traversal
   */
  private validateKey(key: string): void {
    if (!key || typeof key !== 'string') {
      throw new Error('Invalid storage key');
    }

    const normalizedKey = path.normalize(key);
    if (
      normalizedKey.includes('..') ||
      normalizedKey.startsWith('/') ||
      normalizedKey.includes('\0')
    ) {
      throw new Error('Invalid storage key: path traversal detected');
    }
  }

  /**
   * Get the full filesystem path for a storage key
   */
  private getFullPath(key: string): string {
    this.validateKey(key);
    return path.join(this.basePath, key);
  }

  /**
   * Ensure the directory for a file exists
   */
  private async ensureDirectory(filePath: string): Promise<void> {
    const dir = path.dirname(filePath);
    await mkdir(dir, { recursive: true });
  }

  /**
   * Store a file
   */
  async put(
    data: Buffer | Readable,
    key: string,
    contentType: string,
  ): Promise<{ key: string }> {
    const fullPath = this.getFullPath(key);
    await this.ensureDirectory(fullPath);

    return new Promise((resolve, reject) => {
      const writeStream = fs.createWriteStream(fullPath);

      writeStream.on('finish', () => {
        this.logger.debug(`File stored: ${key} (${contentType})`);
        resolve({ key });
      });

      writeStream.on('error', (error) => {
        this.logger.error(`Failed to store file: ${key}`, error);
        reject(error);
      });

      if (Buffer.isBuffer(data)) {
        writeStream.write(data);
        writeStream.end();
      } else {
        data.pipe(writeStream);
      }
    });
  }

  /**
   * Retrieve a file as a readable stream
   */
  async getStream(key: string): Promise<Readable> {
    const fullPath = this.getFullPath(key);

    try {
      await access(fullPath, fs.constants.R_OK);
    } catch {
      throw new Error(`File not found: ${key}`);
    }

    return fs.createReadStream(fullPath);
  }

  /**
   * Delete a file from storage
   */
  async delete(key: string): Promise<void> {
    const fullPath = this.getFullPath(key);

    try {
      await unlink(fullPath);
      this.logger.debug(`File deleted: ${key}`);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        this.logger.warn(`File not found for deletion: ${key}`);
        return;
      }
      throw error;
    }
  }

  /**
   * Check if a file exists
   */
  async exists(key: string): Promise<boolean> {
    const fullPath = this.getFullPath(key);

    try {
      await access(fullPath, fs.constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get file metadata
   */
  async getMetadata(key: string): Promise<StorageMetadata | null> {
    const fullPath = this.getFullPath(key);

    try {
      const stats = await stat(fullPath);
      return {
        key,
        size: stats.size,
        lastModified: stats.mtime,
      };
    } catch {
      return null;
    }
  }
}
