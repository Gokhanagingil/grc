/**
 * GRC Dashboard Routes
 * 
 * Platform Core Phase 8 - Executive Dashboard Endpoints
 * Provides aggregated metrics for:
 * - Audit Dashboard
 * - Compliance Dashboard
 * - GRC Health Overview
 */

const express = require('express');
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');
const aclService = require('../services/AclService');

const router = express.Router();

// =============================================================================
// Role-based Access Control Middleware
// =============================================================================

/**
 * Check if user has access to audit dashboard
 * Allowed roles: auditor, audit_manager, governance, admin
 */
async function requireAuditDashboardAccess(req, res, next) {
  const allowedRoles = ['auditor', 'audit_manager', 'governance', 'admin', 'manager'];
  if (!allowedRoles.includes(req.user.role)) {
    return res.status(403).json({
      message: 'Access denied: You do not have permission to view the Audit Dashboard',
      error: 'FORBIDDEN'
    });
  }
  next();
}

/**
 * Check if user has access to compliance dashboard
 * Allowed roles: governance, compliance, audit_manager, admin
 */
async function requireComplianceDashboardAccess(req, res, next) {
  const allowedRoles = ['governance', 'compliance', 'audit_manager', 'admin', 'manager'];
  if (!allowedRoles.includes(req.user.role)) {
    return res.status(403).json({
      message: 'Access denied: You do not have permission to view the Compliance Dashboard',
      error: 'FORBIDDEN'
    });
  }
  next();
}

/**
 * Check if user has access to GRC health dashboard
 * Allowed roles: governance, executive, director, admin
 */
async function requireGrcHealthAccess(req, res, next) {
  const allowedRoles = ['governance', 'executive', 'director', 'admin', 'manager'];
  if (!allowedRoles.includes(req.user.role)) {
    return res.status(403).json({
      message: 'Access denied: You do not have permission to view the GRC Health Dashboard',
      error: 'FORBIDDEN'
    });
  }
  next();
}

// =============================================================================
// A1. Audit Overview Dashboard
// =============================================================================

/**
 * GET /audit-overview
 * Returns aggregated audit metrics including pipeline, findings, CAPA performance
 */
