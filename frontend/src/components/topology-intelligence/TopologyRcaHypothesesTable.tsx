/**
 * TopologyRcaHypothesesTable
 * Ranked list of RCA hypotheses with expandable details,
 * confidence scores, analyst workflow actions, and
 * orchestration buttons (Create Problem / Known Error / PIR Action).
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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
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
import ReportProblemIcon from '@mui/icons-material/ReportProblem';
import LibraryBooksIcon from '@mui/icons-material/LibraryBooks';
import PlaylistAddCheckIcon from '@mui/icons-material/PlaylistAddCheck';

import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import StarIcon from '@mui/icons-material/Star';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import NoteAddIcon from '@mui/icons-material/NoteAdd';
import SendIcon from '@mui/icons-material/Send';

import type {
  RcaTopologyHypothesesResponseData,
  RcaHypothesisData,
  CreateProblemFromHypothesisRequest,
  CreateKnownErrorFromHypothesisRequest,
  CreatePirActionFromHypothesisRequest,
  HypothesisDecisionStatus,
  RcaDecisionsSummaryData,
  HypothesisDecisionData,
} from '../../services/grcClient';
import {
  getConfidenceLabel,
  getConfidenceColor,
  getRcaHypothesisTypeLabel,
  getNodeTypeShortLabel,
  type ClassifiedTopologyError,
} from './topology-utils';

// ---------------------------------------------------------------------------
// Types for orchestration dialog state
// ---------------------------------------------------------------------------

type OrchestrationDialogType = 'problem' | 'known_error' | 'pir_action' | null;

interface OrchestrationCallbacks {
  onCreateProblem?: (
    hypothesis: RcaHypothesisData,
    data: CreateProblemFromHypothesisRequest,
  ) => Promise<{ recordId?: string; error?: string }>;
  onCreateKnownError?: (
    hypothesis: RcaHypothesisData,
    data: CreateKnownErrorFromHypothesisRequest,
  ) => Promise<{ recordId?: string; error?: string }>;
  onCreatePirAction?: (
    hypothesis: RcaHypothesisData,
    data: CreatePirActionFromHypothesisRequest,
  ) => Promise<{ recordId?: string; error?: string }>;
}

/** Callbacks for hypothesis decision actions */
interface DecisionCallbacks {
  onUpdateDecision?: (
    hypothesisId: string,
    status: HypothesisDecisionStatus,
    reason?: string,
  ) => Promise<void>;
  onAddNote?: (
    hypothesisId: string,
    content: string,
    noteType?: string,
  ) => Promise<void>;
  onSetSelected?: (
    hypothesisId: string,
    reason?: string,
  ) => Promise<void>;
}

// ---------------------------------------------------------------------------
// Decision status helpers
// ---------------------------------------------------------------------------

const DECISION_STATUS_CONFIG: Record<HypothesisDecisionStatus, {
  label: string;
  color: 'default' | 'success' | 'error' | 'warning' | 'info';
}> = {
  PENDING: { label: 'Pending', color: 'default' },
  ACCEPTED: { label: 'Accepted', color: 'success' },
  REJECTED: { label: 'Rejected', color: 'error' },
  NEEDS_INVESTIGATION: { label: 'Investigating', color: 'warning' },
};

export interface TopologyRcaHypothesesTableProps {
  /** RCA hypotheses data */
  data: RcaTopologyHypothesesResponseData | null;
  /** Loading state */
  loading: boolean;
  /** Error state */
  error: ClassifiedTopologyError | null;
  /** Major incident ID (required for orchestration) */
  majorIncidentId?: string;
  /** Available PIR IDs for this MI (needed for PIR action creation) */
  pirIds?: Array<{ id: string; title: string }>;
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
  /** Orchestration callbacks */
  orchestration?: OrchestrationCallbacks;
  /** Hypothesis decision callbacks (Phase C) */
  decisions?: DecisionCallbacks;
  /** Current decisions summary data */
  decisionsSummary?: RcaDecisionsSummaryData | null;
  /** Whether a decision action is in progress */
  decisionLoading?: boolean;
}

// ---------------------------------------------------------------------------
// Confirmation dialog constants
// ---------------------------------------------------------------------------

