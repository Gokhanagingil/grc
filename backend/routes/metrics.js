const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');

router.use(authenticateToken);

router.get('/requirements/coverage', async (req, res) => {
  try {
    const isPostgres = db.isPostgres && db.isPostgres();
    
    let familyStatsQuery;
    if (isPostgres) {
      familyStatsQuery = `
        SELECT 
          cr.family,
          COUNT(DISTINCT cr.id) as total_requirements,
          COUNT(DISTINCT ac.requirement_id) as mapped_in_audits,
          COUNT(DISTINCT fr.requirement_id) as mapped_in_findings,
          COUNT(DISTINCT pr.requirement_id) as mapped_in_policies,
          COUNT(DISTINCT rr.requirement_id) as mapped_in_risks
        FROM compliance_requirements cr
        LEFT JOIN audit_criteria ac ON cr.id = ac.requirement_id
        LEFT JOIN finding_requirements fr ON cr.id = fr.requirement_id
        LEFT JOIN policy_requirements pr ON cr.id = pr.requirement_id
        LEFT JOIN risk_requirements rr ON cr.id = rr.requirement_id
        WHERE cr.family IS NOT NULL
        GROUP BY cr.family
        ORDER BY cr.family
      `;
    } else {
      familyStatsQuery = `
        SELECT 
          cr.family,
          COUNT(DISTINCT cr.id) as total_requirements,
          COUNT(DISTINCT ac.requirement_id) as mapped_in_audits,
          COUNT(DISTINCT fr.requirement_id) as mapped_in_findings,
          COUNT(DISTINCT pr.requirement_id) as mapped_in_policies,
          COUNT(DISTINCT rr.requirement_id) as mapped_in_risks
        FROM compliance_requirements cr
        LEFT JOIN audit_criteria ac ON cr.id = ac.requirement_id
        LEFT JOIN finding_requirements fr ON cr.id = fr.requirement_id
        LEFT JOIN policy_requirements pr ON cr.id = pr.requirement_id
        LEFT JOIN risk_requirements rr ON cr.id = rr.requirement_id
        WHERE cr.family IS NOT NULL
        GROUP BY cr.family
        ORDER BY cr.family
      `;
    }
    
    const familyStats = await db.all(familyStatsQuery);
    
    const coverage = familyStats.map(stat => {
      const total = parseInt(stat.total_requirements) || 0;
      const mappedInAudits = parseInt(stat.mapped_in_audits) || 0;
      const mappedInFindings = parseInt(stat.mapped_in_findings) || 0;
      const mappedInPolicies = parseInt(stat.mapped_in_policies) || 0;
      const mappedInRisks = parseInt(stat.mapped_in_risks) || 0;
      
      const totalMapped = new Set();
      
      const auditCoverageScore = total > 0 ? Math.round((mappedInAudits / total) * 100) : 0;
      const findingCoverageScore = total > 0 ? Math.round((mappedInFindings / total) * 100) : 0;
      const policyCoverageScore = total > 0 ? Math.round((mappedInPolicies / total) * 100) : 0;
      const riskCoverageScore = total > 0 ? Math.round((mappedInRisks / total) * 100) : 0;
      
      const overallCoverage = Math.round((auditCoverageScore + findingCoverageScore + policyCoverageScore + riskCoverageScore) / 4);
      
      return {
        family: stat.family,
        totalRequirements: total,
        mappedInAudits,
        mappedInFindings,
        mappedInPolicies,
        mappedInRisks,
        auditCoverageScore,
        findingCoverageScore,
        policyCoverageScore,
        riskCoverageScore,
        overallCoverage
      };
    });
    
    const totalStats = {
      totalRequirements: coverage.reduce((sum, c) => sum + c.totalRequirements, 0),
      totalMappedInAudits: coverage.reduce((sum, c) => sum + c.mappedInAudits, 0),
      totalMappedInFindings: coverage.reduce((sum, c) => sum + c.mappedInFindings, 0),
      totalMappedInPolicies: coverage.reduce((sum, c) => sum + c.mappedInPolicies, 0),
      totalMappedInRisks: coverage.reduce((sum, c) => sum + c.mappedInRisks, 0),
      averageCoverage: coverage.length > 0 
        ? Math.round(coverage.reduce((sum, c) => sum + c.overallCoverage, 0) / coverage.length)
        : 0
    };
    
    res.json({
      success: true,
      data: {
        byFamily: coverage,
        totals: totalStats
      }
    });
  } catch (error) {
    console.error('Error fetching requirements coverage:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch requirements coverage',
      message: error.message
    });
  }
});

