import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Button,
  Chip,
  Alert,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import {
  AdminPageHeader,
  AdminTable,
  Column,
} from '../../components/admin';
import { api } from '../../services/api';

interface Tenant {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export const AdminTenants: React.FC = () => {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [total, setTotal] = useState(0);

  const fetchTenants = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get('/tenants', {
        params: {
          page: page + 1,
          limit: rowsPerPage,
        },
      });
      const data = response.data?.data || response.data;
      const tenantList = Array.isArray(data) ? data : data?.tenants || [];
      setTenants(tenantList);
      setTotal(data?.meta?.total || data?.pagination?.total || tenantList.length);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch tenants';
      setError(errorMessage);
      setTenants([]);
    } finally {
      setLoading(false);
    }
  }, [page, rowsPerPage]);

  useEffect(() => {
    fetchTenants();
  }, [fetchTenants]);

  const columns: Column<Tenant>[] = [
    {
      id: 'name',
      label: 'Name',
      minWidth: 200,
    },
    {
      id: 'code',
      label: 'Code',
      minWidth: 120,
    },
    {
      id: 'isActive',
      label: 'Status',
      minWidth: 100,
      format: (value) => (
        <Chip
          label={value ? 'Active' : 'Inactive'}
          size="small"
          color={value ? 'success' : 'default'}
        />
      ),
    },
    {
      id: 'createdAt',
      label: 'Created',
      minWidth: 120,
      format: (value) => value ? new Date(value as string).toLocaleDateString() : '-',
    },
    {
      id: 'updatedAt',
      label: 'Updated',
      minWidth: 120,
      format: (value) => value ? new Date(value as string).toLocaleDateString() : '-',
    },
  ];

  return (
    <Box>
      <AdminPageHeader
        title="Tenant Management"
        subtitle="View and manage tenants in the system"
        breadcrumbs={[
          { label: 'Admin', href: '/admin' },
          { label: 'Tenants' },
        ]}
        actions={
          <Button startIcon={<RefreshIcon />} onClick={fetchTenants}>
            Refresh
          </Button>
        }
      />

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Alert severity="info" sx={{ mb: 2 }}>
        Tenant management is currently read-only. Contact system administrator for tenant changes.
      </Alert>

      <AdminTable<Tenant>
        columns={columns}
        data={tenants}
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
        emptyMessage="No tenants found"
      />
    </Box>
  );
};

export default AdminTenants;