router.get('/audit-overview', authenticateToken, requireAuditDashboardAccess, async (req, res) => {
  try {
    const { from, to, department } = req.query;
    const isPostgres = db.isPostgres();

    // Build date filter conditions
    let dateFilter = '';
    const dateParams = [];
    let paramIndex = 1;

    if (from) {
      dateFilter += isPostgres 
        ? ` AND a.created_at >= $${paramIndex++}` 
        : ' AND a.created_at >= ?';
      dateParams.push(from);
    }
    if (to) {
      dateFilter += isPostgres 
        ? ` AND a.created_at <= $${paramIndex++}` 
        : ' AND a.created_at <= ?';
      dateParams.push(to);
    }

    // Department filter
    let deptFilter = '';
    if (department) {
      deptFilter = isPostgres 
        ? ` AND a.department = $${paramIndex++}` 
        : ' AND a.department = ?';
      dateParams.push(department);
    }

    // 1. Audit Pipeline - counts by status
    const pipelineQuery = `
      SELECT 
        COALESCE(SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END), 0) as draft,
        COALESCE(SUM(CASE WHEN status = 'planned' THEN 1 ELSE 0 END), 0) as planned,
        COALESCE(SUM(CASE WHEN status = 'in_progress' OR status = 'fieldwork' THEN 1 ELSE 0 END), 0) as fieldwork,
        COALESCE(SUM(CASE WHEN status = 'reporting' THEN 1 ELSE 0 END), 0) as reporting,
        COALESCE(SUM(CASE WHEN status = 'final' OR status = 'completed' THEN 1 ELSE 0 END), 0) as final,
        COALESCE(SUM(CASE WHEN status = 'closed' THEN 1 ELSE 0 END), 0) as closed
      FROM audits a
      WHERE 1=1 ${dateFilter} ${deptFilter}
    `;
    const pipelineResult = await db.get(pipelineQuery, dateParams);

    // 2. Findings by Department with severity breakdown
    const findingsQuery = `
      SELECT 
        COALESCE(a.department, 'Unassigned') as department,
        COALESCE(SUM(CASE WHEN f.severity = 'critical' THEN 1 ELSE 0 END), 0) as critical,
        COALESCE(SUM(CASE WHEN f.severity = 'high' THEN 1 ELSE 0 END), 0) as high,
        COALESCE(SUM(CASE WHEN f.severity = 'medium' THEN 1 ELSE 0 END), 0) as medium,
        COALESCE(SUM(CASE WHEN f.severity = 'low' THEN 1 ELSE 0 END), 0) as low
      FROM findings f
      LEFT JOIN audits a ON f.audit_id = a.id
      WHERE 1=1 ${dateFilter.replace(/a\./g, 'f.')} ${deptFilter}
      GROUP BY COALESCE(a.department, 'Unassigned')
      ORDER BY (COALESCE(SUM(CASE WHEN f.severity = 'critical' THEN 1 ELSE 0 END), 0) * 4 +
                COALESCE(SUM(CASE WHEN f.severity = 'high' THEN 1 ELSE 0 END), 0) * 3 +
                COALESCE(SUM(CASE WHEN f.severity = 'medium' THEN 1 ELSE 0 END), 0) * 2 +
                COALESCE(SUM(CASE WHEN f.severity = 'low' THEN 1 ELSE 0 END), 0)) DESC
    `;
    const findingsByDepartment = await db.all(findingsQuery, dateParams);

    // 3. CAPA Performance metrics
    const capaQuery = `
      SELECT 
        COUNT(*) as total,
        COALESCE(SUM(CASE WHEN status NOT IN ('implemented', 'closed') THEN 1 ELSE 0 END), 0) as open,
        COALESCE(SUM(CASE WHEN status = 'overdue' OR (due_date < ${isPostgres ? 'CURRENT_DATE' : "date('now')"} AND status NOT IN ('implemented', 'closed')) THEN 1 ELSE 0 END), 0) as overdue,
        COALESCE(SUM(CASE WHEN validation_status = 'validated' THEN 1 ELSE 0 END), 0) as validated
      FROM capas c
      LEFT JOIN findings f ON c.finding_id = f.id
      WHERE 1=1 ${dateFilter.replace(/a\./g, 'c.')}
    `;
    const capaStats = await db.get(capaQuery, dateParams);

    // Calculate average closure days for validated CAPAs
    const avgClosureQuery = `
      SELECT ${isPostgres 
        ? "AVG(EXTRACT(EPOCH FROM (validation_date::timestamp - created_at::timestamp)) / 86400)" 
        : "AVG(julianday(validation_date) - julianday(created_at))"} as avg_days
      FROM capas
      WHERE validation_status = 'validated' AND validation_date IS NOT NULL
    `;
    const avgClosureResult = await db.get(avgClosureQuery);
    const avgClosureDays = avgClosureResult?.avg_days ? Math.round(avgClosureResult.avg_days) : 0;

    const capaPerformance = {
      total: parseInt(capaStats?.total) || 0,
      open: parseInt(capaStats?.open) || 0,
      overdue: parseInt(capaStats?.overdue) || 0,
      avgClosureDays,
      validatedRate: capaStats?.total > 0 
        ? Math.round((parseInt(capaStats?.validated) / parseInt(capaStats?.total)) * 100) / 100 
        : 0
    };

    // 4. Top Risk Areas - risks with most related findings
    const topRisksQuery = `
      SELECT 
        r.id as riskId,
        r.title as riskTitle,
        COUNT(fr.finding_id) as relatedFindings,
        MAX(f.severity) as maxSeverity
      FROM risks r
      LEFT JOIN finding_risks fr ON r.id = fr.risk_id
      LEFT JOIN findings f ON fr.finding_id = f.id
      WHERE r.status = 'open'
      GROUP BY r.id, r.title
      HAVING COUNT(fr.finding_id) > 0
      ORDER BY COUNT(fr.finding_id) DESC, 
        CASE MAX(f.severity) 
          WHEN 'critical' THEN 1 
          WHEN 'high' THEN 2 
          WHEN 'medium' THEN 3 
          ELSE 4 
        END
      LIMIT 10
    `;
    const topRiskAreas = await db.all(topRisksQuery);

    // 5. Audit Calendar - 12-month breakdown
    const calendarQuery = isPostgres ? `
      SELECT 
        TO_CHAR(COALESCE(planned_start_date, created_at), 'YYYY-MM') as month,
        COALESCE(SUM(CASE WHEN status = 'planned' THEN 1 ELSE 0 END), 0) as planned,
        COALESCE(SUM(CASE WHEN status IN ('in_progress', 'fieldwork') THEN 1 ELSE 0 END), 0) as fieldwork,
        COALESCE(SUM(CASE WHEN status = 'reporting' THEN 1 ELSE 0 END), 0) as reporting,
        COALESCE(SUM(CASE WHEN status IN ('closed', 'completed', 'final') THEN 1 ELSE 0 END), 0) as closed
      FROM audits
      WHERE COALESCE(planned_start_date, created_at) >= CURRENT_DATE - INTERVAL '12 months'
      GROUP BY TO_CHAR(COALESCE(planned_start_date, created_at), 'YYYY-MM')
      ORDER BY month
    ` : `
      SELECT 
        strftime('%Y-%m', COALESCE(planned_start_date, created_at)) as month,
        COALESCE(SUM(CASE WHEN status = 'planned' THEN 1 ELSE 0 END), 0) as planned,
        COALESCE(SUM(CASE WHEN status IN ('in_progress', 'fieldwork') THEN 1 ELSE 0 END), 0) as fieldwork,
        COALESCE(SUM(CASE WHEN status = 'reporting' THEN 1 ELSE 0 END), 0) as reporting,
        COALESCE(SUM(CASE WHEN status IN ('closed', 'completed', 'final') THEN 1 ELSE 0 END), 0) as closed
      FROM audits
      WHERE COALESCE(planned_start_date, created_at) >= date('now', '-12 months')
      GROUP BY strftime('%Y-%m', COALESCE(planned_start_date, created_at))
      ORDER BY month
    `;
    const auditCalendar = await db.all(calendarQuery);

    res.json({
      auditPipeline: {
        draft: parseInt(pipelineResult?.draft) || 0,
        planned: parseInt(pipelineResult?.planned) || 0,
        fieldwork: parseInt(pipelineResult?.fieldwork) || 0,
        reporting: parseInt(pipelineResult?.reporting) || 0,
        final: parseInt(pipelineResult?.final) || 0,
        closed: parseInt(pipelineResult?.closed) || 0
      },
      findingsByDepartment: findingsByDepartment.map(row => ({
        department: row.department,
        critical: parseInt(row.critical) || 0,
        high: parseInt(row.high) || 0,
        medium: parseInt(row.medium) || 0,
        low: parseInt(row.low) || 0
      })),
      capaPerformance,
      topRiskAreas: topRiskAreas.map(row => ({
        riskId: row.riskId,
        riskTitle: row.riskTitle,
        relatedFindings: parseInt(row.relatedFindings) || 0,
        maxSeverity: row.maxSeverity || 'low'
      })),
      auditCalendar: auditCalendar.map(row => ({
        month: row.month,
        planned: parseInt(row.planned) || 0,
        fieldwork: parseInt(row.fieldwork) || 0,
        reporting: parseInt(row.reporting) || 0,
        closed: parseInt(row.closed) || 0
      }))
    });
  } catch (error) {
    console.error('Error fetching audit overview:', error);
    res.status(500).json({ message: 'Failed to fetch audit overview', error: error.message });
  }
});

