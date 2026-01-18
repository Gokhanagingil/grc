import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
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
  Edit as EditIcon,
  Visibility as ViewIcon,
  Warning as ViolationIcon,
  Link as LinkIcon,
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFnsV3';
import {
  processViolationApi,
  riskApi,
  processApi,
  unwrapPaginatedResponse,
  unwrapResponse,
} from '../services/grcClient';
import { useAuth } from '../contexts/AuthContext';
import { ApiError } from '../services/api';
import { buildListQueryParams, buildListQueryParamsWithDefaults, parseFilterFromQuery, parseSortFromQuery, formatSortToQuery } from '../utils';
import { useSearchParams } from 'react-router-dom';
import { LoadingState, ErrorState, EmptyState, ResponsiveTable, ListToolbar } from '../components/common';

interface ProcessViolation {
  id: string;
  tenantId: string;
  controlId: string;
  controlResultId: string;
  severity: string;
  status: string;
  title: string;
  description: string | null;
  linkedRiskId: string | null;
  ownerUserId: string | null;
  dueDate: string | null;
  resolutionNotes: string | null;
  createdAt: string;
  updatedAt: string;
  control?: {
    id: string;
    name: string;
    process?: {
      id: string;
      name: string;
    };
  };
  linkedRisk?: {
    id: string;
    title: string;
  };
}

interface Risk {
  id: string;
  title: string;
  severity: string;
}

// Backend expects lowercase enum values
const VIOLATION_STATUSES = ['open', 'in_progress', 'resolved'];

// Display labels for UI (uppercase for display)
const SEVERITY_LABELS: Record<string, string> = {
  low: 'LOW',
  medium: 'MEDIUM',
  high: 'HIGH',
  critical: 'CRITICAL',
};

const STATUS_LABELS: Record<string, string> = {
  open: 'OPEN',
  in_progress: 'IN PROGRESS',
  resolved: 'RESOLVED',
};

