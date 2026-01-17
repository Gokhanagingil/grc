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
} from '@mui/material';
import {
  Visibility as ViewIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Build as CapaIcon,
} from '@mui/icons-material';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { capaApi, CapaData, CreateCapaDto, CapaStatus, CapaPriority } from '../services/grcClient';
import { useAuth } from '../contexts/AuthContext';
import { GenericListPage, ColumnDefinition, FilterOption } from '../components/common';
import { GrcFrameworkWarningBanner } from '../components/onboarding';
import { useListData } from '../hooks/useListData';
import { AdvancedFilterBuilder } from '../components/common/AdvancedFilter/AdvancedFilterBuilder';
import { FilterConfig } from '../components/common/AdvancedFilter/types';
import { ListToolbar } from '../components/common/ListToolbar';

const CAPA_STATUS_VALUES: CapaStatus[] = ['planned', 'in_progress', 'implemented', 'verified', 'rejected', 'closed'];
const CAPA_PRIORITY_VALUES: CapaPriority[] = ['low', 'medium', 'high', 'critical'];

const getStatusColor = (status: string): 'error' | 'warning' | 'info' | 'success' | 'default' => {
  switch (status) {
    case 'planned': return 'info';
    case 'in_progress': return 'warning';
    case 'implemented': return 'info';
    case 'verified': return 'success';
    case 'closed': return 'success';
    case 'rejected': return 'error';
    default: return 'default';
  }
};

const getPriorityColor = (priority: string): 'error' | 'warning' | 'info' | 'success' | 'default' => {
  switch (priority) {
    case 'critical': return 'error';
    case 'high': return 'error';
    case 'medium': return 'warning';
    case 'low': return 'info';
    default: return 'default';
  }
};

const formatStatus = (status: string): string => {
  return status.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
};

const formatDate = (dateString: string | null | undefined): string => {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleDateString();
};

/**
 * CAPA filter configuration for the advanced filter builder
 */
const CAPA_FILTER_CONFIG: FilterConfig = {
  fields: [
    {
      name: 'title',
      label: 'Title',
      type: 'string',
    },
    {
      name: 'status',
      label: 'Status',
      type: 'enum',
      enumValues: CAPA_STATUS_VALUES,
      enumLabels: {
        planned: 'Planned',
        in_progress: 'In Progress',
        implemented: 'Implemented',
        verified: 'Verified',
        rejected: 'Rejected',
        closed: 'Closed',
      },
    },
    {
      name: 'priority',
      label: 'Priority',
      type: 'enum',
      enumValues: CAPA_PRIORITY_VALUES,
      enumLabels: {
        low: 'Low',
        medium: 'Medium',
        high: 'High',
        critical: 'Critical',
      },
    },
    {
      name: 'dueDate',
      label: 'Due Date',
      type: 'date',
    },
    {
      name: 'createdAt',
      label: 'Created At',
      type: 'date',
    },
  ],
  maxConditions: 10,
};

