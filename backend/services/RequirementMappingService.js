/**
 * Requirement Mapping Service
 * 
 * Provides business logic for mapping requirements to:
 * - Policies
 * - Risks
 * - Findings
 * - Audits
 */

const db = require('../db');

class RequirementMappingService {
  // =============================================================================
  // Policy-Requirement Mappings
  // =============================================================================

  /**
   * Map a requirement to a policy
   */
  async mapPolicyRequirement(policyId, requirementId, justification, userId) {
    const placeholder = db.isPostgres() ? ['$1', '$2'] : ['?', '?'];
    
    // Check if already mapped
    const existing = await db.get(
      `SELECT id FROM policy_requirements WHERE policy_id = ${placeholder[0]} AND requirement_id = ${placeholder[1]}`,
      [policyId, requirementId]
    );
    
    if (existing) {
      return { id: existing.id, policy_id: policyId, requirement_id: requirementId, already_exists: true };
    }
    
    if (db.isPostgres()) {
      const result = await db.run(
        `INSERT INTO policy_requirements (policy_id, requirement_id, justification, created_by) VALUES ($1, $2, $3, $4) RETURNING id`,
        [policyId, requirementId, justification, userId]
      );
      return { id: result.lastID, policy_id: policyId, requirement_id: requirementId, justification };
    } else {
      const result = await db.run(
        `INSERT INTO policy_requirements (policy_id, requirement_id, justification, created_by) VALUES (?, ?, ?, ?)`,
        [policyId, requirementId, justification, userId]
      );
      return { id: result.lastID, policy_id: policyId, requirement_id: requirementId, justification };
    }
  }

  /**
   * Get requirements mapped to a policy
   */
  async getPolicyRequirements(policyId) {
    const placeholder = db.isPostgres() ? '$1' : '?';
    return await db.all(
      `SELECT pr.*, cr.title, cr.description, cr.regulation, cr.category, cr.status, cr.family, cr.code, cr.version
       FROM policy_requirements pr
       JOIN compliance_requirements cr ON pr.requirement_id = cr.id
       WHERE pr.policy_id = ${placeholder}
       ORDER BY cr.code, cr.title`,
      [policyId]
    );
  }

  /**
   * Get policies mapped to a requirement
   */
  async getRequirementPolicies(requirementId) {
    const placeholder = db.isPostgres() ? '$1' : '?';
    return await db.all(
      `SELECT pr.*, p.title, p.description, p.category, p.status, p.version
       FROM policy_requirements pr
       JOIN policies p ON pr.policy_id = p.id
       WHERE pr.requirement_id = ${placeholder}
       ORDER BY p.title`,
      [requirementId]
    );
  }

  /**
   * Remove policy-requirement mapping
   */
  async removePolicyRequirement(policyId, requirementId) {
    const placeholder = db.isPostgres() ? ['$1', '$2'] : ['?', '?'];
    const result = await db.run(
      `DELETE FROM policy_requirements WHERE policy_id = ${placeholder[0]} AND requirement_id = ${placeholder[1]}`,
      [policyId, requirementId]
    );
    return result.rowCount > 0 || result.changes > 0;
  }

  // =============================================================================
  // Risk-Requirement Mappings
  // =============================================================================

  /**
   * Map a requirement to a risk
   */
  async mapRiskRequirement(riskId, requirementId, userId) {
    const placeholder = db.isPostgres() ? ['$1', '$2'] : ['?', '?'];
    
    // Check if already mapped
    const existing = await db.get(
      `SELECT id FROM risk_requirements WHERE risk_id = ${placeholder[0]} AND requirement_id = ${placeholder[1]}`,
      [riskId, requirementId]
    );
    
    if (existing) {
      return { id: existing.id, risk_id: riskId, requirement_id: requirementId, already_exists: true };
    }
    
    if (db.isPostgres()) {
      const result = await db.run(
        `INSERT INTO risk_requirements (risk_id, requirement_id, created_by) VALUES ($1, $2, $3) RETURNING id`,
        [riskId, requirementId, userId]
      );
      return { id: result.lastID, risk_id: riskId, requirement_id: requirementId };
    } else {
      const result = await db.run(
        `INSERT INTO risk_requirements (risk_id, requirement_id, created_by) VALUES (?, ?, ?)`,
        [riskId, requirementId, userId]
      );
      return { id: result.lastID, risk_id: riskId, requirement_id: requirementId };
    }
  }

