import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Chip,
  Alert,
  Tabs,
  Tab,
  Paper,
  Button,
  IconButton,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  CircularProgress,
  Tooltip,
} from '@mui/material';
import {
  Warning as IssueIcon,
  ArrowBack as BackIcon,
  History as HistoryIcon,
  Link as LinkIcon,
  LinkOff as UnlinkIcon,
  Info as InfoIcon,
  Security as ControlIcon,
  FactCheck as TestResultIcon,
  Description as EvidenceIcon,
  Build as CapaIcon,
  Add as AddIcon,
  Edit as EditIcon,
} from '@mui/icons-material';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  issueApi,
  IssueData,
  controlApi,
  testResultApi,
  evidenceApi,
  capaApi,
  CapaData,
  CreateCapaDto,
  statusHistoryApi,
  unwrapResponse,
  unwrapPaginatedResponse,
  StatusHistoryItem,
} from '../services/grcClient';
import { useAuth } from '../contexts/AuthContext';
import { LoadingState, ErrorState } from '../components/common';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`issue-tabpanel-${index}`}
      aria-labelledby={`issue-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  );
}

interface LinkedControl {
  id: string;
  controlId: string;
  control: {
    id: string;
    name: string;
    code: string | null;
    status: string;
  };
  createdAt: string;
}

interface LinkedTestResult {
  id: string;
  testResultId: string;
  testResult: {
    id: string;
    name: string;
    result: string;
  };
  createdAt: string;
}

interface LinkedEvidence {
  id: string;
  evidenceId: string;
  evidence: {
    id: string;
    name: string;
    type: string;
    status: string;
  };
  createdAt: string;
}

interface AvailableControl {
  id: string;
  name: string;
  code: string | null;
}

interface AvailableTestResult {
  id: string;
  name: string;
  result: string;
}

interface AvailableEvidence {
  id: string;
  name: string;
  type: string;
}

const getStatusColor = (status: string): 'error' | 'warning' | 'info' | 'success' | 'default' => {
  switch (status?.toLowerCase()) {
    case 'open': return 'error';
    case 'in_progress': return 'warning';
    case 'resolved': return 'info';
    case 'closed': return 'success';
    case 'deferred': return 'default';
    default: return 'default';
  }
};

const getSeverityColor = (severity: string): 'error' | 'warning' | 'info' | 'success' | 'default' => {
  switch (severity?.toLowerCase()) {
    case 'critical': return 'error';
    case 'high': return 'error';
    case 'medium': return 'warning';
    case 'low': return 'info';
    default: return 'default';
  }
};

const getTypeColor = (type: string): 'error' | 'warning' | 'info' | 'success' | 'default' => {
  switch (type?.toLowerCase()) {
    case 'internal_audit': return 'info';
    case 'external_audit': return 'warning';
    case 'incident': return 'error';
    case 'self_assessment': return 'success';
    default: return 'default';
  }
};

const formatStatus = (status: string): string => {
  if (!status) return '-';
  return status.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
};

const formatDate = (dateString: string | null | undefined): string => {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleDateString();
};

const formatDateTime = (dateString: string | null | undefined): string => {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleString();
};

const ALLOWED_STATUS_TRANSITIONS: Record<string, string[]> = {
  open: ['in_progress', 'deferred', 'closed'],
  in_progress: ['resolved', 'deferred', 'open'],
  resolved: ['closed', 'open'],
  deferred: ['open', 'in_progress'],
  closed: ['open'],
};

export const IssueDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const tenantId = user?.tenantId || '';

  const [issue, setIssue] = useState<IssueData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [tabValue, setTabValue] = useState(0);

  const [linkedControls, setLinkedControls] = useState<LinkedControl[]>([]);
  const [linkedTestResults, setLinkedTestResults] = useState<LinkedTestResult[]>([]);
  const [linkedEvidence, setLinkedEvidence] = useState<LinkedEvidence[]>([]);
  const [linkedCapas, setLinkedCapas] = useState<CapaData[]>([]);
  const [linksLoading] = useState(false);

  const [availableControls, setAvailableControls] = useState<AvailableControl[]>([]);
  const [availableTestResults, setAvailableTestResults] = useState<AvailableTestResult[]>([]);
  const [availableEvidence, setAvailableEvidence] = useState<AvailableEvidence[]>([]);

  const [linkControlDialogOpen, setLinkControlDialogOpen] = useState(false);
  const [linkTestResultDialogOpen, setLinkTestResultDialogOpen] = useState(false);
  const [linkEvidenceDialogOpen, setLinkEvidenceDialogOpen] = useState(false);
  const [selectedControlId, setSelectedControlId] = useState('');
  const [selectedTestResultId, setSelectedTestResultId] = useState('');
  const [selectedEvidenceId, setSelectedEvidenceId] = useState('');
  const [linking, setLinking] = useState(false);

  const [statusHistory, setStatusHistory] = useState<StatusHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState('');
  const [statusReason, setStatusReason] = useState('');
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const [createCapaDialogOpen, setCreateCapaDialogOpen] = useState(false);
  const [newCapaData, setNewCapaData] = useState<Partial<CreateCapaDto>>({});
  const [creatingCapa, setCreatingCapa] = useState(false);

  const fetchIssue = useCallback(async () => {
    if (!id || !tenantId) return;

    setLoading(true);
    setError(null);

    try {
      const response = await issueApi.get(tenantId, id);
      const data = unwrapResponse<IssueData>(response);
      setIssue(data);
    } catch (err) {
      console.error('Error fetching issue:', err);
      setError('Failed to load issue details. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [id, tenantId]);

  const fetchLinkedEntities = useCallback(async () => {
    if (!id || !tenantId) return;

    try {
      const [controlsRes, testResultsRes, evidenceRes] = await Promise.all([
        issueApi.getControls(tenantId, id),
        issueApi.getTestResults(tenantId, id),
        issueApi.getEvidence(tenantId, id),
      ]);
      setLinkedControls(unwrapResponse<LinkedControl[]>(controlsRes) || []);
      setLinkedTestResults(unwrapResponse<LinkedTestResult[]>(testResultsRes) || []);
      setLinkedEvidence(unwrapResponse<LinkedEvidence[]>(evidenceRes) || []);
    } catch (err) {
      console.error('Error fetching linked entities:', err);
    }
  }, [id, tenantId]);

  const fetchLinkedCapas = useCallback(async () => {
    if (!id || !tenantId) return;

    try {
      const response = await capaApi.getByIssue(tenantId, id);
      const data = unwrapResponse<CapaData[]>(response);
      setLinkedCapas(data || []);
    } catch (err) {
      console.error('Error fetching linked CAPAs:', err);
      setLinkedCapas([]);
    }
  }, [id, tenantId]);

  const fetchAvailableEntities = useCallback(async () => {
    if (!tenantId) return;

    try {
      const [controlsRes, testResultsRes, evidenceRes] = await Promise.all([
        controlApi.list(tenantId, { pageSize: 100 }),
        testResultApi.list(tenantId, { pageSize: 100 }),
        evidenceApi.list(tenantId, { pageSize: 100 }),
      ]);
      setAvailableControls(unwrapPaginatedResponse<AvailableControl>(controlsRes).items || []);
      setAvailableTestResults(unwrapPaginatedResponse<AvailableTestResult>(testResultsRes).items || []);
      setAvailableEvidence(unwrapPaginatedResponse<AvailableEvidence>(evidenceRes).items || []);
    } catch (err) {
      console.error('Error fetching available entities:', err);
    }
  }, [tenantId]);

  const fetchStatusHistory = useCallback(async () => {
    if (!id || !tenantId) return;

    setHistoryLoading(true);
    try {
      const response = await statusHistoryApi.getByEntity(tenantId, 'issue', id);
      const data = unwrapResponse<StatusHistoryItem[]>(response);
      setStatusHistory(data || []);
    } catch (err) {
      console.error('Error fetching status history:', err);
      setStatusHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }, [id, tenantId]);

  useEffect(() => {
    fetchIssue();
  }, [fetchIssue]);

  useEffect(() => {
    if (tabValue === 1) {
      fetchLinkedEntities();
      fetchLinkedCapas();
      fetchAvailableEntities();
    } else if (tabValue === 2) {
      fetchStatusHistory();
    }
  }, [tabValue, fetchLinkedEntities, fetchLinkedCapas, fetchAvailableEntities, fetchStatusHistory]);

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleLinkControl = async () => {
    if (!id || !tenantId || !selectedControlId) return;

    setLinking(true);
    try {
      await issueApi.linkControl(tenantId, id, selectedControlId);
      setSuccess('Control linked successfully');
      setLinkControlDialogOpen(false);
      setSelectedControlId('');
      await fetchIssue();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      setError(error.response?.data?.message || 'Failed to link control');
    } finally {
      setLinking(false);
    }
  };

  const handleUnlinkControl = async (controlId: string) => {
    if (!id || !tenantId) return;
    if (!window.confirm('Are you sure you want to unlink this control?')) return;

    try {
      await issueApi.unlinkControl(tenantId, id, controlId);
      setSuccess('Control unlinked successfully');
      await fetchIssue();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      setError(error.response?.data?.message || 'Failed to unlink control');
    }
  };

  const handleLinkTestResult = async () => {
    if (!id || !tenantId || !selectedTestResultId) return;

    setLinking(true);
    try {
      await issueApi.linkTestResult(tenantId, id, selectedTestResultId);
      setSuccess('Test result linked successfully');
      setLinkTestResultDialogOpen(false);
      setSelectedTestResultId('');
      await fetchIssue();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      setError(error.response?.data?.message || 'Failed to link test result');
    } finally {
      setLinking(false);
    }
  };

  const handleUnlinkTestResult = async (testResultId: string) => {
    if (!id || !tenantId) return;
    if (!window.confirm('Are you sure you want to unlink this test result?')) return;

    try {
      await issueApi.unlinkTestResult(tenantId, id, testResultId);
      setSuccess('Test result unlinked successfully');
      await fetchIssue();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      setError(error.response?.data?.message || 'Failed to unlink test result');
    }
  };

  const handleLinkEvidence = async () => {
    if (!id || !tenantId || !selectedEvidenceId) return;

    setLinking(true);
    try {
      await issueApi.linkEvidence(tenantId, id, selectedEvidenceId);
      setSuccess('Evidence linked successfully');
      setLinkEvidenceDialogOpen(false);
      setSelectedEvidenceId('');
      await fetchIssue();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      setError(error.response?.data?.message || 'Failed to link evidence');
    } finally {
      setLinking(false);
    }
  };

  const handleUnlinkEvidence = async (evidenceId: string) => {
    if (!id || !tenantId) return;
    if (!window.confirm('Are you sure you want to unlink this evidence?')) return;

    try {
      await issueApi.unlinkEvidence(tenantId, id, evidenceId);
      setSuccess('Evidence unlinked successfully');
      await fetchIssue();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      setError(error.response?.data?.message || 'Failed to unlink evidence');
    }
  };

  const handleOpenStatusDialog = () => {
    if (!issue) return;
    setSelectedStatus('');
    setStatusReason('');
    setStatusDialogOpen(true);
  };

  const handleUpdateStatus = async () => {
    if (!id || !tenantId || !selectedStatus) return;

    setUpdatingStatus(true);
    try {
      await issueApi.updateStatus(tenantId, id, { status: selectedStatus, reason: statusReason || undefined });
      setSuccess('Status updated successfully');
      setStatusDialogOpen(false);
      await fetchIssue();
      if (tabValue === 2) {
        await fetchStatusHistory();
      }
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      setError(error.response?.data?.message || 'Failed to update status');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const getAvailableControlsForLinking = () => {
    const linkedIds = new Set(linkedControls.map(lc => lc.controlId));
    return availableControls.filter(c => !linkedIds.has(c.id));
  };

  const getAvailableTestResultsForLinking = () => {
    const linkedIds = new Set(linkedTestResults.map(lt => lt.testResultId));
    return availableTestResults.filter(t => !linkedIds.has(t.id));
  };

  const getAvailableEvidenceForLinking = () => {
    const linkedIds = new Set(linkedEvidence.map(le => le.evidenceId));
    return availableEvidence.filter(e => !linkedIds.has(e.id));
  };

  const getAvailableTransitions = () => {
    if (!issue) return [];
    return ALLOWED_STATUS_TRANSITIONS[issue.status?.toLowerCase()] || [];
  };

  const handleOpenCreateCapaDialog = () => {
    setNewCapaData({ title: '', description: '', type: 'corrective', priority: 'high' });
    setCreateCapaDialogOpen(true);
  };

  const handleCreateCapa = async () => {
    if (!id || !tenantId || !newCapaData.title) return;

    setCreatingCapa(true);
    try {
      await capaApi.createFromIssue(tenantId, id, {
        issueId: id,
        title: newCapaData.title,
        description: newCapaData.description,
        type: newCapaData.type || 'corrective',
        priority: newCapaData.priority || 'high',
        dueDate: newCapaData.dueDate,
      });
      setSuccess('CAPA created successfully');
      setCreateCapaDialogOpen(false);
      await fetchLinkedCapas();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      setError(error.response?.data?.message || 'Failed to create CAPA');
    } finally {
      setCreatingCapa(false);
    }
  };

  if (loading) {
    return <LoadingState message="Loading issue details..." />;
  }

  if (error && !issue) {
    return <ErrorState message={error} onRetry={fetchIssue} />;
  }

  if (!issue) {
    return <ErrorState message="Issue not found" />;
  }

    return (
      <Box sx={{ p: 3 }} data-testid="issue-detail-page">
        <Box display="flex" alignItems="center" gap={2} mb={3}>
          <IconButton onClick={() => navigate('/issues')} data-testid="back-button">
          <BackIcon />
        </IconButton>
        <Box flex={1}>
          <Typography variant="h4" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <IssueIcon /> {issue.title}
          </Typography>
          <Typography variant="subtitle1" color="text.secondary">
            Issue ID: {issue.id}
          </Typography>
        </Box>
        <Chip
          label={formatStatus(issue.type)}
          color={getTypeColor(issue.type)}
          data-testid="issue-type-chip"
        />
        <Chip
          label={formatStatus(issue.severity)}
          color={getSeverityColor(issue.severity)}
          data-testid="issue-severity-chip"
        />
        <Chip
          label={formatStatus(issue.status)}
          color={getStatusColor(issue.status)}
          data-testid="issue-status-chip"
        />
        <Button
          variant="outlined"
          startIcon={<EditIcon />}
          onClick={handleOpenStatusDialog}
          disabled={getAvailableTransitions().length === 0}
          data-testid="change-status-button"
        >
          Change Status
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>{success}</Alert>}

      <Paper sx={{ width: '100%' }}>
        <Tabs value={tabValue} onChange={handleTabChange} aria-label="issue detail tabs">
          <Tab icon={<InfoIcon />} label="Overview" iconPosition="start" data-testid="overview-tab" />
          <Tab icon={<LinkIcon />} label="Links" iconPosition="start" data-testid="links-tab" />
          <Tab icon={<HistoryIcon />} label="History" iconPosition="start" data-testid="history-tab" />
        </Tabs>

        <TabPanel value={tabValue} index={0}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>Issue Information</Typography>
                  <Divider sx={{ mb: 2 }} />
                  <Grid container spacing={2}>
                    <Grid item xs={4}><Typography color="text.secondary">Title</Typography></Grid>
                    <Grid item xs={8}><Typography>{issue.title}</Typography></Grid>
                    <Grid item xs={4}><Typography color="text.secondary">Type</Typography></Grid>
                    <Grid item xs={8}><Chip label={formatStatus(issue.type)} size="small" color={getTypeColor(issue.type)} /></Grid>
                    <Grid item xs={4}><Typography color="text.secondary">Status</Typography></Grid>
                    <Grid item xs={8}><Chip label={formatStatus(issue.status)} size="small" color={getStatusColor(issue.status)} /></Grid>
                    <Grid item xs={4}><Typography color="text.secondary">Severity</Typography></Grid>
                    <Grid item xs={8}><Chip label={formatStatus(issue.severity)} size="small" color={getSeverityColor(issue.severity)} /></Grid>
                    <Grid item xs={4}><Typography color="text.secondary">Due Date</Typography></Grid>
                    <Grid item xs={8}><Typography>{formatDate(issue.dueDate)}</Typography></Grid>
                  </Grid>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>Audit Information</Typography>
                  <Divider sx={{ mb: 2 }} />
                  <Grid container spacing={2}>
                    <Grid item xs={4}><Typography color="text.secondary">Created</Typography></Grid>
                    <Grid item xs={8}><Typography>{formatDateTime(issue.createdAt)}</Typography></Grid>
                    <Grid item xs={4}><Typography color="text.secondary">Updated</Typography></Grid>
                    <Grid item xs={8}><Typography>{formatDateTime(issue.updatedAt)}</Typography></Grid>
                    <Grid item xs={4}><Typography color="text.secondary">Resolved Date</Typography></Grid>
                    <Grid item xs={8}><Typography>{formatDate(issue.resolvedDate)}</Typography></Grid>
                  </Grid>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>Description</Typography>
                  <Divider sx={{ mb: 2 }} />
                  <Typography sx={{ whiteSpace: 'pre-wrap' }}>{issue.description || 'No description provided.'}</Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          {linksLoading ? (
            <Box display="flex" justifyContent="center" p={3}>
              <CircularProgress />
            </Box>
          ) : (
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <Card>
                  <CardContent>
                    <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                      <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <ControlIcon /> Linked Controls ({linkedControls.length})
                      </Typography>
                      <Button
                        variant="outlined"
                        startIcon={<AddIcon />}
                        onClick={() => setLinkControlDialogOpen(true)}
                        disabled={getAvailableControlsForLinking().length === 0}
                        data-testid="link-control-button"
                      >
                        Link Control
                      </Button>
                    </Box>
                    <Divider sx={{ mb: 2 }} />
                    {linkedControls.length === 0 ? (
                      <Typography color="text.secondary">No controls linked.</Typography>
                    ) : (
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>Code</TableCell>
                            <TableCell>Name</TableCell>
                            <TableCell>Status</TableCell>
                            <TableCell>Linked At</TableCell>
                            <TableCell>Actions</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {linkedControls.map((link) => (
                            <TableRow key={link.id}>
                              <TableCell>
                                <Link to={`/controls/${link.control.id}`} style={{ textDecoration: 'none' }}>
                                  <Typography color="primary">{link.control.code || '-'}</Typography>
                                </Link>
                              </TableCell>
                              <TableCell>{link.control.name}</TableCell>
                              <TableCell><Chip label={formatStatus(link.control.status)} size="small" /></TableCell>
                              <TableCell>{formatDate(link.createdAt)}</TableCell>
                              <TableCell>
                                <Tooltip title="Unlink">
                                  <IconButton
                                    size="small"
                                    onClick={() => handleUnlinkControl(link.controlId)}
                                    color="error"
                                    data-testid={`unlink-control-${link.controlId}`}
                                  >
                                    <UnlinkIcon />
                                  </IconButton>
                                </Tooltip>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12}>
                <Card>
                  <CardContent>
                    <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                      <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <TestResultIcon /> Linked Test Results ({linkedTestResults.length})
                      </Typography>
                      <Button
                        variant="outlined"
                        startIcon={<AddIcon />}
                        onClick={() => setLinkTestResultDialogOpen(true)}
                        disabled={getAvailableTestResultsForLinking().length === 0}
                        data-testid="link-test-result-button"
                      >
                        Link Test Result
                      </Button>
                    </Box>
                    <Divider sx={{ mb: 2 }} />
                    {linkedTestResults.length === 0 ? (
                      <Typography color="text.secondary">No test results linked.</Typography>
                    ) : (
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>Name</TableCell>
                            <TableCell>Result</TableCell>
                            <TableCell>Linked At</TableCell>
                            <TableCell>Actions</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {linkedTestResults.map((link) => (
                            <TableRow key={link.id}>
                              <TableCell>
                                <Link to={`/test-results/${link.testResult.id}`} style={{ textDecoration: 'none' }}>
                                  <Typography color="primary">{link.testResult.name}</Typography>
                                </Link>
                              </TableCell>
                              <TableCell>
                                <Chip
                                  label={link.testResult.result}
                                  size="small"
                                  color={link.testResult.result === 'PASS' ? 'success' : link.testResult.result === 'FAIL' ? 'error' : 'default'}
                                />
                              </TableCell>
                              <TableCell>{formatDate(link.createdAt)}</TableCell>
                              <TableCell>
                                <Tooltip title="Unlink">
                                  <IconButton
                                    size="small"
                                    onClick={() => handleUnlinkTestResult(link.testResultId)}
                                    color="error"
                                    data-testid={`unlink-test-result-${link.testResultId}`}
                                  >
                                    <UnlinkIcon />
                                  </IconButton>
                                </Tooltip>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12} data-testid="linked-evidence-section">
                <Card>
                  <CardContent>
                    <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                      <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <EvidenceIcon /> Linked Evidence ({linkedEvidence.length})
                      </Typography>
                      <Button
                        variant="outlined"
                        startIcon={<AddIcon />}
                        onClick={() => setLinkEvidenceDialogOpen(true)}
                        disabled={getAvailableEvidenceForLinking().length === 0}
                        data-testid="link-evidence-button"
                      >
                        Link Evidence
                      </Button>
                    </Box>
                    <Divider sx={{ mb: 2 }} />
                    {linkedEvidence.length === 0 ? (
                      <Typography color="text.secondary">No evidence linked.</Typography>
                    ) : (
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>Name</TableCell>
                            <TableCell>Type</TableCell>
                            <TableCell>Status</TableCell>
                            <TableCell>Linked At</TableCell>
                            <TableCell>Actions</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {linkedEvidence.map((link) => (
                            <TableRow key={link.id}>
                              <TableCell>
                                <Link to={`/evidence/${link.evidence.id}`} style={{ textDecoration: 'none' }}>
                                  <Typography color="primary">{link.evidence.name}</Typography>
                                </Link>
                              </TableCell>
                              <TableCell><Chip label={formatStatus(link.evidence.type)} size="small" /></TableCell>
                              <TableCell><Chip label={formatStatus(link.evidence.status)} size="small" /></TableCell>
                              <TableCell>{formatDate(link.createdAt)}</TableCell>
                              <TableCell>
                                <Tooltip title="Unlink">
                                  <IconButton
                                    size="small"
                                    onClick={() => handleUnlinkEvidence(link.evidenceId)}
                                    color="error"
                                    data-testid={`unlink-evidence-${link.evidenceId}`}
                                  >
                                    <UnlinkIcon />
                                  </IconButton>
                                </Tooltip>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12}>
                <Card>
                  <CardContent>
                    <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                      <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <CapaIcon /> Linked CAPAs ({linkedCapas.length})
                      </Typography>
                      <Button
                        variant="contained"
                        startIcon={<AddIcon />}
                        onClick={handleOpenCreateCapaDialog}
                        data-testid="create-capa-button"
                      >
                        Create CAPA
                      </Button>
                    </Box>
                    <Divider sx={{ mb: 2 }} />
                    {linkedCapas.length === 0 ? (
                      <Typography color="text.secondary">No CAPAs linked to this issue.</Typography>
                    ) : (
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>Title</TableCell>
                            <TableCell>Type</TableCell>
                            <TableCell>Status</TableCell>
                            <TableCell>Priority</TableCell>
                            <TableCell>Due Date</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {linkedCapas.map((capa) => (
                            <TableRow key={capa.id}>
                              <TableCell>
                                <Link to={`/capa/${capa.id}`} style={{ textDecoration: 'none' }}>
                                  <Typography color="primary">{capa.title}</Typography>
                                </Link>
                              </TableCell>
                              <TableCell><Chip label={formatStatus(capa.type)} size="small" /></TableCell>
                              <TableCell><Chip label={formatStatus(capa.status)} size="small" color={getStatusColor(capa.status)} /></TableCell>
                              <TableCell><Chip label={formatStatus(capa.priority)} size="small" /></TableCell>
                              <TableCell>{formatDate(capa.dueDate)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          )}
        </TabPanel>

        <TabPanel value={tabValue} index={2}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Status History</Typography>
              <Divider sx={{ mb: 2 }} />
              {historyLoading ? (
                <Typography>Loading history...</Typography>
              ) : statusHistory.length === 0 ? (
                <Typography color="text.secondary" data-testid="status-history-empty">No status history available.</Typography>
              ) : (
                <Table size="small" data-testid="status-history-table">
                  <TableHead>
                    <TableRow>
                      <TableCell>Date</TableCell>
                      <TableCell>Previous Status</TableCell>
                      <TableCell>New Status</TableCell>
                      <TableCell>Changed By</TableCell>
                      <TableCell>Reason</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {statusHistory.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>{formatDateTime(item.createdAt)}</TableCell>
                        <TableCell>
                          {item.previousStatus ? (
                            <Chip label={formatStatus(item.previousStatus)} size="small" />
                          ) : (
                            '-'
                          )}
                        </TableCell>
                        <TableCell>
                          <Chip label={formatStatus(item.newStatus)} size="small" color={getStatusColor(item.newStatus)} />
                        </TableCell>
                        <TableCell>
                          {item.changedBy
                            ? `${item.changedBy.firstName || ''} ${item.changedBy.lastName || ''}`.trim() || item.changedBy.email
                            : '-'}
                        </TableCell>
                        <TableCell>{item.changeReason || '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabPanel>
      </Paper>

      <Dialog open={linkControlDialogOpen} onClose={() => setLinkControlDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Link Control</DialogTitle>
        <DialogContent>
          <Box mt={1}>
            <FormControl fullWidth>
              <InputLabel>Select Control</InputLabel>
              <Select
                value={selectedControlId}
                label="Select Control"
                onChange={(e) => setSelectedControlId(e.target.value)}
                data-testid="select-control-dropdown"
              >
                {getAvailableControlsForLinking().map((control) => (
                  <MenuItem key={control.id} value={control.id}>
                    {control.code ? `${control.code} - ${control.name}` : control.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLinkControlDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleLinkControl}
            variant="contained"
            disabled={!selectedControlId || linking}
            data-testid="confirm-link-control-button"
          >
            {linking ? 'Linking...' : 'Link'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={linkTestResultDialogOpen} onClose={() => setLinkTestResultDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Link Test Result</DialogTitle>
        <DialogContent>
          <Box mt={1}>
            <FormControl fullWidth>
              <InputLabel>Select Test Result</InputLabel>
              <Select
                value={selectedTestResultId}
                label="Select Test Result"
                onChange={(e) => setSelectedTestResultId(e.target.value)}
                data-testid="select-test-result-dropdown"
              >
                {getAvailableTestResultsForLinking().map((testResult) => (
                  <MenuItem key={testResult.id} value={testResult.id}>
                    {testResult.name} ({testResult.result})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLinkTestResultDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleLinkTestResult}
            variant="contained"
            disabled={!selectedTestResultId || linking}
            data-testid="confirm-link-test-result-button"
          >
            {linking ? 'Linking...' : 'Link'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={linkEvidenceDialogOpen} onClose={() => setLinkEvidenceDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Link Evidence</DialogTitle>
        <DialogContent>
          <Box mt={1}>
            <FormControl fullWidth>
              <InputLabel>Select Evidence</InputLabel>
              <Select
                value={selectedEvidenceId}
                label="Select Evidence"
                onChange={(e) => setSelectedEvidenceId(e.target.value)}
                data-testid="select-evidence-dropdown"
              >
                {getAvailableEvidenceForLinking().map((evidence) => (
                  <MenuItem key={evidence.id} value={evidence.id}>
                    {evidence.name} ({formatStatus(evidence.type)})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLinkEvidenceDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleLinkEvidence}
            variant="contained"
            disabled={!selectedEvidenceId || linking}
            data-testid="confirm-link-evidence-button"
          >
            {linking ? 'Linking...' : 'Link'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={statusDialogOpen} onClose={() => setStatusDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Change Issue Status</DialogTitle>
        <DialogContent>
          <Box display="flex" flexDirection="column" gap={2} mt={1}>
            <Typography variant="body2" color="text.secondary">
              Current Status: <Chip label={formatStatus(issue.status)} size="small" color={getStatusColor(issue.status)} />
            </Typography>
            <FormControl fullWidth>
              <InputLabel>New Status</InputLabel>
              <Select
                value={selectedStatus}
                label="New Status"
                onChange={(e) => setSelectedStatus(e.target.value)}
                data-testid="new-status-select"
              >
                {getAvailableTransitions().map((status) => (
                  <MenuItem key={status} value={status}>{formatStatus(status)}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="Reason (optional)"
              value={statusReason}
              onChange={(e) => setStatusReason(e.target.value)}
              fullWidth
              multiline
              rows={2}
              data-testid="status-reason-input"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setStatusDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleUpdateStatus}
            variant="contained"
            disabled={!selectedStatus || updatingStatus}
            data-testid="confirm-status-change-button"
          >
            {updatingStatus ? 'Updating...' : 'Update Status'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={createCapaDialogOpen} onClose={() => setCreateCapaDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create CAPA from Issue</DialogTitle>
        <DialogContent>
          <Box display="flex" flexDirection="column" gap={2} mt={1}>
            <TextField
              label="Title"
              value={newCapaData.title || ''}
              onChange={(e) => setNewCapaData({ ...newCapaData, title: e.target.value })}
              fullWidth
              required
              data-testid="new-capa-title-input"
            />
            <TextField
              label="Description"
              value={newCapaData.description || ''}
              onChange={(e) => setNewCapaData({ ...newCapaData, description: e.target.value })}
              fullWidth
              multiline
              rows={3}
              data-testid="new-capa-description-input"
            />
            <FormControl fullWidth>
              <InputLabel>Type</InputLabel>
              <Select
                value={newCapaData.type || 'corrective'}
                label="Type"
                onChange={(e) => setNewCapaData({ ...newCapaData, type: e.target.value as 'corrective' | 'preventive' | 'both' })}
                data-testid="new-capa-type-select"
              >
                <MenuItem value="corrective">Corrective</MenuItem>
                <MenuItem value="preventive">Preventive</MenuItem>
                <MenuItem value="both">Both</MenuItem>
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel>Priority</InputLabel>
              <Select
                value={newCapaData.priority || 'high'}
                label="Priority"
                onChange={(e) => setNewCapaData({ ...newCapaData, priority: e.target.value as 'low' | 'medium' | 'high' | 'critical' })}
                data-testid="new-capa-priority-select"
              >
                <MenuItem value="low">Low</MenuItem>
                <MenuItem value="medium">Medium</MenuItem>
                <MenuItem value="high">High</MenuItem>
                <MenuItem value="critical">Critical</MenuItem>
              </Select>
            </FormControl>
            <TextField
              label="Due Date"
              type="date"
              value={newCapaData.dueDate || ''}
              onChange={(e) => setNewCapaData({ ...newCapaData, dueDate: e.target.value })}
              fullWidth
              InputLabelProps={{ shrink: true }}
              data-testid="new-capa-due-date-input"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateCapaDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleCreateCapa}
            variant="contained"
            disabled={!newCapaData.title || creatingCapa}
            data-testid="confirm-create-capa-button"
          >
            {creatingCapa ? 'Creating...' : 'Create CAPA'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default IssueDetail;
