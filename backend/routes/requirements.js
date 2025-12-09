/**
 * Requirements Routes
 * 
 * API endpoints for the Standards Library and Requirement Mapping:
 * - /api/grc/requirements - Standards Library CRUD
 * - /api/grc/requirements/map/* - Requirement mapping endpoints
 */

const express = require('express');
const db = require('../db');
const { authenticateToken, requireRole, logActivity } = require('../middleware/auth');
const aclService = require('../services/AclService');
const requirementMappingService = require('../services/RequirementMappingService');
const metadataService = require('../services/MetadataService');

const router = express.Router();

// =============================================================================
// Standards Library - List and Search
// =============================================================================

/**
 * Get all requirements (Standards Library)
 * Supports filtering by family, version, domain, text search
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      family, 
      version, 
      domain, 
      hierarchy_level,
      regulation,
      category,
      status,
      search,
      sort = 'code:ASC'
    } = req.query;

    const conditions = [];
    const params = [];
    let paramIndex = 1;

    if (family) {
      conditions.push(`family = ${db.isPostgres() ? `$${paramIndex++}` : '?'}`);
      params.push(family);
    }
    if (version) {
      conditions.push(`version = ${db.isPostgres() ? `$${paramIndex++}` : '?'}`);
      params.push(version);
    }
    if (domain) {
      conditions.push(`domain = ${db.isPostgres() ? `$${paramIndex++}` : '?'}`);
      params.push(domain);
    }
    if (hierarchy_level) {
      conditions.push(`hierarchy_level = ${db.isPostgres() ? `$${paramIndex++}` : '?'}`);
      params.push(hierarchy_level);
    }
    if (regulation) {
      conditions.push(`regulation = ${db.isPostgres() ? `$${paramIndex++}` : '?'}`);
      params.push(regulation);
    }
    if (category) {
      conditions.push(`category = ${db.isPostgres() ? `$${paramIndex++}` : '?'}`);
      params.push(category);
    }
    if (status) {
      conditions.push(`status = ${db.isPostgres() ? `$${paramIndex++}` : '?'}`);
      params.push(status);
    }
    if (search) {
      const searchParam = `%${search}%`;
      if (db.isPostgres()) {
        conditions.push(`(title ILIKE $${paramIndex++} OR description ILIKE $${paramIndex++} OR code ILIKE $${paramIndex++})`);
      } else {
        conditions.push(`(title LIKE ? OR description LIKE ? OR code LIKE ?)`);
      }
      params.push(searchParam, searchParam, searchParam);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Parse sort parameter
    let orderBy = 'code ASC, title ASC';
    if (sort) {
      const [field, direction] = sort.split(':');
      const validFields = ['code', 'title', 'family', 'version', 'domain', 'created_at', 'updated_at'];
      if (validFields.includes(field)) {
        orderBy = `${field} ${direction?.toUpperCase() === 'DESC' ? 'DESC' : 'ASC'}`;
      }
    }

    // Pagination
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const limitPlaceholder = db.isPostgres() ? `$${paramIndex++}` : '?';
    const offsetPlaceholder = db.isPostgres() ? `$${paramIndex++}` : '?';
    params.push(parseInt(limit), offset);

    // Main query
    const query = `
      SELECT cr.*, 
        u1.first_name as owner_first_name, u1.last_name as owner_last_name,
        u2.first_name as assigned_first_name, u2.last_name as assigned_last_name
      FROM compliance_requirements cr
      LEFT JOIN users u1 ON cr.owner_id = u1.id
      LEFT JOIN users u2 ON cr.assigned_to = u2.id
      ${whereClause}
      ORDER BY ${orderBy}
      LIMIT ${limitPlaceholder} OFFSET ${offsetPlaceholder}
    `;

    const requirements = await db.all(query, params);

    // Count query
    const countParams = params.slice(0, -2);
    const countQuery = `SELECT COUNT(*) as total FROM compliance_requirements cr ${whereClause}`;
    const countResult = await db.get(countQuery, countParams);
    const total = countResult?.total || 0;

    res.json({
      requirements,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching requirements:', error);
    res.status(500).json({ message: 'Failed to fetch requirements', error: error.message });
  }
});

/**
 * Get distinct values for filters
 */
