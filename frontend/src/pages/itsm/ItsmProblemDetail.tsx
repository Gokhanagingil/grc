import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Grid,
  IconButton,
  Paper,
  Tab,
  Tabs,
  TextField,
  Typography,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Autocomplete,
  Tooltip,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Save as SaveIcon,
  Link as LinkIcon,
  LinkOff as LinkOffIcon,
  BugReport as BugReportIcon,
  Refresh as RefreshIcon,
  Add as AddIcon,
} from '@mui/icons-material';
import {
  itsmApi,
  ItsmProblemData,
  CreateItsmProblemDto,
  UpdateItsmProblemDto,
  CompleteRcaDto,
  ProblemRcaData,
} from '../../services/grcClient';
import { useNotification } from '../../contexts/NotificationContext';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel({ children, value, index }: TabPanelProps) {
  return (
    <div role="tabpanel" hidden={value !== index} data-testid={`problem-tabpanel-${index}`}>
      {value === index && <Box sx={{ pt: 2 }}>{children}</Box>}
    </div>
  );
}

const STATE_OPTIONS = [
  { value: 'NEW', label: 'New' },
  { value: 'UNDER_INVESTIGATION', label: 'Under Investigation' },
  { value: 'KNOWN_ERROR', label: 'Known Error' },
  { value: 'RESOLVED', label: 'Resolved' },
  { value: 'CLOSED', label: 'Closed' },
];

const PRIORITY_OPTIONS = [
  { value: 'P1', label: 'P1 - Critical' },
  { value: 'P2', label: 'P2 - High' },
  { value: 'P3', label: 'P3 - Medium' },
  { value: 'P4', label: 'P4 - Low' },
];

const IMPACT_OPTIONS = [
  { value: 'HIGH', label: 'High' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'LOW', label: 'Low' },
];

const URGENCY_OPTIONS = [
  { value: 'HIGH', label: 'High' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'LOW', label: 'Low' },
];

const ROOT_CAUSE_CATEGORY_OPTIONS = [
  { value: 'HUMAN_ERROR', label: 'Human Error' },
  { value: 'PROCESS_FAILURE', label: 'Process Failure' },
  { value: 'TECHNOLOGY_FAILURE', label: 'Technology Failure' },
  { value: 'EXTERNAL_FACTOR', label: 'External Factor' },
  { value: 'DESIGN_FLAW', label: 'Design Flaw' },
  { value: 'CAPACITY_ISSUE', label: 'Capacity Issue' },
  { value: 'CHANGE_RELATED', label: 'Change Related' },
  { value: 'CONFIGURATION_ERROR', label: 'Configuration Error' },
  { value: 'VENDOR_ISSUE', label: 'Vendor Issue' },
  { value: 'UNKNOWN', label: 'Unknown' },
];

interface SearchableRecord {
  id: string;
  number?: string;
  shortDescription?: string;
  title?: string;
}

