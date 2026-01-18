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

  constructor(private readonly configService: ConfigService) {
    this.basePath = this.configService.get<string>(
      'ATTACHMENT_STORAGE_PATH',
      './uploads',
    );
    void this.ensureBaseDirectory();
  }

  /**
   * Ensure the base storage directory exists
   */
  private async ensureBaseDirectory(): Promise<void> {
    try {
      await mkdir(this.basePath, { recursive: true });
      this.logger.log(`Storage directory initialized: ${this.basePath}`);
    } catch (error) {
      this.logger.error(`Failed to create storage directory: ${error}`);
    }
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
