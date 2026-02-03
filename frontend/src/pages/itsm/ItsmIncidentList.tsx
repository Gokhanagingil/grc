import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Chip,
  Typography,
} from '@mui/material';
import { Add as AddIcon, Warning as WarningIcon } from '@mui/icons-material';
import { GenericListPage, ColumnDefinition } from '../../components/common/GenericListPage';
import { itsmApi } from '../../services/grcClient';
import { useNotification } from '../../contexts/NotificationContext';

interface ItsmIncident {
  id: string;
  number: string;
  shortDescription: string;
  description?: string;
  state: string;
  priority: string;
  impact: string;
  urgency: string;
  riskReviewRequired: boolean;
  service?: { id: string; name: string };
  assignee?: { id: string; firstName: string; lastName: string };
  createdAt: string;
  updatedAt: string;
}

const stateColors: Record<string, 'default' | 'info' | 'warning' | 'success'> = {
  NEW: 'info',
  IN_PROGRESS: 'warning',
  RESOLVED: 'success',
  CLOSED: 'default',
};

const priorityColors: Record<string, 'error' | 'warning' | 'info' | 'success' | 'default'> = {
  P1: 'error',
  P2: 'warning',
  P3: 'info',
  P4: 'success',
  P5: 'default',
};

export const ItsmIncidentList: React.FC = () => {
  const navigate = useNavigate();
  const { showNotification } = useNotification();
  const [incidents, setIncidents] = useState<ItsmIncident[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [search, setSearch] = useState('');

  const fetchIncidents = useCallback(async () => {
    setLoading(true);
    try {
      const response = await itsmApi.incidents.list({ page, pageSize, q: search });
      const data = response.data;
      if (data && 'data' in data) {
        setIncidents(Array.isArray(data.data) ? data.data : []);
        setTotal(data.total || 0);
      } else {
        setIncidents([]);
        setTotal(0);
      }
    } catch (error) {
      console.error('Error fetching ITSM incidents:', error);
      showNotification('Failed to load ITSM incidents', 'error');
      setIncidents([]);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search, showNotification]);

  useEffect(() => {
    fetchIncidents();
  }, [fetchIncidents]);

  const columns: ColumnDefinition<ItsmIncident>[] = useMemo(() => [
    {
      key: 'number',
      header: 'Number',
      render: (row) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="body2" fontWeight={500}>
            {row.number}
          </Typography>
          {row.riskReviewRequired && (
            <Chip
              icon={<WarningIcon />}
              label="Risk Review"
              size="small"
              color="error"
              variant="outlined"
            />
          )}
        </Box>
      ),
    },
    {
      key: 'shortDescription',
      header: 'Short Description',
      render: (row) => (
        <Typography variant="body2" noWrap sx={{ maxWidth: 300 }}>
          {row.shortDescription}
        </Typography>
      ),
    },
    {
      key: 'state',
      header: 'State',
      render: (row) => (
        <Chip
          label={row.state.replace('_', ' ')}
          size="small"
          color={stateColors[row.state] || 'default'}
        />
      ),
    },
    {
      key: 'priority',
      header: 'Priority',
      render: (row) => (
        <Chip
          label={row.priority}
          size="small"
          color={priorityColors[row.priority] || 'default'}
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
      key: 'assignee',
      header: 'Assignee',
      render: (row) => (
        <Typography variant="body2" color="text.secondary">
          {row.assignee ? `${row.assignee.firstName} ${row.assignee.lastName}` : 'Unassigned'}
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
          Incidents
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => navigate('/itsm/incidents/new')}
        >
          New Incident
        </Button>
      </Box>

      <GenericListPage<ItsmIncident>
        title="Incidents"
        items={incidents}
        columns={columns}
        isLoading={loading}
        error={null}
        total={total}
        page={page}
        pageSize={pageSize}
        search={search}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        onSearchChange={setSearch}
        onRefresh={fetchIncidents}
        onRowClick={(row) => navigate(`/itsm/incidents/${row.id}`)}
        emptyMessage="No incidents found"
        searchPlaceholder="Search incidents..."
        getRowKey={(row) => row.id}
      />
    </Box>
  );
};

export default ItsmIncidentList;
