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
  FactCheck as TestResultIcon,
} from '@mui/icons-material';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { testResultApi, TestResultData } from '../services/grcClient';
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

export enum TestResultOutcome {
  PASS = 'PASS',
  FAIL = 'FAIL',
  INCONCLUSIVE = 'INCONCLUSIVE',
  NOT_APPLICABLE = 'NOT_APPLICABLE',
}

export enum EffectivenessRating {
  EFFECTIVE = 'EFFECTIVE',
  PARTIALLY_EFFECTIVE = 'PARTIALLY_EFFECTIVE',
  INEFFECTIVE = 'INEFFECTIVE',
}

const getResultColor = (result: string): 'error' | 'warning' | 'info' | 'success' | 'default' => {
  switch (result) {
    case TestResultOutcome.PASS: return 'success';
    case TestResultOutcome.FAIL: return 'error';
    case TestResultOutcome.INCONCLUSIVE: return 'warning';
    case TestResultOutcome.NOT_APPLICABLE: return 'default';
    default: return 'default';
  }
};

const getEffectivenessColor = (rating: string): 'error' | 'warning' | 'info' | 'success' | 'default' => {
  switch (rating) {
    case EffectivenessRating.EFFECTIVE: return 'success';
    case EffectivenessRating.PARTIALLY_EFFECTIVE: return 'warning';
    case EffectivenessRating.INEFFECTIVE: return 'error';
    default: return 'default';
  }
};

const formatResult = (result: string): string => {
  return result.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
};

const formatDate = (dateString: string | null | undefined): string => {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleDateString();
};

