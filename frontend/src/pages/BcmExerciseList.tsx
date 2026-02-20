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
  PlayArrow as ExerciseIcon,
} from '@mui/icons-material';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  bcmApi,
  BcmExerciseData,
  BcmExerciseType,
  BcmExerciseStatus,
  BcmExerciseOutcome,
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

const BCM_EXERCISE_TYPE_VALUES: BcmExerciseType[] = ['TABLETOP', 'FAILOVER', 'RESTORE', 'COMMS'];
const BCM_EXERCISE_STATUS_VALUES: BcmExerciseStatus[] = ['PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];
const BCM_EXERCISE_OUTCOME_VALUES: BcmExerciseOutcome[] = ['PASS', 'PARTIAL', 'FAIL'];

const getStatusColor = (status: string): 'error' | 'warning' | 'info' | 'success' | 'default' => {
  switch (status) {
    case 'PLANNED': return 'info';
    case 'IN_PROGRESS': return 'warning';
    case 'COMPLETED': return 'success';
    case 'CANCELLED': return 'error';
    default: return 'default';
  }
};

const getOutcomeColor = (outcome: string | null): 'error' | 'warning' | 'info' | 'success' | 'default' => {
  switch (outcome) {
    case 'PASS': return 'success';
    case 'PARTIAL': return 'warning';
    case 'FAIL': return 'error';
    default: return 'default';
  }
};

const formatStatus = (status: string): string => {
  return status.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
};

const formatExerciseType = (type: string): string => {
  switch (type) {
    case 'TABLETOP': return 'Tabletop';
    case 'FAILOVER': return 'Failover';
    case 'RESTORE': return 'Restore';
    case 'COMMS': return 'Communications';
    default: return type;
  }
};

const formatDate = (dateString: string | null | undefined): string => {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleDateString();
};

const BCM_EXERCISE_FILTER_CONFIG: FilterConfig = {
  fields: [
    {
      name: 'name',
      label: 'Name',
      type: 'string',
    },
    {
      name: 'exerciseType',
      label: 'Type',
      type: 'enum',
      enumValues: BCM_EXERCISE_TYPE_VALUES,
      enumLabels: {
        TABLETOP: 'Tabletop',
        FAILOVER: 'Failover',
        RESTORE: 'Restore',
        COMMS: 'Communications',
      },
    },
    {
      name: 'status',
      label: 'Status',
      type: 'enum',
      enumValues: BCM_EXERCISE_STATUS_VALUES,
      enumLabels: {
        PLANNED: 'Planned',
        IN_PROGRESS: 'In Progress',
        COMPLETED: 'Completed',
        CANCELLED: 'Cancelled',
      },
    },
    {
      name: 'outcome',
      label: 'Outcome',
      type: 'enum',
      enumValues: BCM_EXERCISE_OUTCOME_VALUES,
      enumLabels: {
        PASS: 'Pass',
        PARTIAL: 'Partial',
        FAIL: 'Fail',
      },
    },
    {
      name: 'scheduledAt',
      label: 'Scheduled Date',
      type: 'date',
    },
  ],
  maxConditions: 10,
};

export const BcmExerciseList: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const tenantId = user?.tenantId || '';

  const statusFilter = searchParams.get('status') || '';
  const exerciseTypeFilter = searchParams.get('exerciseType') || '';

  const parsedQuery = useMemo(() => parseListQuery(searchParams, {
    pageSize: 10,
    sort: 'scheduledAt:DESC',
  }), [searchParams]);

  const advancedFilter = parsedQuery.filterTree;

  const additionalFilters = useMemo(() => {
    const filters: Record<string, unknown> = {};
    if (statusFilter) filters.status = statusFilter;
    if (exerciseTypeFilter) filters.exerciseType = exerciseTypeFilter;
    if (advancedFilter) {
      const serialized = serializeFilterTree(advancedFilter);
      if (serialized) filters.filter = serialized;
    }
    return filters;
  }, [statusFilter, exerciseTypeFilter, advancedFilter]);

  const fetchExercises = useCallback((params: Record<string, unknown>) => {
    return bcmApi.listExercises(tenantId, params);
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
  } = useUniversalList<BcmExerciseData>({
    fetchFn: fetchExercises,
    defaultPageSize: 10,
    defaultSort: 'scheduledAt:DESC',
    syncToUrl: true,
    enabled: isAuthReady,
    additionalFilters,
  });

  const handleViewExercise = useCallback((exercise: BcmExerciseData) => {
    navigate(`/bcm/services/${exercise.serviceId}?tab=exercises`);
  }, [navigate]);

  const handleDeleteExercise = useCallback(async (exercise: BcmExerciseData) => {
    if (window.confirm(`Are you sure you want to delete "${exercise.name}"?`)) {
      try {
        await bcmApi.deleteExercise(tenantId, exercise.id);
        refetch();
      } catch (err) {
        console.error('Failed to delete BCM Exercise:', err);
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

  const handleExerciseTypeChange = useCallback((value: string) => {
    updateFilter('exerciseType', value);
  }, [updateFilter]);

  const getActiveFilters = useCallback((): FilterOption[] => {
    const filters: FilterOption[] = [];
    if (statusFilter) {
      filters.push({ key: 'status', label: 'Status', value: formatStatus(statusFilter) });
    }
    if (exerciseTypeFilter) {
      filters.push({ key: 'exerciseType', label: 'Type', value: formatExerciseType(exerciseTypeFilter) });
    }
    return filters;
  }, [statusFilter, exerciseTypeFilter]);

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

  const columns: ColumnDefinition<BcmExerciseData>[] = useMemo(() => [
    {
      key: 'name',
      header: 'Name',
      render: (exercise) => (
        <Typography
          variant="body2"
          component="span"
          onClick={() => handleViewExercise(exercise)}
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
          {exercise.name}
        </Typography>
      ),
    },
    {
      key: 'exerciseType',
      header: 'Type',
      render: (exercise) => (
        <Chip label={formatExerciseType(exercise.exerciseType)} size="small" variant="outlined" />
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (exercise) => (
        <Chip
          label={formatStatus(exercise.status)}
          size="small"
          color={getStatusColor(exercise.status)}
        />
      ),
    },
    {
      key: 'scheduledAt',
      header: 'Scheduled',
      render: (exercise) => formatDate(exercise.scheduledAt),
    },
    {
      key: 'outcome',
      header: 'Outcome',
      render: (exercise) => (
        exercise.outcome ? (
          <Chip
            label={exercise.outcome}
            size="small"
            color={getOutcomeColor(exercise.outcome)}
          />
        ) : (
          <Typography variant="body2" color="text.secondary">-</Typography>
        )
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (exercise) => (
        <Box display="flex" gap={0.5}>
          <Tooltip title="View Service">
            <IconButton
              size="small"
              onClick={() => handleViewExercise(exercise)}
              data-testid={`view-bcm-exercise-${exercise.id}`}
            >
              <ViewIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Delete">
            <IconButton
              size="small"
              onClick={() => handleDeleteExercise(exercise)}
              color="error"
              data-testid={`delete-bcm-exercise-${exercise.id}`}
            >
              <DeleteIcon />
            </IconButton>
          </Tooltip>
        </Box>
      ),
    },
  ], [handleViewExercise, handleDeleteExercise]);

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
        config={BCM_EXERCISE_FILTER_CONFIG}
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
          data-testid="bcm-exercise-status-filter"
        >
          <MenuItem value="">All</MenuItem>
          {BCM_EXERCISE_STATUS_VALUES.map((status) => (
            <MenuItem key={status} value={status}>{formatStatus(status)}</MenuItem>
          ))}
        </Select>
      </FormControl>
      <FormControl size="small" sx={{ minWidth: 140 }}>
        <InputLabel>Type</InputLabel>
        <Select
          value={exerciseTypeFilter}
          label="Type"
          onChange={(e) => handleExerciseTypeChange(e.target.value)}
          data-testid="bcm-exercise-type-filter"
        >
          <MenuItem value="">All</MenuItem>
          {BCM_EXERCISE_TYPE_VALUES.map((type) => (
            <MenuItem key={type} value={type}>{formatExerciseType(type)}</MenuItem>
          ))}
        </Select>
      </FormControl>
    </Box>
  ), [statusFilter, exerciseTypeFilter, handleStatusChange, handleExerciseTypeChange, advancedFilter, handleAdvancedFilterApply, handleAdvancedFilterClear, activeAdvancedFilterCount]);

  return (
    <GenericListPage<BcmExerciseData>
      title="BCM Exercises"
      icon={<ExerciseIcon />}
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
      getRowKey={(exercise) => exercise.id}
      searchPlaceholder="Search BCM Exercises..."
      emptyMessage="No BCM Exercises found"
      emptyFilteredMessage="Try adjusting your filters or search query"
      filters={getActiveFilters()}
      onFilterRemove={handleFilterRemove}
      onClearFilters={handleClearFilters}
      toolbarActions={toolbarActions}
      banner={<GrcFrameworkWarningBanner />}
      minTableWidth={900}
      testId="bcm-exercise-list-page"
    />
  );
};

export default BcmExerciseList;
