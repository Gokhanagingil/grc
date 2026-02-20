const express = require('express');
const db = require('../db');
const { authenticateToken, requireRole, logActivity } = require('../middleware/auth');
const aclService = require('../services/AclService');

const router = express.Router();

/**
 * Check and update overdue CAPAs
 */
async function updateOverdueCAPAs() {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    if (db.isPostgres()) {
      await db.run(
        `UPDATE capas SET status = 'overdue', updated_at = CURRENT_TIMESTAMP 
         WHERE status NOT IN ('implemented', 'overdue') 
         AND due_date < $1 
         AND (extended_due_date IS NULL OR extended_due_date < $1)`,
        [today]
      );
    } else {
      await db.run(
        `UPDATE capas SET status = 'overdue', updated_at = CURRENT_TIMESTAMP 
         WHERE status NOT IN ('implemented', 'overdue') 
         AND due_date < ? 
         AND (extended_due_date IS NULL OR extended_due_date < ?)`,
        [today, today]
      );
    }
  } catch (error) {
    console.error('Error updating overdue CAPAs:', error);
  }
}

/**
 * Get all CAPAs with filtering support
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    // Update overdue CAPAs first
    await updateOverdueCAPAs();

    const { page = 1, limit = 10, sort, finding_id, ...filterParams } = req.query;

    // Check read permission via ACL
    const canRead = await aclService.can(req.user, 'read', 'capas');
    if (!canRead.allowed) {
      return res.status(403).json({ 
        message: 'Access denied: You do not have permission to view CAPAs',
        error: 'FORBIDDEN'
      });
    }

    // Build WHERE clause
    const conditions = [];
    const params = [];
    let paramIndex = 1;

    if (finding_id) {
      conditions.push(`c.finding_id = ${db.isPostgres() ? `$${paramIndex++}` : '?'}`);
      params.push(finding_id);
    }
    if (filterParams.status) {
      conditions.push(`c.status = ${db.isPostgres() ? `$${paramIndex++}` : '?'}`);
      params.push(filterParams.status);
    }
    if (filterParams.type) {
      conditions.push(`c.type = ${db.isPostgres() ? `$${paramIndex++}` : '?'}`);
      params.push(filterParams.type);
    }
    if (filterParams.validation_status) {
      conditions.push(`c.validation_status = ${db.isPostgres() ? `$${paramIndex++}` : '?'}`);
      params.push(filterParams.validation_status);
    }
    if (filterParams.owner_id) {
      conditions.push(`c.owner_id = ${db.isPostgres() ? `$${paramIndex++}` : '?'}`);
      params.push(parseInt(filterParams.owner_id));
    }
    if (filterParams.search) {
      const searchParam = `%${filterParams.search}%`;
      conditions.push(`(c.title LIKE ${db.isPostgres() ? `$${paramIndex++}` : '?'} OR c.description LIKE ${db.isPostgres() ? `$${paramIndex++}` : '?'})`);
      params.push(searchParam, searchParam);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Build ORDER BY
    let orderBy = 'c.due_date ASC';
    if (sort) {
      const [field, direction] = sort.split(':');
      const validFields = ['title', 'status', 'type', 'due_date', 'created_at', 'updated_at'];
      if (validFields.includes(field)) {
        orderBy = `c.${field} ${direction?.toUpperCase() === 'DESC' ? 'DESC' : 'ASC'}`;
      }
    }

    // Pagination
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const limitPlaceholder = db.isPostgres() ? `$${paramIndex++}` : '?';
    const offsetPlaceholder = db.isPostgres() ? `$${paramIndex++}` : '?';
    params.push(parseInt(limit), offset);

    // Main query
    const query = `
      SELECT c.*, 
        f.title as finding_title, f.severity as finding_severity,
        u1.first_name as owner_first_name, u1.last_name as owner_last_name,
        u2.first_name as validated_by_first_name, u2.last_name as validated_by_last_name,
        u3.first_name as created_by_first_name, u3.last_name as created_by_last_name
      FROM capas c
      LEFT JOIN findings f ON c.finding_id = f.id
      LEFT JOIN users u1 ON c.owner_id = u1.id
      LEFT JOIN users u2 ON c.validated_by = u2.id
      LEFT JOIN users u3 ON c.created_by = u3.id
      ${whereClause}
      ORDER BY ${orderBy}
      LIMIT ${limitPlaceholder} OFFSET ${offsetPlaceholder}
    `;

    const capas = await db.all(query, params);

    // Count query
    const countParams = params.slice(0, -2);
    const countQuery = `SELECT COUNT(*) as total FROM capas c ${whereClause}`;
    const countResult = await db.get(countQuery, countParams);
    const total = countResult?.total || 0;

    // Apply ACL filtering
    const filteredCapas = await aclService.filterRecords(req.user, 'capas', capas);

    res.json({
      capas: filteredCapas,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching CAPAs:', error);
    res.status(500).json({ message: 'Failed to fetch CAPAs', error: error.message });
  }
});

/**
 * Get CAPA by ID
 */
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const placeholder = db.isPostgres() ? '$1' : '?';

    const capa = await db.get(
      `SELECT c.*, 
        f.title as finding_title, f.severity as finding_severity, f.audit_id,
        a.name as audit_name,
        u1.first_name as owner_first_name, u1.last_name as owner_last_name, u1.email as owner_email,
        u2.first_name as validated_by_first_name, u2.last_name as validated_by_last_name,
        u3.first_name as created_by_first_name, u3.last_name as created_by_last_name
       FROM capas c
       LEFT JOIN findings f ON c.finding_id = f.id
       LEFT JOIN audits a ON f.audit_id = a.id
       LEFT JOIN users u1 ON c.owner_id = u1.id
       LEFT JOIN users u2 ON c.validated_by = u2.id
       LEFT JOIN users u3 ON c.created_by = u3.id
       WHERE c.id = ${placeholder}`,
      [id]
    );

    if (!capa) {
      return res.status(404).json({ message: 'CAPA not found' });
    }

    // Check read permission via ACL
    const canRead = await aclService.can(req.user, 'read', 'capas', capa);
    if (!canRead.allowed) {
      return res.status(403).json({ 
        message: 'Access denied: You do not have permission to view this CAPA',
        error: 'FORBIDDEN'
      });
    }

    // Mask denied fields
    const maskedCapa = { ...capa };
    for (const field of canRead.maskedFields) {
      if (maskedCapa[field] !== undefined) {
        maskedCapa[field] = '***MASKED***';
      }
    }

    res.json(maskedCapa);
  } catch (error) {
    console.error('Error fetching CAPA:', error);
    res.status(500).json({ message: 'Failed to fetch CAPA', error: error.message });
  }
});

