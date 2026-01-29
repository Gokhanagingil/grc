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
  CircularProgress,
  Tooltip,
} from '@mui/material';
import {
  Description as EvidenceIcon,
  ArrowBack as BackIcon,
  History as HistoryIcon,
  Link as LinkIcon,
  LinkOff as UnlinkIcon,
  Info as InfoIcon,
  Security as ControlIcon,
  FactCheck as TestResultIcon,
  Warning as IssueIcon,
  Add as AddIcon,
  AttachFile as AttachmentIcon,
} from '@mui/icons-material';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  evidenceApi,
  EvidenceData,
  controlApi,
  testResultApi,
  issueApi,
  statusHistoryApi,
  unwrapResponse,
  unwrapPaginatedResponse,
  StatusHistoryItem,
} from '../services/grcClient';
import { useAuth } from '../contexts/AuthContext';
import { LoadingState, ErrorState, AttachmentPanel } from '../components/common';

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
      id={`evidence-tabpanel-${index}`}
      aria-labelledby={`evidence-tab-${index}`}
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

interface LinkedIssue {
  id: string;
  issueId: string;
  issue: {
    id: string;
    title: string;
    status: string;
    severity: string;
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

interface AvailableIssue {
  id: string;
  title: string;
  status: string;
}

const getStatusColor = (status: string): 'error' | 'warning' | 'info' | 'success' | 'default' => {
  switch (status?.toLowerCase()) {
    case 'approved': return 'success';
    case 'draft': return 'default';
    case 'retired': return 'error';
    default: return 'default';
  }
};

const getTypeColor = (type: string): 'error' | 'warning' | 'info' | 'success' | 'default' => {
  switch (type?.toLowerCase()) {
    case 'document': return 'info';
    case 'screenshot': return 'warning';
    case 'log': return 'success';
    case 'report': return 'info';
    case 'link': return 'warning';
    default: return 'default';
  }
};

const formatStatus = (status: string): string => {
  if (!status) return '-';
  return status.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
};

const formatDate = (dateString: string | null | undefined): string => {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleDateString();
};

const formatDateTime = (dateString: string | null | undefined): string => {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleString();
};

export const EvidenceDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const tenantId = user?.tenantId || '';

  const [evidence, setEvidence] = useState<EvidenceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [tabValue, setTabValue] = useState(0);

  const [linkedControls, setLinkedControls] = useState<LinkedControl[]>([]);
  const [linkedTestResults, setLinkedTestResults] = useState<LinkedTestResult[]>([]);
  const [linkedIssues, setLinkedIssues] = useState<LinkedIssue[]>([]);
  const [linksLoading, setLinksLoading] = useState(false);

  const [availableControls, setAvailableControls] = useState<AvailableControl[]>([]);
  const [availableTestResults, setAvailableTestResults] = useState<AvailableTestResult[]>([]);
  const [availableIssues, setAvailableIssues] = useState<AvailableIssue[]>([]);

  const [linkControlDialogOpen, setLinkControlDialogOpen] = useState(false);
  const [linkTestResultDialogOpen, setLinkTestResultDialogOpen] = useState(false);
  const [linkIssueDialogOpen, setLinkIssueDialogOpen] = useState(false);
  const [selectedControlId, setSelectedControlId] = useState('');
  const [selectedTestResultId, setSelectedTestResultId] = useState('');
  const [selectedIssueId, setSelectedIssueId] = useState('');
  const [linking, setLinking] = useState(false);

  const [statusHistory, setStatusHistory] = useState<StatusHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const fetchEvidence = useCallback(async () => {
    if (!id || !tenantId) return;

    setLoading(true);
    setError(null);

    try {
      const response = await evidenceApi.get(tenantId, id);
      const data = unwrapResponse<EvidenceData>(response);
      setEvidence(data);
    } catch (err) {
      console.error('Error fetching evidence:', err);
      setError('Failed to load evidence details. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [id, tenantId]);

  const fetchLinkedEntities = useCallback(async () => {
    if (!id || !tenantId) return;

    setLinksLoading(true);
    try {
      const [controlsRes, testResultsRes, issuesRes] = await Promise.all([
        evidenceApi.getControls(tenantId, id),
        evidenceApi.getTestResults(tenantId, id),
        evidenceApi.getIssues(tenantId, id),
      ]);
      setLinkedControls(unwrapResponse<LinkedControl[]>(controlsRes) || []);
      setLinkedTestResults(unwrapResponse<LinkedTestResult[]>(testResultsRes) || []);
      setLinkedIssues(unwrapResponse<LinkedIssue[]>(issuesRes) || []);
    } catch (err) {
      console.error('Error fetching linked entities:', err);
    } finally {
      setLinksLoading(false);
    }
  }, [id, tenantId]);

  const fetchAvailableEntities = useCallback(async () => {
    if (!tenantId) return;

    try {
      const [controlsRes, testResultsRes, issuesRes] = await Promise.all([
        controlApi.list(tenantId, { pageSize: 100 }),
        testResultApi.list(tenantId, { pageSize: 100 }),
        issueApi.list(tenantId, { pageSize: 100 }),
      ]);
      setAvailableControls(unwrapPaginatedResponse<AvailableControl>(controlsRes).items || []);
      setAvailableTestResults(unwrapPaginatedResponse<AvailableTestResult>(testResultsRes).items || []);
      setAvailableIssues(unwrapPaginatedResponse<AvailableIssue>(issuesRes).items || []);
    } catch (err) {
      console.error('Error fetching available entities:', err);
    }
  }, [tenantId]);

  const fetchStatusHistory = useCallback(async () => {
    if (!id || !tenantId) return;

    setHistoryLoading(true);
    try {
      const response = await statusHistoryApi.getByEntity(tenantId, 'evidence', id);
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
    fetchEvidence();
  }, [fetchEvidence]);

  useEffect(() => {
    if (tabValue === 1) {
      fetchLinkedEntities();
      fetchAvailableEntities();
    } else if (tabValue === 2) {
      fetchStatusHistory();
    }
  }, [tabValue, fetchLinkedEntities, fetchAvailableEntities, fetchStatusHistory]);

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleLinkControl = async () => {
    if (!id || !tenantId || !selectedControlId) return;

    setLinking(true);
    try {
      await evidenceApi.linkControl(tenantId, id, selectedControlId);
      setSuccess('Control linked successfully');
      setLinkControlDialogOpen(false);
      setSelectedControlId('');
      await fetchLinkedEntities();
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
      await evidenceApi.unlinkControl(tenantId, id, controlId);
      setSuccess('Control unlinked successfully');
      await fetchLinkedEntities();
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
      await evidenceApi.linkTestResult(tenantId, id, selectedTestResultId);
      setSuccess('Test result linked successfully');
      setLinkTestResultDialogOpen(false);
      setSelectedTestResultId('');
      await fetchLinkedEntities();
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
      await evidenceApi.unlinkTestResult(tenantId, id, testResultId);
      setSuccess('Test result unlinked successfully');
      await fetchLinkedEntities();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      setError(error.response?.data?.message || 'Failed to unlink test result');
    }
  };

  const handleLinkIssue = async () => {
    if (!id || !tenantId || !selectedIssueId) return;

    setLinking(true);
    try {
      await evidenceApi.linkIssue(tenantId, id, selectedIssueId);
      setSuccess('Issue linked successfully');
      setLinkIssueDialogOpen(false);
      setSelectedIssueId('');
      await fetchLinkedEntities();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      setError(error.response?.data?.message || 'Failed to link issue');
    } finally {
      setLinking(false);
    }
  };

  const handleUnlinkIssue = async (issueId: string) => {
    if (!id || !tenantId) return;
    if (!window.confirm('Are you sure you want to unlink this issue?')) return;

    try {
      await evidenceApi.unlinkIssue(tenantId, id, issueId);
      setSuccess('Issue unlinked successfully');
      await fetchLinkedEntities();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      setError(error.response?.data?.message || 'Failed to unlink issue');
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

  const getAvailableIssuesForLinking = () => {
    const linkedIds = new Set(linkedIssues.map(li => li.issueId));
    return availableIssues.filter(i => !linkedIds.has(i.id));
  };

  if (loading) {
    return <LoadingState message="Loading evidence details..." />;
  }

  if (error && !evidence) {
    return <ErrorState message={error} onRetry={fetchEvidence} />;
  }

  if (!evidence) {
    return <ErrorState message="Evidence not found" />;
  }

    return (
      <Box sx={{ p: 3 }} data-testid="evidence-detail-page">
        <Box display="flex" alignItems="center" gap={2} mb={3}>
          <IconButton onClick={() => navigate('/evidence')} data-testid="back-button">
          <BackIcon />
        </IconButton>
        <Box flex={1}>
          <Typography variant="h4" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <EvidenceIcon /> {evidence.name}
          </Typography>
          <Typography variant="subtitle1" color="text.secondary">
            Evidence ID: {evidence.id}
          </Typography>
        </Box>
        <Chip
          label={formatStatus(evidence.type)}
          color={getTypeColor(evidence.type)}
          data-testid="evidence-type-chip"
        />
        <Chip
          label={formatStatus(evidence.status)}
          color={getStatusColor(evidence.status)}
          data-testid="evidence-status-chip"
        />
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>{success}</Alert>}

      <Paper sx={{ width: '100%' }}>
                <Tabs value={tabValue} onChange={handleTabChange} aria-label="evidence detail tabs">
                  <Tab icon={<InfoIcon />} label="Overview" iconPosition="start" data-testid="overview-tab" />
                  <Tab icon={<LinkIcon />} label="Links" iconPosition="start" data-testid="links-tab" />
                  <Tab icon={<AttachmentIcon />} label="Attachments" iconPosition="start" data-testid="attachments-tab" />
                  <Tab icon={<HistoryIcon />} label="History" iconPosition="start" data-testid="history-tab" />
                </Tabs>

        <TabPanel value={tabValue} index={0}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>Basic Information</Typography>
                  <Divider sx={{ mb: 2 }} />
                  <Grid container spacing={2}>
                    <Grid item xs={4}><Typography color="text.secondary">Name</Typography></Grid>
                    <Grid item xs={8}><Typography>{evidence.name}</Typography></Grid>
                    <Grid item xs={4}><Typography color="text.secondary">Type</Typography></Grid>
                    <Grid item xs={8}><Chip label={formatStatus(evidence.type)} size="small" color={getTypeColor(evidence.type)} /></Grid>
                    <Grid item xs={4}><Typography color="text.secondary">Source Type</Typography></Grid>
                    <Grid item xs={8}><Typography>{formatStatus(evidence.sourceType || 'manual')}</Typography></Grid>
                    <Grid item xs={4}><Typography color="text.secondary">Status</Typography></Grid>
                    <Grid item xs={8}><Chip label={formatStatus(evidence.status)} size="small" color={getStatusColor(evidence.status)} /></Grid>
                                <Grid item xs={4}><Typography color="text.secondary">Collected At</Typography></Grid>
                                <Grid item xs={8}><Typography>{formatDate(evidence.collectedAt)}</Typography></Grid>
                                <Grid item xs={4}><Typography color="text.secondary">Due Date</Typography></Grid>
                                <Grid item xs={8}><Typography>{formatDate(evidence.dueDate)}</Typography></Grid>
                              </Grid>
                            </CardContent>
                          </Card>
                        </Grid>
                        <Grid item xs={12} md={6}>
                          <Card>
                            <CardContent>
                              <Typography variant="h6" gutterBottom>Location & Audit</Typography>
                  <Divider sx={{ mb: 2 }} />
                  <Grid container spacing={2}>
                    <Grid item xs={4}><Typography color="text.secondary">Location</Typography></Grid>
                    <Grid item xs={8}><Typography>{evidence.location || '-'}</Typography></Grid>
                    <Grid item xs={4}><Typography color="text.secondary">External URL</Typography></Grid>
                    <Grid item xs={8}>
                      {evidence.externalUrl ? (
                        <Typography
                          component="a"
                          href={evidence.externalUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          sx={{ color: 'primary.main' }}
                        >
                          {evidence.externalUrl}
                        </Typography>
                      ) : (
                        <Typography>-</Typography>
                      )}
                    </Grid>
                    <Grid item xs={4}><Typography color="text.secondary">Created</Typography></Grid>
                    <Grid item xs={8}><Typography>{formatDateTime(evidence.createdAt)}</Typography></Grid>
                    <Grid item xs={4}><Typography color="text.secondary">Updated</Typography></Grid>
                    <Grid item xs={8}><Typography>{formatDateTime(evidence.updatedAt)}</Typography></Grid>
                  </Grid>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>Description</Typography>
                  <Divider sx={{ mb: 2 }} />
                  <Typography>{evidence.description || 'No description provided.'}</Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </TabPanel>

        <TabPanel value={tabValue} index={1} data-testid="evidence-panel-links">
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

              <Grid item xs={12}>
                <Card>
                  <CardContent>
                    <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                      <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <IssueIcon /> Linked Issues ({linkedIssues.length})
                      </Typography>
                      <Button
                        variant="outlined"
                        startIcon={<AddIcon />}
                        onClick={() => setLinkIssueDialogOpen(true)}
                        disabled={getAvailableIssuesForLinking().length === 0}
                        data-testid="link-issue-button"
                      >
                        Link Issue
                      </Button>
                    </Box>
                    <Divider sx={{ mb: 2 }} />
                    {linkedIssues.length === 0 ? (
                      <Typography color="text.secondary">No issues linked.</Typography>
                    ) : (
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>Title</TableCell>
                            <TableCell>Status</TableCell>
                            <TableCell>Severity</TableCell>
                            <TableCell>Linked At</TableCell>
                            <TableCell>Actions</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {linkedIssues.map((link) => (
                            <TableRow key={link.id}>
                              <TableCell>
                                <Link to={`/issues/${link.issue.id}`} style={{ textDecoration: 'none' }}>
                                  <Typography color="primary">{link.issue.title}</Typography>
                                </Link>
                              </TableCell>
                              <TableCell><Chip label={formatStatus(link.issue.status)} size="small" /></TableCell>
                              <TableCell><Chip label={formatStatus(link.issue.severity)} size="small" /></TableCell>
                              <TableCell>{formatDate(link.createdAt)}</TableCell>
                              <TableCell>
                                <Tooltip title="Unlink">
                                  <IconButton
                                    size="small"
                                    onClick={() => handleUnlinkIssue(link.issueId)}
                                    color="error"
                                    data-testid={`unlink-issue-${link.issueId}`}
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
            </Grid>
          )}
        </TabPanel>

        <TabPanel value={tabValue} index={2} data-testid="evidence-panel-attachments">
          {id && (
            <AttachmentPanel
              refTable="grc_evidence"
              refId={id}
              readOnly={false}
            />
          )}
        </TabPanel>

        <TabPanel value={tabValue} index={3}>
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

      <Dialog open={linkIssueDialogOpen} onClose={() => setLinkIssueDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Link Issue</DialogTitle>
        <DialogContent>
          <Box mt={1}>
            <FormControl fullWidth>
              <InputLabel>Select Issue</InputLabel>
              <Select
                value={selectedIssueId}
                label="Select Issue"
                onChange={(e) => setSelectedIssueId(e.target.value)}
                data-testid="select-issue-dropdown"
              >
                {getAvailableIssuesForLinking().map((issue) => (
                  <MenuItem key={issue.id} value={issue.id}>
                    {issue.title} ({formatStatus(issue.status)})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLinkIssueDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleLinkIssue}
            variant="contained"
            disabled={!selectedIssueId || linking}
            data-testid="confirm-link-issue-button"
          >
            {linking ? 'Linking...' : 'Link'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default EvidenceDetail;
