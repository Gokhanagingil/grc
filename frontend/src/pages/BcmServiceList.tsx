import React, { useCallback, useMemo, useState } from 'react';
import {
  Box,
  Chip,
  IconButton,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Tooltip,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
} from '@mui/material';
import {
  Visibility as ViewIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Business as BcmIcon,
} from '@mui/icons-material';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  bcmApi,
  BcmServiceData,
  CreateBcmServiceDto,
  BcmServiceStatus,
  BcmCriticalityTier,
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
import { GrcFrameworkWarningBanner } from '../components/onboarding';
import { useUniversalList } from '../hooks/useUniversalList';
import {
  parseListQuery,
  serializeFilterTree,
  countFilterConditions,
} from '../utils/listQueryUtils';

const BCM_SERVICE_STATUS_VALUES: BcmServiceStatus[] = ['DRAFT', 'ACTIVE', 'ARCHIVED'];
const BCM_CRITICALITY_TIER_VALUES: BcmCriticalityTier[] = ['TIER_0', 'TIER_1', 'TIER_2', 'TIER_3'];

const getStatusColor = (status: string): 'error' | 'warning' | 'info' | 'success' | 'default' => {
  switch (status) {
    case 'DRAFT': return 'info';
    case 'ACTIVE': return 'success';
    case 'ARCHIVED': return 'default';
    default: return 'default';
  }
};

const getTierColor = (tier: string | null): 'error' | 'warning' | 'info' | 'success' | 'default' => {
  switch (tier) {
    case 'TIER_0': return 'error';
    case 'TIER_1': return 'warning';
    case 'TIER_2': return 'info';
    case 'TIER_3': return 'success';
    default: return 'default';
  }
};

const formatStatus = (status: string): string => {
  return status.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
};

const formatTier = (tier: string | null): string => {
  if (!tier) return '-';
  switch (tier) {
    case 'TIER_0': return 'Critical (Tier 0)';
    case 'TIER_1': return 'High (Tier 1)';
    case 'TIER_2': return 'Medium (Tier 2)';
    case 'TIER_3': return 'Low (Tier 3)';
    default: return tier;
  }
};

const formatDate = (dateString: string | null | undefined): string => {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleDateString();
};

const BCM_SERVICE_FILTER_CONFIG: FilterConfig = {
  fields: [
    {
      name: 'name',
      label: 'Name',
      type: 'string',
    },
    {
      name: 'status',
      label: 'Status',
      type: 'enum',
      enumValues: BCM_SERVICE_STATUS_VALUES,
      enumLabels: {
        DRAFT: 'Draft',
        ACTIVE: 'Active',
        ARCHIVED: 'Archived',
      },
    },
    {
      name: 'criticalityTier',
      label: 'Criticality Tier',
      type: 'enum',
      enumValues: BCM_CRITICALITY_TIER_VALUES,
      enumLabels: {
        TIER_0: 'Critical (Tier 0)',
        TIER_1: 'High (Tier 1)',
        TIER_2: 'Medium (Tier 2)',
        TIER_3: 'Low (Tier 3)',
      },
    },
    {
      name: 'createdAt',
      label: 'Created At',
      type: 'date',
    },
  ],
  maxConditions: 10,
};

