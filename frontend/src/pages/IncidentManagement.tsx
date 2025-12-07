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
  TableContainer,
  TableHead,
  TableRow,
  Paper,
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
  CircularProgress,
  TablePagination,
  Tooltip,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon,
  FilterList as FilterIcon,
  CheckCircle as ResolveIcon,
  Lock as CloseIcon,
} from '@mui/icons-material';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

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

interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export const IncidentManagement: React.FC = () => {
  const { user } = useAuth();
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
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState<IncidentStatus | ''>('');
  const [priorityFilter, setPriorityFilter] = useState<IncidentPriority | ''>('');
  const [searchFilter, setSearchFilter] = useState('');
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

  const fetchIncidents = useCallback(async () => {
    if (!tenantId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: String(page + 1),
        pageSize: String(rowsPerPage),
      });

      if (statusFilter) {
        params.append('status', statusFilter);
      }
      if (priorityFilter) {
        params.append('priority', priorityFilter);
      }
      if (searchFilter) {
        params.append('search', searchFilter);
      }

      const response = await api.get<PaginatedResponse<Incident>>(`/itsm/incidents?${params}`, {
        headers: { 'x-tenant-id': tenantId },
      });

      setIncidents(response.data.items);
      setTotal(response.data.total);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      setError(error.response?.data?.message || 'Failed to fetch incidents');
    } finally {
      setLoading(false);
    }
  }, [tenantId, page, rowsPerPage, statusFilter, priorityFilter, searchFilter]);

  useEffect(() => {
    fetchIncidents();
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

      if (editingIncident) {
        await api.patch(`/itsm/incidents/${editingIncident.id}`, incidentData, {
          headers: { 'x-tenant-id': tenantId },
        });
        setSuccess('Incident updated successfully');
      } else {
        await api.post('/itsm/incidents', incidentData, {
          headers: { 'x-tenant-id': tenantId },
        });
        setSuccess('Incident created successfully');
      }

      setOpenDialog(false);
      setError('');
      fetchIncidents();

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
        await api.delete(`/itsm/incidents/${id}`, {
          headers: { 'x-tenant-id': tenantId },
        });
        setSuccess('Incident deleted successfully');
        fetchIncidents();

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
      await api.post(`/itsm/incidents/${resolvingIncident.id}/resolve`, {
        resolutionNotes,
      }, {
        headers: { 'x-tenant-id': tenantId },
      });
      setSuccess('Incident resolved successfully');
      setOpenResolveDialog(false);
      fetchIncidents();

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
      await api.post(`/itsm/incidents/${incident.id}/close`, {}, {
        headers: { 'x-tenant-id': tenantId },
      });
      setSuccess('Incident closed successfully');
      fetchIncidents();

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
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
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
                  setStatusFilter(e.target.value as IncidentStatus | '');
                  setPage(0);
                }}
              >
                <MenuItem value="">All</MenuItem>
                {Object.values(IncidentStatus).map((status) => (
                  <MenuItem key={status} value={status}>{formatStatus(status)}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>Priority</InputLabel>
              <Select
                value={priorityFilter}
                label="Priority"
                onChange={(e) => {
                  setPriorityFilter(e.target.value as IncidentPriority | '');
                  setPage(0);
                }}
              >
                <MenuItem value="">All</MenuItem>
                {Object.values(IncidentPriority).map((priority) => (
                  <MenuItem key={priority} value={priority}>{formatPriority(priority)}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              size="small"
              label="Search"
              placeholder="Search incidents..."
              value={searchFilter}
              onChange={(e) => {
                setSearchFilter(e.target.value);
                setPage(0);
              }}
              sx={{ minWidth: 200 }}
            />
            {(statusFilter || priorityFilter || searchFilter) && (
              <Button
                size="small"
                onClick={() => {
                  setStatusFilter('');
                  setPriorityFilter('');
                  setSearchFilter('');
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
          <TableContainer component={Paper}>
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
                    <TableCell colSpan={8} align="center">
                      <Typography color="textSecondary">
                        {tenantId ? 'No incidents found' : 'Please select a tenant to view incidents'}
                      </Typography>
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
          </TableContainer>
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