router.get('/filters', authenticateToken, async (req, res) => {
  try {
    const [families, versions, domains, hierarchyLevels, regulations, categories] = await Promise.all([
      db.all('SELECT DISTINCT family FROM compliance_requirements WHERE family IS NOT NULL ORDER BY family'),
      db.all('SELECT DISTINCT version FROM compliance_requirements WHERE version IS NOT NULL ORDER BY version'),
      db.all('SELECT DISTINCT domain FROM compliance_requirements WHERE domain IS NOT NULL ORDER BY domain'),
      db.all('SELECT DISTINCT hierarchy_level FROM compliance_requirements WHERE hierarchy_level IS NOT NULL ORDER BY hierarchy_level'),
      db.all('SELECT DISTINCT regulation FROM compliance_requirements WHERE regulation IS NOT NULL ORDER BY regulation'),
      db.all('SELECT DISTINCT category FROM compliance_requirements WHERE category IS NOT NULL ORDER BY category')
    ]);

    res.json({
      families: families.map(r => r.family),
      versions: versions.map(r => r.version),
      domains: domains.map(r => r.domain),
      hierarchyLevels: hierarchyLevels.map(r => r.hierarchy_level),
      regulations: regulations.map(r => r.regulation),
      categories: categories.map(r => r.category)
    });
  } catch (error) {
    console.error('Error fetching filter options:', error);
    res.status(500).json({ message: 'Failed to fetch filter options', error: error.message });
  }
});

/**
 * Get requirement by ID with all mappings
 */
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const placeholder = db.isPostgres() ? '$1' : '?';

    const requirement = await db.get(
      `SELECT cr.*, 
        u1.first_name as owner_first_name, u1.last_name as owner_last_name,
        u2.first_name as assigned_first_name, u2.last_name as assigned_last_name
       FROM compliance_requirements cr
       LEFT JOIN users u1 ON cr.owner_id = u1.id
       LEFT JOIN users u2 ON cr.assigned_to = u2.id
       WHERE cr.id = ${placeholder}`,
      [id]
    );

    if (!requirement) {
      return res.status(404).json({ message: 'Requirement not found' });
    }

    // Get all mappings
    const mappings = await requirementMappingService.getRequirementMappings(id);
    
    // Get assigned metadata
    const metadata = await metadataService.getAssignedMetadata('requirement', id);

    res.json({
      ...requirement,
      mappings,
      metadata
    });
  } catch (error) {
    console.error('Error fetching requirement:', error);
    res.status(500).json({ message: 'Failed to fetch requirement', error: error.message });
  }
});

// =============================================================================
// Requirement Mapping - Policy
// =============================================================================

/**
 * Map requirement to policy
 */
router.post('/map/policy', authenticateToken, requireRole(['admin', 'manager']), logActivity('CREATE', 'policy_requirement'), async (req, res) => {
  try {
    const { requirementId, targetId, justification } = req.body;

    if (!requirementId || !targetId) {
      return res.status(400).json({ message: 'requirementId and targetId are required' });
    }

    // Verify requirement exists
    const placeholder = db.isPostgres() ? '$1' : '?';
    const requirement = await db.get(`SELECT id FROM compliance_requirements WHERE id = ${placeholder}`, [requirementId]);
    if (!requirement) {
      return res.status(404).json({ message: 'Requirement not found' });
    }

    // Verify policy exists
    const policy = await db.get(`SELECT id FROM policies WHERE id = ${placeholder}`, [targetId]);
    if (!policy) {
      return res.status(404).json({ message: 'Policy not found' });
    }

    const mapping = await requirementMappingService.mapPolicyRequirement(targetId, requirementId, justification, req.user.id);

    if (mapping.already_exists) {
      return res.status(200).json({ message: 'Mapping already exists', mapping });
    }

    res.status(201).json({ message: 'Requirement mapped to policy successfully', mapping });
  } catch (error) {
    console.error('Error mapping requirement to policy:', error);
    res.status(500).json({ message: 'Failed to map requirement to policy', error: error.message });
  }
});

/**
 * Get policies mapped to a requirement
 */
router.get('/:id/policies', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const policies = await requirementMappingService.getRequirementPolicies(id);
    res.json(policies);
  } catch (error) {
    console.error('Error fetching requirement policies:', error);
    res.status(500).json({ message: 'Failed to fetch requirement policies', error: error.message });
  }
});