const TEST_RESULT_FILTER_CONFIG: FilterConfig = {
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
      name: 'result',
      label: 'Result',
      type: 'enum',
      enumValues: Object.values(TestResultOutcome),
      enumLabels: {
        [TestResultOutcome.PASS]: 'Pass',
        [TestResultOutcome.FAIL]: 'Fail',
        [TestResultOutcome.INCONCLUSIVE]: 'Inconclusive',
        [TestResultOutcome.NOT_APPLICABLE]: 'Not Applicable',
      },
    },
    {
      name: 'effectivenessRating',
      label: 'Effectiveness',
      type: 'enum',
      enumValues: Object.values(EffectivenessRating),
      enumLabels: {
        [EffectivenessRating.EFFECTIVE]: 'Effective',
        [EffectivenessRating.PARTIALLY_EFFECTIVE]: 'Partially Effective',
        [EffectivenessRating.INEFFECTIVE]: 'Ineffective',
      },
    },
    {
      name: 'testedAt',
      label: 'Tested Date',
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

export const TestResultList: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  
  const tenantId = user?.tenantId || '';
  
  const resultFilter = searchParams.get('result') || '';

  const parsedQuery = useMemo(() => parseListQuery(searchParams, {
    pageSize: 10,
    sort: 'createdAt:DESC',
  }), [searchParams]);

  const advancedFilter = parsedQuery.filterTree;

  const additionalFilters = useMemo(() => {
    const filters: Record<string, unknown> = {};
    if (resultFilter) filters.result = resultFilter;
    if (advancedFilter) {
      const serialized = serializeFilterTree(advancedFilter);
      if (serialized) filters.filter = serialized;
    }
    return filters;
  }, [resultFilter, advancedFilter]);

  const fetchTestResults = useCallback((params: Record<string, unknown>) => {
    return testResultApi.list(tenantId, params);
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
  } = useUniversalList<TestResultData>({
    fetchFn: fetchTestResults,
    defaultPageSize: 10,
    defaultSort: 'createdAt:DESC',
    syncToUrl: true,
    enabled: isAuthReady,
    additionalFilters,
  });

  const handleViewTestResult = useCallback((testResult: TestResultData) => {
    navigate(`/test-results/${testResult.id}`);
  }, [navigate]);

  const handleDeleteTestResult = useCallback(async (testResult: TestResultData) => {
    if (window.confirm(`Are you sure you want to delete "${testResult.name}"?`)) {
      try {
        await testResultApi.delete(tenantId, testResult.id);
        refetch();
      } catch (err) {
        console.error('Failed to delete test result:', err);
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

  const handleResultChange = useCallback((value: string) => {
    updateFilter('result', value);
  }, [updateFilter]);

  const getActiveFilters = useCallback((): FilterOption[] => {
    const filters: FilterOption[] = [];
    if (resultFilter) {
      filters.push({ key: 'result', label: 'Result', value: formatResult(resultFilter) });
    }
    return filters;
  }, [resultFilter]);

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

  const columns: ColumnDefinition<TestResultData>[] = useMemo(() => [
    {
      key: 'name',
      header: 'Name',
      render: (testResult) => (
        <Tooltip title={testResult.description || ''}>
          <Typography 
            variant="body2" 
            sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
          >
            {testResult.name}
          </Typography>
        </Tooltip>
      ),
    },
    {
      key: 'control',
      header: 'Control',
      render: (testResult) => (
        <Typography variant="body2">
          {testResult.controlTest?.control?.code || testResult.controlTest?.control?.name || '-'}
        </Typography>
      ),
    },
    {
      key: 'result',
      header: 'Result',
      render: (testResult) => (
        <Chip
          label={formatResult(testResult.result)}
          size="small"
          color={getResultColor(testResult.result)}
        />
      ),
    },
    {
      key: 'effectivenessRating',
      header: 'Effectiveness',
      render: (testResult) => testResult.effectivenessRating ? (
        <Chip
          label={formatResult(testResult.effectivenessRating)}
          size="small"
          color={getEffectivenessColor(testResult.effectivenessRating)}
        />
      ) : '-',
    },
    {
      key: 'testedAt',
      header: 'Tested Date',
      render: (testResult) => formatDate(testResult.testedAt),
    },
    {
      key: 'createdAt',
      header: 'Created',
      render: (testResult) => formatDate(testResult.createdAt),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (testResult) => (
        <Box display="flex" gap={0.5}>
          <Tooltip title="View Details">
            <IconButton
              size="small"
              onClick={() => handleViewTestResult(testResult)}
            >
              <ViewIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Delete">
            <IconButton
              size="small"
              onClick={() => handleDeleteTestResult(testResult)}
              color="error"
            >
              <DeleteIcon />
            </IconButton>
          </Tooltip>
        </Box>
      ),
    },
  ], [handleViewTestResult, handleDeleteTestResult]);

  const toolbarActions = useMemo(() => (
    <Box display="flex" gap={1} alignItems="center">
      <FormControl size="small" sx={{ minWidth: 120 }}>
        <InputLabel>Result</InputLabel>
        <Select
          value={resultFilter}
          label="Result"
          onChange={(e) => handleResultChange(e.target.value)}
        >
          <MenuItem value="">All</MenuItem>
          {Object.values(TestResultOutcome).map((result) => (
            <MenuItem key={result} value={result}>{formatResult(result)}</MenuItem>
          ))}
        </Select>
      </FormControl>
      <FilterBuilderBasic
        config={TEST_RESULT_FILTER_CONFIG}
        initialFilter={advancedFilter}
        onApply={handleAdvancedFilterApply}
        onClear={handleAdvancedFilterClear}
        activeFilterCount={activeAdvancedFilterCount}
      />
    </Box>
  ), [resultFilter, handleResultChange, advancedFilter, handleAdvancedFilterApply, handleAdvancedFilterClear, activeAdvancedFilterCount]);

  return (
        <GenericListPage<TestResultData>
          title="Test Results"
          icon={<TestResultIcon />}
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
          getRowKey={(testResult) => testResult.id}
          searchPlaceholder="Search test results..."
          emptyMessage="No test results found"
          emptyFilteredMessage="Try adjusting your filters or search query"
          filters={getActiveFilters()}
          onFilterRemove={handleFilterRemove}
          onClearFilters={handleClearFilters}
          toolbarActions={toolbarActions}
          banner={<GrcFrameworkWarningBanner />}
          minTableWidth={900}
          testId="test-result-list-page"
          onRowClick={handleViewTestResult}
        />
  );
};

export default TestResultList;
