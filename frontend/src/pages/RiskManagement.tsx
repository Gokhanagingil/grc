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
  LinearProgress,
  TablePagination,
  Tooltip,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon,
  FilterList as FilterIcon,
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

// Risk enums matching backend
export enum RiskSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export enum RiskLikelihood {
  RARE = 'rare',
  UNLIKELY = 'unlikely',
  POSSIBLE = 'possible',
  LIKELY = 'likely',
  ALMOST_CERTAIN = 'almost_certain',
}

export enum RiskStatus {
  DRAFT = 'draft',
  IDENTIFIED = 'identified',
  ASSESSED = 'assessed',
  MITIGATING = 'mitigating',
  ACCEPTED = 'accepted',
  CLOSED = 'closed',
}

// Risk interface matching NestJS backend response
interface Risk {
  id: string;
  tenantId: string;
  title: string;
  description: string | null;
  category: string | null;
  severity: RiskSeverity;
  likelihood: RiskLikelihood;
  impact: RiskSeverity;
  score: number | null;
  status: RiskStatus;
  ownerUserId: string | null;
  dueDate: string | null;
  mitigationPlan: string | null;
  tags: string[] | null;
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

export const RiskManagement: React.FC = () => {
  const { user } = useAuth();
  const [risks, setRisks] = useState<Risk[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [openDialog, setOpenDialog] = useState(false);
  const [openViewDialog, setOpenViewDialog] = useState(false);
  const [editingRisk, setEditingRisk] = useState<Risk | null>(null);
  const [viewingRisk, setViewingRisk] = useState<Risk | null>(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState<RiskStatus | ''>('');
  const [severityFilter, setSeverityFilter] = useState<RiskSeverity | ''>('');
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: '',
    severity: RiskSeverity.MEDIUM,
    likelihood: RiskLikelihood.POSSIBLE,
    impact: RiskSeverity.MEDIUM,
    status: RiskStatus.DRAFT,
    mitigationPlan: '',
    dueDate: null as Date | null,
  });

  // Get tenant ID from user context
  const tenantId = user?.tenantId || '';

  const fetchRisks = useCallback(async () => {
    if (!tenantId) {
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: String(page + 1), // API uses 1-based pagination
        pageSize: String(rowsPerPage),
      });
      
      if (statusFilter) {
        params.append('status', statusFilter);
      }
      if (severityFilter) {
        params.append('severity', severityFilter);
      }
      
      const response = await api.get<PaginatedResponse<Risk>>(`/grc/risks?${params}`, {
        headers: { 'x-tenant-id': tenantId },
      });
      
      setRisks(response.data.items);
      setTotal(response.data.total);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      setError(error.response?.data?.message || 'Failed to fetch risks');
    } finally {
      setLoading(false);
    }
  }, [tenantId, page, rowsPerPage, statusFilter, severityFilter]);

  useEffect(() => {
    fetchRisks();
  }, [fetchRisks]);

  const handleCreateRisk = () => {
    setEditingRisk(null);
    setFormData({
      title: '',
      description: '',
      category: '',
      severity: RiskSeverity.MEDIUM,
      likelihood: RiskLikelihood.POSSIBLE,
      impact: RiskSeverity.MEDIUM,
      status: RiskStatus.DRAFT,
      mitigationPlan: '',
      dueDate: null,
    });
    setOpenDialog(true);
  };

  const handleEditRisk = (risk: Risk) => {
    setEditingRisk(risk);
    setFormData({
      title: risk.title,
      description: risk.description || '',
      category: risk.category || '',
      severity: risk.severity,
      likelihood: risk.likelihood,
      impact: risk.impact,
      status: risk.status,
      mitigationPlan: risk.mitigationPlan || '',
      dueDate: risk.dueDate ? new Date(risk.dueDate) : null,
    });
    setOpenDialog(true);
  };

  const handleViewRisk = (risk: Risk) => {
    setViewingRisk(risk);
    setOpenViewDialog(true);
  };

  const handleSaveRisk = async () => {
    if (!tenantId) {
      setError('Tenant ID is required');
      return;
    }

    try {
      const riskData = {
        title: formData.title,
        description: formData.description || undefined,
        category: formData.category || undefined,
        severity: formData.severity,
        likelihood: formData.likelihood,
        impact: formData.impact,
        status: formData.status,
        mitigationPlan: formData.mitigationPlan || undefined,
        dueDate: formData.dueDate?.toISOString().split('T')[0] || undefined,
      };

      if (editingRisk) {
        await api.patch(`/grc/risks/${editingRisk.id}`, riskData, {
          headers: { 'x-tenant-id': tenantId },
        });
        setSuccess('Risk updated successfully');
      } else {
        await api.post('/grc/risks', riskData, {
          headers: { 'x-tenant-id': tenantId },
        });
        setSuccess('Risk created successfully');
      }

      setOpenDialog(false);
      setError('');
      fetchRisks();
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      setError(error.response?.data?.message || 'Failed to save risk');
    }
  };

  const handleDeleteRisk = async (id: string) => {
    if (!tenantId) {
      setError('Tenant ID is required');
      return;
    }

    if (window.confirm('Are you sure you want to delete this risk?')) {
      try {
        await api.delete(`/grc/risks/${id}`, {
          headers: { 'x-tenant-id': tenantId },
        });
        setSuccess('Risk deleted successfully');
        fetchRisks();
        
        // Clear success message after 3 seconds
        setTimeout(() => setSuccess(''), 3000);
      } catch (err: unknown) {
        const error = err as { response?: { data?: { message?: string } } };
        setError(error.response?.data?.message || 'Failed to delete risk');
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

  const getSeverityColor = (severity: RiskSeverity): 'error' | 'warning' | 'info' | 'success' | 'default' => {
    switch (severity) {
      case RiskSeverity.CRITICAL: return 'error';
      case RiskSeverity.HIGH: return 'warning';
      case RiskSeverity.MEDIUM: return 'info';
      case RiskSeverity.LOW: return 'success';
      default: return 'default';
    }
  };

  const getStatusColor = (status: RiskStatus): 'error' | 'warning' | 'info' | 'success' | 'default' => {
    switch (status) {
      case RiskStatus.CLOSED: return 'success';
      case RiskStatus.ACCEPTED: return 'info';
      case RiskStatus.MITIGATING: return 'warning';
      case RiskStatus.ASSESSED: return 'info';
      case RiskStatus.IDENTIFIED: return 'warning';
      case RiskStatus.DRAFT: return 'default';
      default: return 'default';
    }
  };

  const getRiskScoreColor = (score: number | null): 'error' | 'warning' | 'info' | 'success' => {
    if (!score) return 'info';
    if (score >= 16) return 'error';
    if (score >= 9) return 'warning';
    if (score >= 4) return 'info';
    return 'success';
  };

  const formatSeverity = (severity: RiskSeverity): string => {
    return severity.charAt(0).toUpperCase() + severity.slice(1);
  };

  const formatStatus = (status: RiskStatus): string => {
    return status.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  const formatLikelihood = (likelihood: RiskLikelihood): string => {
    return likelihood.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
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
        <Typography variant="h4">Risk Management</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleCreateRisk}
        >
          New Risk
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}

      {/* Filters */}
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
                  setStatusFilter(e.target.value as RiskStatus | '');
                  setPage(0);
                }}
              >
                <MenuItem value="">All</MenuItem>
                {Object.values(RiskStatus).map((status) => (
                  <MenuItem key={status} value={status}>{formatStatus(status)}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>Severity</InputLabel>
              <Select
                value={severityFilter}
                label="Severity"
                onChange={(e) => {
                  setSeverityFilter(e.target.value as RiskSeverity | '');
                  setPage(0);
                }}
              >
                <MenuItem value="">All</MenuItem>
                {Object.values(RiskSeverity).map((severity) => (
                  <MenuItem key={severity} value={severity}>{formatSeverity(severity)}</MenuItem>
                ))}
              </Select>
            </FormControl>
            {(statusFilter || severityFilter) && (
              <Button
                size="small"
                onClick={() => {
                  setStatusFilter('');
                  setSeverityFilter('');
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
                  <TableCell>Title</TableCell>
                  <TableCell>Category</TableCell>
                  <TableCell>Severity</TableCell>
                  <TableCell>Likelihood</TableCell>
                  <TableCell>Score</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Due Date</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {risks.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} align="center">
                      <Typography color="textSecondary">
                        {tenantId ? 'No risks found' : 'Please select a tenant to view risks'}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  risks.map((risk) => (
                    <TableRow key={risk.id} hover>
                      <TableCell>
                        <Typography variant="subtitle2">{risk.title}</Typography>
                        {risk.description && (
                          <Typography variant="body2" color="textSecondary" noWrap sx={{ maxWidth: 200 }}>
                            {risk.description}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>{risk.category || '-'}</TableCell>
                      <TableCell>
                        <Chip
                          label={formatSeverity(risk.severity)}
                          color={getSeverityColor(risk.severity)}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={formatLikelihood(risk.likelihood)}
                          variant="outlined"
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <Box display="flex" alignItems="center" gap={1}>
                          <Typography variant="body2">{risk.score ?? '-'}</Typography>
                          {risk.score && (
                            <LinearProgress
                              variant="determinate"
                              value={Math.min((risk.score / 20) * 100, 100)}
                              color={getRiskScoreColor(risk.score)}
                              sx={{ width: 50, height: 8, borderRadius: 4 }}
                            />
                          )}
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={formatStatus(risk.status)}
                          color={getStatusColor(risk.status)}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        {risk.dueDate ? new Date(risk.dueDate).toLocaleDateString() : '-'}
                      </TableCell>
                      <TableCell>
                        <Tooltip title="View">
                          <IconButton size="small" onClick={() => handleViewRisk(risk)}>
                            <ViewIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Edit">
                          <IconButton size="small" onClick={() => handleEditRisk(risk)}>
                            <EditIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete">
                          <IconButton size="small" onClick={() => handleDeleteRisk(risk.id)} color="error">
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

      {/* Create/Edit Risk Dialog */}
      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          {editingRisk ? 'Edit Risk' : 'Create New Risk'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                required
                error={!formData.title}
                helperText={!formData.title ? 'Title is required' : ''}
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
              <TextField
                fullWidth
                label="Category"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                placeholder="e.g., Operational, Financial, Compliance"
              />
            </Grid>
            <Grid item xs={6}>
              <FormControl fullWidth>
                <InputLabel>Severity</InputLabel>
                <Select
                  value={formData.severity}
                  label="Severity"
                  onChange={(e) => setFormData({ ...formData, severity: e.target.value as RiskSeverity })}
                >
                  {Object.values(RiskSeverity).map((severity) => (
                    <MenuItem key={severity} value={severity}>{formatSeverity(severity)}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6}>
              <FormControl fullWidth>
                <InputLabel>Likelihood</InputLabel>
                <Select
                  value={formData.likelihood}
                  label="Likelihood"
                  onChange={(e) => setFormData({ ...formData, likelihood: e.target.value as RiskLikelihood })}
                >
                  {Object.values(RiskLikelihood).map((likelihood) => (
                    <MenuItem key={likelihood} value={likelihood}>{formatLikelihood(likelihood)}</MenuItem>
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
                  onChange={(e) => setFormData({ ...formData, impact: e.target.value as RiskSeverity })}
                >
                  {Object.values(RiskSeverity).map((impact) => (
                    <MenuItem key={impact} value={impact}>{formatSeverity(impact)}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6}>
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  value={formData.status}
                  label="Status"
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as RiskStatus })}
                >
                  {Object.values(RiskStatus).map((status) => (
                    <MenuItem key={status} value={status}>{formatStatus(status)}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6}>
              <LocalizationProvider dateAdapter={AdapterDateFns}>
                <DatePicker
                  label="Due Date"
                  value={formData.dueDate}
                  onChange={(newValue: Date | null) =>
                    setFormData({ ...formData, dueDate: newValue })
                  }
                  slotProps={{
                    textField: { fullWidth: true },
                  }}
                />
              </LocalizationProvider>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Mitigation Plan"
                multiline
                rows={4}
                value={formData.mitigationPlan}
                onChange={(e) => setFormData({ ...formData, mitigationPlan: e.target.value })}
                placeholder="Describe the plan to mitigate this risk..."
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>Cancel</Button>
          <Button 
            onClick={handleSaveRisk} 
            variant="contained"
            disabled={!formData.title}
          >
            {editingRisk ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* View Risk Dialog */}
      <Dialog open={openViewDialog} onClose={() => setOpenViewDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          Risk Details
        </DialogTitle>
        <DialogContent>
          {viewingRisk && (
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12}>
                <Typography variant="h6">{viewingRisk.title}</Typography>
              </Grid>
              {viewingRisk.description && (
                <Grid item xs={12}>
                  <Typography variant="subtitle2" color="textSecondary">Description</Typography>
                  <Typography>{viewingRisk.description}</Typography>
                </Grid>
              )}
              <Grid item xs={6}>
                <Typography variant="subtitle2" color="textSecondary">Category</Typography>
                <Typography>{viewingRisk.category || '-'}</Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="subtitle2" color="textSecondary">Status</Typography>
                <Chip
                  label={formatStatus(viewingRisk.status)}
                  color={getStatusColor(viewingRisk.status)}
                  size="small"
                />
              </Grid>
              <Grid item xs={4}>
                <Typography variant="subtitle2" color="textSecondary">Severity</Typography>
                <Chip
                  label={formatSeverity(viewingRisk.severity)}
                  color={getSeverityColor(viewingRisk.severity)}
                  size="small"
                />
              </Grid>
              <Grid item xs={4}>
                <Typography variant="subtitle2" color="textSecondary">Likelihood</Typography>
                <Chip
                  label={formatLikelihood(viewingRisk.likelihood)}
                  variant="outlined"
                  size="small"
                />
              </Grid>
              <Grid item xs={4}>
                <Typography variant="subtitle2" color="textSecondary">Impact</Typography>
                <Chip
                  label={formatSeverity(viewingRisk.impact)}
                  color={getSeverityColor(viewingRisk.impact)}
                  size="small"
                />
              </Grid>
              <Grid item xs={6}>
                <Typography variant="subtitle2" color="textSecondary">Risk Score</Typography>
                <Typography>{viewingRisk.score ?? 'Not calculated'}</Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="subtitle2" color="textSecondary">Due Date</Typography>
                <Typography>
                  {viewingRisk.dueDate ? new Date(viewingRisk.dueDate).toLocaleDateString() : '-'}
                </Typography>
              </Grid>
              {viewingRisk.mitigationPlan && (
                <Grid item xs={12}>
                  <Typography variant="subtitle2" color="textSecondary">Mitigation Plan</Typography>
                  <Typography>{viewingRisk.mitigationPlan}</Typography>
                </Grid>
              )}
              <Grid item xs={6}>
                <Typography variant="subtitle2" color="textSecondary">Created</Typography>
                <Typography>{new Date(viewingRisk.createdAt).toLocaleString()}</Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="subtitle2" color="textSecondary">Last Updated</Typography>
                <Typography>{new Date(viewingRisk.updatedAt).toLocaleString()}</Typography>
              </Grid>
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenViewDialog(false)}>Close</Button>
          <Button 
            onClick={() => {
              if (viewingRisk) {
                handleEditRisk(viewingRisk);
                setOpenViewDialog(false);
              }
            }} 
            variant="contained"
          >
            Edit
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
