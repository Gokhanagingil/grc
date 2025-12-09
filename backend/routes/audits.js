const express = require('express');
const db = require('../db');
const { authenticateToken, requireRole, logActivity } = require('../middleware/auth');
const aclService = require('../services/AclService');
const searchService = require('../services/SearchService');

const router = express.Router();

/**
 * Get all audits with Search DSL support
 * Supports filtering, sorting, and pagination via Search DSL
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 10, sort, ...filterParams } = req.query;

    // Check read permission via ACL
    const canRead = await aclService.can(req.user, 'read', 'audits');
    if (!canRead.allowed) {
      return res.status(403).json({ 
        message: 'Access denied: You do not have permission to view audits',
        error: 'FORBIDDEN'
      });
    }

    // Build filter from query params for simple filtering
    let filter = null;
    if (Object.keys(filterParams).length > 0) {
      const conditions = [];
      
      if (filterParams.status) {
        conditions.push({ field: 'status', operator: 'equals', value: filterParams.status });
      }
      if (filterParams.risk_level) {
        conditions.push({ field: 'risk_level', operator: 'equals', value: filterParams.risk_level });
      }
      if (filterParams.department) {
        conditions.push({ field: 'department', operator: 'equals', value: filterParams.department });
      }
      if (filterParams.audit_type) {
        conditions.push({ field: 'audit_type', operator: 'equals', value: filterParams.audit_type });
      }
      if (filterParams.owner_id) {
        conditions.push({ field: 'owner_id', operator: 'equals', value: parseInt(filterParams.owner_id) });
      }
      if (filterParams.lead_auditor_id) {
        conditions.push({ field: 'lead_auditor_id', operator: 'equals', value: parseInt(filterParams.lead_auditor_id) });
      }
      if (filterParams.search) {
        conditions.push({
          or: [
            { field: 'name', operator: 'contains', value: filterParams.search },
            { field: 'description', operator: 'contains', value: filterParams.search }
          ]
        });
      }

      if (conditions.length === 1) {
        filter = conditions[0];
      } else if (conditions.length > 1) {
        filter = { and: conditions };
      }
    }

    // Parse sort parameter
    let sortConfig = null;
    if (sort) {
      const [field, direction] = sort.split(':');
      sortConfig = { field, direction: direction || 'DESC' };
    }

    // Use SearchService for querying
    const query = {
      filter,
      sort: sortConfig,
      page: parseInt(page),
      limit: parseInt(limit)
    };

    const result = await searchService.search('audits', query, req.user);

    res.json({
      audits: result.records,
      pagination: result.pagination
    });
  } catch (error) {
    console.error('Error fetching audits:', error);
    res.status(500).json({ message: 'Failed to fetch audits', error: error.message });
  }
});

/**
 * Search audits with full DSL support (POST for complex queries)
 */
router.post('/search', authenticateToken, async (req, res) => {
  try {
    // Check read permission via ACL
    const canRead = await aclService.can(req.user, 'read', 'audits');
    if (!canRead.allowed) {
      return res.status(403).json({ 
        message: 'Access denied: You do not have permission to search audits',
        error: 'FORBIDDEN'
      });
    }

    const { filter, sort, page = 1, limit = 10 } = req.body;

    // Validate query
    const validation = searchService.validateQuery({ filter, sort, page, limit });
    if (!validation.valid) {
      return res.status(400).json({ 
        message: 'Invalid search query',
        errors: validation.errors 
      });
    }

    const result = await searchService.search('audits', { filter, sort, page, limit }, req.user);

    res.json({
      audits: result.records,
      pagination: result.pagination
    });
  } catch (error) {
    console.error('Error searching audits:', error);
    res.status(500).json({ message: 'Failed to search audits', error: error.message });
  }
});

/**
 * Get audit field metadata for filter dropdowns
 */
router.get('/metadata', authenticateToken, async (req, res) => {
  try {
    const metadata = searchService.getFieldMetadata('audits');
    res.json(metadata);
  } catch (error) {
    console.error('Error fetching audit metadata:', error);
    res.status(500).json({ message: 'Failed to fetch metadata', error: error.message });
  }
});

/**
 * Get distinct values for a field (for filter dropdowns)
 */
router.get('/distinct/:field', authenticateToken, async (req, res) => {
  try {
    const { field } = req.params;
    const values = await searchService.getDistinctValues('audits', field);
    res.json(values);
  } catch (error) {
    console.error('Error fetching distinct values:', error);
    res.status(500).json({ message: 'Failed to fetch distinct values', error: error.message });
  }
});