router.get('/findings/by-standard', async (req, res) => {
  try {
    const isPostgres = db.isPostgres && db.isPostgres();
    
    let heatmapQuery;
    if (isPostgres) {
      heatmapQuery = `
        SELECT 
          cr.family,
          cr.code,
          cr.title,
          f.severity,
          COUNT(f.id) as finding_count
        FROM compliance_requirements cr
        INNER JOIN finding_requirements fr ON cr.id = fr.requirement_id
        INNER JOIN findings f ON fr.finding_id = f.id
        WHERE cr.family IS NOT NULL
        GROUP BY cr.family, cr.code, cr.title, f.severity
        ORDER BY cr.family, cr.code, f.severity
      `;
    } else {
      heatmapQuery = `
        SELECT 
          cr.family,
          cr.code,
          cr.title,
          f.severity,
          COUNT(f.id) as finding_count
        FROM compliance_requirements cr
        INNER JOIN finding_requirements fr ON cr.id = fr.requirement_id
        INNER JOIN findings f ON fr.finding_id = f.id
        WHERE cr.family IS NOT NULL
        GROUP BY cr.family, cr.code, cr.title, f.severity
        ORDER BY cr.family, cr.code, f.severity
      `;
    }
    
    const rawData = await db.all(heatmapQuery);
    
    const heatmapData = {};
    
    rawData.forEach(row => {
      const key = `${row.family}:${row.code}`;
      if (!heatmapData[key]) {
        heatmapData[key] = {
          family: row.family,
          code: row.code,
          title: row.title,
          severityCounts: {
            critical: 0,
            high: 0,
            medium: 0,
            low: 0,
            info: 0
          },
          totalFindings: 0
        };
      }
      
      const severity = (row.severity || 'medium').toLowerCase();
      if (heatmapData[key].severityCounts.hasOwnProperty(severity)) {
        heatmapData[key].severityCounts[severity] = parseInt(row.finding_count) || 0;
      }
      heatmapData[key].totalFindings += parseInt(row.finding_count) || 0;
    });
    
    const heatmap = Object.values(heatmapData).sort((a, b) => {
      if (a.family !== b.family) return a.family.localeCompare(b.family);
      return a.code.localeCompare(b.code);
    });
    
    const familySummary = {};
    heatmap.forEach(item => {
      if (!familySummary[item.family]) {
        familySummary[item.family] = {
          family: item.family,
          totalFindings: 0,
          severityCounts: {
            critical: 0,
            high: 0,
            medium: 0,
            low: 0,
            info: 0
          },
          requirementsWithFindings: 0
        };
      }
      familySummary[item.family].totalFindings += item.totalFindings;
      familySummary[item.family].requirementsWithFindings++;
      Object.keys(item.severityCounts).forEach(sev => {
        familySummary[item.family].severityCounts[sev] += item.severityCounts[sev];
      });
    });
    
    res.json({
      success: true,
      data: {
        heatmap,
        byFamily: Object.values(familySummary)
      }
    });
  } catch (error) {
    console.error('Error fetching findings by standard:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch findings by standard',
      message: error.message
    });
  }
});

