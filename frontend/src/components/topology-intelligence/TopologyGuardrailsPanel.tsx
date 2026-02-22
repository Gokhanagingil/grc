/**
 * TopologyGuardrailsPanel
 *
 * Displays topology-driven change guardrails with actionable UX:
 * - Status badge (PASS / WARN / BLOCK)
 * - Explainability (reasons + metrics)
 * - Recommended actions checklist
 * - "Recalculate" CTA
 * - "Copy Summary" / "Add Work Note" quick actions
 * - Evidence summary with blast radius metrics
 * - Non-blocking: if topology intelligence fails/403, show banner
 *
 * Phase B: Actionable UX on Change (Frontend)
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  CardContent,
  Box,
  Typography,
  Chip,
  Button,
  Collapse,
  Alert,
  AlertTitle,
  Divider,
  Skeleton,
  CircularProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Tooltip,
  IconButton,
} from '@mui/material';
import ShieldIcon from '@mui/icons-material/Shield';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import BlockIcon from '@mui/icons-material/Block';
import RefreshIcon from '@mui/icons-material/Refresh';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import LockIcon from '@mui/icons-material/Lock';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import NoteAddIcon from '@mui/icons-material/NoteAdd';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';

import type {
  TopologyGuardrailEvaluationData,
  GuardrailStatus,
  GuardrailReason,
  TopologyGovernanceAction,
  TopologyGovernanceFactor,
} from '../../services/grcClient';
import {
  classifyTopologyApiError,
} from './topology-utils';
import type { ClassifiedTopologyError } from './topology-utils';

// ==========================================================================
// Props
// ==========================================================================

export interface TopologyGuardrailsPanelProps {
  /** Change ID to fetch guardrails for */
  changeId: string;
  /** Callback to fetch guardrails from API */
  onFetch: (changeId: string) => Promise<TopologyGuardrailEvaluationData>;
  /** Callback to recalculate guardrails via API */
  onRecalculate: (changeId: string) => Promise<TopologyGuardrailEvaluationData>;
  /** Callback when user clicks "Add Work Note" (optional) */
  onAddWorkNote?: (summary: string) => void;
}

// ==========================================================================
// Helpers
// ==========================================================================

const STATUS_CONFIG: Record<
  GuardrailStatus,
  {
    label: string;
    color: 'success' | 'warning' | 'error';
    icon: React.ReactNode;
    bgGradient: string;
  }
> = {
  PASS: {
    label: 'Pass',
    color: 'success',
    icon: <CheckCircleIcon fontSize="small" />,
    bgGradient: 'linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%)',
  },
  WARN: {
    label: 'Warning',
    color: 'warning',
    icon: <WarningAmberIcon fontSize="small" />,
    bgGradient: 'linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%)',
  },
  BLOCK: {
    label: 'Blocked',
    color: 'error',
    icon: <BlockIcon fontSize="small" />,
    bgGradient: 'linear-gradient(135deg, #ffebee 0%, #ffcdd2 100%)',
  },
};

function getReasonSeverityColor(severity: GuardrailReason['severity']): 'error' | 'warning' | 'info' {
  switch (severity) {
    case 'critical':
      return 'error';
    case 'warning':
      return 'warning';
    default:
      return 'info';
  }
}

/**
 * Build a human-readable text summary of the guardrail evaluation
 * for clipboard copy / work note.
 */