export const BcmServiceList: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newService, setNewService] = useState<CreateBcmServiceDto>({
    name: '',
    description: '',
    status: 'DRAFT',
  });

  const tenantId = user?.tenantId || '';

  const statusFilter = searchParams.get('status') || '';
  const criticalityTierFilter = searchParams.get('criticalityTier') || '';

  const parsedQuery = useMemo(() => parseListQuery(searchParams, {
    pageSize: 10,
    sort: 'createdAt:DESC',
  }), [searchParams]);

  const advancedFilter = parsedQuery.filterTree;

  const additionalFilters = useMemo(() => {
    const filters: Record<string, unknown> = {};
    if (statusFilter) filters.status = statusFilter;
    if (criticalityTierFilter) filters.criticalityTier = criticalityTierFilter;
    if (advancedFilter) {
      const serialized = serializeFilterTree(advancedFilter);
      if (serialized) filters.filter = serialized;
    }
    return filters;
  }, [statusFilter, criticalityTierFilter, advancedFilter]);

  const fetchServices = useCallback((params: Record<string, unknown>) => {
    return bcmApi.listServices(tenantId, params);
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
  } = useUniversalList<BcmServiceData>({
    fetchFn: fetchServices,
    defaultPageSize: 10,
    defaultSort: 'createdAt:DESC',
    syncToUrl: true,
    enabled: isAuthReady,
    additionalFilters,
  });

  const handleViewService = useCallback((service: BcmServiceData) => {
    navigate(`/bcm/services/${service.id}`);
  }, [navigate]);

  const handleDeleteService = useCallback(async (service: BcmServiceData) => {
    if (window.confirm(`Are you sure you want to delete "${service.name}"?`)) {
      try {
        await bcmApi.deleteService(tenantId, service.id);
        refetch();
      } catch (err) {
        console.error('Failed to delete BCM Service:', err);
      }
    }
  }, [tenantId, refetch]);

  const [createError, setCreateError] = useState<string | null>(null);

  const handleCreateService = useCallback(async () => {
    if (!newService.name) {
      setCreateError('Name is required');
      return;
    }
    setCreateError(null);
    try {
      const created = await bcmApi.createService(tenantId, newService);
      setCreateDialogOpen(false);
      setNewService({
        name: '',
        description: '',
        status: 'DRAFT',
      });
      navigate(`/bcm/services/${created.id}`);
    } catch (err: unknown) {
      console.error('Failed to create BCM Service:', err);
      const error = err as { response?: { data?: { message?: string; fieldErrors?: Record<string, string[]> } } };
      if (error.response?.data?.fieldErrors) {
        const fieldErrors = error.response.data.fieldErrors;
        const errorMessages = Object.entries(fieldErrors)
          .map(([field, messages]) => `${field}: ${messages.join(', ')}`)
          .join('; ');
        setCreateError(errorMessages);
      } else if (error.response?.data?.message) {
        setCreateError(error.response.data.message);
      } else {
        setCreateError('Failed to create BCM Service. Please try again.');
      }
    }
  }, [tenantId, newService, navigate]);

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

  const handleCriticalityTierChange = useCallback((value: string) => {
    updateFilter('criticalityTier', value);
  }, [updateFilter]);

  const getActiveFilters = useCallback((): FilterOption[] => {
    const filters: FilterOption[] = [];
    if (statusFilter) {
      filters.push({ key: 'status', label: 'Status', value: formatStatus(statusFilter) });
    }
    if (criticalityTierFilter) {
      filters.push({ key: 'criticalityTier', label: 'Criticality', value: formatTier(criticalityTierFilter) });
    }
    return filters;
  }, [statusFilter, criticalityTierFilter]);

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

  const columns: ColumnDefinition<BcmServiceData>[] = useMemo(() => [
    {
      key: 'name',
      header: 'Name',
      render: (service) => (
        <Tooltip title={service.description || ''}>
          <Typography
            variant="body2"
            component="span"
            onClick={() => handleViewService(service)}
            sx={{
              maxWidth: 250,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              color: 'primary.main',
              cursor: 'pointer',
              '&:hover': {
                textDecoration: 'underline',
                color: 'primary.dark',
              },
              fontWeight: 500,
            }}
          >
            {service.name}
          </Typography>
        </Tooltip>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (service) => (
        <Chip
          label={formatStatus(service.status)}
          size="small"
          color={getStatusColor(service.status)}
        />
      ),
    },
    {
      key: 'criticalityTier',
      header: 'Criticality',
      render: (service) => (
        service.criticalityTier ? (
          <Chip
            label={formatTier(service.criticalityTier)}
            size="small"
            color={getTierColor(service.criticalityTier)}
          />
        ) : (
          <Typography variant="body2" color="text.secondary">-</Typography>
        )
      ),
    },
    {
      key: 'tags',
      header: 'Tags',
      render: (service) => (
        <Box display="flex" gap={0.5} flexWrap="wrap">
          {service.tags && service.tags.length > 0 ? (
            service.tags.slice(0, 3).map((tag, index) => (
              <Chip key={index} label={tag} size="small" variant="outlined" />
            ))
          ) : (
            <Typography variant="body2" color="text.secondary">-</Typography>
          )}
          {service.tags && service.tags.length > 3 && (
            <Chip label={`+${service.tags.length - 3}`} size="small" variant="outlined" />
          )}
        </Box>
      ),
    },
    {
      key: 'createdAt',
      header: 'Created',
      render: (service) => formatDate(service.createdAt),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (service) => (
        <Box display="flex" gap={0.5}>
          <Tooltip title="View Details">
            <IconButton
              size="small"
              onClick={() => handleViewService(service)}
              data-testid={`view-bcm-service-${service.id}`}
            >
              <ViewIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Delete">
            <IconButton
              size="small"
              onClick={() => handleDeleteService(service)}
              color="error"
              data-testid={`delete-bcm-service-${service.id}`}
            >
              <DeleteIcon />
            </IconButton>
          </Tooltip>
        </Box>
      ),
    },
  ], [handleViewService, handleDeleteService]);

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

  const toolbarActions = useMemo(() => (
    <Box display="flex" gap={1} alignItems="center">
      <FilterBuilderBasic
        config={BCM_SERVICE_FILTER_CONFIG}
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
          data-testid="bcm-service-status-filter"
        >
          <MenuItem value="">All</MenuItem>
          {BCM_SERVICE_STATUS_VALUES.map((status) => (
            <MenuItem key={status} value={status}>{formatStatus(status)}</MenuItem>
          ))}
        </Select>
      </FormControl>
      <FormControl size="small" sx={{ minWidth: 150 }}>
        <InputLabel>Criticality</InputLabel>
        <Select
          value={criticalityTierFilter}
          label="Criticality"
          onChange={(e) => handleCriticalityTierChange(e.target.value)}
          data-testid="bcm-service-criticality-filter"
        >
          <MenuItem value="">All</MenuItem>
          {BCM_CRITICALITY_TIER_VALUES.map((tier) => (
            <MenuItem key={tier} value={tier}>{formatTier(tier)}</MenuItem>
          ))}
        </Select>
      </FormControl>
      <Button
        variant="contained"
        startIcon={<AddIcon />}
        onClick={() => setCreateDialogOpen(true)}
        data-testid="add-bcm-service-button"
      >
        Add Service
      </Button>
    </Box>
  ), [statusFilter, criticalityTierFilter, handleStatusChange, handleCriticalityTierChange, advancedFilter, handleAdvancedFilterApply, handleAdvancedFilterClear, activeAdvancedFilterCount]);

  return (
    <>
      <GenericListPage<BcmServiceData>
        title="BCM Services"
        icon={<BcmIcon />}
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
        getRowKey={(service) => service.id}
        searchPlaceholder="Search BCM Services..."
        emptyMessage="No BCM Services found"
        emptyFilteredMessage="Try adjusting your filters or search query"
        filters={getActiveFilters()}
        onFilterRemove={handleFilterRemove}
        onClearFilters={handleClearFilters}
        toolbarActions={toolbarActions}
        banner={<GrcFrameworkWarningBanner />}
        minTableWidth={900}
        testId="bcm-service-list-page"
      />

      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} maxWidth="sm" fullWidth data-testid="create-bcm-service-dialog">
        <DialogTitle>Add New BCM Service</DialogTitle>
        <DialogContent>
          <Box display="flex" flexDirection="column" gap={2} mt={1}>
            {createError && (
              <Alert severity="error" onClose={() => setCreateError(null)} data-testid="bcm-service-create-error">
                {createError}
              </Alert>
            )}
            <TextField
              label="Name"
              value={newService.name}
              onChange={(e) => setNewService({ ...newService, name: e.target.value })}
              fullWidth
              required
              data-testid="bcm-service-name-input"
            />
            <TextField
              label="Description"
              value={newService.description}
              onChange={(e) => setNewService({ ...newService, description: e.target.value })}
              fullWidth
              multiline
              rows={3}
              data-testid="bcm-service-description-input"
            />
            <FormControl fullWidth>
              <InputLabel>Status</InputLabel>
              <Select
                value={newService.status}
                label="Status"
                onChange={(e) => setNewService({ ...newService, status: e.target.value as BcmServiceStatus })}
                data-testid="bcm-service-status-select"
              >
                {BCM_SERVICE_STATUS_VALUES.map((status) => (
                  <MenuItem key={status} value={status}>{formatStatus(status)}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)} data-testid="cancel-bcm-service-button">Cancel</Button>
          <Button
            onClick={handleCreateService}
            variant="contained"
            disabled={!newService.name}
            data-testid="create-bcm-service-button"
          >
            Create
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default BcmServiceList;
