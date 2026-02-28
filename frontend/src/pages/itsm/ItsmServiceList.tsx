import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Chip,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Typography,
} from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';
import { GenericListPage, ColumnDefinition } from '../../components/common/GenericListPage';
import { itsmApi } from '../../services/grcClient';
import { ApiError } from '../../services/api';
import { useNotification } from '../../contexts/NotificationContext';
import { useCompanyLookup } from '../../hooks/useCompanyLookup';

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.code === 'UNAUTHORIZED') {
    return 'Session expired. Please log in again.';
  }
  const axErr = error as { response?: { status?: number } };
  if (axErr.response?.status === 401) {
    return 'Session expired. Please log in again.';
  }
  return 'Failed to load ITSM services. Please try again.';
}

interface ItsmService {
  id: string;
  name: string;
  description?: string;
  criticality: string;
  status: string;
  customerCompany?: { id: string; name: string; type: string } | null;
  createdAt: string;
  updatedAt: string;
}

const criticalityColors: Record<string, 'error' | 'warning' | 'info' | 'success' | 'default'> = {
  CRITICAL: 'error',
  HIGH: 'warning',
  MEDIUM: 'info',
  LOW: 'success',
};

const statusColors: Record<string, 'success' | 'warning' | 'error' | 'default'> = {
  ACTIVE: 'success',
  INACTIVE: 'default',
  DEPRECATED: 'error',
  MAINTENANCE: 'warning',
};

export const ItsmServiceList: React.FC = () => {
  const navigate = useNavigate();
  const { showNotification } = useNotification();
  const [services, setServices] = useState<ItsmService[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [search, setSearch] = useState('');
  const [companyFilter, setCompanyFilter] = useState('');
  const { companies } = useCompanyLookup();

  const fetchServices = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await itsmApi.services.list({ page, pageSize, q: search, customerCompanyId: companyFilter || undefined });
      const data = response.data;
      if (data && typeof data === 'object') {
        const envelope = data as Record<string, unknown>;
        const inner = envelope.data;
        if (inner && typeof inner === 'object' && !Array.isArray(inner) && 'items' in (inner as Record<string, unknown>)) {
          const paginated = inner as { items: ItsmService[]; total: number };
          setServices(Array.isArray(paginated.items) ? paginated.items : []);
          setTotal(paginated.total || 0);
        } else if (Array.isArray(inner)) {
          setServices(inner as ItsmService[]);
          setTotal((inner as ItsmService[]).length);
        } else {
          setServices([]);
          setTotal(0);
        }
      } else {
        setServices([]);
        setTotal(0);
      }
    } catch (err) {
      console.error('Error fetching ITSM services:', err);
      const msg = getErrorMessage(err);
      setError(msg);
      showNotification(msg, 'error');
      setServices([]);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search, companyFilter, showNotification]);

  useEffect(() => {
    fetchServices();
  }, [fetchServices]);

  const columns: ColumnDefinition<ItsmService>[] = useMemo(() => [
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
      key: 'description',
      header: 'Description',
      render: (row) => (
        <Typography variant="body2" color="text.secondary" noWrap sx={{ maxWidth: 300 }}>
          {row.description || '-'}
        </Typography>
      ),
    },
    {
      key: 'criticality',
      header: 'Criticality',
      render: (row) => (
        <Chip
          label={row.criticality}
          size="small"
          color={criticalityColors[row.criticality?.toUpperCase()] || 'default'}
        />
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <Chip
          label={row.status}
          size="small"
          color={statusColors[row.status?.toUpperCase()] || 'default'}
          variant="outlined"
        />
      ),
    },
    {
      key: 'customerCompany',
      header: 'Company',
      render: (row) => (
        <Typography variant="body2" color="text.secondary">
          {row.customerCompany?.name || '-'}
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

  const filterActions = (
    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
      <FormControl size="small" sx={{ minWidth: 160 }}>
        <InputLabel>Company</InputLabel>
        <Select
          value={companyFilter}
          label="Company"
          onChange={(e) => { setCompanyFilter(e.target.value); setPage(1); }}
        >
          <MenuItem value="">All Companies</MenuItem>
          {companies.map((c) => (
            <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
          ))}
        </Select>
      </FormControl>
    </Box>
  );

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" fontWeight={600}>
          ITSM Services
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          {filterActions}
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => navigate('/itsm/services/new')}
          >
            New Service
          </Button>
        </Box>
      </Box>

      <GenericListPage<ItsmService>
        title="ITSM Services"
        items={services}
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
        onRefresh={fetchServices}
        onRowClick={(row) => navigate(`/itsm/services/${row.id}`)}
        emptyMessage="No ITSM services found"
        searchPlaceholder="Search services..."
        getRowKey={(row) => row.id}
      />
    </Box>
  );
};

export default ItsmServiceList;
