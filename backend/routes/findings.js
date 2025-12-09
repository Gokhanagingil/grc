const express = require('express');
const db = require('../db');
const { authenticateToken, requireRole, logActivity } = require('../middleware/auth');
const aclService = require('../services/AclService');
const searchService = require('../services/SearchService');

const router = express.Router();

// Valid status transitions for findings
const VALID_STATUS_TRANSITIONS = {
  draft: ['under_discussion'],
  under_discussion: ['draft', 'action_agreed'],
  action_agreed: ['in_progress'],
  in_progress: ['pending_validation', 'action_agreed'],
  pending_validation: ['closed', 'in_progress'],
  closed: ['reopened'],
  reopened: ['under_discussion', 'in_progress']
};

/**
 * Check if a status transition is valid
 */
function isValidStatusTransition(currentStatus, newStatus) {
  if (currentStatus === newStatus) return true;
  const validTransitions = VALID_STATUS_TRANSITIONS[currentStatus] || [];
  return validTransitions.includes(newStatus);
}

/**
 * Check if finding can move to action_agreed (requires at least one CAPA)
 */
async function canMoveToActionAgreed(findingId) {
  const placeholder = db.isPostgres() ? '$1' : '?';
  const capa = await db.get(
    `SELECT id FROM capas WHERE finding_id = ${placeholder} LIMIT 1`,
    [findingId]
  );
  return !!capa;
}

/**
 * Check if finding can be closed (all CAPAs must be validated)
 */
async function canCloseFinding(findingId) {
  const placeholder = db.isPostgres() ? '$1' : '?';
  
  // Check if there are any CAPAs
  const capas = await db.all(
    `SELECT id, validation_status FROM capas WHERE finding_id = ${placeholder}`,
    [findingId]
  );
  
  if (capas.length === 0) {
    return { allowed: false, reason: 'Finding must have at least one CAPA before closing' };
  }
  
  // Check if all CAPAs are validated
  const unvalidated = capas.filter(c => c.validation_status !== 'validated');
  if (unvalidated.length > 0) {
    return { allowed: false, reason: `${unvalidated.length} CAPA(s) are not yet validated` };
  }
  
  return { allowed: true };
}

