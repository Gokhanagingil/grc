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
  Alert,
  TablePagination,
  Tooltip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  InputAdornment,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon,
  FilterList as FilterIcon,
  Search as SearchIcon,
  FactCheck as AuditIcon,
  Clear as ClearIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { LoadingState, ErrorState, EmptyState, ResponsiveTable } from '../components/common';
import { ModuleGuard } from '../components/ModuleGuard';
import { api } from '../services/api';

interface Audit {
  id: number;
  name: string;
  description: string | null;
  audit_type: 'internal' | 'external';
  status: 'planned' | 'in_progress' | 'completed' | 'closed';
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  department: string | null;
  owner_id: number | null;
  lead_auditor_id: number | null;
  planned_start_date: string | null;
  planned_end_date: string | null;
  actual_start_date: string | null;
  actual_end_date: string | null;
  owner_first_name?: string;
  owner_last_name?: string;
  lead_auditor_first_name?: string;
  lead_auditor_last_name?: string;
  created_at: string;
  updated_at: string;
}

interface AuditPermissions {
  read: boolean;
  write: boolean;
  delete: boolean;
}

export const AuditList: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [audits, setAudits] = useState<Audit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [total, setTotal] = useState(0);
  const [canCreate, setCanCreate] = useState(false);

  const [statusFilter, setStatusFilter] = useState<string>('');
  const [riskLevelFilter, setRiskLevelFilter] = useState<string>('');
  const [departmentFilter, setDepartmentFilter] = useState<string>('');
  const [auditTypeFilter, setAuditTypeFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [departments, setDepartments] = useState<string[]>([]);

  const fetchAudits = useCallback(async () => {
    try {
      setLoading(true);
      setError('');

      const params = new URLSearchParams({
        page: String(page + 1),
        limit: String(rowsPerPage),
      });

      if (statusFilter) params.append('status', statusFilter);
      if (riskLevelFilter) params.append('risk_level', riskLevelFilter);
      if (departmentFilter) params.append('department', departmentFilter);
      if (auditTypeFilter) params.append('audit_type', auditTypeFilter);
      if (searchQuery) params.append('search', searchQuery);

      const response = await api.get(`/grc/audits?${params.toString()}`);
      setAudits(response.data.audits || []);
      setTotal(response.data.pagination?.total || 0);
    } catch (err: unknown) {
      const error = err as { response?: { status?: number; data?: { message?: string } } };
      if (error.response?.status === 403) {
        setError('You do not have permission to view audits.');
      } else {
        setError(error.response?.data?.message || 'Failed to fetch audits');
      }
    } finally {
      setLoading(false);
    }
  }, [page, rowsPerPage, statusFilter, riskLevelFilter, departmentFilter, auditTypeFilter, searchQuery]);

  const fetchCanCreate = useCallback(async () => {
    try {
      const response = await api.get('/grc/audits/can/create');
      setCanCreate(response.data.allowed);
    } catch {
      setCanCreate(false);
    }
  }, []);

  const fetchDepartments = useCallback(async () => {
    try {
      const response = await api.get('/grc/audits/distinct/department');
      setDepartments(response.data || []);
    } catch {
      setDepartments([]);
    }
  }, []);

  useEffect(() => {
    fetchAudits();
  }, [fetchAudits]);

  useEffect(() => {
    fetchCanCreate();
    fetchDepartments();
  }, [fetchCanCreate, fetchDepartments]);

  const handleDeleteAudit = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this audit?')) return;

    try {
      await api.delete(`/grc/audits/${id}`);
      setSuccess('Audit deleted successfully');
      fetchAudits();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: unknown) {
      const error = err as { response?: { status?: number; data?: { message?: string } } };
      if (error.response?.status === 403) {
        setError('You do not have permission to delete this audit.');
      } else {
        setError(error.response?.data?.message || 'Failed to delete audit');
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

  const clearFilters = () => {
    setStatusFilter('');
    setRiskLevelFilter('');
    setDepartmentFilter('');
    setAuditTypeFilter('');
    setSearchQuery('');
    setPage(0);
  };

  const hasFilters = statusFilter || riskLevelFilter || departmentFilter || auditTypeFilter || searchQuery;

  const getStatusColor = (status: string): 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning' => {
    switch (status) {
      case 'planned': return 'default';
      case 'in_progress': return 'primary';
      case 'completed': return 'success';
      case 'closed': return 'info';
      default: return 'default';
    }
  };

  const getRiskLevelColor = (level: string): 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning' => {
    switch (level) {
      case 'low': return 'success';
      case 'medium': return 'warning';
      case 'high': return 'error';
      case 'critical': return 'error';
      default: return 'default';
    }
  };

  const formatStatus = (status: string): string => {
    return status.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  const formatDate = (dateStr: string | null): string => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString();
  };

  if (loading && audits.length === 0) {
    return (
      <ModuleGuard moduleKey="audit">
        <LoadingState message="Loading audits..." />
      </ModuleGuard>
    );
  }

  if (error && audits.length === 0) {
    return (
      <ModuleGuard moduleKey="audit">
        <ErrorState
          title="Failed to load audits"
          message={error}
          onRetry={fetchAudits}
        />
      </ModuleGuard>
    );
  }

  return (
    <ModuleGuard moduleKey="audit">
      <Box>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Typography variant="h4">Audit Management</Typography>
          {canCreate && (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => navigate('/audits/new')}
            >
              New Audit
            </Button>
          )}
        </Box>

        {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
        {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}

        <Card sx={{ mb: 2 }}>
          <CardContent>
            <Box display="flex" gap={2} alignItems="center" flexWrap="wrap">
              <FilterIcon color="action" />
              
              <TextField
                size="small"
                placeholder="Search audits..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(0);
                }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon />
                    </InputAdornment>
                  ),
                }}
                sx={{ minWidth: 200 }}
              />

              <FormControl size="small" sx={{ minWidth: 130 }}>
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
                  <MenuItem value="planned">Planned</MenuItem>
                  <MenuItem value="in_progress">In Progress</MenuItem>
                  <MenuItem value="completed">Completed</MenuItem>
                  <MenuItem value="closed">Closed</MenuItem>
                </Select>
              </FormControl>

              <FormControl size="small" sx={{ minWidth: 130 }}>
                <InputLabel>Risk Level</InputLabel>
                <Select
                  value={riskLevelFilter}
                  label="Risk Level"
                  onChange={(e) => {
                    setRiskLevelFilter(e.target.value);
                    setPage(0);
                  }}
                >
                  <MenuItem value="">All</MenuItem>
                  <MenuItem value="low">Low</MenuItem>
                  <MenuItem value="medium">Medium</MenuItem>
                  <MenuItem value="high">High</MenuItem>
                  <MenuItem value="critical">Critical</MenuItem>
                </Select>
              </FormControl>

              <FormControl size="small" sx={{ minWidth: 130 }}>
                <InputLabel>Type</InputLabel>
                <Select
                  value={auditTypeFilter}
                  label="Type"
                  onChange={(e) => {
                    setAuditTypeFilter(e.target.value);
                    setPage(0);
                  }}
                >
                  <MenuItem value="">All</MenuItem>
                  <MenuItem value="internal">Internal</MenuItem>
                  <MenuItem value="external">External</MenuItem>
                </Select>
              </FormControl>

              {departments.length > 0 && (
                <FormControl size="small" sx={{ minWidth: 150 }}>
                  <InputLabel>Department</InputLabel>
                  <Select
                    value={departmentFilter}
                    label="Department"
                    onChange={(e) => {
                      setDepartmentFilter(e.target.value);
                      setPage(0);
                    }}
                  >
                    <MenuItem value="">All</MenuItem>
                    {departments.map((dept) => (
                      <MenuItem key={dept} value={dept}>{dept}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}

              {hasFilters && (
                <Button
                  size="small"
                  startIcon={<ClearIcon />}
                  onClick={clearFilters}
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
                    <TableCell>Name</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Risk Level</TableCell>
                    <TableCell>Department</TableCell>
                    <TableCell>Owner</TableCell>
                    <TableCell>Planned Dates</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {audits.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} align="center" sx={{ py: 0, border: 'none' }}>
                        <EmptyState
                          icon={<AuditIcon sx={{ fontSize: 64, color: 'text.disabled' }} />}
                          title="No audits found"
                          message={hasFilters ? 'Try adjusting your filters.' : 'Get started by creating your first audit.'}
                          actionLabel={canCreate && !hasFilters ? 'Create Audit' : undefined}
                          onAction={canCreate && !hasFilters ? () => navigate('/audits/new') : undefined}
                          minHeight="200px"
                        />
                      </TableCell>
                    </TableRow>
                  ) : (
                    audits.map((audit) => (
                      <TableRow key={audit.id} hover>
                        <TableCell>
                          <Typography variant="subtitle2">{audit.name}</Typography>
                          {audit.description && (
                            <Typography variant="body2" color="textSecondary" noWrap sx={{ maxWidth: 200 }}>
                              {audit.description}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={audit.audit_type === 'internal' ? 'Internal' : 'External'}
                            size="small"
                            variant="outlined"
                          />
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={formatStatus(audit.status)}
                            size="small"
                            color={getStatusColor(audit.status)}
                          />
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={audit.risk_level.charAt(0).toUpperCase() + audit.risk_level.slice(1)}
                            size="small"
                            color={getRiskLevelColor(audit.risk_level)}
                          />
                        </TableCell>
                        <TableCell>{audit.department || '-'}</TableCell>
                        <TableCell>
                          {audit.owner_first_name && audit.owner_last_name
                            ? `${audit.owner_first_name} ${audit.owner_last_name}`
                            : '-'}
                        </TableCell>
                        <TableCell>
                          {audit.planned_start_date || audit.planned_end_date ? (
                            <Typography variant="body2">
                              {formatDate(audit.planned_start_date)} - {formatDate(audit.planned_end_date)}
                            </Typography>
                          ) : '-'}
                        </TableCell>
                        <TableCell>
                          <Tooltip title="View">
                            <IconButton
                              size="small"
                              onClick={() => navigate(`/audits/${audit.id}`)}
                            >
                              <ViewIcon />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Edit">
                            <IconButton
                              size="small"
                              onClick={() => navigate(`/audits/${audit.id}/edit`)}
                            >
                              <EditIcon />
                            </IconButton>
                          </Tooltip>
                          {(user?.role === 'admin' || user?.role === 'manager') && (
                            <Tooltip title="Delete">
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() => handleDeleteAudit(audit.id)}
                              >
                                <DeleteIcon />
                              </IconButton>
                            </Tooltip>
                          )}
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
      </Box>
    </ModuleGuard>
  );
};

export default AuditList;