export const ProcessViolations: React.FC = () => {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  // Default values - ProcessViolations için özel
  const DEFAULT_SORT = 'createdAt:DESC';
  const DEFAULT_PAGE = 1;
  const DEFAULT_PAGE_SIZE = 10;

  // Read initial values from URL
  const pageParam = parseInt(searchParams.get('page') || '1', 10);
  const pageSizeParam = parseInt(searchParams.get('pageSize') || String(DEFAULT_PAGE_SIZE), 10);
  const sortParam = searchParams.get('sort') || DEFAULT_SORT;
  const searchParam = searchParams.get('search') || '';
  const filterParam = parseFilterFromQuery(searchParams.get('filter'));
  const processIdFromUrl = searchParams.get('processId') || '';

  const parsedSort = parseSortFromQuery(sortParam) || { field: 'createdAt', direction: 'DESC' as const };

  const [violations, setViolations] = useState<ProcessViolation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [openViewDialog, setOpenViewDialog] = useState(false);
  const [openEditDialog, setOpenEditDialog] = useState(false);
  const [openLinkRiskDialog, setOpenLinkRiskDialog] = useState(false);
  const [viewingViolation, setViewingViolation] = useState<ProcessViolation | null>(null);
  const [editingViolation, setEditingViolation] = useState<ProcessViolation | null>(null);
  const [page, setPage] = useState(Math.max(0, pageParam - 1));
  const [rowsPerPage, setRowsPerPage] = useState(pageSizeParam);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState<string>((filterParam?.status as string) || '');
  const [severityFilter, setSeverityFilter] = useState<string>((filterParam?.severity as string) || '');
  const [processFilter, setProcessFilter] = useState<string>(processIdFromUrl || (filterParam?.processId as string) || '');
  const [processName, setProcessName] = useState<string>('');
  const [searchFilter, setSearchFilter] = useState<string>(searchParam);
  const [sortField, setSortField] = useState(parsedSort.field);
  const [sortDirection, setSortDirection] = useState<'ASC' | 'DESC'>(parsedSort.direction);
    const [allRisks, setAllRisks] = useState<Risk[]>([]);
    const [selectedRiskId, setSelectedRiskId] = useState<string>('');

  const [editFormData, setEditFormData] = useState({
    status: 'open',
    dueDate: null as Date | null,
    resolutionNotes: '',
  });

  const tenantId = user?.tenantId || '';

  // Build filter object for API (canonical format)
  const buildFilter = useCallback((status: string, severity: string, processId: string) => {
    const conditions: Array<Record<string, unknown>> = [];
    
    if (status) {
      conditions.push({ field: 'status', operator: 'eq', value: status });
    }
    if (severity) {
      conditions.push({ field: 'severity', operator: 'eq', value: severity });
    }
    if (processId) {
      conditions.push({ field: 'processId', operator: 'eq', value: processId });
    }

    if (conditions.length === 0) {
      return null;
    }

    return { and: conditions };
  }, []);

  // Ref to store last query params string for deduplication
  const lastQueryParamsRef = useRef<string>('');
  const abortControllerRef = useRef<AbortController | null>(null);

  // Single useEffect: Update URL when state changes, then fetch when URL/searchParams change
  // This prevents double-fetch loops by using URL as single source of truth for fetch trigger
  useEffect(() => {
    // Step 1: Update URL params when local state changes (no fetch here)
    const filter = buildFilter(statusFilter, severityFilter, processFilter);
    const sortStr = formatSortToQuery(sortField, sortDirection);
    
    const urlParams = buildListQueryParamsWithDefaults(
      {
        page: page + 1,
        pageSize: rowsPerPage,
        filter,
        sort: sortStr !== DEFAULT_SORT ? sortStr : null,
        search: searchFilter || null,
        processId: processFilter || null, // processId özel durum - URL'de ayrı tutuluyor
      },
      {
        page: DEFAULT_PAGE,
        pageSize: DEFAULT_PAGE_SIZE,
        sort: DEFAULT_SORT,
        filter: null,
      }
    );

    // processId özel durum - filter içinde de var ama URL'de ayrı da tutuluyor
    if (processFilter) {
      urlParams.set('processId', processFilter);
    } else {
      urlParams.delete('processId');
    }

    // Build query string for comparison (dedupe)
    const queryString = urlParams.toString();
    
    // Only update URL if it changed (prevents unnecessary updates)
    const currentUrlParams = searchParams.toString();
    if (queryString !== currentUrlParams) {
      setSearchParams(urlParams, { replace: true });
    }
  }, [page, rowsPerPage, statusFilter, severityFilter, processFilter, searchFilter, sortField, sortDirection, buildFilter, setSearchParams, searchParams]);

  // Fetch violations function with dedupe and cancellation support
  const fetchViolations = useCallback(async (force = false) => {
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
    const currentStatusFilter = (currentFilterParam?.status as string) || '';
    const currentSeverityFilter = (currentFilterParam?.severity as string) || '';
    const currentProcessFilter = searchParams.get('processId') || (currentFilterParam?.processId as string) || '';

    const parsedSort = parseSortFromQuery(currentSort) || { field: 'createdAt', direction: 'DESC' as const };

    // Build query params string for deduplication
    const filter = buildFilter(currentStatusFilter, currentSeverityFilter, currentProcessFilter);
    const apiParams = buildListQueryParams({
      page: currentPage,
      pageSize: currentPageSize,
      filter: filter || undefined,
      sort: { field: parsedSort.field, direction: parsedSort.direction },
      search: currentSearch || undefined,
      status: currentStatusFilter || undefined,
      severity: currentSeverityFilter || undefined,
      processId: currentProcessFilter || undefined,
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

      const response = await processViolationApi.list(tenantId, apiParams);

      // Check if request was cancelled
      if (abortControllerRef.current?.signal.aborted) {
        return;
      }

      const result = unwrapPaginatedResponse<ProcessViolation>(response);
      setViolations(result.items);
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
        setLoading(false);
        return;
      }

      const error = err as { response?: { status?: number; data?: { message?: string } } };
      const status = error.response?.status;
      const message = error.response?.data?.message;

      if (status === 401) {
        setError('Session expired. Please login again.');
      } else if (status === 403) {
        setError('You do not have permission to view violations.');
      } else if (status === 404 || status === 502) {
        setViolations([]);
        setTotal(0);
        console.warn('Process violations backend not available');
      } else {
        setError(message || 'Failed to fetch violations. Please try again.');
      }
    } finally {
      if (!abortControllerRef.current?.signal.aborted) {
        setLoading(false);
      }
    }
  }, [tenantId, searchParams, buildFilter, DEFAULT_SORT, DEFAULT_PAGE_SIZE]);

  // Fetch violations when URL params change (single source of truth)
  useEffect(() => {
    fetchViolations(false);
  }, [fetchViolations]);

    const fetchAllRisks = useCallback(async () => {
      if (!tenantId) {
        console.warn('Cannot fetch risks: tenantId is not available');
        return;
      }
      try {
        const response = await riskApi.list(tenantId, buildListQueryParams({ pageSize: 100 }));
        const result = unwrapPaginatedResponse<Risk>(response);
        setAllRisks(result.items || []);
      } catch (err) {
        console.error('Failed to fetch risks:', err);
        setAllRisks([]);
      }
    }, [tenantId]);

    // Fetch process name when processFilter changes
    const fetchProcessName = useCallback(async (processId: string) => {
      if (!tenantId || !processId) {
        setProcessName('');
        return;
      }
      try {
        const response = await processApi.get(tenantId, processId);
        const process = unwrapResponse<{ name: string }>(response);
        setProcessName(process?.name || '');
      } catch (err) {
        console.error('Failed to fetch process name:', err);
        setProcessName('');
      }
    }, [tenantId]);

    useEffect(() => {
      if (processFilter) {
        fetchProcessName(processFilter);
      } else {
        setProcessName('');
      }
    }, [processFilter, fetchProcessName]);

  useEffect(() => {
    fetchViolations();
  }, [fetchViolations]);

  useEffect(() => {
    fetchAllRisks();
  }, [fetchAllRisks]);

  const handleViewViolation = (violation: ProcessViolation) => {
    setViewingViolation(violation);
    setOpenViewDialog(true);
  };

  const handleEditViolation = (violation: ProcessViolation) => {
    setEditingViolation(violation);
    setEditFormData({
      status: violation.status,
      dueDate: violation.dueDate ? new Date(violation.dueDate) : null,
      resolutionNotes: violation.resolutionNotes || '',
    });
    setOpenEditDialog(true);
  };

  const handleSaveViolation = async () => {
    if (!tenantId || !editingViolation) {
      setError('Violation context is required');
      return;
    }

    try {
      const updateData = {
        status: editFormData.status,
        dueDate: editFormData.dueDate?.toISOString().split('T')[0] || undefined,
        resolutionNotes: editFormData.resolutionNotes || undefined,
      };

      await processViolationApi.update(tenantId, editingViolation.id, updateData);
      setSuccess('Violation updated successfully');
      setOpenEditDialog(false);
      fetchViolations(true); // Force refresh after update/delete
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      setError(error.response?.data?.message || 'Failed to update violation');
    }
  };

  const handleOpenLinkRisk = (violation: ProcessViolation) => {
    setEditingViolation(violation);
    setSelectedRiskId(violation.linkedRiskId || '');
    setOpenLinkRiskDialog(true);
  };

  const handleLinkRisk = async () => {
    if (!tenantId || !editingViolation) {
      setError('Violation context is required');
      return;
    }

    try {
      if (selectedRiskId) {
        await processViolationApi.linkRisk(tenantId, editingViolation.id, selectedRiskId);
        setSuccess('Risk linked successfully');
      } else {
        await processViolationApi.unlinkRisk(tenantId, editingViolation.id);
        setSuccess('Risk unlinked successfully');
      }
      setOpenLinkRiskDialog(false);
      fetchViolations(true); // Force refresh after update/delete
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      setError(error.response?.data?.message || 'Failed to link/unlink risk');
    }
  };

  const handleChangePage = (_event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const getSeverityColor = (severity: string): 'error' | 'warning' | 'info' | 'success' | 'default' => {
    const normalizedSeverity = severity.toLowerCase();
    switch (normalizedSeverity) {
      case 'critical':
        return 'error';
      case 'high':
        return 'warning';
      case 'medium':
        return 'info';
      case 'low':
        return 'success';
      default:
        return 'default';
    }
  };

  const getStatusColor = (status: string): 'error' | 'warning' | 'success' | 'default' => {
    const normalizedStatus = status.toLowerCase();
    switch (normalizedStatus) {
      case 'resolved':
        return 'success';
      case 'in_progress':
        return 'warning';
      case 'open':
        return 'error';
      default:
        return 'default';
    }
  };

  const formatDate = (dateString: string | null): string => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString();
  };

  if (loading) {
    return <LoadingState message="Loading violations..." />;
  }

  if (error && violations.length === 0) {
    return (
      <ErrorState
        title="Failed to load violations"
        message={error}
        onRetry={fetchViolations}
      />
    );
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">Process Violations</Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>
          {success}
        </Alert>
      )}

      <ListToolbar
        search={searchFilter}
        onSearchChange={(value) => {
          setSearchFilter(value);
          setPage(0);
        }}
        searchPlaceholder="Search violations..."
        filters={[
          ...(statusFilter ? [{ key: 'status', label: 'Status', value: STATUS_LABELS[statusFilter] || statusFilter.toUpperCase().replace('_', ' ') }] : []),
          ...(severityFilter ? [{ key: 'severity', label: 'Severity', value: SEVERITY_LABELS[severityFilter] || severityFilter.toUpperCase() }] : []),
          ...(processFilter ? [{ key: 'processId', label: 'Process', value: processName || processFilter.substring(0, 8) + '...' }] : []),
        ]}
        onFilterRemove={(key) => {
          if (key === 'status') setStatusFilter('');
          if (key === 'severity') setSeverityFilter('');
          if (key === 'processId') setProcessFilter('');
          setPage(0);
        }}
        onClearFilters={() => {
          setStatusFilter('');
          setSeverityFilter('');
          setProcessFilter('');
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
          { field: 'severity', label: 'Severity' },
          { field: 'status', label: 'Status' },
          { field: 'title', label: 'Title' },
        ]}
        onRefresh={() => fetchViolations(true)}
        loading={loading}
      />

      <Card>
        <CardContent>
          <ResponsiveTable minWidth={1000}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Title</TableCell>
                  <TableCell>Process</TableCell>
                  <TableCell>Control</TableCell>
                  <TableCell>Severity</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Owner</TableCell>
                  <TableCell>Due Date</TableCell>
                  <TableCell>Created</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {violations.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} align="center" sx={{ py: 0, border: 'none' }}>
                      <EmptyState
                        icon={<ViolationIcon sx={{ fontSize: 64, color: 'text.disabled' }} />}
                        title="No violations found"
                        message="Violations are automatically created when control results are non-compliant."
                        minHeight="200px"
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  violations
                    .filter((v) => {
                      if (!searchFilter) return true;
                      const search = searchFilter.toLowerCase();
                      return (
                        v.title.toLowerCase().includes(search) ||
                        (v.description && v.description.toLowerCase().includes(search))
                      );
                    })
                    .map((violation) => (
                    <TableRow key={violation.id} hover>
                      <TableCell>
                        <Typography variant="subtitle2">{violation.title}</Typography>
                        {violation.description && (
                          <Typography
                            variant="body2"
                            color="textSecondary"
                            noWrap
                            sx={{ maxWidth: 200 }}
                          >
                            {violation.description}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {violation.control?.process?.name || '-'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {violation.control?.name || '-'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={SEVERITY_LABELS[violation.severity] || violation.severity.toUpperCase()}
                          color={getSeverityColor(violation.severity)}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={STATUS_LABELS[violation.status] || violation.status.toUpperCase().replace('_', ' ')}
                          color={getStatusColor(violation.status)}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="textSecondary">
                          {violation.ownerUserId ? violation.ownerUserId.substring(0, 8) + '...' : 'N/A'}
                        </Typography>
                      </TableCell>
                      <TableCell>{formatDate(violation.dueDate)}</TableCell>
                      <TableCell>{formatDate(violation.createdAt)}</TableCell>
                      <TableCell>
                        <Tooltip title="View Details">
                          <IconButton size="small" onClick={() => handleViewViolation(violation)}>
                            <ViewIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Edit">
                          <IconButton size="small" onClick={() => handleEditViolation(violation)}>
                            <EditIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title={violation.linkedRiskId ? 'Change Linked Risk' : 'Link Risk'}>
                          <IconButton size="small" onClick={() => handleOpenLinkRisk(violation)}>
                            <LinkIcon />
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
            component="div"
            count={total}
            page={page}
            onPageChange={handleChangePage}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={handleChangeRowsPerPage}
            rowsPerPageOptions={[5, 10, 25, 50]}
          />
        </CardContent>
      </Card>

      <Dialog open={openViewDialog} onClose={() => setOpenViewDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Violation Details</DialogTitle>
        <DialogContent>
          {viewingViolation && (
            <Box sx={{ pt: 2 }}>
              <Typography variant="h6" gutterBottom>
                {viewingViolation.title}
              </Typography>
              <Typography variant="body1" paragraph>
                {viewingViolation.description || 'No description provided.'}
              </Typography>

              <Box display="flex" gap={1} flexWrap="wrap" mb={2}>
                <Chip
                  label={`Severity: ${SEVERITY_LABELS[viewingViolation.severity] || viewingViolation.severity.toUpperCase()}`}
                  color={getSeverityColor(viewingViolation.severity)}
                />
                <Chip
                  label={`Status: ${STATUS_LABELS[viewingViolation.status] || viewingViolation.status.toUpperCase().replace('_', ' ')}`}
                  color={getStatusColor(viewingViolation.status)}
                />
              </Box>

              {viewingViolation.control && (
                <Box mb={2}>
                  <Typography variant="subtitle2">Control</Typography>
                  <Typography variant="body2">{viewingViolation.control.name}</Typography>
                  {viewingViolation.control.process && (
                    <Typography variant="caption" color="textSecondary">
                      Process: {viewingViolation.control.process.name}
                    </Typography>
                  )}
                </Box>
              )}

              {viewingViolation.linkedRisk && (
                <Box mb={2}>
                  <Typography variant="subtitle2">Linked Risk</Typography>
                  <Typography variant="body2">{viewingViolation.linkedRisk.title}</Typography>
                </Box>
              )}

              {viewingViolation.dueDate && (
                <Box mb={2}>
                  <Typography variant="subtitle2">Due Date</Typography>
                  <Typography variant="body2">{formatDate(viewingViolation.dueDate)}</Typography>
                </Box>
              )}

              {viewingViolation.resolutionNotes && (
                <Box mb={2}>
                  <Typography variant="subtitle2">Resolution Notes</Typography>
                  <Typography variant="body2">{viewingViolation.resolutionNotes}</Typography>
                </Box>
              )}

              <Box>
                <Typography variant="caption" color="textSecondary">
                  Created: {formatDate(viewingViolation.createdAt)}
                </Typography>
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenViewDialog(false)}>Close</Button>
          <Button
            variant="contained"
            onClick={() => {
              setOpenViewDialog(false);
              if (viewingViolation) {
                handleEditViolation(viewingViolation);
              }
            }}
          >
            Edit
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={openEditDialog} onClose={() => setOpenEditDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Violation</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <FormControl fullWidth>
              <InputLabel>Status</InputLabel>
              <Select
                value={editFormData.status}
                label="Status"
                onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value })}
              >
                {VIOLATION_STATUSES.map((status) => (
                  <MenuItem key={status} value={status}>
                    {STATUS_LABELS[status] || status.toUpperCase().replace('_', ' ')}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <LocalizationProvider dateAdapter={AdapterDateFns}>
              <DatePicker
                label="Due Date"
                value={editFormData.dueDate}
                onChange={(date) => setEditFormData({ ...editFormData, dueDate: date })}
                slotProps={{ textField: { fullWidth: true } }}
              />
            </LocalizationProvider>

            <TextField
              label="Resolution Notes"
              value={editFormData.resolutionNotes}
              onChange={(e) => setEditFormData({ ...editFormData, resolutionNotes: e.target.value })}
              fullWidth
              multiline
              rows={4}
              helperText="Document the resolution steps and outcome"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenEditDialog(false)}>Cancel</Button>
          <Button onClick={handleSaveViolation} variant="contained">
            Save
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={openLinkRiskDialog}
        onClose={() => setOpenLinkRiskDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Link Risk to Violation</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <FormControl fullWidth>
              <InputLabel>Select Risk</InputLabel>
              <Select
                value={selectedRiskId}
                label="Select Risk"
                onChange={(e) => setSelectedRiskId(e.target.value)}
              >
                <MenuItem value="">
                  <em>None (Unlink)</em>
                </MenuItem>
                {allRisks.map((risk) => (
                  <MenuItem key={risk.id} value={risk.id}>
                    {risk.title} ({risk.severity})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenLinkRiskDialog(false)}>Cancel</Button>
          <Button onClick={handleLinkRisk} variant="contained">
            {selectedRiskId ? 'Link Risk' : 'Unlink Risk'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ProcessViolations;
