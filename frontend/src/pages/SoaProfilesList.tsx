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
  Button,
} from '@mui/material';
import {
  Visibility as ViewIcon,
  Add as AddIcon,
  PlaylistAddCheck as SoaIcon,
} from '@mui/icons-material';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { soaApi, SoaProfileData, SoaProfileStatus, standardsLibraryApi } from '../services/grcClient';
import { useAuth } from '../contexts/AuthContext';
import {
  GenericListPage,
  ColumnDefinition,
  FilterOption,
} from '../components/common';
import { useUniversalList } from '../hooks/useUniversalList';

const getStatusColor = (status: SoaProfileStatus): 'error' | 'warning' | 'info' | 'success' | 'default' => {
  switch (status) {
    case 'PUBLISHED': return 'success';
    case 'DRAFT': return 'info';
    case 'ARCHIVED': return 'default';
    default: return 'default';
  }
};

const formatStatus = (status: SoaProfileStatus): string => {
  return status.charAt(0) + status.slice(1).toLowerCase();
};

const formatDate = (dateString: string | null): string => {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleDateString();
};

interface StandardOption {
  id: string;
  name: string;
}

export const SoaProfilesList: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [standards, setStandards] = React.useState<StandardOption[]>([]);
  
  const tenantId = user?.tenantId || '';
  
  const statusFilter = searchParams.get('status') || '';
  const standardIdFilter = searchParams.get('standardId') || '';

  React.useEffect(() => {
    const fetchStandards = async () => {
      if (!tenantId) return;
      try {
        const response = await standardsLibraryApi.list(tenantId, { pageSize: 100 });
        setStandards(response.items.map(s => ({ id: s.id, name: s.name })));
      } catch (error) {
        console.error('Failed to fetch standards:', error);
      }
    };
    fetchStandards();
  }, [tenantId]);

  const additionalFilters = useMemo(() => {
    const filters: Record<string, unknown> = {};
    if (statusFilter) filters.status = statusFilter;
    if (standardIdFilter) filters.standardId = standardIdFilter;
    return filters;
  }, [statusFilter, standardIdFilter]);

  const fetchProfiles = useCallback((params: Record<string, unknown>) => {
    return soaApi.listProfiles(tenantId, params as Parameters<typeof soaApi.listProfiles>[1]);
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
  } = useUniversalList<SoaProfileData>({
    fetchFn: fetchProfiles,
    defaultPageSize: 10,
    defaultSort: 'updatedAt:DESC',
    syncToUrl: true,
    enabled: isAuthReady,
    additionalFilters,
  });

  const handleViewProfile = useCallback((profile: SoaProfileData) => {
    navigate(`/soa/${profile.id}`);
  }, [navigate]);

  const handleCreateProfile = useCallback(() => {
    navigate('/soa/new');
  }, [navigate]);

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

  const handleStandardChange = useCallback((value: string) => {
    updateFilter('standardId', value);
  }, [updateFilter]);

  const getActiveFilters = useCallback((): FilterOption[] => {
    const filters: FilterOption[] = [];
    if (statusFilter) {
      filters.push({ key: 'status', label: 'Status', value: formatStatus(statusFilter as SoaProfileStatus) });
    }
    if (standardIdFilter) {
      const standard = standards.find(s => s.id === standardIdFilter);
      filters.push({ key: 'standardId', label: 'Standard', value: standard?.name || standardIdFilter.substring(0, 8) + '...' });
    }
    return filters;
  }, [statusFilter, standardIdFilter, standards]);

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

  const columns: ColumnDefinition<SoaProfileData>[] = useMemo(() => [
    {
      key: 'name',
      header: 'Name',
      render: (profile) => (
        <Typography 
          variant="body2" 
          fontWeight="medium"
          component="span"
          onClick={() => handleViewProfile(profile)}
          sx={{ 
            color: 'primary.main',
            cursor: 'pointer',
            '&:hover': { 
              textDecoration: 'underline',
              color: 'primary.dark',
            },
          }}
        >
          {profile.name}
        </Typography>
      ),
    },
    {
      key: 'standard',
      header: 'Standard',
      render: (profile) => (
        <Typography variant="body2">
          {profile.standard?.name || '-'}
        </Typography>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (profile) => (
        <Chip
          label={formatStatus(profile.status)}
          size="small"
          color={getStatusColor(profile.status)}
        />
      ),
    },
    {
      key: 'version',
      header: 'Version',
      render: (profile) => (
        <Typography variant="body2">
          v{profile.version}
        </Typography>
      ),
    },
    {
      key: 'publishedAt',
      header: 'Published',
      render: (profile) => formatDate(profile.publishedAt),
    },
    {
      key: 'updatedAt',
      header: 'Updated',
      render: (profile) => formatDate(profile.updatedAt),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (profile) => (
        <Tooltip title="View Details">
          <IconButton
            size="small"
            onClick={() => handleViewProfile(profile)}
          >
            <ViewIcon />
          </IconButton>
        </Tooltip>
      ),
    },
  ], [handleViewProfile]);

  const toolbarActions = useMemo(() => (
    <Box display="flex" gap={1} alignItems="center">
      <FormControl size="small" sx={{ minWidth: 120 }}>
        <InputLabel>Status</InputLabel>
        <Select
          value={statusFilter}
          label="Status"
          onChange={(e) => handleStatusChange(e.target.value)}
        >
          <MenuItem value="">All</MenuItem>
          <MenuItem value="DRAFT">Draft</MenuItem>
          <MenuItem value="PUBLISHED">Published</MenuItem>
          <MenuItem value="ARCHIVED">Archived</MenuItem>
        </Select>
      </FormControl>
      <FormControl size="small" sx={{ minWidth: 180 }}>
        <InputLabel>Standard</InputLabel>
        <Select
          value={standardIdFilter}
          label="Standard"
          onChange={(e) => handleStandardChange(e.target.value)}
        >
          <MenuItem value="">All Standards</MenuItem>
          {standards.map((standard) => (
            <MenuItem key={standard.id} value={standard.id}>{standard.name}</MenuItem>
          ))}
        </Select>
      </FormControl>
      <Button
        variant="contained"
        startIcon={<AddIcon />}
        onClick={handleCreateProfile}
        size="small"
      >
        New SOA Profile
      </Button>
    </Box>
  ), [statusFilter, standardIdFilter, standards, handleStatusChange, handleStandardChange, handleCreateProfile]);

  return (
    <GenericListPage<SoaProfileData>
      title="Statement of Applicability"
      icon={<SoaIcon />}
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
      getRowKey={(profile) => profile.id}
      searchPlaceholder="Search SOA profiles..."
      emptyMessage="No SOA profiles found"
      emptyFilteredMessage="Try adjusting your filters or search query"
      filters={getActiveFilters()}
      onFilterRemove={handleFilterRemove}
      onClearFilters={handleClearFilters}
      toolbarActions={toolbarActions}
      minTableWidth={800}
    />
  );
};

export default SoaProfilesList;
