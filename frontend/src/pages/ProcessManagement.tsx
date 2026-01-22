import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  TablePagination,
  Tooltip,
  Tabs,
  Tab,
  Switch,
  FormControlLabel,
  LinearProgress,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon,
  AccountTree as ProcessIcon,
  PlayArrow as RecordIcon,
  Warning as ViolationIcon,
} from '@mui/icons-material';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  processApi,
  processControlApi,
  controlResultApi,
  evidenceApi,
  unwrapPaginatedResponse,
  unwrapResponse,
  EvidenceData,
} from '../services/grcClient';
import { useAuth } from '../contexts/AuthContext';
import { buildListQueryParams, buildListQueryParamsWithDefaults, parseFilterFromQuery, parseSortFromQuery, formatSortToQuery } from '../utils';
import { LoadingState, ErrorState, EmptyState, ResponsiveTable, ListToolbar } from '../components/common';

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

const CONTROL_METHODS = ['script', 'sampling', 'interview', 'walkthrough', 'observation'];
const CONTROL_FREQUENCIES = ['daily', 'weekly', 'monthly', 'quarterly', 'annually', 'event_driven'];
const RESULT_TYPES = ['boolean', 'numeric', 'qualitative'];
const PROCESS_CATEGORIES = ['ITSM', 'Security', 'Finance', 'Operations', 'HR', 'Compliance'];

