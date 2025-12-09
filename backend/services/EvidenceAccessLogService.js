/**
 * Evidence Access Log Service
 * 
 * Provides audit trail logging for all evidence access operations.
 * Logs uploads, downloads, share creation, share downloads, and deletions.
 */

const db = require('../db');

/**
 * Access types for evidence operations
 */
const ACCESS_TYPES = {
  UPLOAD: 'upload',
  DOWNLOAD: 'download',
  SHARE_DOWNLOAD: 'share_download',
  DELETE: 'delete',
  SHARE_CREATE: 'share_create'
};

class EvidenceAccessLogService {
  /**
   * Log an evidence access event
   * @param {Object} params - Log parameters
   * @param {number} params.evidenceId - Evidence record ID
   * @param {string} params.accessType - Type of access (upload, download, share_download, delete, share_create)
   * @param {number} [params.userId] - User ID (null for anonymous share downloads)
   * @param {number} [params.shareId] - Share ID (for share-related access)
   * @param {string} [params.ipAddress] - Client IP address
   * @param {string} [params.userAgent] - Client user agent string
   * @returns {Promise<{id: number}>} Created log entry ID
   */
  async log({ evidenceId, accessType, userId = null, shareId = null, ipAddress = null, userAgent = null }) {
    if (!evidenceId) {
      throw new Error('evidenceId is required for access logging');
    }
    
    if (!Object.values(ACCESS_TYPES).includes(accessType)) {
      throw new Error(`Invalid access type: ${accessType}`);
    }

    if (db.isPostgres()) {
      const result = await db.run(
        `INSERT INTO evidence_access_logs (evidence_id, access_type, user_id, share_id, ip_address, user_agent)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [evidenceId, accessType, userId, shareId, ipAddress, userAgent]
      );
      return { id: result.lastID };
    } else {
      const result = await db.run(
        `INSERT INTO evidence_access_logs (evidence_id, access_type, user_id, share_id, ip_address, user_agent)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [evidenceId, accessType, userId, shareId, ipAddress, userAgent]
      );
      return { id: result.lastID };
    }
  }

  /**
   * Log an upload event
   * @param {number} evidenceId - Evidence record ID
   * @param {number} userId - User who uploaded
   * @param {Object} [requestInfo] - Request information
   * @param {string} [requestInfo.ipAddress] - Client IP
   * @param {string} [requestInfo.userAgent] - Client user agent
   */
  async logUpload(evidenceId, userId, requestInfo = {}) {
    return this.log({
      evidenceId,
      accessType: ACCESS_TYPES.UPLOAD,
      userId,
      ipAddress: requestInfo.ipAddress,
      userAgent: requestInfo.userAgent
    });
  }

  /**
   * Log a download event (authenticated)
   * @param {number} evidenceId - Evidence record ID
   * @param {number} userId - User who downloaded
   * @param {Object} [requestInfo] - Request information
   */
  async logDownload(evidenceId, userId, requestInfo = {}) {
    return this.log({
      evidenceId,
      accessType: ACCESS_TYPES.DOWNLOAD,
      userId,
      ipAddress: requestInfo.ipAddress,
      userAgent: requestInfo.userAgent
    });
  }

  /**
   * Log a share download event (may be anonymous)
   * @param {number} evidenceId - Evidence record ID
   * @param {number} shareId - Share record ID
   * @param {Object} [requestInfo] - Request information
   */
  async logShareDownload(evidenceId, shareId, requestInfo = {}) {
    return this.log({
      evidenceId,
      accessType: ACCESS_TYPES.SHARE_DOWNLOAD,
      shareId,
      ipAddress: requestInfo.ipAddress,
      userAgent: requestInfo.userAgent
    });
  }

  /**
   * Log a delete event
   * @param {number} evidenceId - Evidence record ID
   * @param {number} userId - User who deleted
   * @param {Object} [requestInfo] - Request information
   */
  async logDelete(evidenceId, userId, requestInfo = {}) {
    return this.log({
      evidenceId,
      accessType: ACCESS_TYPES.DELETE,
      userId,
      ipAddress: requestInfo.ipAddress,
      userAgent: requestInfo.userAgent
    });
  }

  /**
   * Log a share creation event
   * @param {number} evidenceId - Evidence record ID
   * @param {number} userId - User who created the share
   * @param {number} shareId - Created share ID
   * @param {Object} [requestInfo] - Request information
   */
  async logShareCreate(evidenceId, userId, shareId, requestInfo = {}) {
    return this.log({
      evidenceId,
      accessType: ACCESS_TYPES.SHARE_CREATE,
      userId,
      shareId,
      ipAddress: requestInfo.ipAddress,
      userAgent: requestInfo.userAgent
    });
  }

