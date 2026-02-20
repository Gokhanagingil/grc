const express = require('express');
const multer = require('multer');
const db = require('../db');
const { authenticateToken, logActivity } = require('../middleware/auth');
const aclService = require('../services/AclService');
const { getStorageAdapter } = require('../services/storage');
const evidenceAccessLogService = require('../services/EvidenceAccessLogService');
const evidenceShareService = require('../services/EvidenceShareService');

const router = express.Router();

// Configure multer for file uploads (memory storage for processing)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max file size
  },
  fileFilter: (req, file, cb) => {
    // Allow common document types
    const allowedMimes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'text/plain',
      'text/csv',
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'application/json',
      'application/xml',
      'text/xml',
      'application/zip',
      'application/x-zip-compressed',
    ];
    
    if (allowedMimes.includes(file.mimetype) || file.mimetype.startsWith('text/')) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} is not allowed`), false);
    }
  }
});

/**
 * Helper to get request info for logging
 */
function getRequestInfo(req) {
  return {
    ipAddress: req.ip || req.connection?.remoteAddress || null,
    userAgent: req.get('User-Agent') || null
  };
}

/**
 * Get all evidence with filtering support
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 10, sort, finding_id, audit_id, ...filterParams } = req.query;

    // Check read permission via ACL
    const canRead = await aclService.can(req.user, 'read', 'evidence');
    if (!canRead.allowed) {
      return res.status(403).json({ 
        message: 'Access denied: You do not have permission to view evidence',
        error: 'FORBIDDEN'
      });
    }

    // Build WHERE clause
    const conditions = [];
    const params = [];
    let paramIndex = 1;

    if (finding_id) {
      conditions.push(`e.finding_id = ${db.isPostgres() ? `$${paramIndex++}` : '?'}`);
      params.push(finding_id);
    }
    if (audit_id) {
      conditions.push(`e.audit_id = ${db.isPostgres() ? `$${paramIndex++}` : '?'}`);
      params.push(audit_id);
    }
    if (filterParams.type) {
      conditions.push(`e.type = ${db.isPostgres() ? `$${paramIndex++}` : '?'}`);
      params.push(filterParams.type);
    }
    if (filterParams.storage_type) {
      conditions.push(`e.storage_type = ${db.isPostgres() ? `$${paramIndex++}` : '?'}`);
      params.push(filterParams.storage_type);
    }
    if (filterParams.uploaded_by) {
      conditions.push(`e.uploaded_by = ${db.isPostgres() ? `$${paramIndex++}` : '?'}`);
      params.push(parseInt(filterParams.uploaded_by));
    }
    if (filterParams.search) {
      const searchParam = `%${filterParams.search}%`;
      conditions.push(`(e.title LIKE ${db.isPostgres() ? `$${paramIndex++}` : '?'} OR e.description LIKE ${db.isPostgres() ? `$${paramIndex++}` : '?'})`);
      params.push(searchParam, searchParam);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Build ORDER BY
    let orderBy = 'e.uploaded_at DESC';
    if (sort) {
      const [field, direction] = sort.split(':');
      const validFields = ['title', 'type', 'storage_type', 'uploaded_at', 'created_at'];
      if (validFields.includes(field)) {
        orderBy = `e.${field} ${direction?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC'}`;
      }
    }

    // Pagination
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const limitPlaceholder = db.isPostgres() ? `$${paramIndex++}` : '?';
    const offsetPlaceholder = db.isPostgres() ? `$${paramIndex++}` : '?';
    params.push(parseInt(limit), offset);

    // Main query
    const query = `
      SELECT e.*, 
        f.title as finding_title,
        a.name as audit_name,
        u.first_name as uploaded_by_first_name, u.last_name as uploaded_by_last_name
      FROM evidence e
      LEFT JOIN findings f ON e.finding_id = f.id
      LEFT JOIN audits a ON e.audit_id = a.id
      LEFT JOIN users u ON e.uploaded_by = u.id
      ${whereClause}
      ORDER BY ${orderBy}
      LIMIT ${limitPlaceholder} OFFSET ${offsetPlaceholder}
    `;

    const evidence = await db.all(query, params);

    // Count query
    const countParams = params.slice(0, -2);
    const countQuery = `SELECT COUNT(*) as total FROM evidence e ${whereClause}`;
    const countResult = await db.get(countQuery, countParams);
    const total = countResult?.total || 0;

    // Apply ACL filtering
    const filteredEvidence = await aclService.filterRecords(req.user, 'evidence', evidence);

    res.json({
      evidence: filteredEvidence,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching evidence:', error);
    res.status(500).json({ message: 'Failed to fetch evidence', error: error.message });
  }
});

