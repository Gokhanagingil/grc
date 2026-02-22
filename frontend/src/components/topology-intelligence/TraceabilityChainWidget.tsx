/**
 * TraceabilityChainWidget
 *
 * Compact widget showing the closed-loop traceability chain for a
 * change or major incident. Displays linked nodes with status chips
 * and a completeness progress indicator.
 *
 * Phase-C, Phase 3: Closed-Loop Traceability.
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  CardHeader,
  Typography,
  Chip,
  Button,
  Alert,
  Skeleton,
  IconButton,
  Tooltip,
  Collapse,
  LinearProgress,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import {
  TraceabilityNodeData,
  TraceabilitySummaryResponseData,
} from '../../services/grcClient';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TraceabilityChainWidgetProps {
  /** The record ID (change or major incident) */
  recordId: string;
  /** The record type */
  recordType: 'CHANGE' | 'MAJOR_INCIDENT';
  /** Callback to fetch traceability data */
  onFetch: (recordId: string) => Promise<TraceabilitySummaryResponseData>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const NODE_TYPE_LABELS: Record<string, string> = {
  CHANGE: 'Change',
  MAJOR_INCIDENT: 'Major Incident',
  PROBLEM: 'Problem',
  KNOWN_ERROR: 'Known Error',
  PIR: 'PIR',
  PIR_ACTION: 'PIR Action',
  TOPOLOGY_ANALYSIS: 'Topology Analysis',
  GOVERNANCE_DECISION: 'Governance',
  RCA_HYPOTHESIS: 'RCA Hypothesis',
};

const NODE_TYPE_COLORS: Record<string, 'primary' | 'error' | 'warning' | 'info' | 'success' | 'default'> = {
  CHANGE: 'primary',
  MAJOR_INCIDENT: 'error',
  PROBLEM: 'warning',
  KNOWN_ERROR: 'info',
  PIR: 'success',
  PIR_ACTION: 'success',
  TOPOLOGY_ANALYSIS: 'info',
  GOVERNANCE_DECISION: 'primary',
  RCA_HYPOTHESIS: 'warning',
};

