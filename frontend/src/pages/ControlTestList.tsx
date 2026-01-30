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
  Delete as DeleteIcon,
  Science as TestIcon,
} from '@mui/icons-material';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { controlTestApi, ControlTestData, ControlTestStatus, ControlTestType } from '../services/grcClient';
import { useAuth } from '../contexts/AuthContext';
import {
  GenericListPage,
  ColumnDefinition,
  FilterOption,
  FilterBuilderBasic,
  FilterConfig,
  FilterTree,
} from '../components/common';
import { GrcFrameworkWarningBanner } from '../components/onboarding';
import { useUniversalList } from '../hooks/useUniversalList';
import {
  parseListQuery,
  serializeFilterTree,
  countFilterConditions,
} from '../utils/listQueryUtils';

const getStatusColor = (status: string): 'error' | 'warning' | 'info' | 'success' | 'default' => {
  switch (status) {
    case 'PLANNED': return 'info';
    case 'IN_PROGRESS': return 'warning';
    case 'COMPLETED': return 'success';
    case 'CANCELLED': return 'default';
    default: return 'default';
  }
};

const getTestTypeColor = (testType: string): 'error' | 'warning' | 'info' | 'success' | 'default' => {
  switch (testType) {
    case 'DESIGN': return 'info';
    case 'OPERATING_EFFECTIVENESS': return 'success';
    case 'BOTH': return 'warning';
    default: return 'default';
  }
};

const formatStatus = (status: string): string => {
  return status.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
};

const formatTestType = (testType: string): string => {
  if (testType === 'OPERATING_EFFECTIVENESS') return 'Operating Eff.';
  return testType.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
};

const formatDate = (dateString: string | null | undefined): string => {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleDateString();
};