/**
 * Get evidence by ID
 */
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const placeholder = db.isPostgres() ? '$1' : '?';

    const evidence = await db.get(
      `SELECT e.*, 
        f.title as finding_title, f.severity as finding_severity,
        a.name as audit_name,
        u.first_name as uploaded_by_first_name, u.last_name as uploaded_by_last_name, u.email as uploaded_by_email
       FROM evidence e
       LEFT JOIN findings f ON e.finding_id = f.id
       LEFT JOIN audits a ON e.audit_id = a.id
       LEFT JOIN users u ON e.uploaded_by = u.id
       WHERE e.id = ${placeholder}`,
      [id]
    );

    if (!evidence) {
      return res.status(404).json({ message: 'Evidence not found' });
    }

    // Check read permission via ACL
    const canRead = await aclService.can(req.user, 'read', 'evidence', evidence);
    if (!canRead.allowed) {
      return res.status(403).json({ 
        message: 'Access denied: You do not have permission to view this evidence',
        error: 'FORBIDDEN'
      });
    }

    // Mask denied fields
    const maskedEvidence = { ...evidence };
    for (const field of canRead.maskedFields) {
      if (maskedEvidence[field] !== undefined) {
        maskedEvidence[field] = '***MASKED***';
      }
    }

    res.json(maskedEvidence);
  } catch (error) {
    console.error('Error fetching evidence:', error);
    res.status(500).json({ message: 'Failed to fetch evidence', error: error.message });
  }
});

/**
 * Create new evidence
 */