const STATUS_COLORS: Record<string, 'success' | 'warning' | 'error' | 'info' | 'default'> = {
  COMPUTED: 'success',
  EVALUATED: 'success',
  ACTIVE: 'info',
  NEW: 'info',
  OPEN: 'info',
  IN_PROGRESS: 'warning',
  CLOSED: 'default',
  RESOLVED: 'success',
  DRAFT: 'default',
  PUBLISHED: 'success',
  RETIRED: 'default',
  ASSESS: 'warning',
  AUTHORIZE: 'warning',
  IMPLEMENT: 'info',
  REVIEW: 'info',
  UNKNOWN: 'default',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const TraceabilityChainWidget: React.FC<TraceabilityChainWidgetProps> = ({
  recordId,
  recordType,
  onFetch,
}) => {
  const [data, setData] = useState<TraceabilitySummaryResponseData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await onFetch(recordId);
      setData(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load traceability chain';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [recordId, onFetch]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Build a simple linear chain from nodes for display
  const buildChainOrder = (nodes: TraceabilityNodeData[]): TraceabilityNodeData[] => {
    // Order: root first, then topology/governance, then orchestrated records
    const typeOrder: Record<string, number> = {
      CHANGE: 0,
      MAJOR_INCIDENT: 0,
      TOPOLOGY_ANALYSIS: 1,
      GOVERNANCE_DECISION: 2,
      RCA_HYPOTHESIS: 3,
      PROBLEM: 4,
      KNOWN_ERROR: 5,
      PIR: 6,
      PIR_ACTION: 7,
    };
    return [...nodes].sort(
      (a, b) => (typeOrder[a.type] ?? 99) - (typeOrder[b.type] ?? 99),
    );
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <Card
      variant="outlined"
      data-testid="traceability-chain-widget"
      sx={{ mb: 2 }}
    >
      <CardHeader
        avatar={<AccountTreeIcon color="primary" />}
        title={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="subtitle1" fontWeight={600}>
              Traceability Chain
            </Typography>
            {data && (
              <Chip
                size="small"
                label={`${data.metrics.totalNodes} nodes`}
                variant="outlined"
              />
            )}
          </Box>
        }
        subheader={
          data
            ? data.summary
            : 'Closed-loop traceability summary'
        }
        action={
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            <Tooltip title="Refresh">
              <IconButton
                size="small"
                onClick={fetchData}
                disabled={loading}
                data-testid="traceability-refresh"
              >
                <RefreshIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <IconButton
              size="small"
              onClick={() => setExpanded(!expanded)}
              data-testid="traceability-toggle"
            >
              {expanded ? (
                <ExpandLessIcon fontSize="small" />
              ) : (
                <ExpandMoreIcon fontSize="small" />
              )}
            </IconButton>
          </Box>
        }
      />

      <Collapse in={expanded}>
        <CardContent sx={{ pt: 0 }}>
          {/* Loading skeleton */}
          {loading && (
            <Box data-testid="traceability-loading">
              <Skeleton variant="rectangular" height={24} width="60%" sx={{ mb: 1 }} />
              <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} variant="rounded" width={100} height={32} />
                ))}
              </Box>
              <Skeleton variant="rectangular" height={8} sx={{ borderRadius: 1 }} />
            </Box>
          )}

          {/* Error state */}
          {!loading && error && (
            <Alert
              severity="warning"
              data-testid="traceability-error"
              action={
                <Button size="small" onClick={fetchData}>
                  Retry
                </Button>
              }
            >
              {error}
            </Alert>
          )}

          {/* Empty state */}
          {!loading && !error && data && data.nodes.length <= 1 && (
            <Alert
              severity="info"
              data-testid="traceability-empty"
            >
              No traceability chain established yet. Run topology analysis
              and governance evaluation to build the chain.
            </Alert>
          )}

          {/* Chain visualization */}
          {!loading && !error && data && data.nodes.length > 1 && (
            <>
              {/* Completeness bar */}
              <Box sx={{ mb: 2 }}>
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    mb: 0.5,
                  }}
                >
                  <Typography variant="caption" color="text.secondary">
                    Chain Completeness
                  </Typography>
                  <Typography variant="caption" fontWeight={600}>
                    {data.metrics.completenessScore}%
                  </Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={data.metrics.completenessScore}
                  color={
                    data.metrics.completenessScore >= 80
                      ? 'success'
                      : data.metrics.completenessScore >= 50
                        ? 'warning'
                        : 'error'
                  }
                  sx={{ height: 6, borderRadius: 1 }}
                  data-testid="traceability-completeness"
                />
              </Box>

              {/* Milestone chips */}
              <Box
                sx={{
                  display: 'flex',
                  gap: 0.5,
                  flexWrap: 'wrap',
                  mb: 2,
                }}
              >
                <Chip
                  size="small"
                  label="Topology"
                  color={data.metrics.hasTopologyAnalysis ? 'success' : 'default'}
                  variant={data.metrics.hasTopologyAnalysis ? 'filled' : 'outlined'}
                />
                <Chip
                  size="small"
                  label="Governance"
                  color={data.metrics.hasGovernanceDecision ? 'success' : 'default'}
                  variant={data.metrics.hasGovernanceDecision ? 'filled' : 'outlined'}
                />
                <Chip
                  size="small"
                  label="Actions"
                  color={data.metrics.hasOrchestrationActions ? 'success' : 'default'}
                  variant={data.metrics.hasOrchestrationActions ? 'filled' : 'outlined'}
                />
              </Box>

              {/* Node chain */}
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 0.5,
                }}
                data-testid="traceability-chain-nodes"
              >
                {buildChainOrder(data.nodes).map((node, idx, arr) => (
                  <React.Fragment key={node.id}>
                    <Tooltip
                      title={
                        <Box>
                          <Typography variant="caption" display="block">
                            {NODE_TYPE_LABELS[node.type] || node.type}
                          </Typography>
                          <Typography variant="caption" display="block">
                            Status: {node.status}
                          </Typography>
                          <Typography variant="caption" display="block" sx={{ opacity: 0.7 }}>
                            {node.label}
                          </Typography>
                        </Box>
                      }
                    >
                      <Chip
                        size="small"
                        label={NODE_TYPE_LABELS[node.type] || node.type}
                        color={NODE_TYPE_COLORS[node.type] || 'default'}
                        variant="filled"
                        icon={
                          <Box
                            component="span"
                            sx={{
                              width: 6,
                              height: 6,
                              borderRadius: '50%',
                              bgcolor:
                                STATUS_COLORS[node.status] === 'success'
                                  ? 'success.main'
                                  : STATUS_COLORS[node.status] === 'warning'
                                    ? 'warning.main'
                                    : STATUS_COLORS[node.status] === 'error'
                                      ? 'error.main'
                                      : 'grey.500',
                              display: 'inline-block',
                              ml: 1,
                            }}
                          />
                        }
                        data-testid={`traceability-node-${node.type}`}
                      />
                    </Tooltip>
                    {idx < arr.length - 1 && (
                      <ArrowForwardIcon
                        sx={{ fontSize: 14, color: 'text.disabled' }}
                      />
                    )}
                  </React.Fragment>
                ))}
              </Box>
            </>
          )}
        </CardContent>
      </Collapse>
    </Card>
  );
};

export default TraceabilityChainWidget;
