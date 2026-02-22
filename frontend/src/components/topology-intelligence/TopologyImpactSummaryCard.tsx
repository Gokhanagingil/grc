/**
 * TopologyImpactSummaryCard
 * Displays overall topology impact score, blast radius counts,
 * fragility signals, and warnings for a change.
 */
import React from 'react';
import {
  Card,
  CardContent,
  Box,
  Typography,
  Chip,
  Divider,
  Skeleton,
  Alert,
  AlertTitle,
  Button,
  Tooltip,
  CircularProgress,
} from '@mui/material';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import SecurityIcon from '@mui/icons-material/Security';
import HubIcon from '@mui/icons-material/Hub';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import RefreshIcon from '@mui/icons-material/Refresh';
import LockIcon from '@mui/icons-material/Lock';

import type { TopologyImpactResponseData } from '../../services/grcClient';
import {
  getTopologyRiskLevel,
  getRiskLevelColor,
  getImpactSummaryText,
  getFragilitySignalLabel,
  type ClassifiedTopologyError,
} from './topology-utils';

export interface TopologyImpactSummaryCardProps {
  /** Topology impact data (null while loading or on error) */
  impact: TopologyImpactResponseData | null;
  /** Loading state */
  loading: boolean;
  /** Error state */
  error: ClassifiedTopologyError | null;
  /** Called when user clicks Recalculate */
  onRecalculate?: () => void;
  /** Whether recalculation is in progress */
  recalculating?: boolean;
  /** Called when user clicks Retry after an error */
  onRetry?: () => void;
}