router.post('/', authenticateToken, logActivity('CREATE', 'evidence'), async (req, res) => {
  try {
    // Check write permission via ACL
    const canWrite = await aclService.can(req.user, 'write', 'evidence');
    if (!canWrite.allowed) {
      return res.status(403).json({ 
        message: 'Access denied: You do not have permission to create evidence',
        error: 'FORBIDDEN'
      });
    }

    const {
      finding_id,
      audit_id,
      title,
      description,
      type = 'document',
      storage_type = 'reference',
      storage_ref,
      external_system,
      external_id
    } = req.body;

    if (!title) {
      return res.status(400).json({ message: 'Title is required' });
    }

    // At least one of finding_id or audit_id should be provided
    if (!finding_id && !audit_id) {
      return res.status(400).json({ message: 'Either finding_id or audit_id is required' });
    }

    // Validate storage_type requirements
    if (storage_type === 'link' && !storage_ref) {
      return res.status(400).json({ message: 'Storage reference (URL) is required for link type' });
    }
    if (storage_type === 'external' && (!external_system || !external_id)) {
      return res.status(400).json({ message: 'External system and ID are required for external type' });
    }

    const placeholder = db.isPostgres() ? '$1' : '?';

    // Verify finding exists if provided
    if (finding_id) {
      const finding = await db.get(`SELECT id FROM findings WHERE id = ${placeholder}`, [finding_id]);
      if (!finding) {
        return res.status(400).json({ message: 'Invalid finding ID' });
      }
    }

    // Verify audit exists if provided
    if (audit_id) {
      const audit = await db.get(`SELECT id FROM audits WHERE id = ${placeholder}`, [audit_id]);
      if (!audit) {
        return res.status(400).json({ message: 'Invalid audit ID' });
      }
    }

    let result;
    if (db.isPostgres()) {
      result = await db.run(
        `INSERT INTO evidence (finding_id, audit_id, title, description, type, storage_type, storage_ref, external_system, external_id, uploaded_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
        [finding_id, audit_id, title, description, type, storage_type, storage_ref, external_system, external_id, req.user.id]
      );
    } else {
      result = await db.run(
        `INSERT INTO evidence (finding_id, audit_id, title, description, type, storage_type, storage_ref, external_system, external_id, uploaded_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [finding_id, audit_id, title, description, type, storage_type, storage_ref, external_system, external_id, req.user.id]
      );
    }

    res.status(201).json({
      message: 'Evidence created successfully',
      evidence: {
        id: result.lastID,
        finding_id,
        audit_id,
        title,
        description,
        type,
        storage_type,
        storage_ref,
        external_system,
        external_id,
        uploaded_by: req.user.id
      }
    });
  } catch (error) {
    console.error('Error creating evidence:', error);
    res.status(500).json({ message: 'Failed to create evidence', error: error.message });
  }
});

/**
 * Update evidence
 */
router.put('/:id', authenticateToken, logActivity('UPDATE', 'evidence'), async (req, res) => {
  try {
    const { id } = req.params;
    const placeholder = db.isPostgres() ? '$1' : '?';

    // Get current evidence
    const evidence = await db.get(`SELECT * FROM evidence WHERE id = ${placeholder}`, [id]);
    if (!evidence) {
      return res.status(404).json({ message: 'Evidence not found' });
    }

    // Check write permission via ACL
    const canWrite = await aclService.can(req.user, 'write', 'evidence', evidence);
    if (!canWrite.allowed) {
      return res.status(403).json({ 
        message: 'Access denied: You do not have permission to update this evidence',
        error: 'FORBIDDEN'
      });
    }

    const {
      title,
      description,
      type,
      storage_type,
      storage_ref,
      external_system,
      external_id
    } = req.body;

    // Build update query
    const updateFields = [];
    const values = [];
    let paramIndex = 1;

    const addField = (fieldName, value) => {
      if (value !== undefined) {
        if (canWrite.deniedFields.includes(fieldName)) {
          return;
        }
        if (db.isPostgres()) {
          updateFields.push(`${fieldName} = $${paramIndex++}`);
        } else {
          updateFields.push(`${fieldName} = ?`);
        }
        values.push(value);
      }
    };

    addField('title', title);
    addField('description', description);
    addField('type', type);
    addField('storage_type', storage_type);
    addField('storage_ref', storage_ref);
    addField('external_system', external_system);
    addField('external_id', external_id);

    if (updateFields.length === 0) {
      return res.status(400).json({ message: 'No fields to update' });
    }

    updateFields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    const idPlaceholder = db.isPostgres() ? `$${paramIndex}` : '?';
    await db.run(
      `UPDATE evidence SET ${updateFields.join(', ')} WHERE id = ${idPlaceholder}`,
      values
    );

    res.json({ message: 'Evidence updated successfully' });
  } catch (error) {
    console.error('Error updating evidence:', error);
    res.status(500).json({ message: 'Failed to update evidence', error: error.message });
  }
});

/**
 * Delete evidence
 */
router.delete('/:id', authenticateToken, logActivity('DELETE', 'evidence'), async (req, res) => {
  try {
    const { id } = req.params;
    const placeholder = db.isPostgres() ? '$1' : '?';

    const evidence = await db.get(`SELECT * FROM evidence WHERE id = ${placeholder}`, [id]);
    if (!evidence) {
      return res.status(404).json({ message: 'Evidence not found' });
    }

    // Check delete permission via ACL
    const canDelete = await aclService.can(req.user, 'delete', 'evidence', evidence);
    if (!canDelete.allowed) {
      return res.status(403).json({ 
        message: 'Access denied: You do not have permission to delete this evidence',
        error: 'FORBIDDEN'
      });
    }

    await db.run(`DELETE FROM evidence WHERE id = ${placeholder}`, [id]);

    res.json({ message: 'Evidence deleted successfully' });
  } catch (error) {
    console.error('Error deleting evidence:', error);
    res.status(500).json({ message: 'Failed to delete evidence', error: error.message });
  }
});

/**
 * Get ACL permissions for current user on evidence
 */
router.get('/:id/permissions', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const placeholder = db.isPostgres() ? '$1' : '?';

    const evidence = await db.get(`SELECT * FROM evidence WHERE id = ${placeholder}`, [id]);
    if (!evidence) {
      return res.status(404).json({ message: 'Evidence not found' });
    }

    const [canRead, canWrite, canDelete] = await Promise.all([
      aclService.can(req.user, 'read', 'evidence', evidence),
      aclService.can(req.user, 'write', 'evidence', evidence),
      aclService.can(req.user, 'delete', 'evidence', evidence)
    ]);

    res.json({
      read: canRead.allowed,
      write: canWrite.allowed,
      delete: canDelete.allowed,
      maskedFields: canRead.maskedFields,
      deniedFields: canWrite.deniedFields
    });
  } catch (error) {
    console.error('Error fetching permissions:', error);
    res.status(500).json({ message: 'Failed to fetch permissions', error: error.message });
  }
});

