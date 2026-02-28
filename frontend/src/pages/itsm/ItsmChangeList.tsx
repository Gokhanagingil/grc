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
  return 'Failed to load ITSM changes. Please try again.';
}

interface ItsmChange {
  id: string;
  number: string;
  title: string;
  description?: string;
  type: string;
  state: string;
  risk: string;
  approvalStatus: string;
  plannedStartAt?: string;
  plannedEndAt?: string;
  service?: { id: string; name: string };
  customerCompany?: { id: string; name: string; type: string } | null;
  createdAt: string;
  updatedAt: string;
}

const stateColors: Record<string, 'default' | 'info' | 'warning' | 'success' | 'error'> = {
  DRAFT: 'default',
  ASSESS: 'info',
  AUTHORIZE: 'warning',
  IMPLEMENT: 'info',
  REVIEW: 'warning',
  CLOSED: 'success',
};

const typeColors: Record<string, 'default' | 'info' | 'warning' | 'error'> = {
  STANDARD: 'default',
  NORMAL: 'info',
  EMERGENCY: 'error',
};

const riskColors: Record<string, 'success' | 'warning' | 'error' | 'default'> = {
  LOW: 'success',
  MEDIUM: 'warning',
  HIGH: 'error',
};

const approvalColors: Record<string, 'default' | 'info' | 'success' | 'error'> = {
  NOT_REQUESTED: 'default',
  REQUESTED: 'info',
  APPROVED: 'success',
  REJECTED: 'error',
};

export const ItsmChangeList: React.FC = () => {
  const navigate = useNavigate();
  const { showNotification } = useNotification();
  const [changes, setChanges] = useState<ItsmChange[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [search, setSearch] = useState('');
  const [companyFilter, setCompanyFilter] = useState('');
  const { companies } = useCompanyLookup();

  const fetchChanges = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await itsmApi.changes.list({ page, pageSize, q: search, customerCompanyId: companyFilter || undefined });
      const data = response.data;
      if (data && typeof data === 'object') {
        const envelope = data as Record<string, unknown>;
        const inner = envelope.data;
        if (inner && typeof inner === 'object' && !Array.isArray(inner) && 'items' in (inner as Record<string, unknown>)) {
          const paginated = inner as { items: ItsmChange[]; total: number };
          setChanges(Array.isArray(paginated.items) ? paginated.items : []);
          setTotal(paginated.total || 0);
        } else if (Array.isArray(inner)) {
          setChanges(inner as ItsmChange[]);
          setTotal((inner as ItsmChange[]).length);
        } else {
          setChanges([]);
          setTotal(0);
        }
      } else {
        setChanges([]);
        setTotal(0);
      }
    } catch (err) {
      console.error('Error fetching ITSM changes:', err);
      const msg = getErrorMessage(err);
      setError(msg);
      showNotification(msg, 'error');
      setChanges([]);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search, companyFilter, showNotification]);

  useEffect(() => {
    fetchChanges();
  }, [fetchChanges]);

  const columns: ColumnDefinition<ItsmChange>[] = useMemo(() => [
    {
      key: 'number',
      header: 'Number',
      render: (row) => (
        <Typography variant="body2" fontWeight={500}>
          {row.number}
        </Typography>
      ),
    },
    {
      key: 'title',
      header: 'Title',
      render: (row) => (
        <Typography variant="body2" noWrap sx={{ maxWidth: 250 }}>
          {row.title}
        </Typography>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      render: (row) => (
        <Chip
          label={row.type}
          size="small"
          color={typeColors[row.type?.toUpperCase()] || 'default'}
          variant="outlined"
        />
      ),
    },
    {
      key: 'state',
      header: 'State',
      render: (row) => (
        <Chip
          label={row.state}
          size="small"
          color={stateColors[row.state?.toUpperCase()] || 'default'}
        />
      ),
    },
    {
      key: 'risk',
      header: 'Risk',
      render: (row) => (
        <Chip
          label={row.risk}
          size="small"
          color={riskColors[row.risk?.toUpperCase()] || 'default'}
          variant="outlined"
        />
      ),
    },
    {
      key: 'approvalStatus',
      header: 'Approval',
      render: (row) => (
        <Chip
          label={(row.approvalStatus || '').replace('_', ' ')}
          size="small"
          color={approvalColors[row.approvalStatus?.toUpperCase()] || 'default'}
          variant="outlined"
        />
      ),
    },
    {
      key: 'service',
      header: 'Service',
      render: (row) => (
        <Typography variant="body2" color="text.secondary">
          {row.service?.name || '-'}
        </Typography>
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

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" fontWeight={600}>
          Changes
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
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
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => navigate('/itsm/changes/new')}
          >
            New Change
          </Button>
        </Box>
      </Box>

      <GenericListPage<ItsmChange>
        title="Changes"
        items={changes}
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
        onRefresh={fetchChanges}
        onRowClick={(row) => navigate(`/itsm/changes/${row.id}`)}
        emptyMessage="No changes found"
        searchPlaceholder="Search changes..."
        getRowKey={(row) => row.id}
      />
    </Box>
  );
};

export default ItsmChangeList;
