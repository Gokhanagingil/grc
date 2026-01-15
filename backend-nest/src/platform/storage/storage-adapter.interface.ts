import { Readable } from 'stream';

/**
 * Storage Adapter Interface
 *
 * Defines the contract for file storage operations.
 * Implementations can be swapped without changing the attachment service.
 *
 * Supported implementations:
 * - LocalFsAdapter: Local filesystem storage (dev/staging)
 * - S3Adapter: AWS S3 or MinIO storage (production)
 */
export interface StorageAdapter {
  /**
   * Store a file
   * @param data - File content as Buffer or Readable stream
   * @param key - Storage key (unique identifier for the file)
   * @param contentType - MIME type of the file
   * @returns Object containing the storage key
   */
  put(
    data: Buffer | Readable,
    key: string,
    contentType: string,
  ): Promise<{ key: string }>;

  /**
   * Retrieve a file as a readable stream
   * @param key - Storage key of the file
   * @returns Readable stream of the file content
   */
  getStream(key: string): Promise<Readable>;

  /**
   * Delete a file from storage
   * @param key - Storage key of the file
   */
  delete(key: string): Promise<void>;

  /**
   * Check if a file exists
   * @param key - Storage key of the file
   * @returns true if the file exists
   */
  exists(key: string): Promise<boolean>;

  /**
   * Get file metadata (size, last modified, etc.)
   * @param key - Storage key of the file
   * @returns File metadata or null if not found
   */
  getMetadata(key: string): Promise<StorageMetadata | null>;
}

/**
 * Storage Metadata
 * Information about a stored file
 */
export interface StorageMetadata {
  key: string;
  size: number;
  lastModified: Date;
  contentType?: string;
}

/**
 * Storage Adapter Token
 * Used for dependency injection
 */
export const STORAGE_ADAPTER = 'STORAGE_ADAPTER';