export const ProcessManagement: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Default values
  const DEFAULT_SORT = 'createdAt:DESC';
  const DEFAULT_PAGE = 1;
  const DEFAULT_PAGE_SIZE = 10;

  // Read initial values from URL
  const pageParam = parseInt(searchParams.get('page') || '1', 10);
  const pageSizeParam = parseInt(searchParams.get('pageSize') || String(DEFAULT_PAGE_SIZE), 10);
  const sortParam = searchParams.get('sort') || DEFAULT_SORT;
  const filterParam = parseFilterFromQuery(searchParams.get('filter'));

  const parsedSort = parseSortFromQuery(sortParam) || { field: 'createdAt', direction: 'DESC' as const };

  const [processes, setProcesses] = useState<Process[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [openDialog, setOpenDialog] = useState(false);
  const [openViewDialog, setOpenViewDialog] = useState(false);
  const [openControlDialog, setOpenControlDialog] = useState(false);
  const [openResultDialog, setOpenResultDialog] = useState(false);
  const [editingProcess, setEditingProcess] = useState<Process | null>(null);
  const [viewingProcess, setViewingProcess] = useState<Process | null>(null);
  const [editingControl, setEditingControl] = useState<ProcessControl | null>(null);
  const [selectedControlForResult, setSelectedControlForResult] = useState<ProcessControl | null>(null);
  const [page, setPage] = useState(Math.max(0, pageParam - 1));
  const [rowsPerPage, setRowsPerPage] = useState(pageSizeParam);
  const [total, setTotal] = useState(0);
  const [categoryFilter, setCategoryFilter] = useState<string>((filterParam?.category as string) || '');
  const [activeFilter, setActiveFilter] = useState<string>((filterParam?.isActive as string) || '');
  const [sortField, setSortField] = useState(parsedSort.field);
  const [sortDirection, setSortDirection] = useState<'ASC' | 'DESC'>(parsedSort.direction);
  const [tabValue, setTabValue] = useState(0);

  const [processControls, setProcessControls] = useState<ProcessControl[]>([]);
  const [controlsLoading, setControlsLoading] = useState(false);
  const [complianceScores, setComplianceScores] = useState<Record<string, ComplianceScore>>({});
  const [availableEvidence, setAvailableEvidence] = useState<EvidenceData[]>([]);
  const [evidenceLoading, setEvidenceLoading] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    code: '',
    description: '',
    category: '',
    isActive: true,
  });

    const [controlFormData, setControlFormData] = useState({
      name: '',
      description: '',
      isAutomated: false,
      method: 'walkthrough',
      frequency: 'monthly',
      expectedResultType: 'boolean',
      isActive: true,
    });

  const [controlFormErrors, setControlFormErrors] = useState<{ name?: string }>({});

  const [resultFormData, setResultFormData] = useState({
    isCompliant: true,
    resultValueBoolean: true,
    resultValueNumber: 0,
    resultValueText: '',
    evidenceReference: '',
  });

  const tenantId = user?.tenantId || '';

  // Build filter object for API (canonical format)
  const buildFilter = useCallback(() => {
    const conditions: Array<Record<string, unknown>> = [];
    
    if (categoryFilter) {
      conditions.push({ field: 'category', operator: 'eq', value: categoryFilter });
    }
    if (activeFilter !== '') {
      conditions.push({ field: 'isActive', operator: 'eq', value: activeFilter === 'true' });
    }

    if (conditions.length === 0) {
      return null;
    }

    return { and: conditions };
  }, [categoryFilter, activeFilter]);

  // Update URL params when filters/sort/page change
  useEffect(() => {
    const filter = buildFilter();
    const sortStr = formatSortToQuery(sortField, sortDirection);
    
    const params = buildListQueryParamsWithDefaults(
      {
        page: page + 1,
        pageSize: rowsPerPage,
        filter,
        sort: sortStr !== DEFAULT_SORT ? sortStr : null,
      },
      {
        page: DEFAULT_PAGE,
        pageSize: DEFAULT_PAGE_SIZE,
        sort: DEFAULT_SORT,
        filter: null,
      }
    );

    setSearchParams(params, { replace: true });
  }, [page, rowsPerPage, categoryFilter, activeFilter, sortField, sortDirection, buildFilter, setSearchParams]);

  const fetchProcesses = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const filter = buildFilter();
      const params = buildListQueryParams({
        page: page + 1,
        pageSize: rowsPerPage,
        filter: filter || undefined,
        sort: { field: sortField, direction: sortDirection },
        category: categoryFilter || undefined,
        isActive: activeFilter !== '' ? activeFilter : undefined,
      });

      const response = await processApi.list(tenantId, params);
      const result = unwrapPaginatedResponse<Process>(response);
      setProcesses(result.items);
      setTotal(result.total);

      const scorePromises = result.items.map(async (process) => {
        try {
          const scoreResponse = await processApi.getComplianceScore(tenantId, process.id);
          const score = unwrapResponse<ComplianceScore>(scoreResponse);
          return { processId: process.id, score };
        } catch {
          return { processId: process.id, score: null };
        }
      });

      const scores = await Promise.all(scorePromises);
      const scoreMap: Record<string, ComplianceScore> = {};
      scores.forEach(({ processId, score }) => {
        if (score) {
          scoreMap[processId] = score;
        }
      });
      setComplianceScores(scoreMap);
    } catch (err: unknown) {
      const error = err as { response?: { status?: number; data?: { message?: string } } };
      const status = error.response?.status;
      const message = error.response?.data?.message;

      if (status === 401) {
        setError('Session expired. Please login again.');
      } else if (status === 403) {
        setError('You do not have permission to view processes.');
      } else if (status === 404 || status === 502) {
        setProcesses([]);
        setTotal(0);
        console.warn('Process management backend not available');
      } else {
        setError(message || 'Failed to fetch processes. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }, [tenantId, page, rowsPerPage, categoryFilter, activeFilter, sortField, sortDirection, buildFilter]);

  const fetchProcessControls = useCallback(async (processId: string) => {
    try {
      setControlsLoading(true);
      const response = await processControlApi.list(tenantId, buildListQueryParams({ processId }));
      const result = unwrapPaginatedResponse<ProcessControl>(response);
      setProcessControls(result.items);
    } catch (err) {
      console.error('Failed to fetch process controls:', err);
      setProcessControls([]);
    } finally {
      setControlsLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    fetchProcesses();
  }, [fetchProcesses]);

  const handleCreateProcess = () => {
    setEditingProcess(null);
    setFormData({
      name: '',
      code: '',
      description: '',
      category: '',
      isActive: true,
    });
    setOpenDialog(true);
  };

  const handleEditProcess = (process: Process) => {
    setEditingProcess(process);
    setFormData({
      name: process.name,
      code: process.code,
      description: process.description || '',
      category: process.category || '',
      isActive: process.isActive,
    });
    setOpenDialog(true);
  };

  const handleViewProcess = (process: Process) => {
    setViewingProcess(process);
    setOpenViewDialog(true);
    setTabValue(0);
    fetchProcessControls(process.id);
  };

  const handleSaveProcess = async () => {
    if (!tenantId) {
      setError('Tenant ID is required');
      return;
    }

    try {
      const processData = {
        name: formData.name,
        code: formData.code,
        description: formData.description || undefined,
        category: formData.category || undefined,
        isActive: formData.isActive,
      };

      if (editingProcess) {
        await processApi.update(tenantId, editingProcess.id, processData);
        setSuccess('Process updated successfully');
      } else {
        await processApi.create(tenantId, processData);
        setSuccess('Process created successfully');
      }

      setOpenDialog(false);
      setError('');
      fetchProcesses();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      setError(error.response?.data?.message || 'Failed to save process');
    }
  };

  const handleDeleteProcess = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this process?')) {
      try {
        await processApi.delete(tenantId, id);
        setSuccess('Process deleted successfully');
        fetchProcesses();
        setTimeout(() => setSuccess(''), 3000);
      } catch (err: unknown) {
        const error = err as { response?: { data?: { message?: string } } };
        setError(error.response?.data?.message || 'Failed to delete process');
      }
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
      setControlFormErrors({});
      setOpenControlDialog(true);
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
    setControlFormErrors({});
    setOpenControlDialog(true);
  };

  const handleSaveControl = async () => {
    if (!tenantId || !viewingProcess) {
      setError('Process context is required');
      return;
    }

    const errors: { name?: string } = {};
    if (!controlFormData.name.trim()) {
      errors.name = 'Control name is required';
    }
    if (Object.keys(errors).length > 0) {
      setControlFormErrors(errors);
      return;
    }
    setControlFormErrors({});

    try {
      const controlData = {
        processId: viewingProcess.id,
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

      setOpenControlDialog(false);
      fetchProcessControls(viewingProcess.id);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      setError(error.response?.data?.message || 'Failed to save control');
    }
  };

  const handleDeleteControl = async (controlId: string) => {
    if (window.confirm('Are you sure you want to delete this control?')) {
      try {
        await processControlApi.delete(tenantId, controlId);
        setSuccess('Control deleted successfully');
        if (viewingProcess) {
          fetchProcessControls(viewingProcess.id);
        }
        setTimeout(() => setSuccess(''), 3000);
      } catch (err: unknown) {
        const error = err as { response?: { data?: { message?: string } } };
        setError(error.response?.data?.message || 'Failed to delete control');
      }
    }
  };

  const fetchAvailableEvidence = useCallback(async () => {
    if (!tenantId) return;
    setEvidenceLoading(true);
    try {
      const response = await evidenceApi.list(tenantId, { pageSize: 100 });
      const data = unwrapPaginatedResponse<EvidenceData>(response);
      setAvailableEvidence(data.items || []);
    } catch (err) {
      console.error('Failed to fetch evidence:', err);
      setAvailableEvidence([]);
    } finally {
      setEvidenceLoading(false);
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
    setOpenResultDialog(true);
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
          : 'Control result recorded - Violation created automatically',
      );
      setOpenResultDialog(false);
      fetchProcesses();
      setTimeout(() => setSuccess(''), 5000);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      setError(error.response?.data?.message || 'Failed to record result');
    }
  };

  const handleChangePage = (_event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const getComplianceColor = (score: number): 'success' | 'warning' | 'error' => {
    if (score >= 0.8) return 'success';
    if (score >= 0.5) return 'warning';
    return 'error';
  };

  const formatComplianceScore = (score: number): string => {
    return `${Math.round(score * 100)}%`;
  };

  if (loading) {
    return <LoadingState message="Loading processes..." />;
  }

  if (error && processes.length === 0) {
    return (
      <ErrorState
        title="Failed to load processes"
        message={error}
        onRetry={fetchProcesses}
      />
    );
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">Process Management</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={handleCreateProcess}>
          New Process
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>
          {success}
        </Alert>
      )}

      <ListToolbar
        filters={[
          ...(categoryFilter ? [{ key: 'category', label: 'Category', value: categoryFilter }] : []),
          ...(activeFilter ? [{ key: 'isActive', label: 'Status', value: activeFilter === 'true' ? 'Active' : 'Inactive' }] : []),
        ]}
        onFilterRemove={(key) => {
          if (key === 'category') {
            setCategoryFilter('');
          } else if (key === 'isActive') {
            setActiveFilter('');
          }
          setPage(0);
        }}
        onClearFilters={() => {
          setCategoryFilter('');
          setActiveFilter('');
          setPage(0);
        }}
        sort={`${sortField}:${sortDirection}`}
        onSortChange={(sort: string) => {
          const [field, direction] = sort.split(':');
          setSortField(field);
          setSortDirection(direction as 'ASC' | 'DESC');
        }}
        sortOptions={[
          { field: 'createdAt', label: 'Created Date' },
          { field: 'updatedAt', label: 'Updated Date' },
          { field: 'name', label: 'Name' },
          { field: 'category', label: 'Category' },
        ]}
        onRefresh={() => fetchProcesses()}
        loading={loading}
      />

      <Card>
        <CardContent>
          <ResponsiveTable minWidth={900}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Code</TableCell>
                  <TableCell>Owner</TableCell>
                  <TableCell>Category</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Compliance</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {processes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center" sx={{ py: 0, border: 'none' }}>
                      <EmptyState
                        icon={<ProcessIcon sx={{ fontSize: 64, color: 'text.disabled' }} />}
                        title="No processes found"
                        message={
                          tenantId
                            ? 'Get started by creating your first business process.'
                            : 'Please select a tenant to view processes.'
                        }
                        actionLabel={tenantId ? 'Create Process' : undefined}
                        onAction={tenantId ? handleCreateProcess : undefined}
                        minHeight="200px"
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  processes.map((process) => (
                    <TableRow key={process.id} hover>
                      <TableCell>
                        <Typography variant="subtitle2">{process.name}</Typography>
                        {process.description && (
                          <Typography
                            variant="body2"
                            color="textSecondary"
                            noWrap
                            sx={{ maxWidth: 200 }}
                          >
                            {process.description}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Chip label={process.code} size="small" variant="outlined" />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="textSecondary">
                          {process.ownerUserId ? process.ownerUserId.substring(0, 8) + '...' : 'N/A'}
                        </Typography>
                      </TableCell>
                      <TableCell>{process.category || '-'}</TableCell>
                      <TableCell>
                        <Chip
                          label={process.isActive ? 'Active' : 'Inactive'}
                          color={process.isActive ? 'success' : 'default'}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        {complianceScores[process.id] ? (
                          <Tooltip
                            title={`${complianceScores[process.id].compliantResults}/${complianceScores[process.id].totalResults} compliant`}
                          >
                            <Chip
                              label={formatComplianceScore(
                                complianceScores[process.id].complianceScore,
                              )}
                              color={getComplianceColor(
                                complianceScores[process.id].complianceScore,
                              )}
                              size="small"
                            />
                          </Tooltip>
                        ) : (
                          <Chip label="N/A" size="small" variant="outlined" />
                        )}
                      </TableCell>
                      <TableCell>
                        <Tooltip title="View Details">
                          <IconButton size="small" onClick={() => handleViewProcess(process)}>
                            <ViewIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="View Violations">
                          <IconButton
                            size="small"
                            color="warning"
                            onClick={() => navigate(`/violations?processId=${process.id}`)}
                          >
                            <ViolationIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Edit">
                          <IconButton size="small" onClick={() => handleEditProcess(process)}>
                            <EditIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete">
                          <IconButton
                            size="small"
                            onClick={() => handleDeleteProcess(process.id)}
                          >
                            <DeleteIcon />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </ResponsiveTable>
          <TablePagination
            component="div"
            count={total}
            page={page}
            onPageChange={handleChangePage}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={handleChangeRowsPerPage}
            rowsPerPageOptions={[5, 10, 25, 50]}
          />
        </CardContent>
      </Card>

      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingProcess ? 'Edit Process' : 'Create Process'}</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="Name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              fullWidth
              required
            />
            <TextField
              label="Code"
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value })}
              fullWidth
              required
              helperText="Short code like CHG-MGMT"
            />
            <TextField
              label="Description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              fullWidth
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
                  <MenuItem key={cat} value={cat}>
                    {cat}
                  </MenuItem>
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
          <Button onClick={() => setOpenDialog(false)}>Cancel</Button>
          <Button onClick={handleSaveProcess} variant="contained" disabled={!formData.name || !formData.code}>
            {editingProcess ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={openViewDialog}
        onClose={() => setOpenViewDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {viewingProcess?.name}
          <Chip
            label={viewingProcess?.code}
            size="small"
            variant="outlined"
            sx={{ ml: 2 }}
          />
        </DialogTitle>
        <DialogContent>
          <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)} sx={{ mb: 2 }}>
            <Tab label="Details" />
            <Tab label="Controls" />
          </Tabs>

          {tabValue === 0 && viewingProcess && (
            <Box>
              <Typography variant="body1" paragraph>
                {viewingProcess.description || 'No description provided.'}
              </Typography>
              <Box display="flex" gap={2} flexWrap="wrap">
                <Chip
                  label={`Category: ${viewingProcess.category || 'None'}`}
                  variant="outlined"
                />
                <Chip
                  label={viewingProcess.isActive ? 'Active' : 'Inactive'}
                  color={viewingProcess.isActive ? 'success' : 'default'}
                />
                {complianceScores[viewingProcess.id] && (
                  <Chip
                    label={`Compliance: ${formatComplianceScore(complianceScores[viewingProcess.id].complianceScore)}`}
                    color={getComplianceColor(complianceScores[viewingProcess.id].complianceScore)}
                  />
                )}
              </Box>
            </Box>
          )}

          {tabValue === 1 && (
            <Box>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6">Process Controls</Typography>
                <Button
                  variant="outlined"
                  startIcon={<AddIcon />}
                  onClick={handleCreateControl}
                  size="small"
                >
                  Add Control
                </Button>
              </Box>

              {controlsLoading ? (
                <LinearProgress />
              ) : processControls.length === 0 ? (
                <Typography color="textSecondary">
                  No controls defined for this process.
                </Typography>
              ) : (
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Name</TableCell>
                      <TableCell>Automated</TableCell>
                      <TableCell>Method</TableCell>
                      <TableCell>Frequency</TableCell>
                      <TableCell>Expected Result</TableCell>
                      <TableCell>Owner</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {processControls.map((control) => (
                      <TableRow key={control.id}>
                        <TableCell>
                          <Typography variant="body2">{control.name}</Typography>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={control.isAutomated ? 'Yes' : 'No'}
                            size="small"
                            color={control.isAutomated ? 'info' : 'default'}
                            variant={control.isAutomated ? 'filled' : 'outlined'}
                          />
                        </TableCell>
                        <TableCell sx={{ textTransform: 'capitalize' }}>{control.method || '-'}</TableCell>
                        <TableCell sx={{ textTransform: 'capitalize' }}>{control.frequency?.replace('_', ' ') || '-'}</TableCell>
                        <TableCell sx={{ textTransform: 'capitalize' }}>{control.expectedResultType || '-'}</TableCell>
                        <TableCell>
                          <Typography variant="body2" color="textSecondary">
                            {control.ownerUserId ? control.ownerUserId.substring(0, 8) + '...' : 'N/A'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={control.isActive ? 'Active' : 'Inactive'}
                            color={control.isActive ? 'success' : 'default'}
                            size="small"
                          />
                        </TableCell>
                        <TableCell>
                          <Tooltip title="Record Result">
                            <IconButton
                              size="small"
                              onClick={() => handleRecordResult(control)}
                              color="primary"
                            >
                              <RecordIcon />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Edit">
                            <IconButton size="small" onClick={() => handleEditControl(control)}>
                              <EditIcon />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Delete">
                            <IconButton
                              size="small"
                              onClick={() => handleDeleteControl(control.id)}
                            >
                              <DeleteIcon />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenViewDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={openControlDialog}
        onClose={() => setOpenControlDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>{editingControl ? 'Edit Control' : 'Add Control'}</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="Name"
              value={controlFormData.name}
              onChange={(e) => {
                setControlFormData({ ...controlFormData, name: e.target.value });
                if (controlFormErrors.name && e.target.value.trim()) {
                  setControlFormErrors({});
                }
              }}
              fullWidth
              required
              error={!!controlFormErrors.name}
              helperText={controlFormErrors.name}
            />
            <TextField
              label="Description"
              value={controlFormData.description}
              onChange={(e) =>
                setControlFormData({ ...controlFormData, description: e.target.value })
              }
              fullWidth
              multiline
              rows={2}
            />
            <FormControl fullWidth>
              <InputLabel>Method</InputLabel>
              <Select
                value={controlFormData.method}
                label="Method"
                onChange={(e) =>
                  setControlFormData({ ...controlFormData, method: e.target.value })
                }
              >
                {CONTROL_METHODS.map((m) => (
                  <MenuItem key={m} value={m}>
                    {m}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel>Frequency</InputLabel>
              <Select
                value={controlFormData.frequency}
                label="Frequency"
                onChange={(e) =>
                  setControlFormData({ ...controlFormData, frequency: e.target.value })
                }
              >
                {CONTROL_FREQUENCIES.map((f) => (
                  <MenuItem key={f} value={f}>
                    {f.replace('_', ' ')}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel>Expected Result Type</InputLabel>
              <Select
                value={controlFormData.expectedResultType}
                label="Expected Result Type"
                onChange={(e) =>
                  setControlFormData({ ...controlFormData, expectedResultType: e.target.value })
                }
              >
                {RESULT_TYPES.map((t) => (
                  <MenuItem key={t} value={t}>
                    {t}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControlLabel
              control={
                <Switch
                  checked={controlFormData.isAutomated}
                  onChange={(e) =>
                    setControlFormData({ ...controlFormData, isAutomated: e.target.checked })
                  }
                />
              }
              label="Automated"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={controlFormData.isActive}
                  onChange={(e) =>
                    setControlFormData({ ...controlFormData, isActive: e.target.checked })
                  }
                />
              }
              label="Active"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenControlDialog(false)}>Cancel</Button>
          <Button
            onClick={handleSaveControl}
            variant="contained"
            disabled={!controlFormData.name}
          >
            {editingControl ? 'Update' : 'Add'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={openResultDialog}
        onClose={() => setOpenResultDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Record Control Result</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            {selectedControlForResult && (
              <Alert severity="info">
                Recording result for: <strong>{selectedControlForResult.name}</strong>
                <br />
                Expected type: {selectedControlForResult.expectedResultType}
              </Alert>
            )}

            <FormControlLabel
              control={
                <Switch
                  checked={resultFormData.isCompliant}
                  onChange={(e) =>
                    setResultFormData({ ...resultFormData, isCompliant: e.target.checked })
                  }
                />
              }
              label="Compliant"
            />

            {!resultFormData.isCompliant && (
              <Alert severity="warning">
                A violation will be automatically created for non-compliant results.
              </Alert>
            )}

            {selectedControlForResult?.expectedResultType === 'BOOLEAN' && (
              <FormControlLabel
                control={
                  <Switch
                    checked={resultFormData.resultValueBoolean}
                    onChange={(e) =>
                      setResultFormData({
                        ...resultFormData,
                        resultValueBoolean: e.target.checked,
                      })
                    }
                  />
                }
                label="Result Value (Pass/Fail)"
              />
            )}

            {selectedControlForResult?.expectedResultType === 'NUMERIC' && (
              <TextField
                label="Result Value (Number)"
                type="number"
                value={resultFormData.resultValueNumber}
                onChange={(e) =>
                  setResultFormData({
                    ...resultFormData,
                    resultValueNumber: parseFloat(e.target.value) || 0,
                  })
                }
                fullWidth
              />
            )}

            {selectedControlForResult?.expectedResultType === 'QUALITATIVE' && (
              <TextField
                label="Result Value (Text)"
                value={resultFormData.resultValueText}
                onChange={(e) =>
                  setResultFormData({ ...resultFormData, resultValueText: e.target.value })
                }
                fullWidth
                multiline
                rows={2}
              />
            )}

            <FormControl fullWidth>
              <InputLabel>Evidence Reference</InputLabel>
              <Select
                value={resultFormData.evidenceReference}
                label="Evidence Reference"
                onChange={(e) =>
                  setResultFormData({ ...resultFormData, evidenceReference: e.target.value })
                }
                disabled={evidenceLoading}
              >
                <MenuItem value="">
                  <em>None</em>
                </MenuItem>
                {availableEvidence.map((evidence) => (
                  <MenuItem key={evidence.id} value={evidence.id}>
                    {evidence.name} ({evidence.type})
                  </MenuItem>
                ))}
              </Select>
              {evidenceLoading && <LinearProgress sx={{ mt: 1 }} />}
              {!evidenceLoading && availableEvidence.length === 0 && (
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
                  No evidence records found. Create evidence first in the Evidence module.
                </Typography>
              )}
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenResultDialog(false)}>Cancel</Button>
          <Button onClick={handleSaveResult} variant="contained">
            Record Result
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ProcessManagement;