export const ItsmProblemDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showNotification } = useNotification();
  const isNew = !id || id === 'new';

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState(0);

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [state, setState] = useState('NEW');
  const [priority, setPriority] = useState('P3');
  const [impact, setImpact] = useState('MEDIUM');
  const [urgency, setUrgency] = useState('MEDIUM');
  const [category, setCategory] = useState('');
  const [rootCauseSummary, setRootCauseSummary] = useState('');
  const [workaroundSummary, setWorkaroundSummary] = useState('');

  // Related data
  const [linkedIncidents, setLinkedIncidents] = useState<Array<{ id: string; incident?: { id: string; number?: string; shortDescription?: string } }>>([]);
  const [linkedChanges, setLinkedChanges] = useState<Array<{ id: string; change?: { id: string; number?: string; shortDescription?: string } }>>([]);
  const [knownErrors, setKnownErrors] = useState<Array<{ id: string; title: string; state: string; permanentFixStatus: string }>>([]);

  // RCA data (Phase 2)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_rcaData, setRcaData] = useState<ProblemRcaData | null>(null);
  const [fiveWhySummary, setFiveWhySummary] = useState('');
  const [contributingFactors, setContributingFactors] = useState<string[]>([]);
  const [newContributingFactor, setNewContributingFactor] = useState('');
  const [rootCauseCategory, setRootCauseCategory] = useState('');
  const [detectionGap, setDetectionGap] = useState('');
  const [monitoringGap, setMonitoringGap] = useState('');
  const [rcaSaving, setRcaSaving] = useState(false);

  // Reopen dialog (Phase 2)
  const [reopenDialogOpen, setReopenDialogOpen] = useState(false);
  const [reopenReason, setReopenReason] = useState('');
  const [reopening, setReopening] = useState(false);

  // Link dialogs - with search
  const [linkIncidentDialogOpen, setLinkIncidentDialogOpen] = useState(false);
  const [linkChangeDialogOpen, setLinkChangeDialogOpen] = useState(false);
  const [linkTargetId, setLinkTargetId] = useState('');
  const [searchResults, setSearchResults] = useState<SearchableRecord[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  const [problemData, setProblemData] = useState<ItsmProblemData | null>(null);

  const fetchProblem = useCallback(async () => {
    if (isNew || !id) return;
    setLoading(true);
    setError(null);
    try {
      const response = await itsmApi.problems.get(id);
      const data = response.data;
      const problem = (data as { data?: ItsmProblemData })?.data || data as ItsmProblemData;
      setProblemData(problem);
      setTitle(problem.shortDescription || problem.title || '');
      setDescription(problem.description || '');
      setState(problem.state || 'NEW');
      setPriority(problem.priority || 'P3');
      setImpact(problem.impact || 'MEDIUM');
      setUrgency(problem.urgency || 'MEDIUM');
      setCategory(problem.category || '');
      setRootCauseSummary(problem.rootCauseSummary || '');
      setWorkaroundSummary(problem.workaroundSummary || '');
    } catch (err) {
      console.error('Error fetching problem:', err);
      setError('Failed to load problem details.');
    } finally {
      setLoading(false);
    }
  }, [id, isNew]);

  const fetchLinkedIncidents = useCallback(async () => {
    if (isNew || !id) return;
    try {
      const response = await itsmApi.problems.listIncidents(id);
      const data = response.data;
      const envelope = (data as { data?: unknown })?.data || data;
      setLinkedIncidents(Array.isArray(envelope) ? envelope : []);
    } catch {
      // Silently handle - tab will show empty
    }
  }, [id, isNew]);

  const fetchLinkedChanges = useCallback(async () => {
    if (isNew || !id) return;
    try {
      const response = await itsmApi.problems.listChanges(id);
      const data = response.data;
      const envelope = (data as { data?: unknown })?.data || data;
      setLinkedChanges(Array.isArray(envelope) ? envelope : []);
    } catch {
      // Silently handle
    }
  }, [id, isNew]);

  const fetchKnownErrors = useCallback(async () => {
    if (isNew || !id) return;
    try {
      const response = await itsmApi.knownErrors.list({ problemId: id });
      const data = response.data;
      const envelope = data as Record<string, unknown>;
      const inner = envelope?.data;
      if (inner && typeof inner === 'object' && 'items' in (inner as Record<string, unknown>)) {
        const paginated = inner as { items: Array<{ id: string; title: string; state: string; permanentFixStatus: string }> };
        setKnownErrors(paginated.items || []);
      } else if (Array.isArray(inner)) {
        setKnownErrors(inner);
      }
    } catch {
      // Silently handle
    }
  }, [id, isNew]);

  const fetchRcaData = useCallback(async () => {
    if (isNew || !id) return;
    try {
      const response = await itsmApi.problems.rca(id);
      const data = response.data;
      const rca = (data as ProblemRcaData) || null;
      setRcaData(rca);
      if (rca) {
        setFiveWhySummary(rca.fiveWhySummary || '');
        setContributingFactors(rca.contributingFactors || []);
        setRootCauseCategory(rca.rootCauseCategory || '');
        setDetectionGap(rca.detectionGap || '');
        setMonitoringGap(rca.monitoringGap || '');
      }
    } catch {
      // Silently handle - RCA tab will show defaults
    }
  }, [id, isNew]);

  useEffect(() => {
    fetchProblem();
    fetchLinkedIncidents();
    fetchLinkedChanges();
    fetchKnownErrors();
    fetchRcaData();
  }, [fetchProblem, fetchLinkedIncidents, fetchLinkedChanges, fetchKnownErrors, fetchRcaData]);

  // Search incidents for link dialog
  const searchIncidents = useCallback(async (query: string) => {
    if (!query || query.length < 2) { setSearchResults([]); return; }
    setSearchLoading(true);
    try {
      const response = await itsmApi.incidents.list({ q: query, pageSize: 10 });
      const data = response.data;
      const envelope = data as Record<string, unknown>;
      const inner = envelope?.data;
      let items: SearchableRecord[] = [];
      if (inner && typeof inner === 'object' && 'items' in (inner as Record<string, unknown>)) {
        items = ((inner as { items: SearchableRecord[] }).items || []);
      } else if (Array.isArray(inner)) { items = inner; }
      setSearchResults(items);
    } catch { setSearchResults([]); }
    finally { setSearchLoading(false); }
  }, []);

  // Search changes for link dialog
  const searchChanges = useCallback(async (query: string) => {
    if (!query || query.length < 2) { setSearchResults([]); return; }
    setSearchLoading(true);
    try {
      const response = await itsmApi.changes.list({ q: query, pageSize: 10 });
      const data = response.data;
      const envelope = data as Record<string, unknown>;
      const inner = envelope?.data;
      let items: SearchableRecord[] = [];
      if (inner && typeof inner === 'object' && 'items' in (inner as Record<string, unknown>)) {
        items = ((inner as { items: SearchableRecord[] }).items || []);
      } else if (Array.isArray(inner)) { items = inner; }
      setSearchResults(items);
    } catch { setSearchResults([]); }
    finally { setSearchLoading(false); }
  }, []);

  const handleSave = async () => {
    if (!title.trim()) {
      showNotification('Title is required', 'error');
      return;
    }
    setSaving(true);
    try {
      if (isNew) {
        const dto: CreateItsmProblemDto = {
          shortDescription: title,
          description: description || undefined,
          state,
          impact,
          urgency,
          category: category || undefined,
          rootCauseSummary: rootCauseSummary || undefined,
          workaroundSummary: workaroundSummary || undefined,
        };
        const response = await itsmApi.problems.create(dto);
        const data = response.data;
        const created = (data as { data?: ItsmProblemData })?.data || data as ItsmProblemData;
        showNotification('Problem created successfully', 'success');
        navigate(`/itsm/problems/${created.id}`, { replace: true });
      } else if (id) {
        const dto: UpdateItsmProblemDto = {
          shortDescription: title,
          description: description || undefined,
          state,
          priority,
          impact,
          urgency,
          category: category || undefined,
          rootCauseSummary: rootCauseSummary || undefined,
          workaroundSummary: workaroundSummary || undefined,
        };
        await itsmApi.problems.update(id, dto);
        showNotification('Problem updated successfully', 'success');
        fetchProblem();
      }
    } catch (err: unknown) {
      console.error('Error saving problem:', err);
      const axErr = err as { response?: { status?: number; data?: { message?: string | string[] } } };
      const status = axErr?.response?.status;
      const msg = axErr?.response?.data?.message;
      if (status === 400) {
        const detail = Array.isArray(msg) ? msg.join(', ') : msg || 'Validation error';
        showNotification(`Validation failed: ${detail}`, 'error');
      } else if (status === 403) {
        showNotification('Permission denied: you do not have access to save problems', 'error');
      } else {
        showNotification('Failed to save problem', 'error');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleLinkIncident = async () => {
    if (!id || !linkTargetId.trim()) return;
    try {
      await itsmApi.problems.linkIncident(id, linkTargetId.trim());
      showNotification('Incident linked successfully', 'success');
      setLinkIncidentDialogOpen(false);
      setLinkTargetId('');
      setSearchResults([]);
      fetchLinkedIncidents();
    } catch (err) {
      console.error('Error linking incident:', err);
      showNotification('Failed to link incident', 'error');
    }
  };

  const handleUnlinkIncident = async (incidentId: string) => {
    if (!id) return;
    try {
      await itsmApi.problems.unlinkIncident(id, incidentId);
      showNotification('Incident unlinked', 'success');
      fetchLinkedIncidents();
    } catch (err) {
      console.error('Error unlinking incident:', err);
      showNotification('Failed to unlink incident', 'error');
    }
  };

  const handleLinkChange = async () => {
    if (!id || !linkTargetId.trim()) return;
    try {
      await itsmApi.problems.linkChange(id, linkTargetId.trim());
      showNotification('Change linked successfully', 'success');
      setLinkChangeDialogOpen(false);
      setLinkTargetId('');
      setSearchResults([]);
      fetchLinkedChanges();
    } catch (err) {
      console.error('Error linking change:', err);
      showNotification('Failed to link change', 'error');
    }
  };

  const handleUnlinkChange = async (changeId: string) => {
    if (!id) return;
    try {
      await itsmApi.problems.unlinkChange(id, changeId);
      showNotification('Change unlinked', 'success');
      fetchLinkedChanges();
    } catch (err) {
      console.error('Error unlinking change:', err);
      showNotification('Failed to unlink change', 'error');
    }
  };

  // Phase 2: Complete RCA
  const handleCompleteRca = async () => {
    if (!id) return;
    setRcaSaving(true);
    try {
      const dto: CompleteRcaDto = {
        rootCauseSummary: rootCauseSummary || undefined,
        fiveWhySummary: fiveWhySummary || undefined,
        contributingFactors: contributingFactors.length > 0 ? contributingFactors : undefined,
        rootCauseCategory: rootCauseCategory || undefined,
        detectionGap: detectionGap || undefined,
        monitoringGap: monitoringGap || undefined,
      };
      await itsmApi.problems.completeRca(id, dto);
      showNotification('RCA marked as complete', 'success');
      fetchRcaData();
      fetchProblem();
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Failed to complete RCA';
      showNotification(errMsg, 'error');
    } finally { setRcaSaving(false); }
  };

  // Phase 2: Save RCA fields (without marking complete)
  const handleSaveRcaFields = async () => {
    if (!id) return;
    setRcaSaving(true);
    try {
      const dto: UpdateItsmProblemDto = {
        rootCauseSummary: rootCauseSummary || undefined,
        fiveWhySummary: fiveWhySummary || undefined,
        contributingFactors: contributingFactors.length > 0 ? contributingFactors : undefined,
        rootCauseCategory: rootCauseCategory || undefined,
        detectionGap: detectionGap || undefined,
        monitoringGap: monitoringGap || undefined,
      };
      await itsmApi.problems.update(id, dto);
      showNotification('RCA data saved', 'success');
      fetchRcaData();
    } catch (err) {
      console.error('Error saving RCA data:', err);
      showNotification('Failed to save RCA data', 'error');
    } finally { setRcaSaving(false); }
  };

  // Phase 2: Reopen problem
  const handleReopen = async () => {
    if (!id || !reopenReason.trim()) return;
    setReopening(true);
    try {
      await itsmApi.problems.reopen(id, reopenReason.trim());
      showNotification('Problem reopened successfully', 'success');
      setReopenDialogOpen(false);
      setReopenReason('');
      fetchProblem();
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Failed to reopen problem';
      showNotification(errMsg, 'error');
    } finally { setReopening(false); }
  };

  // Phase 2: Contributing factors management
  const handleAddContributingFactor = () => {
    if (newContributingFactor.trim()) {
      setContributingFactors(prev => [...prev, newContributingFactor.trim()]);
      setNewContributingFactor('');
    }
  };
  const handleRemoveContributingFactor = (index: number) => {
    setContributingFactors(prev => prev.filter((_, i) => i !== index));
  };

  const canReopen = problemData?.state === 'RESOLVED' || problemData?.state === 'CLOSED';

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight={300}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/itsm/problems')}>
          Back to Problems
        </Button>
        <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>
      </Box>
    );
  }

  return (
    <Box data-testid="problem-detail">
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <IconButton onClick={() => navigate('/itsm/problems')}>
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h4" fontWeight={600}>
            {isNew ? 'New Problem' : `Problem ${problemData?.number || ''}`}
          </Typography>
          {!isNew && problemData?.state && (
            <Chip
              label={problemData.state.replace(/_/g, ' ')}
              color={
                problemData.state === 'NEW' ? 'info' :
                problemData.state === 'UNDER_INVESTIGATION' ? 'warning' :
                problemData.state === 'KNOWN_ERROR' ? 'error' :
                problemData.state === 'RESOLVED' ? 'success' : 'default'
              }
            />
          )}
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          {canReopen && (
            <Button
              variant="outlined"
              color="warning"
              startIcon={<RefreshIcon />}
              onClick={() => setReopenDialogOpen(true)}
              data-testid="reopen-problem-btn"
            >
              Reopen
            </Button>
          )}
          <Button
            variant="contained"
            startIcon={<SaveIcon />}
            onClick={handleSave}
            disabled={saving}
            data-testid="save-problem-btn"
          >
            {saving ? 'Saving...' : isNew ? 'Create' : 'Save'}
          </Button>
        </Box>
      </Box>

      {!isNew && (
        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
          <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)} data-testid="problem-tabs">
            <Tab label="Overview" />
            <Tab label={`Incidents (${linkedIncidents.length})`} />
            <Tab label={`Changes (${linkedChanges.length})`} />
            <Tab label={`Known Errors (${knownErrors.length})`} />
            <Tab label="RCA" data-testid="rca-tab" />
          </Tabs>
        </Box>
      )}

      {(isNew || activeTab === 0) && (
        <TabPanel value={activeTab} index={isNew ? activeTab : 0}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={8}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>Details</Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        label="Title"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        required
                        data-testid="problem-title-input"
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        multiline
                        rows={4}
                        label="Description"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        multiline
                        rows={3}
                        label="Root Cause Summary"
                        value={rootCauseSummary}
                        onChange={(e) => setRootCauseSummary(e.target.value)}
                        helperText="Summarize the root cause once identified"
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        multiline
                        rows={3}
                        label="Workaround Summary"
                        value={workaroundSummary}
                        onChange={(e) => setWorkaroundSummary(e.target.value)}
                        helperText="Document any available workaround"
                      />
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={4}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>Classification</Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <FormControl fullWidth size="small">
                      <InputLabel>State</InputLabel>
                      <Select value={state} label="State" onChange={(e) => setState(e.target.value)}>
                        {STATE_OPTIONS.map(opt => (
                          <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                    {!isNew && (
                      <FormControl fullWidth size="small">
                        <InputLabel>Priority</InputLabel>
                        <Select value={priority} label="Priority" onChange={(e) => setPriority(e.target.value)}>
                          {PRIORITY_OPTIONS.map(opt => (
                            <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    )}
                    <FormControl fullWidth size="small">
                      <InputLabel>Impact</InputLabel>
                      <Select value={impact} label="Impact" onChange={(e) => setImpact(e.target.value)}>
                        {IMPACT_OPTIONS.map(opt => (
                          <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                    <FormControl fullWidth size="small">
                      <InputLabel>Urgency</InputLabel>
                      <Select value={urgency} label="Urgency" onChange={(e) => setUrgency(e.target.value)}>
                        {URGENCY_OPTIONS.map(opt => (
                          <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                    <TextField
                      fullWidth
                      size="small"
                      label="Category"
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                    />
                  </Box>
                </CardContent>
              </Card>
              {!isNew && problemData && (
                <Card sx={{ mt: 2 }}>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>Metadata</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Created: {new Date(problemData.createdAt).toLocaleString()}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Updated: {new Date(problemData.updatedAt).toLocaleString()}
                    </Typography>
                    {problemData.knownErrorStatus && (
                      <Chip
                        label={`Known Error: ${problemData.knownErrorStatus}`}
                        color="warning"
                        size="small"
                        sx={{ mt: 1 }}
                      />
                    )}
                    {(problemData as unknown as { rcaCompletedAt?: string }).rcaCompletedAt && (
                      <Chip
                        label="RCA Complete"
                        color="success"
                        size="small"
                        sx={{ mt: 1, ml: 1 }}
                      />
                    )}
                    {((problemData as unknown as { reopenCount?: number }).reopenCount ?? 0) > 0 && (
                      <Tooltip title={`Reopened ${(problemData as unknown as { reopenCount: number }).reopenCount} time(s)`}>
                        <Chip
                          label={`Reopened ×${(problemData as unknown as { reopenCount: number }).reopenCount}`}
                          color="warning"
                          size="small"
                          variant="outlined"
                          sx={{ mt: 1, ml: 1 }}
                        />
                      </Tooltip>
                    )}
                  </CardContent>
                </Card>
              )}
            </Grid>
          </Grid>
        </TabPanel>
      )}

      {!isNew && activeTab === 1 && (
        <TabPanel value={activeTab} index={1}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">Linked Incidents</Typography>
            <Button
              variant="outlined"
              startIcon={<LinkIcon />}
              onClick={() => { setLinkTargetId(''); setLinkIncidentDialogOpen(true); }}
              data-testid="link-incident-btn"
            >
              Link Incident
            </Button>
          </Box>
          {linkedIncidents.length === 0 ? (
            <Alert severity="info">No incidents linked to this problem.</Alert>
          ) : (
            <TableContainer component={Paper}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Number</TableCell>
                    <TableCell>Description</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {linkedIncidents.map((link) => {
                    const inc = link.incident || link as unknown as { id: string; number?: string; shortDescription?: string };
                    return (
                      <TableRow key={link.id}>
                        <TableCell>
                          <Typography
                            variant="body2"
                            sx={{ cursor: 'pointer', color: 'primary.main' }}
                            onClick={() => navigate(`/itsm/incidents/${inc.id}`)}
                          >
                            {inc.number || inc.id?.substring(0, 8)}
                          </Typography>
                        </TableCell>
                        <TableCell>{inc.shortDescription || '-'}</TableCell>
                        <TableCell align="right">
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => handleUnlinkIncident(inc.id)}
                          >
                            <LinkOffIcon fontSize="small" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </TabPanel>
      )}

      {!isNew && activeTab === 2 && (
        <TabPanel value={activeTab} index={2}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">Linked Changes</Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                variant="outlined"
                startIcon={<LinkIcon />}
                onClick={() => { setLinkTargetId(''); setSearchResults([]); setLinkChangeDialogOpen(true); }}
                data-testid="link-change-btn"
              >
                Link Change
              </Button>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => navigate('/itsm/changes/new')}
                data-testid="create-linked-change-btn"
              >
                Create Linked Change
              </Button>
            </Box>
          </Box>
          {linkedChanges.length === 0 ? (
            <Alert severity="info">No changes linked to this problem.</Alert>
          ) : (
            <TableContainer component={Paper}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Number</TableCell>
                    <TableCell>Description</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {linkedChanges.map((link) => {
                    const chg = link.change || link as unknown as { id: string; number?: string; shortDescription?: string };
                    return (
                      <TableRow key={link.id}>
                        <TableCell>
                          <Typography
                            variant="body2"
                            sx={{ cursor: 'pointer', color: 'primary.main' }}
                            onClick={() => navigate(`/itsm/changes/${chg.id}`)}
                          >
                            {chg.number || chg.id?.substring(0, 8)}
                          </Typography>
                        </TableCell>
                        <TableCell>{chg.shortDescription || '-'}</TableCell>
                        <TableCell align="right">
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => handleUnlinkChange(chg.id)}
                          >
                            <LinkOffIcon fontSize="small" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </TabPanel>
      )}

      {!isNew && activeTab === 3 && (
        <TabPanel value={activeTab} index={3}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">Known Errors</Typography>
            <Button
              variant="outlined"
              startIcon={<BugReportIcon />}
              onClick={() => navigate(`/itsm/known-errors/new?problemId=${id}`)}
              data-testid="create-known-error-btn"
            >
              Create Known Error
            </Button>
          </Box>
          {knownErrors.length === 0 ? (
            <Alert severity="info">No known errors linked to this problem.</Alert>
          ) : (
            <TableContainer component={Paper}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Title</TableCell>
                    <TableCell>State</TableCell>
                    <TableCell>Fix Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {knownErrors.map((ke) => (
                    <TableRow key={ke.id}>
                      <TableCell>
                        <Typography
                          variant="body2"
                          sx={{ cursor: 'pointer', color: 'primary.main' }}
                          onClick={() => navigate(`/itsm/known-errors/${ke.id}`)}
                        >
                          {ke.title}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip label={ke.state} size="small" />
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={ke.permanentFixStatus?.replace(/_/g, ' ') || 'NONE'}
                          size="small"
                          variant="outlined"
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </TabPanel>
      )}

      {/* Phase 2: RCA Tab */}
      {!isNew && activeTab === 4 && (
        <TabPanel value={activeTab} index={4}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">Root Cause Analysis</Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                variant="outlined"
                onClick={handleSaveRcaFields}
                disabled={rcaSaving}
                data-testid="save-rca-btn"
              >
                {rcaSaving ? 'Saving...' : 'Save RCA Draft'}
              </Button>
              <Button
                variant="contained"
                color="success"
                onClick={handleCompleteRca}
                disabled={rcaSaving || !rootCauseSummary.trim()}
                data-testid="complete-rca-btn"
              >
                Mark RCA Complete
              </Button>
            </Box>
          </Box>
          {(problemData as unknown as { rcaCompletedAt?: string }).rcaCompletedAt && (
            <Alert severity="success" sx={{ mb: 2 }}>
              RCA was completed on {new Date((problemData as unknown as { rcaCompletedAt: string }).rcaCompletedAt).toLocaleString()}
            </Alert>
          )}
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                rows={4}
                label="5-Why Summary"
                value={fiveWhySummary}
                onChange={(e) => setFiveWhySummary(e.target.value)}
                helperText="Document each 'Why' leading to the root cause"
                data-testid="five-why-input"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Root Cause Category</InputLabel>
                <Select
                  value={rootCauseCategory}
                  label="Root Cause Category"
                  onChange={(e) => setRootCauseCategory(e.target.value)}
                  data-testid="root-cause-category-select"
                >
                  <MenuItem value=""><em>None</em></MenuItem>
                  {ROOT_CAUSE_CATEGORY_OPTIONS.map(opt => (
                    <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                multiline
                rows={3}
                label="Root Cause Summary"
                value={rootCauseSummary}
                onChange={(e) => setRootCauseSummary(e.target.value)}
                helperText="Required to mark RCA complete"
                data-testid="root-cause-summary-input"
              />
            </Grid>
            <Grid item xs={12}>
              <Typography variant="subtitle2" gutterBottom>Contributing Factors</Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 1 }}>
                {contributingFactors.map((factor, idx) => (
                  <Chip
                    key={idx}
                    label={factor}
                    onDelete={() => handleRemoveContributingFactor(idx)}
                    data-testid={`contributing-factor-${idx}`}
                  />
                ))}
              </Box>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <TextField
                  size="small"
                  label="Add contributing factor"
                  value={newContributingFactor}
                  onChange={(e) => setNewContributingFactor(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddContributingFactor(); } }}
                  data-testid="new-contributing-factor-input"
                />
                <Button variant="outlined" size="small" onClick={handleAddContributingFactor}>
                  Add
                </Button>
              </Box>
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                multiline
                rows={3}
                label="Detection Gap"
                value={detectionGap}
                onChange={(e) => setDetectionGap(e.target.value)}
                helperText="What monitoring or detection failed to catch the issue?"
                data-testid="detection-gap-input"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                multiline
                rows={3}
                label="Monitoring Gap"
                value={monitoringGap}
                onChange={(e) => setMonitoringGap(e.target.value)}
                helperText="What monitoring should be added to prevent recurrence?"
                data-testid="monitoring-gap-input"
              />
            </Grid>
          </Grid>
        </TabPanel>
      )}

      {/* Link Incident Dialog - Searchable */}
      <Dialog open={linkIncidentDialogOpen} onClose={() => setLinkIncidentDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Link Incident</DialogTitle>
        <DialogContent>
          <Autocomplete
            freeSolo
            options={searchResults}
            getOptionLabel={(option) => {
              if (typeof option === 'string') return option;
              return `${option.number || ''} - ${option.shortDescription || option.title || option.id}`;
            }}
            loading={searchLoading}
            onInputChange={(_, value) => {
              if (typeof value === 'string') {
                setLinkTargetId(value);
                searchIncidents(value);
              }
            }}
            onChange={(_, value) => {
              if (value && typeof value !== 'string') {
                setLinkTargetId(value.id);
              }
            }}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Search incidents"
                placeholder="Type to search by number or description..."
                sx={{ mt: 1 }}
                data-testid="search-incident-input"
              />
            )}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLinkIncidentDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleLinkIncident} disabled={!linkTargetId.trim()}>
            Link
          </Button>
        </DialogActions>
      </Dialog>

      {/* Link Change Dialog - Searchable */}
      <Dialog open={linkChangeDialogOpen} onClose={() => setLinkChangeDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Link Change</DialogTitle>
        <DialogContent>
          <Autocomplete
            freeSolo
            options={searchResults}
            getOptionLabel={(option) => {
              if (typeof option === 'string') return option;
              return `${option.number || ''} - ${option.shortDescription || option.title || option.id}`;
            }}
            loading={searchLoading}
            onInputChange={(_, value) => {
              if (typeof value === 'string') {
                setLinkTargetId(value);
                searchChanges(value);
              }
            }}
            onChange={(_, value) => {
              if (value && typeof value !== 'string') {
                setLinkTargetId(value.id);
              }
            }}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Search changes"
                placeholder="Type to search by number or description..."
                sx={{ mt: 1 }}
                data-testid="search-change-input"
              />
            )}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLinkChangeDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleLinkChange} disabled={!linkTargetId.trim()}>
            Link
          </Button>
        </DialogActions>
      </Dialog>

      {/* Reopen Dialog */}
      <Dialog open={reopenDialogOpen} onClose={() => setReopenDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Reopen Problem</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            Reopening will change the state back to UNDER_INVESTIGATION and increment the reopen counter.
          </Alert>
          <TextField
            fullWidth
            multiline
            rows={3}
            label="Reason for Reopening"
            value={reopenReason}
            onChange={(e) => setReopenReason(e.target.value)}
            placeholder="Explain why this problem needs to be reopened..."
            required
            data-testid="reopen-reason-input"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReopenDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            color="warning"
            onClick={handleReopen}
            disabled={reopening || !reopenReason.trim()}
            data-testid="confirm-reopen-btn"
          >
            {reopening ? 'Reopening...' : 'Reopen'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ItsmProblemDetail;
