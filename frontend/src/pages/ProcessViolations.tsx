import React, { useState, useEffect, useCallback } from 'react';
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
  FilterList as FilterIcon,
  Warning as ViolationIcon,
  Link as LinkIcon,
  LinkOff as UnlinkIcon,
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import {
  processViolationApi,
  riskApi,
  unwrapPaginatedResponse,
} from '../services/grcClient';
import { useAuth } from '../contexts/AuthContext';
import { useSearchParams } from 'react-router-dom';
import { LoadingState, ErrorState, EmptyState, ResponsiveTable } from '../components/common';

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
const VIOLATION_SEVERITIES = ['low', 'medium', 'high', 'critical'];
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
  const [searchParams] = useSearchParams();
  const processIdFromUrl = searchParams.get('processId') || '';
  const [violations, setViolations] = useState<ProcessViolation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [openViewDialog, setOpenViewDialog] = useState(false);
  const [openEditDialog, setOpenEditDialog] = useState(false);
  const [openLinkRiskDialog, setOpenLinkRiskDialog] = useState(false);
  const [viewingViolation, setViewingViolation] = useState<ProcessViolation | null>(null);
  const [editingViolation, setEditingViolation] = useState<ProcessViolation | null>(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [severityFilter, setSeverityFilter] = useState<string>('');
  const [processFilter, setProcessFilter] = useState<string>(processIdFromUrl);
  const [allRisks, setAllRisks] = useState<Risk[]>([]);
  const [selectedRiskId, setSelectedRiskId] = useState<string>('');

  const [editFormData, setEditFormData] = useState({
    status: 'open',
    dueDate: null as Date | null,
    resolutionNotes: '',
  });

  const tenantId = user?.tenantId || '';

  const fetchViolations = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const params = new URLSearchParams({
        page: String(page + 1),
        pageSize: String(rowsPerPage),
      });

      if (statusFilter) {
        params.append('status', statusFilter);
      }
      if (severityFilter) {
        params.append('severity', severityFilter);
      }
      if (processFilter) {
        params.append('processId', processFilter);
      }

      const response = await processViolationApi.list(tenantId, params);
      const result = unwrapPaginatedResponse<ProcessViolation>(response);
      setViolations(result.items);
      setTotal(result.total);
    } catch (err: unknown) {
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
      setLoading(false);
    }
  }, [tenantId, page, rowsPerPage, statusFilter, severityFilter, processFilter]);

  const fetchAllRisks = useCallback(async () => {
    if (!tenantId) {
      console.warn('Cannot fetch risks: tenantId is not available');
      return;
    }
    try {
      const params = new URLSearchParams({ pageSize: '100' });
      const response = await riskApi.list(tenantId, params);
      const result = unwrapPaginatedResponse<Risk>(response);
      setAllRisks(result.items || []);
    } catch (err) {
      console.error('Failed to fetch risks:', err);
      setAllRisks([]);
    }
  }, [tenantId]);

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
      fetchViolations();
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
      fetchViolations();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      setError(error.response?.data?.message || 'Failed to link/unlink risk');
    }
  };

  const handleUnlinkRisk = async (violation: ProcessViolation) => {
    if (!tenantId) return;

    if (window.confirm('Are you sure you want to unlink the risk from this violation?')) {
      try {
        await processViolationApi.unlinkRisk(tenantId, violation.id);
        setSuccess('Risk unlinked successfully');
        fetchViolations();
        setTimeout(() => setSuccess(''), 3000);
      } catch (err: unknown) {
        const error = err as { response?: { data?: { message?: string } } };
        setError(error.response?.data?.message || 'Failed to unlink risk');
      }
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

      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Box display="flex" gap={2} alignItems="center" flexWrap="wrap">
            <FilterIcon color="action" />
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>Status</InputLabel>
              <Select
                value={statusFilter}
                label="Status"
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(0);
                }}
              >
                <MenuItem value="">All</MenuItem>
                {VIOLATION_STATUSES.map((status) => (
                  <MenuItem key={status} value={status}>
                    {STATUS_LABELS[status] || status.toUpperCase().replace('_', ' ')}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>Severity</InputLabel>
              <Select
                value={severityFilter}
                label="Severity"
                onChange={(e) => {
                  setSeverityFilter(e.target.value);
                  setPage(0);
                }}
              >
                <MenuItem value="">All</MenuItem>
                {VIOLATION_SEVERITIES.map((severity) => (
                  <MenuItem key={severity} value={severity}>
                    {SEVERITY_LABELS[severity] || severity.toUpperCase()}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            {processFilter && (
              <Chip
                label={`Process: ${processFilter.substring(0, 8)}...`}
                size="small"
                onDelete={() => {
                  setProcessFilter('');
                  setPage(0);
                }}
              />
            )}
            {(statusFilter || severityFilter || processFilter) && (
              <Button
                size="small"
                onClick={() => {
                  setStatusFilter('');
                  setSeverityFilter('');
                  setProcessFilter('');
                  setPage(0);
                }}
              >
                Clear Filters
              </Button>
            )}
          </Box>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <ResponsiveTable minWidth={1000}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Title</TableCell>
                  <TableCell>Process / Control</TableCell>
                  <TableCell>Severity</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Linked Risk</TableCell>
                  <TableCell>Due Date</TableCell>
                  <TableCell>Created</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {violations.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} align="center" sx={{ py: 0, border: 'none' }}>
                      <EmptyState
                        icon={<ViolationIcon sx={{ fontSize: 64, color: 'text.disabled' }} />}
                        title="No violations found"
                        message="Violations are automatically created when control results are non-compliant."
                        minHeight="200px"
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  violations.map((violation) => (
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
                        {violation.control?.process?.name && (
                          <Typography variant="body2">
                            {violation.control.process.name}
                          </Typography>
                        )}
                        {violation.control?.name && (
                          <Typography variant="caption" color="textSecondary">
                            {violation.control.name}
                          </Typography>
                        )}
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
                        {violation.linkedRisk ? (
                          <Tooltip title={violation.linkedRisk.title}>
                            <Chip
                              label={violation.linkedRisk.title.substring(0, 20) + '...'}
                              size="small"
                              variant="outlined"
                              onDelete={() => handleUnlinkRisk(violation)}
                              deleteIcon={<UnlinkIcon />}
                            />
                          </Tooltip>
                        ) : (
                          <Button
                            size="small"
                            startIcon={<LinkIcon />}
                            onClick={() => handleOpenLinkRisk(violation)}
                          >
                            Link Risk
                          </Button>
                        )}
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
