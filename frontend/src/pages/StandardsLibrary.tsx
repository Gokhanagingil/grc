import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TablePagination,
  Chip,
  IconButton,
  Alert,
} from '@mui/material';
import {
  Visibility as ViewIcon,
  LibraryBooks as StandardsIcon,
} from '@mui/icons-material';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { standardsApi, unwrapResponse } from '../services/grcClient';
import { ApiError } from '../services/api';
import { LoadingState, ErrorState, EmptyState, ResponsiveTable, ListToolbar } from '../components/common';
import { buildListQueryParams, buildListQueryParamsWithDefaults, parseFilterFromQuery, parseSortFromQuery, formatSortToQuery } from '../utils';

interface StandardRequirement {
  id: string;
  code: string;
  title: string;
  description: string;
  family: string;
  version: string;
  hierarchy_level: string;
  domain: string;
  category: string;
  regulation: string;
  status: string;
  metadata_tags?: Array<{ id: string; value: string; color: string }>;
}

interface FiltersData {
  families: string[];
  versions: string[];
  domains: string[];
  categories: string[];
  hierarchyLevels: string[];
}

const FAMILY_LABELS: Record<string, string> = {
  iso27001: 'ISO 27001',
  iso27002: 'ISO 27002',
  iso20000: 'ISO 20000',
  iso9001: 'ISO 9001',
  cobit2019: 'COBIT 2019',
  nistcsf: 'NIST CSF',
  kvkk: 'KVKK',
  gdpr: 'GDPR',
};

const getFamilyColor = (family: string): 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info' | 'default' => {
  switch (family) {
    case 'iso27001':
    case 'iso27002':
      return 'primary';
    case 'iso20000':
    case 'iso9001':
      return 'info';
    case 'cobit2019':
      return 'secondary';
    case 'nistcsf':
      return 'success';
    case 'kvkk':
    case 'gdpr':
      return 'warning';
    default:
      return 'default';
  }
};

