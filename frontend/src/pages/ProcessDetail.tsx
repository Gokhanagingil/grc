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
  Switch,
  FormControlLabel,
  LinearProgress,
  Tooltip,
} from '@mui/material';
import {
  AccountTree as ProcessIcon,
  ArrowBack as BackIcon,
  Edit as EditIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  PlayArrow as RecordIcon,
} from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';
import {
  processApi,
  processControlApi,
  controlResultApi,
  evidenceApi,
  unwrapResponse,
  unwrapPaginatedResponse,
  EvidenceData,
} from '../services/grcClient';
import { useAuth } from '../contexts/AuthContext';
import { LoadingState, ErrorState } from '../components/common';
import { buildListQueryParams } from '../utils';

interface Process {
  id: string;
  tenantId: string;
  name: string;
  code: string;
  description: string | null;
  ownerUserId: string | null;
  category: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ProcessControl {
  id: string;
  tenantId: string;
  processId: string;
  name: string;
  description: string | null;
  isAutomated: boolean;
  method: string;
  frequency: string;
  expectedResultType: string;
  parameters: Record<string, unknown> | null;
  isActive: boolean;
  ownerUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ComplianceScore {
  processId: string;
  processName: string;
  complianceScore: number;
  totalResults: number;
  compliantResults: number;
  nonCompliantResults: number;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div role="tabpanel" hidden={value !== index} {...other}>
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  );
}

const CONTROL_METHODS = ['script', 'sampling', 'interview', 'walkthrough', 'observation'];
const CONTROL_FREQUENCIES = ['daily', 'weekly', 'monthly', 'quarterly', 'annually', 'event_driven'];
const RESULT_TYPES = ['boolean', 'numeric', 'qualitative'];
const PROCESS_CATEGORIES = ['ITSM', 'Security', 'Finance', 'Operations', 'HR', 'Compliance'];

const formatDateTime = (dateString: string | null | undefined): string => {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleString();
};

export const ProcessDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const tenantId = user?.tenantId || '';
  const isNewProcess = !id || id === 'new';

  const [process, setProcess] = useState<Process | null>(null);
  const [loading, setLoading] = useState(!isNewProcess);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [tabValue, setTabValue] = useState(0);
  const [saving, setSaving] = useState(false);

  const [processControls, setProcessControls] = useState<ProcessControl[]>([]);
  const [controlsLoading, setControlsLoading] = useState(false);
  const [complianceScore, setComplianceScore] = useState<ComplianceScore | null>(null);

