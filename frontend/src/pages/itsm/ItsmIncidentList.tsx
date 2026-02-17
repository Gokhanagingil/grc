import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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
  status: string;
  priority: string;
  impact: string;
  urgency: string;
  category?: string;
  riskReviewRequired: boolean;
  service?: { id: string; name: string };
  assignee?: { id: string; firstName: string; lastName: string };
  createdAt: string;
  updatedAt: string;
}

const stateColors: Record<string, 'default' | 'info' | 'warning' | 'success' | 'error'> = {
  NEW: 'info',
  OPEN: 'info',
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

const STATE_FILTER_OPTIONS = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];
const PRIORITY_FILTER_OPTIONS = ['P1', 'P2', 'P3', 'P4', 'P5'];

export const ItsmIncidentList: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { showNotification } = useNotification();
  const [incidents, setIncidents] = useState<ItsmIncident[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  const page = parseInt(searchParams.get('page') || '1', 10);
  const pageSize = parseInt(searchParams.get('pageSize') || '20', 10);
  const search = searchParams.get('q') || '';
  const stateFilter = searchParams.get('state') || '';
  const priorityFilter = searchParams.get('priority') || '';

  const updateParams = useCallback((updates: Record<string, string>) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      Object.entries(updates).forEach(([key, value]) => {
        if (value) {
          next.set(key, value);
        } else {
          next.delete(key);
        }
      });
      return next;
    });
  }, [setSearchParams]);

  const fetchIncidents = useCallback(async () => {
    setLoading(true);
    try {
      const response = await itsmApi.incidents.list({
        page,
        pageSize,
        q: search || undefined,
        state: stateFilter || undefined,
        priority: priorityFilter || undefined,
      });
      const data = response.data;
      if (data && typeof data === 'object') {
        const d = data as Record<string, unknown>;
        const items = d.data ?? d.items;
        setIncidents(Array.isArray(items) ? items as ItsmIncident[] : []);
        setTotal((d.total as number) || 0);
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
  }, [page, pageSize, search, stateFilter, priorityFilter, showNotification]);

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
      render: (row) => {
        const displayState = row.status || row.state || 'UNKNOWN';
        return (
          <Chip
            label={displayState.replace(/_/g, ' ')}
            size="small"
            color={stateColors[displayState] || 'default'}
          />
        );
      },
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
      key: 'category',
      header: 'Category',
      render: (row) => (
        <Typography variant="body2" color="text.secondary">
          {row.category || '-'}
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

  const filterActions = (
    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
      <FormControl size="small" sx={{ minWidth: 130 }}>
        <InputLabel>State</InputLabel>
        <Select
          value={stateFilter}
          label="State"
          onChange={(e) => updateParams({ state: e.target.value, page: '1' })}
        >
          <MenuItem value="">All States</MenuItem>
          {STATE_FILTER_OPTIONS.map((opt) => (
            <MenuItem key={opt} value={opt}>{opt.replace(/_/g, ' ')}</MenuItem>
          ))}
        </Select>
      </FormControl>
      <FormControl size="small" sx={{ minWidth: 130 }}>
        <InputLabel>Priority</InputLabel>
        <Select
          value={priorityFilter}
          label="Priority"
          onChange={(e) => updateParams({ priority: e.target.value, page: '1' })}
        >
          <MenuItem value="">All Priorities</MenuItem>
          {PRIORITY_FILTER_OPTIONS.map((opt) => (
            <MenuItem key={opt} value={opt}>{opt}</MenuItem>
          ))}
        </Select>
      </FormControl>
    </Box>
  );

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" fontWeight={600}>
          Incidents
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          {filterActions}
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => navigate('/itsm/incidents/new')}
          >
            New Incident
          </Button>
        </Box>
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
        onPageChange={(p) => updateParams({ page: String(p) })}
        onPageSizeChange={(ps) => updateParams({ pageSize: String(ps), page: '1' })}
        onSearchChange={(s) => updateParams({ q: s, page: '1' })}
        onRefresh={fetchIncidents}
        onRowClick={(row) => {
          const params = searchParams.toString();
          navigate(`/itsm/incidents/${row.id}${params ? `?returnParams=${encodeURIComponent(params)}` : ''}`);
        }}
        emptyMessage="No incidents found"
        searchPlaceholder="Search incidents..."
        getRowKey={(row) => row.id}
        testId="itsm-incident-list"
      />
    </Box>
  );
};

export default ItsmIncidentList;
