/**
 * TopologyGovernanceDecisionPanel
 *
 * Displays topology-aware governance decision support for a change:
 * - Decision chips (Allowed / CAB Required / Blocked / Additional Evidence Required)
 * - "Why?" expandable explainability
 * - Recommended actions checklist
 * - Re-evaluate governance action with loading + result feedback
 * - Non-blocking: if topology intelligence fails/403, show banner and let core change workflow continue
 *
 * Phase-C, Phase 1: Change Governance Auto-Enforcement (Topology-aware)
 */
import React, { useState } from 'react';
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
import GavelIcon from '@mui/icons-material/Gavel';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import BlockIcon from '@mui/icons-material/Block';
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import RefreshIcon from '@mui/icons-material/Refresh';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import LockIcon from '@mui/icons-material/Lock';
import AssignmentIcon from '@mui/icons-material/Assignment';

import type {
  TopologyGovernanceEvaluationData,
  TopologyGovernanceDecision,
  TopologyGovernanceFactor,
  TopologyGovernanceAction,
} from '../../services/grcClient';
import type { ClassifiedTopologyError } from './topology-utils';

// ==========================================================================
// Props
// ==========================================================================

export interface TopologyGovernanceDecisionPanelProps {
  /** Governance evaluation data (null while loading or on error) */
  governance: TopologyGovernanceEvaluationData | null;
  /** Loading state */
  loading: boolean;
  /** Error state */
  error: ClassifiedTopologyError | null;
  /** Called when user clicks "Re-evaluate Governance" */
  onReEvaluate?: () => void;
  /** Whether re-evaluation is in progress */
  reEvaluating?: boolean;
}

// ==========================================================================
// Helpers
// ==========================================================================

const DECISION_CONFIG: Record<
  TopologyGovernanceDecision,
  {
    label: string;
    color: 'success' | 'warning' | 'error' | 'info';
    icon: React.ReactNode;
    chipVariant: 'filled' | 'outlined';
  }
> = {
  ALLOWED: {
    label: 'Allowed',
    color: 'success',
    icon: <CheckCircleIcon fontSize="small" />,
    chipVariant: 'filled',
  },
  CAB_REQUIRED: {
    label: 'CAB Required',
    color: 'warning',
    icon: <GavelIcon fontSize="small" />,
    chipVariant: 'filled',
  },
  BLOCKED: {
    label: 'Blocked',
    color: 'error',
    icon: <BlockIcon fontSize="small" />,
    chipVariant: 'filled',
  },
  ADDITIONAL_EVIDENCE_REQUIRED: {
    label: 'Additional Evidence Required',
    color: 'info',
    icon: <AssignmentIcon fontSize="small" />,
    chipVariant: 'filled',
  },
};

function getSeverityColor(severity: TopologyGovernanceFactor['severity']): 'error' | 'warning' | 'info' {
  switch (severity) {
    case 'critical':
      return 'error';
    case 'warning':
      return 'warning';
    default:
      return 'info';
  }
}

// ==========================================================================
// Component
// ==========================================================================

