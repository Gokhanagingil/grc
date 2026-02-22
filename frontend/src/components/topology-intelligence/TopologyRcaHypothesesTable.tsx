/**
 * TopologyRcaHypothesesTable
 * Ranked list of RCA hypotheses with expandable details,
 * confidence scores, and analyst workflow actions.
 */
import React from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Chip,
  Skeleton,
  Alert,
  AlertTitle,
  Button,
  Collapse,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Divider,
  Tooltip,
  CircularProgress,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import HubIcon from '@mui/icons-material/Hub';
import SearchIcon from '@mui/icons-material/Search';
import CompareArrowsIcon from '@mui/icons-material/CompareArrows';
import RefreshIcon from '@mui/icons-material/Refresh';
import LockIcon from '@mui/icons-material/Lock';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import BugReportIcon from '@mui/icons-material/BugReport';

import type {
  RcaTopologyHypothesesResponseData,
  RcaHypothesisData,
} from '../../services/grcClient';
import {
  getConfidenceLabel,
  getConfidenceColor,
  getRcaHypothesisTypeLabel,
  getNodeTypeShortLabel,
  type ClassifiedTopologyError,
} from './topology-utils';

export interface TopologyRcaHypothesesTableProps {
  /** RCA hypotheses data */
  data: RcaTopologyHypothesesResponseData | null;
  /** Loading state */
  loading: boolean;
  /** Error state */
  error: ClassifiedTopologyError | null;
  /** Called when user clicks Recalculate */
  onRecalculate?: () => void;
  /** Whether recalculation is in progress */
  recalculating?: boolean;
  /** Called on Retry after error */
  onRetry?: () => void;
  /** Called when user wants to open topology graph centered on a node */
  onOpenGraph?: (nodeId: string, nodeLabel: string) => void;
  /** Called when user copies hypothesis to clipboard */
  onCopyHypothesis?: (hypothesis: RcaHypothesisData) => void;
  /** Called when user wants to compare top 2 hypotheses */
  onCompare?: (h1: RcaHypothesisData, h2: RcaHypothesisData) => void;
}