/**
 * Get all findings with Search DSL support
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 10, sort, audit_id, ...filterParams } = req.query;

    // Check read permission via ACL
    const canRead = await aclService.can(req.user, 'read', 'findings');
    if (!canRead.allowed) {
      return res.status(403).json({ 
        message: 'Access denied: You do not have permission to view findings',
        error: 'FORBIDDEN'
      });
    }

    // Build WHERE clause
    const conditions = [];
    const params = [];
    let paramIndex = 1;

    if (audit_id) {
      conditions.push(`f.audit_id = ${db.isPostgres() ? `$${paramIndex++}` : '?'}`);
      params.push(audit_id);
    }
    if (filterParams.status) {
      conditions.push(`f.status = ${db.isPostgres() ? `$${paramIndex++}` : '?'}`);
      params.push(filterParams.status);
    }
    if (filterParams.severity) {
      conditions.push(`f.severity = ${db.isPostgres() ? `$${paramIndex++}` : '?'}`);
      params.push(filterParams.severity);
    }
    if (filterParams.owner_id) {
      conditions.push(`f.owner_id = ${db.isPostgres() ? `$${paramIndex++}` : '?'}`);
      params.push(parseInt(filterParams.owner_id));
    }
    if (filterParams.search) {
      const searchParam = `%${filterParams.search}%`;
      conditions.push(`(f.title LIKE ${db.isPostgres() ? `$${paramIndex++}` : '?'} OR f.description LIKE ${db.isPostgres() ? `$${paramIndex++}` : '?'})`);
      params.push(searchParam, searchParam);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Build ORDER BY
    let orderBy = 'f.created_at DESC';
    if (sort) {
      const [field, direction] = sort.split(':');
      const validFields = ['title', 'status', 'severity', 'created_at', 'updated_at'];
      if (validFields.includes(field)) {
        orderBy = `f.${field} ${direction?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC'}`;
      }
    }

    // Pagination
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const limitPlaceholder = db.isPostgres() ? `$${paramIndex++}` : '?';
    const offsetPlaceholder = db.isPostgres() ? `$${paramIndex++}` : '?';
    params.push(parseInt(limit), offset);

    // Main query
    const query = `
      SELECT f.*, 
        a.name as audit_name,
        u1.first_name as owner_first_name, u1.last_name as owner_last_name,
        u2.first_name as created_by_first_name, u2.last_name as created_by_last_name,
        (SELECT COUNT(*) FROM capas WHERE finding_id = f.id) as capa_count,
        (SELECT COUNT(*) FROM evidence WHERE finding_id = f.id) as evidence_count
      FROM findings f
      LEFT JOIN audits a ON f.audit_id = a.id
      LEFT JOIN users u1 ON f.owner_id = u1.id
      LEFT JOIN users u2 ON f.created_by = u2.id
      ${whereClause}
      ORDER BY ${orderBy}
      LIMIT ${limitPlaceholder} OFFSET ${offsetPlaceholder}
    `;

    const findings = await db.all(query, params);

    // Count query
    const countParams = params.slice(0, -2);
    const countQuery = `SELECT COUNT(*) as total FROM findings f ${whereClause}`;
    const countResult = await db.get(countQuery, countParams);
    const total = countResult?.total || 0;

    // Apply ACL filtering
    const filteredFindings = await aclService.filterRecords(req.user, 'findings', findings);

    res.json({
      findings: filteredFindings,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching findings:', error);
    res.status(500).json({ message: 'Failed to fetch findings', error: error.message });
  }
});

/**
 * Get finding by ID
 */
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const placeholder = db.isPostgres() ? '$1' : '?';

    const finding = await db.get(
      `SELECT f.*, 
        a.name as audit_name,
        u1.first_name as owner_first_name, u1.last_name as owner_last_name, u1.email as owner_email,
        u2.first_name as created_by_first_name, u2.last_name as created_by_last_name
       FROM findings f
       LEFT JOIN audits a ON f.audit_id = a.id
       LEFT JOIN users u1 ON f.owner_id = u1.id
       LEFT JOIN users u2 ON f.created_by = u2.id
       WHERE f.id = ${placeholder}`,
      [id]
    );

    if (!finding) {
      return res.status(404).json({ message: 'Finding not found' });
    }

    // Check read permission via ACL
    const canRead = await aclService.can(req.user, 'read', 'findings', finding);
    if (!canRead.allowed) {
      return res.status(403).json({ 
        message: 'Access denied: You do not have permission to view this finding',
        error: 'FORBIDDEN'
      });
    }

    // Mask denied fields
    const maskedFinding = { ...finding };
    for (const field of canRead.maskedFields) {
      if (maskedFinding[field] !== undefined) {
        maskedFinding[field] = '***MASKED***';
      }
    }

    // Get related data
    const [capas, evidence, risks, requirements, itsmLinks] = await Promise.all([
      db.all(`SELECT * FROM capas WHERE finding_id = ${placeholder} ORDER BY created_at DESC`, [id]),
      db.all(`SELECT * FROM evidence WHERE finding_id = ${placeholder} ORDER BY uploaded_at DESC`, [id]),
      db.all(`SELECT fr.*, r.title as risk_title, r.severity as risk_severity, r.status as risk_status 
              FROM finding_risks fr 
              LEFT JOIN risks r ON fr.risk_id = r.id 
              WHERE fr.finding_id = ${placeholder}`, [id]),
      db.all(`SELECT frq.*, cr.title as requirement_title, cr.regulation 
              FROM finding_requirements frq 
              LEFT JOIN compliance_requirements cr ON frq.requirement_id = cr.id 
              WHERE frq.finding_id = ${placeholder}`, [id]),
      db.all(`SELECT * FROM finding_itsm_links WHERE finding_id = ${placeholder}`, [id])
    ]);

    res.json({
      ...maskedFinding,
      capas,
      evidence,
      related_risks: risks,
      breached_requirements: requirements,
      itsm_links: itsmLinks
    });
  } catch (error) {
    console.error('Error fetching finding:', error);
    res.status(500).json({ message: 'Failed to fetch finding', error: error.message });
  }
});

/**
 * Create new finding
 */