/**
 * Upload file to existing evidence record
 * POST /:id/upload
 */
router.post('/:id/upload', authenticateToken, upload.single('file'), logActivity('UPLOAD', 'evidence'), async (req, res) => {
  try {
    const { id } = req.params;
    const placeholder = db.isPostgres() ? '$1' : '?';

    // Get evidence record
    const evidence = await db.get(`SELECT * FROM evidence WHERE id = ${placeholder}`, [id]);
    if (!evidence) {
      return res.status(404).json({ message: 'Evidence not found' });
    }

    // Check if evidence is soft-deleted
    if (evidence.deleted_at) {
      return res.status(400).json({ message: 'Cannot upload to deleted evidence' });
    }

    // Check write permission via ACL
    const canWrite = await aclService.can(req.user, 'write', 'evidence', evidence);
    if (!canWrite.allowed) {
      return res.status(403).json({ 
        message: 'Access denied: You do not have permission to upload to this evidence',
        error: 'FORBIDDEN'
      });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'No file provided' });
    }

    // Save file using storage adapter
    const storageAdapter = getStorageAdapter();
    const context = {
      evidenceId: id,
      userId: req.user.id,
      findingId: evidence.finding_id,
      auditId: evidence.audit_id
    };

    const { storagePath, checksum, fileSize } = await storageAdapter.saveFile(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype,
      context
    );

    // Update evidence record with file info
    if (db.isPostgres()) {
      await db.run(
        `UPDATE evidence SET 
          file_name = $1, 
          mime_type = $2, 
          file_size = $3, 
          storage_backend = $4, 
          storage_path = $5, 
          checksum = $6,
          updated_at = CURRENT_TIMESTAMP
         WHERE id = $7`,
        [req.file.originalname, req.file.mimetype, fileSize, storageAdapter.getBackendType(), storagePath, checksum, id]
      );
    } else {
      await db.run(
        `UPDATE evidence SET 
          file_name = ?, 
          mime_type = ?, 
          file_size = ?, 
          storage_backend = ?, 
          storage_path = ?, 
          checksum = ?,
          updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [req.file.originalname, req.file.mimetype, fileSize, storageAdapter.getBackendType(), storagePath, checksum, id]
      );
    }

    // Log upload event
    await evidenceAccessLogService.logUpload(id, req.user.id, getRequestInfo(req));

    res.json({
      message: 'File uploaded successfully',
      evidence: {
        id: parseInt(id),
        file_name: req.file.originalname,
        mime_type: req.file.mimetype,
        file_size: fileSize,
        storage_backend: storageAdapter.getBackendType(),
        checksum
      }
    });
  } catch (error) {
    console.error('Error uploading file:', error);
    res.status(500).json({ message: 'Failed to upload file', error: error.message });
  }
});

/**
 * Create evidence with file upload
 * POST /upload
 */
router.post('/upload', authenticateToken, upload.single('file'), logActivity('CREATE', 'evidence'), async (req, res) => {
  try {
    // Check write permission via ACL
    const canWrite = await aclService.can(req.user, 'write', 'evidence');
    if (!canWrite.allowed) {
      return res.status(403).json({ 
        message: 'Access denied: You do not have permission to create evidence',
        error: 'FORBIDDEN'
      });
    }

    const {
      finding_id,
      audit_id,
      title,
      description,
      type = 'document'
    } = req.body;

    if (!title) {
      return res.status(400).json({ message: 'Title is required' });
    }

    if (!finding_id && !audit_id) {
      return res.status(400).json({ message: 'Either finding_id or audit_id is required' });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'No file provided' });
    }

    const placeholder = db.isPostgres() ? '$1' : '?';

    // Verify finding exists if provided
    if (finding_id) {
      const finding = await db.get(`SELECT id FROM findings WHERE id = ${placeholder}`, [finding_id]);
      if (!finding) {
        return res.status(400).json({ message: 'Invalid finding ID' });
      }
    }

    // Verify audit exists if provided
    if (audit_id) {
      const audit = await db.get(`SELECT id FROM audits WHERE id = ${placeholder}`, [audit_id]);
      if (!audit) {
        return res.status(400).json({ message: 'Invalid audit ID' });
      }
    }

    // Save file using storage adapter
    const storageAdapter = getStorageAdapter();
    const context = {
      userId: req.user.id,
      findingId: finding_id,
      auditId: audit_id
    };

    const { storagePath, checksum, fileSize } = await storageAdapter.saveFile(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype,
      context
    );

    // Create evidence record with file info
    let result;
    if (db.isPostgres()) {
      result = await db.run(
        `INSERT INTO evidence (finding_id, audit_id, title, description, type, storage_type, file_name, mime_type, file_size, storage_backend, storage_path, checksum, uploaded_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING id`,
        [finding_id, audit_id, title, description, type, 'file', req.file.originalname, req.file.mimetype, fileSize, storageAdapter.getBackendType(), storagePath, checksum, req.user.id]
      );
    } else {
      result = await db.run(
        `INSERT INTO evidence (finding_id, audit_id, title, description, type, storage_type, file_name, mime_type, file_size, storage_backend, storage_path, checksum, uploaded_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [finding_id, audit_id, title, description, type, 'file', req.file.originalname, req.file.mimetype, fileSize, storageAdapter.getBackendType(), storagePath, checksum, req.user.id]
      );
    }

    const evidenceId = result.lastID;

    // Log upload event
    await evidenceAccessLogService.logUpload(evidenceId, req.user.id, getRequestInfo(req));

    res.status(201).json({
      message: 'Evidence created with file successfully',
      evidence: {
        id: evidenceId,
        finding_id,
        audit_id,
        title,
        description,
        type,
        storage_type: 'file',
        file_name: req.file.originalname,
        mime_type: req.file.mimetype,
        file_size: fileSize,
        storage_backend: storageAdapter.getBackendType(),
        checksum,
        uploaded_by: req.user.id
      }
    });
  } catch (error) {
    console.error('Error creating evidence with file:', error);
    res.status(500).json({ message: 'Failed to create evidence', error: error.message });
  }
});

