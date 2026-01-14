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
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
} from '@mui/material';
import {
  FactCheck as TestResultIcon,
  ArrowBack as BackIcon,
  History as HistoryIcon,
  Link as LinkIcon,
  Info as InfoIcon,
  Security as ControlIcon,
  Description as EvidenceIcon,
  Warning as IssueIcon,
} from '@mui/icons-material';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  testResultApi,
  TestResultData,
  issueApi,
  CreateIssueDto,
  statusHistoryApi,
  unwrapResponse,
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
      id={`test-result-tabpanel-${index}`}
      aria-labelledby={`test-result-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  );
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

interface ControlTestInfo {
  id: string;
  name: string;
  controlId: string;
  control?: {
    id: string;
    name: string;
    code?: string;
  };
}

const getResultColor = (result: string): 'error' | 'warning' | 'info' | 'success' | 'default' => {
  switch (result?.toUpperCase()) {
    case 'PASS': return 'success';
    case 'FAIL': return 'error';
    case 'INCONCLUSIVE': return 'warning';
    case 'NOT_APPLICABLE': return 'default';
    default: return 'default';
  }
};

const getEffectivenessColor = (rating: string): 'error' | 'warning' | 'info' | 'success' | 'default' => {
  switch (rating?.toUpperCase()) {
    case 'EFFECTIVE': return 'success';
    case 'PARTIALLY_EFFECTIVE': return 'warning';
    case 'INEFFECTIVE': return 'error';
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

const mapResultToSeverity = (result: string): string => {
  switch (result?.toUpperCase()) {
    case 'FAIL': return 'high';
    case 'INCONCLUSIVE': return 'medium';
    default: return 'low';
  }
};

export const TestResultDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const tenantId = user?.tenantId || '';

  const [testResult, setTestResult] = useState<TestResultData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [tabValue, setTabValue] = useState(0);

  const [linkedEvidence] = useState<LinkedEvidence[]>([]);
  const [controlTest, setControlTest] = useState<ControlTestInfo | null>(null);
  const [linksLoading] = useState(false);

  const [statusHistory, setStatusHistory] = useState<StatusHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [createIssueDialogOpen, setCreateIssueDialogOpen] = useState(false);
  const [newIssue, setNewIssue] = useState<CreateIssueDto>({
    title: '',
    description: '',
    type: 'internal_audit',
    status: 'open',
    severity: 'high',
  });
  const [creatingIssue, setCreatingIssue] = useState(false);

  const fetchTestResult = useCallback(async () => {
    if (!id || !tenantId) return;

    setLoading(true);
    setError(null);

    try {
      const response = await testResultApi.get(tenantId, id);
      const data = unwrapResponse<TestResultData>(response);
      setTestResult(data);
      
      if (data.controlTest) {
        setControlTest(data.controlTest as ControlTestInfo);
      }
    } catch (err) {
      console.error('Error fetching test result:', err);
      setError('Failed to load test result details. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [id, tenantId]);

  const fetchStatusHistory = useCallback(async () => {
    if (!id || !tenantId) return;

    setHistoryLoading(true);
    try {
      const response = await statusHistoryApi.getByEntity(tenantId, 'test_result', id);
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
    fetchTestResult();
  }, [fetchTestResult]);

  useEffect(() => {
    if (tabValue === 2) {
      fetchStatusHistory();
    }
  }, [tabValue, fetchStatusHistory]);

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleOpenCreateIssueDialog = () => {
    if (!testResult) return;
    
    const controlName = controlTest?.control?.name || controlTest?.control?.code || 'Unknown Control';
    setNewIssue({
      title: `Failed Test Result: ${testResult.name}`,
      description: `Issue created from failed test result.\n\nTest Result: ${testResult.name}\nControl: ${controlName}\nResult: ${testResult.result}\nTested At: ${formatDate(testResult.testedAt)}\n\nNotes: ${testResult.notes || 'N/A'}`,
      type: 'internal_audit',
      status: 'open',
      severity: mapResultToSeverity(testResult.result),
      controlId: controlTest?.control?.id,
      testResultId: testResult.id,
    });
    setCreateIssueDialogOpen(true);
  };

  const handleCreateIssue = async () => {
    if (!tenantId) return;

    setCreatingIssue(true);
    try {
      const response = await issueApi.create(tenantId, newIssue);
      const createdIssue = unwrapResponse<{ id: string }>(response);
      setSuccess('Issue created successfully');
      setCreateIssueDialogOpen(false);
      setTimeout(() => {
        setSuccess(null);
        navigate(`/issues/${createdIssue.id}`);
      }, 1500);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      setError(error.response?.data?.message || 'Failed to create issue');
    } finally {
      setCreatingIssue(false);
    }
  };

  if (loading) {
    return <LoadingState message="Loading test result details..." />;
  }

  if (error && !testResult) {
    return <ErrorState message={error} onRetry={fetchTestResult} />;
  }

  if (!testResult) {
    return <ErrorState message="Test result not found" />;
  }

  const isFailed = testResult.result?.toUpperCase() === 'FAIL';

    return (
      <Box sx={{ p: 3 }} data-testid="test-result-detail-page">
        <Box display="flex" alignItems="center" gap={2} mb={3}>
          <IconButton onClick={() => navigate('/test-results')} data-testid="back-button">
          <BackIcon />
        </IconButton>
        <Box flex={1}>
          <Typography variant="h4" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <TestResultIcon /> {testResult.name}
          </Typography>
          <Typography variant="subtitle1" color="text.secondary">
            Test Result ID: {testResult.id}
          </Typography>
        </Box>
        <Chip
          label={formatStatus(testResult.result)}
          color={getResultColor(testResult.result)}
          data-testid="test-result-chip"
        />
        {testResult.effectivenessRating && (
          <Chip
            label={formatStatus(testResult.effectivenessRating)}
            color={getEffectivenessColor(testResult.effectivenessRating)}
            data-testid="effectiveness-chip"
          />
        )}
        {isFailed && (
          <Button
            variant="contained"
            color="warning"
            startIcon={<IssueIcon />}
            onClick={handleOpenCreateIssueDialog}
            data-testid="create-issue-button"
          >
            Create Issue
          </Button>
        )}
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>{success}</Alert>}

      <Paper sx={{ width: '100%' }}>
        <Tabs value={tabValue} onChange={handleTabChange} aria-label="test result detail tabs">
          <Tab icon={<InfoIcon />} label="Overview" iconPosition="start" data-testid="overview-tab" />
          <Tab icon={<LinkIcon />} label="Links" iconPosition="start" data-testid="links-tab" />
          <Tab icon={<HistoryIcon />} label="History" iconPosition="start" data-testid="history-tab" />
        </Tabs>

        <TabPanel value={tabValue} index={0}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>Test Information</Typography>
                  <Divider sx={{ mb: 2 }} />
                  <Grid container spacing={2}>
                    <Grid item xs={4}><Typography color="text.secondary">Name</Typography></Grid>
                    <Grid item xs={8}><Typography>{testResult.name}</Typography></Grid>
                    <Grid item xs={4}><Typography color="text.secondary">Result</Typography></Grid>
                    <Grid item xs={8}>
                      <Chip label={formatStatus(testResult.result)} size="small" color={getResultColor(testResult.result)} />
                    </Grid>
                    <Grid item xs={4}><Typography color="text.secondary">Effectiveness</Typography></Grid>
                    <Grid item xs={8}>
                      {testResult.effectivenessRating ? (
                        <Chip label={formatStatus(testResult.effectivenessRating)} size="small" color={getEffectivenessColor(testResult.effectivenessRating)} />
                      ) : (
                        <Typography>-</Typography>
                      )}
                    </Grid>
                    <Grid item xs={4}><Typography color="text.secondary">Tested At</Typography></Grid>
                    <Grid item xs={8}><Typography>{formatDate(testResult.testedAt)}</Typography></Grid>
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
                    <Grid item xs={8}><Typography>{formatDateTime(testResult.createdAt)}</Typography></Grid>
                    <Grid item xs={4}><Typography color="text.secondary">Updated</Typography></Grid>
                    <Grid item xs={8}><Typography>{formatDateTime(testResult.updatedAt)}</Typography></Grid>
                  </Grid>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>Description</Typography>
                  <Divider sx={{ mb: 2 }} />
                  <Typography>{testResult.description || 'No description provided.'}</Typography>
                </CardContent>
              </Card>
            </Grid>
            {testResult.notes && (
              <Grid item xs={12}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>Notes</Typography>
                    <Divider sx={{ mb: 2 }} />
                    <Typography sx={{ whiteSpace: 'pre-wrap' }}>{testResult.notes}</Typography>
                  </CardContent>
                </Card>
              </Grid>
            )}
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
                    <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }} gutterBottom>
                      <ControlIcon /> Linked Control
                    </Typography>
                    <Divider sx={{ mb: 2 }} />
                    {controlTest?.control ? (
                      <Grid container spacing={2}>
                        <Grid item xs={2}><Typography color="text.secondary">Code</Typography></Grid>
                        <Grid item xs={10}>
                          <Link to={`/controls/${controlTest.control.id}`} style={{ textDecoration: 'none' }}>
                            <Typography color="primary">{controlTest.control.code || '-'}</Typography>
                          </Link>
                        </Grid>
                        <Grid item xs={2}><Typography color="text.secondary">Name</Typography></Grid>
                        <Grid item xs={10}><Typography>{controlTest.control.name}</Typography></Grid>
                        {controlTest.control.code && (
                          <>
                            <Grid item xs={2}><Typography color="text.secondary">Code</Typography></Grid>
                            <Grid item xs={10}><Typography>{controlTest.control.code}</Typography></Grid>
                          </>
                        )}
                      </Grid>
                    ) : (
                      <Typography color="text.secondary">No control linked.</Typography>
                    )}
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }} gutterBottom>
                      <EvidenceIcon /> Linked Evidence ({linkedEvidence.length})
                    </Typography>
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
                          <Chip label={formatStatus(item.newStatus)} size="small" color={getResultColor(item.newStatus)} />
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

      <Dialog open={createIssueDialogOpen} onClose={() => setCreateIssueDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Create Issue from Failed Test Result</DialogTitle>
        <DialogContent>
          <Box display="flex" flexDirection="column" gap={2} mt={1}>
            <Alert severity="info">
              Creating an issue from a failed test result. The issue will be automatically linked to the test result and control.
            </Alert>
            <TextField
              label="Title"
              value={newIssue.title}
              onChange={(e) => setNewIssue({ ...newIssue, title: e.target.value })}
              fullWidth
              required
              data-testid="issue-title-input"
            />
            <TextField
              label="Description"
              value={newIssue.description}
              onChange={(e) => setNewIssue({ ...newIssue, description: e.target.value })}
              fullWidth
              multiline
              rows={4}
              data-testid="issue-description-input"
            />
            <FormControl fullWidth>
              <InputLabel>Type</InputLabel>
              <Select
                value={newIssue.type}
                label="Type"
                onChange={(e) => setNewIssue({ ...newIssue, type: e.target.value })}
                data-testid="issue-type-select"
              >
                <MenuItem value="internal_audit">Internal Audit</MenuItem>
                <MenuItem value="external_audit">External Audit</MenuItem>
                <MenuItem value="incident">Incident</MenuItem>
                <MenuItem value="self_assessment">Self Assessment</MenuItem>
                <MenuItem value="other">Other</MenuItem>
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel>Severity</InputLabel>
              <Select
                value={newIssue.severity}
                label="Severity"
                onChange={(e) => setNewIssue({ ...newIssue, severity: e.target.value })}
                data-testid="issue-severity-select"
              >
                <MenuItem value="critical">Critical</MenuItem>
                <MenuItem value="high">High</MenuItem>
                <MenuItem value="medium">Medium</MenuItem>
                <MenuItem value="low">Low</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateIssueDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleCreateIssue}
            variant="contained"
            disabled={!newIssue.title || creatingIssue}
            data-testid="confirm-create-issue-button"
          >
            {creatingIssue ? 'Creating...' : 'Create Issue'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default TestResultDetail;