router.post('/', authenticateToken, logActivity('CREATE', 'finding'), async (req, res) => {
  try {
    // Check write permission via ACL
    const canWrite = await aclService.can(req.user, 'write', 'findings');
    if (!canWrite.allowed) {
      return res.status(403).json({ 
        message: 'Access denied: You do not have permission to create findings',
        error: 'FORBIDDEN'
      });
    }

    const {
      audit_id,
      title,
      description,
      severity = 'medium',
      status = 'draft',
      root_cause,
      recommendation,
      management_response,
      owner_id
    } = req.body;

    if (!audit_id) {
      return res.status(400).json({ message: 'Audit ID is required' });
    }
    if (!title) {
      return res.status(400).json({ message: 'Title is required' });
    }

    // Verify audit exists
    const placeholder = db.isPostgres() ? '$1' : '?';
    const audit = await db.get(`SELECT id FROM audits WHERE id = ${placeholder}`, [audit_id]);
    if (!audit) {
      return res.status(400).json({ message: 'Invalid audit ID' });
    }

    let result;
    if (db.isPostgres()) {
      result = await db.run(
        `INSERT INTO findings (audit_id, title, description, severity, status, root_cause, recommendation, management_response, owner_id, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
        [audit_id, title, description, severity, status, root_cause, recommendation, management_response, owner_id || req.user.id, req.user.id]
      );
    } else {
      result = await db.run(
        `INSERT INTO findings (audit_id, title, description, severity, status, root_cause, recommendation, management_response, owner_id, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [audit_id, title, description, severity, status, root_cause, recommendation, management_response, owner_id || req.user.id, req.user.id]
      );
    }

    res.status(201).json({
      message: 'Finding created successfully',
      finding: {
        id: result.lastID,
        audit_id,
        title,
        description,
        severity,
        status,
        root_cause,
        recommendation,
        management_response,
        owner_id: owner_id || req.user.id,
        created_by: req.user.id
      }
    });
  } catch (error) {
    console.error('Error creating finding:', error);
    res.status(500).json({ message: 'Failed to create finding', error: error.message });
  }
});

/**
 * Update finding
 */
router.put('/:id', authenticateToken, logActivity('UPDATE', 'finding'), async (req, res) => {
  try {
    const { id } = req.params;
    const placeholder = db.isPostgres() ? '$1' : '?';

    // Get current finding
    const finding = await db.get(`SELECT * FROM findings WHERE id = ${placeholder}`, [id]);
    if (!finding) {
      return res.status(404).json({ message: 'Finding not found' });
    }

    // Check write permission via ACL
    const canWrite = await aclService.can(req.user, 'write', 'findings', finding);
    if (!canWrite.allowed) {
      return res.status(403).json({ 
        message: 'Access denied: You do not have permission to update this finding',
        error: 'FORBIDDEN'
      });
    }

    const {
      title,
      description,
      severity,
      status,
      root_cause,
      recommendation,
      management_response,
      owner_id
    } = req.body;

    // Validate status transition
    if (status && status !== finding.status) {
      if (!isValidStatusTransition(finding.status, status)) {
        return res.status(400).json({ 
          message: `Invalid status transition from '${finding.status}' to '${status}'` 
        });
      }

      // Check if can move to action_agreed
      if (status === 'action_agreed') {
        const canMove = await canMoveToActionAgreed(id);
        if (!canMove) {
          return res.status(400).json({ 
            message: 'Cannot move to action_agreed: At least one CAPA must exist' 
          });
        }
      }

      // Check if can close
      if (status === 'closed') {
        // Check permission
        const hasClosePermission = await aclService.hasPermission(req.user, 'findings.close');
        if (!hasClosePermission && req.user.role !== 'admin') {
          return res.status(403).json({ 
            message: 'Access denied: You do not have permission to close findings' 
          });
        }

        const closeCheck = await canCloseFinding(id);
        if (!closeCheck.allowed) {
          return res.status(400).json({ message: closeCheck.reason });
        }
      }
    }

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
    addField('severity', severity);
    addField('status', status);
    addField('root_cause', root_cause);
    addField('recommendation', recommendation);
    addField('management_response', management_response);
    addField('owner_id', owner_id);

    if (updateFields.length === 0) {
      return res.status(400).json({ message: 'No fields to update' });
    }

    updateFields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    const idPlaceholder = db.isPostgres() ? `$${paramIndex}` : '?';
    await db.run(
      `UPDATE findings SET ${updateFields.join(', ')} WHERE id = ${idPlaceholder}`,
      values
    );

    res.json({ message: 'Finding updated successfully' });
  } catch (error) {
    console.error('Error updating finding:', error);
    res.status(500).json({ message: 'Failed to update finding', error: error.message });
  }
});

/**
 * Delete finding
 */
router.delete('/:id', authenticateToken, requireRole(['admin', 'manager']), logActivity('DELETE', 'finding'), async (req, res) => {
  try {
    const { id } = req.params;
    const placeholder = db.isPostgres() ? '$1' : '?';

    const finding = await db.get(`SELECT * FROM findings WHERE id = ${placeholder}`, [id]);
    if (!finding) {
      return res.status(404).json({ message: 'Finding not found' });
    }

    // Check delete permission via ACL
    const canDelete = await aclService.can(req.user, 'delete', 'findings', finding);
    if (!canDelete.allowed) {
      return res.status(403).json({ 
        message: 'Access denied: You do not have permission to delete this finding',
        error: 'FORBIDDEN'
      });
    }

    await db.run(`DELETE FROM findings WHERE id = ${placeholder}`, [id]);

    res.json({ message: 'Finding deleted successfully' });
  } catch (error) {
    console.error('Error deleting finding:', error);
    res.status(500).json({ message: 'Failed to delete finding', error: error.message });
  }
});

/**
 * Get ACL permissions for current user on a finding
 */
router.get('/:id/permissions', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const placeholder = db.isPostgres() ? '$1' : '?';

    const finding = await db.get(`SELECT * FROM findings WHERE id = ${placeholder}`, [id]);
    if (!finding) {
      return res.status(404).json({ message: 'Finding not found' });
    }

    const [canRead, canWrite, canDelete, canClose] = await Promise.all([
      aclService.can(req.user, 'read', 'findings', finding),
      aclService.can(req.user, 'write', 'findings', finding),
      aclService.can(req.user, 'delete', 'findings', finding),
      aclService.hasPermission(req.user, 'findings.close')
    ]);

    res.json({
      read: canRead.allowed,
      write: canWrite.allowed,
      delete: canDelete.allowed,
      close: canClose || req.user.role === 'admin',
      maskedFields: canRead.maskedFields,
      deniedFields: canWrite.deniedFields
    });
  } catch (error) {
    console.error('Error fetching permissions:', error);
    res.status(500).json({ message: 'Failed to fetch permissions', error: error.message });
  }
});

