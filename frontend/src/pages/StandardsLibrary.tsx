import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TablePagination,
  Chip,
  IconButton,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  InputAdornment,
  Collapse,
} from '@mui/material';
import {
  Search as SearchIcon,
  Visibility as ViewIcon,
  FilterList as FilterIcon,
  Clear as ClearIcon,
  LibraryBooks as StandardsIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { standardsApi, unwrapResponse } from '../services/grcClient';
import { LoadingState, ErrorState, EmptyState, ResponsiveTable } from '../components/common';
import {
  normalizeFiltersData,
  normalizeRequirementsResponse,
  DEFAULT_FILTERS_DATA,
  FiltersData,
  StandardRequirement,
} from '../api/normalizers/standards';

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
  const [showFilters, setShowFilters] = useState(true);
  
  const [filters, setFilters] = useState({
    search: '',
    family: '',
    version: '',
    domain: '',
    category: '',
    hierarchyLevel: '',
  });
  
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [totalCount, setTotalCount] = useState(0);

  const fetchFiltersData = useCallback(async () => {
    try {
      const response = await standardsApi.getFilters();
      const rawData = unwrapResponse<unknown>(response);
      const normalized = normalizeFiltersData(rawData);
      setFiltersData(normalized);
    } catch (err) {
      console.error('Failed to fetch filters:', err);
      setFiltersData(DEFAULT_FILTERS_DATA);
    }
  }, []);

  const fetchRequirements = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      
      const params = new URLSearchParams();
      params.set('page', String(page + 1));
      params.set('limit', String(rowsPerPage));
      
      if (filters.search) params.set('search', filters.search);
      if (filters.family) params.set('family', filters.family);
      if (filters.version) params.set('version', filters.version);
      if (filters.domain) params.set('domain', filters.domain);
      if (filters.category) params.set('category', filters.category);
      if (filters.hierarchyLevel) params.set('hierarchy_level', filters.hierarchyLevel);
      
      const response = await standardsApi.list(params);
      const { items, total } = normalizeRequirementsResponse(response.data);
      setRequirements(items);
      setTotalCount(total);
    } catch (err: unknown) {
      const error = err as { response?: { status?: number; data?: { message?: string } } };
      if (error.response?.status === 404) {
        setRequirements([]);
        setTotalCount(0);
      } else {
        setError(error.response?.data?.message || 'Failed to fetch standards');
        setRequirements([]);
        setTotalCount(0);
      }
    } finally {
      setLoading(false);
    }
  }, [page, rowsPerPage, filters]);

  useEffect(() => {
    fetchFiltersData();
  }, [fetchFiltersData]);

  useEffect(() => {
    fetchRequirements();
  }, [fetchRequirements]);

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
        onRetry={fetchRequirements}
      />
    );
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">Standards Library</Typography>
        <Button
          variant="outlined"
          startIcon={<FilterIcon />}
          onClick={() => setShowFilters(!showFilters)}
        >
          {showFilters ? 'Hide Filters' : 'Show Filters'}
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Collapse in={showFilters}>
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  size="small"
                  label="Search"
                  placeholder="Search by code, title, or description..."
                  value={filters.search}
                  onChange={(e) => handleFilterChange('search', e.target.value)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon />
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>
              <Grid item xs={12} sm={6} md={2}>
                <FormControl fullWidth size="small">
                  <InputLabel>Family</InputLabel>
                  <Select
                    value={filters.family}
                    label="Family"
                    onChange={(e) => handleFilterChange('family', e.target.value)}
                  >
                    <MenuItem value="">All</MenuItem>
                    {filtersData.families.map((family) => (
                      <MenuItem key={family} value={family}>
                        {FAMILY_LABELS[family] || family}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6} md={2}>
                <FormControl fullWidth size="small">
                  <InputLabel>Version</InputLabel>
                  <Select
                    value={filters.version}
                    label="Version"
                    onChange={(e) => handleFilterChange('version', e.target.value)}
                  >
                    <MenuItem value="">All</MenuItem>
                    {filtersData.versions.map((version) => (
                      <MenuItem key={version} value={version}>
                        {version}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6} md={2}>
                <FormControl fullWidth size="small">
                  <InputLabel>Domain</InputLabel>
                  <Select
                    value={filters.domain}
                    label="Domain"
                    onChange={(e) => handleFilterChange('domain', e.target.value)}
                  >
                    <MenuItem value="">All</MenuItem>
                    {filtersData.domains.map((domain) => (
                      <MenuItem key={domain} value={domain}>
                        {domain}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6} md={2}>
                {hasActiveFilters && (
                  <Button
                    variant="text"
                    startIcon={<ClearIcon />}
                    onClick={handleClearFilters}
                  >
                    Clear Filters
                  </Button>
                )}
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      </Collapse>

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
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TablePagination,
  Chip,
  IconButton,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
} from '@mui/material';
import {
  Visibility as ViewIcon,
  LibraryBooks as StandardsIcon,
} from '@mui/icons-material';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { standardsApi, unwrapResponse } from '../services/grcClient';
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
  const DEFAULT_SORT = 'code:ASC'; // Standards için genelde code'a göre sıralama mantıklı
  const DEFAULT_PAGE = 1;
  const DEFAULT_PAGE_SIZE = 25; // StandardsLibrary için default 25

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

  // Update URL params when filters/sort/page change
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

    setSearchParams(params, { replace: true });
  }, [page, rowsPerPage, filters, sortField, sortDirection, buildFilter, setSearchParams]);

  const fetchRequirements = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      
      const filter = buildFilter();
      const params = buildListQueryParams({
        page: page + 1,
        limit: rowsPerPage, // API limit kullanıyor
        search: filters.search,
        family: filters.family || undefined,
        version: filters.version || undefined,
        domain: filters.domain || undefined,
        category: filters.category || undefined,
        hierarchy_level: filters.hierarchyLevel || undefined,
        filter: filter || undefined,
        sort: formatSortToQuery(sortField, sortDirection),
      });
      
      const response = await standardsApi.list(params);
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
      const error = err as { response?: { status?: number; data?: { message?: string } } };
      if (error.response?.status === 404) {
        setRequirements([]);
        setTotalCount(0);
      } else {
        setError(error.response?.data?.message || 'Failed to fetch standards');
      }
    } finally {
      setLoading(false);
    }
  }, [page, rowsPerPage, filters, sortField, sortDirection, buildFilter]);

  useEffect(() => {
    fetchFiltersData();
  }, [fetchFiltersData]);

  useEffect(() => {
    fetchRequirements();
  }, [fetchRequirements]);

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
        onRetry={fetchRequirements}
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
        searchValue={filters.search}
        onSearchChange={(value) => {
          handleFilterChange('search', value);
        }}
        searchPlaceholder="Search by code, title, or description..."
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
        filterFields={[
          {
            key: 'family',
            label: 'Family',
            type: 'select',
            options: filtersData.families.map((family) => ({
              value: family,
              label: FAMILY_LABELS[family] || family,
            })),
          },
          {
            key: 'version',
            label: 'Version',
            type: 'select',
            options: filtersData.versions.map((version) => ({
              value: version,
              label: version,
            })),
          },
          {
            key: 'domain',
            label: 'Domain',
            type: 'select',
            options: filtersData.domains.map((domain) => ({
              value: domain,
              label: domain,
            })),
          },
          ...(filtersData.categories.length > 0 ? [{
            key: 'category',
            label: 'Category',
            type: 'select' as const,
            options: filtersData.categories.map((category) => ({
              value: category,
              label: category,
            })),
          }] : []),
          ...(filtersData.hierarchyLevels.length > 0 ? [{
            key: 'hierarchyLevel',
            label: 'Hierarchy Level',
            type: 'select' as const,
            options: filtersData.hierarchyLevels.map((level) => ({
              value: level,
              label: level,
            })),
          }] : []),
        ]}
        onFilterChange={(key, value) => {
          handleFilterChange(key, value);
        }}
        sortField={sortField}
        sortDirection={sortDirection}
        onSortChange={(field, direction) => {
          setSortField(field);
          setSortDirection(direction);
        }}
        sortOptions={[
          { field: 'code', label: 'Code' },
          { field: 'title', label: 'Title' },
          { field: 'family', label: 'Family' },
          { field: 'version', label: 'Version' },
          { field: 'domain', label: 'Domain' },
        ]}
        defaultSortField="code"
        defaultSortDirection="ASC"
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
