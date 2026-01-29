import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
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
  Tooltip,
  Tabs,
  Tab,
  Switch,
  FormControlLabel,
  LinearProgress,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Alert,
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
import { buildListQueryParams } from '../utils';
import {
  GenericListPage,
  ColumnDefinition,
  FilterOption,
  FilterBuilderBasic,
  FilterTree,
  FilterConfig,
} from '../components/common';
import { useUniversalList } from '../hooks/useUniversalList';
import {
  parseListQuery,
  serializeFilterTree,
  countFilterConditions,
} from '../utils/listQueryUtils';

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

const PROCESS_FILTER_CONFIG: FilterConfig = {
  fields: [
    {
      name: 'name',
      label: 'Name',
      type: 'string',
    },
    {
      name: 'code',
      label: 'Code',
      type: 'string',
    },
    {
      name: 'description',
      label: 'Description',
      type: 'string',
    },
    {
      name: 'category',
      label: 'Category',
      type: 'enum',
      enumValues: [...PROCESS_CATEGORIES],
    },
    {
      name: 'isActive',
      label: 'Status',
      type: 'enum',
      enumValues: ['true', 'false'],
      enumLabels: {
        true: 'Active',
        false: 'Inactive',
      },
    },
    {
      name: 'createdAt',
      label: 'Created Date',
      type: 'date',
    },
    {
      name: 'updatedAt',
      label: 'Updated Date',
      type: 'date',
    },
  ],
  maxConditions: 10,
};

const getComplianceColor = (score: number): 'success' | 'warning' | 'error' => {
  if (score >= 0.8) return 'success';
  if (score >= 0.5) return 'warning';
  return 'error';
};

const formatComplianceScore = (score: number): string => {
  return `${Math.round(score * 100)}%`;
};

