import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Chip,
  Typography,
} from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';
import { GenericListPage } from '../../components/common/GenericListPage';
import { itsmApi } from '../../services/grcClient';
import { useNotification } from '../../contexts/NotificationContext';

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
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [search, setSearch] = useState('');

  const fetchChanges = useCallback(async () => {
    setLoading(true);
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
    } catch (error) {
      console.error('Error fetching ITSM changes:', error);
      showNotification('Failed to load ITSM changes', 'error');
      setChanges([]);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search, showNotification]);

  useEffect(() => {
    fetchChanges();
  }, [fetchChanges]);

  const columns = [
    {
      id: 'number',
      label: 'Number',
      render: (row: ItsmChange) => (
        <Typography variant="body2" fontWeight={500}>
          {row.number}
        </Typography>
      ),
    },
    {
      id: 'title',
      label: 'Title',
      render: (row: ItsmChange) => (
        <Typography variant="body2" noWrap sx={{ maxWidth: 250 }}>
          {row.title}
        </Typography>
      ),
    },
    {
      id: 'type',
      label: 'Type',
      render: (row: ItsmChange) => (
        <Chip
          label={row.type}
          size="small"
          color={typeColors[row.type] || 'default'}
          variant="outlined"
        />
      ),
    },
    {
      id: 'state',
      label: 'State',
      render: (row: ItsmChange) => (
        <Chip
          label={row.state}
          size="small"
          color={stateColors[row.state] || 'default'}
        />
      ),
    },
    {
      id: 'risk',
      label: 'Risk',
      render: (row: ItsmChange) => (
        <Chip
          label={row.risk}
          size="small"
          color={riskColors[row.risk] || 'default'}
          variant="outlined"
        />
      ),
    },
    {
      id: 'approvalStatus',
      label: 'Approval',
      render: (row: ItsmChange) => (
        <Chip
          label={row.approvalStatus.replace('_', ' ')}
          size="small"
          color={approvalColors[row.approvalStatus] || 'default'}
          variant="outlined"
        />
      ),
    },
    {
      id: 'service',
      label: 'Service',
      render: (row: ItsmChange) => (
        <Typography variant="body2" color="text.secondary">
          {row.service?.name || '-'}
        </Typography>
      ),
    },
    {
      id: 'updatedAt',
      label: 'Last Updated',
      render: (row: ItsmChange) => (
        <Typography variant="body2" color="text.secondary">
          {new Date(row.updatedAt).toLocaleDateString()}
        </Typography>
      ),
    },
  ];

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

      <GenericListPage
        items={changes}
        columns={columns}
        loading={loading}
        total={total}
        page={page}
        pageSize={pageSize}
        search={search}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        onSearchChange={setSearch}
        onRowClick={(row) => navigate(`/itsm/changes/${row.id}`)}
        emptyMessage="No changes found"
        searchPlaceholder="Search changes..."
      />
    </Box>
  );
};

export default ItsmChangeList;
