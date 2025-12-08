/**
 * Dashboard Overview DTOs
 *
 * Response types for the Dashboard API endpoints.
 * These DTOs define the exact shape expected by the frontend Dashboard.
 */

/**
 * Top 5 open risk item for dashboard display
 */
export interface Top5RiskItem {
  id: string;
  title: string;
  severity: string;
  score: number | null;
}

/**
 * Risk summary for dashboard overview
 */
export interface DashboardRiskSummary {
  total: number;
  open: number;
  high: number;
  overdue: number;
  top5OpenRisks: Top5RiskItem[];
}

/**
 * Compliance summary for dashboard overview
 */
export interface DashboardComplianceSummary {
  total: number;
  pending: number;
  completed: number;
  overdue: number;
  coveragePercentage: number;
}

/**
 * Policy summary for dashboard overview
 */
export interface DashboardPolicySummary {
  total: number;
  active: number;
  draft: number;
  coveragePercentage: number;
}

/**
 * Incident summary for dashboard overview
 */
export interface DashboardIncidentSummary {
  total: number;
  open: number;
  closed: number;
  resolved: number;
  resolvedToday: number;
  avgResolutionTimeHours: number | null;
}

/**
 * User summary for dashboard overview
 */
export interface DashboardUserSummary {
  total: number;
  admins: number;
  managers: number;
}

/**
 * Complete dashboard overview response
 */
export interface DashboardOverviewResponse {
  risks: DashboardRiskSummary;
  compliance: DashboardComplianceSummary;
  policies: DashboardPolicySummary;
  incidents: DashboardIncidentSummary;
  users: DashboardUserSummary;
}

/**
 * Risk trend data point for time-series chart
 */
export interface RiskTrendDataPoint {
  date: string;
  total_risks: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
}

/**
 * Risk trends response (array of data points)
 */
export type RiskTrendsResponse = RiskTrendDataPoint[];

/**
 * Compliance by regulation data point
 */
export interface ComplianceByRegulationItem {
  regulation: string;
  completed: number;
  pending: number;
  overdue: number;
}

/**
 * Compliance by regulation response (array of items)
 */
export type ComplianceByRegulationResponse = ComplianceByRegulationItem[];
