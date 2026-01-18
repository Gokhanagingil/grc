import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  Alert,
  TablePagination,
  Tooltip,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon,
  CheckCircle as ResolveIcon,
  Lock as CloseIcon,
  Warning as IncidentIcon,
} from '@mui/icons-material';
import { useSearchParams } from 'react-router-dom';
import { incidentApi, unwrapPaginatedResponse, SuiteType } from '../services/grcClient';
import { useAuth } from '../contexts/AuthContext';
import { ApiError } from '../services/api';
import { buildListQueryParams, buildListQueryParamsWithDefaults, parseFilterFromQuery, parseSortFromQuery, formatSortToQuery } from '../utils';
import { LoadingState, ErrorState, EmptyState, ResponsiveTable, ListToolbar } from '../components/common';
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
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  // Default values
  const DEFAULT_SORT = 'createdAt:DESC';
  const DEFAULT_PAGE = 1;
  const DEFAULT_PAGE_SIZE = 10;

  // Read initial values from URL
  const pageParam = parseInt(searchParams.get('page') || '1', 10);
  const pageSizeParam = parseInt(searchParams.get('pageSize') || String(DEFAULT_PAGE_SIZE), 10);
  const sortParam = searchParams.get('sort') || DEFAULT_SORT;
  const searchParam = searchParams.get('search') || '';
  const filterParam = parseFilterFromQuery(searchParams.get('filter'));

  const parsedSort = parseSortFromQuery(sortParam) || { field: 'createdAt', direction: 'DESC' as const };

  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [openDialog, setOpenDialog] = useState(false);
  const [openViewDialog, setOpenViewDialog] = useState(false);
  const [openResolveDialog, setOpenResolveDialog] = useState(false);
  const [editingIncident, setEditingIncident] = useState<Incident | null>(null);
  const [viewingIncident, setViewingIncident] = useState<Incident | null>(null);
  const [resolvingIncident, setResolvingIncident] = useState<Incident | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [page, setPage] = useState(Math.max(0, pageParam - 1));
  const [rowsPerPage, setRowsPerPage] = useState(pageSizeParam);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState<IncidentStatus | ''>((filterParam?.status as IncidentStatus | '') || '');
  const [priorityFilter, setPriorityFilter] = useState<IncidentPriority | ''>((filterParam?.priority as IncidentPriority | '') || '');
  const [searchFilter, setSearchFilter] = useState(searchParam);
  const [sortField, setSortField] = useState(parsedSort.field);
  const [sortDirection, setSortDirection] = useState<'ASC' | 'DESC'>(parsedSort.direction);
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

  const tenantId = user?.tenantId || '';

  // Build filter object for API (canonical format)
  const buildFilter = useCallback((status: IncidentStatus | '', priority: IncidentPriority | '') => {
    const conditions: Array<Record<string, unknown>> = [];
    
    if (status) {
      conditions.push({ field: 'status', operator: 'eq', value: status });
    }
    if (priority) {
      conditions.push({ field: 'priority', operator: 'eq', value: priority });
    }

    if (conditions.length === 0) {
      return null;
    }

    return { and: conditions };
  }, []);

  // Ref to store last query params string for deduplication
  const lastQueryParamsRef = useRef<string>('');

  // Single useEffect: Update URL when state changes, then fetch when URL/searchParams change
  // This prevents double-fetch loops by using URL as single source of truth for fetch trigger
  useEffect(() => {
    // Step 1: Update URL params when local state changes (no fetch here)
    const filter = buildFilter(statusFilter, priorityFilter);
    const sortStr = formatSortToQuery(sortField, sortDirection);
    
    const urlParams = buildListQueryParamsWithDefaults(
      {
        page: page + 1,
        pageSize: rowsPerPage,
        filter,
        sort: sortStr !== DEFAULT_SORT ? sortStr : null,
        search: searchFilter || null,
      },
      {
        page: DEFAULT_PAGE,
        pageSize: DEFAULT_PAGE_SIZE,
        sort: DEFAULT_SORT,
        filter: null,
      }
    );

    // Build query string for comparison (dedupe)
    const queryString = new URLSearchParams(urlParams).toString();
    
    // Only update URL if it changed (prevents unnecessary updates)
    const currentUrlParams = searchParams.toString();
    if (queryString !== currentUrlParams) {
      setSearchParams(new URLSearchParams(urlParams), { replace: true });
    }
  }, [page, rowsPerPage, statusFilter, priorityFilter, searchFilter, sortField, sortDirection, buildFilter, setSearchParams, searchParams]);

  // Fetch incidents function with dedupe and cancellation support
  const abortControllerRef = useRef<AbortController | null>(null);
  const fetchIncidents = useCallback(async (force = false) => {
    if (!tenantId) {
      setLoading(false);
      return;
    }

    // Read values from URL (single source of truth)
    const currentPage = parseInt(searchParams.get('page') || '1', 10);
    const currentPageSize = parseInt(searchParams.get('pageSize') || String(DEFAULT_PAGE_SIZE), 10);
    const currentSort = searchParams.get('sort') || DEFAULT_SORT;
    const currentSearch = searchParams.get('search') || '';
    const currentFilterParam = parseFilterFromQuery(searchParams.get('filter'));
    const currentStatusFilter = (currentFilterParam?.status as IncidentStatus | '') || '';
    const currentPriorityFilter = (currentFilterParam?.priority as IncidentPriority | '') || '';

    const parsedSort = parseSortFromQuery(currentSort) || { field: 'createdAt', direction: 'DESC' as const };

    // Build query params string for deduplication
    const filter = buildFilter(currentStatusFilter, currentPriorityFilter);
    const apiParams = buildListQueryParams({
      page: currentPage,
      pageSize: currentPageSize,
      filter: filter || undefined,
      sort: { field: parsedSort.field, direction: parsedSort.direction },
      search: currentSearch || undefined,
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

      const response = await incidentApi.list(tenantId, apiParams);

      // Check if request was cancelled
      if (abortControllerRef.current?.signal.aborted) {
        return;
      }

      // Handle NestJS response format using centralized unwrapper
      const result = unwrapPaginatedResponse<Incident>(response);
      setIncidents(result.items);
      setTotal(result.total);
    } catch (err: unknown) {
      // Ignore cancellation errors (AbortController or axios CancelToken)
      if (err && typeof err === 'object' && 'name' in err && (err.name === 'AbortError' || err.name === 'CanceledError')) {
        return;
      }
      // Check if it's an axios cancellation
      if (err && typeof err === 'object' && 'message' in err && String(err.message).includes('cancel')) {
        return;
      }

      // Handle 429 Rate Limit errors with user-friendly message
      if (err instanceof ApiError && err.code === 'RATE_LIMITED') {
        const retryAfter = (err.details?.retryAfter as number) || 60;
        setError(`Çok fazla istek yapıldı. ${retryAfter} saniye sonra tekrar deneyin. (Önceki veriler korunuyor)`);
        // Don't clear incidents - keep previous data (don't update setIncidents)
        setLoading(false);
        return;
      }

      const error = err as { response?: { data?: { message?: string } } };
      setError(error.response?.data?.message || 'Failed to fetch incidents');
    } finally {
      if (!abortControllerRef.current?.signal.aborted) {
        setLoading(false);
      }
    }
  }, [tenantId, searchParams, buildFilter, DEFAULT_SORT, DEFAULT_PAGE_SIZE]);

  // Fetch incidents when URL params change (single source of truth)
  useEffect(() => {
    fetchIncidents(false);
  }, [fetchIncidents]);

  const handleCreateIncident = () => {
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
  };

  const handleEditIncident = (incident: Incident) => {
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
  };

  const handleViewIncident = (incident: Incident) => {
    setViewingIncident(incident);
    setOpenViewDialog(true);
  };

  const handleSaveIncident = async () => {
    if (!tenantId) {
      setError('Tenant ID is required');
      return;
    }

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

      // Use centralized API client - no more /nest/ prefix
      if (editingIncident) {
        await incidentApi.update(tenantId, editingIncident.id, incidentData);
        setSuccess('Incident updated successfully');
      } else {
        await incidentApi.create(tenantId, incidentData);
        setSuccess('Incident created successfully');
      }

      setOpenDialog(false);
      setError('');
      fetchIncidents(true); // Force refresh after create/update

      setTimeout(() => setSuccess(''), 3000);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      setError(error.response?.data?.message || 'Failed to save incident');
    }
  };

  const handleDeleteIncident = async (id: string) => {
    if (!tenantId) {
      setError('Tenant ID is required');
      return;
    }

    if (window.confirm('Are you sure you want to delete this incident?')) {
      try {
        // Use centralized API client - no more /nest/ prefix
        await incidentApi.delete(tenantId, id);
        setSuccess('Incident deleted successfully');
        fetchIncidents(true); // Force refresh after delete

        setTimeout(() => setSuccess(''), 3000);
      } catch (err: unknown) {
        const error = err as { response?: { data?: { message?: string } } };
        setError(error.response?.data?.message || 'Failed to delete incident');
      }
    }
  };

  const handleResolveIncident = (incident: Incident) => {
    setResolvingIncident(incident);
    setResolutionNotes('');
    setOpenResolveDialog(true);
  };

  const handleConfirmResolve = async () => {
    if (!tenantId || !resolvingIncident) {
      return;
    }

    try {
      // Use centralized API client - no more /nest/ prefix
      await incidentApi.resolve(tenantId, resolvingIncident.id, resolutionNotes);
      setSuccess('Incident resolved successfully');
      setOpenResolveDialog(false);
      fetchIncidents(true); // Force refresh after resolve

      setTimeout(() => setSuccess(''), 3000);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      setError(error.response?.data?.message || 'Failed to resolve incident');
    }
  };

  const handleCloseIncident = async (incident: Incident) => {
    if (!tenantId) {
      setError('Tenant ID is required');
      return;
    }

    if (incident.status !== IncidentStatus.RESOLVED) {
      setError('Incident must be resolved before closing');
      return;
    }

    try {
      // Use centralized API client - no more /nest/ prefix
      await incidentApi.close(tenantId, incident.id);
      setSuccess('Incident closed successfully');
      fetchIncidents(true); // Force refresh after close

      setTimeout(() => setSuccess(''), 3000);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      setError(error.response?.data?.message || 'Failed to close incident');
    }
  };

  const handleChangePage = (_event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
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

  if (loading) {
    return <LoadingState message="Loading incidents..." />;
  }

  if (error && incidents.length === 0) {
    return (
      <ErrorState
        title="Failed to load incidents"
        message={error}
        onRetry={fetchIncidents}
      />
    );
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">Incident Management</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleCreateIncident}
        >
          New Incident
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}

      <ListToolbar
        search={searchFilter}
        onSearchChange={(value) => {
          setSearchFilter(value);
          setPage(0);
        }}
        searchPlaceholder="Search incidents..."
        filters={[
          ...(statusFilter ? [{ key: 'status', label: 'Status', value: formatStatus(statusFilter) }] : []),
          ...(priorityFilter ? [{ key: 'priority', label: 'Priority', value: formatPriority(priorityFilter) }] : []),
        ]}
        onFilterRemove={(key) => {
          if (key === 'status') {
            setStatusFilter('');
          } else if (key === 'priority') {
            setPriorityFilter('');
          }
          setPage(0);
        }}
        onClearFilters={() => {
          setStatusFilter('');
          setPriorityFilter('');
          setSearchFilter('');
          setPage(0);
        }}
        sort={`${sortField}:${sortDirection}`}
        onSortChange={(sort: string) => {
          const [field, direction] = sort.split(':');
          setSortField(field);
          setSortDirection(direction as 'ASC' | 'DESC');
        }}
        sortOptions={[
          { field: 'createdAt', label: 'Created Date' },
          { field: 'updatedAt', label: 'Updated Date' },
          { field: 'priority', label: 'Priority' },
          { field: 'status', label: 'Status' },
        ]}
        onRefresh={() => fetchIncidents(true)}
        loading={loading}
      />

      <Card>
        <CardContent>
          <ResponsiveTable minWidth={900}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Number</TableCell>
                  <TableCell>Short Description</TableCell>
                  <TableCell>Priority</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Category</TableCell>
                  <TableCell>Assignment Group</TableCell>
                  <TableCell>Created</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {incidents.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} align="center" sx={{ py: 0, border: 'none' }}>
                      <EmptyState
                        icon={<IncidentIcon sx={{ fontSize: 64, color: 'text.disabled' }} />}
                        title="No incidents found"
                        message={tenantId ? 'No incidents have been reported yet.' : 'Please select a tenant to view incidents.'}
                        actionLabel={tenantId ? 'Report Incident' : undefined}
                        onAction={tenantId ? handleCreateIncident : undefined}
                        minHeight="200px"
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  incidents.map((incident) => (
                    <TableRow key={incident.id} hover>
                      <TableCell>
                        <Typography variant="subtitle2" sx={{ fontFamily: 'monospace' }}>
                          {incident.number}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="subtitle2">{incident.shortDescription}</Typography>
                        {incident.description && (
                          <Typography variant="body2" color="textSecondary" noWrap sx={{ maxWidth: 200 }}>
                            {incident.description}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={formatPriority(incident.priority)}
                          color={getPriorityColor(incident.priority)}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={formatStatus(incident.status)}
                          color={getStatusColor(incident.status)}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>{formatCategory(incident.category)}</TableCell>
                      <TableCell>{incident.assignmentGroup || '-'}</TableCell>
                      <TableCell>
                        {new Date(incident.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <Tooltip title="View">
                          <IconButton size="small" onClick={() => handleViewIncident(incident)}>
                            <ViewIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Edit">
                          <IconButton size="small" onClick={() => handleEditIncident(incident)}>
                            <EditIcon />
                          </IconButton>
                        </Tooltip>
                        {incident.status !== IncidentStatus.RESOLVED && incident.status !== IncidentStatus.CLOSED && (
                          <Tooltip title="Resolve">
                            <IconButton size="small" onClick={() => handleResolveIncident(incident)} color="primary">
                              <ResolveIcon />
                            </IconButton>
                          </Tooltip>
                        )}
                        {incident.status === IncidentStatus.RESOLVED && (
                          <Tooltip title="Close">
                            <IconButton size="small" onClick={() => handleCloseIncident(incident)} color="success">
                              <CloseIcon />
                            </IconButton>
                          </Tooltip>
                        )}
                        <Tooltip title="Delete">
                          <IconButton size="small" onClick={() => handleDeleteIncident(incident.id)} color="error">
                            <DeleteIcon />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </ResponsiveTable>
          <TablePagination
            rowsPerPageOptions={[5, 10, 25, 50]}
            component="div"
            count={total}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={handleChangePage}
            onRowsPerPageChange={handleChangeRowsPerPage}
          />
        </CardContent>
      </Card>

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
    </Box>
  );
};
