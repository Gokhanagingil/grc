const express = require('express');
const db = require('../db');
const { authenticateToken, logActivity } = require('../middleware/auth');
const aclService = require('../services/AclService');

const router = express.Router();

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

module.exports = router;