  /**
   * Get requirements mapped to a risk
   */
  async getRiskRequirements(riskId) {
    const placeholder = db.isPostgres() ? '$1' : '?';
    return await db.all(
      `SELECT rr.*, cr.title, cr.description, cr.regulation, cr.category, cr.status, cr.family, cr.code, cr.version
       FROM risk_requirements rr
       JOIN compliance_requirements cr ON rr.requirement_id = cr.id
       WHERE rr.risk_id = ${placeholder}
       ORDER BY cr.code, cr.title`,
      [riskId]
    );
  }

  /**
   * Get risks mapped to a requirement
   */
  async getRequirementRisks(requirementId) {
    const placeholder = db.isPostgres() ? '$1' : '?';
    return await db.all(
      `SELECT rr.*, r.title, r.description, r.category, r.status, r.severity, r.risk_score
       FROM risk_requirements rr
       JOIN risks r ON rr.risk_id = r.id
       WHERE rr.requirement_id = ${placeholder}
       ORDER BY r.risk_score DESC, r.title`,
      [requirementId]
    );
  }

  /**
   * Remove risk-requirement mapping
   */
  async removeRiskRequirement(riskId, requirementId) {
    const placeholder = db.isPostgres() ? ['$1', '$2'] : ['?', '?'];
    const result = await db.run(
      `DELETE FROM risk_requirements WHERE risk_id = ${placeholder[0]} AND requirement_id = ${placeholder[1]}`,
      [riskId, requirementId]
    );
    return result.rowCount > 0 || result.changes > 0;
  }

  // =============================================================================
  // Finding-Requirement Mappings
  // =============================================================================

  /**
   * Map a requirement to a finding
   */
  async mapFindingRequirement(findingId, requirementId, evidenceStrength, userId) {
    const placeholder = db.isPostgres() ? ['$1', '$2'] : ['?', '?'];
    
    // Check if already mapped
    const existing = await db.get(
      `SELECT id FROM finding_requirements WHERE finding_id = ${placeholder[0]} AND requirement_id = ${placeholder[1]}`,
      [findingId, requirementId]
    );
    
    if (existing) {
      // Update evidence strength if provided
      if (evidenceStrength) {
        const updatePlaceholder = db.isPostgres() ? ['$1', '$2'] : ['?', '?'];
        await db.run(
          `UPDATE finding_requirements SET evidence_strength = ${updatePlaceholder[0]} WHERE id = ${updatePlaceholder[1]}`,
          [evidenceStrength, existing.id]
        );
      }
      return { id: existing.id, finding_id: findingId, requirement_id: requirementId, evidence_strength: evidenceStrength, already_exists: true };
    }
    
    if (db.isPostgres()) {
      const result = await db.run(
        `INSERT INTO finding_requirements (finding_id, requirement_id, evidence_strength, created_by) VALUES ($1, $2, $3, $4) RETURNING id`,
        [findingId, requirementId, evidenceStrength, userId]
      );
      return { id: result.lastID, finding_id: findingId, requirement_id: requirementId, evidence_strength: evidenceStrength };
    } else {
      const result = await db.run(
        `INSERT INTO finding_requirements (finding_id, requirement_id, evidence_strength, created_by) VALUES (?, ?, ?, ?)`,
        [findingId, requirementId, evidenceStrength, userId]
      );
      return { id: result.lastID, finding_id: findingId, requirement_id: requirementId, evidence_strength: evidenceStrength };
    }
  }

  /**
   * Get requirements mapped to a finding
   */
  async getFindingRequirements(findingId) {
    const placeholder = db.isPostgres() ? '$1' : '?';
    return await db.all(
      `SELECT fr.*, cr.title, cr.description, cr.regulation, cr.category, cr.status, cr.family, cr.code, cr.version
       FROM finding_requirements fr
       JOIN compliance_requirements cr ON fr.requirement_id = cr.id
       WHERE fr.finding_id = ${placeholder}
       ORDER BY cr.code, cr.title`,
      [findingId]
    );
  }

  /**
   * Get findings mapped to a requirement
   */
  async getRequirementFindings(requirementId) {
    const placeholder = db.isPostgres() ? '$1' : '?';
    return await db.all(
      `SELECT fr.*, f.title, f.description, f.status, f.severity, f.audit_id
       FROM finding_requirements fr
       JOIN findings f ON fr.finding_id = f.id
       WHERE fr.requirement_id = ${placeholder}
       ORDER BY f.severity DESC, f.title`,
      [requirementId]
    );
  }

