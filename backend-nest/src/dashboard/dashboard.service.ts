import { Injectable } from '@nestjs/common';
import { GrcRiskService } from '../grc/services/grc-risk.service';
import { GrcPolicyService } from '../grc/services/grc-policy.service';
import { GrcRequirementService } from '../grc/services/grc-requirement.service';
import { IncidentService } from '../itsm/incident/incident.service';
import {
  DashboardOverviewResponse,
  RiskTrendsResponse,
  ComplianceByRegulationResponse,
} from './dto';

/**
 * Dashboard Service
 *
 * Aggregates data from GRC and ITSM services to provide
 * dashboard-ready KPIs and visualizations.
 *
 * This service composes data from:
 * - GrcRiskService (risk summary)
 * - GrcPolicyService (policy summary)
 * - GrcRequirementService (compliance/requirement summary)
 * - IncidentService (incident summary)
 */
@Injectable()
export class DashboardService {
  constructor(
    private readonly riskService: GrcRiskService,
    private readonly policyService: GrcPolicyService,
    private readonly requirementService: GrcRequirementService,
    private readonly incidentService: IncidentService,
  ) {}

  /**
   * Get dashboard overview
   *
   * Aggregates KPIs from all GRC/ITSM domains into a single response
   * suitable for the Dashboard page.
   */
  async getOverview(tenantId: string): Promise<DashboardOverviewResponse> {
    // Fetch all summaries in parallel for performance
    const [riskSummary, policySummary, requirementSummary, incidentSummary] =
      await Promise.all([
        this.riskService.getSummary(tenantId),
        this.policyService.getSummary(tenantId),
        this.requirementService.getSummary(tenantId),
        this.incidentService.getSummary(tenantId),
      ]);

    // Transform risk data
    const openRiskCount =
      (riskSummary.byStatus['identified'] || 0) +
      (riskSummary.byStatus['open'] || 0) +
      (riskSummary.byStatus['in_progress'] || 0);

    const highRiskCount =
      (riskSummary.bySeverity['high'] || 0) +
      (riskSummary.bySeverity['critical'] || 0);

    // Transform compliance data
    // Map requirement statuses to dashboard compliance statuses
    const compliantCount = requirementSummary.compliantCount || 0;
    const inProgressCount = requirementSummary.inProgressCount || 0;
    const nonCompliantCount = requirementSummary.nonCompliantCount || 0;

    return {
      risks: {
        total: riskSummary.totalCount,
        open: openRiskCount,
        high: highRiskCount,
        overdue: riskSummary.overdueCount,
        top5OpenRisks: riskSummary.top5OpenRisks || [],
      },
      compliance: {
        total: requirementSummary.totalCount,
        pending: inProgressCount,
        completed: compliantCount,
        overdue: nonCompliantCount,
        coveragePercentage: requirementSummary.requirementCoveragePercentage,
      },
      policies: {
        total: policySummary.totalCount,
        active: policySummary.activeCount,
        draft: policySummary.draftCount,
        coveragePercentage: policySummary.policyCoveragePercentage,
      },
      incidents: {
        total: incidentSummary.totalCount,
        open: incidentSummary.openCount,
        closed: incidentSummary.closedCount,
        resolved: incidentSummary.resolvedCount,
        resolvedToday: incidentSummary.resolvedToday,
        avgResolutionTimeHours: incidentSummary.avgResolutionTimeHours,
      },
      users: {
        // User counts are not available from NestJS services yet
        // This would require integration with UsersService
        total: 0,
        admins: 0,
        managers: 0,
      },
    };
  }

  /**
   * Get risk trends data
   *
   * Returns risk counts grouped by severity for visualization.
   * Currently provides a snapshot breakdown by severity level.
   * Can be extended to provide time-series data in the future.
   */
  async getRiskTrends(tenantId: string): Promise<RiskTrendsResponse> {
    const riskSummary = await this.riskService.getSummary(tenantId);

    // For now, return a single data point with current severity breakdown
    // This can be extended to provide historical time-series data
    // by querying risk history or using a time-bucketed approach
    const today = new Date().toISOString().split('T')[0];

    return [
      {
        date: today,
        total_risks: riskSummary.totalCount,
        critical: riskSummary.bySeverity['critical'] || 0,
        high: riskSummary.bySeverity['high'] || 0,
        medium: riskSummary.bySeverity['medium'] || 0,
        low: riskSummary.bySeverity['low'] || 0,
      },
    ];
  }

  /**
   * Get compliance breakdown by regulation/framework
   *
   * Returns compliance status grouped by framework for visualization.
   */
  async getComplianceByRegulation(
    tenantId: string,
  ): Promise<ComplianceByRegulationResponse> {
    // Get all requirements to group by framework
    const requirements =
      await this.requirementService.findAllActiveForTenant(tenantId);

    // Group requirements by framework and count statuses
    const frameworkMap = new Map<
      string,
      { completed: number; pending: number; overdue: number }
    >();

    for (const req of requirements) {
      const framework = req.framework || 'Other';
      if (!frameworkMap.has(framework)) {
        frameworkMap.set(framework, { completed: 0, pending: 0, overdue: 0 });
      }

      const counts = frameworkMap.get(framework)!;

      // Map status to dashboard categories
      if (req.status === 'compliant') {
        counts.completed++;
      } else if (req.status === 'in_progress') {
        counts.pending++;
      } else if (req.status === 'non_compliant') {
        counts.overdue++;
      } else {
        // Default to pending for unknown statuses
        counts.pending++;
      }
    }

    // Convert map to array
    const result: ComplianceByRegulationResponse = [];
    for (const [regulation, counts] of frameworkMap) {
      result.push({
        regulation,
        completed: counts.completed,
        pending: counts.pending,
        overdue: counts.overdue,
      });
    }

    // Sort by regulation name for consistent ordering
    result.sort((a, b) => a.regulation.localeCompare(b.regulation));

    return result;
  }
}