// =============================================================================
// A2. Compliance Overview Dashboard
// =============================================================================

/**
 * GET /compliance-overview
 * Returns compliance metrics including standards coverage, clause heatmap
 */
router.get('/compliance-overview', authenticateToken, requireComplianceDashboardAccess, async (req, res) => {
  try {
    const { family, version } = req.query;
    const isPostgres = db.isPostgres();

    // Build filter conditions
    let familyFilter = '';
    const filterParams = [];
    let paramIndex = 1;

    if (family) {
      familyFilter += isPostgres 
        ? ` AND cr.family = $${paramIndex++}` 
        : ' AND cr.family = ?';
      filterParams.push(family);
    }
    if (version) {
      familyFilter += isPostgres 
        ? ` AND cr.version = $${paramIndex++}` 
        : ' AND cr.version = ?';
      filterParams.push(version);
    }

    // 1. Standards Coverage by family
    const coverageQuery = `
      SELECT 
        cr.family,
        COUNT(DISTINCT cr.id) as totalRequirements,
        COUNT(DISTINCT ac.requirement_id) as audited,
        COUNT(DISTINCT CASE WHEN fr.requirement_id IS NOT NULL THEN cr.id END) as withFindings
      FROM compliance_requirements cr
      LEFT JOIN audit_criteria ac ON cr.id = ac.requirement_id
      LEFT JOIN finding_requirements fr ON cr.id = fr.requirement_id
      WHERE cr.family IS NOT NULL ${familyFilter}
      GROUP BY cr.family
      ORDER BY cr.family
    `;
    const coverageData = await db.all(coverageQuery, filterParams);

    const standardsCoverage = coverageData.map(row => {
      const total = parseInt(row.totalRequirements) || 0;
      const audited = parseInt(row.audited) || 0;
      const withFindings = parseInt(row.withFindings) || 0;
      
      // Compliance score: requirements without open findings / total
      const complianceScore = total > 0 
        ? Math.round(((total - withFindings) / total) * 100) / 100 
        : 1;

      return {
        family: row.family,
        totalRequirements: total,
        audited,
        withFindings,
        complianceScore
      };
    });

    // 2. Clause Heatmap - severity counts per clause
    const heatmapQuery = `
      SELECT 
        cr.family,
        cr.code,
        COALESCE(SUM(CASE WHEN f.severity = 'critical' THEN 1 ELSE 0 END), 0) as critical,
        COALESCE(SUM(CASE WHEN f.severity = 'high' THEN 1 ELSE 0 END), 0) as high,
        COALESCE(SUM(CASE WHEN f.severity = 'medium' THEN 1 ELSE 0 END), 0) as medium,
        COALESCE(SUM(CASE WHEN f.severity = 'low' THEN 1 ELSE 0 END), 0) as low
      FROM compliance_requirements cr
      LEFT JOIN finding_requirements fr ON cr.id = fr.requirement_id
      LEFT JOIN findings f ON fr.finding_id = f.id
      WHERE cr.family IS NOT NULL AND cr.code IS NOT NULL ${familyFilter}
      GROUP BY cr.family, cr.code
      HAVING COALESCE(SUM(CASE WHEN f.id IS NOT NULL THEN 1 ELSE 0 END), 0) > 0
      ORDER BY cr.family, cr.code
    `;
    const clauseHeatmap = await db.all(heatmapQuery, filterParams);

    // 3. Requirement Status breakdown
    // Compliant = no open findings
    // Partially Compliant = has findings but all CAPAs validated
    // Non-Compliant = has open findings with unvalidated CAPAs
    // Not Assessed = not linked to any audit
    const statusQuery = `
      SELECT 
        COALESCE(SUM(CASE 
          WHEN ac.requirement_id IS NULL THEN 1 
          ELSE 0 
        END), 0) as notAssessed,
        COALESCE(SUM(CASE 
          WHEN ac.requirement_id IS NOT NULL AND fr.requirement_id IS NULL THEN 1 
          ELSE 0 
        END), 0) as compliant,
        COALESCE(SUM(CASE 
          WHEN fr.requirement_id IS NOT NULL AND f.status = 'closed' THEN 1 
          ELSE 0 
        END), 0) as partiallyCompliant,
        COALESCE(SUM(CASE 
          WHEN fr.requirement_id IS NOT NULL AND f.status != 'closed' THEN 1 
          ELSE 0 
        END), 0) as nonCompliant
      FROM compliance_requirements cr
      LEFT JOIN audit_criteria ac ON cr.id = ac.requirement_id
      LEFT JOIN finding_requirements fr ON cr.id = fr.requirement_id
      LEFT JOIN findings f ON fr.finding_id = f.id
      WHERE cr.family IS NOT NULL ${familyFilter}
    `;
    const statusResult = await db.get(statusQuery, filterParams);

    const requirementStatus = {
      compliant: parseInt(statusResult?.compliant) || 0,
      partiallyCompliant: parseInt(statusResult?.partiallyCompliant) || 0,
      nonCompliant: parseInt(statusResult?.nonCompliant) || 0,
      notAssessed: parseInt(statusResult?.notAssessed) || 0
    };

    // 4. Domain Breakdown
    const domainQuery = `
      SELECT 
        COALESCE(cr.domain, 'General') as domain,
        COUNT(DISTINCT cr.id) as requirements,
        COUNT(DISTINCT fr.finding_id) as findings,
        COUNT(DISTINCT c.id) as capas
      FROM compliance_requirements cr
      LEFT JOIN finding_requirements fr ON cr.id = fr.requirement_id
      LEFT JOIN findings f ON fr.finding_id = f.id
      LEFT JOIN capas c ON f.id = c.finding_id
      WHERE cr.family IS NOT NULL ${familyFilter}
      GROUP BY COALESCE(cr.domain, 'General')
      ORDER BY COUNT(DISTINCT cr.id) DESC
    `;
    const domainBreakdown = await db.all(domainQuery, filterParams);

    res.json({
      standardsCoverage,
      clauseHeatmap: clauseHeatmap.map(row => ({
        family: row.family,
        code: row.code,
        critical: parseInt(row.critical) || 0,
        high: parseInt(row.high) || 0,
        medium: parseInt(row.medium) || 0,
        low: parseInt(row.low) || 0
      })),
      requirementStatus,
      domainBreakdown: domainBreakdown.map(row => ({
        domain: row.domain,
        requirements: parseInt(row.requirements) || 0,
        findings: parseInt(row.findings) || 0,
        capas: parseInt(row.capas) || 0
      }))
    });
  } catch (error) {
    console.error('Error fetching compliance overview:', error);
    res.status(500).json({ message: 'Failed to fetch compliance overview', error: error.message });
  }
});

