import React, { useState, useCallback, useMemo } from 'react';
import {
  Box,
  Chip,
  IconButton,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Grid,
  Button,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon,
  AccountBalance as PolicyIcon,
  History as HistoryIcon,
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFnsV3';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { policyApi, unwrapPaginatedPolicyResponse } from '../services/grcClient';
import { useAuth } from '../contexts/AuthContext';
import {
  GenericListPage,
  ColumnDefinition,
  FilterOption,
  FilterBuilderBasic,
  FilterTree,
  FilterConfig,
} from '../components/common';
import { PolicyVersionsTab } from '../components/PolicyVersionsTab';
import { useUniversalList } from '../hooks/useUniversalList';
import {
  parseListQuery,
  serializeFilterTree,
  countFilterConditions,
} from '../utils/listQueryUtils';

interface Policy {
  id: number;
  title: string;
  description: string;
  category: string;
  version: string;
  status: string;
  effective_date: string;
  review_date: string;
  owner_first_name: string;
  owner_last_name: string;
  created_at: string;
}

const POLICY_STATUS_VALUES = ['draft', 'active', 'archived'] as const;

const POLICY_FILTER_CONFIG: FilterConfig = {
  fields: [
    {
      name: 'title',
      label: 'Title',
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
      type: 'string',
    },
    {
      name: 'version',
      label: 'Version',
      type: 'string',
    },
    {
      name: 'status',
      label: 'Status',
      type: 'enum',
      enumValues: [...POLICY_STATUS_VALUES],
      enumLabels: {
        draft: 'Draft',
        active: 'Active',
        archived: 'Archived',
      },
    },
    {
      name: 'effective_date',
      label: 'Effective Date',
      type: 'date',
    },
    {
      name: 'review_date',
      label: 'Review Date',
      type: 'date',
    },
    {
      name: 'created_at',
      label: 'Created Date',
      type: 'date',
    },
  ],
  maxConditions: 10,
};

const getStatusColor = (status: string): 'error' | 'warning' | 'info' | 'success' | 'default' => {
  switch (status) {
    case 'active': return 'success';
    case 'draft': return 'warning';
    case 'archived': return 'default';
    default: return 'default';
  }
};

const formatStatus = (status: string): string => {
  return status.charAt(0).toUpperCase() + status.slice(1);
};

const formatDate = (dateString: string | null): string => {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleDateString();
};

export const Governance: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const tenantId = user?.tenantId || '';

  const statusFilter = searchParams.get('status') || '';

  const parsedQuery = useMemo(() => parseListQuery(searchParams, {
    pageSize: 10,
    sort: 'created_at:DESC',
  }), [searchParams]);

  const advancedFilter = parsedQuery.filterTree;

  const additionalFilters = useMemo(() => {
    const filters: Record<string, unknown> = {};
    if (statusFilter) filters.status = statusFilter;
    if (advancedFilter) {
      const serialized = serializeFilterTree(advancedFilter);
      if (serialized) filters.filter = serialized;
    }
    return filters;
  }, [statusFilter, advancedFilter]);

  const fetchPolicies = useCallback(async (params: Record<string, unknown>) => {
    const response = await policyApi.list(tenantId, params);
    return unwrapPaginatedPolicyResponse<Policy>(response);
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
  } = useUniversalList<Policy>({
    fetchFn: fetchPolicies,
    defaultPageSize: 10,
    defaultSort: 'created_at:DESC',
    syncToUrl: true,
    enabled: isAuthReady,
    additionalFilters,
  });

  const [openDialog, setOpenDialog] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<Policy | null>(null);
  const [openVersionsDialog, setOpenVersionsDialog] = useState(false);
  const [selectedPolicyForVersions, setSelectedPolicyForVersions] = useState<Policy | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: '',
    version: '1.0',
    status: 'draft',
    effectiveDate: null as Date | null,
    reviewDate: null as Date | null,
    content: '',
  });

  const handleViewPolicy = useCallback((policy: Policy) => {
    navigate(`/policies/${policy.id}`);
  }, [navigate]);

  const handleCreatePolicy = useCallback(() => {
    navigate('/policies/new');
  }, [navigate]);

  const handleEditPolicy = useCallback((policy: Policy) => {
    setEditingPolicy(policy);
    setFormData({
      title: policy.title,
      description: policy.description || '',
      category: policy.category || '',
      version: policy.version,
      status: policy.status,
      effectiveDate: policy.effective_date ? new Date(policy.effective_date) : null,
      reviewDate: policy.review_date ? new Date(policy.review_date) : null,
      content: '',
    });
    setOpenDialog(true);
  }, []);

  const handleSavePolicy = useCallback(async () => {
    try {
      const policyData = {
        name: formData.title,
        summary: formData.description,
        category: formData.category,
        version: formData.version,
        status: formData.status,
        effectiveDate: formData.effectiveDate?.toISOString().split('T')[0],
        reviewDate: formData.reviewDate?.toISOString().split('T')[0],
        content: formData.content,
      };

      if (editingPolicy) {
        await policyApi.update(tenantId, String(editingPolicy.id), policyData);
      } else {
        await policyApi.create(tenantId, policyData);
      }

      setOpenDialog(false);
      refetch();
    } catch (err) {
      console.error('Failed to save policy:', err);
    }
  }, [formData, editingPolicy, tenantId, refetch]);

  const handleDeletePolicy = useCallback(async (id: number) => {
    if (window.confirm('Are you sure you want to delete this policy?')) {
      try {
        await policyApi.delete(tenantId, String(id));
        refetch();
      } catch (err) {
        console.error('Failed to delete policy:', err);
      }
    }
  }, [tenantId, refetch]);

  const handleViewVersions = useCallback((policy: Policy) => {
    setSelectedPolicyForVersions(policy);
    setOpenVersionsDialog(true);
  }, []);

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

  const handleStatusChange = useCallback((value: string) => {
    updateFilter('status', value);
  }, [updateFilter]);

  const getActiveFilters = useCallback((): FilterOption[] => {
    const filters: FilterOption[] = [];
    if (statusFilter) {
      filters.push({ key: 'status', label: 'Status', value: formatStatus(statusFilter) });
    }
    return filters;
  }, [statusFilter]);

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

  const columns: ColumnDefinition<Policy>[] = useMemo(() => [
    {
      key: 'title',
      header: 'Title',
      render: (policy) => (
        <Box>
          <Typography
            variant="body2"
            fontWeight="medium"
            component="span"
            onClick={() => handleViewPolicy(policy)}
            sx={{
              color: 'primary.main',
              cursor: 'pointer',
              '&:hover': {
                textDecoration: 'underline',
                color: 'primary.dark',
              },
            }}
          >
            {policy.title}
          </Typography>
          {policy.description && (
            <Typography variant="body2" color="textSecondary" sx={{ mt: 0.5 }}>
              {policy.description}
            </Typography>
          )}
        </Box>
      ),
    },
    {
      key: 'category',
      header: 'Category',
      render: (policy) => policy.category || '-',
    },
    {
      key: 'version',
      header: 'Version',
      render: (policy) => policy.version || '-',
    },
    {
      key: 'status',
      header: 'Status',
      render: (policy) => (
        <Chip
          label={formatStatus(policy.status)}
          size="small"
          color={getStatusColor(policy.status)}
        />
      ),
    },
    {
      key: 'owner',
      header: 'Owner',
      render: (policy) => (
        policy.owner_first_name || policy.owner_last_name
          ? `${policy.owner_first_name || ''} ${policy.owner_last_name || ''}`.trim()
          : '-'
      ),
    },
    {
      key: 'effective_date',
      header: 'Effective Date',
      render: (policy) => formatDate(policy.effective_date),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (policy) => (
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <Tooltip title="View Details">
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                handleViewPolicy(policy);
              }}
            >
              <ViewIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Version History">
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                handleViewVersions(policy);
              }}
            >
              <HistoryIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Edit">
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                handleEditPolicy(policy);
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
                handleDeletePolicy(policy.id);
              }}
            >
              <DeleteIcon />
            </IconButton>
          </Tooltip>
        </Box>
      ),
    },
  ], [handleViewPolicy, handleViewVersions, handleEditPolicy, handleDeletePolicy]);

  const toolbarActions = useMemo(() => (
    <Box display="flex" gap={1} alignItems="center">
      <FilterBuilderBasic
        config={POLICY_FILTER_CONFIG}
        initialFilter={advancedFilter}
        onApply={handleAdvancedFilterApply}
        onClear={handleAdvancedFilterClear}
        activeFilterCount={activeAdvancedFilterCount}
      />
      <FormControl size="small" sx={{ minWidth: 120 }}>
        <InputLabel>Status</InputLabel>
        <Select
          value={statusFilter}
          label="Status"
          onChange={(e) => handleStatusChange(e.target.value)}
        >
          <MenuItem value="">All</MenuItem>
          <MenuItem value="draft">Draft</MenuItem>
          <MenuItem value="active">Active</MenuItem>
          <MenuItem value="archived">Archived</MenuItem>
        </Select>
      </FormControl>
    </Box>
  ), [statusFilter, handleStatusChange, advancedFilter, handleAdvancedFilterApply, handleAdvancedFilterClear, activeAdvancedFilterCount]);

  return (
    <>
      <GenericListPage<Policy>
        title="Governance Management"
        icon={<PolicyIcon />}
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
        getRowKey={(policy) => String(policy.id)}
        onRowClick={handleViewPolicy}
        searchPlaceholder="Search policies..."
        emptyMessage="No policies found"
        emptyFilteredMessage="Try adjusting your filters or search query"
        filters={getActiveFilters()}
        onFilterRemove={handleFilterRemove}
        onClearFilters={handleClearFilters}
        toolbarActions={toolbarActions}
        createButtonLabel="New Policy"
        onCreateClick={handleCreatePolicy}
        minTableWidth={900}
        testId="governance-list-page"
      />

      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          {editingPolicy ? 'Edit Policy' : 'Create New Policy'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                required
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Description"
                multiline
                rows={3}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Category"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Version"
                value={formData.version}
                onChange={(e) => setFormData({ ...formData, version: e.target.value })}
              />
            </Grid>
            <Grid item xs={6}>
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  value={formData.status}
                  label="Status"
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                >
                  <MenuItem value="draft">Draft</MenuItem>
                  <MenuItem value="active">Active</MenuItem>
                  <MenuItem value="archived">Archived</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Content"
                multiline
                rows={4}
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              />
            </Grid>
            <Grid item xs={6}>
              <LocalizationProvider dateAdapter={AdapterDateFns}>
                <DatePicker
                  label="Effective Date"
                  value={formData.effectiveDate}
                  onChange={(newValue: Date | null) =>
                    setFormData({ ...formData, effectiveDate: newValue })
                  }
                  slotProps={{
                    textField: { fullWidth: true },
                  }}
                />
              </LocalizationProvider>
            </Grid>
            <Grid item xs={6}>
              <LocalizationProvider dateAdapter={AdapterDateFns}>
                <DatePicker
                  label="Review Date"
                  value={formData.reviewDate}
                  onChange={(newValue: Date | null) =>
                    setFormData({ ...formData, reviewDate: newValue })
                  }
                  slotProps={{
                    textField: { fullWidth: true },
                  }}
                />
              </LocalizationProvider>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>Cancel</Button>
          <Button onClick={handleSavePolicy} variant="contained">
            {editingPolicy ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={openVersionsDialog}
        onClose={() => setOpenVersionsDialog(false)}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>Policy Version History</DialogTitle>
        <DialogContent>
          {selectedPolicyForVersions && (
            <PolicyVersionsTab
              policyId={String(selectedPolicyForVersions.id)}
              policyTitle={selectedPolicyForVersions.title}
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenVersionsDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </>
  );
};
