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
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon,
  FactCheck as AuditIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { LoadingState, ErrorState, EmptyState, ResponsiveTable, TableToolbar, FilterOption } from '../components/common';
import { ModuleGuard } from '../components/ModuleGuard';
import { api } from '../services/api';

const unwrapResponse = <T,>(response: { data: { success?: boolean; data?: T } | T }): T | null => {
  try {
    if (!response || !response.data) {
      return null;
    }
    const data = response.data;
    if (data && typeof data === 'object' && 'success' in data && 'data' in data) {
      return (data as { success: boolean; data: T }).data;
    }
    return data as T;
  } catch (err) {
    console.error('Error unwrapping response:', err);
    return null;
  }
};

interface Audit {
  id: string;
  name: string;
  description: string | null;
  auditType: 'internal' | 'external' | 'regulatory' | 'compliance';
  status: 'planned' | 'in_progress' | 'completed' | 'closed' | 'cancelled';
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  department: string | null;
  ownerUserId: string | null;
  leadAuditorId: string | null;
  plannedStartDate: string | null;
  plannedEndDate: string | null;
  actualStartDate: string | null;
  actualEndDate: string | null;
  owner?: { firstName?: string; lastName?: string };
  leadAuditor?: { firstName?: string; lastName?: string };
  createdAt: string;
  updatedAt: string;
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
  
  // Initialize canCreate based on user role immediately for admin/manager
  // This ensures the button is visible right away for authorized users
  const userRole = user?.role;
  const isAuthorizedRole = userRole === 'admin' || userRole === 'manager';
  const [canCreate, setCanCreate] = useState(isAuthorizedRole);

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
              pageSize: String(rowsPerPage),
            });

            if (statusFilter) params.append('status', statusFilter);
            if (riskLevelFilter) params.append('riskLevel', riskLevelFilter);
            if (departmentFilter) params.append('department', departmentFilter);
            if (auditTypeFilter) params.append('auditType', auditTypeFilter);
            if (searchQuery) params.append('search', searchQuery);

      const response = await api.get(`/grc/audits?${params.toString()}`);
      const data = unwrapResponse<{ audits: Audit[]; pagination: { total: number } }>(response);
      if (data) {
        setAudits(data.audits || []);
        setTotal(data.pagination?.total || 0);
      } else {
        setAudits([]);
        setTotal(0);
      }
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
    // For admin/manager users, always allow creation regardless of API response
    // This ensures the button is never hidden due to API issues for authorized users
    const userRole = user?.role;
    const isAuthorizedByRole = userRole === 'admin' || userRole === 'manager';
    
    if (isAuthorizedByRole) {
      setCanCreate(true);
      return;
    }
    
    // For other users, check with the API
    try {
      const response = await api.get('/grc/audits/can/create');
      // Handle both envelope format { success: true, data: { allowed: true } } 
      // and flat format { allowed: true }
      const data = response.data?.data || response.data;
      const allowed = data?.allowed === true;
      setCanCreate(allowed);
    } catch {
      // On error, deny access for non-admin/manager users
      setCanCreate(false);
    }
  }, [user?.role]);

  const fetchDepartments = useCallback(async () => {
    try {
      const response = await api.get('/grc/audits/distinct/department');
      const data = unwrapResponse<string[]>(response);
      setDepartments(data || []);
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

  const handleDeleteAudit = async (id: string) => {
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

        {/* Toolbar with Search and Filters */}
        <TableToolbar
          searchValue={searchQuery}
          onSearchChange={(value) => {
            setSearchQuery(value);
            setPage(0);
          }}
          searchPlaceholder="Search audits..."
          filters={[
            ...(statusFilter ? [{ key: 'status', label: 'Status', value: formatStatus(statusFilter) }] : []),
            ...(riskLevelFilter ? [{ key: 'riskLevel', label: 'Risk', value: riskLevelFilter.charAt(0).toUpperCase() + riskLevelFilter.slice(1) }] : []),
            ...(auditTypeFilter ? [{ key: 'auditType', label: 'Type', value: auditTypeFilter.charAt(0).toUpperCase() + auditTypeFilter.slice(1) }] : []),
            ...(departmentFilter ? [{ key: 'department', label: 'Dept', value: departmentFilter }] : []),
          ] as FilterOption[]}
          onFilterRemove={(key) => {
            if (key === 'status') { setStatusFilter(''); setPage(0); }
            if (key === 'riskLevel') { setRiskLevelFilter(''); setPage(0); }
            if (key === 'auditType') { setAuditTypeFilter(''); setPage(0); }
            if (key === 'department') { setDepartmentFilter(''); setPage(0); }
          }}
          onClearFilters={() => {
            clearFilters();
            setPage(0);
          }}
          onRefresh={fetchAudits}
          loading={loading}
          actions={
            <Box display="flex" gap={1} flexWrap="wrap">
              <FormControl size="small" sx={{ minWidth: 120 }}>
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

              <FormControl size="small" sx={{ minWidth: 120 }}>
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

              <FormControl size="small" sx={{ minWidth: 100 }}>
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
                <FormControl size="small" sx={{ minWidth: 130 }}>
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
            </Box>
          }
        />

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
                                                    label={audit.auditType.charAt(0).toUpperCase() + audit.auditType.slice(1)}
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
                                                    label={audit.riskLevel.charAt(0).toUpperCase() + audit.riskLevel.slice(1)}
                                                    size="small"
                                                    color={getRiskLevelColor(audit.riskLevel)}
                                                  />
                                                </TableCell>
                                                <TableCell>{audit.department || '-'}</TableCell>
                                                <TableCell>
                                                  {audit.owner?.firstName && audit.owner?.lastName
                                                    ? `${audit.owner.firstName} ${audit.owner.lastName}`
                                                    : '-'}
                                                </TableCell>
                                                <TableCell>
                                                  {audit.plannedStartDate || audit.plannedEndDate ? (
                                                    <Typography variant="body2">
                                                      {formatDate(audit.plannedStartDate)} - {formatDate(audit.plannedEndDate)}
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
