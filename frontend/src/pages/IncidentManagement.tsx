import React, { useState, useCallback, useMemo } from 'react';
import {
  Box,
  Typography,
  Button,
  Grid,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Tooltip,
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon,
  CheckCircle as ResolveIcon,
  Lock as CloseIcon,
  Warning as IncidentIcon,
} from '@mui/icons-material';
import { useSearchParams } from 'react-router-dom';
import { incidentApi, SuiteType } from '../services/grcClient';
import { useAuth } from '../contexts/AuthContext';
import { buildListQueryParams } from '../utils';
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
import { SuiteGate } from '../components/onboarding';

export enum IncidentCategory {
  HARDWARE = 'hardware',
  SOFTWARE = 'software',
  NETWORK = 'network',
  ACCESS = 'access',
  OTHER = 'other',
}

export enum IncidentImpact {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
}

export enum IncidentUrgency {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
}

export enum IncidentPriority {
  P1 = 'p1',
  P2 = 'p2',
  P3 = 'p3',
  P4 = 'p4',
}

export enum IncidentStatus {
  OPEN = 'open',
  IN_PROGRESS = 'in_progress',
  RESOLVED = 'resolved',
  CLOSED = 'closed',
}

export enum IncidentSource {
  USER = 'user',
  MONITORING = 'monitoring',
  EMAIL = 'email',
  PHONE = 'phone',
  SELF_SERVICE = 'self_service',
}

