/**
 * Evidence Storage Module
 * 
 * Provides pluggable storage adapters for evidence files.
 * Currently supports local filesystem storage, with future support
 * for S3, Azure Blob, and MinIO.
 * 
 * Configuration:
 * - EVIDENCE_STORAGE_BACKEND: 'local' (default), 's3', 'azure', 'minio'
 * - EVIDENCE_STORAGE_PATH: Path for local storage (default: ./storage/evidence)
 */

const EvidenceStorageAdapter = require('./EvidenceStorageAdapter');
const LocalEvidenceStorageAdapter = require('./LocalEvidenceStorageAdapter');

// Storage backend configuration
const STORAGE_BACKEND = process.env.EVIDENCE_STORAGE_BACKEND || 'local';

/**
 * Create a storage adapter based on configuration
 * @param {Object} options - Adapter-specific options
 * @returns {EvidenceStorageAdapter} Configured storage adapter
 */
function createStorageAdapter(options = {}) {
  switch (STORAGE_BACKEND) {
    case 'local':
      return new LocalEvidenceStorageAdapter(options);
    
    case 's3':
      // Future: return new S3EvidenceStorageAdapter(options);
      throw new Error('S3 storage adapter not yet implemented');
    
    case 'azure':
      // Future: return new AzureEvidenceStorageAdapter(options);
      throw new Error('Azure storage adapter not yet implemented');
    
    case 'minio':
      // Future: return new MinIOEvidenceStorageAdapter(options);
      throw new Error('MinIO storage adapter not yet implemented');
    
    default:
      throw new Error(`Unknown storage backend: ${STORAGE_BACKEND}`);
  }
}

// Create singleton instance
let storageAdapterInstance = null;

/**
 * Get the singleton storage adapter instance
 * @returns {EvidenceStorageAdapter} Storage adapter instance
 */
function getStorageAdapter() {
  if (!storageAdapterInstance) {
    storageAdapterInstance = createStorageAdapter();
  }
  return storageAdapterInstance;
}

/**
 * Reset the storage adapter instance (useful for testing)
 */
function resetStorageAdapter() {
  storageAdapterInstance = null;
}

module.exports = {
  EvidenceStorageAdapter,
  LocalEvidenceStorageAdapter,
  createStorageAdapter,
  getStorageAdapter,
  resetStorageAdapter,
  STORAGE_BACKEND
};
