import React, { useCallback, useMemo } from 'react';
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
} from '@mui/material';
import {
  Visibility as ViewIcon,
  Security as ControlIcon,
} from '@mui/icons-material';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { controlApi } from '../services/grcClient';
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
  ownerUserId: string | null;
  owner: {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
  } | null;
  effectiveDate: string | null;
  lastTestedDate: string | null;
  nextTestDate: string | null;
  lastTestResult: string | null;
  createdAt: string;
  updatedAt: string;
  isDeleted: boolean;
}

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

const formatStatus = (status: ControlStatus): string => {
  return status.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
};

const formatType = (type: ControlType): string => {
  return type.charAt(0).toUpperCase() + type.slice(1);
};

const formatFrequency = (frequency: ControlFrequency | null): string => {
  if (!frequency) return '-';
  return frequency.charAt(0).toUpperCase() + frequency.slice(1);
};

const formatDate = (dateString: string | null): string => {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleDateString();
};

const CONTROL_FILTER_CONFIG: FilterConfig = {
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
      name: 'status',
      label: 'Status',
      type: 'enum',
      enumValues: Object.values(ControlStatus),
      enumLabels: {
        [ControlStatus.DRAFT]: 'Draft',
        [ControlStatus.IN_DESIGN]: 'In Design',
        [ControlStatus.IMPLEMENTED]: 'Implemented',
        [ControlStatus.INOPERATIVE]: 'Inoperative',
        [ControlStatus.RETIRED]: 'Retired',
      },
    },
    {
      name: 'type',
      label: 'Type',
      type: 'enum',
      enumValues: Object.values(ControlType),
      enumLabels: {
        [ControlType.PREVENTIVE]: 'Preventive',
        [ControlType.DETECTIVE]: 'Detective',
        [ControlType.CORRECTIVE]: 'Corrective',
      },
    },
    {
      name: 'implementationType',
      label: 'Implementation Type',
      type: 'enum',
      enumValues: Object.values(ControlImplementationType),
      enumLabels: {
        [ControlImplementationType.MANUAL]: 'Manual',
        [ControlImplementationType.AUTOMATED]: 'Automated',
        [ControlImplementationType.IT_DEPENDENT]: 'IT Dependent',
      },
    },
    {
      name: 'frequency',
      label: 'Frequency',
      type: 'enum',
      enumValues: Object.values(ControlFrequency),
      enumLabels: {
        [ControlFrequency.CONTINUOUS]: 'Continuous',
        [ControlFrequency.DAILY]: 'Daily',
        [ControlFrequency.WEEKLY]: 'Weekly',
        [ControlFrequency.MONTHLY]: 'Monthly',
        [ControlFrequency.QUARTERLY]: 'Quarterly',
        [ControlFrequency.ANNUAL]: 'Annual',
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
    {
      name: 'effectiveDate',
      label: 'Effective Date',
      type: 'date',
    },
    {
      name: 'lastTestedDate',
      label: 'Last Tested Date',
      type: 'date',
    },
    {
      name: 'nextTestDate',
      label: 'Next Test Date',
      type: 'date',
    },
  ],
  maxConditions: 30,
};

