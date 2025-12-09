/**
 * Local Filesystem Evidence Storage Adapter
 * 
 * Stores evidence files on the local filesystem under:
 * storage/evidence/<year>/<month>/<uuid>_<sanitized_filename>
 * 
 * Features:
 * - Automatic directory creation
 * - SHA-256 checksum computation
 * - Path traversal protection
 * - Sanitized filenames
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const EvidenceStorageAdapter = require('./EvidenceStorageAdapter');

// Default storage root - can be overridden via environment variable
const DEFAULT_STORAGE_ROOT = process.env.EVIDENCE_STORAGE_PATH || path.join(process.cwd(), 'storage', 'evidence');

/**
 * Sanitize filename to prevent path traversal and invalid characters
 * @param {string} fileName - Original filename
 * @returns {string} Sanitized filename
 */
function sanitizeFileName(fileName) {
  if (!fileName) return 'unnamed';
  
  // Remove path separators and null bytes
  let sanitized = fileName
    .replace(/[/\\]/g, '_')
    .replace(/\0/g, '')
    .replace(/\.\./g, '_');
  
  // Remove leading dots (hidden files)
  sanitized = sanitized.replace(/^\.+/, '');
  
  // Limit length
  if (sanitized.length > 200) {
    const ext = path.extname(sanitized);
    const base = path.basename(sanitized, ext);
    sanitized = base.substring(0, 200 - ext.length) + ext;
  }
  
  return sanitized || 'unnamed';
}

/**
 * Compute SHA-256 checksum of a buffer
 * @param {Buffer} buffer - File content
 * @returns {string} Hex-encoded SHA-256 hash
 */
function computeChecksum(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

class LocalEvidenceStorageAdapter extends EvidenceStorageAdapter {
  /**
   * Create a new LocalEvidenceStorageAdapter
   * @param {Object} options - Configuration options
   * @param {string} [options.storageRoot] - Root directory for file storage
   */
  constructor(options = {}) {
    super();
    this.storageRoot = options.storageRoot || DEFAULT_STORAGE_ROOT;
    this._ensureStorageRoot();
  }

  /**
   * Ensure the storage root directory exists
   * @private
   */
  _ensureStorageRoot() {
    if (!fs.existsSync(this.storageRoot)) {
      fs.mkdirSync(this.storageRoot, { recursive: true });
    }
  }

  /**
   * Generate storage path for a new file
   * @param {string} fileName - Original filename
   * @returns {{relativePath: string, absolutePath: string, directory: string}}
   * @private
   */
  _generateStoragePath(fileName) {
    const now = new Date();
    const year = now.getFullYear().toString();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const uuid = uuidv4();
    const sanitizedName = sanitizeFileName(fileName);
    
    const relativePath = path.join(year, month, `${uuid}_${sanitizedName}`);
    const absolutePath = path.join(this.storageRoot, relativePath);
    const directory = path.dirname(absolutePath);
    
    return { relativePath, absolutePath, directory };
  }

  /**
   * Validate that a storage path is within the storage root (prevent path traversal)
   * @param {string} storagePath - Relative storage path
   * @returns {string} Validated absolute path
   * @throws {Error} If path traversal is detected
   * @private
   */
  _validateAndResolvePath(storagePath) {
    const absolutePath = path.resolve(this.storageRoot, storagePath);
    const normalizedRoot = path.resolve(this.storageRoot);
    
    if (!absolutePath.startsWith(normalizedRoot + path.sep) && absolutePath !== normalizedRoot) {
      throw new Error('Invalid storage path: path traversal detected');
    }
    
    return absolutePath;
  }

  /**
   * @inheritdoc
   */
  getBackendType() {
    return 'local';
  }

  /**
   * @inheritdoc
   */
  async saveFile(fileBuffer, fileName, mimeType, context = {}) {
    const { relativePath, absolutePath, directory } = this._generateStoragePath(fileName);
    
    // Ensure directory exists
    if (!fs.existsSync(directory)) {
      fs.mkdirSync(directory, { recursive: true });
    }
    
    // Compute checksum
    const checksum = computeChecksum(fileBuffer);
    const fileSize = fileBuffer.length;
    
    // Write file
    await fs.promises.writeFile(absolutePath, fileBuffer);
    
    return {
      storagePath: relativePath,
      checksum,
      fileSize
    };
  }

  /**
   * @inheritdoc
   */
  async getFileStream(storagePath) {
    const absolutePath = this._validateAndResolvePath(storagePath);
    
    if (!fs.existsSync(absolutePath)) {
      throw new Error(`File not found: ${storagePath}`);
    }
    
    return fs.createReadStream(absolutePath);
  }

  /**
   * @inheritdoc
   */
  async deleteFile(storagePath) {
    const absolutePath = this._validateAndResolvePath(storagePath);
    
    if (fs.existsSync(absolutePath)) {
      await fs.promises.unlink(absolutePath);
    }
  }

  /**
   * @inheritdoc
   */
  async fileExists(storagePath) {
    try {
      const absolutePath = this._validateAndResolvePath(storagePath);
      return fs.existsSync(absolutePath);
    } catch {
      return false;
    }
  }

  /**
   * @inheritdoc
   */
  async getFileMetadata(storagePath) {
    try {
      const absolutePath = this._validateAndResolvePath(storagePath);
      const stats = await fs.promises.stat(absolutePath);
      return {
        size: stats.size,
        lastModified: stats.mtime
      };
    } catch {
      return null;
    }
  }

  /**
   * Get the absolute path for a storage path (for debugging/admin purposes)
   * @param {string} storagePath - Relative storage path
   * @returns {string} Absolute filesystem path
   */
  getAbsolutePath(storagePath) {
    return this._validateAndResolvePath(storagePath);
  }
}

module.exports = LocalEvidenceStorageAdapter;