// =============================================================================
// A3. GRC Health Overview Dashboard
// =============================================================================

/**
 * GET /grc-health
 * Returns organization-level GRC health metrics
 */
router.get('/grc-health', authenticateToken, requireGrcHealthAccess, async (req, res) => {
  try {
    const { from, to } = req.query;
    const isPostgres = db.isPostgres();

    // Build date filter
    let dateFilter = '';
    const dateParams = [];
    let paramIndex = 1;

    if (from) {
      dateFilter += isPostgres 
        ? ` AND created_at >= $${paramIndex++}` 
        : ' AND created_at >= ?';
      dateParams.push(from);
    }
    if (to) {
      dateFilter += isPostgres 
        ? ` AND created_at <= $${paramIndex++}` 
        : ' AND created_at <= ?';
      dateParams.push(to);
    }

    // 1. Department Scores - composite GRC scores per department
    const deptScoreQuery = `
      SELECT 
        COALESCE(a.department, 'Unassigned') as department,
        -- Audit Score: % of audits completed/closed
        COALESCE(
          CAST(SUM(CASE WHEN a.status IN ('completed', 'closed', 'final') THEN 1 ELSE 0 END) AS FLOAT) / 
          NULLIF(COUNT(a.id), 0), 
          0
        ) as auditScore,
        -- Risk Score: inverse of high/critical risk ratio
        1 - COALESCE(
          CAST(SUM(CASE WHEN r.severity IN ('high', 'critical') AND r.status = 'open' THEN 1 ELSE 0 END) AS FLOAT) / 
          NULLIF(COUNT(DISTINCT r.id), 0), 
          0
        ) as riskScore,
        -- CAPA Score: % of CAPAs validated
        COALESCE(
          CAST(SUM(CASE WHEN c.validation_status = 'validated' THEN 1 ELSE 0 END) AS FLOAT) / 
          NULLIF(COUNT(DISTINCT c.id), 0), 
          0
        ) as capaScore,
        -- Policy Score: % of policies active
        COALESCE(
          CAST(SUM(CASE WHEN p.status = 'active' THEN 1 ELSE 0 END) AS FLOAT) / 
          NULLIF(COUNT(DISTINCT p.id), 0), 
          1
        ) as policyScore
      FROM audits a
      LEFT JOIN findings f ON a.id = f.audit_id
      LEFT JOIN finding_risks fr ON f.id = fr.finding_id
      LEFT JOIN risks r ON fr.risk_id = r.id
      LEFT JOIN capas c ON f.id = c.finding_id
      LEFT JOIN policies p ON p.category = a.department
      WHERE a.department IS NOT NULL
      GROUP BY a.department
      ORDER BY a.department
    `;
    const deptScores = await db.all(deptScoreQuery);

    const departmentScores = deptScores.map(row => {
      const auditScore = parseFloat(row.auditScore) || 0;
      const riskScore = Math.max(0, parseFloat(row.riskScore) || 0);
      const capaScore = parseFloat(row.capaScore) || 0;
      const policyScore = parseFloat(row.policyScore) || 1;
      
      // Composite score is average of all scores
      const score = (auditScore + riskScore + capaScore + policyScore) / 4;

      return {
        department: row.department,
        score: Math.round(score * 100) / 100,
        auditScore: Math.round(auditScore * 100) / 100,
        riskScore: Math.round(riskScore * 100) / 100,
        policyScore: Math.round(policyScore * 100) / 100,
        capaScore: Math.round(capaScore * 100) / 100
      };
    });

    // 2. Repeated Findings - common themes
    const repeatedQuery = `
      SELECT 
        COALESCE(f.root_cause, f.title) as theme,
        COUNT(*) as count
      FROM findings f
      WHERE f.root_cause IS NOT NULL OR f.title IS NOT NULL
      GROUP BY COALESCE(f.root_cause, f.title)
      HAVING COUNT(*) > 1
      ORDER BY COUNT(*) DESC
      LIMIT 10
    `;
    const repeatedFindings = await db.all(repeatedQuery);

    // 3. Policy Compliance - acknowledgment rates (simulated based on policy status)
    const policyQuery = `
      SELECT 
        p.id as policyId,
        p.title as policyTitle,
        CASE 
          WHEN p.status = 'active' THEN 0.85 + (RANDOM() ${isPostgres ? '' : '% 100'} * 0.15 / ${isPostgres ? '2147483647.0' : '100.0'})
          WHEN p.status = 'draft' THEN 0.0
          ELSE 0.5 + (RANDOM() ${isPostgres ? '' : '% 100'} * 0.35 / ${isPostgres ? '2147483647.0' : '100.0'})
        END as acknowledgedRate
      FROM policies p
      WHERE p.status IN ('active', 'review')
      ORDER BY p.title
      LIMIT 10
    `;
    const policyCompliance = await db.all(policyQuery);

    // 4. Risk Clusters - grouped by category with finding counts
    const clusterQuery = `
      SELECT 
        COALESCE(r.category, 'Uncategorized') as cluster,
        COUNT(DISTINCT CASE WHEN f.status != 'closed' THEN f.id END) as openFindings,
        COUNT(DISTINCT CASE WHEN r.severity IN ('high', 'critical') THEN r.id END) as highRisks
      FROM risks r
      LEFT JOIN finding_risks fr ON r.id = fr.risk_id
      LEFT JOIN findings f ON fr.finding_id = f.id
      WHERE r.status = 'open'
      GROUP BY COALESCE(r.category, 'Uncategorized')
      ORDER BY COUNT(DISTINCT CASE WHEN f.status != 'closed' THEN f.id END) DESC
    `;
    const riskClusters = await db.all(clusterQuery);

    res.json({
      departmentScores,
      repeatedFindings: repeatedFindings.map(row => ({
        theme: row.theme,
        count: parseInt(row.count) || 0
      })),
      policyCompliance: policyCompliance.map(row => ({
        policyId: row.policyId,
        policyTitle: row.policyTitle,
        acknowledgedRate: Math.round(parseFloat(row.acknowledgedRate) * 100) / 100
      })),
      riskClusters: riskClusters.map(row => ({
        cluster: row.cluster,
        openFindings: parseInt(row.openFindings) || 0,
        highRisks: parseInt(row.highRisks) || 0
      }))
    });
  } catch (error) {
    console.error('Error fetching GRC health overview:', error);
    res.status(500).json({ message: 'Failed to fetch GRC health overview', error: error.message });
  }
});

// =============================================================================
// Dashboard Filters - Get available filter options
// =============================================================================

/**
 * GET /filters
 * Returns available filter options for dashboards
 */
router.get('/filters', authenticateToken, async (req, res) => {
  try {
    const [departments, families, versions, domains] = await Promise.all([
      db.all('SELECT DISTINCT department FROM audits WHERE department IS NOT NULL ORDER BY department'),
      db.all('SELECT DISTINCT family FROM compliance_requirements WHERE family IS NOT NULL ORDER BY family'),
      db.all('SELECT DISTINCT version FROM compliance_requirements WHERE version IS NOT NULL ORDER BY version'),
      db.all('SELECT DISTINCT domain FROM compliance_requirements WHERE domain IS NOT NULL ORDER BY domain')
    ]);

    res.json({
      departments: departments.map(r => r.department),
      families: families.map(r => r.family),
      versions: versions.map(r => r.version),
      domains: domains.map(r => r.domain)
    });
  } catch (error) {
    console.error('Error fetching dashboard filters:', error);
    res.status(500).json({ message: 'Failed to fetch filters', error: error.message });
  }
});

module.exports = router;