export const TopologyRcaHypothesesTable: React.FC<TopologyRcaHypothesesTableProps> = ({
  data,
  loading,
  error,
  onRecalculate,
  recalculating = false,
  onRetry,
  onOpenGraph,
  onCopyHypothesis,
  onCompare,
}) => {
  const [expandedId, setExpandedId] = React.useState<string | null>(null);

  // --- Permission denied ---
  if (error?.type === 'forbidden') {
    return (
      <Box data-testid="rca-hypotheses-table">
        <Alert severity="warning" icon={<LockIcon />} data-testid="rca-permission-denied">
          <AlertTitle>Permission Required</AlertTitle>
          {error.message}
        </Alert>
      </Box>
    );
  }

  // --- Loading ---
  if (loading) {
    return (
      <Box data-testid="rca-hypotheses-table">
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <BugReportIcon color="action" />
          <Typography variant="h6">RCA Topology Hypotheses</Typography>
        </Box>
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} variant="rectangular" height={72} sx={{ borderRadius: 1, mb: 1 }} />
        ))}
      </Box>
    );
  }

  // --- Error ---
  if (error) {
    return (
      <Box data-testid="rca-hypotheses-table">
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <BugReportIcon color="action" />
          <Typography variant="h6">RCA Topology Hypotheses</Typography>
        </Box>
        <Alert
          severity={error.type === 'not_found' ? 'info' : 'error'}
          icon={<ErrorOutlineIcon />}
          data-testid="rca-hypotheses-error"
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
      </Box>
    );
  }

  // --- Empty ---
  if (!data || !Array.isArray(data.hypotheses) || data.hypotheses.length === 0) {
    return (
      <Box data-testid="rca-hypotheses-table">
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <BugReportIcon color="action" />
          <Typography variant="h6">RCA Topology Hypotheses</Typography>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          No topology-based root cause hypotheses generated yet. Ensure linked CIs/services exist and click Recalculate.
        </Typography>
        {onRecalculate && (
          <Button
            size="small"
            startIcon={<RefreshIcon />}
            onClick={onRecalculate}
            disabled={recalculating}
          >
            {recalculating ? 'Analyzing...' : 'Generate Hypotheses'}
          </Button>
        )}
      </Box>
    );
  }

  const sortedHypotheses = [...data.hypotheses].sort((a, b) => b.score - a.score);

  const handleCopy = (hypothesis: RcaHypothesisData) => {
    if (onCopyHypothesis) {
      onCopyHypothesis(hypothesis);
    } else {
      const text = [
        `Hypothesis: ${getRcaHypothesisTypeLabel(hypothesis.type)}`,
        `Suspect: ${hypothesis.suspectNodeLabel} (${getNodeTypeShortLabel(hypothesis.suspectNodeType)})`,
        `Confidence: ${(hypothesis.score * 100).toFixed(0)}%`,
        `Explanation: ${hypothesis.explanation}`,
        hypothesis.evidence.length > 0 ? `Evidence:\n${hypothesis.evidence.map((e) => `  - ${e.description}`).join('\n')}` : '',
      ].filter(Boolean).join('\n');
      navigator.clipboard.writeText(text).catch(() => { /* clipboard write failed silently */ });
    }
  };

  return (
    <Box data-testid="rca-hypotheses-table">
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <BugReportIcon color="action" />
          <Typography variant="h6">RCA Topology Hypotheses</Typography>
          <Chip label={`${sortedHypotheses.length} candidates`} size="small" variant="outlined" />
        </Box>
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          {onCompare && sortedHypotheses.length >= 2 && (
            <Tooltip title="Compare top 2 hypotheses side by side">
              <Button
                size="small"
                startIcon={<CompareArrowsIcon />}
                onClick={() => onCompare(sortedHypotheses[0], sortedHypotheses[1])}
                data-testid="rca-compare-btn"
              >
                Compare Top 2
              </Button>
            </Tooltip>
          )}
          {onRecalculate && (
            <Button
              size="small"
              startIcon={recalculating ? <CircularProgress size={14} /> : <RefreshIcon />}
              onClick={onRecalculate}
              disabled={recalculating}
              data-testid="rca-recalculate-btn"
            >
              {recalculating ? 'Recalculating...' : 'Recalculate'}
            </Button>
          )}
        </Box>
      </Box>

      {/* Hypotheses list */}
      {sortedHypotheses.map((hypothesis, idx) => {
        const isExpanded = expandedId === hypothesis.id;
        const confidenceColor = getConfidenceColor(hypothesis.score);
        const confidenceLabel = getConfidenceLabel(hypothesis.score);

        return (
          <Card
            key={hypothesis.id}
            sx={{ mb: 1, border: idx === 0 ? 2 : 1, borderColor: idx === 0 ? 'warning.main' : 'divider' }}
            data-testid={`rca-hypothesis-${idx}`}
          >
            <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
              {/* Hypothesis header */}
              <Box
                sx={{ display: 'flex', alignItems: 'center', gap: 1, cursor: 'pointer' }}
                onClick={() => setExpandedId(isExpanded ? null : hypothesis.id)}
              >
                <Typography variant="body2" fontWeight={700} sx={{ minWidth: 24 }}>
                  #{idx + 1}
                </Typography>
                <Chip
                  label={`${(hypothesis.score * 100).toFixed(0)}%`}
                  size="small"
                  color={confidenceColor}
                  data-testid={`rca-confidence-${idx}`}
                />
                <Chip
                  label={getNodeTypeShortLabel(hypothesis.suspectNodeType)}
                  size="small"
                  variant="outlined"
                />
                <Typography variant="body2" fontWeight={500} noWrap sx={{ flex: 1 }}>
                  {hypothesis.suspectNodeLabel}
                </Typography>
                <Chip
                  label={getRcaHypothesisTypeLabel(hypothesis.type)}
                  size="small"
                  variant="outlined"
                />
                <IconButton size="small">
                  {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                </IconButton>
              </Box>

              {/* Confidence + type label */}
              <Typography variant="caption" color="text.secondary" sx={{ ml: 4 }}>
                {confidenceLabel} confidence &middot; {hypothesis.explanation.slice(0, 100)}{hypothesis.explanation.length > 100 ? '...' : ''}
              </Typography>

              {/* Expanded detail */}
              <Collapse in={isExpanded}>
                <Divider sx={{ my: 1 }} />

                {/* Explanation */}
                <Typography variant="body2" sx={{ mb: 1 }}>
                  {hypothesis.explanation}
                </Typography>

                {/* Evidence */}
                {Array.isArray(hypothesis.evidence) && hypothesis.evidence.length > 0 && (
                  <Box sx={{ mb: 1 }}>
                    <Typography variant="subtitle2" gutterBottom>Evidence</Typography>
                    <List dense disablePadding>
                      {hypothesis.evidence.map((ev, eIdx) => (
                        <ListItem key={eIdx} disableGutters sx={{ py: 0.25 }}>
                          <ListItemText
                            primary={
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                <Chip label={ev.type.replace(/_/g, ' ')} size="small" variant="outlined" />
                                <Typography variant="body2">{ev.description}</Typography>
                              </Box>
                            }
                            secondary={ev.referenceLabel ? `Ref: ${ev.referenceLabel}` : undefined}
                          />
                        </ListItem>
                      ))}
                    </List>
                  </Box>
                )}

                {/* Recommended actions */}
                {Array.isArray(hypothesis.recommendedActions) && hypothesis.recommendedActions.length > 0 && (
                  <Box sx={{ mb: 1 }}>
                    <Typography variant="subtitle2" gutterBottom>Recommended Actions</Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {hypothesis.recommendedActions.map((action, aIdx) => (
                        <Tooltip key={aIdx} title={action.reason}>
                          <Chip
                            label={action.label}
                            size="small"
                            color="primary"
                            variant="outlined"
                          />
                        </Tooltip>
                      ))}
                    </Box>
                  </Box>
                )}

                {/* Analyst actions */}
                <Box sx={{ display: 'flex', gap: 0.5, mt: 1 }}>
                  <Tooltip title="Copy hypothesis details to clipboard">
                    <Button size="small" startIcon={<ContentCopyIcon />} onClick={() => handleCopy(hypothesis)}>
                      Copy
                    </Button>
                  </Tooltip>
                  {onOpenGraph && (
                    <Tooltip title={`Open topology graph centered on ${hypothesis.suspectNodeLabel}`}>
                      <Button
                        size="small"
                        startIcon={<HubIcon />}
                        onClick={() => onOpenGraph(hypothesis.suspectNodeId, hypothesis.suspectNodeLabel)}
                        data-testid={`rca-open-graph-${idx}`}
                      >
                        View in Graph
                      </Button>
                    </Tooltip>
                  )}
                  <Tooltip title="Mark this hypothesis as under investigation">
                    <Button size="small" startIcon={<SearchIcon />}>
                      Investigate
                    </Button>
                  </Tooltip>
                </Box>
              </Collapse>
            </CardContent>
          </Card>
        );
      })}

      {/* Footer - computed at + nodes analyzed */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1 }}>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <AccessTimeIcon sx={{ fontSize: 14 }} />
          Analyzed: {new Date(data.computedAt).toLocaleString()} &middot; {data.nodesAnalyzed} nodes evaluated
        </Typography>
      </Box>

      {/* Warnings */}
      {Array.isArray(data.warnings) && data.warnings.length > 0 && (
        <Box sx={{ mt: 1 }}>
          {data.warnings.map((w, i) => (
            <Alert key={i} severity="warning" sx={{ py: 0, mb: 0.5 }}>
              <Typography variant="caption">{w}</Typography>
            </Alert>
          ))}
        </Box>
      )}
    </Box>
  );
};

export default TopologyRcaHypothesesTable;
