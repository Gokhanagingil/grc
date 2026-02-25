import React, { useState, useCallback } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Chip,
  Alert,
  Button,
  Divider,
  LinearProgress,
  CircularProgress,
  Checkbox,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tooltip,
  Skeleton,
} from '@mui/material';
import {
  Psychology as AdvisoryIcon,
  ExpandMore as ExpandMoreIcon,
  Warning as WarningIcon,
  CheckCircle as SuccessIcon,
  Error as ErrorIcon,
  Lightbulb as InsightIcon,
  Shield as ShieldIcon,
  Speed as SpeedIcon,
  Info as InfoIcon,
  PlayArrow as AnalyzeIcon,
  Create as CreateIcon,
} from '@mui/icons-material';
import {
  riskApi,
  unwrapResponse,
  ensureArray,
} from '../../services/grcClient';
import type {
  AdvisoryResult,
  AdvisorySuggestedRecord,
  AdvisoryMitigationAction,
  AdvisoryExplainabilityEntry,
  AdvisoryAffectedServiceInfo,
  AdvisoryCreateDraftsResult,
  AdvisoryCreateDraftItem,
} from '../../services/grcClient';

// ============================================================================
// Props
// ============================================================================

interface RiskIntelligenceAdvisoryPanelProps {
  riskId: string;
  tenantId: string;
}

// ============================================================================
// Helper functions
// ============================================================================

const getConfidenceColor = (confidence: number): 'error' | 'warning' | 'info' | 'success' => {
  if (confidence >= 70) return 'success';
  if (confidence >= 50) return 'info';
  if (confidence >= 30) return 'warning';
  return 'error';
};

const getConfidenceLabel = (confidence: number): string => {
  if (confidence >= 70) return 'High';
  if (confidence >= 50) return 'Moderate';
  if (confidence >= 30) return 'Low';
  return 'Very Low';
};

const getPriorityColor = (priority: string): 'error' | 'warning' | 'info' => {
  switch (priority) {
    case 'HIGH': return 'error';
    case 'MEDIUM': return 'warning';
    default: return 'info';
  }
};

const getThemeLabel = (theme: string): string => {
  const labels: Record<string, string> = {
    PATCHING: 'Patch Management',
    ACCESS: 'Access Control',
    BACKUP: 'Backup & Recovery',
    END_OF_SUPPORT: 'End of Support',
    VULNERABILITY: 'Vulnerability',
    CERTIFICATE: 'Certificate Management',
    NETWORK_EXPOSURE: 'Network Exposure',
    CONFIGURATION: 'Configuration',
    COMPLIANCE: 'Compliance',
    AVAILABILITY: 'Availability',
    DATA_PROTECTION: 'Data Protection',
    GENERAL: 'General',
  };
  return labels[theme] || theme;
};

const getTimeframeLabel = (timeframe: string): string => {
  const labels: Record<string, string> = {
    IMMEDIATE: 'Immediate',
    SHORT_TERM: 'Short-term',
    PERMANENT: 'Permanent',
    VERIFICATION: 'Verification',
  };
  return labels[timeframe] || timeframe;
};

const getRecordTypeLabel = (type: string): string => {
  const labels: Record<string, string> = {
    CHANGE: 'Change Request',
    CAPA: 'CAPA',
    CONTROL_TEST: 'Control Test',
    TASK: 'Task',
  };
  return labels[type] || type;
};

// ============================================================================
// Sub-components
// ============================================================================

const MitigationActionCard: React.FC<{ action: AdvisoryMitigationAction }> = ({ action }) => (
  <Box
    sx={{
      p: 1.5,
      mb: 1,
      border: '1px solid',
      borderColor: 'divider',
      borderRadius: 1,
      bgcolor: 'background.paper',
    }}
  >
    <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={0.5}>
      <Typography variant="subtitle2" sx={{ flex: 1 }}>
        {action.title}
      </Typography>
      <Chip
        label={action.priority}
        size="small"
        color={getPriorityColor(action.priority)}
        sx={{ ml: 1, fontSize: '0.7rem', height: 20 }}
      />
    </Box>
    <Typography variant="body2" color="text.secondary">
      {action.description}
    </Typography>
    {action.estimatedEffort && (
      <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
        Estimated effort: {action.estimatedEffort}
      </Typography>
    )}
  </Box>
);

