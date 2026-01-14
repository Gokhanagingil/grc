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
  Description as EvidenceIcon,
} from '@mui/icons-material';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { evidenceApi, EvidenceData, CreateEvidenceDto } from '../services/grcClient';
import { useAuth } from '../contexts/AuthContext';
import { GenericListPage, ColumnDefinition, FilterOption } from '../components/common';
import { GrcFrameworkWarningBanner } from '../components/onboarding';
import { useUniversalList } from '../hooks/useUniversalList';

export enum EvidenceType {
  DOCUMENT = 'document',
  SCREENSHOT = 'screenshot',
  LOG = 'log',
  REPORT = 'report',
  CONFIG_EXPORT = 'config_export',
  LINK = 'link',
  OTHER = 'other',
}

export enum EvidenceSourceType {
  MANUAL = 'manual',
  URL = 'url',
  SYSTEM = 'system',
}

export enum EvidenceStatus {
  DRAFT = 'draft',
  APPROVED = 'approved',
  RETIRED = 'retired',
}

const getStatusColor = (status: string): 'error' | 'warning' | 'info' | 'success' | 'default' => {
  switch (status) {
    case EvidenceStatus.APPROVED: return 'success';
    case EvidenceStatus.DRAFT: return 'default';
    case EvidenceStatus.RETIRED: return 'error';
    default: return 'default';
  }
};

const getTypeColor = (type: string): 'error' | 'warning' | 'info' | 'success' | 'default' => {
  switch (type) {
    case EvidenceType.DOCUMENT: return 'info';
    case EvidenceType.SCREENSHOT: return 'warning';
    case EvidenceType.LOG: return 'success';
    case EvidenceType.REPORT: return 'info';
    case EvidenceType.LINK: return 'warning';
    default: return 'default';
  }
};

const formatStatus = (status: string): string => {
  return status.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
};

const formatType = (type: string): string => {
  return type.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
};

const formatDate = (dateString: string | null | undefined): string => {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleDateString();
};