// Define constant options outside component to avoid useMemo dependency issues
const STATUS_OPTIONS: ControlTestStatus[] = ['PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];
const TEST_TYPE_OPTIONS: ControlTestType[] = ['DESIGN', 'OPERATING_EFFECTIVENESS', 'BOTH'];

const CONTROL_TEST_FILTER_CONFIG: FilterConfig = {
  fields: [
    {
      name: 'name',
      label: 'Name',
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
      enumValues: [...STATUS_OPTIONS],
      enumLabels: {
        PLANNED: 'Planned',
        IN_PROGRESS: 'In Progress',
        COMPLETED: 'Completed',
        CANCELLED: 'Cancelled',
      },
    },
    {
      name: 'testType',
      label: 'Test Type',
      type: 'enum',
      enumValues: [...TEST_TYPE_OPTIONS],
      enumLabels: {
        DESIGN: 'Design',
        OPERATING_EFFECTIVENESS: 'Operating Effectiveness',
        BOTH: 'Both',
      },
    },
    {
      name: 'scheduledDate',
      label: 'Scheduled Date',
      type: 'date',
    },
    {
      name: 'createdAt',
      label: 'Created Date',
      type: 'date',
    },
  ],
  maxConditions: 10,
};

export const ControlTestList: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  
  const tenantId = user?.tenantId || '';
  
  const statusFilter = searchParams.get('status') || '';
  const testTypeFilter = searchParams.get('testType') || '';

  const parsedQuery = useMemo(() => parseListQuery(searchParams, {
    pageSize: 10,
    sort: 'createdAt:DESC',
  }), [searchParams]);

  const advancedFilter = parsedQuery.filterTree;

  const additionalFilters = useMemo(() => {
    const filters: Record<string, unknown> = {};
    if (statusFilter) filters.status = statusFilter;
    if (testTypeFilter) filters.testType = testTypeFilter;
    if (advancedFilter) {
      const serialized = serializeFilterTree(advancedFilter);
      if (serialized) filters.filter = serialized;
    }
    return filters;
  }, [statusFilter, testTypeFilter, advancedFilter]);

  const fetchControlTests = useCallback((params: Record<string, unknown>) => {
    return controlTestApi.list(tenantId, params);
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
  } = useUniversalList<ControlTestData>({
    fetchFn: fetchControlTests,
    defaultPageSize: 10,
    defaultSort: 'createdAt:DESC',
    syncToUrl: true,
    enabled: isAuthReady,
    additionalFilters,
  });

  const handleViewControlTest = useCallback((controlTest: ControlTestData) => {
    navigate(`/control-tests/${controlTest.id}`);
  }, [navigate]);

  const handleDeleteControlTest = useCallback(async (controlTest: ControlTestData) => {
    if (window.confirm(`Are you sure you want to delete "${controlTest.name}"?`)) {
      try {
        await controlTestApi.delete(tenantId, controlTest.id);
        refetch();
      } catch (err) {
        console.error('Failed to delete control test:', err);
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

  const handleStatusChange = useCallback((value: string) => {
    updateFilter('status', value);
  }, [updateFilter]);

  const handleTestTypeChange = useCallback((value: string) => {
    updateFilter('testType', value);
  }, [updateFilter]);

  const getActiveFilters = useCallback((): FilterOption[] => {
    const filters: FilterOption[] = [];
    if (statusFilter) {
      filters.push({ key: 'status', label: 'Status', value: formatStatus(statusFilter) });
    }
    if (testTypeFilter) {
      filters.push({ key: 'testType', label: 'Test Type', value: formatTestType(testTypeFilter) });
    }
    return filters;
  }, [statusFilter, testTypeFilter]);

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

  const columns: ColumnDefinition<ControlTestData>[] = useMemo(() => [
    {
      key: 'name',
      header: 'Name',
      render: (controlTest) => (
        <Tooltip title={controlTest.description || ''}>
          <Typography 
            variant="body2" 
            sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
          >
            {controlTest.name}
          </Typography>
        </Tooltip>
      ),
    },
    {
      key: 'control',
      header: 'Control',
      render: (controlTest) => (
        <Typography variant="body2">
          {controlTest.control?.code || controlTest.control?.name || '-'}
        </Typography>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (controlTest) => (
        <Chip
          label={formatStatus(controlTest.status)}
          size="small"
          color={getStatusColor(controlTest.status)}
        />
      ),
    },
    {
      key: 'testType',
      header: 'Test Type',
      render: (controlTest) => controlTest.testType ? (
        <Chip
          label={formatTestType(controlTest.testType)}
          size="small"
          color={getTestTypeColor(controlTest.testType)}
        />
      ) : '-',
    },
    {
      key: 'scheduledDate',
      header: 'Scheduled',
      render: (controlTest) => formatDate(controlTest.scheduledDate),
    },
    {
      key: 'createdAt',
      header: 'Created',
      render: (controlTest) => formatDate(controlTest.createdAt),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (controlTest) => (
        <Box display="flex" gap={0.5}>
          <Tooltip title="View Details">
            <IconButton
              size="small"
              onClick={() => handleViewControlTest(controlTest)}
            >
              <ViewIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Delete">
            <IconButton
              size="small"
              onClick={() => handleDeleteControlTest(controlTest)}
              color="error"
            >
              <DeleteIcon />
            </IconButton>
          </Tooltip>
        </Box>
      ),
    },
  ], [handleViewControlTest, handleDeleteControlTest]);

  const toolbarActions = useMemo(() => (
    <Box display="flex" gap={1} alignItems="center">
      <FilterBuilderBasic
        config={CONTROL_TEST_FILTER_CONFIG}
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
          {STATUS_OPTIONS.map((status) => (
            <MenuItem key={status} value={status}>{formatStatus(status)}</MenuItem>
          ))}
        </Select>
      </FormControl>
      <FormControl size="small" sx={{ minWidth: 140 }}>
        <InputLabel>Test Type</InputLabel>
        <Select
          value={testTypeFilter}
          label="Test Type"
          onChange={(e) => handleTestTypeChange(e.target.value)}
        >
          <MenuItem value="">All</MenuItem>
          {TEST_TYPE_OPTIONS.map((testType) => (
            <MenuItem key={testType} value={testType}>{formatTestType(testType)}</MenuItem>
          ))}
        </Select>
      </FormControl>
    </Box>
  ), [statusFilter, testTypeFilter, handleStatusChange, handleTestTypeChange, advancedFilter, handleAdvancedFilterApply, handleAdvancedFilterClear, activeAdvancedFilterCount]);

  return (
    <GenericListPage<ControlTestData>
      title="Control Tests"
      icon={<TestIcon />}
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
      getRowKey={(controlTest) => controlTest.id}
      searchPlaceholder="Search control tests..."
      emptyMessage="No control tests found"
      emptyFilteredMessage="Try adjusting your filters or search query"
      filters={getActiveFilters()}
      onFilterRemove={handleFilterRemove}
      onClearFilters={handleClearFilters}
      toolbarActions={toolbarActions}
      banner={<GrcFrameworkWarningBanner />}
      minTableWidth={900}
      testId="control-test-list-page"
      onRowClick={handleViewControlTest}
    />
  );
};

export default ControlTestList;