/**
 * Download evidence file (authenticated)
 * GET /:id/download
 */
router.get('/:id/download', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const placeholder = db.isPostgres() ? '$1' : '?';

    const evidence = await db.get(`SELECT * FROM evidence WHERE id = ${placeholder}`, [id]);
    if (!evidence) {
      return res.status(404).json({ message: 'Evidence not found' });
    }

    // Check if evidence is soft-deleted
    if (evidence.deleted_at) {
      return res.status(404).json({ message: 'Evidence has been deleted' });
    }

    // Check read permission via ACL
    const canRead = await aclService.can(req.user, 'read', 'evidence', evidence);
    if (!canRead.allowed) {
      return res.status(403).json({ 
        message: 'Access denied: You do not have permission to download this evidence',
        error: 'FORBIDDEN'
      });
    }

    // Check if file exists
    if (!evidence.storage_path) {
      return res.status(404).json({ message: 'No file attached to this evidence' });
    }

    // Get file stream from storage adapter
    const storageAdapter = getStorageAdapter();
    const fileStream = storageAdapter.getFileStream(evidence.storage_path);

    // Log download event
    await evidenceAccessLogService.logDownload(id, req.user.id, getRequestInfo(req));

    // Set response headers
    res.setHeader('Content-Type', evidence.mime_type || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(evidence.file_name || 'download')}"`);
    if (evidence.file_size) {
      res.setHeader('Content-Length', evidence.file_size);
    }

    // Pipe file to response
    fileStream.pipe(res);

    fileStream.on('error', (error) => {
      console.error('Error streaming file:', error);
      if (!res.headersSent) {
        res.status(500).json({ message: 'Failed to download file', error: error.message });
      }
    });
  } catch (error) {
    console.error('Error downloading file:', error);
    res.status(500).json({ message: 'Failed to download file', error: error.message });
  }
});

/**
 * Soft delete evidence
 * DELETE /:id/soft
 */