export const CapaList: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newCapa, setNewCapa] = useState<CreateCapaDto>({
    title: '',
    description: '',
    issueId: '',
    priority: 'medium',
  });
  
  const tenantId = user?.tenantId || '';
  
  const statusFilter = searchParams.get('status') || '';
  const priorityFilter = searchParams.get('priority') || '';
  const issueIdFilter = searchParams.get('issueId') || '';

  const additionalFilters = useMemo(() => {
    const filters: Record<string, unknown> = {};
    if (statusFilter) filters.status = statusFilter;
    if (priorityFilter) filters.priority = priorityFilter;
    if (issueIdFilter) filters.issueId = issueIdFilter;
    return filters;
  }, [statusFilter, priorityFilter, issueIdFilter]);

  const fetchCapas = useCallback((params: Record<string, unknown>) => {
    return capaApi.list(tenantId, params);
  }, [tenantId]);

  const isAuthReady = !authLoading && !!tenantId;

  const {
    items,
    total,
    state,
    isLoading,
    error,
    setPage,
    setPageSize,
    setSearch,
    setSort,
    setFilterTree,
    refetch,
    filterConditionCount,
    clearFilterWithNotification,
  } = useListData<CapaData>({
    fetchFn: fetchCapas,
    defaultPageSize: 10,
    defaultSort: 'createdAt:DESC',
    syncToUrl: true,
    enabled: isAuthReady,
    additionalFilters,
    entityName: 'CAPAs',
  });

  const { page, pageSize, q: search, sort } = state;

  const handleViewCapa = useCallback((capa: CapaData) => {
    navigate(`/capa/${capa.id}`);
  }, [navigate]);

  const handleDeleteCapa = useCallback(async (capa: CapaData) => {
    if (window.confirm(`Are you sure you want to delete "${capa.title}"?`)) {
      try {
        await capaApi.delete(tenantId, capa.id);
        refetch();
      } catch (err) {
        console.error('Failed to delete CAPA:', err);
      }
    }
  }, [tenantId, refetch]);

  const handleCreateCapa = useCallback(async () => {
    if (!newCapa.issueId) {
      alert('Please enter an Issue ID');
      return;
    }
    try {
      await capaApi.create(tenantId, newCapa);
      setCreateDialogOpen(false);
      setNewCapa({
        title: '',
        description: '',
        issueId: '',
        priority: 'medium',
      });
      refetch();
    } catch (err) {
      console.error('Failed to create CAPA:', err);
    }
  }, [tenantId, newCapa, refetch]);

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

  const handlePriorityChange = useCallback((value: string) => {
    updateFilter('priority', value);
  }, [updateFilter]);

  const getActiveFilters = useCallback((): FilterOption[] => {
    const filters: FilterOption[] = [];
    if (statusFilter) {
      filters.push({ key: 'status', label: 'Status', value: formatStatus(statusFilter) });
    }
    if (priorityFilter) {
      filters.push({ key: 'priority', label: 'Priority', value: formatStatus(priorityFilter) });
    }
    if (issueIdFilter) {
      filters.push({ key: 'issueId', label: 'Issue', value: issueIdFilter });
    }
    return filters;
  }, [statusFilter, priorityFilter, issueIdFilter]);

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

  const columns: ColumnDefinition<CapaData>[] = useMemo(() => [
    {
      key: 'title',
      header: 'Title',
      render: (capa) => (
        <Tooltip title={capa.description || ''}>
          <Typography 
            variant="body2" 
            sx={{ maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
          >
            {capa.title}
          </Typography>
        </Tooltip>
      ),
    },
    {
      key: 'priority',
      header: 'Priority',
      render: (capa) => (
        <Chip
          label={formatStatus(capa.priority)}
          size="small"
          color={getPriorityColor(capa.priority)}
        />
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (capa) => (
        <Chip
          label={formatStatus(capa.status)}
          size="small"
          color={getStatusColor(capa.status)}
        />
      ),
    },
    {
      key: 'issue',
      header: 'Issue',
      render: (capa) => (
        <Typography variant="body2">
          {capa.issue?.title || capa.issueId || '-'}
        </Typography>
      ),
    },
    {
      key: 'owner',
      header: 'Owner',
      render: (capa) => (
        <Typography variant="body2">
          {capa.owner ? `${capa.owner.firstName} ${capa.owner.lastName}` : '-'}
        </Typography>
      ),
    },
    {
      key: 'dueDate',
      header: 'Due Date',
      render: (capa) => formatDate(capa.dueDate),
    },
    {
      key: 'createdAt',
      header: 'Created',
      render: (capa) => formatDate(capa.createdAt),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (capa) => (
        <Box display="flex" gap={0.5}>
          <Tooltip title="View Details">
            <IconButton
              size="small"
              onClick={() => handleViewCapa(capa)}
              data-testid={`view-capa-${capa.id}`}
            >
              <ViewIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Delete">
            <IconButton
              size="small"
              onClick={() => handleDeleteCapa(capa)}
              color="error"
              data-testid={`delete-capa-${capa.id}`}
            >
              <DeleteIcon />
            </IconButton>
          </Tooltip>
        </Box>
      ),
    },
  ], [handleViewCapa, handleDeleteCapa]);

  const filterButton = useMemo(() => (
    <AdvancedFilterBuilder
      config={CAPA_FILTER_CONFIG}
      initialFilter={state.filterTree}
      onApply={setFilterTree}
      onClear={clearFilterWithNotification}
      activeFilterCount={filterConditionCount}
    />
  ), [state.filterTree, setFilterTree, clearFilterWithNotification, filterConditionCount]);

  const toolbarActions = useMemo(() => (
    <Box display="flex" gap={1} alignItems="center">
      <FormControl size="small" sx={{ minWidth: 120 }}>
        <InputLabel>Status</InputLabel>
        <Select
          value={statusFilter}
          label="Status"
          onChange={(e) => handleStatusChange(e.target.value)}
          data-testid="capa-status-filter"
        >
          <MenuItem value="">All</MenuItem>
          {CAPA_STATUS_VALUES.map((status) => (
            <MenuItem key={status} value={status}>{formatStatus(status)}</MenuItem>
          ))}
        </Select>
      </FormControl>
      <FormControl size="small" sx={{ minWidth: 120 }}>
        <InputLabel>Priority</InputLabel>
        <Select
          value={priorityFilter}
          label="Priority"
          onChange={(e) => handlePriorityChange(e.target.value)}
          data-testid="capa-priority-filter"
        >
          <MenuItem value="">All</MenuItem>
          {CAPA_PRIORITY_VALUES.map((priority) => (
            <MenuItem key={priority} value={priority}>{formatStatus(priority)}</MenuItem>
          ))}
        </Select>
      </FormControl>
      <Button
        variant="contained"
        startIcon={<AddIcon />}
        onClick={() => setCreateDialogOpen(true)}
        data-testid="add-capa-button"
      >
        Add CAPA
      </Button>
    </Box>
  ), [statusFilter, priorityFilter, handleStatusChange, handlePriorityChange]);

  const listToolbar = useMemo(() => (
    <ListToolbar
      entity="capas"
      search={search}
      onSearchChange={setSearch}
      searchPlaceholder="Search CAPAs..."
      sort={sort}
      onSortChange={setSort}
      onRefresh={refetch}
      loading={isLoading}
      filterButton={filterButton}
      onClearFilters={handleClearFilters}
      filters={getActiveFilters()}
      onFilterRemove={handleFilterRemove}
    />
  ), [search, setSearch, sort, setSort, refetch, isLoading, filterButton, handleClearFilters, getActiveFilters, handleFilterRemove]);

  return (
    <>
            <GenericListPage<CapaData>
              title="CAPAs"
              icon={<CapaIcon />}
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
              getRowKey={(capa) => capa.id}
              searchPlaceholder="Search CAPAs..."
              emptyMessage="No CAPAs found"
              emptyFilteredMessage="Try adjusting your filters or search query"
              filters={getActiveFilters()}
              onFilterRemove={handleFilterRemove}
              onClearFilters={handleClearFilters}
              toolbarActions={toolbarActions}
              banner={
                <>
                  <GrcFrameworkWarningBanner />
                  {listToolbar}
                </>
              }
              minTableWidth={1000}
              testId="capa-list-page"
              hideSearch={true}
            />

      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add New CAPA</DialogTitle>
        <DialogContent>
          <Box display="flex" flexDirection="column" gap={2} mt={1}>
            <TextField
              label="Title"
              value={newCapa.title}
              onChange={(e) => setNewCapa({ ...newCapa, title: e.target.value })}
              fullWidth
              required
              data-testid="capa-title-input"
            />
            <TextField
              label="Description"
              value={newCapa.description}
              onChange={(e) => setNewCapa({ ...newCapa, description: e.target.value })}
              fullWidth
              multiline
              rows={3}
              data-testid="capa-description-input"
            />
            <TextField
              label="Issue ID"
              value={newCapa.issueId}
              onChange={(e) => setNewCapa({ ...newCapa, issueId: e.target.value })}
              fullWidth
              required
              helperText="Enter the UUID of the Issue this CAPA is linked to"
              data-testid="capa-issue-id-input"
            />
            <FormControl fullWidth>
              <InputLabel>Priority</InputLabel>
              <Select
                value={newCapa.priority}
                label="Priority"
                onChange={(e) => setNewCapa({ ...newCapa, priority: e.target.value as CapaPriority })}
                data-testid="capa-priority-select"
              >
                {CAPA_PRIORITY_VALUES.map((priority) => (
                  <MenuItem key={priority} value={priority}>{formatStatus(priority)}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
          <Button 
            onClick={handleCreateCapa} 
            variant="contained"
            disabled={!newCapa.title || !newCapa.issueId}
            data-testid="create-capa-button"
          >
            Create
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default CapaList;