  const [editDialogOpen, setEditDialogOpen] = useState(isNewProcess);
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    description: '',
    category: '',
    isActive: true,
  });

  const [controlDialogOpen, setControlDialogOpen] = useState(false);
  const [editingControl, setEditingControl] = useState<ProcessControl | null>(null);
  const [controlFormData, setControlFormData] = useState({
    name: '',
    description: '',
    isAutomated: false,
    method: 'walkthrough',
    frequency: 'monthly',
    expectedResultType: 'boolean',
    isActive: true,
  });

  const [resultDialogOpen, setResultDialogOpen] = useState(false);
  const [selectedControlForResult, setSelectedControlForResult] = useState<ProcessControl | null>(null);
  const [availableEvidence, setAvailableEvidence] = useState<EvidenceData[]>([]);
  const [resultFormData, setResultFormData] = useState({
    isCompliant: true,
    resultValueBoolean: true,
    resultValueNumber: 0,
    resultValueText: '',
    evidenceReference: '',
  });

  const fetchProcess = useCallback(async () => {
    if (!id || isNewProcess || !tenantId) return;

    setLoading(true);
    setError(null);

    try {
      const response = await processApi.get(tenantId, id);
      const data = unwrapResponse<Process>(response);
      setProcess(data);
      setFormData({
        name: data.name,
        code: data.code,
        description: data.description || '',
        category: data.category || '',
        isActive: data.isActive,
      });
    } catch (err) {
      console.error('Error fetching process:', err);
      setError('Failed to load process details. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [id, isNewProcess, tenantId]);

  const fetchProcessControls = useCallback(async () => {
    if (!id || isNewProcess || !tenantId) return;

    setControlsLoading(true);
    try {
      const response = await processControlApi.list(tenantId, buildListQueryParams({ processId: id }));
      const result = unwrapPaginatedResponse<ProcessControl>(response);
      setProcessControls(result.items);
    } catch (err) {
      console.error('Failed to fetch process controls:', err);
      setProcessControls([]);
    } finally {
      setControlsLoading(false);
    }
  }, [id, isNewProcess, tenantId]);

  const fetchComplianceScore = useCallback(async () => {
    if (!id || isNewProcess || !tenantId) return;

    try {
      const response = await processApi.getComplianceScore(tenantId, id);
      const score = unwrapResponse<ComplianceScore>(response);
      setComplianceScore(score);
    } catch (err) {
      console.error('Failed to fetch compliance score:', err);
      setComplianceScore(null);
    }
  }, [id, isNewProcess, tenantId]);

  useEffect(() => {
    fetchProcess();
  }, [fetchProcess]);

  useEffect(() => {
    if (tabValue === 1) {
      fetchProcessControls();
      fetchComplianceScore();
    }
  }, [tabValue, fetchProcessControls, fetchComplianceScore]);

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleSaveProcess = async () => {
    if (!tenantId) {
      setError('Tenant ID is required');
      return;
    }

    setSaving(true);
    try {
      const processData = {
        name: formData.name,
        code: formData.code,
        description: formData.description || undefined,
        category: formData.category || undefined,
        isActive: formData.isActive,
      };

      if (isNewProcess) {
        const response = await processApi.create(tenantId, processData);
        const newProcess = unwrapResponse<Process>(response);
        setSuccess('Process created successfully');
        navigate(`/processes/${newProcess.id}`, { replace: true });
      } else if (id) {
        await processApi.update(tenantId, id, processData);
        setSuccess('Process updated successfully');
        setEditDialogOpen(false);
        fetchProcess();
      }
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      setError(error.response?.data?.message || 'Failed to save process');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateControl = () => {
    setEditingControl(null);
    setControlFormData({
      name: '',
      description: '',
      isAutomated: false,
      method: 'walkthrough',
      frequency: 'monthly',
      expectedResultType: 'boolean',
      isActive: true,
    });
    setControlDialogOpen(true);
  };

  const handleEditControl = (control: ProcessControl) => {
    setEditingControl(control);
    setControlFormData({
      name: control.name,
      description: control.description || '',
      isAutomated: control.isAutomated,
      method: control.method,
      frequency: control.frequency,
      expectedResultType: control.expectedResultType,
      isActive: control.isActive,
    });
    setControlDialogOpen(true);
  };

  const handleSaveControl = async () => {
    if (!tenantId || !id) {
      setError('Process context is required');
      return;
    }

    try {
      const controlData = {
        processId: id,
        name: controlFormData.name,
        description: controlFormData.description || undefined,
        isAutomated: controlFormData.isAutomated,
        method: controlFormData.method,
        frequency: controlFormData.frequency,
        expectedResultType: controlFormData.expectedResultType,
        isActive: controlFormData.isActive,
      };

      if (editingControl) {
        await processControlApi.update(tenantId, editingControl.id, controlData);
        setSuccess('Control updated successfully');
      } else {
        await processControlApi.create(tenantId, controlData);
        setSuccess('Control created successfully');
      }

      setControlDialogOpen(false);
      fetchProcessControls();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      setError(error.response?.data?.message || 'Failed to save control');
    }
  };

  const handleDeleteControl = async (controlId: string) => {
    if (!window.confirm('Are you sure you want to delete this control?')) return;

    try {
      await processControlApi.delete(tenantId, controlId);
      setSuccess('Control deleted successfully');
      fetchProcessControls();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      setError(error.response?.data?.message || 'Failed to delete control');
    }
  };

  const fetchAvailableEvidence = useCallback(async () => {
    if (!tenantId) return;
    try {
      const response = await evidenceApi.list(tenantId, { pageSize: 100 });
      const data = unwrapPaginatedResponse<EvidenceData>(response);
      setAvailableEvidence(data.items || []);
    } catch (err) {
      console.error('Failed to fetch evidence:', err);
      setAvailableEvidence([]);
    }
  }, [tenantId]);

  const handleRecordResult = (control: ProcessControl) => {
    setSelectedControlForResult(control);
    setResultFormData({
      isCompliant: true,
      resultValueBoolean: true,
      resultValueNumber: 0,
      resultValueText: '',
      evidenceReference: '',
    });
    fetchAvailableEvidence();
    setResultDialogOpen(true);
  };

  const handleSaveResult = async () => {
    if (!tenantId || !selectedControlForResult) {
      setError('Control context is required');
      return;
    }

    try {
      const resultData: Record<string, unknown> = {
        controlId: selectedControlForResult.id,
        isCompliant: resultFormData.isCompliant,
        source: 'MANUAL',
        evidenceReference: resultFormData.evidenceReference || undefined,
      };

      if (selectedControlForResult.expectedResultType === 'BOOLEAN') {
        resultData.resultValueBoolean = resultFormData.resultValueBoolean;
      } else if (selectedControlForResult.expectedResultType === 'NUMERIC') {
        resultData.resultValueNumber = resultFormData.resultValueNumber;
      } else {
        resultData.resultValueText = resultFormData.resultValueText;
      }

      await controlResultApi.create(tenantId, resultData);
      setSuccess(
        resultFormData.isCompliant
          ? 'Control result recorded successfully'
          : 'Control result recorded - Violation created automatically'
      );
      setResultDialogOpen(false);
      fetchComplianceScore();
      setTimeout(() => setSuccess(null), 5000);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      setError(error.response?.data?.message || 'Failed to record result');
    }
  };

  const getComplianceColor = (score: number): 'success' | 'warning' | 'error' => {
    if (score >= 0.8) return 'success';
    if (score >= 0.5) return 'warning';
    return 'error';
  };

  if (loading) {
    return <LoadingState message="Loading process details..." />;
  }

  if (error && !process && !isNewProcess) {
    return <ErrorState message={error} onRetry={fetchProcess} />;
  }

  return (
    <Box sx={{ p: 3 }} data-testid="process-detail-page">
      <Box display="flex" alignItems="center" gap={2} mb={3}>
        <IconButton onClick={() => navigate('/processes')} data-testid="back-button">
          <BackIcon />
        </IconButton>
        <Box flex={1}>
          <Typography variant="h4" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <ProcessIcon /> {isNewProcess ? 'New Process' : process?.name}
          </Typography>
          {!isNewProcess && process && (
            <Typography variant="subtitle1" color="text.secondary">
              Code: {process.code}
            </Typography>
          )}
        </Box>
        {!isNewProcess && process && (
          <>
            <Chip
              label={process.isActive ? 'Active' : 'Inactive'}
              color={process.isActive ? 'success' : 'default'}
            />
            <Button
              variant="outlined"
              startIcon={<EditIcon />}
              onClick={() => setEditDialogOpen(true)}
            >
              Edit
            </Button>
          </>
        )}
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>{success}</Alert>}

      {isNewProcess ? (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>Create New Process</Typography>
            <Divider sx={{ mb: 2 }} />
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Code"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  required
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  multiline
                  rows={3}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Category</InputLabel>
                  <Select
                    value={formData.category}
                    label="Category"
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  >
                    <MenuItem value="">None</MenuItem>
                    {PROCESS_CATEGORIES.map((cat) => (
                      <MenuItem key={cat} value={cat}>{cat}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={6}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={formData.isActive}
                      onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    />
                  }
                  label="Active"
                />
              </Grid>
              <Grid item xs={12}>
                <Box display="flex" gap={2} justifyContent="flex-end">
                  <Button onClick={() => navigate('/processes')}>Cancel</Button>
                  <Button
                    variant="contained"
                    onClick={handleSaveProcess}
                    disabled={saving || !formData.name || !formData.code}
                  >
                    {saving ? 'Creating...' : 'Create Process'}
                  </Button>
                </Box>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      ) : (
        <Paper sx={{ width: '100%' }}>
          <Tabs value={tabValue} onChange={handleTabChange}>
            <Tab label="Overview" />
            <Tab label="Controls" />
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
                      <Grid item xs={8}><Typography>{process?.name}</Typography></Grid>
                      <Grid item xs={4}><Typography color="text.secondary">Code</Typography></Grid>
                      <Grid item xs={8}><Typography>{process?.code}</Typography></Grid>
                      <Grid item xs={4}><Typography color="text.secondary">Category</Typography></Grid>
                      <Grid item xs={8}><Typography>{process?.category || '-'}</Typography></Grid>
                      <Grid item xs={4}><Typography color="text.secondary">Status</Typography></Grid>
                      <Grid item xs={8}>
                        <Chip
                          label={process?.isActive ? 'Active' : 'Inactive'}
                          size="small"
                          color={process?.isActive ? 'success' : 'default'}
                        />
                      </Grid>
                      <Grid item xs={4}><Typography color="text.secondary">Created</Typography></Grid>
                      <Grid item xs={8}><Typography>{formatDateTime(process?.createdAt)}</Typography></Grid>
                      <Grid item xs={4}><Typography color="text.secondary">Updated</Typography></Grid>
                      <Grid item xs={8}><Typography>{formatDateTime(process?.updatedAt)}</Typography></Grid>
                    </Grid>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} md={6}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>Description</Typography>
                    <Divider sx={{ mb: 2 }} />
                    <Typography>{process?.description || 'No description provided.'}</Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </TabPanel>

          <TabPanel value={tabValue} index={1}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography variant="h6">Process Controls</Typography>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={handleCreateControl}
              >
                Add Control
              </Button>
            </Box>

            {complianceScore && (
              <Card sx={{ mb: 3 }}>
                <CardContent>
                  <Typography variant="subtitle1" gutterBottom>Compliance Score</Typography>
                  <Box display="flex" alignItems="center" gap={2}>
                    <LinearProgress
                      variant="determinate"
                      value={complianceScore.complianceScore * 100}
                      color={getComplianceColor(complianceScore.complianceScore)}
                      sx={{ flex: 1, height: 10, borderRadius: 5 }}
                    />
                    <Typography variant="h6">
                      {Math.round(complianceScore.complianceScore * 100)}%
                    </Typography>
                  </Box>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    {complianceScore.compliantResults} compliant / {complianceScore.totalResults} total results
                  </Typography>
                </CardContent>
              </Card>
            )}

            {controlsLoading ? (
              <Box display="flex" justifyContent="center" py={4}>
                <LinearProgress sx={{ width: '50%' }} />
              </Box>
            ) : processControls.length === 0 ? (
              <Typography color="text.secondary" align="center" py={4}>
                No controls defined for this process yet.
              </Typography>
            ) : (
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Name</TableCell>
                    <TableCell>Method</TableCell>
                    <TableCell>Frequency</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {processControls.map((control) => (
                    <TableRow key={control.id}>
                      <TableCell>{control.name}</TableCell>
                      <TableCell sx={{ textTransform: 'capitalize' }}>{control.method}</TableCell>
                      <TableCell sx={{ textTransform: 'capitalize' }}>{control.frequency.replace('_', ' ')}</TableCell>
                      <TableCell sx={{ textTransform: 'capitalize' }}>{control.expectedResultType}</TableCell>
                      <TableCell>
                        <Chip
                          label={control.isActive ? 'Active' : 'Inactive'}
                          size="small"
                          color={control.isActive ? 'success' : 'default'}
                        />
                      </TableCell>
                      <TableCell>
                        <Tooltip title="Record Result">
                          <IconButton size="small" onClick={() => handleRecordResult(control)}>
                            <RecordIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Edit">
                          <IconButton size="small" onClick={() => handleEditControl(control)}>
                            <EditIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete">
                          <IconButton size="small" color="error" onClick={() => handleDeleteControl(control.id)}>
                            <DeleteIcon />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </TabPanel>
        </Paper>
      )}

      {/* Edit Process Dialog */}
      <Dialog open={editDialogOpen && !isNewProcess} onClose={() => setEditDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Process</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              fullWidth
              label="Name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
            <TextField
              fullWidth
              label="Code"
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value })}
              required
            />
            <TextField
              fullWidth
              label="Description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              multiline
              rows={3}
            />
            <FormControl fullWidth>
              <InputLabel>Category</InputLabel>
              <Select
                value={formData.category}
                label="Category"
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              >
                <MenuItem value="">None</MenuItem>
                {PROCESS_CATEGORIES.map((cat) => (
                  <MenuItem key={cat} value={cat}>{cat}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControlLabel
              control={
                <Switch
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                />
              }
              label="Active"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleSaveProcess}
            disabled={saving || !formData.name || !formData.code}
          >
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Control Dialog */}
      <Dialog open={controlDialogOpen} onClose={() => setControlDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingControl ? 'Edit Control' : 'Add Control'}</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              fullWidth
              label="Name"
              value={controlFormData.name}
              onChange={(e) => setControlFormData({ ...controlFormData, name: e.target.value })}
              required
            />
            <TextField
              fullWidth
              label="Description"
              value={controlFormData.description}
              onChange={(e) => setControlFormData({ ...controlFormData, description: e.target.value })}
              multiline
              rows={2}
            />
            <FormControl fullWidth>
              <InputLabel>Method</InputLabel>
              <Select
                value={controlFormData.method}
                label="Method"
                onChange={(e) => setControlFormData({ ...controlFormData, method: e.target.value })}
              >
                {CONTROL_METHODS.map((method) => (
                  <MenuItem key={method} value={method} sx={{ textTransform: 'capitalize' }}>
                    {method}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel>Frequency</InputLabel>
              <Select
                value={controlFormData.frequency}
                label="Frequency"
                onChange={(e) => setControlFormData({ ...controlFormData, frequency: e.target.value })}
              >
                {CONTROL_FREQUENCIES.map((freq) => (
                  <MenuItem key={freq} value={freq} sx={{ textTransform: 'capitalize' }}>
                    {freq.replace('_', ' ')}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel>Result Type</InputLabel>
              <Select
                value={controlFormData.expectedResultType}
                label="Result Type"
                onChange={(e) => setControlFormData({ ...controlFormData, expectedResultType: e.target.value })}
              >
                {RESULT_TYPES.map((type) => (
                  <MenuItem key={type} value={type} sx={{ textTransform: 'capitalize' }}>
                    {type}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControlLabel
              control={
                <Switch
                  checked={controlFormData.isAutomated}
                  onChange={(e) => setControlFormData({ ...controlFormData, isAutomated: e.target.checked })}
                />
              }
              label="Automated"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={controlFormData.isActive}
                  onChange={(e) => setControlFormData({ ...controlFormData, isActive: e.target.checked })}
                />
              }
              label="Active"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setControlDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleSaveControl}
            disabled={!controlFormData.name}
          >
            {editingControl ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Record Result Dialog */}
      <Dialog open={resultDialogOpen} onClose={() => setResultDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Record Control Result</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Typography variant="subtitle2" color="text.secondary">
              Control: {selectedControlForResult?.name}
            </Typography>
            <FormControlLabel
              control={
                <Switch
                  checked={resultFormData.isCompliant}
                  onChange={(e) => setResultFormData({ ...resultFormData, isCompliant: e.target.checked })}
                />
              }
              label={resultFormData.isCompliant ? 'Compliant' : 'Non-Compliant (will create violation)'}
            />
            {selectedControlForResult?.expectedResultType === 'boolean' && (
              <FormControlLabel
                control={
                  <Switch
                    checked={resultFormData.resultValueBoolean}
                    onChange={(e) => setResultFormData({ ...resultFormData, resultValueBoolean: e.target.checked })}
                  />
                }
                label="Result Value"
              />
            )}
            {selectedControlForResult?.expectedResultType === 'numeric' && (
              <TextField
                fullWidth
                label="Result Value"
                type="number"
                value={resultFormData.resultValueNumber}
                onChange={(e) => setResultFormData({ ...resultFormData, resultValueNumber: Number(e.target.value) })}
              />
            )}
            {selectedControlForResult?.expectedResultType === 'qualitative' && (
              <TextField
                fullWidth
                label="Result Value"
                value={resultFormData.resultValueText}
                onChange={(e) => setResultFormData({ ...resultFormData, resultValueText: e.target.value })}
                multiline
                rows={2}
              />
            )}
            <FormControl fullWidth>
              <InputLabel>Evidence Reference</InputLabel>
              <Select
                value={resultFormData.evidenceReference}
                label="Evidence Reference"
                onChange={(e) => setResultFormData({ ...resultFormData, evidenceReference: e.target.value })}
              >
                <MenuItem value="">None</MenuItem>
                {availableEvidence.map((ev) => (
                  <MenuItem key={ev.id} value={ev.id}>{ev.name}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setResultDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSaveResult}>
            Record Result
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ProcessDetail;