router.delete('/:id/soft', authenticateToken, logActivity('SOFT_DELETE', 'evidence'), async (req, res) => {
  try {
    const { id } = req.params;
    const placeholder = db.isPostgres() ? '$1' : '?';

    const evidence = await db.get(`SELECT * FROM evidence WHERE id = ${placeholder}`, [id]);
    if (!evidence) {
      return res.status(404).json({ message: 'Evidence not found' });
    }

    // Check if already soft-deleted
    if (evidence.deleted_at) {
      return res.status(400).json({ message: 'Evidence is already deleted' });
    }

    // Check delete permission via ACL
    const canDelete = await aclService.can(req.user, 'delete', 'evidence', evidence);
    if (!canDelete.allowed) {
      return res.status(403).json({ 
        message: 'Access denied: You do not have permission to delete this evidence',
        error: 'FORBIDDEN'
      });
    }

    // Soft delete by setting deleted_at
    await db.run(
      `UPDATE evidence SET deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ${placeholder}`,
      [id]
    );

    // Log delete event
    await evidenceAccessLogService.logDelete(id, req.user.id, getRequestInfo(req));

    res.json({ message: 'Evidence soft deleted successfully' });
  } catch (error) {
    console.error('Error soft deleting evidence:', error);
    res.status(500).json({ message: 'Failed to delete evidence', error: error.message });
  }
});

/**
 * Restore soft-deleted evidence
 * POST /:id/restore
 */
router.post('/:id/restore', authenticateToken, logActivity('RESTORE', 'evidence'), async (req, res) => {
  try {
    const { id } = req.params;
    const placeholder = db.isPostgres() ? '$1' : '?';

    const evidence = await db.get(`SELECT * FROM evidence WHERE id = ${placeholder}`, [id]);
    if (!evidence) {
      return res.status(404).json({ message: 'Evidence not found' });
    }

    // Check if not soft-deleted
    if (!evidence.deleted_at) {
      return res.status(400).json({ message: 'Evidence is not deleted' });
    }

    // Check write permission via ACL
    const canWrite = await aclService.can(req.user, 'write', 'evidence', evidence);
    if (!canWrite.allowed) {
      return res.status(403).json({ 
        message: 'Access denied: You do not have permission to restore this evidence',
        error: 'FORBIDDEN'
      });
    }

    // Restore by clearing deleted_at
    await db.run(
      `UPDATE evidence SET deleted_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ${placeholder}`,
      [id]
    );

    res.json({ message: 'Evidence restored successfully' });
  } catch (error) {
    console.error('Error restoring evidence:', error);
    res.status(500).json({ message: 'Failed to restore evidence', error: error.message });
  }
});

/**
 * Create share link for evidence
 * POST /:id/share
 */
router.post('/:id/share', authenticateToken, logActivity('SHARE', 'evidence'), async (req, res) => {
  try {
    const { id } = req.params;
    const { expiresAt, maxDownloads } = req.body;
    const placeholder = db.isPostgres() ? '$1' : '?';

    const evidence = await db.get(`SELECT * FROM evidence WHERE id = ${placeholder}`, [id]);
    if (!evidence) {
      return res.status(404).json({ message: 'Evidence not found' });
    }

    // Check if evidence is soft-deleted
    if (evidence.deleted_at) {
      return res.status(400).json({ message: 'Cannot share deleted evidence' });
    }

    // Check if file exists
    if (!evidence.storage_path) {
      return res.status(400).json({ message: 'No file attached to this evidence' });
    }

    // Check read permission via ACL (sharing requires at least read access)
    const canRead = await aclService.can(req.user, 'read', 'evidence', evidence);
    if (!canRead.allowed) {
      return res.status(403).json({ 
        message: 'Access denied: You do not have permission to share this evidence',
        error: 'FORBIDDEN'
      });
    }

    if (!expiresAt) {
      return res.status(400).json({ message: 'expiresAt is required' });
    }

    // Create share link
    const share = await evidenceShareService.createShare({
      evidenceId: id,
      createdBy: req.user.id,
      expiresAt,
      maxDownloads: maxDownloads || null
    });

    // Log share creation
    await evidenceAccessLogService.logShareCreate(id, req.user.id, share.id, getRequestInfo(req));

    res.status(201).json({
      message: 'Share link created successfully',
      share: {
        id: share.id,
        token: share.token,
        shareUrl: share.shareUrl,
        expiresAt: share.expiresAt,
        maxDownloads: maxDownloads || null
      }
    });
  } catch (error) {
    console.error('Error creating share link:', error);
    res.status(500).json({ message: 'Failed to create share link', error: error.message });
  }
});

/**
 * Get shares for evidence
 * GET /:id/shares
 */