/**
 * Remove policy mapping
 */
router.delete('/map/policy/:policyId/:requirementId', authenticateToken, requireRole(['admin', 'manager']), logActivity('DELETE', 'policy_requirement'), async (req, res) => {
  try {
    const { policyId, requirementId } = req.params;
    const deleted = await requirementMappingService.removePolicyRequirement(policyId, requirementId);
    
    if (deleted) {
      res.json({ message: 'Policy mapping removed successfully' });
    } else {
      res.status(404).json({ message: 'Mapping not found' });
    }
  } catch (error) {
    console.error('Error removing policy mapping:', error);
    res.status(500).json({ message: 'Failed to remove policy mapping', error: error.message });
  }
});

// =============================================================================
// Requirement Mapping - Risk
// =============================================================================

/**
 * Map requirement to risk
 */
router.post('/map/risk', authenticateToken, requireRole(['admin', 'manager']), logActivity('CREATE', 'risk_requirement'), async (req, res) => {
  try {
    const { requirementId, targetId } = req.body;

    if (!requirementId || !targetId) {
      return res.status(400).json({ message: 'requirementId and targetId are required' });
    }

    // Verify requirement exists
    const placeholder = db.isPostgres() ? '$1' : '?';
    const requirement = await db.get(`SELECT id FROM compliance_requirements WHERE id = ${placeholder}`, [requirementId]);
    if (!requirement) {
      return res.status(404).json({ message: 'Requirement not found' });
    }

    // Verify risk exists
    const risk = await db.get(`SELECT id FROM risks WHERE id = ${placeholder}`, [targetId]);
    if (!risk) {
      return res.status(404).json({ message: 'Risk not found' });
    }

    const mapping = await requirementMappingService.mapRiskRequirement(targetId, requirementId, req.user.id);

    if (mapping.already_exists) {
      return res.status(200).json({ message: 'Mapping already exists', mapping });
    }

    res.status(201).json({ message: 'Requirement mapped to risk successfully', mapping });
  } catch (error) {
    console.error('Error mapping requirement to risk:', error);
    res.status(500).json({ message: 'Failed to map requirement to risk', error: error.message });
  }
});

/**
 * Get risks mapped to a requirement
 */
router.get('/:id/risks', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const risks = await requirementMappingService.getRequirementRisks(id);
    res.json(risks);
  } catch (error) {
    console.error('Error fetching requirement risks:', error);
    res.status(500).json({ message: 'Failed to fetch requirement risks', error: error.message });
  }
});

/**
 * Remove risk mapping
 */
router.delete('/map/risk/:riskId/:requirementId', authenticateToken, requireRole(['admin', 'manager']), logActivity('DELETE', 'risk_requirement'), async (req, res) => {
  try {
    const { riskId, requirementId } = req.params;
    const deleted = await requirementMappingService.removeRiskRequirement(riskId, requirementId);
    
    if (deleted) {
      res.json({ message: 'Risk mapping removed successfully' });
    } else {
      res.status(404).json({ message: 'Mapping not found' });
    }
  } catch (error) {
    console.error('Error removing risk mapping:', error);
    res.status(500).json({ message: 'Failed to remove risk mapping', error: error.message });
  }
});

// =============================================================================
// Requirement Mapping - Finding
// =============================================================================

/**
 * Map requirement to finding
 */
router.post('/map/finding', authenticateToken, requireRole(['admin', 'manager']), logActivity('CREATE', 'finding_requirement'), async (req, res) => {
  try {
    const { requirementId, targetId, evidenceStrength } = req.body;

    if (!requirementId || !targetId) {
      return res.status(400).json({ message: 'requirementId and targetId are required' });
    }

    // Validate evidence strength
    if (evidenceStrength && !['strong', 'medium', 'weak'].includes(evidenceStrength)) {
      return res.status(400).json({ message: 'evidenceStrength must be one of: strong, medium, weak' });
    }

    // Verify requirement exists
    const placeholder = db.isPostgres() ? '$1' : '?';
    const requirement = await db.get(`SELECT id FROM compliance_requirements WHERE id = ${placeholder}`, [requirementId]);
    if (!requirement) {
      return res.status(404).json({ message: 'Requirement not found' });
    }

    // Verify finding exists
    const finding = await db.get(`SELECT id FROM findings WHERE id = ${placeholder}`, [targetId]);
    if (!finding) {
      return res.status(404).json({ message: 'Finding not found' });
    }

    const mapping = await requirementMappingService.mapFindingRequirement(targetId, requirementId, evidenceStrength, req.user.id);

    if (mapping.already_exists) {
      return res.status(200).json({ message: 'Mapping already exists (evidence strength updated if provided)', mapping });
    }

    res.status(201).json({ message: 'Requirement mapped to finding successfully', mapping });
  } catch (error) {
    console.error('Error mapping requirement to finding:', error);
    res.status(500).json({ message: 'Failed to map requirement to finding', error: error.message });
  }
});

