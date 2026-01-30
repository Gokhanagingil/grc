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
  Switch,
  FormControlLabel,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon,
  AccountTree as ProcessIcon,
  Warning as ViolationIcon,
} from '@mui/icons-material';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  processApi,
  unwrapResponse,
} from '../services/grcClient';
import { useAuth } from '../contexts/AuthContext';
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

interface ComplianceScore {
  processId: string;
  processName: string;
  complianceScore: number;
  totalResults: number;
  compliantResults: number;
  nonCompliantResults: number;
}

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
  const [editingProcess, setEditingProcess] = useState<Process | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    code: '',
    description: '',
    category: '',
    isActive: true,
  });

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
    </>
  );
};

export default ProcessManagement;
