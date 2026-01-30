import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Readable } from 'stream';
import * as fs from 'fs';
import * as path from 'path';
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
 * - ATTACHMENT_STORAGE_PATH: Base directory for file storage (default: ./uploads)
 *
 * Security:
 * - Validates storage keys to prevent path traversal attacks
 * - Creates subdirectories based on tenant ID for isolation
 */
@Injectable()
export class LocalFsAdapter implements StorageAdapter {
  private readonly logger = new Logger(LocalFsAdapter.name);
  private readonly basePath: string;
  private storageAvailable = false;

  constructor(private readonly configService: ConfigService) {
    const configuredPath = this.configService.get<string>(
      'ATTACHMENT_STORAGE_PATH',
    );
    if (configuredPath) {
      this.basePath = configuredPath;
    } else {
      // In production, prefer /app/data (writable in container) over /data (may not be mounted)
      // Fallback chain: ATTACHMENT_STORAGE_PATH > /app/data (prod) > ./uploads (dev)
      this.basePath =
        process.env.NODE_ENV === 'production'
          ? '/app/data/uploads'
          : './uploads';
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
   * This method handles permission errors gracefully to prevent app crashes
   * when storage is not needed for core flows. Storage operations will fail
   * at runtime if the directory cannot be created, but the app will start.
   */
  private async ensureBaseDirectory(): Promise<void> {
    try {
      await mkdir(this.basePath, { recursive: true });
      this.storageAvailable = true;
      this.logger.log(`Storage directory initialized: ${this.basePath}`);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const errorCode = (error as NodeJS.ErrnoException).code;

      if (errorCode === 'EACCES') {
        // Permission denied - log warning but don't crash the app
        // Storage features will fail at runtime, but core app functionality continues
        this.logger.warn(
          `Storage directory permission denied: ${this.basePath}. ` +
            `File upload/download features will not work. ` +
            `To fix: mount a writable volume to ${this.basePath} or set ATTACHMENT_STORAGE_PATH env var.`,
        );
      } else if (errorCode === 'ENOENT') {
        // Parent directory doesn't exist - try to create it
        this.logger.warn(
          `Storage parent directory does not exist: ${this.basePath}. ` +
            `Attempting to create parent directories...`,
        );
        try {
          await mkdir(path.dirname(this.basePath), { recursive: true });
          await mkdir(this.basePath, { recursive: true });
          this.storageAvailable = true;
          this.logger.log(`Storage directory created: ${this.basePath}`);
        } catch (retryError) {
          this.logger.error(
            `Failed to create storage directory after retry: ${retryError}`,
          );
        }
      } else {
        this.logger.error(
          `Failed to create storage directory: ${errorMessage} (code: ${errorCode})`,
        );
      }
    }
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