/**
 * Get audit statistics
 */
router.get('/statistics', authenticateToken, async (req, res) => {
  try {
    const queries = [
      'SELECT COUNT(*) as total FROM audits',
      "SELECT COUNT(*) as planned FROM audits WHERE status = 'planned'",
      "SELECT COUNT(*) as in_progress FROM audits WHERE status = 'in_progress'",
      "SELECT COUNT(*) as completed FROM audits WHERE status = 'completed'",
      "SELECT COUNT(*) as closed FROM audits WHERE status = 'closed'",
      "SELECT COUNT(*) as high_risk FROM audits WHERE risk_level IN ('high', 'critical')"
    ];

    const results = await Promise.all(queries.map(query => db.get(query)));

    res.json({
      total: results[0].total,
      planned: results[1].planned,
      in_progress: results[2].in_progress,
      completed: results[3].completed,
      closed: results[4].closed,
      high_risk: results[5].high_risk
    });
  } catch (error) {
    console.error('Error fetching audit statistics:', error);
    res.status(500).json({ message: 'Failed to fetch statistics', error: error.message });
  }
});

/**
 * Get audit by ID
 */
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const audit = await db.get(
      `SELECT a.*, 
       u1.first_name as owner_first_name, u1.last_name as owner_last_name, u1.email as owner_email,
       u2.first_name as lead_auditor_first_name, u2.last_name as lead_auditor_last_name, u2.email as lead_auditor_email
       FROM audits a 
       LEFT JOIN users u1 ON a.owner_id = u1.id 
       LEFT JOIN users u2 ON a.lead_auditor_id = u2.id 
       WHERE a.id = ${db.isPostgres() ? '$1' : '?'}`,
      [id]
    );

    if (!audit) {
      return res.status(404).json({ message: 'Audit not found' });
    }

    // Check read permission via ACL
    const canRead = await aclService.can(req.user, 'read', 'audits', audit);
    if (!canRead.allowed) {
      return res.status(403).json({ 
        message: 'Access denied: You do not have permission to view this audit',
        error: 'FORBIDDEN'
      });
    }

    // Mask denied fields
    const maskedAudit = { ...audit };
    for (const field of canRead.maskedFields) {
      if (maskedAudit[field] !== undefined) {
        maskedAudit[field] = '***MASKED***';
      }
    }

    res.json(maskedAudit);
  } catch (error) {
    console.error('Error fetching audit:', error);
    res.status(500).json({ message: 'Failed to fetch audit', error: error.message });
  }
});

/**
 * Create new audit
 */
router.post('/', authenticateToken, logActivity('CREATE', 'audit'), async (req, res) => {
  try {
    // Check write permission via ACL
    const canWrite = await aclService.can(req.user, 'write', 'audits');
    if (!canWrite.allowed) {
      return res.status(403).json({ 
        message: 'Access denied: You do not have permission to create audits',
        error: 'FORBIDDEN'
      });
    }

    const {
      name,
      description,
      audit_type = 'internal',
      status = 'planned',
      risk_level = 'medium',
      department,
      lead_auditor_id,
      planned_start_date,
      planned_end_date,
      scope,
      objectives,
      methodology
    } = req.body;

    if (!name) {
      return res.status(400).json({ message: 'Name is required' });
    }

    const placeholder = db.isPostgres() 
      ? '($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)'
      : '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';

    const result = await db.run(
      `INSERT INTO audits (name, description, audit_type, status, risk_level, department, 
                          owner_id, lead_auditor_id, planned_start_date, planned_end_date, 
                          scope, objectives, methodology)
       VALUES ${placeholder}`,
      [name, description, audit_type, status, risk_level, department,
       req.user.id, lead_auditor_id, planned_start_date, planned_end_date,
       scope, objectives, methodology]
    );

    res.status(201).json({
      message: 'Audit created successfully',
      audit: {
        id: result.lastID,
        name,
        description,
        audit_type,
        status,
        risk_level,
        department,
        owner_id: req.user.id,
        lead_auditor_id,
        planned_start_date,
        planned_end_date,
        scope,
        objectives,
        methodology
      }
    });
  } catch (error) {
    console.error('Error creating audit:', error);
    res.status(500).json({ message: 'Failed to create audit', error: error.message });
  }
});

/**
 * Update audit
 */