// =============================================================================
// Finding ↔ Risk Relationships
// =============================================================================

/**
 * Get risks related to a finding
 */
router.get('/:id/risks', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const placeholder = db.isPostgres() ? '$1' : '?';

    const risks = await db.all(
      `SELECT fr.*, r.title, r.description, r.severity, r.likelihood, r.impact, r.risk_score, r.status
       FROM finding_risks fr
       LEFT JOIN risks r ON fr.risk_id = r.id
       WHERE fr.finding_id = ${placeholder}`,
      [id]
    );

    res.json(risks);
  } catch (error) {
    console.error('Error fetching finding risks:', error);
    res.status(500).json({ message: 'Failed to fetch risks', error: error.message });
  }
});

/**
 * Add risk to finding
 */
router.post('/:id/risks', authenticateToken, logActivity('CREATE', 'finding_risk'), async (req, res) => {
  try {
    const { id } = req.params;
    const { risk_id, relation_type = 'related' } = req.body;

    if (!risk_id) {
      return res.status(400).json({ message: 'Risk ID is required' });
    }

    const placeholder = db.isPostgres() ? '$1' : '?';

    // Verify finding exists
    const finding = await db.get(`SELECT id FROM findings WHERE id = ${placeholder}`, [id]);
    if (!finding) {
      return res.status(404).json({ message: 'Finding not found' });
    }

    // Verify risk exists
    const risk = await db.get(`SELECT id FROM risks WHERE id = ${placeholder}`, [risk_id]);
    if (!risk) {
      return res.status(400).json({ message: 'Invalid risk ID' });
    }

    // Check if already linked
    const placeholder2 = db.isPostgres() ? ['$1', '$2'] : ['?', '?'];
    const existing = await db.get(
      `SELECT id FROM finding_risks WHERE finding_id = ${placeholder2[0]} AND risk_id = ${placeholder2[1]}`,
      [id, risk_id]
    );
    if (existing) {
      return res.status(400).json({ message: 'Risk is already linked to this finding' });
    }

    if (db.isPostgres()) {
      await db.run(
        `INSERT INTO finding_risks (finding_id, risk_id, relation_type) VALUES ($1, $2, $3)`,
        [id, risk_id, relation_type]
      );
    } else {
      await db.run(
        `INSERT INTO finding_risks (finding_id, risk_id, relation_type) VALUES (?, ?, ?)`,
        [id, risk_id, relation_type]
      );
    }

    res.status(201).json({ message: 'Risk linked to finding successfully' });
  } catch (error) {
    console.error('Error linking risk to finding:', error);
    res.status(500).json({ message: 'Failed to link risk', error: error.message });
  }
});

