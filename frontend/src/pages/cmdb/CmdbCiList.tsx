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
import { cmdbApi, CmdbCiData } from '../../services/grcClient';
import { useNotification } from '../../contexts/NotificationContext';

const lifecycleColors: Record<string, 'success' | 'warning' | 'error' | 'default' | 'info'> = {
  installed: 'info',
  active: 'success',
  retired: 'error',
};

const environmentColors: Record<string, 'error' | 'warning' | 'info' | 'success' | 'default'> = {
  production: 'error',
  staging: 'warning',
  development: 'info',
  test: 'default',
};

export const CmdbCiList: React.FC = () => {
  const navigate = useNavigate();
  const { showNotification } = useNotification();
  const [items, setItems] = useState<CmdbCiData[]>([]);
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
      const response = await cmdbApi.cis.list({ page, pageSize, q: search });
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
      } else {
        setItems([]);
        setTotal(0);
      }
    } catch (err) {
      console.error('Error fetching CIs:', err);
      setError('Failed to load configuration items.');
      showNotification('Failed to load configuration items.', 'error');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search, showNotification]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const columns: ColumnDefinition<CmdbCiData>[] = useMemo(() => [
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
      key: 'ciClass',
      header: 'Class',
      render: (row) => (
        <Typography variant="body2" color="text.secondary">
          {row.ciClass?.label || row.classId?.substring(0, 8) || '-'}
        </Typography>
      ),
    },
    {
      key: 'lifecycle',
      header: 'Lifecycle',
      render: (row) => (
        <Chip
          label={row.lifecycle || '-'}
          size="small"
          color={lifecycleColors[row.lifecycle] || 'default'}
        />
      ),
    },
    {
      key: 'environment',
      header: 'Environment',
      render: (row) => (
        <Chip
          label={row.environment || '-'}
          size="small"
          color={environmentColors[row.environment] || 'default'}
          variant="outlined"
        />
      ),
    },
    {
      key: 'ipAddress',
      header: 'IP Address',
      render: (row) => (
        <Typography variant="body2" color="text.secondary">
          {row.ipAddress || '-'}
        </Typography>
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
          Configuration Items
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => navigate('/cmdb/cis/new')}
        >
          New CI
        </Button>
      </Box>

      <GenericListPage<CmdbCiData>
        title="Configuration Items"
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
        onRowClick={(row) => navigate(`/cmdb/cis/${row.id}`)}
        emptyMessage="No configuration items found"
        searchPlaceholder="Search CIs..."
        getRowKey={(row) => row.id}
      />
    </Box>
  );
};

export default CmdbCiList;
