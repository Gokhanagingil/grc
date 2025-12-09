/**
 * Audit Report Generator Service
 * 
 * Responsible for:
 * 1. Collecting all data required for a full audit report
 * 2. Transforming aggregated data into a structured object for the template engine
 * 3. Generating HTML reports using Handlebars templates
 * 
 * Data collected:
 * - Audit metadata
 * - Criteria (requirements/policies)
 * - Scope objects (CMDB/Service)
 * - Findings + severity breakdown + lifecycle status
 * - CAPAs + overdue/validated status
 * - Evidence metadata
 * - Linked risks
 * - Linked ITSM records
 */

const Handlebars = require('handlebars');
const fs = require('fs');
const path = require('path');
const db = require('../db');

class AuditReportGeneratorService {
  constructor() {
    this.templatePath = path.join(__dirname, '../templates/audit-report/default.hbs');
    this.template = null;
    this.registerHelpers();
  }

  /**
   * Register custom Handlebars helpers
   */
  registerHelpers() {
    Handlebars.registerHelper('eq', function(a, b) {
      return a === b;
    });

    Handlebars.registerHelper('formatDate', function(date) {
      if (!date) return 'N/A';
      return new Date(date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    });

    Handlebars.registerHelper('formatDateTime', function(date) {
      if (!date) return 'N/A';
      return new Date(date).toLocaleString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    });

    Handlebars.registerHelper('lowercase', function(str) {
      return str ? str.toLowerCase() : '';
    });

    Handlebars.registerHelper('uppercase', function(str) {
      return str ? str.toUpperCase() : '';
    });
  }

  /**
   * Load and compile the Handlebars template
   */
  loadTemplate() {
    if (!this.template) {
      const templateSource = fs.readFileSync(this.templatePath, 'utf8');
      this.template = Handlebars.compile(templateSource);
    }
    return this.template;
  }

  /**
   * Generate a full audit report
   * @param {number} auditId - The audit ID
   * @param {Object} user - The user generating the report
   * @returns {Promise<Object>} Generated report data including HTML
   */
  async generateReport(auditId, user) {
    const reportData = await this.collectReportData(auditId, user);
    const html = this.renderTemplate(reportData);
    
    return {
      html,
      data: reportData
    };
  }

  /**
   * Collect all data required for the audit report
   * @param {number} auditId - The audit ID
   * @param {Object} user - The user generating the report
   * @returns {Promise<Object>} Aggregated report data
   */
  async collectReportData(auditId, user) {
    const placeholder = db.isPostgres() ? '$1' : '?';

    // Fetch audit with owner and lead auditor details
    const audit = await db.get(
      `SELECT a.*, 
       u1.first_name as owner_first_name, u1.last_name as owner_last_name, u1.email as owner_email,
       u2.first_name as lead_auditor_first_name, u2.last_name as lead_auditor_last_name, u2.email as lead_auditor_email
       FROM audits a 
       LEFT JOIN users u1 ON a.owner_id = u1.id 
       LEFT JOIN users u2 ON a.lead_auditor_id = u2.id 
       WHERE a.id = ${placeholder}`,
      [auditId]
    );

    if (!audit) {
      throw new Error('Audit not found');
    }

    // Fetch all related data in parallel
    const [
      criteria,
      scopeObjects,
      findings,
      evidence
    ] = await Promise.all([
      this.fetchCriteria(auditId),
      this.fetchScopeObjects(auditId),
      this.fetchFindingsWithRelations(auditId),
      this.fetchEvidence(auditId)
    ]);

    // Calculate metrics
    const metrics = this.calculateMetrics(findings);

    // Get the next version number
    const lastReport = await db.get(
      `SELECT MAX(version) as max_version FROM audit_reports WHERE audit_id = ${placeholder}`,
      [auditId]
    );
    const nextVersion = (lastReport?.max_version || 0) + 1;

    return {
      audit,
      criteria,
      scopeObjects,
      findings,
      evidence,
      metrics,
      reportVersion: nextVersion,
      reportStatus: 'draft',
      generatedAt: new Date().toLocaleString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZoneName: 'short'
      }),
      generatedBy: user
    };
  }

  /**
   * Fetch criteria (requirements) linked to the audit
   */
  async fetchCriteria(auditId) {
    const placeholder = db.isPostgres() ? '$1' : '?';
    return db.all(
      `SELECT ac.*, cr.title, cr.description, cr.regulation, cr.category, cr.status
       FROM audit_criteria ac
       LEFT JOIN compliance_requirements cr ON ac.requirement_id = cr.id
       WHERE ac.audit_id = ${placeholder}`,
      [auditId]
    );
  }

  /**
   * Fetch scope objects linked to the audit
   */
  async fetchScopeObjects(auditId) {
    const placeholder = db.isPostgres() ? '$1' : '?';
    return db.all(
      `SELECT * FROM audit_scope_objects WHERE audit_id = ${placeholder}`,
      [auditId]
    );
  }

  /**
   * Fetch findings with all related data (CAPAs, risks, requirements, ITSM links)
   */
  async fetchFindingsWithRelations(auditId) {
    const placeholder = db.isPostgres() ? '$1' : '?';
    
    // Fetch findings
    const findings = await db.all(
      `SELECT f.*, 
        u1.first_name as owner_first_name, u1.last_name as owner_last_name,
        u2.first_name as created_by_first_name, u2.last_name as created_by_last_name
       FROM findings f
       LEFT JOIN users u1 ON f.owner_id = u1.id
       LEFT JOIN users u2 ON f.created_by = u2.id
       WHERE f.audit_id = ${placeholder}
       ORDER BY 
         CASE f.severity 
           WHEN 'critical' THEN 1 
           WHEN 'high' THEN 2 
           WHEN 'medium' THEN 3 
           WHEN 'low' THEN 4 
         END,
         f.created_at DESC`,
      [auditId]
    );

    // Fetch related data for each finding
    for (const finding of findings) {
      const findingPlaceholder = db.isPostgres() ? '$1' : '?';
      
      // Fetch CAPAs
      finding.capas = await db.all(
        `SELECT c.*, 
          u1.first_name as owner_first_name, u1.last_name as owner_last_name,
          u2.first_name as validated_by_first_name, u2.last_name as validated_by_last_name
         FROM capas c
         LEFT JOIN users u1 ON c.owner_id = u1.id
         LEFT JOIN users u2 ON c.validated_by = u2.id
         WHERE c.finding_id = ${findingPlaceholder}
         ORDER BY c.due_date ASC`,
        [finding.id]
      );

      // Fetch related risks
      finding.related_risks = await db.all(
        `SELECT fr.*, r.title as risk_title, r.severity as risk_severity, r.status as risk_status
         FROM finding_risks fr
         LEFT JOIN risks r ON fr.risk_id = r.id
         WHERE fr.finding_id = ${findingPlaceholder}`,
        [finding.id]
      );

      // Fetch breached requirements
      finding.breached_requirements = await db.all(
        `SELECT frq.*, cr.title as requirement_title, cr.regulation
         FROM finding_requirements frq
         LEFT JOIN compliance_requirements cr ON frq.requirement_id = cr.id
         WHERE frq.finding_id = ${findingPlaceholder}`,
        [finding.id]
      );

      // Fetch ITSM links
      finding.itsm_links = await db.all(
        `SELECT * FROM finding_itsm_links WHERE finding_id = ${findingPlaceholder}`,
        [finding.id]
      );
    }

    return findings;
  }

  /**
   * Fetch evidence linked to the audit
   */
  async fetchEvidence(auditId) {
    const placeholder = db.isPostgres() ? '$1' : '?';
    return db.all(
      `SELECT e.*, 
        u.first_name as uploaded_by_first_name, u.last_name as uploaded_by_last_name
       FROM evidence e
       LEFT JOIN users u ON e.uploaded_by = u.id
       WHERE e.audit_id = ${placeholder}
       ORDER BY e.uploaded_at DESC`,
      [auditId]
    );
  }

  /**
   * Calculate metrics from findings and CAPAs
   */
  calculateMetrics(findings) {
    const metrics = {
      totalFindings: findings.length,
      totalCapas: 0,
      openCapas: 0,
      overdueCapas: 0,
      validatedCapas: 0,
      findingsBySeverity: {
        critical: 0,
        high: 0,
        medium: 0,
        low: 0
      },
      findingsByStatus: {}
    };

    for (const finding of findings) {
      // Count by severity
      if (finding.severity && metrics.findingsBySeverity[finding.severity] !== undefined) {
        metrics.findingsBySeverity[finding.severity]++;
      }

      // Count by status
      if (finding.status) {
        metrics.findingsByStatus[finding.status] = (metrics.findingsByStatus[finding.status] || 0) + 1;
      }

      // Count CAPAs
      if (finding.capas) {
        metrics.totalCapas += finding.capas.length;
        
        for (const capa of finding.capas) {
          if (capa.status === 'overdue') {
            metrics.overdueCapas++;
          }
          if (capa.status !== 'implemented' && capa.validation_status !== 'validated') {
            metrics.openCapas++;
          }
          if (capa.validation_status === 'validated') {
            metrics.validatedCapas++;
          }
        }
      }
    }

    return metrics;
  }

  /**
   * Render the template with the provided data
   */
  renderTemplate(data) {
    const template = this.loadTemplate();
    return template(data);
  }

  /**
   * Save a generated report to the database
   * @param {number} auditId - The audit ID
   * @param {string} html - The generated HTML
   * @param {number} userId - The user ID who generated the report
   * @returns {Promise<Object>} The created report record
   */
  async saveReport(auditId, html, userId) {
    const placeholder = db.isPostgres() ? '$1' : '?';
    
    // Get the next version number
    const lastReport = await db.get(
      `SELECT MAX(version) as max_version FROM audit_reports WHERE audit_id = ${placeholder}`,
      [auditId]
    );
    const nextVersion = (lastReport?.max_version || 0) + 1;

    let result;
    if (db.isPostgres()) {
      result = await db.run(
        `INSERT INTO audit_reports (audit_id, version, status, generated_html, created_by)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [auditId, nextVersion, 'draft', html, userId]
      );
    } else {
      result = await db.run(
        `INSERT INTO audit_reports (audit_id, version, status, generated_html, created_by)
         VALUES (?, ?, ?, ?, ?)`,
        [auditId, nextVersion, 'draft', html, userId]
      );
    }

    return {
      id: result.lastID,
      audit_id: auditId,
      version: nextVersion,
      status: 'draft',
      created_by: userId
    };
  }

  /**
   * Regenerate an existing report (only allowed for draft/under_review)
   * @param {number} reportId - The report ID
   * @param {Object} user - The user regenerating the report
   * @returns {Promise<Object>} Updated report data
   */
  async regenerateReport(reportId, user) {
    const placeholder = db.isPostgres() ? '$1' : '?';
    
    // Get the existing report
    const report = await db.get(
      `SELECT * FROM audit_reports WHERE id = ${placeholder}`,
      [reportId]
    );

    if (!report) {
      throw new Error('Report not found');
    }

    if (report.status === 'final' || report.status === 'archived') {
      throw new Error('Cannot regenerate a finalized or archived report');
    }

    // Generate new HTML
    const { html } = await this.generateReport(report.audit_id, user);

    // Update the report
    if (db.isPostgres()) {
      await db.run(
        `UPDATE audit_reports SET generated_html = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
        [html, reportId]
      );
    } else {
      await db.run(
        `UPDATE audit_reports SET generated_html = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [html, reportId]
      );
    }

    return {
      id: reportId,
      html,
      regenerated: true
    };
  }
}

// Export singleton instance
module.exports = new AuditReportGeneratorService();
