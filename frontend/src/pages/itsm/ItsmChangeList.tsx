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
import { itsmApi } from '../../services/grcClient';
import { ApiError } from '../../services/api';
import { useNotification } from '../../contexts/NotificationContext';

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

  const fetchChanges = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await itsmApi.changes.list({ page, pageSize, q: search });
      const data = response.data;
      if (data && 'data' in data) {
        setChanges(Array.isArray(data.data) ? data.data : []);
        setTotal(data.total || 0);
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
  }, [page, pageSize, search, showNotification]);

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
          color={typeColors[row.type] || 'default'}
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
          color={stateColors[row.state] || 'default'}
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
          color={riskColors[row.risk] || 'default'}
          variant="outlined"
        />
      ),
    },
    {
      key: 'approvalStatus',
      header: 'Approval',
      render: (row) => (
        <Chip
          label={row.approvalStatus.replace('_', ' ')}
          size="small"
          color={approvalColors[row.approvalStatus] || 'default'}
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
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => navigate('/itsm/changes/new')}
        >
          New Change
        </Button>
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
