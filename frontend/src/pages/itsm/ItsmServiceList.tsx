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

interface ItsmService {
  id: string;
  name: string;
  description?: string;
  criticality: string;
  status: string;
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
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [search, setSearch] = useState('');

  const fetchServices = useCallback(async () => {
    setLoading(true);
    try {
      const response = await itsmApi.services.list({ page, pageSize, q: search });
      const data = response.data;
      if (data && 'data' in data) {
        setServices(Array.isArray(data.data) ? data.data : []);
        setTotal(data.total || 0);
      } else {
        setServices([]);
        setTotal(0);
      }
    } catch (error) {
      console.error('Error fetching ITSM services:', error);
      showNotification('Failed to load ITSM services', 'error');
      setServices([]);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search, showNotification]);

  useEffect(() => {
    fetchServices();
  }, [fetchServices]);

  const columns = [
    {
      id: 'name',
      label: 'Name',
      render: (row: ItsmService) => (
        <Typography variant="body2" fontWeight={500}>
          {row.name}
        </Typography>
      ),
    },
    {
      id: 'description',
      label: 'Description',
      render: (row: ItsmService) => (
        <Typography variant="body2" color="text.secondary" noWrap sx={{ maxWidth: 300 }}>
          {row.description || '-'}
        </Typography>
      ),
    },
    {
      id: 'criticality',
      label: 'Criticality',
      render: (row: ItsmService) => (
        <Chip
          label={row.criticality}
          size="small"
          color={criticalityColors[row.criticality] || 'default'}
        />
      ),
    },
    {
      id: 'status',
      label: 'Status',
      render: (row: ItsmService) => (
        <Chip
          label={row.status}
          size="small"
          color={statusColors[row.status] || 'default'}
          variant="outlined"
        />
      ),
    },
    {
      id: 'updatedAt',
      label: 'Last Updated',
      render: (row: ItsmService) => (
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
          ITSM Services
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => navigate('/itsm/services/new')}
        >
          New Service
        </Button>
      </Box>

      <GenericListPage
        items={services}
        columns={columns}
        loading={loading}
        total={total}
        page={page}
        pageSize={pageSize}
        search={search}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        onSearchChange={setSearch}
        onRowClick={(row) => navigate(`/itsm/services/${row.id}`)}
        emptyMessage="No ITSM services found"
        searchPlaceholder="Search services..."
      />
    </Box>
  );
};

export default ItsmServiceList;