export const StandardsLibrary: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Default values - StandardsLibrary için özel
  const DEFAULT_SORT = 'code:ASC';
  const DEFAULT_PAGE = 1;
  const DEFAULT_PAGE_SIZE = 25;

  // Read initial values from URL
  const pageParam = parseInt(searchParams.get('page') || '1', 10);
  const pageSizeParam = parseInt(searchParams.get('pageSize') || String(DEFAULT_PAGE_SIZE), 10);
  const sortParam = searchParams.get('sort') || DEFAULT_SORT;
  const searchParam = searchParams.get('search') || '';
  const filterParam = parseFilterFromQuery(searchParams.get('filter'));

  const parsedSort = parseSortFromQuery(sortParam) || { field: 'code', direction: 'ASC' as const };

  const [requirements, setRequirements] = useState<StandardRequirement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filtersData, setFiltersData] = useState<FiltersData>({
    families: [],
    versions: [],
    domains: [],
    categories: [],
    hierarchyLevels: [],
  });
  
  const [filters, setFilters] = useState({
    search: searchParam,
    family: (filterParam?.family as string) || '',
    version: (filterParam?.version as string) || '',
    domain: (filterParam?.domain as string) || '',
    category: (filterParam?.category as string) || '',
    hierarchyLevel: (filterParam?.hierarchy_level as string) || '',
  });
  
  const [page, setPage] = useState(Math.max(0, pageParam - 1));
  const [rowsPerPage, setRowsPerPage] = useState(pageSizeParam);
  const [totalCount, setTotalCount] = useState(0);
  const [sortField, setSortField] = useState(parsedSort.field);
  const [sortDirection, setSortDirection] = useState<'ASC' | 'DESC'>(parsedSort.direction);

  // Request storm prevention: refs for deduplication and cancellation
  const lastQueryParamsRef = useRef<string>('');
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchFiltersData = useCallback(async () => {
    try {
      const response = await standardsApi.getFilters();
      const data = unwrapResponse<FiltersData>(response);
      setFiltersData(data || {
        families: [],
        versions: [],
        domains: [],
        categories: [],
        hierarchyLevels: [],
      });
    } catch (err) {
      console.error('Failed to fetch filters:', err);
    }
  }, []);

  // Build filter object for API (canonical format)
  const buildFilter = useCallback(() => {
    const conditions: Array<Record<string, unknown>> = [];
    
    if (filters.family) {
      conditions.push({ field: 'family', operator: 'eq', value: filters.family });
    }
    if (filters.version) {
      conditions.push({ field: 'version', operator: 'eq', value: filters.version });
    }
    if (filters.domain) {
      conditions.push({ field: 'domain', operator: 'eq', value: filters.domain });
    }
    if (filters.category) {
      conditions.push({ field: 'category', operator: 'eq', value: filters.category });
    }
    if (filters.hierarchyLevel) {
      conditions.push({ field: 'hierarchy_level', operator: 'eq', value: filters.hierarchyLevel });
    }

    if (conditions.length === 0) {
      return null;
    }

    return { and: conditions };
  }, [filters.family, filters.version, filters.domain, filters.category, filters.hierarchyLevel]);

  // Update URL params when filters/sort/page change (single source of truth)
  useEffect(() => {
    const filter = buildFilter();
    const sortStr = formatSortToQuery(sortField, sortDirection);
    
    const params = buildListQueryParamsWithDefaults(
      {
        page: page + 1,
        pageSize: rowsPerPage,
        filter,
        sort: sortStr !== DEFAULT_SORT ? sortStr : null,
        search: filters.search || null,
      },
      {
        page: DEFAULT_PAGE,
        pageSize: DEFAULT_PAGE_SIZE,
        sort: DEFAULT_SORT,
        filter: null,
      }
    );

    // Only update URL if it changed (prevents unnecessary updates)
    const queryString = new URLSearchParams(params).toString();
    const currentUrlParams = searchParams.toString();
    if (queryString !== currentUrlParams) {
      setSearchParams(params, { replace: true });
    }
  }, [page, rowsPerPage, filters, sortField, sortDirection, buildFilter, setSearchParams, searchParams]);

  // Fetch requirements function with dedupe and cancellation support
  const fetchRequirements = useCallback(async (force = false) => {
    // Read values from URL (single source of truth)
    const currentPage = parseInt(searchParams.get('page') || '1', 10);
    const currentPageSize = parseInt(searchParams.get('pageSize') || String(DEFAULT_PAGE_SIZE), 10);
    const currentSort = searchParams.get('sort') || DEFAULT_SORT;
    const currentSearch = searchParams.get('search') || '';
    const currentFilterParam = parseFilterFromQuery(searchParams.get('filter'));
    
    const currentFilters = {
      search: currentSearch,
      family: (currentFilterParam?.family as string) || '',
      version: (currentFilterParam?.version as string) || '',
      domain: (currentFilterParam?.domain as string) || '',
      category: (currentFilterParam?.category as string) || '',
      hierarchyLevel: (currentFilterParam?.hierarchy_level as string) || '',
    };

    const parsedSort = parseSortFromQuery(currentSort) || { field: 'code', direction: 'ASC' as const };

    // Build filter for API
    const conditions: Array<Record<string, unknown>> = [];
    if (currentFilters.family) {
      conditions.push({ field: 'family', operator: 'eq', value: currentFilters.family });
    }
    if (currentFilters.version) {
      conditions.push({ field: 'version', operator: 'eq', value: currentFilters.version });
    }
    if (currentFilters.domain) {
      conditions.push({ field: 'domain', operator: 'eq', value: currentFilters.domain });
    }
    if (currentFilters.category) {
      conditions.push({ field: 'category', operator: 'eq', value: currentFilters.category });
    }
    if (currentFilters.hierarchyLevel) {
      conditions.push({ field: 'hierarchy_level', operator: 'eq', value: currentFilters.hierarchyLevel });
    }
    const filter = conditions.length > 0 ? { and: conditions } : null;

    // Build query params string for deduplication
    const apiParams = buildListQueryParams({
      page: currentPage,
      limit: currentPageSize,
      search: currentFilters.search || undefined,
      filter: filter || undefined,
      sort: { field: parsedSort.field, direction: parsedSort.direction },
    });
    const queryString = new URLSearchParams(apiParams).toString();

    // Dedupe: Skip fetch if query params haven't changed (unless forced)
    if (!force && queryString === lastQueryParamsRef.current) {
      return;
    }
    lastQueryParamsRef.current = queryString;

    // Cancel previous request if still in flight
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new AbortController for this request
    abortControllerRef.current = new AbortController();

    try {
      setLoading(true);
      setError('');

      const response = await standardsApi.list(apiParams);

      // Check if request was cancelled
      if (abortControllerRef.current?.signal.aborted) {
        return;
      }

      const data = response.data;
      
      if (data && data.success) {
        setRequirements(data.data || []);
        setTotalCount(data.pagination?.total || 0);
      } else if (Array.isArray(data)) {
        setRequirements(data);
        setTotalCount(data.length);
      } else {
        setRequirements([]);
        setTotalCount(0);
      }
    } catch (err: unknown) {
      // Ignore cancellation errors
      if (err && typeof err === 'object' && 'name' in err && (err.name === 'AbortError' || err.name === 'CanceledError')) {
        return;
      }
      if (err && typeof err === 'object' && 'message' in err && String(err.message).includes('cancel')) {
        return;
      }

      // Handle 429 Rate Limit errors with user-friendly message
      if (err instanceof ApiError && err.code === 'RATE_LIMITED') {
        const retryAfter = (err.details?.retryAfter as number) || 60;
        setError(`Çok fazla istek yapıldı. ${retryAfter} saniye sonra tekrar deneyin. (Önceki veriler korunuyor)`);
        // Don't clear requirements - keep previous data
        setLoading(false);
        return;
      }

      const error = err as { response?: { status?: number; data?: { message?: string } } };
      if (error.response?.status === 404) {
        setRequirements([]);
        setTotalCount(0);
      } else {
        setError(error.response?.data?.message || 'Failed to fetch standards');
        // Don't clear requirements on error - keep previous data visible
      }
      setLoading(false);
    }
  }, [searchParams]);

  // Fetch when URL params change (triggered by URL update)
  useEffect(() => {
    fetchRequirements();
  }, [fetchRequirements]);

  // Fetch filters data on mount
  useEffect(() => {
    fetchFiltersData();
  }, [fetchFiltersData]);

  const handleFilterChange = (field: string, value: string) => {
    setFilters(prev => ({ ...prev, [field]: value }));
    setPage(0);
  };

  const handleClearFilters = () => {
    setFilters({
      search: '',
      family: '',
      version: '',
      domain: '',
      category: '',
      hierarchyLevel: '',
    });
    setPage(0);
  };

  const handleViewRequirement = (id: string) => {
    navigate(`/standards/${id}`);
  };

  const handleChangePage = (_: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const hasActiveFilters = Object.values(filters).some(v => v !== '');

  if (loading && requirements.length === 0) {
    return <LoadingState message="Loading standards library..." />;
  }

  if (error && requirements.length === 0) {
    return (
      <ErrorState
        title="Failed to load standards"
        message={error}
        onRetry={() => fetchRequirements(true)}
      />
    );
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">Standards Library</Typography>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <ListToolbar
        search={filters.search}
        onSearchChange={(value) => {
          handleFilterChange('search', value);
        }}
        searchPlaceholder="Search by code, title, or description..."
        searchDebounceMs={800}
        sort={formatSortToQuery(sortField, sortDirection)}
        onSortChange={(sort) => {
          const parsed = parseSortFromQuery(sort);
          if (parsed) {
            setSortField(parsed.field);
            setSortDirection(parsed.direction);
          }
        }}
        sortOptions={[
          { field: 'code', label: 'Code' },
          { field: 'title', label: 'Title' },
          { field: 'family', label: 'Family' },
          { field: 'version', label: 'Version' },
          { field: 'domain', label: 'Domain' },
        ]}
        pageSize={rowsPerPage}
        onPageSizeChange={(size) => {
          setRowsPerPage(size);
          setPage(0);
        }}
        filters={[
          ...(filters.family ? [{ key: 'family', label: 'Family', value: FAMILY_LABELS[filters.family] || filters.family }] : []),
          ...(filters.version ? [{ key: 'version', label: 'Version', value: filters.version }] : []),
          ...(filters.domain ? [{ key: 'domain', label: 'Domain', value: filters.domain }] : []),
          ...(filters.category ? [{ key: 'category', label: 'Category', value: filters.category }] : []),
          ...(filters.hierarchyLevel ? [{ key: 'hierarchyLevel', label: 'Level', value: filters.hierarchyLevel }] : []),
        ]}
        onFilterRemove={(key) => {
          if (key === 'family') handleFilterChange('family', '');
          if (key === 'version') handleFilterChange('version', '');
          if (key === 'domain') handleFilterChange('domain', '');
          if (key === 'category') handleFilterChange('category', '');
          if (key === 'hierarchyLevel') handleFilterChange('hierarchyLevel', '');
        }}
        onClearFilters={handleClearFilters}
        loading={loading}
      />

      <Card>
        <CardContent>
          <ResponsiveTable minWidth={900}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Code</TableCell>
                  <TableCell>Title</TableCell>
                  <TableCell>Family</TableCell>
                  <TableCell>Version</TableCell>
                  <TableCell>Domain</TableCell>
                  <TableCell>Level</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {requirements.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center" sx={{ py: 0, border: 'none' }}>
                      <EmptyState
                        icon={<StandardsIcon sx={{ fontSize: 64, color: 'text.disabled' }} />}
                        title="No standards found"
                        message={hasActiveFilters 
                          ? "No standards match your current filters. Try adjusting your search criteria."
                          : "No standards have been imported yet. Run the standards importer to populate the library."
                        }
                        minHeight="200px"
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  requirements.map((req) => (
                    <TableRow key={req.id} hover>
                      <TableCell>
                        <Typography variant="body2" fontWeight="medium">
                          {req.code}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" noWrap sx={{ maxWidth: 300 }}>
                          {req.title}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={FAMILY_LABELS[req.family] || req.family}
                          size="small"
                          color={getFamilyColor(req.family)}
                        />
                      </TableCell>
                      <TableCell>{req.version}</TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ textTransform: 'capitalize' }}>
                          {req.domain || '-'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ textTransform: 'capitalize' }}>
                          {req.hierarchy_level || '-'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <IconButton
                          size="small"
                          onClick={() => handleViewRequirement(req.id)}
                          title="View Details"
                        >
                          <ViewIcon />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </ResponsiveTable>
          {requirements.length > 0 && (
            <TablePagination
              component="div"
              count={totalCount}
              page={page}
              onPageChange={handleChangePage}
              rowsPerPage={rowsPerPage}
              onRowsPerPageChange={handleChangeRowsPerPage}
              rowsPerPageOptions={[10, 25, 50, 100]}
            />
          )}
        </CardContent>
      </Card>
    </Box>
  );
};

export default StandardsLibrary;