export const TopologyImpactSummaryCard: React.FC<TopologyImpactSummaryCardProps> = ({
  impact,
  loading,
  error,
  onRecalculate,
  recalculating = false,
  onRetry,
}) => {
  // --- Permission denied state ---
  if (error?.type === 'forbidden') {
    return (
      <Card data-testid="topology-impact-summary-card">
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <HubIcon color="action" />
            <Typography variant="h6">Topology Impact</Typography>
          </Box>
          <Alert severity="warning" icon={<LockIcon />} data-testid="topology-permission-denied">
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
      <Card data-testid="topology-impact-summary-card">
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <HubIcon color="action" />
            <Typography variant="h6">Topology Impact</Typography>
          </Box>
          <Skeleton variant="rectangular" height={40} sx={{ mb: 1, borderRadius: 1 }} />
          <Skeleton variant="text" width="60%" />
          <Skeleton variant="text" width="80%" />
          <Skeleton variant="text" width="40%" />
        </CardContent>
      </Card>
    );
  }

  // --- Error state ---
  if (error) {
    return (
      <Card data-testid="topology-impact-summary-card">
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <HubIcon color="action" />
            <Typography variant="h6">Topology Impact</Typography>
          </Box>
          <Alert
            severity={error.type === 'not_found' ? 'info' : 'error'}
            icon={<ErrorOutlineIcon />}
            data-testid="topology-impact-error"
            action={
              error.retryable && onRetry ? (
                <Button color="inherit" size="small" onClick={onRetry}>
                  Retry
                </Button>
              ) : undefined
            }
          >
            {error.message}
          </Alert>
        </CardContent>
      </Card>
    );
  }

  // --- Empty state (no data, no error) ---
  if (!impact) {
    return (
      <Card data-testid="topology-impact-summary-card">
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <HubIcon color="action" />
            <Typography variant="h6">Topology Impact</Typography>
          </Box>
          <Typography variant="body2" color="text.secondary">
            No topology impact analysis available. Bind a service and click Recalculate to generate one.
          </Typography>
          {onRecalculate && (
            <Button
              size="small"
              startIcon={<RefreshIcon />}
              onClick={onRecalculate}
              disabled={recalculating}
              sx={{ mt: 1 }}
            >
              {recalculating ? 'Analyzing...' : 'Calculate Impact'}
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  // --- Data state ---
  const riskLevel = getTopologyRiskLevel(impact.topologyRiskScore);
  const riskColor = getRiskLevelColor(riskLevel);
  const { metrics, fragilitySignals, warnings } = impact;

  return (
    <Card data-testid="topology-impact-summary-card">
      <CardContent>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <HubIcon color="action" />
            <Typography variant="h6">Topology Impact</Typography>
            <Chip
              label={`${impact.topologyRiskScore} - ${riskLevel}`}
              size="small"
              color={riskColor}
              data-testid="topology-risk-chip"
            />
          </Box>
        </Box>

        {/* Score gauge */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
          <Box sx={{ position: 'relative', display: 'inline-flex' }}>
            <CircularProgress
              variant="determinate"
              value={Math.min(impact.topologyRiskScore, 100)}
              size={64}
              thickness={5}
              color={riskColor === 'default' ? 'inherit' : riskColor}
            />
            <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Typography variant="h6" fontWeight={700} fontSize={16}>
                {impact.topologyRiskScore}
              </Typography>
            </Box>
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography variant="body2" fontWeight={500}>
              {getImpactSummaryText(impact)}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {impact.riskExplanation}
            </Typography>
          </Box>
        </Box>

        <Divider sx={{ mb: 1.5 }} />

        {/* Blast radius breakdown */}
        <Typography variant="subtitle2" gutterBottom>Blast Radius</Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1.5 }}>
          <Tooltip title="Total impacted nodes">
            <Chip label={`${metrics.totalImpactedNodes} nodes`} size="small" variant="outlined" />
          </Tooltip>
          <Tooltip title="Impacted services">
            <Chip label={`${metrics.impactedServiceCount} services`} size="small" variant="outlined" />
          </Tooltip>
          <Tooltip title="Impacted offerings">
            <Chip label={`${metrics.impactedOfferingCount} offerings`} size="small" variant="outlined" />
          </Tooltip>
          <Tooltip title="Impacted CIs">
            <Chip label={`${metrics.impactedCiCount} CIs`} size="small" variant="outlined" />
          </Tooltip>
          {metrics.criticalCiCount > 0 && (
            <Tooltip title="Critical CIs impacted">
              <Chip
                icon={<WarningAmberIcon />}
                label={`${metrics.criticalCiCount} critical`}
                size="small"
                color="error"
                variant="outlined"
              />
            </Tooltip>
          )}
          {metrics.crossServicePropagation && (
            <Tooltip title={`Impact propagates across ${metrics.crossServiceCount} services`}>
              <Chip
                label={`Cross-service (${metrics.crossServiceCount})`}
                size="small"
                color="warning"
                variant="outlined"
              />
            </Tooltip>
          )}
          <Tooltip title="Maximum dependency chain depth">
            <Chip label={`Depth: ${metrics.maxChainDepth}`} size="small" variant="outlined" />
          </Tooltip>
        </Box>

        {/* Fragility signals */}
        {fragilitySignals.length > 0 && (
          <>
            <Typography variant="subtitle2" gutterBottom>
              <SecurityIcon sx={{ fontSize: 14, mr: 0.5, verticalAlign: 'text-bottom' }} />
              Fragility Signals ({fragilitySignals.length})
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1.5 }}>
              {fragilitySignals.slice(0, 5).map((signal, idx) => (
                <Tooltip key={idx} title={`${signal.nodeLabel}: ${signal.reason}`}>
                  <Chip
                    label={getFragilitySignalLabel(signal.type)}
                    size="small"
                    color={signal.severity >= 70 ? 'error' : signal.severity >= 40 ? 'warning' : 'info'}
                    variant="outlined"
                  />
                </Tooltip>
              ))}
              {fragilitySignals.length > 5 && (
                <Chip label={`+${fragilitySignals.length - 5} more`} size="small" variant="outlined" />
              )}
            </Box>
          </>
        )}

        {/* Warnings */}
        {warnings.length > 0 && (
          <Box sx={{ mb: 1.5 }}>
            {warnings.map((warning, idx) => (
              <Alert key={idx} severity="warning" sx={{ py: 0, mb: 0.5 }} icon={<WarningAmberIcon fontSize="small" />}>
                <Typography variant="caption">{warning}</Typography>
              </Alert>
            ))}
          </Box>
        )}

        {/* Computed at + Recalculate */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1 }}>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <AccessTimeIcon sx={{ fontSize: 14 }} />
            Analyzed: {new Date(impact.computedAt).toLocaleString()}
          </Typography>
          {onRecalculate && (
            <Button
              size="small"
              startIcon={recalculating ? <CircularProgress size={14} /> : <RefreshIcon />}
              onClick={onRecalculate}
              disabled={recalculating}
              data-testid="topology-recalculate-btn"
            >
              {recalculating ? 'Recalculating...' : 'Recalculate'}
            </Button>
          )}
        </Box>
      </CardContent>
    </Card>
  );
};

export default TopologyImpactSummaryCard;
