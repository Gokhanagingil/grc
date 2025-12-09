/**
 * Evidence Storage Adapter Interface
 * 
 * Defines the contract for evidence file storage backends.
 * Implementations can support local filesystem, S3, Azure Blob, MinIO, etc.
 */

/**
 * @typedef {Object} SaveFileResult
 * @property {string} storagePath - The path/key where the file was stored
 * @property {string} checksum - SHA-256 hash of the file
 * @property {number} fileSize - Size of the file in bytes
 */

/**
 * @typedef {Object} SaveFileContext
 * @property {number} [evidenceId] - Evidence record ID
 * @property {number} [userId] - User who uploaded the file
 * @property {string} [tenantId] - Tenant ID for multi-tenant isolation
 */

/**
 * Abstract base class for evidence storage adapters
 * All storage backends must implement these methods
 */
class EvidenceStorageAdapter {
  /**
   * Get the storage backend type identifier
   * @returns {string} Backend type (e.g., 'local', 's3', 'azure', 'minio')
   */
  getBackendType() {
    throw new Error('Method not implemented: getBackendType()');
  }

  /**
   * Save a file to storage
   * @param {Buffer} fileBuffer - File content as buffer
   * @param {string} fileName - Original filename
   * @param {string} mimeType - MIME type of the file
   * @param {SaveFileContext} context - Additional context for storage
   * @returns {Promise<SaveFileResult>} Storage result with path, checksum, and size
   */
  async saveFile(fileBuffer, fileName, mimeType, context = {}) {
    throw new Error('Method not implemented: saveFile()');
  }

  /**
   * Get a readable stream for a file
   * @param {string} storagePath - Path/key of the file in storage
   * @returns {Promise<import('stream').Readable>} Readable stream of file content
   */
  async getFileStream(storagePath) {
    throw new Error('Method not implemented: getFileStream()');
  }

  /**
   * Delete a file from storage
   * @param {string} storagePath - Path/key of the file to delete
   * @returns {Promise<void>}
   */
  async deleteFile(storagePath) {
    throw new Error('Method not implemented: deleteFile()');
  }

  /**
   * Check if a file exists in storage
   * @param {string} storagePath - Path/key of the file
   * @returns {Promise<boolean>} True if file exists
   */
  async fileExists(storagePath) {
    throw new Error('Method not implemented: fileExists()');
  }

  /**
   * Get file metadata without downloading content
   * @param {string} storagePath - Path/key of the file
   * @returns {Promise<{size: number, lastModified: Date}|null>} File metadata or null if not found
   */
  async getFileMetadata(storagePath) {
    throw new Error('Method not implemented: getFileMetadata()');
  }
}

module.exports = EvidenceStorageAdapter;
