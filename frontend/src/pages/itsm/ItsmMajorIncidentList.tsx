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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
} from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';
import { GenericListPage, ColumnDefinition } from '../../components/common/GenericListPage';
import {
  itsmApi,
  ItsmMajorIncidentData,
  CreateItsmMajorIncidentDto,
  unwrapPaginatedResponse,
} from '../../services/grcClient';
import { useNotification } from '../../contexts/NotificationContext';
import { classifyApiError } from '../../utils/apiErrorClassifier';

const statusColors: Record<string, 'default' | 'info' | 'warning' | 'success' | 'error'> = {
  DECLARED: 'error',
  INVESTIGATING: 'warning',
  MITIGATING: 'warning',
  MONITORING: 'info',
  RESOLVED: 'success',
  PIR_PENDING: 'info',
  CLOSED: 'default',
};

const severityColors: Record<string, 'error' | 'warning' | 'info' | 'default'> = {
  SEV1: 'error',
  SEV2: 'warning',
  SEV3: 'info',
};

const STATUS_FILTER_OPTIONS = [
  { value: 'DECLARED', label: 'Declared' },
  { value: 'INVESTIGATING', label: 'Investigating' },
  { value: 'MITIGATING', label: 'Mitigating' },
  { value: 'MONITORING', label: 'Monitoring' },
  { value: 'RESOLVED', label: 'Resolved' },
  { value: 'PIR_PENDING', label: 'PIR Pending' },
  { value: 'CLOSED', label: 'Closed' },
];

const SEVERITY_FILTER_OPTIONS = [
  { value: 'SEV1', label: 'SEV1 - Critical' },
  { value: 'SEV2', label: 'SEV2 - High' },
  { value: 'SEV3', label: 'SEV3 - Medium' },
];