export const ControlList: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  
  const tenantId = user?.tenantId || '';
  
  const statusFilter = searchParams.get('status') || '';
  const typeFilter = searchParams.get('type') || '';
  const unlinkedFilter = searchParams.get('unlinked') === 'true';
  const processId = searchParams.get('processId') || '';
  const requirementId = searchParams.get('requirementId') || '';

  const parsedQuery = useMemo(() => parseListQuery(searchParams, {
    pageSize: 10,
    sort: 'createdAt:DESC',
  }), [searchParams]);

  const advancedFilter = parsedQuery.filterTree;

  const additionalFilters = useMemo(() => {
    const filters: Record<string, unknown> = {};
    if (statusFilter) filters.status = statusFilter;
    if (typeFilter) filters.type = typeFilter;
    if (unlinkedFilter) filters.unlinked = 'true';
    if (processId) filters.processId = processId;
    if (requirementId) filters.requirementId = requirementId;
    if (advancedFilter) {
      const serialized = serializeFilterTree(advancedFilter);
      if (serialized) filters.filter = serialized;
    }
    return filters;
  }, [statusFilter, typeFilter, unlinkedFilter, processId, requirementId, advancedFilter]);

  const fetchControls = useCallback((params: Record<string, unknown>) => {
    return controlApi.list(tenantId, params);
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
  } = useUniversalList<Control>({
    fetchFn: fetchControls,
    defaultPageSize: 10,
    defaultSort: 'createdAt:DESC',
    syncToUrl: true,
    enabled: isAuthReady,
    additionalFilters,
  });

  const handleViewControl = useCallback((control: Control) => {
    navigate(`/controls/${control.id}`);
  }, [navigate]);

  const updateFilter = useCallback((key: string, value: string | boolean) => {
    const newParams = new URLSearchParams(searchParams);
    if (value === '' || value === false) {
      newParams.delete(key);
    } else {
      newParams.set(key, String(value));
    }
    newParams.set('page', '1');
    setSearchParams(newParams, { replace: true });
  }, [searchParams, setSearchParams]);

  const handleStatusChange = useCallback((value: string) => {
    updateFilter('status', value);
  }, [updateFilter]);

  const handleTypeChange = useCallback((value: string) => {
    updateFilter('type', value);
  }, [updateFilter]);

  const handleUnlinkedChange = useCallback((value: string) => {
    updateFilter('unlinked', value === 'unlinked');
  }, [updateFilter]);

  const getActiveFilters = useCallback((): FilterOption[] => {
    const filters: FilterOption[] = [];
    if (statusFilter) {
      filters.push({ key: 'status', label: 'Status', value: formatStatus(statusFilter as ControlStatus) });
    }
    if (typeFilter) {
      filters.push({ key: 'type', label: 'Type', value: formatType(typeFilter as ControlType) });
    }
    if (unlinkedFilter) {
      filters.push({ key: 'unlinked', label: 'Unlinked', value: 'Yes' });
    }
    if (processId) {
      filters.push({ key: 'processId', label: 'Process', value: processId.substring(0, 8) + '...' });
    }
    if (requirementId) {
      filters.push({ key: 'requirementId', label: 'Requirement', value: requirementId.substring(0, 8) + '...' });
    }
    return filters;
  }, [statusFilter, typeFilter, unlinkedFilter, processId, requirementId]);

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

  const columns: ColumnDefinition<Control>[] = useMemo(() => [
    {
      key: 'code',
      header: 'Code',
      render: (control) => (
        <Typography variant="body2" fontWeight="medium">
          {control.code || '-'}
        </Typography>
      ),
    },
    {
      key: 'name',
      header: 'Name',
      render: (control) => (
        <Tooltip title={control.description || ''}>
          <Typography 
            variant="body2" 
            sx={{ maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
          >
            {control.name}
          </Typography>
        </Tooltip>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      render: (control) => (
        <Chip
          label={formatType(control.type)}
          size="small"
          color={getTypeColor(control.type)}
        />
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (control) => (
        <Chip
          label={formatStatus(control.status)}
          size="small"
          color={getStatusColor(control.status)}
        />
      ),
    },
    {
      key: 'frequency',
      header: 'Frequency',
      render: (control) => formatFrequency(control.frequency),
    },
    {
      key: 'lastTestedDate',
      header: 'Last Tested',
      render: (control) => formatDate(control.lastTestedDate),
    },
    {
      key: 'nextTestDate',
      header: 'Next Test',
      render: (control) => formatDate(control.nextTestDate),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (control) => (
        <Tooltip title="View Details">
          <IconButton
            size="small"
            onClick={() => handleViewControl(control)}
          >
            <ViewIcon />
          </IconButton>
        </Tooltip>
      ),
    },
  ], [handleViewControl]);

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

  const activeAdvancedFilterCount= advancedFilter ? countFilterConditions(advancedFilter) : 0;

  const toolbarActions = useMemo(() => (
    <Box display="flex" gap={1} alignItems="center">
      <FilterBuilderBasic
        config={CONTROL_FILTER_CONFIG}
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
          {Object.values(ControlStatus).map((status) => (
            <MenuItem key={status} value={status}>{formatStatus(status)}</MenuItem>
          ))}
        </Select>
      </FormControl>
      <FormControl size="small" sx={{ minWidth: 120 }}>
        <InputLabel>Type</InputLabel>
        <Select
          value={typeFilter}
          label="Type"
          onChange={(e) => handleTypeChange(e.target.value)}
        >
          <MenuItem value="">All</MenuItem>
          {Object.values(ControlType).map((type) => (
            <MenuItem key={type} value={type}>{formatType(type)}</MenuItem>
          ))}
        </Select>
      </FormControl>
      <FormControl size="small" sx={{ minWidth: 120 }}>
        <InputLabel>Linked</InputLabel>
        <Select
          value={unlinkedFilter ? 'unlinked' : 'all'}
          label="Linked"
          onChange={(e) => handleUnlinkedChange(e.target.value)}
        >
          <MenuItem value="all">All</MenuItem>
          <MenuItem value="unlinked">Unlinked Only</MenuItem>
        </Select>
      </FormControl>
    </Box>
  ), [statusFilter, typeFilter, unlinkedFilter, handleStatusChange, handleTypeChange, handleUnlinkedChange, advancedFilter, handleAdvancedFilterApply, handleAdvancedFilterClear, activeAdvancedFilterCount]);

  return (
    <GenericListPage<Control>
      title="Control Library"
      icon={<ControlIcon />}
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
      getRowKey={(control) => control.id}
      searchPlaceholder="Search controls..."
      emptyMessage="No controls found"
      emptyFilteredMessage="Try adjusting your filters or search query"
      filters={getActiveFilters()}
      onFilterRemove={handleFilterRemove}
      onClearFilters={handleClearFilters}
      toolbarActions={toolbarActions}
      banner={<GrcFrameworkWarningBanner />}
      minTableWidth={900}
    />
  );
};

export default ControlList;