/**
 * Create new CAPA
 */
router.post('/', authenticateToken, logActivity('CREATE', 'capa'), async (req, res) => {
  try {
    // Check write permission via ACL
    const canWrite = await aclService.can(req.user, 'write', 'capas');
    if (!canWrite.allowed) {
      return res.status(403).json({ 
        message: 'Access denied: You do not have permission to create CAPAs',
        error: 'FORBIDDEN'
      });
    }

    const {
      finding_id,
      title,
      description,
      type = 'corrective',
      status = 'not_started',
      due_date,
      owner_id
    } = req.body;

    if (!finding_id) {
      return res.status(400).json({ message: 'Finding ID is required' });
    }
    if (!title) {
      return res.status(400).json({ message: 'Title is required' });
    }
    if (!due_date) {
      return res.status(400).json({ message: 'Due date is required' });
    }

    // Verify finding exists
    const placeholder = db.isPostgres() ? '$1' : '?';
    const finding = await db.get(`SELECT id, status FROM findings WHERE id = ${placeholder}`, [finding_id]);
    if (!finding) {
      return res.status(400).json({ message: 'Invalid finding ID' });
    }

    let result;
    if (db.isPostgres()) {
      result = await db.run(
        `INSERT INTO capas (finding_id, title, description, type, status, due_date, owner_id, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
        [finding_id, title, description, type, status, due_date, owner_id || req.user.id, req.user.id]
      );
    } else {
      result = await db.run(
        `INSERT INTO capas (finding_id, title, description, type, status, due_date, owner_id, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [finding_id, title, description, type, status, due_date, owner_id || req.user.id, req.user.id]
      );
    }

    res.status(201).json({
      message: 'CAPA created successfully',
      capa: {
        id: result.lastID,
        finding_id,
        title,
        description,
        type,
        status,
        due_date,
        owner_id: owner_id || req.user.id,
        created_by: req.user.id
      }
    });
  } catch (error) {
    console.error('Error creating CAPA:', error);
    res.status(500).json({ message: 'Failed to create CAPA', error: error.message });
  }
});

/**
 * Update CAPA
 */
router.put('/:id', authenticateToken, logActivity('UPDATE', 'capa'), async (req, res) => {
  try {
    const { id } = req.params;
    const placeholder = db.isPostgres() ? '$1' : '?';

    // Get current CAPA
    const capa = await db.get(`SELECT * FROM capas WHERE id = ${placeholder}`, [id]);
    if (!capa) {
      return res.status(404).json({ message: 'CAPA not found' });
    }

    // Check write permission via ACL
    const canWrite = await aclService.can(req.user, 'write', 'capas', capa);
    if (!canWrite.allowed) {
      return res.status(403).json({ 
        message: 'Access denied: You do not have permission to update this CAPA',
        error: 'FORBIDDEN'
      });
    }

    const {
      title,
      description,
      type,
      status,
      due_date,
      extended_due_date,
      extension_reason,
      owner_id
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
    addField('status', status);
    addField('due_date', due_date);
    addField('extended_due_date', extended_due_date);
    addField('extension_reason', extension_reason);
    addField('owner_id', owner_id);

    if (updateFields.length === 0) {
      return res.status(400).json({ message: 'No fields to update' });
    }

    updateFields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    const idPlaceholder = db.isPostgres() ? `$${paramIndex}` : '?';
    await db.run(
      `UPDATE capas SET ${updateFields.join(', ')} WHERE id = ${idPlaceholder}`,
      values
    );

    res.json({ message: 'CAPA updated successfully' });
  } catch (error) {
    console.error('Error updating CAPA:', error);
    res.status(500).json({ message: 'Failed to update CAPA', error: error.message });
  }
});

/**
 * Validate CAPA (only for validators)
 */
router.post('/:id/validate', authenticateToken, logActivity('VALIDATE', 'capa'), async (req, res) => {
  try {
    const { id } = req.params;
    const { validation_status, notes } = req.body;

    if (!validation_status || !['validated', 'rejected'].includes(validation_status)) {
      return res.status(400).json({ message: 'Valid validation_status (validated/rejected) is required' });
    }

    // Check validate permission
    const hasValidatePermission = await aclService.hasPermission(req.user, 'capas.validate');
    if (!hasValidatePermission && req.user.role !== 'admin' && req.user.role !== 'manager') {
      return res.status(403).json({ 
        message: 'Access denied: You do not have permission to validate CAPAs',
        error: 'FORBIDDEN'
      });
    }

    const placeholder = db.isPostgres() ? '$1' : '?';

    // Get current CAPA
    const capa = await db.get(`SELECT * FROM capas WHERE id = ${placeholder}`, [id]);
    if (!capa) {
      return res.status(404).json({ message: 'CAPA not found' });
    }

    // CAPA must be implemented before validation
    if (capa.status !== 'implemented') {
      return res.status(400).json({ 
        message: 'CAPA must be in "implemented" status before validation' 
      });
    }

    const today = new Date().toISOString().split('T')[0];

    if (db.isPostgres()) {
      await db.run(
        `UPDATE capas SET validation_status = $1, validation_date = $2, validated_by = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $4`,
        [validation_status, today, req.user.id, id]
      );
    } else {
      await db.run(
        `UPDATE capas SET validation_status = ?, validation_date = ?, validated_by = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [validation_status, today, req.user.id, id]
      );
    }

    res.json({ 
      message: `CAPA ${validation_status} successfully`,
      validation_status,
      validation_date: today,
      validated_by: req.user.id
    });
  } catch (error) {
    console.error('Error validating CAPA:', error);
    res.status(500).json({ message: 'Failed to validate CAPA', error: error.message });
  }
});

/**
 * Delete CAPA
 */
router.delete('/:id', authenticateToken, requireRole(['admin', 'manager']), logActivity('DELETE', 'capa'), async (req, res) => {
  try {
    const { id } = req.params;
    const placeholder = db.isPostgres() ? '$1' : '?';

    const capa = await db.get(`SELECT * FROM capas WHERE id = ${placeholder}`, [id]);
    if (!capa) {
      return res.status(404).json({ message: 'CAPA not found' });
    }

    // Check delete permission via ACL
    const canDelete = await aclService.can(req.user, 'delete', 'capas', capa);
    if (!canDelete.allowed) {
      return res.status(403).json({ 
        message: 'Access denied: You do not have permission to delete this CAPA',
        error: 'FORBIDDEN'
      });
    }

    // Cannot delete validated CAPAs
    if (capa.validation_status === 'validated') {
      return res.status(400).json({ 
        message: 'Cannot delete a validated CAPA' 
      });
    }

    await db.run(`DELETE FROM capas WHERE id = ${placeholder}`, [id]);

    res.json({ message: 'CAPA deleted successfully' });
  } catch (error) {
    console.error('Error deleting CAPA:', error);
    res.status(500).json({ message: 'Failed to delete CAPA', error: error.message });
  }
});

/**
 * Get ACL permissions for current user on a CAPA
 */
router.get('/:id/permissions', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const placeholder = db.isPostgres() ? '$1' : '?';

    const capa = await db.get(`SELECT * FROM capas WHERE id = ${placeholder}`, [id]);
    if (!capa) {
      return res.status(404).json({ message: 'CAPA not found' });
    }

    const [canRead, canWrite, canDelete, canValidate] = await Promise.all([
      aclService.can(req.user, 'read', 'capas', capa),
      aclService.can(req.user, 'write', 'capas', capa),
      aclService.can(req.user, 'delete', 'capas', capa),
      aclService.hasPermission(req.user, 'capas.validate')
    ]);

    res.json({
      read: canRead.allowed,
      write: canWrite.allowed,
      delete: canDelete.allowed,
      validate: canValidate || req.user.role === 'admin' || req.user.role === 'manager',
      maskedFields: canRead.maskedFields,
      deniedFields: canWrite.deniedFields
    });
  } catch (error) {
    console.error('Error fetching permissions:', error);
    res.status(500).json({ message: 'Failed to fetch permissions', error: error.message });
  }
});

module.exports = router;