/**
 * Get findings mapped to a requirement
 */
router.get('/:id/findings', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const findings = await requirementMappingService.getRequirementFindings(id);
    res.json(findings);
  } catch (error) {
    console.error('Error fetching requirement findings:', error);
    res.status(500).json({ message: 'Failed to fetch requirement findings', error: error.message });
  }
});

/**
 * Remove finding mapping
 */
router.delete('/map/finding/:findingId/:requirementId', authenticateToken, requireRole(['admin', 'manager']), logActivity('DELETE', 'finding_requirement'), async (req, res) => {
  try {
    const { findingId, requirementId } = req.params;
    const deleted = await requirementMappingService.removeFindingRequirement(findingId, requirementId);
    
    if (deleted) {
      res.json({ message: 'Finding mapping removed successfully' });
    } else {
      res.status(404).json({ message: 'Mapping not found' });
    }
  } catch (error) {
    console.error('Error removing finding mapping:', error);
    res.status(500).json({ message: 'Failed to remove finding mapping', error: error.message });
  }
});

// =============================================================================
// Requirement Mapping - Audit
// =============================================================================

/**
 * Map requirement to audit (as audit criteria)
 */
router.post('/map/audit', authenticateToken, requireRole(['admin', 'manager']), logActivity('CREATE', 'audit_criteria'), async (req, res) => {
  try {
    const { requirementId, targetId, notes } = req.body;

    if (!requirementId || !targetId) {
      return res.status(400).json({ message: 'requirementId and targetId are required' });
    }

    // Verify requirement exists
    const placeholder = db.isPostgres() ? '$1' : '?';
    const requirement = await db.get(`SELECT id FROM compliance_requirements WHERE id = ${placeholder}`, [requirementId]);
    if (!requirement) {
      return res.status(404).json({ message: 'Requirement not found' });
    }

    // Verify audit exists
    const audit = await db.get(`SELECT id FROM audits WHERE id = ${placeholder}`, [targetId]);
    if (!audit) {
      return res.status(404).json({ message: 'Audit not found' });
    }

    const mapping = await requirementMappingService.mapAuditRequirement(targetId, requirementId, notes, req.user.id);

    if (mapping.already_exists) {
      return res.status(200).json({ message: 'Mapping already exists', mapping });
    }

    res.status(201).json({ message: 'Requirement mapped to audit successfully', mapping });
  } catch (error) {
    console.error('Error mapping requirement to audit:', error);
    res.status(500).json({ message: 'Failed to map requirement to audit', error: error.message });
  }
});

/**
 * Get audits mapped to a requirement
 */
router.get('/:id/audits', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const audits = await requirementMappingService.getRequirementAudits(id);
    res.json(audits);
  } catch (error) {
    console.error('Error fetching requirement audits:', error);
    res.status(500).json({ message: 'Failed to fetch requirement audits', error: error.message });
  }
});

/**
 * Remove audit mapping
 */
router.delete('/map/audit/:auditId/:requirementId', authenticateToken, requireRole(['admin', 'manager']), logActivity('DELETE', 'audit_criteria'), async (req, res) => {
  try {
    const { auditId, requirementId } = req.params;
    const deleted = await requirementMappingService.removeAuditRequirement(auditId, requirementId);
    
    if (deleted) {
      res.json({ message: 'Audit mapping removed successfully' });
    } else {
      res.status(404).json({ message: 'Mapping not found' });
    }
  } catch (error) {
    console.error('Error removing audit mapping:', error);
    res.status(500).json({ message: 'Failed to remove audit mapping', error: error.message });
  }
});

module.exports = router;