router.get('/:id/shares', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const placeholder = db.isPostgres() ? '$1' : '?';

    const evidence = await db.get(`SELECT * FROM evidence WHERE id = ${placeholder}`, [id]);
    if (!evidence) {
      return res.status(404).json({ message: 'Evidence not found' });
    }

    // Check read permission via ACL
    const canRead = await aclService.can(req.user, 'read', 'evidence', evidence);
    if (!canRead.allowed) {
      return res.status(403).json({ 
        message: 'Access denied: You do not have permission to view shares for this evidence',
        error: 'FORBIDDEN'
      });
    }

    const shares = await evidenceShareService.getSharesForEvidence(id);

    res.json({ shares });
  } catch (error) {
    console.error('Error fetching shares:', error);
    res.status(500).json({ message: 'Failed to fetch shares', error: error.message });
  }
});

/**
 * Download evidence via share token (no authentication required)
 * GET /share/:token
 */
router.get('/share/:token', async (req, res) => {
  try {
    const { token } = req.params;

    // Validate token
    const validation = await evidenceShareService.validateToken(token);
    if (!validation.valid) {
      return res.status(403).json({ message: validation.error });
    }

    const { share, evidence } = validation;

    // Get file stream from storage adapter
    const storageAdapter = getStorageAdapter();
    const fileStream = storageAdapter.getFileStream(evidence.storagePath);

    // Increment download count
    await evidenceShareService.incrementDownloadCount(share.id);

    // Log share download event
    await evidenceAccessLogService.logShareDownload(evidence.id, share.id, getRequestInfo(req));

    // Set response headers
    res.setHeader('Content-Type', evidence.mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(evidence.fileName || 'download')}"`);
    if (evidence.fileSize) {
      res.setHeader('Content-Length', evidence.fileSize);
    }

    // Pipe file to response
    fileStream.pipe(res);

    fileStream.on('error', (error) => {
      console.error('Error streaming file:', error);
      if (!res.headersSent) {
        res.status(500).json({ message: 'Failed to download file', error: error.message });
      }
    });
  } catch (error) {
    console.error('Error downloading via share link:', error);
    res.status(500).json({ message: 'Failed to download file', error: error.message });
  }
});

/**
 * Get access logs for evidence
 * GET /:id/access-logs
 */
router.get('/:id/access-logs', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { limit = 50, offset = 0 } = req.query;
    const placeholder = db.isPostgres() ? '$1' : '?';

    const evidence = await db.get(`SELECT * FROM evidence WHERE id = ${placeholder}`, [id]);
    if (!evidence) {
      return res.status(404).json({ message: 'Evidence not found' });
    }

    // Check read permission via ACL
    const canRead = await aclService.can(req.user, 'read', 'evidence', evidence);
    if (!canRead.allowed) {
      return res.status(403).json({ 
        message: 'Access denied: You do not have permission to view access logs for this evidence',
        error: 'FORBIDDEN'
      });
    }

    const logs = await evidenceAccessLogService.getLogsForEvidence(id, {
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.json({ logs });
  } catch (error) {
    console.error('Error fetching access logs:', error);
    res.status(500).json({ message: 'Failed to fetch access logs', error: error.message });
  }
});

/**
 * Get download statistics for evidence
 * GET /:id/stats
 */
router.get('/:id/stats', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const placeholder = db.isPostgres() ? '$1' : '?';

    const evidence = await db.get(`SELECT * FROM evidence WHERE id = ${placeholder}`, [id]);
    if (!evidence) {
      return res.status(404).json({ message: 'Evidence not found' });
    }

    // Check read permission via ACL
    const canRead = await aclService.can(req.user, 'read', 'evidence', evidence);
    if (!canRead.allowed) {
      return res.status(403).json({ 
        message: 'Access denied: You do not have permission to view statistics for this evidence',
        error: 'FORBIDDEN'
      });
    }

    const [downloadStats, shareStats] = await Promise.all([
      evidenceAccessLogService.getDownloadStats(id),
      evidenceShareService.getShareStats(id)
    ]);

    res.json({
      downloads: downloadStats,
      shares: shareStats
    });
  } catch (error) {
    console.error('Error fetching statistics:', error);
    res.status(500).json({ message: 'Failed to fetch statistics', error: error.message });
  }
});

module.exports = router;
