import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Button,
  Chip,
  TextField,
  Alert,
  Grid,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  FilterList as FilterIcon,
  Clear as ClearIcon,
} from '@mui/icons-material';
import {
  AdminPageHeader,
  AdminTable,
  Column,
} from '../../components/admin';
import { api } from '../../services/api';

interface AuditLog {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  userId: string;
  userEmail?: string;
  changes?: Record<string, unknown>;
  ipAddress?: string;
  createdAt: string;
}

const actionColors: Record<string, 'success' | 'warning' | 'error' | 'info' | 'default'> = {
  CREATE: 'success',
  UPDATE: 'warning',
  DELETE: 'error',
  LOGIN: 'info',
  LOGOUT: 'default',
};

export const AdminAuditLogs: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [total, setTotal] = useState(0);

  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    action: '',
    actor: '',
  });
  const [showFilters, setShowFilters] = useState(false);

  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params: Record<string, unknown> = {
        page: page + 1,
        limit: rowsPerPage,
      };
      if (filters.startDate) params.startDate = filters.startDate;
      if (filters.endDate) params.endDate = filters.endDate;
      if (filters.action) params.action = filters.action;
      if (filters.actor) params.actor = filters.actor;

      const response = await api.get('/audit-logs', { params });
      const data = response.data?.data || response.data;
      const logList = Array.isArray(data) ? data : data?.logs || [];
      setLogs(logList);
      setTotal(data?.meta?.total || data?.pagination?.total || logList.length);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch audit logs';
      setError(errorMessage);
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [page, rowsPerPage, filters]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleFilterChange = (field: string, value: string) => {
    setFilters(prev => ({ ...prev, [field]: value }));
    setPage(0);
  };

  const handleClearFilters = () => {
    setFilters({
      startDate: '',
      endDate: '',
      action: '',
      actor: '',
    });
    setPage(0);
  };

  const hasActiveFilters = Object.values(filters).some(v => v !== '');

  const columns: Column<AuditLog>[] = [
    {
      id: 'createdAt',
      label: 'Timestamp',
      minWidth: 160,
      format: (value) => value ? new Date(value as string).toLocaleString() : '-',
    },
    {
      id: 'action',
      label: 'Action',
      minWidth: 100,
      format: (value) => (
        <Chip
          label={value as string}
          size="small"
          color={actionColors[value as string] || 'default'}
        />
      ),
    },
    {
      id: 'entityType',
      label: 'Entity Type',
      minWidth: 120,
    },
    {
      id: 'entityId',
      label: 'Entity ID',
      minWidth: 100,
      format: (value) => {
        const id = value as string;
        return id ? id.substring(0, 8) + '...' : '-';
      },
    },
    {
      id: 'userEmail',
      label: 'Actor',
      minWidth: 180,
      format: (value, row) => (value as string) || row.userId || '-',
    },
    {
      id: 'ipAddress',
      label: 'IP Address',
      minWidth: 120,
      format: (value) => (value as string) || '-',
    },
  ];

  return (
    <Box>
      <AdminPageHeader
        title="Audit Logs"
        subtitle="View system activity and audit trail"
        breadcrumbs={[
          { label: 'Admin', href: '/admin' },
          { label: 'Audit Logs' },
        ]}
        actions={
          <>
            <Button
              startIcon={<FilterIcon />}
              onClick={() => setShowFilters(!showFilters)}
              color={hasActiveFilters ? 'primary' : 'inherit'}
            >
              Filters {hasActiveFilters && `(${Object.values(filters).filter(v => v).length})`}
            </Button>
            <Button startIcon={<RefreshIcon />} onClick={fetchLogs}>
              Refresh
            </Button>
          </>
        }
      />

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {showFilters && (
        <Box sx={{ mb: 3, p: 2, bgcolor: 'background.paper', borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                label="Start Date"
                type="date"
                value={filters.startDate}
                onChange={(e) => handleFilterChange('startDate', e.target.value)}
                size="small"
                fullWidth
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                label="End Date"
                type="date"
                value={filters.endDate}
                onChange={(e) => handleFilterChange('endDate', e.target.value)}
                size="small"
                fullWidth
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <TextField
                label="Action"
                value={filters.action}
                onChange={(e) => handleFilterChange('action', e.target.value)}
                size="small"
                fullWidth
                placeholder="CREATE, UPDATE..."
              />
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <TextField
                label="Actor"
                value={filters.actor}
                onChange={(e) => handleFilterChange('actor', e.target.value)}
                size="small"
                fullWidth
                placeholder="Email or ID"
              />
            </Grid>
            <Grid item xs={12} sm={12} md={2}>
              <Button
                startIcon={<ClearIcon />}
                onClick={handleClearFilters}
                disabled={!hasActiveFilters}
                fullWidth
              >
                Clear
              </Button>
            </Grid>
          </Grid>
        </Box>
      )}

      <AdminTable<AuditLog>
        columns={columns}
        data={logs}
        loading={loading}
        error={null}
        rowKey="id"
        pagination={{
          page,
          rowsPerPage,
          total,
          onPageChange: setPage,
          onRowsPerPageChange: (newRowsPerPage) => {
            setRowsPerPage(newRowsPerPage);
            setPage(0);
          },
        }}
        emptyMessage="No audit logs found"
      />
    </Box>
  );
};

export default AdminAuditLogs;