const INCIDENT_FILTER_CONFIG: FilterConfig = {
  fields: [
    {
      name: 'shortDescription',
      label: 'Short Description',
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
      enumValues: Object.values(IncidentStatus),
      enumLabels: {
        [IncidentStatus.OPEN]: 'Open',
        [IncidentStatus.IN_PROGRESS]: 'In Progress',
        [IncidentStatus.RESOLVED]: 'Resolved',
        [IncidentStatus.CLOSED]: 'Closed',
      },
    },
    {
      name: 'priority',
      label: 'Priority',
      type: 'enum',
      enumValues: Object.values(IncidentPriority),
      enumLabels: {
        [IncidentPriority.P1]: 'P1',
        [IncidentPriority.P2]: 'P2',
        [IncidentPriority.P3]: 'P3',
        [IncidentPriority.P4]: 'P4',
      },
    },
    {
      name: 'category',
      label: 'Category',
      type: 'enum',
      enumValues: Object.values(IncidentCategory),
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
  ],
  maxConditions: 10,
};

const getPriorityColor = (priority: IncidentPriority): 'error' | 'warning' | 'info' | 'success' | 'default' => {
  switch (priority) {
    case IncidentPriority.P1: return 'error';
    case IncidentPriority.P2: return 'warning';
    case IncidentPriority.P3: return 'info';
    case IncidentPriority.P4: return 'success';
    default: return 'default';
  }
};

const getStatusColor = (status: IncidentStatus): 'error' | 'warning' | 'info' | 'success' | 'default' => {
  switch (status) {
    case IncidentStatus.OPEN: return 'error';
    case IncidentStatus.IN_PROGRESS: return 'warning';
    case IncidentStatus.RESOLVED: return 'info';
    case IncidentStatus.CLOSED: return 'success';
    default: return 'default';
  }
};

const formatPriority = (priority: IncidentPriority): string => {
  return priority.toUpperCase();
};

const formatStatus = (status: IncidentStatus): string => {
  return status.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
};

const formatCategory = (category: IncidentCategory): string => {
  return category.charAt(0).toUpperCase() + category.slice(1);
};

const formatImpact = (impact: IncidentImpact): string => {
  return impact.charAt(0).toUpperCase() + impact.slice(1);
};

const formatUrgency = (urgency: IncidentUrgency): string => {
  return urgency.charAt(0).toUpperCase() + urgency.slice(1);
};

const formatSource = (source: IncidentSource): string => {
  return source.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
};

interface Incident {
  id: string;
  tenantId: string;
  number: string;
  shortDescription: string;
  description: string | null;
  category: IncidentCategory;
  impact: IncidentImpact;
  urgency: IncidentUrgency;
  priority: IncidentPriority;
  status: IncidentStatus;
  source: IncidentSource;
  assignmentGroup: string | null;
  assignedTo: string | null;
  relatedService: string | null;
  relatedRiskId: string | null;
  relatedPolicyId: string | null;
  firstResponseAt: string | null;
  resolvedAt: string | null;
  resolutionNotes: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
  updatedBy: string | null;
  isDeleted: boolean;
}

export const IncidentManagement: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const tenantId = user?.tenantId || '';

  const statusFilter = searchParams.get('status') || '';
  const priorityFilter = searchParams.get('priority') || '';

  const parsedQuery = useMemo(() => parseListQuery(searchParams, {
    pageSize: 10,
    sort: 'createdAt:DESC',
  }), [searchParams]);

  const advancedFilter = parsedQuery.filterTree;

  const additionalFilters = useMemo(() => {
    const filters: Record<string, unknown> = {};
    if (statusFilter) filters.status = statusFilter;
    if (priorityFilter) filters.priority = priorityFilter;
    if (advancedFilter) {
      const serialized = serializeFilterTree(advancedFilter);
      if (serialized) filters.filter = serialized;
    }
    return filters;
  }, [statusFilter, priorityFilter, advancedFilter]);

  const fetchIncidents = useCallback((params: Record<string, unknown>) => {
    const apiParams = buildListQueryParams(params);
    return incidentApi.list(tenantId, apiParams);
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
  } = useUniversalList<Incident>({
    fetchFn: fetchIncidents,
    defaultPageSize: 10,
    defaultSort: 'createdAt:DESC',
    syncToUrl: true,
    enabled: isAuthReady,
    additionalFilters,
  });

  const [openDialog, setOpenDialog] = useState(false);
  const [openViewDialog, setOpenViewDialog] = useState(false);
  const [openResolveDialog, setOpenResolveDialog] = useState(false);
  const [editingIncident, setEditingIncident] = useState<Incident | null>(null);
  const [viewingIncident, setViewingIncident] = useState<Incident | null>(null);
  const [resolvingIncident, setResolvingIncident] = useState<Incident | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [formData, setFormData] = useState({
    shortDescription: '',
    description: '',
    category: IncidentCategory.OTHER,
    impact: IncidentImpact.MEDIUM,
    urgency: IncidentUrgency.MEDIUM,
    source: IncidentSource.USER,
    assignmentGroup: '',
    status: IncidentStatus.OPEN,
  });

  const handleCreateIncident = useCallback(() => {
    setEditingIncident(null);
    setFormData({
      shortDescription: '',
      description: '',
      category: IncidentCategory.OTHER,
      impact: IncidentImpact.MEDIUM,
      urgency: IncidentUrgency.MEDIUM,
      source: IncidentSource.USER,
      assignmentGroup: '',
      status: IncidentStatus.OPEN,
    });
    setOpenDialog(true);
  }, []);

  const handleEditIncident = useCallback((incident: Incident) => {
    setEditingIncident(incident);
    setFormData({
      shortDescription: incident.shortDescription,
      description: incident.description || '',
      category: incident.category,
      impact: incident.impact,
      urgency: incident.urgency,
      source: incident.source,
      assignmentGroup: incident.assignmentGroup || '',
      status: incident.status,
    });
    setOpenDialog(true);
  }, []);

  const handleViewIncident = useCallback((incident: Incident) => {
    setViewingIncident(incident);
    setOpenViewDialog(true);
  }, []);

  const handleSaveIncident = useCallback(async () => {
    if (!tenantId) return;

    try {
      const incidentData = {
        shortDescription: formData.shortDescription,
        description: formData.description || undefined,
        category: formData.category,
        impact: formData.impact,
        urgency: formData.urgency,
        source: formData.source,
        assignmentGroup: formData.assignmentGroup || undefined,
        status: editingIncident ? formData.status : undefined,
      };

      if (editingIncident) {
        await incidentApi.update(tenantId, editingIncident.id, incidentData);
      } else {
        await incidentApi.create(tenantId, incidentData);
      }

      setOpenDialog(false);
      refetch();
    } catch (err) {
      console.error('Failed to save incident:', err);
    }
  }, [tenantId, formData, editingIncident, refetch]);

  const handleDeleteIncident = useCallback(async (id: string) => {
    if (!tenantId) return;

    if (window.confirm('Are you sure you want to delete this incident?')) {
      try {
        await incidentApi.delete(tenantId, id);
        refetch();
      } catch (err) {
        console.error('Failed to delete incident:', err);
      }
    }
  }, [tenantId, refetch]);

  const handleResolveIncident = useCallback((incident: Incident) => {
    setResolvingIncident(incident);
    setResolutionNotes('');
    setOpenResolveDialog(true);
  }, []);

  const handleConfirmResolve = useCallback(async () => {
    if (!tenantId || !resolvingIncident) return;

    try {
      await incidentApi.resolve(tenantId, resolvingIncident.id, resolutionNotes);
      setOpenResolveDialog(false);
      refetch();
    } catch (err) {
      console.error('Failed to resolve incident:', err);
    }
  }, [tenantId, resolvingIncident, resolutionNotes, refetch]);

  const handleCloseIncident = useCallback(async (incident: Incident) => {
    if (!tenantId) return;

    if (incident.status !== IncidentStatus.RESOLVED) {
      return;
    }

    try {
      await incidentApi.close(tenantId, incident.id);
      refetch();
    } catch (err) {
      console.error('Failed to close incident:', err);
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

  const handlePriorityChange = useCallback((value: string) => {
    updateFilter('priority', value);
  }, [updateFilter]);

  const getActiveFilters = useCallback((): FilterOption[] => {
    const filters: FilterOption[] = [];
    if (statusFilter) {
      filters.push({ key: 'status', label: 'Status', value: formatStatus(statusFilter as IncidentStatus) });
    }
    if (priorityFilter) {
      filters.push({ key: 'priority', label: 'Priority', value: formatPriority(priorityFilter as IncidentPriority) });
    }
    return filters;
  }, [statusFilter, priorityFilter]);

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

  const columns: ColumnDefinition<Incident>[] = useMemo(() => [
    {
      key: 'number',
      header: 'Number',
      render: (incident) => (
        <Typography variant="subtitle2" sx={{ fontFamily: 'monospace' }}>
          {incident.number}
        </Typography>
      ),
    },
    {
      key: 'shortDescription',
      header: 'Short Description',
      render: (incident) => (
        <Box>
          <Typography
            variant="body2"
            fontWeight="medium"
            component="span"
            onClick={() => handleViewIncident(incident)}
            sx={{
              color: 'primary.main',
              cursor: 'pointer',
              '&:hover': {
                textDecoration: 'underline',
                color: 'primary.dark',
              },
            }}
          >
            {incident.shortDescription}
          </Typography>
          {incident.description && (
            <Typography variant="body2" color="textSecondary" noWrap sx={{ maxWidth: 200, mt: 0.5 }}>
              {incident.description}
            </Typography>
          )}
        </Box>
      ),
    },
    {
      key: 'priority',
      header: 'Priority',
      render: (incident) => (
        <Chip
          label={formatPriority(incident.priority)}
          color={getPriorityColor(incident.priority)}
          size="small"
        />
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (incident) => (
        <Chip
          label={formatStatus(incident.status)}
          color={getStatusColor(incident.status)}
          size="small"
        />
      ),
    },
    {
      key: 'category',
      header: 'Category',
      render: (incident) => formatCategory(incident.category),
    },
    {
      key: 'assignmentGroup',
      header: 'Assignment Group',
      render: (incident) => incident.assignmentGroup || '-',
    },
    {
      key: 'createdAt',
      header: 'Created',
      render: (incident) => new Date(incident.createdAt).toLocaleDateString(),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (incident) => (
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <Tooltip title="View">
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                handleViewIncident(incident);
              }}
            >
              <ViewIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Edit">
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                handleEditIncident(incident);
              }}
            >
              <EditIcon />
            </IconButton>
          </Tooltip>
          {incident.status !== IncidentStatus.RESOLVED && incident.status !== IncidentStatus.CLOSED && (
            <Tooltip title="Resolve">
              <IconButton
                size="small"
                color="primary"
                onClick={(e) => {
                  e.stopPropagation();
                  handleResolveIncident(incident);
                }}
              >
                <ResolveIcon />
              </IconButton>
            </Tooltip>
          )}
          {incident.status === IncidentStatus.RESOLVED && (
            <Tooltip title="Close">
              <IconButton
                size="small"
                color="success"
                onClick={(e) => {
                  e.stopPropagation();
                  handleCloseIncident(incident);
                }}
              >
                <CloseIcon />
              </IconButton>
            </Tooltip>
          )}
          <Tooltip title="Delete">
            <IconButton
              size="small"
              color="error"
              onClick={(e) => {
                e.stopPropagation();
                handleDeleteIncident(incident.id);
              }}
            >
              <DeleteIcon />
            </IconButton>
          </Tooltip>
        </Box>
      ),
    },
  ], [handleViewIncident, handleEditIncident, handleResolveIncident, handleCloseIncident, handleDeleteIncident]);

  const toolbarActions = useMemo(() => (
    <Box display="flex" gap={1} alignItems="center">
      <FilterBuilderBasic
        config={INCIDENT_FILTER_CONFIG}
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
          <MenuItem value={IncidentStatus.OPEN}>Open</MenuItem>
          <MenuItem value={IncidentStatus.IN_PROGRESS}>In Progress</MenuItem>
          <MenuItem value={IncidentStatus.RESOLVED}>Resolved</MenuItem>
          <MenuItem value={IncidentStatus.CLOSED}>Closed</MenuItem>
        </Select>
      </FormControl>
      <FormControl size="small" sx={{ minWidth: 100 }}>
        <InputLabel>Priority</InputLabel>
        <Select
          value={priorityFilter}
          label="Priority"
          onChange={(e) => handlePriorityChange(e.target.value)}
        >
          <MenuItem value="">All</MenuItem>
          <MenuItem value={IncidentPriority.P1}>P1</MenuItem>
          <MenuItem value={IncidentPriority.P2}>P2</MenuItem>
          <MenuItem value={IncidentPriority.P3}>P3</MenuItem>
          <MenuItem value={IncidentPriority.P4}>P4</MenuItem>
        </Select>
      </FormControl>
    </Box>
  ), [statusFilter, priorityFilter, handleStatusChange, handlePriorityChange, advancedFilter, handleAdvancedFilterApply, handleAdvancedFilterClear, activeAdvancedFilterCount]);

  return (
    <>
      <GenericListPage<Incident>
        title="Incident Management"
        icon={<IncidentIcon />}
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
        getRowKey={(incident) => incident.id}
        onRowClick={handleViewIncident}
        searchPlaceholder="Search incidents..."
        emptyMessage="No incidents found"
        emptyFilteredMessage="No incidents have been reported yet."
        filters={getActiveFilters()}
        onFilterRemove={handleFilterRemove}
        onClearFilters={handleClearFilters}
        toolbarActions={toolbarActions}
        createButtonLabel="New Incident"
        onCreateClick={handleCreateIncident}
        minTableWidth={900}
        testId="incident-list-page"
      />

      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          {editingIncident ? 'Edit Incident' : 'Create New Incident'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Short Description"
                value={formData.shortDescription}
                onChange={(e) => setFormData({ ...formData, shortDescription: e.target.value })}
                required
                error={!formData.shortDescription}
                helperText={!formData.shortDescription ? 'Short description is required' : ''}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Description"
                multiline
                rows={3}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </Grid>
            <Grid item xs={6}>
              <FormControl fullWidth>
                <InputLabel>Category</InputLabel>
                <Select
                  value={formData.category}
                  label="Category"
                  onChange={(e) => setFormData({ ...formData, category: e.target.value as IncidentCategory })}
                >
                  {Object.values(IncidentCategory).map((category) => (
                    <MenuItem key={category} value={category}>{formatCategory(category)}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6}>
              <FormControl fullWidth>
                <InputLabel>Source</InputLabel>
                <Select
                  value={formData.source}
                  label="Source"
                  onChange={(e) => setFormData({ ...formData, source: e.target.value as IncidentSource })}
                >
                  {Object.values(IncidentSource).map((source) => (
                    <MenuItem key={source} value={source}>{formatSource(source)}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6}>
              <FormControl fullWidth>
                <InputLabel>Impact</InputLabel>
                <Select
                  value={formData.impact}
                  label="Impact"
                  onChange={(e) => setFormData({ ...formData, impact: e.target.value as IncidentImpact })}
                >
                  {Object.values(IncidentImpact).map((impact) => (
                    <MenuItem key={impact} value={impact}>{formatImpact(impact)}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6}>
              <FormControl fullWidth>
                <InputLabel>Urgency</InputLabel>
                <Select
                  value={formData.urgency}
                  label="Urgency"
                  onChange={(e) => setFormData({ ...formData, urgency: e.target.value as IncidentUrgency })}
                >
                  {Object.values(IncidentUrgency).map((urgency) => (
                    <MenuItem key={urgency} value={urgency}>{formatUrgency(urgency)}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Assignment Group"
                value={formData.assignmentGroup}
                onChange={(e) => setFormData({ ...formData, assignmentGroup: e.target.value })}
                placeholder="e.g., IT Support, Network Team"
              />
            </Grid>
            {editingIncident && (
              <Grid item xs={6}>
                <FormControl fullWidth>
                  <InputLabel>Status</InputLabel>
                  <Select
                    value={formData.status}
                    label="Status"
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as IncidentStatus })}
                  >
                    {Object.values(IncidentStatus).map((status) => (
                      <MenuItem key={status} value={status}>{formatStatus(status)}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            )}
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>Cancel</Button>
          <Button
            onClick={handleSaveIncident}
            variant="contained"
            disabled={!formData.shortDescription}
          >
            {editingIncident ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={openViewDialog} onClose={() => setOpenViewDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          Incident Details - {viewingIncident?.number}
        </DialogTitle>
        <DialogContent>
          {viewingIncident && (
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12}>
                <Typography variant="h6">{viewingIncident.shortDescription}</Typography>
              </Grid>
              <Grid item xs={12}>
                <Typography variant="body2" color="textSecondary">
                  {viewingIncident.description || 'No description provided'}
                </Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="subtitle2">Priority</Typography>
                <Chip
                  label={formatPriority(viewingIncident.priority)}
                  color={getPriorityColor(viewingIncident.priority)}
                  size="small"
                />
              </Grid>
              <Grid item xs={6}>
                <Typography variant="subtitle2">Status</Typography>
                <Chip
                  label={formatStatus(viewingIncident.status)}
                  color={getStatusColor(viewingIncident.status)}
                  size="small"
                />
              </Grid>
              <Grid item xs={6}>
                <Typography variant="subtitle2">Category</Typography>
                <Typography>{formatCategory(viewingIncident.category)}</Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="subtitle2">Source</Typography>
                <Typography>{formatSource(viewingIncident.source)}</Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="subtitle2">Impact</Typography>
                <Typography>{formatImpact(viewingIncident.impact)}</Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="subtitle2">Urgency</Typography>
                <Typography>{formatUrgency(viewingIncident.urgency)}</Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="subtitle2">Assignment Group</Typography>
                <Typography>{viewingIncident.assignmentGroup || '-'}</Typography>
              </Grid>
                            <Grid item xs={6}>
                              <Typography variant="subtitle2">Related Service</Typography>
                              <Typography>{viewingIncident.relatedService || '-'}</Typography>
                            </Grid>
                            <SuiteGate suite={SuiteType.GRC_SUITE}>
                              <Grid item xs={6}>
                                <Typography variant="subtitle2">Related Risk</Typography>
                                <Typography>{viewingIncident.relatedRiskId || '-'}</Typography>
                              </Grid>
                            </SuiteGate>
              <Grid item xs={6}>
                <Typography variant="subtitle2">Created</Typography>
                <Typography>{new Date(viewingIncident.createdAt).toLocaleString()}</Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="subtitle2">Updated</Typography>
                <Typography>{new Date(viewingIncident.updatedAt).toLocaleString()}</Typography>
              </Grid>
              {viewingIncident.resolvedAt && (
                <Grid item xs={6}>
                  <Typography variant="subtitle2">Resolved At</Typography>
                  <Typography>{new Date(viewingIncident.resolvedAt).toLocaleString()}</Typography>
                </Grid>
              )}
              {viewingIncident.resolutionNotes && (
                <Grid item xs={12}>
                  <Typography variant="subtitle2">Resolution Notes</Typography>
                  <Typography>{viewingIncident.resolutionNotes}</Typography>
                </Grid>
              )}
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenViewDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={openResolveDialog} onClose={() => setOpenResolveDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          Resolve Incident - {resolvingIncident?.number}
        </DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Resolution Notes"
            multiline
            rows={4}
            value={resolutionNotes}
            onChange={(e) => setResolutionNotes(e.target.value)}
            placeholder="Describe how the incident was resolved..."
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenResolveDialog(false)}>Cancel</Button>
          <Button onClick={handleConfirmResolve} variant="contained" color="primary">
            Resolve
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};
