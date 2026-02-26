import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Button,
  CircularProgress,
  Alert,
  Chip,
  Drawer,
  IconButton,
  Divider,
  Card,
  CardContent,
  Collapse,
  Tooltip,
  LinearProgress,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Snackbar,
} from '@mui/material';
import {
  AutoAwesome as CopilotIcon,
  Close as CloseIcon,
  ContentCopy as CopyIcon,
  CheckCircle as SuccessIcon,
  Error as ErrorIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Info as InfoIcon,
  Assignment as TaskIcon,
  Lightbulb as ActionIcon,
  Email as EmailIcon,
  History as HistoryIcon,
  Storage as DataSourceIcon,
  Security as SecurityIcon,
  Speed as ConfidenceIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import {
  incidentCopilotApi,
  IncidentCopilotAnalysisResult,
  IncidentCopilotStatusResponse,
} from '../../services/grcClient';

interface IncidentCopilotPanelProps {
  open: boolean;
  onClose: () => void;
  incidentId: string;
  incidentNumber: string;
}

type AnalysisStep = 'idle' | 'checking_policy' | 'gathering_context' | 'generating' | 'saving' | 'done' | 'error';

const STEP_LABELS: Record<AnalysisStep, string> = {
  idle: 'Ready to analyze',
  checking_policy: 'Checking AI & tool policies...',
  gathering_context: 'Gathering context from local data & ServiceNow...',
  generating: 'Generating recommendations...',
  saving: 'Saving analysis snapshot...',
  done: 'Analysis complete',
  error: 'Analysis failed',
};

const CONFIDENCE_COLORS: Record<string, 'success' | 'warning' | 'error'> = {
  HIGH: 'success',
  MEDIUM: 'warning',
  LOW: 'error',
};

const SEVERITY_COLORS: Record<string, 'error' | 'warning' | 'info' | 'default'> = {
  CRITICAL: 'error',
  HIGH: 'error',
  MEDIUM: 'warning',
  LOW: 'info',
};

export const IncidentCopilotPanel: React.FC<IncidentCopilotPanelProps> = ({
  open,
  onClose,
  incidentId,
  incidentNumber,
}) => {
  const [status, setStatus] = useState<IncidentCopilotStatusResponse | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [analysis, setAnalysis] = useState<IncidentCopilotAnalysisResult | null>(null);
  const [analysisStep, setAnalysisStep] = useState<AnalysisStep>('idle');
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);

  // Options
  const [depth, setDepth] = useState<'quick' | 'standard'>('standard');
  const [tone, setTone] = useState<'professional' | 'calm' | 'transparent'>('professional');

  // UI sections
  const [showExplainability, setShowExplainability] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<IncidentCopilotAnalysisResult[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Snackbar
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string }>({ open: false, message: '' });

  // Load copilot status when panel opens
  const loadStatus = useCallback(async () => {
    if (!incidentId) return;
    setStatusLoading(true);
    try {
      const s = await incidentCopilotApi.getStatus(incidentId);
      setStatus(s);
    } catch {
      // Non-critical — show default disabled state
      setStatus(null);
    } finally {
      setStatusLoading(false);
    }
  }, [incidentId]);

  useEffect(() => {
    if (open) {
      loadStatus();
    }
  }, [open, loadStatus]);

  // Run analysis
  const handleAnalyze = async () => {
    setAnalyzeError(null);
    setAnalysis(null);

    try {
      setAnalysisStep('checking_policy');
      await new Promise((r) => setTimeout(r, 300));

      setAnalysisStep('gathering_context');
      await new Promise((r) => setTimeout(r, 300));

      setAnalysisStep('generating');
      const result = await incidentCopilotApi.analyze(incidentId, { depth, tone });

      if (result.status === 'FAIL') {
        setAnalysisStep('error');
        setAnalyzeError(result.error || 'Analysis failed. Check AI Control Center and Tool Gateway configuration.');
        setAnalysis(result);
        return;
      }

      setAnalysisStep('saving');
      await new Promise((r) => setTimeout(r, 200));

      setAnalysis(result);
      setAnalysisStep('done');

      // Refresh status to get latest analysis ref
      loadStatus();
    } catch (err: unknown) {
      setAnalysisStep('error');
      const message = err instanceof Error ? err.message : 'An unexpected error occurred';
      setAnalyzeError(message);
    }
  };

  // Load history
  const handleLoadHistory = async () => {
    if (historyLoading) return;
    setShowHistory(!showHistory);
    if (!showHistory) {
      setHistoryLoading(true);
      try {
        const result = await incidentCopilotApi.listAnalyses(incidentId, { page: 1, pageSize: 5 });
        setHistory(result.items);
      } catch {
        setHistory([]);
      } finally {
        setHistoryLoading(false);
      }
    }
  };

  // Copy to clipboard
  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setSnackbar({ open: true, message: `${label} copied to clipboard` });
    }).catch(() => {
      setSnackbar({ open: true, message: 'Failed to copy' });
    });
  };

  // View a historical analysis
  const handleViewHistorical = (item: IncidentCopilotAnalysisResult) => {
    setAnalysis(item);
    setAnalysisStep('done');
    setShowHistory(false);
  };

  const isAnalyzing = ['checking_policy', 'gathering_context', 'generating', 'saving'].includes(analysisStep);

  return (
    <>
      <Drawer
        anchor="right"
        open={open}
        onClose={onClose}
        PaperProps={{ sx: { width: { xs: '100%', sm: 520 }, p: 0 } }}
      >
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 2, borderBottom: 1, borderColor: 'divider' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CopilotIcon color="primary" />
            <Typography variant="h6" fontWeight={600}>Incident Copilot</Typography>
            <Chip label={incidentNumber} size="small" variant="outlined" />
          </Box>
          <IconButton onClick={onClose} size="small"><CloseIcon /></IconButton>
        </Box>

        <Box sx={{ overflowY: 'auto', flex: 1, p: 2 }}>
          {/* Status badges */}
          {statusLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}><CircularProgress size={24} /></Box>
          ) : (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
              <Chip
                icon={<SecurityIcon />}
                label={status?.isAiEnabled ? 'AI Enabled' : 'AI Disabled'}
                color={status?.isAiEnabled ? 'success' : 'default'}
                size="small"
                variant="outlined"
              />
              <Chip
                icon={<SecurityIcon />}
                label={status?.isFeatureEnabled ? 'Copilot Active' : 'Copilot Inactive'}
                color={status?.isFeatureEnabled ? 'success' : 'default'}
                size="small"
                variant="outlined"
              />
              <Chip
                icon={<DataSourceIcon />}
                label={status?.isToolsEnabled ? 'Tools Enabled' : 'Tools Disabled'}
                color={status?.isToolsEnabled ? 'info' : 'default'}
                size="small"
                variant="outlined"
              />
              {status?.providerType && (
                <Chip
                  label={`Provider: ${status.providerType}`}
                  size="small"
                  variant="outlined"
                  color="primary"
                />
              )}
              {status?.hasServiceNowProvider && (
                <Chip label="ServiceNow Connected" size="small" color="info" variant="outlined" />
              )}
            </Box>
          )}

          {/* Analyze CTA */}
          <Card variant="outlined" sx={{ mb: 2 }}>
            <CardContent sx={{ pb: '16px !important' }}>
              <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                <FormControl size="small" sx={{ minWidth: 120 }}>
                  <InputLabel>Depth</InputLabel>
                  <Select value={depth} label="Depth" onChange={(e) => setDepth(e.target.value as 'quick' | 'standard')} disabled={isAnalyzing}>
                    <MenuItem value="quick">Quick</MenuItem>
                    <MenuItem value="standard">Standard</MenuItem>
                  </Select>
                </FormControl>
                <FormControl size="small" sx={{ minWidth: 140 }}>
                  <InputLabel>Tone</InputLabel>
                  <Select value={tone} label="Tone" onChange={(e) => setTone(e.target.value as 'professional' | 'calm' | 'transparent')} disabled={isAnalyzing}>
                    <MenuItem value="professional">Professional</MenuItem>
                    <MenuItem value="calm">Calm</MenuItem>
                    <MenuItem value="transparent">Transparent</MenuItem>
                  </Select>
                </FormControl>
              </Box>

              <Button
                variant="contained"
                fullWidth
                startIcon={isAnalyzing ? <CircularProgress size={18} color="inherit" /> : <CopilotIcon />}
                onClick={handleAnalyze}
                disabled={isAnalyzing}
                data-testid="copilot-analyze-btn"
              >
                {isAnalyzing ? STEP_LABELS[analysisStep] : 'Analyze Incident'}
              </Button>

              {isAnalyzing && (
                <LinearProgress sx={{ mt: 1, borderRadius: 1 }} />
              )}
            </CardContent>
          </Card>

          {/* Error state */}
          {analyzeError && (
            <Alert
              severity="error"
              sx={{ mb: 2 }}
              action={
                analyzeError.includes('AI Control Center') || analyzeError.includes('disabled') ? (
                  <Button color="inherit" size="small" href="/settings/ai-control-center">
                    Configure
                  </Button>
                ) : undefined
              }
            >
              {analyzeError}
            </Alert>
          )}

          {/* Results */}
          {analysis && analysis.status === 'SUCCESS' && (
            <Box data-testid="copilot-results">
              {/* Executive Summary */}
              <Card variant="outlined" sx={{ mb: 2 }}>
                <CardContent>
                  <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                    Executive Summary
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <Chip
                      icon={<ConfidenceIcon />}
                      label={`Confidence: ${analysis.confidence}`}
                      size="small"
                      color={CONFIDENCE_COLORS[analysis.confidence] || 'default'}
                    />
                  </Box>
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                    {analysis.summary || 'No summary generated.'}
                  </Typography>
                </CardContent>
              </Card>

              {/* Recommended Actions / Triage Checklist */}
              {analysis.recommendedActions && analysis.recommendedActions.length > 0 && (
                <Card variant="outlined" sx={{ mb: 2 }}>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="subtitle2" fontWeight={600}>
                        Next Best Actions ({analysis.recommendedActions.length})
                      </Typography>
                      <IconButton
                        size="small"
                        onClick={() => handleCopy(
                          analysis.recommendedActions!.map((a, i) => `${i + 1}. [${a.severity || 'INFO'}] ${a.action}`).join('\n'),
                          'Actions'
                        )}
                      >
                        <CopyIcon fontSize="small" />
                      </IconButton>
                    </Box>
                    <List dense disablePadding>
                      {analysis.recommendedActions.map((action, idx) => (
                        <ListItem key={idx} disablePadding sx={{ py: 0.5 }}>
                          <ListItemIcon sx={{ minWidth: 32 }}>
                            <ActionIcon fontSize="small" color="primary" />
                          </ListItemIcon>
                          <ListItemText
                            primary={action.action}
                            secondary={
                              <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5 }}>
                                {action.severity && (
                                  <Chip
                                    label={action.severity}
                                    size="small"
                                    color={SEVERITY_COLORS[action.severity] || 'default'}
                                    sx={{ height: 20, fontSize: '0.7rem' }}
                                  />
                                )}
                                {action.category && (
                                  <Chip label={action.category} size="small" variant="outlined" sx={{ height: 20, fontSize: '0.7rem' }} />
                                )}
                              </Box>
                            }
                          />
                        </ListItem>
                      ))}
                    </List>
                  </CardContent>
                </Card>
              )}

              {/* Impact Assessment */}
              {analysis.impactAssessment && (
                <Card variant="outlined" sx={{ mb: 2 }}>
                  <CardContent>
                    <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                      Impact Assessment
                    </Typography>
                    <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                      {analysis.impactAssessment}
                    </Typography>
                  </CardContent>
                </Card>
              )}

              {/* Customer Update Draft */}
              {analysis.customerUpdateDraft && (
                <Card variant="outlined" sx={{ mb: 2 }}>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <EmailIcon fontSize="small" color="primary" />
                        <Typography variant="subtitle2" fontWeight={600}>
                          Customer Update Draft
                        </Typography>
                      </Box>
                      <IconButton size="small" onClick={() => handleCopy(analysis.customerUpdateDraft!, 'Customer update')}>
                        <CopyIcon fontSize="small" />
                      </IconButton>
                    </Box>
                    <Box sx={{ bgcolor: 'grey.50', p: 1.5, borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
                      <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: '0.85rem' }}>
                        {analysis.customerUpdateDraft}
                      </Typography>
                    </Box>
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                      [DRAFT] Review and adjust before sending to customer
                    </Typography>
                  </CardContent>
                </Card>
              )}

              {/* Proposed Internal Tasks */}
              {analysis.proposedTasks && analysis.proposedTasks.length > 0 && (
                <Card variant="outlined" sx={{ mb: 2 }}>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="subtitle2" fontWeight={600}>
                        Proposed Tasks (Draft)
                      </Typography>
                      <IconButton
                        size="small"
                        onClick={() => handleCopy(JSON.stringify(analysis.proposedTasks, null, 2), 'Tasks JSON')}
                      >
                        <CopyIcon fontSize="small" />
                      </IconButton>
                    </Box>
                    <List dense disablePadding>
                      {analysis.proposedTasks.map((task, idx) => (
                        <ListItem key={idx} disablePadding sx={{ py: 0.5 }}>
                          <ListItemIcon sx={{ minWidth: 32 }}>
                            <TaskIcon fontSize="small" color="action" />
                          </ListItemIcon>
                          <ListItemText
                            primary={task.title}
                            secondary={task.description}
                          />
                          {task.priority && (
                            <Chip label={task.priority} size="small" sx={{ height: 20, fontSize: '0.7rem' }} />
                          )}
                        </ListItem>
                      ))}
                    </List>
                    <Alert severity="info" sx={{ mt: 1 }} icon={<WarningIcon fontSize="small" />}>
                      These are draft suggestions only. No tasks are created automatically.
                    </Alert>
                  </CardContent>
                </Card>
              )}

              {/* Explainability drawer */}
              <Card variant="outlined" sx={{ mb: 2 }}>
                <CardContent sx={{ pb: '8px !important' }}>
                  <Button
                    fullWidth
                    onClick={() => setShowExplainability(!showExplainability)}
                    endIcon={showExplainability ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                    startIcon={<InfoIcon />}
                    sx={{ justifyContent: 'space-between', textTransform: 'none' }}
                    data-testid="copilot-explainability-toggle"
                  >
                    Explainability & Data Sources
                  </Button>
                  <Collapse in={showExplainability}>
                    <Divider sx={{ my: 1 }} />
                    <Box data-testid="copilot-explainability-content">
                      <Typography variant="caption" fontWeight={600} display="block" gutterBottom>
                        Data Sources Used
                      </Typography>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1.5 }}>
                        {(analysis.explainability?.dataSources || []).map((ds, i) => (
                          <Chip key={i} icon={<DataSourceIcon />} label={ds} size="small" variant="outlined" />
                        ))}
                      </Box>

                      <Typography variant="caption" fontWeight={600} display="block" gutterBottom>
                        Tool Calls
                      </Typography>
                      <Typography variant="body2" sx={{ mb: 1.5 }}>
                        {analysis.explainability?.toolCallCount ?? 0} tool call(s)
                        {(analysis.explainability?.toolKeysUsed || []).length > 0 && (
                          <> using: {analysis.explainability.toolKeysUsed.join(', ')}</>
                        )}
                      </Typography>

                      {(analysis.explainability?.assumptions || []).length > 0 && (
                        <>
                          <Typography variant="caption" fontWeight={600} display="block" gutterBottom>
                            Assumptions
                          </Typography>
                          <List dense disablePadding>
                            {analysis.explainability.assumptions.map((a, i) => (
                              <ListItem key={i} disablePadding sx={{ py: 0.25 }}>
                                <ListItemIcon sx={{ minWidth: 24 }}>
                                  <WarningIcon fontSize="small" color="warning" />
                                </ListItemIcon>
                                <ListItemText primary={<Typography variant="body2">{a}</Typography>} />
                              </ListItem>
                            ))}
                          </List>
                        </>
                      )}

                      <Divider sx={{ my: 1 }} />
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <ConfidenceIcon fontSize="small" />
                        <Typography variant="body2">
                          Confidence: <strong>{analysis.confidence}</strong>
                        </Typography>
                        <Tooltip title="Confidence is based on available data sources. More sources = higher confidence.">
                          <InfoIcon fontSize="small" color="action" />
                        </Tooltip>
                      </Box>
                    </Box>
                  </Collapse>
                </CardContent>
              </Card>
            </Box>
          )}

          {/* Empty state */}
          {!analysis && analysisStep === 'idle' && !analyzeError && (
            <Box sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
              <CopilotIcon sx={{ fontSize: 48, mb: 1, opacity: 0.5 }} />
              <Typography variant="body1" gutterBottom>
                Run analysis to get AI-powered insights
              </Typography>
              <Typography variant="body2" color="text.secondary">
                The copilot will analyze this incident using local data{' '}
                {status?.isToolsEnabled && status?.hasServiceNowProvider ? 'and ServiceNow context' : ''}
                {' '}to provide recommendations.
              </Typography>
            </Box>
          )}

          {/* History section */}
          <Divider sx={{ my: 2 }} />
          <Button
            fullWidth
            onClick={handleLoadHistory}
            startIcon={<HistoryIcon />}
            endIcon={showHistory ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            sx={{ justifyContent: 'space-between', textTransform: 'none', mb: 1 }}
          >
            Analysis History
          </Button>
          <Collapse in={showHistory}>
            {historyLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                <CircularProgress size={20} />
              </Box>
            ) : history.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ py: 1, textAlign: 'center' }}>
                No previous analyses
              </Typography>
            ) : (
              <List dense>
                {history.map((item) => (
                  <ListItem
                    key={item.analysisId}
                    sx={{ cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' }, borderRadius: 1 }}
                    onClick={() => handleViewHistorical(item)}
                  >
                    <ListItemIcon sx={{ minWidth: 32 }}>
                      {item.status === 'SUCCESS' ? (
                        <SuccessIcon fontSize="small" color="success" />
                      ) : (
                        <ErrorIcon fontSize="small" color="error" />
                      )}
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="body2">
                            {new Date(item.createdAt).toLocaleString()}
                          </Typography>
                          <Chip label={item.confidence} size="small" color={CONFIDENCE_COLORS[item.confidence] || 'default'} sx={{ height: 18, fontSize: '0.65rem' }} />
                        </Box>
                      }
                      secondary={`${item.providerType} | ${item.status}`}
                    />
                  </ListItem>
                ))}
              </List>
            )}
          </Collapse>
        </Box>
      </Drawer>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        message={snackbar.message}
      />
    </>
  );
};

export default IncidentCopilotPanel;