router.put('/:id', authenticateToken, logActivity('UPDATE', 'audit'), async (req, res) => {
  try {
    const { id } = req.params;

    // Get current audit
    const audit = await db.get(
      `SELECT * FROM audits WHERE id = ${db.isPostgres() ? '$1' : '?'}`,
      [id]
    );

    if (!audit) {
      return res.status(404).json({ message: 'Audit not found' });
    }

    // Check write permission via ACL
    const canWrite = await aclService.can(req.user, 'write', 'audits', audit);
    if (!canWrite.allowed) {
      return res.status(403).json({ 
        message: 'Access denied: You do not have permission to update this audit',
        error: 'FORBIDDEN'
      });
    }

    const {
      name,
      description,
      audit_type,
      status,
      risk_level,
      department,
      lead_auditor_id,
      planned_start_date,
      planned_end_date,
      actual_start_date,
      actual_end_date,
      scope,
      objectives,
      methodology,
      findings_summary,
      recommendations,
      conclusion
    } = req.body;

    const updateFields = [];
    const values = [];
    let paramIndex = 1;

    const addField = (fieldName, value) => {
      if (value !== undefined) {
        // Check if field is denied
        if (canWrite.deniedFields.includes(fieldName)) {
          return; // Skip denied fields
        }
        if (db.isPostgres()) {
          updateFields.push(`${fieldName} = $${paramIndex++}`);
        } else {
          updateFields.push(`${fieldName} = ?`);
        }
        values.push(value);
      }
    };

    addField('name', name);
    addField('description', description);
    addField('audit_type', audit_type);
    addField('status', status);
    addField('risk_level', risk_level);
    addField('department', department);
    addField('lead_auditor_id', lead_auditor_id);
    addField('planned_start_date', planned_start_date);
    addField('planned_end_date', planned_end_date);
    addField('actual_start_date', actual_start_date);
    addField('actual_end_date', actual_end_date);
    addField('scope', scope);
    addField('objectives', objectives);
    addField('methodology', methodology);
    addField('findings_summary', findings_summary);
    addField('recommendations', recommendations);
    addField('conclusion', conclusion);

    if (updateFields.length === 0) {
      return res.status(400).json({ message: 'No fields to update' });
    }

    updateFields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    const idPlaceholder = db.isPostgres() ? `$${paramIndex}` : '?';
    await db.run(
      `UPDATE audits SET ${updateFields.join(', ')} WHERE id = ${idPlaceholder}`,
      values
    );

    res.json({ message: 'Audit updated successfully' });
  } catch (error) {
    console.error('Error updating audit:', error);
    res.status(500).json({ message: 'Failed to update audit', error: error.message });
  }
});

/**
 * Delete audit
 */
router.delete('/:id', authenticateToken, requireRole(['admin', 'manager']), logActivity('DELETE', 'audit'), async (req, res) => {
  try {
    const { id } = req.params;

    // Get current audit
    const audit = await db.get(
      `SELECT * FROM audits WHERE id = ${db.isPostgres() ? '$1' : '?'}`,
      [id]
    );

    if (!audit) {
      return res.status(404).json({ message: 'Audit not found' });
    }

    // Check delete permission via ACL
    const canDelete = await aclService.can(req.user, 'delete', 'audits', audit);
    if (!canDelete.allowed) {
      return res.status(403).json({ 
        message: 'Access denied: You do not have permission to delete this audit',
        error: 'FORBIDDEN'
      });
    }

    await db.run(
      `DELETE FROM audits WHERE id = ${db.isPostgres() ? '$1' : '?'}`,
      [id]
    );

    res.json({ message: 'Audit deleted successfully' });
  } catch (error) {
    console.error('Error deleting audit:', error);
    res.status(500).json({ message: 'Failed to delete audit', error: error.message });
  }
});

/**
 * Get ACL permissions for current user on audits
 */
router.get('/:id/permissions', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const audit = await db.get(
      `SELECT * FROM audits WHERE id = ${db.isPostgres() ? '$1' : '?'}`,
      [id]
    );

    if (!audit) {
      return res.status(404).json({ message: 'Audit not found' });
    }

    const [canRead, canWrite, canDelete] = await Promise.all([
      aclService.can(req.user, 'read', 'audits', audit),
      aclService.can(req.user, 'write', 'audits', audit),
      aclService.can(req.user, 'delete', 'audits', audit)
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
 * Check if user can create audits
 */
router.get('/can/create', authenticateToken, async (req, res) => {
  try {
    const canCreate = await aclService.can(req.user, 'write', 'audits');
    res.json({ allowed: canCreate.allowed });
  } catch (error) {
    console.error('Error checking create permission:', error);
    res.status(500).json({ message: 'Failed to check permission', error: error.message });
  }
});

module.exports = router;