const PROBLEM_CATEGORIES = [
  'HARDWARE', 'SOFTWARE', 'NETWORK', 'SECURITY',
  'DATABASE', 'APPLICATION', 'INFRASTRUCTURE', 'OTHER',
];
const IMPACT_OPTIONS = ['LOW', 'MEDIUM', 'HIGH'];
const URGENCY_OPTIONS = ['LOW', 'MEDIUM', 'HIGH'];
const PIR_ACTION_PRIORITIES = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export const TopologyRcaHypothesesTable: React.FC<TopologyRcaHypothesesTableProps> = ({
  data,
  loading,
  error,
  majorIncidentId,
  pirIds = [],
  onRecalculate,
  recalculating = false,
  onRetry,
  onOpenGraph,
  onCopyHypothesis,
  onCompare,
  orchestration,
  decisions,
  decisionsSummary,
  decisionLoading = false,
}) => {
  const [expandedId, setExpandedId] = React.useState<string | null>(null);

  // Decision / notes state
  const [noteTexts, setNoteTexts] = React.useState<Record<string, string>>({});
  const [actionInProgress, setActionInProgress] = React.useState<string | null>(null);

  const getDecision = (hypothesisId: string): HypothesisDecisionData | undefined => {
    return decisionsSummary?.decisions?.[hypothesisId];
  };

  const getStatus = (hypothesisId: string): HypothesisDecisionStatus => {
    return getDecision(hypothesisId)?.status ?? 'PENDING';
  };

  const isSelected = (hypothesisId: string): boolean => {
    return decisionsSummary?.selectedHypothesisId === hypothesisId;
  };

  const handleDecisionAction = async (
    hypothesisId: string,
    status: HypothesisDecisionStatus,
    reason?: string,
  ) => {
    if (!decisions?.onUpdateDecision) return;
    setActionInProgress(hypothesisId);
    try {
      await decisions.onUpdateDecision(hypothesisId, status, reason);
    } finally {
      setActionInProgress(null);
    }
  };

  const handleAddNote = async (hypothesisId: string) => {
    if (!decisions?.onAddNote) return;
    const content = noteTexts[hypothesisId]?.trim();
    if (!content) return;
    setActionInProgress(hypothesisId);
    try {
      await decisions.onAddNote(hypothesisId, content);
      setNoteTexts((prev) => ({ ...prev, [hypothesisId]: '' }));
    } finally {
      setActionInProgress(null);
    }
  };

  const handleSetSelected = async (hypothesisId: string) => {
    if (!decisions?.onSetSelected) return;
    setActionInProgress(hypothesisId);
    try {
      await decisions.onSetSelected(hypothesisId);
    } finally {
      setActionInProgress(null);
    }
  };

  // Orchestration dialog state
  const [dialogType, setDialogType] = React.useState<OrchestrationDialogType>(null);
  const [dialogHypothesis, setDialogHypothesis] = React.useState<RcaHypothesisData | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [orchestrationMessage, setOrchestrationMessage] = React.useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // Dialog form fields
  const [shortDescription, setShortDescription] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [category, setCategory] = React.useState('SOFTWARE');
  const [impact, setImpact] = React.useState('HIGH');
  const [urgency, setUrgency] = React.useState('HIGH');
  const [keTitle, setKeTitle] = React.useState('');
  const [rootCause, setRootCause] = React.useState('');
  const [workaround, setWorkaround] = React.useState('');
  const [pirActionTitle, setPirActionTitle] = React.useState('');
  const [pirActionDescription, setPirActionDescription] = React.useState('');
  const [pirActionPriority, setPirActionPriority] = React.useState('HIGH');
  const [selectedPirId, setSelectedPirId] = React.useState('');

  const openDialog = (type: OrchestrationDialogType, hypothesis: RcaHypothesisData) => {
    setDialogType(type);
    setDialogHypothesis(hypothesis);
    setOrchestrationMessage(null);

    // Pre-fill fields from hypothesis
    const suspectLabel = hypothesis.suspectNodeLabel;
    const typeLabel = getRcaHypothesisTypeLabel(hypothesis.type);
    const prefix = `[RCA] ${suspectLabel}`;

    setShortDescription(`${prefix}: ${typeLabel}`);
    setDescription(hypothesis.explanation);
    setCategory('SOFTWARE');
    setImpact('HIGH');
    setUrgency('HIGH');
    setKeTitle(`${prefix}: Known Error`);
    setRootCause(hypothesis.explanation);
    setWorkaround('');
    setPirActionTitle(`${prefix}: Follow-up Action`);
    setPirActionDescription(hypothesis.explanation);
    setPirActionPriority('HIGH');
    setSelectedPirId(pirIds.length > 0 ? pirIds[0].id : '');
  };

  const closeDialog = () => {
    setDialogType(null);
    setDialogHypothesis(null);
  };

  const handleOrchestrationSubmit = async () => {
    if (!orchestration || !dialogHypothesis || !majorIncidentId) return;
    setSubmitting(true);
    setOrchestrationMessage(null);

    try {
      let result: { recordId?: string; error?: string } = {};

      if (dialogType === 'problem' && orchestration.onCreateProblem) {
        result = await orchestration.onCreateProblem(dialogHypothesis, {
          majorIncidentId,
          hypothesisId: dialogHypothesis.id,
          shortDescription,
          description,
          category,
          impact,
          urgency,
        });
      } else if (dialogType === 'known_error' && orchestration.onCreateKnownError) {
        result = await orchestration.onCreateKnownError(dialogHypothesis, {
          majorIncidentId,
          hypothesisId: dialogHypothesis.id,
          title: keTitle,
          rootCause,
          workaround: workaround || undefined,
        });
      } else if (dialogType === 'pir_action' && orchestration.onCreatePirAction) {
        result = await orchestration.onCreatePirAction(dialogHypothesis, {
          majorIncidentId,
          hypothesisId: dialogHypothesis.id,
          pirId: selectedPirId,
          title: pirActionTitle,
          description: pirActionDescription,
          priority: pirActionPriority,
        });
      }

      if (result.error) {
        setOrchestrationMessage({ type: 'error', text: result.error });
      } else {
        const label = dialogType === 'problem' ? 'Problem' : dialogType === 'known_error' ? 'Known Error' : 'PIR Action';
        setOrchestrationMessage({ type: 'success', text: `${label} created successfully.` });
        closeDialog();
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'An unexpected error occurred';
      setOrchestrationMessage({ type: 'error', text: message });
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmitDialog = () => {
    if (dialogType === 'problem') return shortDescription.trim().length > 0;
    if (dialogType === 'known_error') return keTitle.trim().length > 0;
    if (dialogType === 'pir_action') return pirActionTitle.trim().length > 0 && selectedPirId.length > 0;
    return false;
  };

  const hasOrchestration = !!(
    orchestration?.onCreateProblem ||
    orchestration?.onCreateKnownError ||
    orchestration?.onCreatePirAction
  );

  const dialogTitle = dialogType === 'problem'
    ? 'Create Problem from Hypothesis'
    : dialogType === 'known_error'
      ? 'Create Known Error from Hypothesis'
      : 'Create PIR Action from Hypothesis';

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
      {/* Orchestration success/error banner */}
      {orchestrationMessage && (
        <Alert
          severity={orchestrationMessage.type}
          sx={{ mb: 1 }}
          onClose={() => setOrchestrationMessage(null)}
          data-testid="rca-orchestration-message"
        >
          {orchestrationMessage.text}
        </Alert>
      )}

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

      {/* Decision summary banner */}
      {decisionsSummary && decisionsSummary.totalDecisions > 0 && (
        <Box
          sx={{ display: 'flex', gap: 1, mb: 1.5, flexWrap: 'wrap', alignItems: 'center' }}
          data-testid="rca-decisions-summary"
        >
          <Typography variant="caption" color="text.secondary" fontWeight={600}>
            Decisions:
          </Typography>
          {decisionsSummary.acceptedCount > 0 && (
            <Chip label={`${decisionsSummary.acceptedCount} accepted`} size="small" color="success" variant="outlined" />
          )}
          {decisionsSummary.rejectedCount > 0 && (
            <Chip label={`${decisionsSummary.rejectedCount} rejected`} size="small" color="error" variant="outlined" />
          )}
          {decisionsSummary.investigatingCount > 0 && (
            <Chip label={`${decisionsSummary.investigatingCount} investigating`} size="small" color="warning" variant="outlined" />
          )}
          {decisionsSummary.selectedHypothesisId && (
            <Chip
              icon={<StarIcon sx={{ fontSize: 16 }} />}
              label="Root cause selected"
              size="small"
              color="success"
            />
          )}
        </Box>
      )}

      {/* Hypotheses list */}
      {sortedHypotheses.map((hypothesis, idx) => {
        const isExpanded = expandedId === hypothesis.id;
        const confidenceColor = getConfidenceColor(hypothesis.score);
        const confidenceLabel = getConfidenceLabel(hypothesis.score);
        const decisionStatus = getStatus(hypothesis.id);
        const isSelectedHypothesis = isSelected(hypothesis.id);

        return (
          <Card
            key={hypothesis.id}
            sx={{
              mb: 1,
              border: isSelectedHypothesis ? 2 : idx === 0 ? 2 : 1,
              borderColor: isSelectedHypothesis ? 'success.main' : idx === 0 ? 'warning.main' : 'divider',
            }}
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
                {isSelectedHypothesis && (
                  <Tooltip title="Selected root cause hypothesis">
                    <StarIcon sx={{ color: 'warning.main', fontSize: 20 }} data-testid={`rca-selected-star-${idx}`} />
                  </Tooltip>
                )}
                <Chip
                  label={`${(hypothesis.score * 100).toFixed(0)}%`}
                  size="small"
                  color={confidenceColor}
                  data-testid={`rca-confidence-${idx}`}
                />
                {decisionStatus !== 'PENDING' && (
                  <Chip
                    label={DECISION_STATUS_CONFIG[decisionStatus].label}
                    size="small"
                    color={DECISION_STATUS_CONFIG[decisionStatus].color}
                    data-testid={`rca-status-badge-${idx}`}
                  />
                )}
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
                <Box sx={{ display: 'flex', gap: 0.5, mt: 1, flexWrap: 'wrap' }}>
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
                  {decisions?.onUpdateDecision && (() => {
                    const status = getStatus(hypothesis.id);
                    const isLoading = actionInProgress === hypothesis.id || decisionLoading;
                    return (
                      <>
                        {status !== 'ACCEPTED' && (
                          <Tooltip title="Accept this hypothesis as root cause">
                            <span>
                              <Button
                                size="small"
                                color="success"
                                startIcon={isLoading ? <CircularProgress size={14} /> : <CheckCircleIcon />}
                                disabled={isLoading}
                                onClick={() => handleDecisionAction(hypothesis.id, 'ACCEPTED')}
                                data-testid={`rca-accept-${idx}`}
                              >
                                Accept
                              </Button>
                            </span>
                          </Tooltip>
                        )}
                        {status !== 'REJECTED' && (
                          <Tooltip title="Reject this hypothesis">
                            <span>
                              <Button
                                size="small"
                                color="error"
                                startIcon={isLoading ? <CircularProgress size={14} /> : <CancelIcon />}
                                disabled={isLoading}
                                onClick={() => handleDecisionAction(hypothesis.id, 'REJECTED')}
                                data-testid={`rca-reject-${idx}`}
                              >
                                Reject
                              </Button>
                            </span>
                          </Tooltip>
                        )}
                        {status !== 'NEEDS_INVESTIGATION' && (
                          <Tooltip title="Mark for further investigation">
                            <span>
                              <Button
                                size="small"
                                color="warning"
                                startIcon={isLoading ? <CircularProgress size={14} /> : <SearchIcon />}
                                disabled={isLoading}
                                onClick={() => handleDecisionAction(hypothesis.id, 'NEEDS_INVESTIGATION')}
                                data-testid={`rca-investigate-${idx}`}
                              >
                                Investigate
                              </Button>
                            </span>
                          </Tooltip>
                        )}
                        {!isSelected(hypothesis.id) && decisions?.onSetSelected && (
                          <Tooltip title="Set as selected root cause hypothesis">
                            <span>
                              <Button
                                size="small"
                                startIcon={isLoading ? <CircularProgress size={14} /> : <StarBorderIcon />}
                                disabled={isLoading}
                                onClick={() => handleSetSelected(hypothesis.id)}
                                data-testid={`rca-select-${idx}`}
                              >
                                Select
                              </Button>
                            </span>
                          </Tooltip>
                        )}
                      </>
                    );
                  })()}
                  {!decisions?.onUpdateDecision && (
                    <Tooltip title="Mark this hypothesis as under investigation">
                      <Button size="small" startIcon={<SearchIcon />}>
                        Investigate
                      </Button>
                    </Tooltip>
                  )}
                </Box>

                {/* Analyst Notes Section */}
                {decisions?.onAddNote && (
                  <Box sx={{ mt: 1.5 }} data-testid={`rca-notes-section-${idx}`}>
                    <Divider sx={{ mb: 1 }} />
                    <Typography variant="subtitle2" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <NoteAddIcon fontSize="small" /> Analyst Notes
                    </Typography>
                    {/* Existing notes */}
                    {(() => {
                      const decision = getDecision(hypothesis.id);
                      const notes = decision?.notes ?? [];
                      return notes.length > 0 ? (
                        <List dense disablePadding sx={{ mb: 1 }}>
                          {notes.map((note) => (
                            <ListItem key={note.id} disableGutters sx={{ py: 0.25 }}>
                              <ListItemText
                                primary={note.content}
                                secondary={`${note.noteType || 'general'} • ${new Date(note.createdAt).toLocaleString()}`}
                              />
                            </ListItem>
                          ))}
                        </List>
                      ) : null;
                    })()}
                    {/* Add note input */}
                    <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'flex-start' }}>
                      <TextField
                        size="small"
                        multiline
                        minRows={1}
                        maxRows={3}
                        placeholder="Add analyst note or evidence..."
                        value={noteTexts[hypothesis.id] || ''}
                        onChange={(e) => setNoteTexts((prev) => ({ ...prev, [hypothesis.id]: e.target.value }))}
                        fullWidth
                        inputProps={{ maxLength: 4000, 'data-testid': `rca-note-input-${idx}` }}
                        disabled={actionInProgress === hypothesis.id || decisionLoading}
                      />
                      <Tooltip title="Submit note">
                        <span>
                          <IconButton
                            size="small"
                            color="primary"
                            onClick={() => handleAddNote(hypothesis.id)}
                            disabled={
                              !noteTexts[hypothesis.id]?.trim() ||
                              actionInProgress === hypothesis.id ||
                              decisionLoading
                            }
                            data-testid={`rca-add-note-${idx}`}
                          >
                            <SendIcon fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                    </Box>
                  </Box>
                )}

                {/* Orchestration actions */}
                {hasOrchestration && majorIncidentId && (
                  <Box sx={{ mt: 1 }}>
                    <Divider sx={{ mb: 1 }} />
                    <Typography variant="subtitle2" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      Create Record from Hypothesis
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                      {orchestration?.onCreateProblem && (
                        <Tooltip title="Create a Problem record linked to this hypothesis">
                          <Button
                            size="small"
                            variant="outlined"
                            color="error"
                            startIcon={<ReportProblemIcon />}
                            onClick={() => openDialog('problem', hypothesis)}
                            data-testid={`rca-create-problem-${idx}`}
                          >
                            Create Problem
                          </Button>
                        </Tooltip>
                      )}
                      {orchestration?.onCreateKnownError && (
                        <Tooltip title="Create a Known Error candidate from this hypothesis">
                          <Button
                            size="small"
                            variant="outlined"
                            color="warning"
                            startIcon={<LibraryBooksIcon />}
                            onClick={() => openDialog('known_error', hypothesis)}
                            data-testid={`rca-create-ke-${idx}`}
                          >
                            Create Known Error
                          </Button>
                        </Tooltip>
                      )}
                      {orchestration?.onCreatePirAction && (
                        <Tooltip title="Create a PIR Action item from this hypothesis">
                          <Button
                            size="small"
                            variant="outlined"
                            color="info"
                            startIcon={<PlaylistAddCheckIcon />}
                            onClick={() => openDialog('pir_action', hypothesis)}
                            data-testid={`rca-create-pir-action-${idx}`}
                          >
                            Create PIR Action
                          </Button>
                        </Tooltip>
                      )}
                    </Box>
                  </Box>
                )}
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

      {/* Orchestration confirmation dialog */}
      <Dialog
        open={dialogType !== null}
        onClose={closeDialog}
        maxWidth="sm"
        fullWidth
        data-testid="rca-orchestration-dialog"
      >
        <DialogTitle>{dialogTitle}</DialogTitle>
        <DialogContent>
          {/* Hypothesis summary chip */}
          {dialogHypothesis && (
            <Box sx={{ mb: 2, mt: 1 }}>
              <Chip
                label={`Hypothesis: ${dialogHypothesis.suspectNodeLabel} (${(dialogHypothesis.score * 100).toFixed(0)}% confidence)`}
                size="small"
                color="warning"
                variant="outlined"
              />
            </Box>
          )}

          {dialogType === 'problem' && (
            <>
              <TextField
                label="Short Description"
                value={shortDescription}
                onChange={(e) => setShortDescription(e.target.value)}
                fullWidth
                required
                margin="dense"
                inputProps={{ maxLength: 255, 'data-testid': 'rca-problem-short-desc' }}
              />
              <TextField
                label="Description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                fullWidth
                multiline
                rows={3}
                margin="dense"
                inputProps={{ 'data-testid': 'rca-problem-description' }}
              />
              <TextField
                label="Category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                select
                fullWidth
                margin="dense"
                data-testid="rca-problem-category"
              >
                {PROBLEM_CATEGORIES.map((c) => (
                  <MenuItem key={c} value={c}>{c}</MenuItem>
                ))}
              </TextField>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <TextField
                  label="Impact"
                  value={impact}
                  onChange={(e) => setImpact(e.target.value)}
                  select
                  fullWidth
                  margin="dense"
                  data-testid="rca-problem-impact"
                >
                  {IMPACT_OPTIONS.map((v) => (
                    <MenuItem key={v} value={v}>{v}</MenuItem>
                  ))}
                </TextField>
                <TextField
                  label="Urgency"
                  value={urgency}
                  onChange={(e) => setUrgency(e.target.value)}
                  select
                  fullWidth
                  margin="dense"
                  data-testid="rca-problem-urgency"
                >
                  {URGENCY_OPTIONS.map((v) => (
                    <MenuItem key={v} value={v}>{v}</MenuItem>
                  ))}
                </TextField>
              </Box>
            </>
          )}

          {dialogType === 'known_error' && (
            <>
              <TextField
                label="Title"
                value={keTitle}
                onChange={(e) => setKeTitle(e.target.value)}
                fullWidth
                required
                margin="dense"
                inputProps={{ maxLength: 255, 'data-testid': 'rca-ke-title' }}
              />
              <TextField
                label="Root Cause"
                value={rootCause}
                onChange={(e) => setRootCause(e.target.value)}
                fullWidth
                multiline
                rows={3}
                margin="dense"
                inputProps={{ 'data-testid': 'rca-ke-root-cause' }}
              />
              <TextField
                label="Workaround (optional)"
                value={workaround}
                onChange={(e) => setWorkaround(e.target.value)}
                fullWidth
                multiline
                rows={2}
                margin="dense"
                inputProps={{ 'data-testid': 'rca-ke-workaround' }}
              />
            </>
          )}

          {dialogType === 'pir_action' && (
            <>
              {pirIds.length === 0 ? (
                <Alert severity="warning" sx={{ mb: 1 }} data-testid="rca-no-pir-warning">
                  No PIR found for this major incident. Create a PIR first before adding actions.
                </Alert>
              ) : (
                <TextField
                  label="PIR"
                  value={selectedPirId}
                  onChange={(e) => setSelectedPirId(e.target.value)}
                  select
                  fullWidth
                  required
                  margin="dense"
                  data-testid="rca-pir-select"
                >
                  {pirIds.map((p) => (
                    <MenuItem key={p.id} value={p.id}>{p.title}</MenuItem>
                  ))}
                </TextField>
              )}
              <TextField
                label="Action Title"
                value={pirActionTitle}
                onChange={(e) => setPirActionTitle(e.target.value)}
                fullWidth
                required
                margin="dense"
                inputProps={{ maxLength: 255, 'data-testid': 'rca-pir-action-title' }}
              />
              <TextField
                label="Description"
                value={pirActionDescription}
                onChange={(e) => setPirActionDescription(e.target.value)}
                fullWidth
                multiline
                rows={3}
                margin="dense"
                inputProps={{ 'data-testid': 'rca-pir-action-description' }}
              />
              <TextField
                label="Priority"
                value={pirActionPriority}
                onChange={(e) => setPirActionPriority(e.target.value)}
                select
                fullWidth
                margin="dense"
                data-testid="rca-pir-action-priority"
              >
                {PIR_ACTION_PRIORITIES.map((p) => (
                  <MenuItem key={p} value={p}>{p}</MenuItem>
                ))}
              </TextField>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialog} disabled={submitting}>Cancel</Button>
          <Button
            onClick={handleOrchestrationSubmit}
            variant="contained"
            disabled={submitting || !canSubmitDialog()}
            startIcon={submitting ? <CircularProgress size={16} /> : undefined}
            data-testid="rca-orchestration-submit"
          >
            {submitting ? 'Creating...' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default TopologyRcaHypothesesTable;