router.get('/requirements/tags', async (req, res) => {
  try {
    const isPostgres = db.isPostgres && db.isPostgres();
    
    let tagStatsQuery;
    if (isPostgres) {
      tagStatsQuery = `
        SELECT 
          mv.value as tag_name,
          mv.color as tag_color,
          mt.name as tag_type,
          COUNT(om.id) as requirement_count
        FROM metadata_values mv
        INNER JOIN metadata_types mt ON mv.type_id = mt.id
        LEFT JOIN object_metadata om ON mv.id = om.metadata_value_id AND om.object_type = 'requirement'
        GROUP BY mv.id, mv.value, mv.color, mt.name
        ORDER BY requirement_count DESC, mv.value
      `;
    } else {
      tagStatsQuery = `
        SELECT 
          mv.value as tag_name,
          mv.color as tag_color,
          mt.name as tag_type,
          COUNT(om.id) as requirement_count
        FROM metadata_values mv
        INNER JOIN metadata_types mt ON mv.type_id = mt.id
        LEFT JOIN object_metadata om ON mv.id = om.metadata_value_id AND om.object_type = 'requirement'
        GROUP BY mv.id, mv.value, mv.color, mt.name
        ORDER BY requirement_count DESC, mv.value
      `;
    }
    
    const tagStats = await db.all(tagStatsQuery);
    
    const tags = tagStats.map(stat => ({
      tagName: stat.tag_name,
      tagColor: stat.tag_color,
      tagType: stat.tag_type,
      requirementCount: parseInt(stat.requirement_count) || 0
    }));
    
    const totalTaggedRequirements = tags.reduce((sum, t) => sum + t.requirementCount, 0);
    
    const byType = {};
    tags.forEach(tag => {
      if (!byType[tag.tagType]) {
        byType[tag.tagType] = {
          type: tag.tagType,
          tags: [],
          totalRequirements: 0
        };
      }
      byType[tag.tagType].tags.push(tag);
      byType[tag.tagType].totalRequirements += tag.requirementCount;
    });
    
    res.json({
      success: true,
      data: {
        tags,
        byType: Object.values(byType),
        totalTaggedRequirements
      }
    });
  } catch (error) {
    console.error('Error fetching requirements tags:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch requirements tags',
      message: error.message
    });
  }
});

router.get('/compliance/summary', async (req, res) => {
  try {
    const isPostgres = db.isPostgres && db.isPostgres();
    
    let summaryQuery;
    if (isPostgres) {
      summaryQuery = `
        SELECT 
          cr.family,
          cr.status,
          COUNT(*) as count
        FROM compliance_requirements cr
        WHERE cr.family IS NOT NULL
        GROUP BY cr.family, cr.status
        ORDER BY cr.family, cr.status
      `;
    } else {
      summaryQuery = `
        SELECT 
          cr.family,
          cr.status,
          COUNT(*) as count
        FROM compliance_requirements cr
        WHERE cr.family IS NOT NULL
        GROUP BY cr.family, cr.status
        ORDER BY cr.family, cr.status
      `;
    }
    
    const rawData = await db.all(summaryQuery);
    
    const summaryByFamily = {};
    
    rawData.forEach(row => {
      if (!summaryByFamily[row.family]) {
        summaryByFamily[row.family] = {
          family: row.family,
          total: 0,
          byStatus: {
            pending: 0,
            in_progress: 0,
            completed: 0,
            not_applicable: 0
          }
        };
      }
      
      const status = row.status || 'pending';
      const count = parseInt(row.count) || 0;
      
      summaryByFamily[row.family].total += count;
      if (summaryByFamily[row.family].byStatus.hasOwnProperty(status)) {
        summaryByFamily[row.family].byStatus[status] = count;
      }
    });
    
    const families = Object.values(summaryByFamily).map(family => ({
      ...family,
      complianceScore: family.total > 0 
        ? Math.round((family.byStatus.completed / family.total) * 100)
        : 0
    }));
    
    const totals = {
      totalRequirements: families.reduce((sum, f) => sum + f.total, 0),
      totalCompleted: families.reduce((sum, f) => sum + f.byStatus.completed, 0),
      totalPending: families.reduce((sum, f) => sum + f.byStatus.pending, 0),
      totalInProgress: families.reduce((sum, f) => sum + f.byStatus.in_progress, 0),
      overallComplianceScore: 0
    };
    
    totals.overallComplianceScore = totals.totalRequirements > 0
      ? Math.round((totals.totalCompleted / totals.totalRequirements) * 100)
      : 0;
    
    res.json({
      success: true,
      data: {
        byFamily: families,
        totals
      }
    });
  } catch (error) {
    console.error('Error fetching compliance summary:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch compliance summary',
      message: error.message
    });
  }
});

module.exports = router;