  /**
   * Get access logs for an evidence record
   * @param {number} evidenceId - Evidence record ID
   * @param {Object} [options] - Query options
   * @param {number} [options.limit=50] - Maximum number of logs to return
   * @param {number} [options.offset=0] - Offset for pagination
   * @returns {Promise<Array>} Access log entries
   */
  async getLogsForEvidence(evidenceId, options = {}) {
    const { limit = 50, offset = 0 } = options;
    
    if (db.isPostgres()) {
      return db.all(
        `SELECT eal.*, u.first_name, u.last_name, u.email
         FROM evidence_access_logs eal
         LEFT JOIN users u ON eal.user_id = u.id
         WHERE eal.evidence_id = $1
         ORDER BY eal.created_at DESC
         LIMIT $2 OFFSET $3`,
        [evidenceId, limit, offset]
      );
    } else {
      return db.all(
        `SELECT eal.*, u.first_name, u.last_name, u.email
         FROM evidence_access_logs eal
         LEFT JOIN users u ON eal.user_id = u.id
         WHERE eal.evidence_id = ?
         ORDER BY eal.created_at DESC
         LIMIT ? OFFSET ?`,
        [evidenceId, limit, offset]
      );
    }
  }

  /**
   * Get access logs for a user
   * @param {number} userId - User ID
   * @param {Object} [options] - Query options
   * @param {number} [options.limit=50] - Maximum number of logs to return
   * @param {number} [options.offset=0] - Offset for pagination
   * @returns {Promise<Array>} Access log entries
   */
  async getLogsForUser(userId, options = {}) {
    const { limit = 50, offset = 0 } = options;
    
    if (db.isPostgres()) {
      return db.all(
        `SELECT eal.*, e.title as evidence_title, e.file_name
         FROM evidence_access_logs eal
         LEFT JOIN evidence e ON eal.evidence_id = e.id
         WHERE eal.user_id = $1
         ORDER BY eal.created_at DESC
         LIMIT $2 OFFSET $3`,
        [userId, limit, offset]
      );
    } else {
      return db.all(
        `SELECT eal.*, e.title as evidence_title, e.file_name
         FROM evidence_access_logs eal
         LEFT JOIN evidence e ON eal.evidence_id = e.id
         WHERE eal.user_id = ?
         ORDER BY eal.created_at DESC
         LIMIT ? OFFSET ?`,
        [userId, limit, offset]
      );
    }
  }

  /**
   * Get download count for an evidence record
   * @param {number} evidenceId - Evidence record ID
   * @returns {Promise<{total: number, authenticated: number, shared: number}>}
   */
  async getDownloadStats(evidenceId) {
    const placeholder = db.isPostgres() ? '$1' : '?';
    
    const stats = await db.get(
      `SELECT 
         COUNT(*) FILTER (WHERE access_type IN ('download', 'share_download')) as total,
         COUNT(*) FILTER (WHERE access_type = 'download') as authenticated,
         COUNT(*) FILTER (WHERE access_type = 'share_download') as shared
       FROM evidence_access_logs
       WHERE evidence_id = ${placeholder}`,
      [evidenceId]
    );
    
    // SQLite doesn't support FILTER, so we need a different approach
    if (!db.isPostgres()) {
      const total = await db.get(
        `SELECT COUNT(*) as count FROM evidence_access_logs 
         WHERE evidence_id = ? AND access_type IN ('download', 'share_download')`,
        [evidenceId]
      );
      const authenticated = await db.get(
        `SELECT COUNT(*) as count FROM evidence_access_logs 
         WHERE evidence_id = ? AND access_type = 'download'`,
        [evidenceId]
      );
      const shared = await db.get(
        `SELECT COUNT(*) as count FROM evidence_access_logs 
         WHERE evidence_id = ? AND access_type = 'share_download'`,
        [evidenceId]
      );
      return {
        total: total?.count || 0,
        authenticated: authenticated?.count || 0,
        shared: shared?.count || 0
      };
    }
    
    return {
      total: stats?.total || 0,
      authenticated: stats?.authenticated || 0,
      shared: stats?.shared || 0
    };
  }
}

// Export singleton instance
const evidenceAccessLogService = new EvidenceAccessLogService();

module.exports = evidenceAccessLogService;
module.exports.EvidenceAccessLogService = EvidenceAccessLogService;
module.exports.ACCESS_TYPES = ACCESS_TYPES;
