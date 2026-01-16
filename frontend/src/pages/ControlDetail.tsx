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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Button,
  IconButton,
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
  Divider,
} from '@mui/material';
import {
  Security as ControlIcon,
  ArrowBack as BackIcon,
  Link as LinkIcon,
  LinkOff as UnlinkIcon,
  History as HistoryIcon,
  Description as EvidenceIcon,
  CheckCircle as TestIcon,
  Warning as IssueIcon,
  AccountTree as ProcessIcon,
  Info as InfoIcon,
  Add as AddIcon,
  AttachFile as AttachmentIcon,
} from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';
import {
  controlApi,
  processApi,
  statusHistoryApi,
  testResultApi,
  evidenceApi,
  unwrapResponse,
  unwrapPaginatedResponse,
  StatusHistoryItem,
  TestResultData,
  TestResultOutcome,
  TestMethod,
  TestResultStatus,
  EvidenceData,
  CreateTestResultDto,
  API_PATHS,
} from '../services/grcClient';
import apiClient from '../services/apiClient';
import { useAuth } from '../contexts/AuthContext';
import { LoadingState, ErrorState, AttachmentPanel } from '../components/common';

// Control enums matching backend
export enum ControlType {
  PREVENTIVE = 'preventive',
  DETECTIVE = 'detective',
  CORRECTIVE = 'corrective',
}

export enum ControlImplementationType {
  MANUAL = 'manual',
  AUTOMATED = 'automated',
  IT_DEPENDENT = 'it_dependent',
}

export enum ControlStatus {
  DRAFT = 'draft',
  IN_DESIGN = 'in_design',
  IMPLEMENTED = 'implemented',
  INOPERATIVE = 'inoperative',
  RETIRED = 'retired',
}

export enum ControlFrequency {
  CONTINUOUS = 'continuous',
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  QUARTERLY = 'quarterly',
  ANNUAL = 'annual',
}

// Interfaces
interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
}

interface Process {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
}

interface LinkedProcess {
  id: string;
  processId: string;
  process: Process;
  createdAt: string;
}

interface ControlTest {
  id: string;
  testType: string;
  status: string;
  scheduledDate: string | null;
  completedDate: string | null;
  result: string | null;
  notes: string | null;
}

interface ControlEvidence {
  id: string;
  evidenceType: string;
  title: string;
  description: string | null;
  filePath: string | null;
  collectedAt: string;
}

interface Issue {
  id: string;
  title: string;
  type: string;
  status: string;
  severity: string;
  createdAt: string;
}

interface RequirementControl {
  id: string;
  requirement: {
    id: string;
    title: string;
    referenceCode: string;
    status: string;
  };
}

