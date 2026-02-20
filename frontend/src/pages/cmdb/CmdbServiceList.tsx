import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Chip,
  Typography,
} from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';
import { GenericListPage, ColumnDefinition } from '../../components/common/GenericListPage';
import { cmdbApi, CmdbServiceData } from '../../services/grcClient';
import { useNotification } from '../../contexts/NotificationContext';

const statusColors: Record<string, 'success' | 'warning' | 'error' | 'default' | 'info'> = {
  planned: 'info',
  design: 'warning',
  live: 'success',
  retired: 'error',
};

const criticalityColors: Record<string, 'error' | 'warning' | 'info' | 'default'> = {
  critical: 'error',
  high: 'warning',
  medium: 'info',
  low: 'default',
};

export const CmdbServiceList: React.FC = () => {
  const navigate = useNavigate();
  const { showNotification } = useNotification();
  const [items, setItems] = useState<CmdbServiceData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [search, setSearch] = useState('');

  const fetchItems = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await cmdbApi.services.list({ page, pageSize, q: search });
      const data = response.data;
      if (data && 'data' in data) {
        const inner = data.data;
        if (inner && 'items' in inner) {
          setItems(Array.isArray(inner.items) ? inner.items : []);
          setTotal(inner.total || 0);
        } else {
          setItems(Array.isArray(inner) ? inner : []);
          setTotal(data.total || 0);
        }
      } else if (data && 'items' in data) {
        setItems(Array.isArray(data.items) ? data.items : []);
        setTotal(data.total || 0);
      } else {
        setItems([]);
        setTotal(0);
      }
    } catch (err) {
      console.error('Error fetching services:', err);
      setError('Failed to load services.');
      showNotification('Failed to load services.', 'error');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search, showNotification]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const columns: ColumnDefinition<CmdbServiceData>[] = useMemo(() => [
    {
      key: 'name',
      header: 'Name',
      render: (row) => (
        <Typography variant="body2" fontWeight={500}>
          {row.name}
        </Typography>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      render: (row) => (
        <Chip
          label={row.type === 'business_service' ? 'Business' : 'Technical'}
          size="small"
          color={row.type === 'business_service' ? 'primary' : 'secondary'}
          variant="outlined"
        />
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <Chip
          label={row.status || '-'}
          size="small"
          color={statusColors[row.status] || 'default'}
        />
      ),
    },
    {
      key: 'tier',
      header: 'Tier',
      render: (row) => (
        <Typography variant="body2" color="text.secondary">
          {row.tier ? row.tier.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : '-'}
        </Typography>
      ),
    },
    {
      key: 'criticality',
      header: 'Criticality',
      render: (row) => (
        <Chip
          label={row.criticality || '-'}
          size="small"
          color={criticalityColors[row.criticality || ''] || 'default'}
          variant="outlined"
        />
      ),
    },
    {
      key: 'updatedAt',
      header: 'Last Updated',
      render: (row) => (
        <Typography variant="body2" color="text.secondary">
          {new Date(row.updatedAt).toLocaleDateString()}
        </Typography>
      ),
    },
  ], []);

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" fontWeight={600}>
          Services
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => navigate('/cmdb/services/new')}
          data-testid="btn-create-service"
        >
          New Service
        </Button>
      </Box>

      <GenericListPage<CmdbServiceData>
        title="Services"
        items={items}
        columns={columns}
        isLoading={loading}
        error={error}
        onClearError={() => setError(null)}
        total={total}
        page={page}
        pageSize={pageSize}
        search={search}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        onSearchChange={setSearch}
        onRefresh={fetchItems}
        onRowClick={(row) => navigate(`/cmdb/services/${row.id}`)}
        emptyMessage="No services found"
        searchPlaceholder="Search services..."
        getRowKey={(row) => row.id}
      />
    </Box>
  );
};

export default CmdbServiceList;