/**
 * Remove risk from finding
 */
router.delete('/:id/risks/:riskId', authenticateToken, logActivity('DELETE', 'finding_risk'), async (req, res) => {
  try {
    const { id, riskId } = req.params;
    const placeholder2 = db.isPostgres() ? ['$1', '$2'] : ['?', '?'];

    await db.run(
      `DELETE FROM finding_risks WHERE finding_id = ${placeholder2[0]} AND risk_id = ${placeholder2[1]}`,
      [id, riskId]
    );

    res.json({ message: 'Risk unlinked from finding successfully' });
  } catch (error) {
    console.error('Error unlinking risk from finding:', error);
    res.status(500).json({ message: 'Failed to unlink risk', error: error.message });
  }
});

// =============================================================================
// Finding ↔ Requirement Relationships
// =============================================================================

/**
 * Get requirements breached by a finding
 */
router.get('/:id/requirements', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const placeholder = db.isPostgres() ? '$1' : '?';

    const requirements = await db.all(
      `SELECT frq.*, cr.title, cr.description, cr.regulation, cr.category, cr.status
       FROM finding_requirements frq
       LEFT JOIN compliance_requirements cr ON frq.requirement_id = cr.id
       WHERE frq.finding_id = ${placeholder}`,
      [id]
    );

    res.json(requirements);
  } catch (error) {
    console.error('Error fetching finding requirements:', error);
    res.status(500).json({ message: 'Failed to fetch requirements', error: error.message });
  }
});

/**
 * Add requirement to finding (breach)
 */
router.post('/:id/requirements', authenticateToken, logActivity('CREATE', 'finding_requirement'), async (req, res) => {
  try {
    const { id } = req.params;
    const { requirement_id } = req.body;

    if (!requirement_id) {
      return res.status(400).json({ message: 'Requirement ID is required' });
    }

    const placeholder = db.isPostgres() ? '$1' : '?';

    // Verify finding exists
    const finding = await db.get(`SELECT id FROM findings WHERE id = ${placeholder}`, [id]);
    if (!finding) {
      return res.status(404).json({ message: 'Finding not found' });
    }

    // Verify requirement exists
    const requirement = await db.get(`SELECT id FROM compliance_requirements WHERE id = ${placeholder}`, [requirement_id]);
    if (!requirement) {
      return res.status(400).json({ message: 'Invalid requirement ID' });
    }

    // Check if already linked
    const placeholder2 = db.isPostgres() ? ['$1', '$2'] : ['?', '?'];
    const existing = await db.get(
      `SELECT id FROM finding_requirements WHERE finding_id = ${placeholder2[0]} AND requirement_id = ${placeholder2[1]}`,
      [id, requirement_id]
    );
    if (existing) {
      return res.status(400).json({ message: 'Requirement is already linked to this finding' });
    }

    if (db.isPostgres()) {
      await db.run(
        `INSERT INTO finding_requirements (finding_id, requirement_id) VALUES ($1, $2)`,
        [id, requirement_id]
      );
    } else {
      await db.run(
        `INSERT INTO finding_requirements (finding_id, requirement_id) VALUES (?, ?)`,
        [id, requirement_id]
      );
    }

    res.status(201).json({ message: 'Requirement linked to finding successfully' });
  } catch (error) {
    console.error('Error linking requirement to finding:', error);
    res.status(500).json({ message: 'Failed to link requirement', error: error.message });
  }
});