interface Control {
  id: string;
  tenantId: string;
  name: string;
  code: string | null;
  description: string | null;
  type: ControlType;
  implementationType: ControlImplementationType;
  status: ControlStatus;
  frequency: ControlFrequency | null;
  testFrequency: ControlFrequency | null;
  ownerUserId: string | null;
  owner: User | null;
  effectiveDate: string | null;
  lastTestedDate: string | null;
  nextTestDate: string | null;
  lastTestResult: string | null;
  evidenceRequirements: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  isDeleted: boolean;
  controlTests: ControlTest[];
  controlEvidence: ControlEvidence[];
  issues: Issue[];
  controlProcesses: LinkedProcess[];
  requirementControls: RequirementControl[];
}

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
      id={`control-tabpanel-${index}`}
      aria-labelledby={`control-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  );
}

export const ControlDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const tenantId = user?.tenantId || '';

  const [control, setControl] = useState<Control | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [tabValue, setTabValue] = useState(0);

  // Process linking state
  const [linkedProcesses, setLinkedProcesses] = useState<LinkedProcess[]>([]);
  const [allProcesses, setAllProcesses] = useState<Process[]>([]);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [selectedProcessId, setSelectedProcessId] = useState('');
  const [linkingProcess, setLinkingProcess] = useState(false);

  // Status history state
  const [statusHistory, setStatusHistory] = useState<StatusHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Test Results state (Test/Result Sprint)
  const [testResults, setTestResults] = useState<TestResultData[]>([]);
  const [testResultsLoading, setTestResultsLoading] = useState(false);
  const [testResultDialogOpen, setTestResultDialogOpen] = useState(false);
  const [creatingTestResult, setCreatingTestResult] = useState(false);
  const [availableEvidences, setAvailableEvidences] = useState<EvidenceData[]>([]);
  const [newTestResult, setNewTestResult] = useState<CreateTestResultDto>({
    controlId: id || '',
    result: 'NOT_TESTED' as TestResultOutcome,
    testDate: new Date().toISOString().split('T')[0],
    method: 'OTHER' as TestMethod,
    status: 'DRAFT' as TestResultStatus,
    summary: '',
  });
  const [selectedEvidenceIds, setSelectedEvidenceIds] = useState<string[]>([]);

  // Issue/Finding Sprint - Create Issue from Test Result state
  const [creatingIssueFromTestResult, setCreatingIssueFromTestResult] = useState<string | null>(null);

  const fetchControl = useCallback(async () => {
    if (!id || !tenantId) return;

    setLoading(true);
    setError(null);

    try {
      const response = await controlApi.get(tenantId, id);
      const data = unwrapResponse<Control>(response);
      setControl(data);
      setLinkedProcesses(data.controlProcesses || []);
    } catch (err) {
      console.error('Error fetching control:', err);
      setError('Failed to load control details. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [id, tenantId]);

  const fetchAllProcesses = useCallback(async () => {
    if (!tenantId) return;

    try {
      const params = new URLSearchParams();
      params.set('pageSize', '100');
      const response = await processApi.list(tenantId, params);
      const result = unwrapPaginatedResponse<Process>(response);
      setAllProcesses(result.items);
    } catch (err) {
      console.error('Error fetching processes:', err);
    }
  }, [tenantId]);

  const fetchStatusHistory = useCallback(async () => {
    if (!id || !tenantId) return;

    setHistoryLoading(true);
    try {
      const response = await statusHistoryApi.getByEntity(tenantId, 'control', id);
      const data = unwrapResponse<StatusHistoryItem[]>(response);
      setStatusHistory(data || []);
    } catch (err) {
      console.error('Error fetching status history:', err);
      setStatusHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }, [id, tenantId]);

  // Test/Result Sprint - Fetch test results for this control
  const fetchTestResults = useCallback(async () => {
    if (!id || !tenantId) return;

    setTestResultsLoading(true);
    try {
      const response = await testResultApi.listByControl(tenantId, id, {
        sortBy: 'testDate',
        sortOrder: 'DESC',
      });
      const result = unwrapPaginatedResponse<TestResultData>(response);
      setTestResults(result.items || []);
    } catch (err) {
      console.error('Error fetching test results:', err);
      setTestResults([]);
    } finally {
      setTestResultsLoading(false);
    }
  }, [id, tenantId]);

  // Test/Result Sprint - Fetch available evidences for linking
  const fetchAvailableEvidences = useCallback(async () => {
    if (!tenantId) return;

    try {
      const response = await evidenceApi.list(tenantId, { pageSize: 100 });
      const result = unwrapPaginatedResponse<EvidenceData>(response);
      setAvailableEvidences(result.items || []);
    } catch (err) {
      console.error('Error fetching evidences:', err);
      setAvailableEvidences([]);
    }
  }, [tenantId]);

  useEffect(() => {
    fetchControl();
    fetchAllProcesses();
  }, [fetchControl, fetchAllProcesses]);

  useEffect(() => {
    if (tabValue === 4) {
      // Test Results tab (Test/Result Sprint)
      fetchTestResults();
      fetchAvailableEvidences();
    } else if (tabValue === 6) {
      // History tab (shifted by 1 due to new Test Results tab)
      fetchStatusHistory();
    }
  }, [tabValue, fetchStatusHistory, fetchTestResults, fetchAvailableEvidences]);

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleLinkProcess = async () => {
    if (!id || !tenantId || !selectedProcessId) return;

    setLinkingProcess(true);
    try {
      await controlApi.linkProcess(tenantId, id, selectedProcessId);
      setSuccess('Process linked successfully');
      setLinkDialogOpen(false);
      setSelectedProcessId('');
      await fetchControl();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      setError(error.response?.data?.message || 'Failed to link process');
    } finally {
      setLinkingProcess(false);
    }
  };

  const handleUnlinkProcess = async (processId: string) => {
    if (!id || !tenantId) return;

    if (!window.confirm('Are you sure you want to unlink this process?')) return;

    try {
      await controlApi.unlinkProcess(tenantId, id, processId);
      setSuccess('Process unlinked successfully');
      await fetchControl();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      setError(error.response?.data?.message || 'Failed to unlink process');
    }
  };

  // Test/Result Sprint - Create test result with evidence linking
  const handleCreateTestResult = async () => {
    if (!id || !tenantId) return;

    setCreatingTestResult(true);
    try {
      // Create the test result
      const response = await testResultApi.create(tenantId, {
        ...newTestResult,
        controlId: id,
      });
      const createdTestResult = unwrapResponse<TestResultData>(response);

      // Link selected evidences
      for (const evidenceId of selectedEvidenceIds) {
        try {
          await testResultApi.linkEvidence(tenantId, createdTestResult.id, evidenceId);
        } catch (linkErr) {
          console.error('Error linking evidence:', linkErr);
        }
      }

      setSuccess('Test result created successfully');
      setTestResultDialogOpen(false);
      setNewTestResult({
        controlId: id,
        result: 'NOT_TESTED' as TestResultOutcome,
        testDate: new Date().toISOString().split('T')[0],
        method: 'OTHER' as TestMethod,
        status: 'DRAFT' as TestResultStatus,
        summary: '',
      });
      setSelectedEvidenceIds([]);
      await fetchTestResults();
      await fetchControl(); // Refresh control to update lastTestResult
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      setError(error.response?.data?.message || 'Failed to create test result');
    } finally {
      setCreatingTestResult(false);
    }
  };

  const handleOpenTestResultDialog = () => {
    setNewTestResult({
      controlId: id || '',
      result: 'NOT_TESTED' as TestResultOutcome,
      testDate: new Date().toISOString().split('T')[0],
      method: 'OTHER' as TestMethod,
      status: 'DRAFT' as TestResultStatus,
      summary: '',
    });
    setSelectedEvidenceIds([]);
    setTestResultDialogOpen(true);
  };

  // Issue/Finding Sprint - Create Issue from Test Result handler
  const handleCreateIssueFromTestResult = async (testResultId: string) => {
    if (!tenantId) return;

    setCreatingIssueFromTestResult(testResultId);
    setError(null);

    try {
      const response = await apiClient.post(
        API_PATHS.GRC_TEST_RESULTS.CREATE_ISSUE(testResultId),
        {},
        { headers: { 'x-tenant-id': tenantId } }
      );

      if (response.data?.success) {
        setSuccess('Issue created successfully from test result');
        await fetchControl(); // Refresh control to update issues list
        setTabValue(5); // Switch to Issues/CAPA tab
        setTimeout(() => setSuccess(null), 3000);
      }
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      setError(error.response?.data?.message || 'Failed to create issue from test result');
    } finally {
      setCreatingIssueFromTestResult(null);
    }
  };

  // Helper to check if a test result can have an issue created from it
  const canCreateIssueFromTestResult = (result: string): boolean => {
    return ['FAIL', 'PARTIAL', 'INCONCLUSIVE'].includes(result);
  };

  const getResultColor = (result: string): 'success' | 'error' | 'warning' | 'default' => {
    switch (result) {
      case 'PASS': return 'success';
      case 'FAIL': return 'error';
      case 'PARTIAL': return 'warning';
      default: return 'default';
    }
  };

  const getTestResultStatusColor = (status: string): 'primary' | 'default' => {
    return status === 'FINAL' ? 'primary' : 'default';
  };

  const getStatusColor = (status: ControlStatus): 'error' | 'warning' | 'info' | 'success' | 'default' => {
    switch (status) {
      case ControlStatus.IMPLEMENTED: return 'success';
      case ControlStatus.IN_DESIGN: return 'info';
      case ControlStatus.DRAFT: return 'default';
      case ControlStatus.INOPERATIVE: return 'warning';
      case ControlStatus.RETIRED: return 'error';
      default: return 'default';
    }
  };

  const getTypeColor = (type: ControlType): 'error' | 'warning' | 'info' | 'success' | 'default' => {
    switch (type) {
      case ControlType.PREVENTIVE: return 'info';
      case ControlType.DETECTIVE: return 'warning';
      case ControlType.CORRECTIVE: return 'success';
      default: return 'default';
    }
  };

  const formatStatus = (status: string): string => {
    return status.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  const formatType = (type: string): string => {
    return type.charAt(0).toUpperCase() + type.slice(1);
  };

  const formatFrequency = (frequency: string | null): string => {
    if (!frequency) return '-';
    return frequency.charAt(0).toUpperCase() + frequency.slice(1);
  };

  const formatDate = (dateString: string | null): string => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString();
  };

  const formatDateTime = (dateString: string | null): string => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString();
  };

  const getAvailableProcesses = () => {
    const linkedIds = new Set(linkedProcesses.map(lp => lp.processId));
    return allProcesses.filter(p => !linkedIds.has(p.id));
  };

  const getSourceBadgeColor = (source: string | undefined): 'primary' | 'secondary' | 'default' => {
    if (!source) return 'default';
    switch (source.toLowerCase()) {
      case 'api': return 'primary';
      case 'ui': return 'secondary';
      default: return 'default';
    }
  };

  if (loading) {
    return <LoadingState message="Loading control details..." />;
  }

  if (error && !control) {
    return <ErrorState message={error} onRetry={fetchControl} />;
  }

  if (!control) {
    return <ErrorState message="Control not found" />;
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box display="flex" alignItems="center" gap={2} mb={3}>
        <IconButton onClick={() => navigate('/controls')}>
          <BackIcon />
        </IconButton>
        <Box flex={1}>
          <Typography variant="h4" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <ControlIcon /> {control.name}
          </Typography>
          {control.code && (
            <Typography variant="subtitle1" color="text.secondary">
              {control.code}
            </Typography>
          )}
        </Box>
        <Chip
          label={formatType(control.type)}
          color={getTypeColor(control.type)}
        />
        <Chip
          label={formatStatus(control.status)}
          color={getStatusColor(control.status)}
        />
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>{success}</Alert>}

      <Paper sx={{ width: '100%' }}>
        <Tabs value={tabValue} onChange={handleTabChange} aria-label="control detail tabs">
          <Tab icon={<InfoIcon />} label="Overview" iconPosition="start" />
          <Tab icon={<ProcessIcon />} label="Coverage" iconPosition="start" />
          <Tab icon={<EvidenceIcon />} label="Evidence" iconPosition="start" />
          <Tab icon={<TestIcon />} label="Tests" iconPosition="start" />
          <Tab icon={<TestIcon />} label="Test Results" iconPosition="start" />
          <Tab icon={<IssueIcon />} label="Issues/CAPA" iconPosition="start" />
          <Tab icon={<HistoryIcon />} label="History" iconPosition="start" />
          <Tab icon={<AttachmentIcon />} label="Attachments" iconPosition="start" />
        </Tabs>

        {/* Overview Tab */}
        <TabPanel value={tabValue} index={0}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>Basic Information</Typography>
                  <Divider sx={{ mb: 2 }} />
                  <Grid container spacing={2}>
                    <Grid item xs={4}><Typography color="text.secondary">Name</Typography></Grid>
                    <Grid item xs={8}><Typography>{control.name}</Typography></Grid>
                    <Grid item xs={4}><Typography color="text.secondary">Code</Typography></Grid>
                    <Grid item xs={8}><Typography>{control.code || '-'}</Typography></Grid>
                    <Grid item xs={4}><Typography color="text.secondary">Type</Typography></Grid>
                    <Grid item xs={8}><Chip label={formatType(control.type)} size="small" color={getTypeColor(control.type)} /></Grid>
                    <Grid item xs={4}><Typography color="text.secondary">Implementation</Typography></Grid>
                    <Grid item xs={8}><Typography>{formatType(control.implementationType)}</Typography></Grid>
                    <Grid item xs={4}><Typography color="text.secondary">Status</Typography></Grid>
                    <Grid item xs={8}><Chip label={formatStatus(control.status)} size="small" color={getStatusColor(control.status)} /></Grid>
                    <Grid item xs={4}><Typography color="text.secondary">Frequency</Typography></Grid>
                    <Grid item xs={8}><Typography>{formatFrequency(control.frequency)}</Typography></Grid>
                  </Grid>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>Testing Information</Typography>
                  <Divider sx={{ mb: 2 }} />
                  <Grid container spacing={2}>
                    <Grid item xs={4}><Typography color="text.secondary">Test Frequency</Typography></Grid>
                    <Grid item xs={8}><Typography>{formatFrequency(control.testFrequency)}</Typography></Grid>
                    <Grid item xs={4}><Typography color="text.secondary">Last Tested</Typography></Grid>
                    <Grid item xs={8}><Typography>{formatDate(control.lastTestedDate)}</Typography></Grid>
                    <Grid item xs={4}><Typography color="text.secondary">Next Test</Typography></Grid>
                    <Grid item xs={8}><Typography>{formatDate(control.nextTestDate)}</Typography></Grid>
                    <Grid item xs={4}><Typography color="text.secondary">Last Result</Typography></Grid>
                    <Grid item xs={8}>
                      {control.lastTestResult ? (
                        <Chip 
                          label={control.lastTestResult} 
                          size="small" 
                          color={control.lastTestResult === 'PASS' ? 'success' : control.lastTestResult === 'FAIL' ? 'error' : 'default'} 
                        />
                      ) : (
                        <Typography>-</Typography>
                      )}
                    </Grid>
                    <Grid item xs={4}><Typography color="text.secondary">Effective Date</Typography></Grid>
                    <Grid item xs={8}><Typography>{formatDate(control.effectiveDate)}</Typography></Grid>
                  </Grid>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>Description</Typography>
                  <Divider sx={{ mb: 2 }} />
                  <Typography>{control.description || 'No description provided.'}</Typography>
                </CardContent>
              </Card>
            </Grid>
            {control.evidenceRequirements && (
              <Grid item xs={12}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>Evidence Requirements</Typography>
                    <Divider sx={{ mb: 2 }} />
                    <Typography>{control.evidenceRequirements}</Typography>
                  </CardContent>
                </Card>
              </Grid>
            )}
            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>Ownership & Audit</Typography>
                  <Divider sx={{ mb: 2 }} />
                  <Grid container spacing={2}>
                    <Grid item xs={2}><Typography color="text.secondary">Owner</Typography></Grid>
                    <Grid item xs={4}>
                      <Typography>
                        {control.owner 
                          ? `${control.owner.firstName || ''} ${control.owner.lastName || ''} (${control.owner.email})`.trim()
                          : '-'}
                      </Typography>
                    </Grid>
                    <Grid item xs={2}><Typography color="text.secondary">Created</Typography></Grid>
                    <Grid item xs={4}><Typography>{formatDateTime(control.createdAt)}</Typography></Grid>
                    <Grid item xs={2}><Typography color="text.secondary">Updated</Typography></Grid>
                    <Grid item xs={4}><Typography>{formatDateTime(control.updatedAt)}</Typography></Grid>
                  </Grid>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </TabPanel>

        {/* Coverage Tab - Process Link/Unlink */}
        <TabPanel value={tabValue} index={1}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h6">Linked Processes</Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setLinkDialogOpen(true)}
              disabled={getAvailableProcesses().length === 0}
            >
              Link Process
            </Button>
          </Box>
          
          {linkedProcesses.length === 0 ? (
            <Alert severity="info">
              No processes linked to this control. Click "Link Process" to add one.
            </Alert>
          ) : (
            <Table>
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
                {linkedProcesses.map((lp) => (
                  <TableRow key={lp.id}>
                    <TableCell>{lp.process?.code || '-'}</TableCell>
                    <TableCell>{lp.process?.name || '-'}</TableCell>
                    <TableCell>
                      <Chip
                        label={lp.process?.isActive ? 'Active' : 'Inactive'}
                        size="small"
                        color={lp.process?.isActive ? 'success' : 'default'}
                      />
                    </TableCell>
                    <TableCell>{formatDateTime(lp.createdAt)}</TableCell>
                    <TableCell>
                      <Tooltip title="Unlink Process">
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleUnlinkProcess(lp.processId)}
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

          <Divider sx={{ my: 3 }} />

          <Typography variant="h6" gutterBottom>Linked Requirements</Typography>
          {control.requirementControls && control.requirementControls.length > 0 ? (
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Reference Code</TableCell>
                  <TableCell>Title</TableCell>
                  <TableCell>Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {control.requirementControls.map((rc) => (
                  <TableRow key={rc.id}>
                    <TableCell>{rc.requirement?.referenceCode || '-'}</TableCell>
                    <TableCell>{rc.requirement?.title || '-'}</TableCell>
                    <TableCell>
                      <Chip
                        label={formatStatus(rc.requirement?.status || '')}
                        size="small"
                        variant="outlined"
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <Alert severity="info">No requirements linked to this control.</Alert>
          )}
        </TabPanel>

        {/* Evidence Tab */}
        <TabPanel value={tabValue} index={2}>
          <Typography variant="h6" gutterBottom>Control Evidence</Typography>
          {control.controlEvidence && control.controlEvidence.length > 0 ? (
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Title</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Description</TableCell>
                  <TableCell>Collected At</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {control.controlEvidence.map((evidence) => (
                  <TableRow key={evidence.id}>
                    <TableCell>{evidence.title}</TableCell>
                    <TableCell>
                      <Chip label={evidence.evidenceType} size="small" variant="outlined" />
                    </TableCell>
                    <TableCell>{evidence.description || '-'}</TableCell>
                    <TableCell>{formatDateTime(evidence.collectedAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <Alert severity="info">No evidence collected for this control yet.</Alert>
          )}
        </TabPanel>

        {/* Tests Tab */}
        <TabPanel value={tabValue} index={3}>
          <Typography variant="h6" gutterBottom>Control Tests</Typography>
          {control.controlTests && control.controlTests.length > 0 ? (
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Type</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Scheduled</TableCell>
                  <TableCell>Completed</TableCell>
                  <TableCell>Result</TableCell>
                  <TableCell>Notes</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {control.controlTests.map((test) => (
                  <TableRow key={test.id}>
                    <TableCell>
                      <Chip label={test.testType} size="small" variant="outlined" />
                    </TableCell>
                    <TableCell>
                      <Chip 
                        label={formatStatus(test.status)} 
                        size="small" 
                        color={test.status === 'COMPLETED' ? 'success' : test.status === 'IN_PROGRESS' ? 'info' : 'default'}
                      />
                    </TableCell>
                    <TableCell>{formatDate(test.scheduledDate)}</TableCell>
                    <TableCell>{formatDate(test.completedDate)}</TableCell>
                    <TableCell>
                      {test.result ? (
                        <Chip 
                          label={test.result} 
                          size="small" 
                          color={test.result === 'PASS' ? 'success' : test.result === 'FAIL' ? 'error' : 'default'}
                        />
                      ) : '-'}
                    </TableCell>
                    <TableCell>
                      <Tooltip title={test.notes || ''}>
                        <Typography sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {test.notes || '-'}
                        </Typography>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <Alert severity="info">No tests scheduled or completed for this control yet.</Alert>
          )}
        </TabPanel>

        {/* Test Results Tab (Test/Result Sprint) */}
        <TabPanel value={tabValue} index={4}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h6">Test Results</Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleOpenTestResultDialog}
            >
              Add Test Result
            </Button>
          </Box>
          {testResultsLoading ? (
            <Box display="flex" justifyContent="center" p={4}>
              <CircularProgress />
            </Box>
          ) : testResults.length > 0 ? (
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Test Date</TableCell>
                  <TableCell>Result</TableCell>
                  <TableCell>Method</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Evidence Count</TableCell>
                  <TableCell>Summary</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {testResults.map((testResult) => (
                  <TableRow key={testResult.id}>
                    <TableCell>{formatDate(testResult.testDate || testResult.createdAt)}</TableCell>
                    <TableCell>
                      <Chip 
                        label={testResult.result} 
                        size="small" 
                        color={getResultColor(testResult.result)}
                      />
                    </TableCell>
                    <TableCell>
                      <Chip label={testResult.method || 'OTHER'} size="small" variant="outlined" />
                    </TableCell>
                    <TableCell>
                      <Chip 
                        label={testResult.status || 'DRAFT'} 
                        size="small" 
                        color={getTestResultStatusColor(testResult.status || 'DRAFT')}
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>{testResult.evidenceCount || 0}</TableCell>
                    <TableCell>
                      <Tooltip title={testResult.summary || ''}>
                        <Typography sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {testResult.summary || '-'}
                        </Typography>
                      </Tooltip>
                    </TableCell>
                    <TableCell>
                      {canCreateIssueFromTestResult(testResult.result) && (
                        <Tooltip title="Create Issue from this failed test result">
                          <Button
                            size="small"
                            variant="outlined"
                            color="warning"
                            startIcon={<IssueIcon />}
                            onClick={() => handleCreateIssueFromTestResult(testResult.id)}
                            disabled={creatingIssueFromTestResult === testResult.id}
                          >
                            {creatingIssueFromTestResult === testResult.id ? (
                              <CircularProgress size={16} />
                            ) : (
                              'Create Issue'
                            )}
                          </Button>
                        </Tooltip>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <Alert severity="info">No test results recorded for this control yet. Click "Add Test Result" to create one.</Alert>
          )}
        </TabPanel>

        {/* Issues/CAPA Tab */}
        <TabPanel value={tabValue} index={5}>
          <Typography variant="h6" gutterBottom>Related Issues</Typography>
          {control.issues && control.issues.length > 0 ? (
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Title</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Severity</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Created</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {control.issues.map((issue) => (
                  <TableRow key={issue.id}>
                    <TableCell>{issue.title}</TableCell>
                    <TableCell>
                      <Chip label={formatType(issue.type)} size="small" variant="outlined" />
                    </TableCell>
                    <TableCell>
                      <Chip 
                        label={formatType(issue.severity)} 
                        size="small" 
                        color={
                          issue.severity === 'critical' ? 'error' : 
                          issue.severity === 'high' ? 'warning' : 
                          issue.severity === 'medium' ? 'info' : 'default'
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <Chip 
                        label={formatStatus(issue.status)} 
                        size="small" 
                        color={issue.status === 'closed' ? 'success' : issue.status === 'resolved' ? 'info' : 'default'}
                      />
                    </TableCell>
                    <TableCell>{formatDateTime(issue.createdAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <Alert severity="info">No issues linked to this control.</Alert>
          )}
        </TabPanel>

        {/* History Tab */}
        <TabPanel value={tabValue} index={6}>
          <Typography variant="h6" gutterBottom>Status History</Typography>
          {historyLoading ? (
            <Box display="flex" justifyContent="center" p={4}>
              <CircularProgress />
            </Box>
          ) : statusHistory.length > 0 ? (
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Date</TableCell>
                  <TableCell>Previous Status</TableCell>
                  <TableCell>New Status</TableCell>
                  <TableCell>Changed By</TableCell>
                  <TableCell>Reason</TableCell>
                  <TableCell>Source</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {statusHistory.map((history) => (
                  <TableRow key={history.id}>
                    <TableCell>{formatDateTime(history.createdAt)}</TableCell>
                    <TableCell>
                      {history.previousStatus ? (
                        <Chip label={formatStatus(history.previousStatus)} size="small" variant="outlined" />
                      ) : '-'}
                    </TableCell>
                    <TableCell>
                      <Chip label={formatStatus(history.newStatus)} size="small" color="primary" />
                    </TableCell>
                    <TableCell>
                      {history.changedBy 
                        ? `${history.changedBy.firstName || ''} ${history.changedBy.lastName || ''} (${history.changedBy.email})`.trim()
                        : '-'}
                    </TableCell>
                    <TableCell>
                      <Tooltip title={history.changeReason || ''}>
                        <Typography sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {history.changeReason || '-'}
                        </Typography>
                      </Tooltip>
                    </TableCell>
                    <TableCell>
                      {history.metadata?.source ? (
                        <Chip 
                          label={String(history.metadata.source)} 
                          size="small" 
                          color={getSourceBadgeColor(String(history.metadata.source))}
                          variant="outlined"
                        />
                      ) : '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <Alert severity="info">No status history available for this control.</Alert>
          )}
        </TabPanel>

        {/* Attachments Tab */}
        <TabPanel value={tabValue} index={7}>
          <AttachmentPanel refTable="grc_controls" refId={control.id} />
        </TabPanel>
      </Paper>

      {/* Link Process Dialog */}
      <Dialog open={linkDialogOpen} onClose={() => setLinkDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Link Process to Control</DialogTitle>
        <DialogContent>
          <FormControl fullWidth sx={{ mt: 2 }}>
            <InputLabel>Select Process</InputLabel>
            <Select
              value={selectedProcessId}
              label="Select Process"
              onChange={(e) => setSelectedProcessId(e.target.value)}
            >
              {getAvailableProcesses().map((process) => (
                <MenuItem key={process.id} value={process.id}>
                  {process.code} - {process.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLinkDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleLinkProcess}
            disabled={!selectedProcessId || linkingProcess}
            startIcon={linkingProcess ? <CircularProgress size={20} /> : <LinkIcon />}
          >
            Link
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add Test Result Dialog (Test/Result Sprint) */}
      <Dialog open={testResultDialogOpen} onClose={() => setTestResultDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Add Test Result</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Test Date</InputLabel>
                <input
                  type="date"
                  value={newTestResult.testDate || ''}
                  onChange={(e) => setNewTestResult({ ...newTestResult, testDate: e.target.value })}
                  style={{ 
                    padding: '16.5px 14px', 
                    border: '1px solid rgba(0, 0, 0, 0.23)', 
                    borderRadius: '4px',
                    fontSize: '16px',
                    width: '100%',
                    boxSizing: 'border-box'
                  }}
                />
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Result</InputLabel>
                <Select
                  value={newTestResult.result}
                  label="Result"
                  onChange={(e) => setNewTestResult({ ...newTestResult, result: e.target.value as TestResultOutcome })}
                >
                  <MenuItem value="PASS">Pass</MenuItem>
                  <MenuItem value="FAIL">Fail</MenuItem>
                  <MenuItem value="PARTIAL">Partial</MenuItem>
                  <MenuItem value="NOT_TESTED">Not Tested</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Method</InputLabel>
                <Select
                  value={newTestResult.method || 'OTHER'}
                  label="Method"
                  onChange={(e) => setNewTestResult({ ...newTestResult, method: e.target.value as TestMethod })}
                >
                  <MenuItem value="INTERVIEW">Interview</MenuItem>
                  <MenuItem value="OBSERVATION">Observation</MenuItem>
                  <MenuItem value="INSPECTION">Inspection</MenuItem>
                  <MenuItem value="REPERFORMANCE">Reperformance</MenuItem>
                  <MenuItem value="OTHER">Other</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  value={newTestResult.status || 'DRAFT'}
                  label="Status"
                  onChange={(e) => setNewTestResult({ ...newTestResult, status: e.target.value as TestResultStatus })}
                >
                  <MenuItem value="DRAFT">Draft</MenuItem>
                  <MenuItem value="FINAL">Final</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel shrink>Summary</InputLabel>
                <textarea
                  value={newTestResult.summary || ''}
                  onChange={(e) => setNewTestResult({ ...newTestResult, summary: e.target.value })}
                  placeholder="Enter test summary..."
                  rows={3}
                  style={{ 
                    padding: '16.5px 14px', 
                    border: '1px solid rgba(0, 0, 0, 0.23)', 
                    borderRadius: '4px',
                    fontSize: '16px',
                    width: '100%',
                    boxSizing: 'border-box',
                    fontFamily: 'inherit',
                    resize: 'vertical',
                    marginTop: '16px'
                  }}
                />
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <Typography variant="subtitle2" gutterBottom sx={{ mt: 1 }}>
                Link Evidence (optional)
              </Typography>
              <FormControl fullWidth>
                <InputLabel>Select Evidence</InputLabel>
                <Select
                  multiple
                  value={selectedEvidenceIds}
                  label="Select Evidence"
                  onChange={(e) => setSelectedEvidenceIds(e.target.value as string[])}
                  renderValue={(selected) => (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {(selected as string[]).map((id) => {
                        const evidence = availableEvidences.find(e => e.id === id);
                        return (
                          <Chip key={id} label={evidence?.name || id} size="small" />
                        );
                      })}
                    </Box>
                  )}
                >
                                    {availableEvidences.map((evidence) => (
                                      <MenuItem key={evidence.id} value={evidence.id}>
                                        {evidence.name} ({evidence.type})
                                      </MenuItem>
                                    ))}
                </Select>
              </FormControl>
              {availableEvidences.length === 0 && (
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                  No evidence available. Create evidence first to link it to test results.
                </Typography>
              )}
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTestResultDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleCreateTestResult}
            disabled={!newTestResult.result || creatingTestResult}
            startIcon={creatingTestResult ? <CircularProgress size={20} /> : <AddIcon />}
          >
            Create Test Result
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ControlDetail;
