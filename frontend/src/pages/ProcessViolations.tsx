import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Typography,
  Button,
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
  unwrapResponse,
} from '../services/grcClient';
import { useAuth } from '../contexts/AuthContext';
import { buildListQueryParams } from '../utils';
import { useSearchParams, useNavigate } from 'react-router-dom';
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
const SEVERITY_VALUES = ['low', 'medium', 'high', 'critical'] as const;

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

const VIOLATION_FILTER_CONFIG: FilterConfig = {
  fields: [
    {
      name: 'title',
      label: 'Title',
      type: 'string',
    },
    {
      name: 'description',
      label: 'Description',
      type: 'string',
    },
    {
      name: 'severity',
      label: 'Severity',
      type: 'enum',
      enumValues: [...SEVERITY_VALUES],
      enumLabels: SEVERITY_LABELS,
    },
    {
      name: 'status',
      label: 'Status',
      type: 'enum',
      enumValues: [...VIOLATION_STATUSES],
      enumLabels: STATUS_LABELS,
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
    {
      name: 'dueDate',
      label: 'Due Date',
      type: 'date',
    },
  ],
  maxConditions: 10,
};

const getSeverityColor = (severity: string): 'error' | 'warning' | 'info' | 'success' | 'default' => {
  const normalizedSeverity = severity.toLowerCase();
  switch (normalizedSeverity) {
    case 'critical': return 'error';
    case 'high': return 'warning';
    case 'medium': return 'info';
    case 'low': return 'success';
    default: return 'default';
  }
};

const getStatusColor = (status: string): 'error' | 'warning' | 'success' | 'default' => {
  const normalizedStatus = status.toLowerCase();
  switch (normalizedStatus) {
    case 'resolved': return 'success';
    case 'in_progress': return 'warning';
    case 'open': return 'error';
    default: return 'default';
  }
};

const formatDate = (dateString: string | null): string => {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleDateString();
};

export const ProcessViolations: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const tenantId = user?.tenantId || '';

  const statusFilter = searchParams.get('status') || '';
  const severityFilter = searchParams.get('severity') || '';
  const processIdFilter = searchParams.get('processId') || '';

  const parsedQuery = useMemo(() => parseListQuery(searchParams, {
    pageSize: 10,
    sort: 'createdAt:DESC',
  }), [searchParams]);

  const advancedFilter = parsedQuery.filterTree;

  const additionalFilters = useMemo(() => {
    const filters: Record<string, unknown> = {};
    if (statusFilter) filters.status = statusFilter;
    if (severityFilter) filters.severity = severityFilter;
    if (processIdFilter) filters.processId = processIdFilter;
    if (advancedFilter) {
      const serialized = serializeFilterTree(advancedFilter);
      if (serialized) filters.filter = serialized;
    }
    return filters;
  }, [statusFilter, severityFilter, processIdFilter, advancedFilter]);

  const fetchViolations = useCallback((params: Record<string, unknown>) => {
    const apiParams = buildListQueryParams(params);
    return processViolationApi.list(tenantId, apiParams);
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
  } = useUniversalList<ProcessViolation>({
    fetchFn: fetchViolations,
    defaultPageSize: 10,
    defaultSort: 'createdAt:DESC',
    syncToUrl: true,
    enabled: isAuthReady,
    additionalFilters,
  });

  const [openEditDialog, setOpenEditDialog] = useState(false);
  const [openLinkRiskDialog, setOpenLinkRiskDialog] = useState(false);
  const [editingViolation, setEditingViolation] = useState<ProcessViolation | null>(null);
  const [allRisks, setAllRisks] = useState<Risk[]>([]);
  const [selectedRiskId, setSelectedRiskId] = useState<string>('');
  const [processName, setProcessName] = useState<string>('');
  const [editFormData, setEditFormData] = useState({
    status: 'open',
    dueDate: null as Date | null,
    resolutionNotes: '',
  });

  const fetchAllRisks = useCallback(async () => {
    if (!tenantId) return;
    try {
      const response = await riskApi.list(tenantId, buildListQueryParams({ pageSize: 100 }));
      const result = unwrapPaginatedResponse<Risk>(response);
      setAllRisks(result.items || []);
    } catch (err) {
      console.error('Failed to fetch risks:', err);
      setAllRisks([]);
    }
  }, [tenantId]);

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
    fetchAllRisks();
  }, [fetchAllRisks]);

  useEffect(() => {
    if (processIdFilter) {
      fetchProcessName(processIdFilter);
    } else {
      setProcessName('');
    }
  }, [processIdFilter, fetchProcessName]);

  const handleViewViolation = useCallback((violation: ProcessViolation) => {
    navigate(`/violations/${violation.id}`);
  }, [navigate]);

  const handleEditViolation = useCallback((violation: ProcessViolation) => {
    setEditingViolation(violation);
    setEditFormData({
      status: violation.status,
      dueDate: violation.dueDate ? new Date(violation.dueDate) : null,
      resolutionNotes: violation.resolutionNotes || '',
    });
    setOpenEditDialog(true);
  }, []);

  const handleSaveViolation = useCallback(async () => {
    if (!tenantId || !editingViolation) return;

    try {
      const updateData = {
        status: editFormData.status,
        dueDate: editFormData.dueDate?.toISOString().split('T')[0] || undefined,
        resolutionNotes: editFormData.resolutionNotes || undefined,
      };

      await processViolationApi.update(tenantId, editingViolation.id, updateData);
      setOpenEditDialog(false);
      refetch();
    } catch (err) {
      console.error('Failed to update violation:', err);
    }
  }, [tenantId, editingViolation, editFormData, refetch]);

  const handleOpenLinkRisk = useCallback((violation: ProcessViolation) => {
    setEditingViolation(violation);
    setSelectedRiskId(violation.linkedRiskId || '');
    setOpenLinkRiskDialog(true);
  }, []);

  const handleLinkRisk = useCallback(async () => {
    if (!tenantId || !editingViolation) return;

    try {
      if (selectedRiskId) {
        await processViolationApi.linkRisk(tenantId, editingViolation.id, selectedRiskId);
      } else {
        await processViolationApi.unlinkRisk(tenantId, editingViolation.id);
      }
      setOpenLinkRiskDialog(false);
      refetch();
    } catch (err) {
      console.error('Failed to link/unlink risk:', err);
    }
  }, [tenantId, editingViolation, selectedRiskId, refetch]);

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

  const handleSeverityChange = useCallback((value: string) => {
    updateFilter('severity', value);
  }, [updateFilter]);

  const getActiveFilters = useCallback((): FilterOption[] => {
    const filters: FilterOption[] = [];
    if (statusFilter) {
      filters.push({ key: 'status', label: 'Status', value: STATUS_LABELS[statusFilter] || statusFilter.toUpperCase().replace('_', ' ') });
    }
    if (severityFilter) {
      filters.push({ key: 'severity', label: 'Severity', value: SEVERITY_LABELS[severityFilter] || severityFilter.toUpperCase() });
    }
    if (processIdFilter) {
      filters.push({ key: 'processId', label: 'Process', value: processName || processIdFilter.substring(0, 8) + '...' });
    }
    return filters;
  }, [statusFilter, severityFilter, processIdFilter, processName]);

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

  const columns: ColumnDefinition<ProcessViolation>[] = useMemo(() => [
    {
      key: 'title',
      header: 'Title',
      render: (violation) => (
        <Box>
          <Typography
            variant="body2"
            fontWeight="medium"
            component="span"
            onClick={() => handleViewViolation(violation)}
            sx={{
              color: 'primary.main',
              cursor: 'pointer',
              '&:hover': {
                textDecoration: 'underline',
                color: 'primary.dark',
              },
            }}
          >
            {violation.title}
          </Typography>
          {violation.description && (
            <Typography variant="body2" color="textSecondary" noWrap sx={{ maxWidth: 200, mt: 0.5 }}>
              {violation.description}
            </Typography>
          )}
        </Box>
      ),
    },
    {
      key: 'process',
      header: 'Process',
      render: (violation) => violation.control?.process?.name || '-',
    },
    {
      key: 'control',
      header: 'Control',
      render: (violation) => violation.control?.name || '-',
    },
    {
      key: 'severity',
      header: 'Severity',
      render: (violation) => (
        <Chip
          label={SEVERITY_LABELS[violation.severity] || violation.severity.toUpperCase()}
          color={getSeverityColor(violation.severity)}
          size="small"
        />
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (violation) => (
        <Chip
          label={STATUS_LABELS[violation.status] || violation.status.toUpperCase().replace('_', ' ')}
          color={getStatusColor(violation.status)}
          size="small"
        />
      ),
    },
    {
      key: 'owner',
      header: 'Owner',
      render: (violation) => (
        <Typography variant="body2" color="textSecondary">
          {violation.ownerUserId ? violation.ownerUserId.substring(0, 8) + '...' : 'N/A'}
        </Typography>
      ),
    },
    {
      key: 'dueDate',
      header: 'Due Date',
      render: (violation) => formatDate(violation.dueDate),
    },
    {
      key: 'createdAt',
      header: 'Created',
      render: (violation) => formatDate(violation.createdAt),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (violation) => (
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <Tooltip title="View Details">
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                handleViewViolation(violation);
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
                handleEditViolation(violation);
              }}
            >
              <EditIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title={violation.linkedRiskId ? 'Change Linked Risk' : 'Link Risk'}>
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                handleOpenLinkRisk(violation);
              }}
            >
              <LinkIcon />
            </IconButton>
          </Tooltip>
        </Box>
      ),
    },
  ], [handleViewViolation, handleEditViolation, handleOpenLinkRisk]);

  const toolbarActions = useMemo(() => (
    <Box display="flex" gap={1} alignItems="center">
      <FilterBuilderBasic
        config={VIOLATION_FILTER_CONFIG}
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
          <MenuItem value="open">Open</MenuItem>
          <MenuItem value="in_progress">In Progress</MenuItem>
          <MenuItem value="resolved">Resolved</MenuItem>
        </Select>
      </FormControl>
      <FormControl size="small" sx={{ minWidth: 120 }}>
        <InputLabel>Severity</InputLabel>
        <Select
          value={severityFilter}
          label="Severity"
          onChange={(e) => handleSeverityChange(e.target.value)}
        >
          <MenuItem value="">All</MenuItem>
          <MenuItem value="low">Low</MenuItem>
          <MenuItem value="medium">Medium</MenuItem>
          <MenuItem value="high">High</MenuItem>
          <MenuItem value="critical">Critical</MenuItem>
        </Select>
      </FormControl>
    </Box>
  ), [statusFilter, severityFilter, handleStatusChange, handleSeverityChange, advancedFilter, handleAdvancedFilterApply, handleAdvancedFilterClear, activeAdvancedFilterCount]);

  return (
    <>
      <GenericListPage<ProcessViolation>
        title="Process Violations"
        icon={<ViolationIcon />}
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
        getRowKey={(violation) => violation.id}
        onRowClick={handleViewViolation}
        searchPlaceholder="Search violations..."
        emptyMessage="No violations found"
        emptyFilteredMessage="Violations are automatically created when control results are non-compliant."
        filters={getActiveFilters()}
        onFilterRemove={handleFilterRemove}
        onClearFilters={handleClearFilters}
        toolbarActions={toolbarActions}
        minTableWidth={1000}
        testId="violations-list-page"
      />

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
    </>
  );
};

export default ProcessViolations;
