/**
 * Evidence Share Service
 * 
 * Manages secure sharing links for evidence files.
 * Features:
 * - Cryptographically random tokens
 * - Expiration dates
 * - Download limits
 * - Token validation
 */

const crypto = require('crypto');
const db = require('../db');

/**
 * Generate a cryptographically secure random token
 * @param {number} [length=32] - Token length in bytes (will be hex-encoded to 2x length)
 * @returns {string} Random hex token
 */
function generateSecureToken(length = 32) {
  return crypto.randomBytes(length).toString('hex');
}

class EvidenceShareService {
  /**
   * Create a new share link for an evidence record
   * @param {Object} params - Share parameters
   * @param {number} params.evidenceId - Evidence record ID
   * @param {number} params.createdBy - User ID creating the share
   * @param {Date|string} params.expiresAt - Expiration date/time
   * @param {number} [params.maxDownloads] - Maximum number of downloads (null for unlimited)
   * @returns {Promise<{id: number, token: string, expiresAt: Date, shareUrl: string}>}
   */
  async createShare({ evidenceId, createdBy, expiresAt, maxDownloads = null }) {
    if (!evidenceId) {
      throw new Error('evidenceId is required');
    }
    if (!createdBy) {
      throw new Error('createdBy is required');
    }
    if (!expiresAt) {
      throw new Error('expiresAt is required');
    }

    // Validate expiration is in the future
    const expirationDate = new Date(expiresAt);
    if (expirationDate <= new Date()) {
      throw new Error('expiresAt must be in the future');
    }

    // Generate secure token
    const token = generateSecureToken(32);

    let result;
    if (db.isPostgres()) {
      result = await db.run(
        `INSERT INTO evidence_shares (evidence_id, token, expires_at, created_by, max_downloads)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [evidenceId, token, expirationDate.toISOString(), createdBy, maxDownloads]
      );
    } else {
      result = await db.run(
        `INSERT INTO evidence_shares (evidence_id, token, expires_at, created_by, max_downloads)
         VALUES (?, ?, ?, ?, ?)`,
        [evidenceId, token, expirationDate.toISOString(), createdBy, maxDownloads]
      );
    }

    return {
      id: result.lastID,
      token,
      expiresAt: expirationDate,
      shareUrl: `/api/grc/evidence/share/${token}`
    };
  }

  /**
   * Validate a share token and return the share record if valid
   * @param {string} token - Share token
   * @returns {Promise<{valid: boolean, share?: Object, evidence?: Object, error?: string}>}
   */
  async validateToken(token) {
    if (!token) {
      return { valid: false, error: 'Token is required' };
    }

    const placeholder = db.isPostgres() ? '$1' : '?';
    
    // Get share record with evidence details
    const share = await db.get(
      `SELECT es.*, e.id as evidence_id, e.title as evidence_title, e.file_name, 
              e.storage_path, e.mime_type, e.file_size, e.deleted_at as evidence_deleted_at
       FROM evidence_shares es
       JOIN evidence e ON es.evidence_id = e.id
       WHERE es.token = ${placeholder}`,
      [token]
    );

    if (!share) {
      return { valid: false, error: 'Invalid or expired share link' };
    }

    // Check if evidence is deleted
    if (share.evidence_deleted_at) {
      return { valid: false, error: 'Evidence has been deleted' };
    }

    // Check expiration
    const now = new Date();
    const expiresAt = new Date(share.expires_at);
    if (expiresAt <= now) {
      return { valid: false, error: 'Share link has expired' };
    }

    // Check download limit
    if (share.max_downloads !== null && share.download_count >= share.max_downloads) {
      return { valid: false, error: 'Download limit reached' };
    }

    // Check if file exists
    if (!share.storage_path) {
      return { valid: false, error: 'No file attached to this evidence' };
    }

    return {
      valid: true,
      share: {
        id: share.id,
        evidenceId: share.evidence_id,
        token: share.token,
        expiresAt: share.expires_at,
        createdBy: share.created_by,
        maxDownloads: share.max_downloads,
        downloadCount: share.download_count
      },
      evidence: {
        id: share.evidence_id,
        title: share.evidence_title,
        fileName: share.file_name,
        storagePath: share.storage_path,
        mimeType: share.mime_type,
        fileSize: share.file_size
      }
    };
  }

  /**
   * Increment the download count for a share
   * @param {number} shareId - Share record ID
   * @returns {Promise<void>}
   */
  async incrementDownloadCount(shareId) {
    const placeholder = db.isPostgres() ? '$1' : '?';
    await db.run(
      `UPDATE evidence_shares SET download_count = download_count + 1 WHERE id = ${placeholder}`,
      [shareId]
    );
  }

  /**
   * Get all shares for an evidence record
   * @param {number} evidenceId - Evidence record ID
   * @returns {Promise<Array>}
   */
  async getSharesForEvidence(evidenceId) {
    const placeholder = db.isPostgres() ? '$1' : '?';
    return db.all(
      `SELECT es.*, u.first_name, u.last_name, u.email
       FROM evidence_shares es
       LEFT JOIN users u ON es.created_by = u.id
       WHERE es.evidence_id = ${placeholder}
       ORDER BY es.created_at DESC`,
      [evidenceId]
    );
  }

  /**
   * Get a share by ID
   * @param {number} shareId - Share record ID
   * @returns {Promise<Object|null>}
   */
  async getShareById(shareId) {
    const placeholder = db.isPostgres() ? '$1' : '?';
    return db.get(
      `SELECT es.*, u.first_name, u.last_name, u.email
       FROM evidence_shares es
       LEFT JOIN users u ON es.created_by = u.id
       WHERE es.id = ${placeholder}`,
      [shareId]
    );
  }

  /**
   * Delete a share
   * @param {number} shareId - Share record ID
   * @returns {Promise<boolean>} True if deleted
   */
  async deleteShare(shareId) {
    const placeholder = db.isPostgres() ? '$1' : '?';
    const result = await db.run(
      `DELETE FROM evidence_shares WHERE id = ${placeholder}`,
      [shareId]
    );
    return result.rowCount > 0;
  }

  /**
   * Delete all expired shares (cleanup job)
   * @returns {Promise<number>} Number of deleted shares
   */
  async deleteExpiredShares() {
    const result = await db.run(
      `DELETE FROM evidence_shares WHERE expires_at < CURRENT_TIMESTAMP`
    );
    return result.rowCount || 0;
  }

  /**
   * Get share statistics for an evidence record
   * @param {number} evidenceId - Evidence record ID
   * @returns {Promise<{totalShares: number, activeShares: number, totalDownloads: number}>}
   */
  async getShareStats(evidenceId) {
    const placeholder = db.isPostgres() ? '$1' : '?';
    
    const stats = await db.get(
      `SELECT 
         COUNT(*) as total_shares,
         SUM(download_count) as total_downloads
       FROM evidence_shares
       WHERE evidence_id = ${placeholder}`,
      [evidenceId]
    );

    const activeShares = await db.get(
      `SELECT COUNT(*) as count
       FROM evidence_shares
       WHERE evidence_id = ${placeholder}
         AND expires_at > CURRENT_TIMESTAMP
         AND (max_downloads IS NULL OR download_count < max_downloads)`,
      [evidenceId]
    );

    return {
      totalShares: stats?.total_shares || 0,
      activeShares: activeShares?.count || 0,
      totalDownloads: stats?.total_downloads || 0
    };
  }
}

// Export singleton instance
const evidenceShareService = new EvidenceShareService();

module.exports = evidenceShareService;
module.exports.EvidenceShareService = EvidenceShareService;
module.exports.generateSecureToken = generateSecureToken;