export const TopologyGovernanceDecisionPanel: React.FC<TopologyGovernanceDecisionPanelProps> = ({
  governance,
  loading,
  error,
  onReEvaluate,
  reEvaluating = false,
}) => {
  const [showExplainability, setShowExplainability] = useState(false);

  // --- Permission denied state ---
  if (error?.type === 'forbidden') {
    return (
      <Card data-testid="topology-governance-panel">
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <GavelIcon color="action" />
            <Typography variant="h6">Governance Decision Support</Typography>
          </Box>
          <Alert severity="warning" icon={<LockIcon />} data-testid="topology-governance-permission-denied">
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
      <Card data-testid="topology-governance-panel">
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <GavelIcon color="action" />
            <Typography variant="h6">Governance Decision Support</Typography>
          </Box>
          <Skeleton variant="rectangular" height={36} sx={{ mb: 1.5, borderRadius: 1 }} />
          <Skeleton variant="text" width="70%" />
          <Skeleton variant="text" width="50%" />
          <Skeleton variant="rectangular" height={100} sx={{ mt: 1.5, borderRadius: 1 }} />
        </CardContent>
      </Card>
    );
  }

  // --- Error state ---
  if (error) {
    return (
      <Card data-testid="topology-governance-panel">
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <GavelIcon color="action" />
            <Typography variant="h6">Governance Decision Support</Typography>
          </Box>
          <Alert
            severity="error"
            icon={<ErrorOutlineIcon />}
            data-testid="topology-governance-error"
            action={
              onReEvaluate ? (
                <Button color="inherit" size="small" onClick={onReEvaluate} disabled={reEvaluating}>
                  Retry
                </Button>
              ) : undefined
            }
          >
            <AlertTitle>Governance Evaluation Failed</AlertTitle>
            {error.message}
          </Alert>
        </CardContent>
      </Card>
    );
  }

  // --- Empty state ---
  if (!governance) {
    return (
      <Card data-testid="topology-governance-panel">
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <GavelIcon color="action" />
            <Typography variant="h6">Governance Decision Support</Typography>
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            Topology governance has not been evaluated yet. Click below to evaluate governance controls
            based on topology impact analysis.
          </Typography>
          {onReEvaluate && (
            <Button
              size="small"
              variant="outlined"
              startIcon={reEvaluating ? <CircularProgress size={14} /> : <VerifiedUserIcon />}
              onClick={onReEvaluate}
              disabled={reEvaluating}
              data-testid="topology-governance-evaluate-btn"
            >
              {reEvaluating ? 'Evaluating...' : 'Evaluate Governance'}
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  // --- Data state ---
  const decisionCfg = DECISION_CONFIG[governance.decision];
  const requiredUnsatisfied = governance.recommendedActions.filter(
    (a: TopologyGovernanceAction) => a.required && !a.satisfied,
  );

  return (
    <Card data-testid="topology-governance-panel">
      <CardContent>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <GavelIcon color="action" />
            <Typography variant="h6">Governance Decision Support</Typography>
          </Box>
          {onReEvaluate && (
            <Tooltip title="Re-evaluate governance based on latest topology data">
              <span>
                <IconButton
                  size="small"
                  onClick={onReEvaluate}
                  disabled={reEvaluating}
                  data-testid="topology-governance-reevaluate-btn"
                >
                  {reEvaluating ? <CircularProgress size={18} /> : <RefreshIcon />}
                </IconButton>
              </span>
            </Tooltip>
          )}
        </Box>

        {/* Decision chip */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
          <Chip
            icon={decisionCfg.icon as React.ReactElement}
            label={decisionCfg.label}
            color={decisionCfg.color}
            variant={decisionCfg.chipVariant}
            data-testid="topology-governance-decision-chip"
          />
          {!governance.topologyDataAvailable && (
            <Chip
              label="Without Topology"
              size="small"
              variant="outlined"
              color="warning"
              data-testid="topology-governance-no-topology-chip"
            />
          )}
        </Box>

        {/* Summary */}
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          {governance.explainability.summary}
        </Typography>

        {/* Warnings */}
        {governance.warnings.length > 0 && (
          <Box sx={{ mb: 1.5 }}>
            {governance.warnings.map((warning: string, idx: number) => (
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

        {/* Why? Explainability toggle */}
        <Button
          size="small"
          variant="text"
          onClick={() => setShowExplainability(!showExplainability)}
          endIcon={showExplainability ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          data-testid="topology-governance-why-btn"
          sx={{ mb: 1 }}
        >
          Why?
        </Button>

        <Collapse in={showExplainability}>
          <Box
            sx={{ bgcolor: 'action.hover', borderRadius: 1, p: 1.5, mb: 1.5 }}
            data-testid="topology-governance-explainability"
          >
            {/* Factors */}
            <Typography variant="subtitle2" gutterBottom>
              Contributing Factors
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1.5 }}>
              {governance.explainability.factors.map((factor: TopologyGovernanceFactor, idx: number) => (
                <Tooltip key={idx} title={factor.explanation}>
                  <Chip
                    label={`${factor.label}: ${factor.value}`}
                    size="small"
                    color={getSeverityColor(factor.severity)}
                    variant="outlined"
                    data-testid={`topology-governance-factor-${factor.key}`}
                  />
                </Tooltip>
              ))}
            </Box>

            {/* Matched policies */}
            {governance.explainability.matchedPolicyNames.length > 0 && (
              <>
                <Typography variant="subtitle2" gutterBottom>
                  Matched Policies
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1.5 }}>
                  {governance.explainability.matchedPolicyNames.map((name: string, idx: number) => (
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
            {governance.explainability.topDependencyPaths.length > 0 && (
              <>
                <Typography variant="subtitle2" gutterBottom>
                  Top Dependency Paths
                </Typography>
                {governance.explainability.topDependencyPaths.map(
                  (path: { nodeLabels: string[]; depth: number }, idx: number) => (
                    <Typography
                      key={idx}
                      variant="caption"
                      sx={{ display: 'block', mb: 0.5, fontFamily: 'monospace' }}
                      data-testid={`topology-governance-path-${idx}`}
                    >
                      {path.nodeLabels.join(' → ')} (depth: {path.depth})
                    </Typography>
                  ),
                )}
              </>
            )}
          </Box>
        </Collapse>

        <Divider sx={{ mb: 1.5 }} />

        {/* Recommended Actions Checklist */}
        <Typography variant="subtitle2" gutterBottom>
          {requiredUnsatisfied.length > 0
            ? `Recommended Actions (${requiredUnsatisfied.length} outstanding)`
            : 'Recommended Actions'}
        </Typography>
        <List dense disablePadding data-testid="topology-governance-actions-list">
          {governance.recommendedActions.map((action: TopologyGovernanceAction) => (
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
                data-testid={`topology-governance-action-${action.key}`}
              />
            </ListItem>
          ))}
        </List>

        {/* Evaluated at */}
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1 }}>
          <Typography variant="caption" color="text.secondary">
            Evaluated: {new Date(governance.evaluatedAt).toLocaleString()}
          </Typography>
        </Box>
      </CardContent>
    </Card>
  );
};

export default TopologyGovernanceDecisionPanel;