function toDisplayLabel(val: string): string {
  return val.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export const ItsmMajorIncidentList: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { showNotification } = useNotification();
  const [items, setItems] = useState<ItsmMajorIncidentData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [createTitle, setCreateTitle] = useState('');
  const [createDescription, setCreateDescription] = useState('');
  const [createSeverity, setCreateSeverity] = useState('SEV1');
  const [creating, setCreating] = useState(false);

  const page = parseInt(searchParams.get('page') || '1', 10);
  const pageSize = parseInt(searchParams.get('pageSize') || '20', 10);
  const search = searchParams.get('q') || '';
  const statusFilter = searchParams.get('status') || '';
  const severityFilter = searchParams.get('severity') || '';

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

  const fetchItems = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await itsmApi.majorIncidents.list({
        page,
        pageSize,
        search: search || undefined,
        status: statusFilter || undefined,
        severity: severityFilter || undefined,
      });
      const { items, total: totalCount } = unwrapPaginatedResponse<ItsmMajorIncidentData>(response);
      setItems(items);
      setTotal(totalCount);
    } catch (err) {
      console.error('Error fetching major incidents:', err);
      const classified = classifyApiError(err);
      const msg = classified.kind === 'auth'
        ? 'Session expired. Please log in again.'
        : classified.message || 'Failed to load major incidents. Please try again.';
      setError(msg);
      showNotification(msg, 'error');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search, statusFilter, severityFilter, showNotification]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const handleCreate = async () => {
    if (!createTitle.trim()) return;
    setCreating(true);
    try {
      const dto: CreateItsmMajorIncidentDto = {
        title: createTitle.trim(),
        description: createDescription.trim() || undefined,
        severity: createSeverity || undefined,
      };
      const response = await itsmApi.majorIncidents.create(dto);
      const created = (response.data as { data?: ItsmMajorIncidentData })?.data;
      showNotification('Major Incident declared successfully', 'success');
      setCreateOpen(false);
      setCreateTitle('');
      setCreateDescription('');
      setCreateSeverity('SEV1');
      if (created?.id) {
        navigate(`/itsm/major-incidents/${created.id}`);
      } else {
        fetchItems();
      }
    } catch (err) {
      console.error('Error creating major incident:', err);
      showNotification('Failed to declare major incident', 'error');
    } finally {
      setCreating(false);
    }
  };

  const columns: ColumnDefinition<ItsmMajorIncidentData>[] = useMemo(() => [
    {
      key: 'number',
      header: 'Number',
      render: (row) => (
        <Typography variant="body2" fontWeight={600} data-testid="mi-number">
          {row.number}
        </Typography>
      ),
    },
    {
      key: 'title',
      header: 'Title',
      render: (row) => (
        <Typography variant="body2" noWrap sx={{ maxWidth: 300 }}>
          {row.title}
        </Typography>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <Chip
          label={toDisplayLabel(row.status)}
          size="small"
          color={statusColors[row.status] || 'default'}
          data-testid="mi-status-chip"
        />
      ),
    },
    {
      key: 'severity',
      header: 'Severity',
      render: (row) => (
        <Chip
          label={row.severity}
          size="small"
          color={severityColors[row.severity] || 'default'}
          variant="outlined"
        />
      ),
    },
    {
      key: 'declaredAt',
      header: 'Declared',
      render: (row) => (
        <Typography variant="body2" color="text.secondary">
          {row.declaredAt ? new Date(row.declaredAt).toLocaleString() : '-'}
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
      <FormControl size="small" sx={{ minWidth: 150 }}>
        <InputLabel>Status</InputLabel>
        <Select
          value={statusFilter}
          label="Status"
          onChange={(e) => updateParams({ status: e.target.value, page: '1' })}
          data-testid="mi-status-filter"
        >
          <MenuItem value="">All Statuses</MenuItem>
          {STATUS_FILTER_OPTIONS.map((opt) => (
            <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
          ))}
        </Select>
      </FormControl>
      <FormControl size="small" sx={{ minWidth: 140 }}>
        <InputLabel>Severity</InputLabel>
        <Select
          value={severityFilter}
          label="Severity"
          onChange={(e) => updateParams({ severity: e.target.value, page: '1' })}
          data-testid="mi-severity-filter"
        >
          <MenuItem value="">All Severities</MenuItem>
          {SEVERITY_FILTER_OPTIONS.map((opt) => (
            <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
          ))}
        </Select>
      </FormControl>
    </Box>
  );

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" fontWeight={600}>
          Major Incidents
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          {filterActions}
          <Button
            variant="contained"
            color="error"
            startIcon={<AddIcon />}
            onClick={() => setCreateOpen(true)}
            data-testid="declare-mi-btn"
          >
            Declare Major Incident
          </Button>
        </Box>
      </Box>

      <GenericListPage<ItsmMajorIncidentData>
        title="Major Incidents"
        items={items}
        columns={columns}
        isLoading={loading}
        error={error}
        onClearError={() => setError(null)}
        total={total}
        page={page}
        pageSize={pageSize}
        search={search}
        onPageChange={(p) => updateParams({ page: String(p) })}
        onPageSizeChange={(ps) => updateParams({ pageSize: String(ps), page: '1' })}
        onSearchChange={(s) => updateParams({ q: s, page: '1' })}
        onRefresh={fetchItems}
        onRowClick={(row) => {
          const params = searchParams.toString();
          navigate(`/itsm/major-incidents/${row.id}${params ? `?returnParams=${encodeURIComponent(params)}` : ''}`);
        }}
        emptyMessage="No major incidents found. Declare one using the button above."
        searchPlaceholder="Search major incidents..."
        getRowKey={(row) => row.id}
        testId="itsm-major-incident-list"
      />

      {/* Declare Major Incident Dialog */}
      <Dialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        maxWidth="sm"
        fullWidth
        data-testid="declare-mi-dialog"
      >
        <DialogTitle>Declare Major Incident</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <TextField
              label="Title"
              value={createTitle}
              onChange={(e) => setCreateTitle(e.target.value)}
              fullWidth
              required
              autoFocus
              data-testid="mi-title-input"
            />
            <TextField
              label="Description"
              value={createDescription}
              onChange={(e) => setCreateDescription(e.target.value)}
              fullWidth
              multiline
              rows={3}
              data-testid="mi-description-input"
            />
            <FormControl fullWidth>
              <InputLabel>Severity</InputLabel>
              <Select
                value={createSeverity}
                label="Severity"
                onChange={(e) => setCreateSeverity(e.target.value)}
                data-testid="mi-severity-select"
              >
                {SEVERITY_FILTER_OPTIONS.map((opt) => (
                  <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)}>Cancel</Button>
          <Button
            onClick={handleCreate}
            variant="contained"
            color="error"
            disabled={!createTitle.trim() || creating}
            data-testid="confirm-declare-mi-btn"
          >
            {creating ? 'Declaring...' : 'Declare'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ItsmMajorIncidentList;