  /**
   * Remove finding-requirement mapping
   */
  async removeFindingRequirement(findingId, requirementId) {
    const placeholder = db.isPostgres() ? ['$1', '$2'] : ['?', '?'];
    const result = await db.run(
      `DELETE FROM finding_requirements WHERE finding_id = ${placeholder[0]} AND requirement_id = ${placeholder[1]}`,
      [findingId, requirementId]
    );
    return result.rowCount > 0 || result.changes > 0;
  }

  // =============================================================================
  // Audit-Requirement Mappings (Audit Criteria)
  // =============================================================================

  /**
   * Map a requirement to an audit (as audit criteria)
   */
  async mapAuditRequirement(auditId, requirementId, notes, userId) {
    const placeholder = db.isPostgres() ? ['$1', '$2'] : ['?', '?'];
    
    // Check if already mapped
    const existing = await db.get(
      `SELECT id FROM audit_criteria WHERE audit_id = ${placeholder[0]} AND requirement_id = ${placeholder[1]}`,
      [auditId, requirementId]
    );
    
    if (existing) {
      return { id: existing.id, audit_id: auditId, requirement_id: requirementId, already_exists: true };
    }
    
    if (db.isPostgres()) {
      const result = await db.run(
        `INSERT INTO audit_criteria (audit_id, requirement_id, notes, created_by) VALUES ($1, $2, $3, $4) RETURNING id`,
        [auditId, requirementId, notes, userId]
      );
      return { id: result.lastID, audit_id: auditId, requirement_id: requirementId, notes };
    } else {
      const result = await db.run(
        `INSERT INTO audit_criteria (audit_id, requirement_id, notes, created_by) VALUES (?, ?, ?, ?)`,
        [auditId, requirementId, notes, userId]
      );
      return { id: result.lastID, audit_id: auditId, requirement_id: requirementId, notes };
    }
  }

  /**
   * Get requirements mapped to an audit (audit criteria)
   */
  async getAuditRequirements(auditId) {
    const placeholder = db.isPostgres() ? '$1' : '?';
    return await db.all(
      `SELECT ac.*, cr.title, cr.description, cr.regulation, cr.category, cr.status, cr.family, cr.code, cr.version
       FROM audit_criteria ac
       JOIN compliance_requirements cr ON ac.requirement_id = cr.id
       WHERE ac.audit_id = ${placeholder}
       ORDER BY cr.code, cr.title`,
      [auditId]
    );
  }

  /**
   * Get audits mapped to a requirement
   */
  async getRequirementAudits(requirementId) {
    const placeholder = db.isPostgres() ? '$1' : '?';
    return await db.all(
      `SELECT ac.*, a.name as audit_name, a.description as audit_description, a.status as audit_status, a.audit_type
       FROM audit_criteria ac
       JOIN audits a ON ac.audit_id = a.id
       WHERE ac.requirement_id = ${placeholder}
       ORDER BY a.created_at DESC`,
      [requirementId]
    );
  }

  /**
   * Remove audit-requirement mapping
   */
  async removeAuditRequirement(auditId, requirementId) {
    const placeholder = db.isPostgres() ? ['$1', '$2'] : ['?', '?'];
    const result = await db.run(
      `DELETE FROM audit_criteria WHERE audit_id = ${placeholder[0]} AND requirement_id = ${placeholder[1]}`,
      [auditId, requirementId]
    );
    return result.rowCount > 0 || result.changes > 0;
  }

  // =============================================================================
  // Requirement Queries
  // =============================================================================

  /**
   * Get all mappings for a requirement
   */
  async getRequirementMappings(requirementId) {
    const [policies, risks, findings, audits] = await Promise.all([
      this.getRequirementPolicies(requirementId),
      this.getRequirementRisks(requirementId),
      this.getRequirementFindings(requirementId),
      this.getRequirementAudits(requirementId)
    ]);
    
    return {
      policies,
      risks,
      findings,
      audits,
      counts: {
        policies: policies.length,
        risks: risks.length,
        findings: findings.length,
        audits: audits.length
      }
    };
  }

  /**
   * Get requirement by ID with all related data
   */
  async getRequirementWithMappings(requirementId) {
    const placeholder = db.isPostgres() ? '$1' : '?';
    
    const requirement = await db.get(
      `SELECT * FROM compliance_requirements WHERE id = ${placeholder}`,
      [requirementId]
    );
    
    if (!requirement) {
      return null;
    }
    
    const mappings = await this.getRequirementMappings(requirementId);
    
    return {
      ...requirement,
      mappings
    };
  }
}

module.exports = new RequirementMappingService();
