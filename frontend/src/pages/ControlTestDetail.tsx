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
  IconButton,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  CircularProgress,
} from '@mui/material';
import {
  Science as TestIcon,
  ArrowBack as BackIcon,
  History as HistoryIcon,
  Info as InfoIcon,
  Security as ControlIcon,
  FactCheck as ResultIcon,
} from '@mui/icons-material';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  controlTestApi,
  ControlTestData,
  TestResultData,
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
      id={`control-test-tabpanel-${index}`}
      aria-labelledby={`control-test-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  );
}

const getStatusColor = (status: string): 'error' | 'warning' | 'info' | 'success' | 'default' => {
  switch (status?.toUpperCase()) {
    case 'PLANNED': return 'info';
    case 'IN_PROGRESS': return 'warning';
    case 'COMPLETED': return 'success';
    case 'CANCELLED': return 'default';
    default: return 'default';
  }
};

const getTestTypeColor = (testType: string): 'error' | 'warning' | 'info' | 'success' | 'default' => {
  switch (testType?.toUpperCase()) {
    case 'DESIGN': return 'info';
    case 'OPERATING_EFFECTIVENESS': return 'success';
    case 'BOTH': return 'warning';
    default: return 'default';
  }
};

const getResultColor = (result: string): 'error' | 'warning' | 'info' | 'success' | 'default' => {
  switch (result?.toUpperCase()) {
    case 'PASS': return 'success';
    case 'FAIL': return 'error';
    case 'PARTIAL': return 'warning';
    case 'NOT_TESTED': return 'default';
    default: return 'default';
  }
};

const formatStatus = (status: string): string => {
  if (!status) return '-';
  return status.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
};

const formatTestType = (testType: string): string => {
  if (!testType) return '-';
  if (testType.toUpperCase() === 'OPERATING_EFFECTIVENESS') return 'Operating Effectiveness';
  return testType.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
};

const formatDate = (dateString: string | null | undefined): string => {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleDateString();
};

const formatDateTime = (dateString: string | null | undefined): string => {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleString();
};

export const ControlTestDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const tenantId = user?.tenantId || '';

  const [controlTest, setControlTest] = useState<ControlTestData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tabValue, setTabValue] = useState(0);

  const [testResults, setTestResults] = useState<TestResultData[]>([]);
  const [resultsLoading, setResultsLoading] = useState(false);

  const [statusHistory, setStatusHistory] = useState<StatusHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const fetchControlTest = useCallback(async () => {
    if (!id || !tenantId) return;

    setLoading(true);
    setError(null);

    try {
      const response = await controlTestApi.get(tenantId, id);
      const data = unwrapResponse<ControlTestData>(response);
      setControlTest(data);
    } catch (err) {
      console.error('Error fetching control test:', err);
      setError('Failed to load control test details. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [id, tenantId]);

  const fetchTestResults = useCallback(async () => {
    if (!id || !tenantId) return;

    setResultsLoading(true);
    try {
      const response = await controlTestApi.listResults(tenantId, id, { pageSize: 100 });
      const data = unwrapResponse<{ items: TestResultData[] }>(response);
      setTestResults(data?.items || []);
    } catch (err) {
      console.error('Error fetching test results:', err);
      setTestResults([]);
    } finally {
      setResultsLoading(false);
    }
  }, [id, tenantId]);

  const fetchStatusHistory = useCallback(async () => {
    if (!id || !tenantId) return;

    setHistoryLoading(true);
    try {
      const response = await statusHistoryApi.getByEntity(tenantId, 'control_test', id);
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
    fetchControlTest();
  }, [fetchControlTest]);

  useEffect(() => {
    if (tabValue === 1) {
      fetchTestResults();
    } else if (tabValue === 2) {
      fetchStatusHistory();
    }
  }, [tabValue, fetchTestResults, fetchStatusHistory]);

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  if (loading) {
    return <LoadingState message="Loading control test details..." />;
  }

  if (error && !controlTest) {
    return <ErrorState message={error} onRetry={fetchControlTest} />;
  }

  if (!controlTest) {
    return <ErrorState message="Control test not found" />;
  }

  return (
    <Box sx={{ p: 3 }} data-testid="control-test-detail-page">
      <Box display="flex" alignItems="center" gap={2} mb={3}>
        <IconButton onClick={() => navigate('/control-tests')} data-testid="back-button">
          <BackIcon />
        </IconButton>
        <Box flex={1}>
          <Typography variant="h4" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <TestIcon /> {controlTest.name}
          </Typography>
          <Typography variant="subtitle1" color="text.secondary">
            Control Test ID: {controlTest.id}
          </Typography>
        </Box>
        <Chip
          label={formatStatus(controlTest.status)}
          color={getStatusColor(controlTest.status)}
          data-testid="status-chip"
        />
        {controlTest.testType && (
          <Chip
            label={formatTestType(controlTest.testType)}
            color={getTestTypeColor(controlTest.testType)}
            data-testid="test-type-chip"
          />
        )}
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      <Paper sx={{ width: '100%' }}>
        <Tabs value={tabValue} onChange={handleTabChange} aria-label="control test detail tabs">
          <Tab icon={<InfoIcon />} label="Overview" iconPosition="start" data-testid="overview-tab" />
          <Tab icon={<ResultIcon />} label="Results" iconPosition="start" data-testid="results-tab" />
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
                    <Grid item xs={8}><Typography>{controlTest.name}</Typography></Grid>
                    <Grid item xs={4}><Typography color="text.secondary">Status</Typography></Grid>
                    <Grid item xs={8}>
                      <Chip label={formatStatus(controlTest.status)} size="small" color={getStatusColor(controlTest.status)} />
                    </Grid>
                    <Grid item xs={4}><Typography color="text.secondary">Test Type</Typography></Grid>
                    <Grid item xs={8}>
                      {controlTest.testType ? (
                        <Chip label={formatTestType(controlTest.testType)} size="small" color={getTestTypeColor(controlTest.testType)} />
                      ) : (
                        <Typography>-</Typography>
                      )}
                    </Grid>
                    <Grid item xs={4}><Typography color="text.secondary">Scheduled Date</Typography></Grid>
                    <Grid item xs={8}><Typography>{formatDate(controlTest.scheduledDate)}</Typography></Grid>
                    <Grid item xs={4}><Typography color="text.secondary">Started At</Typography></Grid>
                    <Grid item xs={8}><Typography>{formatDateTime(controlTest.startedAt)}</Typography></Grid>
                    <Grid item xs={4}><Typography color="text.secondary">Completed At</Typography></Grid>
                    <Grid item xs={8}><Typography>{formatDateTime(controlTest.completedAt)}</Typography></Grid>
                  </Grid>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>Sampling Information</Typography>
                  <Divider sx={{ mb: 2 }} />
                  <Grid container spacing={2}>
                    <Grid item xs={4}><Typography color="text.secondary">Sample Size</Typography></Grid>
                    <Grid item xs={8}><Typography>{controlTest.sampleSize ?? '-'}</Typography></Grid>
                    <Grid item xs={4}><Typography color="text.secondary">Population Size</Typography></Grid>
                    <Grid item xs={8}><Typography>{controlTest.populationSize ?? '-'}</Typography></Grid>
                    <Grid item xs={4}><Typography color="text.secondary">Created</Typography></Grid>
                    <Grid item xs={8}><Typography>{formatDateTime(controlTest.createdAt)}</Typography></Grid>
                    <Grid item xs={4}><Typography color="text.secondary">Updated</Typography></Grid>
                    <Grid item xs={8}><Typography>{formatDateTime(controlTest.updatedAt)}</Typography></Grid>
                  </Grid>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }} gutterBottom>
                    <ControlIcon /> Linked Control
                  </Typography>
                  <Divider sx={{ mb: 2 }} />
                  {controlTest.control ? (
                    <Grid container spacing={2}>
                      <Grid item xs={2}><Typography color="text.secondary">Code</Typography></Grid>
                      <Grid item xs={10}>
                        <Link to={`/controls/${controlTest.control.id}`} style={{ textDecoration: 'none' }}>
                          <Typography color="primary">{controlTest.control.code || '-'}</Typography>
                        </Link>
                      </Grid>
                      <Grid item xs={2}><Typography color="text.secondary">Name</Typography></Grid>
                      <Grid item xs={10}><Typography>{controlTest.control.name}</Typography></Grid>
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
                  <Typography variant="h6" gutterBottom>Description</Typography>
                  <Divider sx={{ mb: 2 }} />
                  <Typography>{controlTest.description || 'No description provided.'}</Typography>
                </CardContent>
              </Card>
            </Grid>
            {controlTest.testProcedure && (
              <Grid item xs={12}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>Test Procedure</Typography>
                    <Divider sx={{ mb: 2 }} />
                    <Typography sx={{ whiteSpace: 'pre-wrap' }}>{controlTest.testProcedure}</Typography>
                  </CardContent>
                </Card>
              </Grid>
            )}
          </Grid>
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          {resultsLoading ? (
            <Box display="flex" justifyContent="center" p={3}>
              <CircularProgress />
            </Box>
          ) : (
            <Card>
              <CardContent>
                <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }} gutterBottom>
                  <ResultIcon /> Test Results ({testResults.length})
                </Typography>
                <Divider sx={{ mb: 2 }} />
                {testResults.length === 0 ? (
                  <Typography color="text.secondary">No test results found for this control test.</Typography>
                ) : (
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Name</TableCell>
                        <TableCell>Result</TableCell>
                        <TableCell>Tested Date</TableCell>
                        <TableCell>Created</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {testResults.map((result) => (
                        <TableRow key={result.id}>
                          <TableCell>
                            <Link to={`/test-results/${result.id}`} style={{ textDecoration: 'none' }}>
                              <Typography color="primary">{result.name}</Typography>
                            </Link>
                          </TableCell>
                          <TableCell>
                            <Chip label={formatStatus(result.result)} size="small" color={getResultColor(result.result)} />
                          </TableCell>
                          <TableCell>{formatDate(result.testedAt || result.testDate)}</TableCell>
                          <TableCell>{formatDate(result.createdAt)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
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
    </Box>
  );
};

export default ControlTestDetail;
