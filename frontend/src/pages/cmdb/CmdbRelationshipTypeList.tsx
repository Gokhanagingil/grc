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
import { cmdbApi, CmdbRelationshipTypeData } from '../../services/grcClient';
import { useNotification } from '../../contexts/NotificationContext';

const DIRECTIONALITY_COLORS: Record<string, 'info' | 'secondary'> = {
  unidirectional: 'info',
  bidirectional: 'secondary',
};

const RISK_PROPAGATION_COLORS: Record<string, 'warning' | 'error' | 'success' | 'default'> = {
  forward: 'warning',
  reverse: 'error',
  both: 'success',
  none: 'default',
};

export const CmdbRelationshipTypeList: React.FC = () => {
  const navigate = useNavigate();
  const { showNotification } = useNotification();
  const [items, setItems] = useState<CmdbRelationshipTypeData[]>([]);
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
      const response = await cmdbApi.relationshipTypes.list({ page, pageSize, q: search });
      const data = response.data;
      // Defensive: handle LIST-CONTRACT { items, total, ... } or { data: { items, ... } }
      if (data && typeof data === 'object') {
        if ('data' in data && data.data && typeof data.data === 'object') {
          const inner = data.data as Record<string, unknown>;
          if ('items' in inner && Array.isArray(inner.items)) {
            setItems(inner.items as CmdbRelationshipTypeData[]);
            setTotal((inner.total as number) || 0);
          } else if (Array.isArray(inner)) {
            setItems(inner as unknown as CmdbRelationshipTypeData[]);
            setTotal((data as Record<string, unknown>).total as number || 0);
          } else {
            setItems([]);
            setTotal(0);
          }
        } else if ('items' in data && Array.isArray(data.items)) {
          setItems(data.items as CmdbRelationshipTypeData[]);
          setTotal((data as Record<string, unknown>).total as number || 0);
        } else {
          setItems([]);
          setTotal(0);
        }
      } else {
        setItems([]);
        setTotal(0);
      }
    } catch (err) {
      console.error('Error fetching relationship types:', err);
      setError('Failed to load relationship types.');
      showNotification('Failed to load relationship types.', 'error');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search, showNotification]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const columns: ColumnDefinition<CmdbRelationshipTypeData>[] = useMemo(() => [
    {
      key: 'name',
      header: 'Name',
      render: (row) => (
        <Typography variant="body2" fontWeight={500} fontFamily="monospace">
          {row.name}
        </Typography>
      ),
    },
    {
      key: 'label',
      header: 'Label',
      render: (row) => (
        <Typography variant="body2">
          {row.label}
        </Typography>
      ),
    },
    {
      key: 'directionality',
      header: 'Directionality',
      render: (row) => (
        <Chip
          label={row.directionality}
          size="small"
          color={DIRECTIONALITY_COLORS[row.directionality] || 'default'}
          variant="outlined"
        />
      ),
    },
    {
      key: 'riskPropagation',
      header: 'Risk Propagation',
      render: (row) => (
        <Chip
          label={row.riskPropagation}
          size="small"
          color={RISK_PROPAGATION_COLORS[row.riskPropagation] || 'default'}
          variant="outlined"
        />
      ),
    },
    {
      key: 'inverseLabel',
      header: 'Inverse Label',
      render: (row) => (
        <Typography variant="body2" color="text.secondary">
          {row.inverseLabel || '-'}
        </Typography>
      ),
    },
    {
      key: 'isSystem',
      header: 'Status',
      render: (row) => (
        <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
          <Chip
            label={row.isActive ? 'Active' : 'Inactive'}
            size="small"
            color={row.isActive ? 'success' : 'default'}
          />
          {row.isSystem && (
            <Chip
              label="System"
              size="small"
              variant="outlined"
              color="info"
              data-testid={`system-badge-${row.id}`}
            />
          )}
        </Box>
      ),
    },
  ], []);

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" fontWeight={600}>
          Relationship Types
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => navigate('/cmdb/relationship-types/new')}
          data-testid="btn-new-relationship-type"
        >
          New Relationship Type
        </Button>
      </Box>

      <GenericListPage<CmdbRelationshipTypeData>
        title="Relationship Types"
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
        onRowClick={(row) => navigate(`/cmdb/relationship-types/${row.id}`)}
        emptyMessage="No relationship types found"
        searchPlaceholder="Search relationship types..."
        getRowKey={(row) => row.id}
        testId="relationship-type-list"
      />
    </Box>
  );
};

export default CmdbRelationshipTypeList;