export const ProcessManagement: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const tenantId = user?.tenantId || '';

  const categoryFilter = searchParams.get('category') || '';
  const activeFilter = searchParams.get('isActive') || '';

  const parsedQuery = useMemo(() => parseListQuery(searchParams, {
    pageSize: 10,
    sort: 'createdAt:DESC',
  }), [searchParams]);

  const advancedFilter = parsedQuery.filterTree;

  const additionalFilters = useMemo(() => {
    const filters: Record<string, unknown> = {};
    if (categoryFilter) filters.category = categoryFilter;
    if (activeFilter) filters.isActive = activeFilter;
    if (advancedFilter) {
      const serialized = serializeFilterTree(advancedFilter);
      if (serialized) filters.filter = serialized;
    }
    return filters;
  }, [categoryFilter, activeFilter, advancedFilter]);

  const [complianceScores, setComplianceScores] = useState<Record<string, ComplianceScore>>({});

  const fetchProcesses = useCallback((params: Record<string, unknown>) => {
    const queryParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        queryParams.set(key, String(value));
      }
    });
    return processApi.list(tenantId, queryParams);
  }, [tenantId]);

  const isAuthReady = !authLoading && !!tenantId;

  const {
    items,
    total,
    page,
    pageSize,
    search,
    isLoading,
    error,
    setPage,
    setPageSize,
    setSearch,
    refetch,
  } = useUniversalList<Process>({
    fetchFn: fetchProcesses,
    defaultPageSize: 10,
    defaultSort: 'createdAt:DESC',
    syncToUrl: true,
    enabled: isAuthReady,
    additionalFilters,
  });

  // Fetch compliance scores for loaded processes
  useEffect(() => {
    const fetchScores = async () => {
      if (!tenantId || items.length === 0) return;
      
      const scorePromises = items.map(async (process) => {
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
    };

    fetchScores();
  }, [tenantId, items]);

  const [openDialog, setOpenDialog] = useState(false);
  const [openViewDialog, setOpenViewDialog] = useState(false);
  const [openControlDialog, setOpenControlDialog] = useState(false);
  const [openResultDialog, setOpenResultDialog] = useState(false);
  const [editingProcess, setEditingProcess] = useState<Process | null>(null);
  const [viewingProcess, setViewingProcess] = useState<Process | null>(null);
  const [editingControl, setEditingControl] = useState<ProcessControl | null>(null);
  const [selectedControlForResult, setSelectedControlForResult] = useState<ProcessControl | null>(null);
  const [tabValue, setTabValue] = useState(0);
  const [processControls, setProcessControls] = useState<ProcessControl[]>([]);
  const [controlsLoading, setControlsLoading] = useState(false);
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

  const handleViewProcess = useCallback((process: Process) => {
    navigate(`/processes/${process.id}`);
  }, [navigate]);

  const handleCreateProcess = useCallback(() => {
    setEditingProcess(null);
    setFormData({
      name: '',
      code: '',
      description: '',
      category: '',
      isActive: true,
    });
    setOpenDialog(true);
  }, []);

  const handleEditProcess = useCallback((process: Process) => {
    setEditingProcess(process);
    setFormData({
      name: process.name,
      code: process.code,
      description: process.description || '',
      category: process.category || '',
      isActive: process.isActive,
    });
    setOpenDialog(true);
  }, []);

  const handleSaveProcess = useCallback(async () => {
    if (!tenantId) return;

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
      } else {
        await processApi.create(tenantId, processData);
      }

      setOpenDialog(false);
      refetch();
    } catch (err) {
      console.error('Failed to save process:', err);
    }
  }, [tenantId, formData, editingProcess, refetch]);

  const handleDeleteProcess = useCallback(async (id: string) => {
    if (window.confirm('Are you sure you want to delete this process?')) {
      try {
        await processApi.delete(tenantId, id);
        refetch();
      } catch (err) {
        console.error('Failed to delete process:', err);
      }
    }
  }, [tenantId, refetch]);

  const handleCreateControl = useCallback(() => {
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
  }, []);

  const handleEditControl = useCallback((control: ProcessControl) => {
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
  }, []);

  const handleSaveControl = useCallback(async () => {
    if (!tenantId || !viewingProcess) return;

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
      } else {
        await processControlApi.create(tenantId, controlData);
      }

      setOpenControlDialog(false);
      fetchProcessControls(viewingProcess.id);
    } catch (err) {
      console.error('Failed to save control:', err);
    }
  }, [tenantId, viewingProcess, controlFormData, editingControl, fetchProcessControls]);

  const handleDeleteControl = useCallback(async (controlId: string) => {
    if (window.confirm('Are you sure you want to delete this control?')) {
      try {
        await processControlApi.delete(tenantId, controlId);
        if (viewingProcess) {
          fetchProcessControls(viewingProcess.id);
        }
      } catch (err) {
        console.error('Failed to delete control:', err);
      }
    }
  }, [tenantId, viewingProcess, fetchProcessControls]);

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

  const handleRecordResult = useCallback((control: ProcessControl) => {
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
  }, [fetchAvailableEvidence]);

  const handleSaveResult = useCallback(async () => {
    if (!tenantId || !selectedControlForResult) return;

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
      setOpenResultDialog(false);
      refetch();
    } catch (err) {
      console.error('Failed to record result:', err);
    }
  }, [tenantId, selectedControlForResult, resultFormData, refetch]);

  const updateFilter = useCallback((key: string, value: string) => {
    const newParams = new URLSearchParams(searchParams);
    if (value === '') {
      newParams.delete(key);
    } else {
      newParams.set(key, value);
    }
    newParams.set('page', '1');
    setSearchParams(newParams, { replace: true });
  }, [searchParams, setSearchParams]);

  const handleCategoryChange = useCallback((value: string) => {
    updateFilter('category', value);
  }, [updateFilter]);

  const handleActiveChange = useCallback((value: string) => {
    updateFilter('isActive', value);
  }, [updateFilter]);

  const getActiveFilters = useCallback((): FilterOption[] => {
    const filters: FilterOption[] = [];
    if (categoryFilter) {
      filters.push({ key: 'category', label: 'Category', value: categoryFilter });
    }
    if (activeFilter) {
      filters.push({ key: 'isActive', label: 'Status', value: activeFilter === 'true' ? 'Active' : 'Inactive' });
    }
    return filters;
  }, [categoryFilter, activeFilter]);

  const handleFilterRemove = useCallback((key: string) => {
    const newParams = new URLSearchParams(searchParams);
    newParams.delete(key);
    newParams.set('page', '1');
    setSearchParams(newParams, { replace: true });
  }, [searchParams, setSearchParams]);

  const handleClearFilters = useCallback(() => {
    const newParams = new URLSearchParams();
    const currentSearch = searchParams.get('search');
    const currentSort = searchParams.get('sort');
    const currentPageSize = searchParams.get('pageSize');
    if (currentSearch) newParams.set('search', currentSearch);
    if (currentSort) newParams.set('sort', currentSort);
    if (currentPageSize) newParams.set('pageSize', currentPageSize);
    newParams.set('page', '1');
    setSearchParams(newParams, { replace: true });
  }, [searchParams, setSearchParams]);

  const handleAdvancedFilterApply = useCallback((filter: FilterTree | null) => {
    const newParams = new URLSearchParams(searchParams);
    if (filter) {
      const serialized = serializeFilterTree(filter);
      if (serialized) {
        newParams.set('filter', serialized);
      }
    } else {
      newParams.delete('filter');
    }
    newParams.set('page', '1');
    setSearchParams(newParams, { replace: true });
  }, [searchParams, setSearchParams]);

  const handleAdvancedFilterClear = useCallback(() => {
    const newParams = new URLSearchParams(searchParams);
    newParams.delete('filter');
    newParams.set('page', '1');
    setSearchParams(newParams, { replace: true });
  }, [searchParams, setSearchParams]);

  const activeAdvancedFilterCount = advancedFilter ? countFilterConditions(advancedFilter) : 0;

  const columns: ColumnDefinition<Process>[] = useMemo(() => [
    {
      key: 'name',
      header: 'Name',
      render: (process) => (
        <Box>
          <Typography
            variant="body2"
            fontWeight="medium"
            component="span"
            onClick={() => handleViewProcess(process)}
            sx={{
              color: 'primary.main',
              cursor: 'pointer',
              '&:hover': {
                textDecoration: 'underline',
                color: 'primary.dark',
              },
            }}
          >
            {process.name}
          </Typography>
          {process.description && (
            <Typography variant="body2" color="textSecondary" noWrap sx={{ maxWidth: 200, mt: 0.5 }}>
              {process.description}
            </Typography>
          )}
        </Box>
      ),
    },
    {
      key: 'code',
      header: 'Code',
      render: (process) => <Chip label={process.code} size="small" variant="outlined" />,
    },
    {
      key: 'owner',
      header: 'Owner',
      render: (process) => (
        <Typography variant="body2" color="textSecondary">
          {process.ownerUserId ? process.ownerUserId.substring(0, 8) + '...' : 'N/A'}
        </Typography>
      ),
    },
    {
      key: 'category',
      header: 'Category',
      render: (process) => process.category || '-',
    },
    {
      key: 'status',
      header: 'Status',
      render: (process) => (
        <Chip
          label={process.isActive ? 'Active' : 'Inactive'}
          color={process.isActive ? 'success' : 'default'}
          size="small"
        />
      ),
    },
    {
      key: 'compliance',
      header: 'Compliance',
      render: (process) => (
        complianceScores[process.id] ? (
          <Tooltip
            title={`${complianceScores[process.id].compliantResults}/${complianceScores[process.id].totalResults} compliant`}
          >
            <Chip
              label={formatComplianceScore(complianceScores[process.id].complianceScore)}
              color={getComplianceColor(complianceScores[process.id].complianceScore)}
              size="small"
            />
          </Tooltip>
        ) : (
          <Chip label="N/A" size="small" variant="outlined" />
        )
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (process) => (
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <Tooltip title="View Details">
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                handleViewProcess(process);
              }}
            >
              <ViewIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="View Violations">
            <IconButton
              size="small"
              color="warning"
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/violations?processId=${process.id}`);
              }}
            >
              <ViolationIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Edit">
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                handleEditProcess(process);
              }}
            >
              <EditIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Delete">
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                handleDeleteProcess(process.id);
              }}
            >
              <DeleteIcon />
            </IconButton>
          </Tooltip>
        </Box>
      ),
    },
  ], [handleViewProcess, handleEditProcess, handleDeleteProcess, complianceScores, navigate]);

  const toolbarActions = useMemo(() => (
    <Box display="flex" gap={1} alignItems="center">
      <FilterBuilderBasic
        config={PROCESS_FILTER_CONFIG}
        initialFilter={advancedFilter}
        onApply={handleAdvancedFilterApply}
        onClear={handleAdvancedFilterClear}
        activeFilterCount={activeAdvancedFilterCount}
      />
      <FormControl size="small" sx={{ minWidth: 120 }}>
        <InputLabel>Category</InputLabel>
        <Select
          value={categoryFilter}
          label="Category"
          onChange={(e) => handleCategoryChange(e.target.value)}
        >
          <MenuItem value="">All</MenuItem>
          {PROCESS_CATEGORIES.map((cat) => (
            <MenuItem key={cat} value={cat}>{cat}</MenuItem>
          ))}
        </Select>
      </FormControl>
      <FormControl size="small" sx={{ minWidth: 100 }}>
        <InputLabel>Status</InputLabel>
        <Select
          value={activeFilter}
          label="Status"
          onChange={(e) => handleActiveChange(e.target.value)}
        >
          <MenuItem value="">All</MenuItem>
          <MenuItem value="true">Active</MenuItem>
          <MenuItem value="false">Inactive</MenuItem>
        </Select>
      </FormControl>
    </Box>
  ), [categoryFilter, activeFilter, handleCategoryChange, handleActiveChange, advancedFilter, handleAdvancedFilterApply, handleAdvancedFilterClear, activeAdvancedFilterCount]);

  return (
    <>
      <GenericListPage<Process>
        title="Process Management"
        icon={<ProcessIcon />}
        items={items}
        columns={columns}
        total={total}
        page={page}
        pageSize={pageSize}
        isLoading={isLoading || authLoading}
        error={error}
        search={search}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        onSearchChange={setSearch}
        onRefresh={refetch}
        getRowKey={(process) => process.id}
        onRowClick={handleViewProcess}
        searchPlaceholder="Search processes..."
        emptyMessage="No processes found"
        emptyFilteredMessage="Get started by creating your first business process."
        filters={getActiveFilters()}
        onFilterRemove={handleFilterRemove}
        onClearFilters={handleClearFilters}
        toolbarActions={toolbarActions}
        headerActions={(
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleCreateProcess}
          >
            New Process
          </Button>
        )}
        minTableWidth={900}
        testId="process-list-page"
      />

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
    </>
  );
};

export default ProcessManagement;