function buildSummaryText(data: TopologyGuardrailEvaluationData): string {
  const lines: string[] = [];
  lines.push(`Topology Guardrail: ${data.guardrailStatus}`);
  lines.push(`Governance Decision: ${data.governanceDecision}`);
  lines.push(`Risk Score: ${data.policyFlags.topologyRiskScore}/100`);
  lines.push('');

  if (data.reasons.length > 0) {
    lines.push('Reasons:');
    data.reasons.forEach((r) => {
      lines.push(`  [${r.severity.toUpperCase()}] ${r.message}`);
    });
    lines.push('');
  }

  const ev = data.evidenceSummary;
  lines.push('Evidence:');
  lines.push(`  Impacted Nodes: ${ev.blastRadiusMetrics.totalImpactedNodes}`);
  lines.push(`  Critical CIs: ${ev.blastRadiusMetrics.criticalCiCount}`);
  lines.push(`  Impacted Services: ${ev.blastRadiusMetrics.impactedServiceCount}`);
  lines.push(`  Max Chain Depth: ${ev.blastRadiusMetrics.maxChainDepth}`);
  lines.push(`  Cross-Service: ${ev.blastRadiusMetrics.crossServicePropagation ? 'Yes' : 'No'}`);
  if (ev.singlePointsOfFailure.length > 0) {
    lines.push(`  SPOFs: ${ev.singlePointsOfFailure.join(', ')}`);
  }
  lines.push('');

  if (data.recommendedActions.length > 0) {
    const unsatisfied = data.recommendedActions.filter((a) => !a.satisfied);
    if (unsatisfied.length > 0) {
      lines.push('Outstanding Actions:');
      unsatisfied.forEach((a) => {
        lines.push(`  ${a.required ? '[REQUIRED]' : '[OPTIONAL]'} ${a.label}`);
      });
    }
  }

  lines.push('');
  lines.push(`Evaluated: ${new Date(data.evaluatedAt).toLocaleString()}`);
  return lines.join('\n');
}

// ==========================================================================
// Component
// ==========================================================================

