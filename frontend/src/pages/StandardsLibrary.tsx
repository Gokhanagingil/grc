import React, { useCallback, useMemo } from 'react';
import {
  Box,
  Chip,
  IconButton,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  Visibility as ViewIcon,
  LibraryBooks as StandardsIcon,
} from '@mui/icons-material';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { standardsLibraryApi } from '../services/grcClient';
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

interface Standard {
  id: string;
  code: string;
  name: string;
  shortName?: string | null;
  version: string;
  description?: string | null;
  publisher?: string | null;
  effectiveDate?: string | null;
  domain?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

const DOMAIN_VALUES = ['security', 'privacy', 'compliance', 'governance', 'risk', 'other'] as const;

const STANDARDS_FILTER_CONFIG: FilterConfig = {
  fields: [
    {
      name: 'code',
      label: 'Code',
      type: 'string',
    },
    {
      name: 'name',
      label: 'Name',
      type: 'string',
    },
    {
      name: 'version',
      label: 'Version',
      type: 'string',
    },
    {
      name: 'domain',
      label: 'Domain',
      type: 'enum',
      enumValues: [...DOMAIN_VALUES],
      enumLabels: {
        security: 'Security',
        privacy: 'Privacy',
        compliance: 'Compliance',
        governance: 'Governance',
        risk: 'Risk',
        other: 'Other',
      },
    },
    {
      name: 'publisher',
      label: 'Publisher',
      type: 'string',
    },
    {
      name: 'isActive',
      label: 'Active',
      type: 'boolean',
    },
    {
      name: 'createdAt',
      label: 'Created Date',
      type: 'date',
    },
  ],
  maxConditions: 10,
};

const formatDate = (dateString: string | null | undefined): string => {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleDateString();
};

export const StandardsLibrary: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const parsedQuery = useMemo(() => parseListQuery(searchParams, {
    pageSize: 10,
    sort: 'createdAt:DESC',
  }), [searchParams]);

  const advancedFilter = parsedQuery.filterTree;

  const additionalFilters = useMemo(() => {
    const filters: Record<string, unknown> = {};
    if (advancedFilter) {
      const serialized = serializeFilterTree(advancedFilter);
      if (serialized) filters.filter = serialized;
    }
    return filters;
  }, [advancedFilter]);

  const fetchStandards = useCallback((params: Record<string, unknown>) => {
    return standardsLibraryApi.list(params);
  }, []);

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
  } = useUniversalList<Standard>({
    fetchFn: fetchStandards,
    defaultPageSize: 10,
    defaultSort: 'createdAt:DESC',
    syncToUrl: true,
    enabled: true,
    additionalFilters,
  });

  const handleViewStandard = useCallback((standard: Standard) => {
    navigate(`/standards/${standard.id}`);
  }, [navigate]);

  const getActiveFilters = useCallback((): FilterOption[] => {
    return [];
  }, []);

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

  const columns: ColumnDefinition<Standard>[] = useMemo(() => [
    {
      key: 'code',
      header: 'Code',
      render: (standard) => (
        <Typography variant="body2" fontWeight="medium">
          {standard.code}
        </Typography>
      ),
    },
    {
      key: 'name',
      header: 'Name',
      render: (standard) => (
        <Tooltip title={standard.description || ''}>
          <Typography
            variant="body2"
            sx={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
          >
            {standard.name}
          </Typography>
        </Tooltip>
      ),
    },
    {
      key: 'version',
      header: 'Version',
      render: (standard) => standard.version || '-',
    },
    {
      key: 'domain',
      header: 'Domain',
      render: (standard) => (
        <Typography variant="body2" sx={{ textTransform: 'capitalize' }}>
          {standard.domain || '-'}
        </Typography>
      ),
    },
    {
      key: 'publisher',
      header: 'Publisher',
      render: (standard) => standard.publisher || '-',
    },
    {
      key: 'isActive',
      header: 'Status',
      render: (standard) => (
        <Chip
          label={standard.isActive ? 'Active' : 'Inactive'}
          size="small"
          color={standard.isActive ? 'success' : 'default'}
        />
      ),
    },
    {
      key: 'createdAt',
      header: 'Created',
      render: (standard) => formatDate(standard.createdAt),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (standard) => (
        <Box display="flex" gap={0.5}>
          <Tooltip title="View Details">
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                handleViewStandard(standard);
              }}
            >
              <ViewIcon />
            </IconButton>
          </Tooltip>
        </Box>
      ),
    },
  ], [handleViewStandard]);

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
        config={STANDARDS_FILTER_CONFIG}
        initialFilter={advancedFilter}
        onApply={handleAdvancedFilterApply}
        onClear={handleAdvancedFilterClear}
        activeFilterCount={activeAdvancedFilterCount}
      />
    </Box>
  ), [advancedFilter, handleAdvancedFilterApply, handleAdvancedFilterClear, activeAdvancedFilterCount]);

  return (
    <GenericListPage<Standard>
      title="Standards Library"
      icon={<StandardsIcon />}
      items={items}
      columns={columns}
      total={total}
      page={page}
      pageSize={pageSize}
      isLoading={isLoading}
      error={error}
      search={search}
      onPageChange={setPage}
      onPageSizeChange={setPageSize}
      onSearchChange={setSearch}
      onRefresh={refetch}
      getRowKey={(standard) => standard.id}
      searchPlaceholder="Search standards..."
      emptyMessage="No standards found"
      emptyFilteredMessage="Try adjusting your filters or search query"
      filters={getActiveFilters()}
      onFilterRemove={handleFilterRemove}
      onClearFilters={handleClearFilters}
      toolbarActions={toolbarActions}
      minTableWidth={900}
      testId="standards-library-page"
      onRowClick={handleViewStandard}
    />
  );
};

export default StandardsLibrary;