const MitigationSection: React.FC<{
  title: string;
  actions: AdvisoryMitigationAction[];
  icon: React.ReactNode;
  color: string;
}> = ({ title, actions, icon, color }) => {
  if (actions.length === 0) return null;
  return (
    <Box sx={{ mb: 2 }}>
      <Box display="flex" alignItems="center" gap={1} mb={1}>
        {icon}
        <Typography variant="subtitle1" fontWeight="medium" color={color}>
          {title} ({actions.length})
        </Typography>
      </Box>
      {actions.map((action) => (
        <MitigationActionCard key={action.id} action={action} />
      ))}
    </Box>
  );
};

// ============================================================================
// Main Component
// ============================================================================

export const RiskIntelligenceAdvisoryPanel: React.FC<RiskIntelligenceAdvisoryPanelProps> = ({
  riskId,
  tenantId,
}) => {
  const [advisory, setAdvisory] = useState<AdvisoryResult | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);

  const [selectedRecords, setSelectedRecords] = useState<Set<string>>(new Set());
  const [creatingDrafts, setCreatingDrafts] = useState(false);
  const [draftsResult, setDraftsResult] = useState<AdvisoryCreateDraftsResult | null>(null);
  const [draftsError, setDraftsError] = useState<string | null>(null);

  // ---- Analyze ----
  const handleAnalyze = useCallback(async () => {
    setAnalyzing(true);
    setAnalyzeError(null);
    setDraftsResult(null);
    setDraftsError(null);
    setSelectedRecords(new Set());

    try {
      const response = await riskApi.advisoryAnalyze(tenantId, riskId);
      const data = unwrapResponse<AdvisoryResult>(response);
      setAdvisory(data);
    } catch (err: unknown) {
      const error = err as { response?: { status?: number; data?: { message?: string } } };
      const msg = error.response?.data?.message || 'Failed to generate advisory. Please try again.';
      setAnalyzeError(typeof msg === 'string' ? msg : String(msg));
      console.error('Advisory analyze error:', err);
    } finally {
      setAnalyzing(false);
    }
  }, [tenantId, riskId]);

  // ---- Select/deselect records ----
  const toggleRecord = (recordId: string) => {
    setSelectedRecords((prev) => {
      const next = new Set(prev);
      if (next.has(recordId)) {
        next.delete(recordId);
      } else {
        next.add(recordId);
      }
      return next;
    });
  };

  const toggleAll = () => {
    if (!advisory) return;
    const allIds = advisory.suggestedRecords.map((r) => r.id);
    if (selectedRecords.size === allIds.length) {
      setSelectedRecords(new Set());
    } else {
      setSelectedRecords(new Set(allIds));
    }
  };

  // ---- Create Drafts ----
  const handleCreateDrafts = useCallback(async () => {
    if (!advisory || selectedRecords.size === 0) return;

    setCreatingDrafts(true);
    setDraftsError(null);
    setDraftsResult(null);

    try {
      const items: AdvisoryCreateDraftItem[] = advisory.suggestedRecords
        .filter((sr) => selectedRecords.has(sr.id))
        .map((sr) => ({
          suggestedRecordId: sr.id,
          type: sr.type,
        }));

      const response = await riskApi.advisoryCreateDrafts(tenantId, riskId, items);
      const data = unwrapResponse<AdvisoryCreateDraftsResult>(response);
      setDraftsResult(data);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      const msg = error.response?.data?.message || 'Failed to create drafts. Please try again.';
      setDraftsError(typeof msg === 'string' ? msg : String(msg));
      console.error('Advisory create drafts error:', err);
    } finally {
      setCreatingDrafts(false);
    }
  }, [advisory, selectedRecords, tenantId, riskId]);

  // ---- Loading / Skeleton state ----
  if (analyzing) {
    return (
      <Card>
        <CardContent>
          <Box display="flex" alignItems="center" gap={2} mb={3}>
            <CircularProgress size={24} />
            <Typography variant="h6">Generating Risk Intelligence Advisory...</Typography>
          </Box>
          <Typography variant="body2" color="text.secondary" mb={2}>
            Analyzing risk context, linked controls, policies, and CMDB topology...
          </Typography>
          <Skeleton variant="rectangular" height={60} sx={{ mb: 2, borderRadius: 1 }} />
          <Skeleton variant="rectangular" height={100} sx={{ mb: 2, borderRadius: 1 }} />
          <Skeleton variant="rectangular" height={150} sx={{ borderRadius: 1 }} />
        </CardContent>
      </Card>
    );
  }

  // ---- Initial / Empty state ----
  if (!advisory && !analyzeError) {
    return (
      <Card>
        <CardContent>
          <Box textAlign="center" py={4}>
            <AdvisoryIcon sx={{ fontSize: 64, color: 'primary.main', mb: 2, opacity: 0.7 }} />
            <Typography variant="h5" gutterBottom>
              Risk Intelligence Advisory
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 3, maxWidth: 500, mx: 'auto' }}>
              Generate AI-ready deterministic advisory recommendations for this risk.
              Analyze linked controls, policies, and context to produce actionable mitigation plans.
            </Typography>
            <Button
              variant="contained"
              size="large"
              startIcon={<AnalyzeIcon />}
              onClick={handleAnalyze}
              sx={{ px: 4, py: 1.5 }}
            >
              Analyze Risk
            </Button>
            <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 2 }}>
              Human-in-the-loop: No actions will be taken automatically.
              You will review and select which draft records to create.
            </Typography>
          </Box>
        </CardContent>
      </Card>
    );
  }

  // ---- Error state ----
  if (analyzeError) {
    return (
      <Card>
        <CardContent>
          <Alert
            severity="error"
            action={
              <Button color="inherit" size="small" onClick={handleAnalyze}>
                Retry
              </Button>
            }
          >
            {analyzeError}
          </Alert>
        </CardContent>
      </Card>
    );
  }

  // ---- Advisory Result ----
  const mitigationPlan = advisory?.mitigationPlan || {
    immediateActions: [],
    shortTermActions: [],
    permanentActions: [],
    verificationSteps: [],
  };
  const suggestedRecords = ensureArray<AdvisorySuggestedRecord>(advisory?.suggestedRecords);
  const warnings = ensureArray<string>(advisory?.warnings);
  const assumptions = ensureArray<string>(advisory?.assumptions);
  const explainability = ensureArray<AdvisoryExplainabilityEntry>(advisory?.explainability);

  return (
    <Box>
      {/* Summary Card */}
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
            <Box display="flex" alignItems="center" gap={2}>
              <AdvisoryIcon color="primary" sx={{ fontSize: 32 }} />
              <Box>
                <Typography variant="h6">Risk Intelligence Advisory</Typography>
                <Typography variant="caption" color="text.secondary">
                  Generated: {advisory?.generatedAt ? new Date(advisory.generatedAt).toLocaleString() : '-'}
                </Typography>
              </Box>
            </Box>
            <Box display="flex" gap={1} alignItems="center">
              <Chip
                label={getThemeLabel(advisory?.riskTheme || '')}
                color="primary"
                variant="outlined"
                size="small"
              />
              <Tooltip title={`Confidence: ${advisory?.confidence || 0}% (${getConfidenceLabel(advisory?.confidence || 0)})`}>
                <Chip
                  icon={<SpeedIcon />}
                  label={`${advisory?.confidence || 0}%`}
                  color={getConfidenceColor(advisory?.confidence || 0)}
                  size="small"
                />
              </Tooltip>
              <Button
                variant="outlined"
                size="small"
                startIcon={<AnalyzeIcon />}
                onClick={handleAnalyze}
              >
                Re-analyze
              </Button>
            </Box>
          </Box>
          <Divider sx={{ mb: 2 }} />
          <Typography variant="body1">{advisory?.summary}</Typography>
        </CardContent>
      </Card>

      <Grid container spacing={2}>
        {/* Left Column: Mitigation Plan + Affected Services */}
        <Grid item xs={12} md={7}>
          {/* Mitigation Plan */}
          <Card sx={{ mb: 2 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                <ShieldIcon sx={{ mr: 1, verticalAlign: 'middle', color: 'primary.main' }} />
                Mitigation Plan
              </Typography>
              <Divider sx={{ mb: 2 }} />

              <MitigationSection
                title="Immediate Actions"
                actions={ensureArray(mitigationPlan.immediateActions)}
                icon={<ErrorIcon color="error" fontSize="small" />}
                color="error.main"
              />
              <MitigationSection
                title="Short-term Actions"
                actions={ensureArray(mitigationPlan.shortTermActions)}
                icon={<WarningIcon color="warning" fontSize="small" />}
                color="warning.main"
              />
              <MitigationSection
                title="Permanent Actions"
                actions={ensureArray(mitigationPlan.permanentActions)}
                icon={<ShieldIcon color="primary" fontSize="small" />}
                color="primary.main"
              />
              <MitigationSection
                title="Verification Steps"
                actions={ensureArray(mitigationPlan.verificationSteps)}
                icon={<SuccessIcon color="success" fontSize="small" />}
                color="success.main"
              />

              {ensureArray(mitigationPlan.immediateActions).length === 0 &&
               ensureArray(mitigationPlan.shortTermActions).length === 0 &&
               ensureArray(mitigationPlan.permanentActions).length === 0 &&
               ensureArray(mitigationPlan.verificationSteps).length === 0 && (
                <Typography color="text.secondary" textAlign="center" py={2}>
                  No specific mitigation actions identified for this risk theme.
                </Typography>
              )}
            </CardContent>
          </Card>

          {/* Affected Services / CIs */}
          {(ensureArray<AdvisoryAffectedServiceInfo>(advisory?.affectedServices).length > 0 || ensureArray<AdvisoryAffectedServiceInfo>(advisory?.affectedCis).length > 0) && (
            <Card sx={{ mb: 2 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>Affected Services & CIs</Typography>
                <Divider sx={{ mb: 2 }} />
                {ensureArray<AdvisoryAffectedServiceInfo>(advisory?.affectedServices).length > 0 && (
                  <Box mb={2}>
                    <Typography variant="subtitle2" color="text.secondary" mb={1}>Services</Typography>
                    <Box display="flex" flexWrap="wrap" gap={1}>
                      {ensureArray<AdvisoryAffectedServiceInfo>(advisory?.affectedServices).map((svc) => (
                        <Chip
                          key={svc.id}
                          label={svc.name}
                          size="small"
                          variant="outlined"
                          color={svc.criticality === 'CRITICAL' ? 'error' : 'default'}
                        />
                      ))}
                    </Box>
                  </Box>
                )}
                {ensureArray<AdvisoryAffectedServiceInfo>(advisory?.affectedCis).length > 0 && (
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary" mb={1}>Configuration Items</Typography>
                    <Box display="flex" flexWrap="wrap" gap={1}>
                      {ensureArray<AdvisoryAffectedServiceInfo>(advisory?.affectedCis).map((ci) => (
                        <Chip key={ci.id} label={ci.name} size="small" variant="outlined" />
                      ))}
                    </Box>
                  </Box>
                )}
              </CardContent>
            </Card>
          )}

          {/* Topology Impact */}
          {advisory?.topologyImpactSummary && (
            <Card sx={{ mb: 2 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>Topology Impact</Typography>
                <Divider sx={{ mb: 2 }} />
                <Grid container spacing={2}>
                  <Grid item xs={4}>
                    <Typography variant="body2" color="text.secondary">Dependencies</Typography>
                    <Typography variant="h6">{advisory.topologyImpactSummary.totalDependencies}</Typography>
                  </Grid>
                  <Grid item xs={4}>
                    <Typography variant="body2" color="text.secondary">Critical</Typography>
                    <Typography variant="h6" color="error.main">
                      {advisory.topologyImpactSummary.criticalDependencies}
                    </Typography>
                  </Grid>
                  <Grid item xs={4}>
                    <Typography variant="body2" color="text.secondary">Services</Typography>
                    <Typography variant="h6">{advisory.topologyImpactSummary.affectedServiceCount}</Typography>
                  </Grid>
                </Grid>
                <Typography variant="body2" color="text.secondary" mt={1}>
                  {advisory.topologyImpactSummary.impactDescription}
                </Typography>
              </CardContent>
            </Card>
          )}
        </Grid>

        {/* Right Column: Warnings, Explainability, Assumptions */}
        <Grid item xs={12} md={5}>
          {/* Warnings */}
          {warnings.length > 0 && (
            <Card sx={{ mb: 2, borderLeft: '4px solid', borderLeftColor: 'warning.main' }}>
              <CardContent>
                <Typography variant="subtitle1" gutterBottom>
                  <WarningIcon sx={{ mr: 1, verticalAlign: 'middle', color: 'warning.main' }} />
                  Warnings ({warnings.length})
                </Typography>
                {warnings.map((warning, i) => (
                  <Alert key={i} severity="warning" sx={{ mb: 1 }} icon={false}>
                    <Typography variant="body2">{warning}</Typography>
                  </Alert>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Explainability */}
          {explainability.length > 0 && (
            <Card sx={{ mb: 2 }}>
              <CardContent>
                <Typography variant="subtitle1" gutterBottom>
                  <InsightIcon sx={{ mr: 1, verticalAlign: 'middle', color: 'info.main' }} />
                  Explainability
                </Typography>
                <Divider sx={{ mb: 1 }} />
                {explainability.map((entry, i) => (
                  <Accordion key={i} disableGutters elevation={0} sx={{ '&:before': { display: 'none' } }}>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ px: 0 }}>
                      <Box display="flex" alignItems="center" gap={1} sx={{ width: '100%' }}>
                        <Typography variant="body2" sx={{ flex: 1 }}>{entry.signal}</Typography>
                        <Chip
                          label={`${entry.confidence}%`}
                          size="small"
                          color={getConfidenceColor(entry.confidence)}
                          sx={{ fontSize: '0.65rem', height: 18 }}
                        />
                      </Box>
                    </AccordionSummary>
                    <AccordionDetails sx={{ px: 0, pt: 0 }}>
                      <Typography variant="body2" color="text.secondary">{entry.reasoning}</Typography>
                      <Typography variant="caption" color="text.secondary">Source: {entry.source}</Typography>
                    </AccordionDetails>
                  </Accordion>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Assumptions */}
          {assumptions.length > 0 && (
            <Card sx={{ mb: 2 }}>
              <CardContent>
                <Typography variant="subtitle1" gutterBottom>
                  <InfoIcon sx={{ mr: 1, verticalAlign: 'middle', color: 'text.secondary' }} />
                  Assumptions
                </Typography>
                {assumptions.map((assumption, i) => (
                  <Typography key={i} variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                    {assumption}
                  </Typography>
                ))}
              </CardContent>
            </Card>
          )}
        </Grid>
      </Grid>

      {/* Suggested Records Table */}
      <Card sx={{ mt: 2 }}>
        <CardContent>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h6">
              <CreateIcon sx={{ mr: 1, verticalAlign: 'middle', color: 'primary.main' }} />
              Suggested Draft Records ({suggestedRecords.length})
            </Typography>
            <Button
              variant="contained"
              size="small"
              startIcon={creatingDrafts ? <CircularProgress size={16} color="inherit" /> : <CreateIcon />}
              onClick={handleCreateDrafts}
              disabled={selectedRecords.size === 0 || creatingDrafts}
            >
              {creatingDrafts ? 'Creating...' : `Create ${selectedRecords.size} Draft(s)`}
            </Button>
          </Box>
          <Divider sx={{ mb: 2 }} />

          {draftsError && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setDraftsError(null)}>
              {draftsError}
            </Alert>
          )}

          {draftsResult && (
            <Alert
              severity={draftsResult.totalFailed === 0 ? 'success' : 'warning'}
              sx={{ mb: 2 }}
              onClose={() => setDraftsResult(null)}
            >
              <Typography variant="body2">
                Created {draftsResult.totalCreated} of {draftsResult.totalRequested} draft(s).
                {draftsResult.totalFailed > 0 && ` ${draftsResult.totalFailed} failed.`}
              </Typography>
              {draftsResult.results
                .filter((r) => r.success && r.createdRecordId)
                .map((r) => (
                  <Typography key={r.suggestedRecordId} variant="body2" sx={{ mt: 0.5 }}>
                    {getRecordTypeLabel(r.type)}: {r.createdRecordCode || r.createdRecordId}
                  </Typography>
                ))}
              {draftsResult.results
                .filter((r) => !r.success && r.error)
                .map((r) => (
                  <Typography key={r.suggestedRecordId} variant="body2" color="error" sx={{ mt: 0.5 }}>
                    {getRecordTypeLabel(r.type)}: {r.error}
                  </Typography>
                ))}
            </Alert>
          )}

          {suggestedRecords.length === 0 ? (
            <Box textAlign="center" py={3}>
              <Typography color="text.secondary">
                No draft records suggested for this advisory.
              </Typography>
            </Box>
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell padding="checkbox">
                    <Checkbox
                      indeterminate={selectedRecords.size > 0 && selectedRecords.size < suggestedRecords.length}
                      checked={selectedRecords.size === suggestedRecords.length && suggestedRecords.length > 0}
                      onChange={toggleAll}
                    />
                  </TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Title</TableCell>
                  <TableCell>Priority</TableCell>
                  <TableCell>Timeframe</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {suggestedRecords.map((record: AdvisorySuggestedRecord) => {
                  // Find the matching mitigation action to get timeframe
                  const allActions: AdvisoryMitigationAction[] = [
                    ...ensureArray<AdvisoryMitigationAction>(mitigationPlan.immediateActions),
                    ...ensureArray<AdvisoryMitigationAction>(mitigationPlan.shortTermActions),
                    ...ensureArray<AdvisoryMitigationAction>(mitigationPlan.permanentActions),
                    ...ensureArray<AdvisoryMitigationAction>(mitigationPlan.verificationSteps),
                  ];
                  const matchingAction = allActions.find((a) => a.id === record.mitigationActionId);

                  return (
                    <TableRow key={record.id} hover>
                      <TableCell padding="checkbox">
                        <Checkbox
                          checked={selectedRecords.has(record.id)}
                          onChange={() => toggleRecord(record.id)}
                        />
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={getRecordTypeLabel(record.type)}
                          size="small"
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{record.title}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {record.description}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={record.priority}
                          size="small"
                          color={getPriorityColor(record.priority)}
                          sx={{ fontSize: '0.7rem', height: 20 }}
                        />
                      </TableCell>
                      <TableCell>
                        {matchingAction ? getTimeframeLabel(matchingAction.timeframe) : '-'}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}

          {creatingDrafts && <LinearProgress sx={{ mt: 1 }} />}
        </CardContent>
      </Card>

      {/* Human-in-the-loop notice */}
      <Box textAlign="center" mt={2}>
        <Typography variant="caption" color="text.secondary">
          Risk Intelligence Advisory Pack v1 — Deterministic heuristics engine.
          All recommendations require human review before action.
        </Typography>
      </Box>
    </Box>
  );
};