export const TopologyGuardrailsPanel: React.FC<TopologyGuardrailsPanelProps> = ({
  changeId,
  onFetch,
  onRecalculate,
  onAddWorkNote,
}) => {
  const [data, setData] = useState<TopologyGuardrailEvaluationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ClassifiedTopologyError | null>(null);
  const [recalculating, setRecalculating] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [showEvidence, setShowEvidence] = useState(false);
  const [showExplainability, setShowExplainability] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  const fetchGuardrails = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await onFetch(changeId);
      setData(result);
    } catch (err) {
      const classified = classifyTopologyApiError(err);
      setError(classified);
    } finally {
      setLoading(false);
    }
  }, [changeId, onFetch]);

  useEffect(() => {
    fetchGuardrails();
  }, [fetchGuardrails]);

  const handleRecalculate = useCallback(async () => {
    setRecalculating(true);
    setError(null);
    try {
      const result = await onRecalculate(changeId);
      setData(result);
    } catch (err) {
      const classified = classifyTopologyApiError(err);
      setError(classified);
    } finally {
      setRecalculating(false);
    }
  }, [changeId, onRecalculate]);

  const handleCopySummary = useCallback(() => {
    if (!data) return;
    const text = buildSummaryText(data);
    navigator.clipboard.writeText(text).then(() => {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    }).catch(() => {
      // Fallback: just ignore if clipboard not available
    });
  }, [data]);

  const handleAddWorkNote = useCallback(() => {
    if (!data || !onAddWorkNote) return;
    const text = buildSummaryText(data);
    onAddWorkNote(text);
  }, [data, onAddWorkNote]);

  // --- Permission denied state ---
  if (error?.type === 'forbidden') {
    return (
      <Card data-testid="topology-guardrails-panel">
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <ShieldIcon color="action" />
            <Typography variant="h6">Topology Guardrails</Typography>
          </Box>
          <Alert severity="warning" icon={<LockIcon />} data-testid="topology-guardrails-permission-denied">
            <AlertTitle>Permission Required</AlertTitle>
            {error.message}
          </Alert>
        </CardContent>
      </Card>
    );
  }

  // --- Loading state ---
  if (loading) {
    return (
      <Card data-testid="topology-guardrails-panel">
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <ShieldIcon color="action" />
            <Typography variant="h6">Topology Guardrails</Typography>
          </Box>
          <Skeleton variant="rectangular" height={48} sx={{ mb: 1.5, borderRadius: 1 }} data-testid="topology-guardrails-loading" />
          <Skeleton variant="text" width="70%" />
          <Skeleton variant="text" width="50%" />
          <Skeleton variant="rectangular" height={80} sx={{ mt: 1.5, borderRadius: 1 }} />
        </CardContent>
      </Card>
    );
  }

  // --- Error state ---
  if (error) {
    return (
      <Card data-testid="topology-guardrails-panel">
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <ShieldIcon color="action" />
            <Typography variant="h6">Topology Guardrails</Typography>
          </Box>
          <Alert
            severity="error"
            icon={<ErrorOutlineIcon />}
            data-testid="topology-guardrails-error"
            action={
              <Button color="inherit" size="small" onClick={fetchGuardrails}>
                Retry
              </Button>
            }
          >
            <AlertTitle>Guardrail Evaluation Failed</AlertTitle>
            {error.message}
          </Alert>
        </CardContent>
      </Card>
    );
  }

  // --- Empty state (no data) ---
  if (!data) {
    return (
      <Card data-testid="topology-guardrails-panel">
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <ShieldIcon color="action" />
            <Typography variant="h6">Topology Guardrails</Typography>
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            Topology guardrails have not been evaluated yet.
          </Typography>
          <Button
            size="small"
            variant="outlined"
            startIcon={recalculating ? <CircularProgress size={14} /> : <ShieldIcon />}
            onClick={handleRecalculate}
            disabled={recalculating}
            data-testid="topology-guardrails-evaluate-btn"
          >
            {recalculating ? 'Evaluating...' : 'Evaluate Guardrails'}
          </Button>
        </CardContent>
      </Card>
    );
  }

  // --- Data state ---
  const statusCfg = STATUS_CONFIG[data.guardrailStatus] || STATUS_CONFIG.PASS;
  const requiredUnsatisfied = data.recommendedActions.filter(
    (a: TopologyGovernanceAction) => a.required && !a.satisfied,
  );
  const ev = data.evidenceSummary;

  return (
    <Card data-testid="topology-guardrails-panel" variant="outlined" sx={{ mb: 2 }}>
      <CardContent sx={{ pb: '16px !important' }}>
        {/* Header with toggle */}
        <Box
          sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
          onClick={() => setExpanded(!expanded)}
          data-testid="topology-guardrails-header"
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <ShieldIcon color="action" />
            <Typography variant="h6">Topology Guardrails</Typography>
            <Chip
              icon={statusCfg.icon as React.ReactElement}
              label={statusCfg.label}
              color={statusCfg.color}
              variant="filled"
              size="small"
              data-testid="topology-guardrails-status-chip"
            />
            {requiredUnsatisfied.length > 0 && (
              <Chip
                label={`${requiredUnsatisfied.length} action${requiredUnsatisfied.length !== 1 ? 's' : ''} required`}
                color="error"
                variant="outlined"
                size="small"
              />
            )}
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Tooltip title="Recalculate guardrails">
              <span>
                <IconButton
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRecalculate();
                  }}
                  disabled={recalculating}
                  data-testid="topology-guardrails-recalculate-btn"
                >
                  {recalculating ? <CircularProgress size={18} /> : <RefreshIcon />}
                </IconButton>
              </span>
            </Tooltip>
            <IconButton size="small">
              {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </IconButton>
          </Box>
        </Box>

        <Collapse in={expanded}>
          {/* Status banner */}
          <Box
            sx={{
              mt: 1.5,
              p: 1.5,
              borderRadius: 1,
              background: statusCfg.bgGradient,
            }}
            data-testid="topology-guardrails-status-banner"
          >
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Box sx={{ textAlign: 'center', minWidth: 60 }}>
                  <Typography variant="h4" fontWeight={700} lineHeight={1}>
                    {data.policyFlags.topologyRiskScore}
                  </Typography>
                  <Typography variant="caption">Risk Score</Typography>
                </Box>
                <Divider orientation="vertical" flexItem />
                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                  <Typography variant="body2">
                    {ev.blastRadiusMetrics.totalImpactedNodes} nodes impacted
                  </Typography>
                  <Typography variant="body2">
                    {ev.blastRadiusMetrics.criticalCiCount} critical CIs
                  </Typography>
                  <Typography variant="body2">
                    {ev.blastRadiusMetrics.impactedServiceCount} services
                  </Typography>
                </Box>
              </Box>
              {!ev.topologyDataAvailable && (
                <Chip
                  label="Without Topology"
                  size="small"
                  variant="outlined"
                  color="warning"
                  data-testid="topology-guardrails-no-topology-chip"
                />
              )}
            </Box>
          </Box>

          {/* Warnings */}
          {data.warnings.length > 0 && (
            <Box sx={{ mt: 1.5 }}>
              {data.warnings.map((warning: string, idx: number) => (
                <Alert
                  key={idx}
                  severity="warning"
                  sx={{ py: 0, mb: 0.5 }}
                  icon={<WarningAmberIcon fontSize="small" />}
                >
                  <Typography variant="caption">{warning}</Typography>
                </Alert>
              ))}
            </Box>
          )}

          {/* Reasons */}
          {data.reasons.length > 0 && (
            <Box sx={{ mt: 1.5 }}>
              <Typography variant="subtitle2" gutterBottom>
                Reasons
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {data.reasons.map((reason: GuardrailReason, idx: number) => (
                  <Tooltip key={idx} title={reason.message}>
                    <Chip
                      label={reason.code.replace(/_/g, ' ')}
                      size="small"
                      color={getReasonSeverityColor(reason.severity)}
                      variant="outlined"
                      data-testid={`topology-guardrails-reason-${reason.code}`}
                    />
                  </Tooltip>
                ))}
              </Box>
            </Box>
          )}

          <Divider sx={{ my: 1.5 }} />

          {/* Recommended Actions Checklist */}
          <Typography variant="subtitle2" gutterBottom>
            {requiredUnsatisfied.length > 0
              ? `Recommended Actions (${requiredUnsatisfied.length} outstanding)`
              : 'Recommended Actions'}
          </Typography>
          <List dense disablePadding data-testid="topology-guardrails-actions-list">
            {data.recommendedActions.map((action: TopologyGovernanceAction) => (
              <ListItem key={action.key} disablePadding sx={{ py: 0.25 }}>
                <ListItemIcon sx={{ minWidth: 32 }}>
                  {action.satisfied ? (
                    <CheckCircleIcon fontSize="small" color="success" />
                  ) : action.required ? (
                    <RadioButtonUncheckedIcon fontSize="small" color="error" />
                  ) : (
                    <CheckCircleOutlineIcon fontSize="small" color="action" />
                  )}
                </ListItemIcon>
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Typography
                        variant="body2"
                        sx={{
                          textDecoration: action.satisfied ? 'line-through' : 'none',
                          color: action.satisfied ? 'text.disabled' : 'text.primary',
                        }}
                      >
                        {action.label}
                      </Typography>
                      {action.required && !action.satisfied && (
                        <Chip label="Required" size="small" color="error" variant="outlined" sx={{ height: 18, fontSize: 10 }} />
                      )}
                    </Box>
                  }
                  secondary={action.reason}
                  data-testid={`topology-guardrails-action-${action.key}`}
                />
              </ListItem>
            ))}
          </List>

          {/* Evidence Summary toggle */}
          <Button
            size="small"
            variant="text"
            onClick={() => setShowEvidence(!showEvidence)}
            endIcon={showEvidence ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            data-testid="topology-guardrails-evidence-toggle"
            sx={{ mt: 1 }}
          >
            Evidence Summary
          </Button>

          <Collapse in={showEvidence}>
            <Box
              sx={{ bgcolor: 'action.hover', borderRadius: 1, p: 1.5, mt: 0.5 }}
              data-testid="topology-guardrails-evidence"
            >
              <Typography variant="subtitle2" gutterBottom>Blast Radius</Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 1.5 }}>
                <Chip
                  label={`${ev.blastRadiusMetrics.totalImpactedNodes} impacted nodes`}
                  size="small"
                  variant="outlined"
                />
                <Chip
                  label={`${ev.blastRadiusMetrics.criticalCiCount} critical CIs`}
                  size="small"
                  variant="outlined"
                  color={ev.blastRadiusMetrics.criticalCiCount > 0 ? 'error' : 'default'}
                />
                <Chip
                  label={`${ev.blastRadiusMetrics.impactedServiceCount} services`}
                  size="small"
                  variant="outlined"
                />
                <Chip
                  label={`depth: ${ev.blastRadiusMetrics.maxChainDepth}`}
                  size="small"
                  variant="outlined"
                />
                {ev.blastRadiusMetrics.crossServicePropagation && (
                  <Chip
                    label="Cross-service propagation"
                    size="small"
                    color="warning"
                    variant="outlined"
                  />
                )}
              </Box>

              {ev.singlePointsOfFailure.length > 0 && (
                <>
                  <Typography variant="subtitle2" gutterBottom>
                    Single Points of Failure
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1.5 }}>
                    {ev.singlePointsOfFailure.map((spof: string, idx: number) => (
                      <Chip
                        key={idx}
                        label={spof}
                        size="small"
                        color="error"
                        variant="outlined"
                        icon={<WarningAmberIcon />}
                      />
                    ))}
                  </Box>
                </>
              )}

              {ev.fragileDependencies.length > 0 && (
                <>
                  <Typography variant="subtitle2" gutterBottom>
                    Fragile Dependencies
                  </Typography>
                  {ev.fragileDependencies.map((dep, idx) => (
                    <Typography
                      key={idx}
                      variant="caption"
                      sx={{ display: 'block', mb: 0.25 }}
                    >
                      <strong>{dep.affectedNodeLabel}</strong>: {dep.description} ({dep.type})
                    </Typography>
                  ))}
                </>
              )}
            </Box>
          </Collapse>

          {/* Explainability toggle (full governance factors) */}
          <Button
            size="small"
            variant="text"
            onClick={() => setShowExplainability(!showExplainability)}
            endIcon={showExplainability ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            data-testid="topology-guardrails-why-btn"
            sx={{ mt: 0.5 }}
          >
            Why?
          </Button>

          <Collapse in={showExplainability}>
            <Box
              sx={{ bgcolor: 'action.hover', borderRadius: 1, p: 1.5, mt: 0.5 }}
              data-testid="topology-guardrails-explainability"
            >
              {/* Summary */}
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                {data.explainability.summary}
              </Typography>

              {/* Factors */}
              <Typography variant="subtitle2" gutterBottom>
                Contributing Factors
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1.5 }}>
                {data.explainability.factors.map((factor: TopologyGovernanceFactor, idx: number) => (
                  <Tooltip key={idx} title={factor.explanation}>
                    <Chip
                      label={`${factor.label}: ${factor.value}`}
                      size="small"
                      color={getReasonSeverityColor(factor.severity)}
                      variant="outlined"
                      data-testid={`topology-guardrails-factor-${factor.key}`}
                    />
                  </Tooltip>
                ))}
              </Box>

              {/* Matched policies */}
              {data.explainability.matchedPolicyNames.length > 0 && (
                <>
                  <Typography variant="subtitle2" gutterBottom>
                    Matched Policies
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1.5 }}>
                    {data.explainability.matchedPolicyNames.map((name: string, idx: number) => (
                      <Chip
                        key={idx}
                        label={name}
                        size="small"
                        variant="outlined"
                        icon={<InfoOutlinedIcon />}
                      />
                    ))}
                  </Box>
                </>
              )}

              {/* Top dependency paths */}
              {data.explainability.topDependencyPaths.length > 0 && (
                <>
                  <Typography variant="subtitle2" gutterBottom>
                    Top Dependency Paths
                  </Typography>
                  {data.explainability.topDependencyPaths.map(
                    (path: { nodeLabels: string[]; depth: number }, idx: number) => (
                      <Typography
                        key={idx}
                        variant="caption"
                        sx={{ display: 'block', mb: 0.5, fontFamily: 'monospace' }}
                        data-testid={`topology-guardrails-path-${idx}`}
                      >
                        {path.nodeLabels.join(' \u2192 ')} (depth: {path.depth})
                      </Typography>
                    ),
                  )}
                </>
              )}
            </Box>
          </Collapse>

          {/* Previous evaluation diff */}
          {data.previousEvaluation && (
            <Alert
              severity="info"
              sx={{ mt: 1.5 }}
              data-testid="topology-guardrails-previous-eval"
            >
              <Typography variant="caption">
                Previous: {data.previousEvaluation.guardrailStatus} (score: {data.previousEvaluation.topologyRiskScore})
                at {new Date(data.previousEvaluation.evaluatedAt).toLocaleString()}
              </Typography>
            </Alert>
          )}

          <Divider sx={{ my: 1.5 }} />

          {/* Quick Actions Row */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Tooltip title={copySuccess ? 'Copied!' : 'Copy summary to clipboard'}>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<ContentCopyIcon />}
                  onClick={handleCopySummary}
                  data-testid="topology-guardrails-copy-btn"
                >
                  {copySuccess ? 'Copied!' : 'Copy Summary'}
                </Button>
              </Tooltip>
              {onAddWorkNote && (
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<NoteAddIcon />}
                  onClick={handleAddWorkNote}
                  data-testid="topology-guardrails-worknote-btn"
                >
                  Add Work Note
                </Button>
              )}
            </Box>
            <Typography variant="caption" color="text.secondary">
              Evaluated: {new Date(data.evaluatedAt).toLocaleString()}
            </Typography>
          </Box>
        </Collapse>
      </CardContent>
    </Card>
  );
};

export default TopologyGuardrailsPanel;
