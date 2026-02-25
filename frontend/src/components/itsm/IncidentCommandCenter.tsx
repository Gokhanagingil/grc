/**
 * Incident Command Center
 *
 * A "wow-effect" operational dashboard that sits at the top of the Incident Detail page.
 * Provides at-a-glance situational awareness through three sections:
 *
 * 1. Operational Summary Card — key metrics in a single gradient hero card
 * 2. Health Indicators — deterministic badges for data completeness, risk/SLA/CI coverage
 * 3. Next Best Actions — rule-based recommendations panel
 *
 * All derivation is pure frontend (no extra API calls).
 */
import React, { useMemo } from 'react';
import {
  Alert,
  Box,
  Card,
  CardContent,
  Chip,
  Collapse,
  Divider,
  IconButton,
  Paper,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  ErrorOutline as ErrorIcon,
  ExpandLess as ExpandLessIcon,
  ExpandMore as ExpandMoreIcon,
  HelpOutline as HelpIcon,
  Info as InfoIcon,
  Lightbulb as LightbulbIcon,
  Shield as ShieldIcon,
  Speed as SpeedIcon,
  Storage as StorageIcon,
  TrendingUp as TrendingUpIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import {
  computeAllHealthIndicators,
  computeNextBestActions,
  deriveOperationalSummary,
  HealthIndicator,
  HealthLevel,
  IncidentSummaryInput,
  LinkedItemInput,
  NextBestAction,
  ActionSeverity,
  SlaInstanceInput,
} from '../../utils/incidentCommandCenter';
import { getPriorityLabel } from '../../utils/priorityMatrix';

// ── Props ───────────────────────────────────────────────────────────────

interface IncidentCommandCenterProps {
  incident: IncidentSummaryInput;
  linkedRisks: LinkedItemInput[];
  linkedControls: LinkedItemInput[];
  slaInstances: SlaInstanceInput[];
  affectedCiCount: number;
  matrixSource?: 'tenant' | 'default' | null;
}

// ── Color helpers ───────────────────────────────────────────────────────

function getPriorityGradient(priority: string): string {
  switch ((priority || 'p3').toLowerCase()) {
    case 'p1': return 'linear-gradient(135deg, #c62828 0%, #b71c1c 50%, #880e4f 100%)';
    case 'p2': return 'linear-gradient(135deg, #e65100 0%, #ef6c00 50%, #f57c00 100%)';
    case 'p3': return 'linear-gradient(135deg, #1565c0 0%, #1976d2 50%, #1e88e5 100%)';
    default:   return 'linear-gradient(135deg, #2e7d32 0%, #388e3c 50%, #43a047 100%)';
  }
}

function getHealthColor(level: HealthLevel): 'success' | 'warning' | 'error' | 'default' {
  switch (level) {
    case 'good': return 'success';
    case 'warning': return 'warning';
    case 'critical': return 'error';
    default: return 'default';
  }
}

function getHealthIcon(level: HealthLevel): React.ReactNode {
  switch (level) {
    case 'good': return <CheckCircleIcon fontSize="small" />;
    case 'warning': return <WarningIcon fontSize="small" />;
    case 'critical': return <ErrorIcon fontSize="small" />;
    default: return <HelpIcon fontSize="small" />;
  }
}

function getActionSeverityColor(severity: ActionSeverity): 'error' | 'warning' | 'info' | 'success' {
  switch (severity) {
    case 'high': return 'error';
    case 'medium': return 'warning';
    case 'low': return 'info';
    default: return 'success';
  }
}

function getActionIcon(severity: ActionSeverity): React.ReactNode {
  switch (severity) {
    case 'high': return <ErrorIcon fontSize="small" />;
    case 'medium': return <WarningIcon fontSize="small" />;
    case 'low': return <InfoIcon fontSize="small" />;
    default: return <LightbulbIcon fontSize="small" />;
  }
}

// ── Metric Pill sub-component ───────────────────────────────────────────

interface MetricPillProps {
  value: string | number;
  label: string;
  highlight?: boolean;
}

const MetricPill: React.FC<MetricPillProps> = ({ value, label, highlight }) => (
  <Box sx={{ textAlign: 'center', minWidth: 64, px: 1 }}>
    <Typography
      variant="h4"
      fontWeight={700}
      lineHeight={1}
      sx={{ color: highlight ? '#ffcdd2' : 'inherit' }}
    >
      {value}
    </Typography>
    <Typography variant="caption" sx={{ opacity: 0.85, whiteSpace: 'nowrap' }}>
      {label}
    </Typography>
  </Box>
);

// ── State label ─────────────────────────────────────────────────────────

function getStateLabel(state: string): string {
  const map: Record<string, string> = {
    open: 'Open',
    in_progress: 'In Progress',
    resolved: 'Resolved',
    closed: 'Closed',
    pending: 'Pending',
  };
  return map[(state || '').toLowerCase()] || state || 'Unknown';
}

function getStateBadgeColor(state: string): string {
  switch ((state || '').toLowerCase()) {
    case 'open': return 'rgba(255,255,255,0.25)';
    case 'in_progress': return 'rgba(255,193,7,0.35)';
    case 'resolved': return 'rgba(76,175,80,0.4)';
    case 'closed': return 'rgba(158,158,158,0.35)';
    default: return 'rgba(255,255,255,0.2)';
  }
}

// ── Main Component ──────────────────────────────────────────────────────

export const IncidentCommandCenter: React.FC<IncidentCommandCenterProps> = ({
  incident,
  linkedRisks,
  linkedControls,
  slaInstances,
  affectedCiCount,
  matrixSource,
}) => {
  const [actionsOpen, setActionsOpen] = React.useState(true);

  // Derive everything from props (memoized for perf)
  const summary = useMemo(
    () => deriveOperationalSummary(incident, linkedRisks, linkedControls, slaInstances, affectedCiCount),
    [incident, linkedRisks, linkedControls, slaInstances, affectedCiCount],
  );

  const healthIndicators = useMemo(
    () => computeAllHealthIndicators(incident, linkedRisks, linkedControls, slaInstances, affectedCiCount),
    [incident, linkedRisks, linkedControls, slaInstances, affectedCiCount],
  );

  const nextActions = useMemo(
    () => computeNextBestActions(incident, linkedRisks, linkedControls, slaInstances, affectedCiCount),
    [incident, linkedRisks, linkedControls, slaInstances, affectedCiCount],
  );

  return (
    <Box sx={{ mb: 3 }} data-testid="incident-command-center">
      {/* ── Section 1: Operational Summary Card ── */}
      <Card
        sx={{
          mb: 2,
          background: getPriorityGradient(summary.priority),
          color: 'white',
          borderRadius: 3,
          boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
          overflow: 'visible',
        }}
        data-testid="command-center-summary"
      >
        <CardContent sx={{ py: 2.5, '&:last-child': { pb: 2.5 } }}>
          {/* Header row */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                <SpeedIcon sx={{ fontSize: 18, opacity: 0.85 }} />
                <Typography
                  variant="overline"
                  sx={{ fontWeight: 700, letterSpacing: 1.5, lineHeight: 1 }}
                >
                  INCIDENT COMMAND CENTER
                </Typography>
              </Box>
              <Typography variant="h6" fontWeight={600} sx={{ opacity: 0.95, lineHeight: 1.3 }}>
                {summary.number} &mdash; {summary.title}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <Chip
                label={getStateLabel(summary.state)}
                size="small"
                sx={{
                  bgcolor: getStateBadgeColor(summary.state),
                  color: 'white',
                  fontWeight: 600,
                  fontSize: '0.75rem',
                }}
              />
              {incident.riskReviewRequired && (
                <Chip
                  icon={<WarningIcon sx={{ color: 'white !important', fontSize: 16 }} />}
                  label="Risk Review"
                  size="small"
                  sx={{ bgcolor: 'rgba(255,82,82,0.5)', color: 'white', fontWeight: 600 }}
                />
              )}
            </Box>
          </Box>

          {/* Metric strip */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              flexWrap: 'wrap',
              py: 1,
              px: 1,
              bgcolor: 'rgba(0,0,0,0.12)',
              borderRadius: 2,
            }}
          >
            {/* Priority */}
            <MetricPill
              value={(summary.priority || 'P3').toUpperCase()}
              label="Priority"
            />
            <Divider orientation="vertical" flexItem sx={{ borderColor: 'rgba(255,255,255,0.2)' }} />

            {/* Impact x Urgency -> Priority */}
            <Tooltip
              title={
                <Box>
                  <Typography variant="caption" fontWeight={600}>Priority Matrix</Typography>
                  <br />
                  <Typography variant="caption">
                    Impact: {(summary.impact || 'medium').charAt(0).toUpperCase() + (summary.impact || 'medium').slice(1)}
                    {' x '}
                    Urgency: {(summary.urgency || 'medium').charAt(0).toUpperCase() + (summary.urgency || 'medium').slice(1)}
                    {' = '}
                    {getPriorityLabel(summary.priority)}
                  </Typography>
                  <br />
                  <Typography variant="caption" sx={{ opacity: 0.8 }}>
                    Source: {matrixSource === 'tenant' ? 'Tenant Matrix (ITSM Studio)' : 'ITIL Default Matrix'}
                  </Typography>
                </Box>
              }
              arrow
            >
              <Box sx={{ textAlign: 'center', minWidth: 80, px: 1, cursor: 'help' }}>
                <Typography variant="body2" fontWeight={600} lineHeight={1.2}>
                  {(summary.impact || 'Med').charAt(0).toUpperCase()} x {(summary.urgency || 'Med').charAt(0).toUpperCase()}
                </Typography>
                <Typography variant="caption" sx={{ opacity: 0.8 }}>
                  Impact x Urgency
                </Typography>
              </Box>
            </Tooltip>
            <Divider orientation="vertical" flexItem sx={{ borderColor: 'rgba(255,255,255,0.2)' }} />

            {/* SLA */}
            <MetricPill
              value={summary.slaCount}
              label="SLAs"
            />
            {summary.slaBreachedCount > 0 && (
              <Chip
                label={`${summary.slaBreachedCount} Breached`}
                size="small"
                sx={{ bgcolor: 'rgba(255,82,82,0.45)', color: 'white', fontWeight: 600, fontSize: '0.7rem' }}
              />
            )}
            <Divider orientation="vertical" flexItem sx={{ borderColor: 'rgba(255,255,255,0.2)' }} />

            {/* Risks */}
            <MetricPill value={summary.linkedRiskCount} label="Risks" />
            <Divider orientation="vertical" flexItem sx={{ borderColor: 'rgba(255,255,255,0.2)' }} />

            {/* Controls */}
            <MetricPill value={summary.linkedControlCount} label="Controls" />
            <Divider orientation="vertical" flexItem sx={{ borderColor: 'rgba(255,255,255,0.2)' }} />

            {/* CIs */}
            <MetricPill value={summary.affectedCiCount} label="CIs" />

            {/* Service binding */}
            {summary.serviceName && (
              <>
                <Divider orientation="vertical" flexItem sx={{ borderColor: 'rgba(255,255,255,0.2)' }} />
                <Box sx={{ px: 1 }}>
                  <Typography variant="caption" sx={{ opacity: 0.7 }}>Service</Typography>
                  <Typography variant="body2" fontWeight={600} lineHeight={1.1}>
                    {summary.serviceName}
                  </Typography>
                </Box>
              </>
            )}
          </Box>

          {/* Footer row — last updated + matrix source */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1.5 }}>
            <Typography variant="caption" sx={{ opacity: 0.65 }}>
              {summary.lastUpdated
                ? `Last updated: ${new Date(summary.lastUpdated).toLocaleString()}`
                : ''}
            </Typography>
            <Tooltip
              title={`Priority is auto-computed via ${matrixSource === 'tenant' ? 'Tenant-specific' : 'ITIL Default'} Priority Matrix. Impact and Urgency drive the calculation.`}
              arrow
            >
              <Chip
                label={matrixSource === 'tenant' ? 'Tenant Matrix' : 'ITIL Matrix'}
                size="small"
                icon={<TrendingUpIcon sx={{ color: 'white !important', fontSize: 14 }} />}
                sx={{ bgcolor: 'rgba(255,255,255,0.18)', color: 'white', fontSize: '0.7rem', cursor: 'help' }}
                data-testid="priority-matrix-source"
              />
            </Tooltip>
          </Box>
        </CardContent>
      </Card>

      {/* ── Section 2: Health Indicators ── */}
      <Paper
        variant="outlined"
        sx={{ mb: 2, p: 2, borderRadius: 2 }}
        data-testid="command-center-health"
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
          <ShieldIcon fontSize="small" color="action" />
          <Typography variant="subtitle2" fontWeight={600} color="text.secondary">
            HEALTH INDICATORS
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
          {healthIndicators.map((indicator: HealthIndicator) => (
            <Tooltip key={indicator.key} title={indicator.detail} arrow>
              <Chip
                icon={getHealthIcon(indicator.level) as React.ReactElement}
                label={indicator.label}
                color={getHealthColor(indicator.level)}
                variant={indicator.level === 'good' ? 'outlined' : 'filled'}
                size="small"
                sx={{
                  fontWeight: 500,
                  cursor: 'help',
                  '& .MuiChip-icon': { fontSize: 16 },
                }}
                data-testid={`health-${indicator.key}`}
              />
            </Tooltip>
          ))}
        </Box>
      </Paper>

      {/* ── Section 3: Next Best Actions ── */}
      {nextActions.length > 0 && (
        <Paper
          variant="outlined"
          sx={{ mb: 2, borderRadius: 2, overflow: 'hidden' }}
          data-testid="command-center-actions"
        >
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              px: 2,
              py: 1.5,
              cursor: 'pointer',
              bgcolor: 'action.hover',
              '&:hover': { bgcolor: 'action.selected' },
            }}
            onClick={() => setActionsOpen(!actionsOpen)}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <LightbulbIcon fontSize="small" color="warning" />
              <Typography variant="subtitle2" fontWeight={600}>
                NEXT BEST ACTIONS
              </Typography>
              <Chip
                label={nextActions.length}
                size="small"
                color="warning"
                variant="outlined"
                sx={{ height: 20, fontSize: '0.7rem' }}
              />
            </Box>
            <IconButton size="small">
              {actionsOpen ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </IconButton>
          </Box>
          <Collapse in={actionsOpen}>
            <Box sx={{ px: 2, pb: 2 }}>
              {nextActions.map((action: NextBestAction) => (
                <Alert
                  key={action.id}
                  severity={getActionSeverityColor(action.severity)}
                  icon={getActionIcon(action.severity)}
                  sx={{
                    mt: 1,
                    '& .MuiAlert-message': { width: '100%' },
                    borderRadius: 1.5,
                  }}
                  data-testid={`action-${action.id}`}
                >
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <Box>
                      <Typography variant="body2" fontWeight={600}>
                        {action.title}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {action.description}
                      </Typography>
                    </Box>
                    <Chip
                      label={action.category}
                      size="small"
                      variant="outlined"
                      sx={{ ml: 1, flexShrink: 0, fontSize: '0.65rem', height: 20 }}
                    />
                  </Box>
                </Alert>
              ))}
            </Box>
          </Collapse>
        </Paper>
      )}

      {/* If no actions needed, show a success state */}
      {nextActions.length === 0 && (
        <Paper
          variant="outlined"
          sx={{ mb: 2, p: 2, borderRadius: 2, display: 'flex', alignItems: 'center', gap: 1.5 }}
          data-testid="command-center-no-actions"
        >
          <CheckCircleIcon color="success" />
          <Box>
            <Typography variant="subtitle2" fontWeight={600} color="success.main">
              All Clear
            </Typography>
            <Typography variant="caption" color="text.secondary">
              No recommended actions at this time. All key areas are covered.
            </Typography>
          </Box>
        </Paper>
      )}
    </Box>
  );
};

export default IncidentCommandCenter;