/**
 * Remove requirement from finding
 */
router.delete('/:id/requirements/:requirementId', authenticateToken, logActivity('DELETE', 'finding_requirement'), async (req, res) => {
  try {
    const { id, requirementId } = req.params;
    const placeholder2 = db.isPostgres() ? ['$1', '$2'] : ['?', '?'];

    await db.run(
      `DELETE FROM finding_requirements WHERE finding_id = ${placeholder2[0]} AND requirement_id = ${placeholder2[1]}`,
      [id, requirementId]
    );

    res.json({ message: 'Requirement unlinked from finding successfully' });
  } catch (error) {
    console.error('Error unlinking requirement from finding:', error);
    res.status(500).json({ message: 'Failed to unlink requirement', error: error.message });
  }
});

// =============================================================================
// Finding ↔ ITSM Links
// =============================================================================

/**
 * Get ITSM links for a finding
 */
router.get('/:id/itsm', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const placeholder = db.isPostgres() ? '$1' : '?';

    const links = await db.all(
      `SELECT * FROM finding_itsm_links WHERE finding_id = ${placeholder}`,
      [id]
    );

    res.json(links);
  } catch (error) {
    console.error('Error fetching ITSM links:', error);
    res.status(500).json({ message: 'Failed to fetch ITSM links', error: error.message });
  }
});

/**
 * Add ITSM link to finding
 */
router.post('/:id/itsm', authenticateToken, logActivity('CREATE', 'finding_itsm_link'), async (req, res) => {
  try {
    const { id } = req.params;
    const { itsm_type, itsm_id } = req.body;

    if (!itsm_type || !itsm_id) {
      return res.status(400).json({ message: 'ITSM type and ID are required' });
    }

    const validTypes = ['incident', 'problem', 'change', 'request'];
    if (!validTypes.includes(itsm_type)) {
      return res.status(400).json({ message: 'Invalid ITSM type' });
    }

    const placeholder = db.isPostgres() ? '$1' : '?';

    // Verify finding exists
    const finding = await db.get(`SELECT id FROM findings WHERE id = ${placeholder}`, [id]);
    if (!finding) {
      return res.status(404).json({ message: 'Finding not found' });
    }

    if (db.isPostgres()) {
      await db.run(
        `INSERT INTO finding_itsm_links (finding_id, itsm_type, itsm_id) VALUES ($1, $2, $3)
         ON CONFLICT (finding_id, itsm_type, itsm_id) DO NOTHING`,
        [id, itsm_type, itsm_id]
      );
    } else {
      await db.run(
        `INSERT OR IGNORE INTO finding_itsm_links (finding_id, itsm_type, itsm_id) VALUES (?, ?, ?)`,
        [id, itsm_type, itsm_id]
      );
    }

    res.status(201).json({ message: 'ITSM link added successfully' });
  } catch (error) {
    console.error('Error adding ITSM link:', error);
    res.status(500).json({ message: 'Failed to add ITSM link', error: error.message });
  }
});

/**
 * Remove ITSM link from finding
 */
router.delete('/:id/itsm/:linkId', authenticateToken, logActivity('DELETE', 'finding_itsm_link'), async (req, res) => {
  try {
    const { id, linkId } = req.params;
    const placeholder2 = db.isPostgres() ? ['$1', '$2'] : ['?', '?'];

    await db.run(
      `DELETE FROM finding_itsm_links WHERE id = ${placeholder2[0]} AND finding_id = ${placeholder2[1]}`,
      [linkId, id]
    );

    res.json({ message: 'ITSM link removed successfully' });
  } catch (error) {
    console.error('Error removing ITSM link:', error);
    res.status(500).json({ message: 'Failed to remove ITSM link', error: error.message });
  }
});

module.exports = router;