export const EvidenceList: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newEvidence, setNewEvidence] = useState<CreateEvidenceDto>({
    name: '',
    description: '',
    type: EvidenceType.DOCUMENT,
    sourceType: EvidenceSourceType.MANUAL,
    status: EvidenceStatus.DRAFT,
  });
  
  const tenantId = user?.tenantId || '';
  
  const statusFilter = searchParams.get('status') || '';
  const typeFilter = searchParams.get('type') || '';

  const additionalFilters = useMemo(() => {
    const filters: Record<string, unknown> = {};
    if (statusFilter) filters.status = statusFilter;
    if (typeFilter) filters.type = typeFilter;
    return filters;
  }, [statusFilter, typeFilter]);

  const fetchEvidence = useCallback((params: Record<string, unknown>) => {
    return evidenceApi.list(tenantId, params);
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
  } = useUniversalList<EvidenceData>({
    fetchFn: fetchEvidence,
    defaultPageSize: 10,
    defaultSort: 'createdAt:DESC',
    syncToUrl: true,
    enabled: isAuthReady,
    additionalFilters,
  });

  const handleViewEvidence = useCallback((evidence: EvidenceData) => {
    navigate(`/evidence/${evidence.id}`);
  }, [navigate]);

  const handleDeleteEvidence = useCallback(async (evidence: EvidenceData) => {
    if (window.confirm(`Are you sure you want to delete "${evidence.name}"?`)) {
      try {
        await evidenceApi.delete(tenantId, evidence.id);
        refetch();
      } catch (err) {
        console.error('Failed to delete evidence:', err);
      }
    }
  }, [tenantId, refetch]);

  const handleCreateEvidence = useCallback(async () => {
    try {
      await evidenceApi.create(tenantId, newEvidence);
      setCreateDialogOpen(false);
      setNewEvidence({
        name: '',
        description: '',
        type: EvidenceType.DOCUMENT,
        sourceType: EvidenceSourceType.MANUAL,
        status: EvidenceStatus.DRAFT,
      });
      refetch();
    } catch (err) {
      console.error('Failed to create evidence:', err);
    }
  }, [tenantId, newEvidence, refetch]);

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

  const handleTypeChange = useCallback((value: string) => {
    updateFilter('type', value);
  }, [updateFilter]);

  const getActiveFilters = useCallback((): FilterOption[] => {
    const filters: FilterOption[] = [];
    if (statusFilter) {
      filters.push({ key: 'status', label: 'Status', value: formatStatus(statusFilter) });
    }
    if (typeFilter) {
      filters.push({ key: 'type', label: 'Type', value: formatType(typeFilter) });
    }
    return filters;
  }, [statusFilter, typeFilter]);

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

  const columns: ColumnDefinition<EvidenceData>[] = useMemo(() => [
    {
      key: 'name',
      header: 'Name',
      render: (evidence) => (
        <Tooltip title={evidence.description || ''}>
          <Typography 
            variant="body2" 
            sx={{ maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
          >
            {evidence.name}
          </Typography>
        </Tooltip>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      render: (evidence) => (
        <Chip
          label={formatType(evidence.type)}
          size="small"
          color={getTypeColor(evidence.type)}
        />
      ),
    },
    {
      key: 'sourceType',
      header: 'Source',
      render: (evidence) => formatType(evidence.sourceType || 'manual'),
    },
    {
      key: 'status',
      header: 'Status',
      render: (evidence) => (
        <Chip
          label={formatStatus(evidence.status)}
          size="small"
          color={getStatusColor(evidence.status)}
        />
      ),
    },
    {
      key: 'collectedAt',
      header: 'Collected',
      render: (evidence) => formatDate(evidence.collectedAt),
    },
    {
      key: 'createdAt',
      header: 'Created',
      render: (evidence) => formatDate(evidence.createdAt),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (evidence) => (
        <Box display="flex" gap={0.5}>
          <Tooltip title="View Details">
            <IconButton
              size="small"
              onClick={() => handleViewEvidence(evidence)}
            >
              <ViewIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Delete">
            <IconButton
              size="small"
              onClick={() => handleDeleteEvidence(evidence)}
              color="error"
            >
              <DeleteIcon />
            </IconButton>
          </Tooltip>
        </Box>
      ),
    },
  ], [handleViewEvidence, handleDeleteEvidence]);

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
          {Object.values(EvidenceStatus).map((status) => (
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
          {Object.values(EvidenceType).map((type) => (
            <MenuItem key={type} value={type}>{formatType(type)}</MenuItem>
          ))}
        </Select>
      </FormControl>
      <Button
        variant="contained"
        startIcon={<AddIcon />}
        onClick={() => setCreateDialogOpen(true)}
      >
        Add Evidence
      </Button>
    </Box>
  ), [statusFilter, typeFilter, handleStatusChange, handleTypeChange]);

  return (
    <>
            <GenericListPage<EvidenceData>
              title="Evidence Library"
              icon={<EvidenceIcon />}
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
              getRowKey={(evidence) => evidence.id}
              searchPlaceholder="Search evidence..."
              emptyMessage="No evidence found"
              emptyFilteredMessage="Try adjusting your filters or search query"
              filters={getActiveFilters()}
              onFilterRemove={handleFilterRemove}
              onClearFilters={handleClearFilters}
              toolbarActions={toolbarActions}
              banner={<GrcFrameworkWarningBanner />}
              minTableWidth={900}
              testId="evidence-list-page"
            />

      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add New Evidence</DialogTitle>
        <DialogContent>
          <Box display="flex" flexDirection="column" gap={2} mt={1}>
            <TextField
              label="Name"
              value={newEvidence.name}
              onChange={(e) => setNewEvidence({ ...newEvidence, name: e.target.value })}
              fullWidth
              required
            />
            <TextField
              label="Description"
              value={newEvidence.description}
              onChange={(e) => setNewEvidence({ ...newEvidence, description: e.target.value })}
              fullWidth
              multiline
              rows={3}
            />
            <FormControl fullWidth>
              <InputLabel>Type</InputLabel>
              <Select
                value={newEvidence.type}
                label="Type"
                onChange={(e) => setNewEvidence({ ...newEvidence, type: e.target.value })}
              >
                {Object.values(EvidenceType).map((type) => (
                  <MenuItem key={type} value={type}>{formatType(type)}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel>Source Type</InputLabel>
              <Select
                value={newEvidence.sourceType}
                label="Source Type"
                onChange={(e) => setNewEvidence({ ...newEvidence, sourceType: e.target.value })}
              >
                {Object.values(EvidenceSourceType).map((type) => (
                  <MenuItem key={type} value={type}>{formatType(type)}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel>Status</InputLabel>
              <Select
                value={newEvidence.status}
                label="Status"
                onChange={(e) => setNewEvidence({ ...newEvidence, status: e.target.value })}
              >
                {Object.values(EvidenceStatus).map((status) => (
                  <MenuItem key={status} value={status}>{formatStatus(status)}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="Location / File Path"
              value={newEvidence.location || ''}
              onChange={(e) => setNewEvidence({ ...newEvidence, location: e.target.value })}
              fullWidth
            />
            <TextField
              label="External URL"
              value={newEvidence.externalUrl || ''}
              onChange={(e) => setNewEvidence({ ...newEvidence, externalUrl: e.target.value })}
              fullWidth
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
          <Button 
            onClick={handleCreateEvidence} 
            variant="contained"
            disabled={!newEvidence.name}
          >
            Create
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default EvidenceList;
