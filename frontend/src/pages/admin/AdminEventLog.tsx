import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Button,
  Chip,
  TextField,
  Alert,
  Grid,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  FilterList as FilterIcon,
  Clear as ClearIcon,
} from '@mui/icons-material';
import {
  AdminPageHeader,
  AdminTable,
  Column,
} from '../../components/admin';
import { api } from '../../services/api';

interface SysEvent {
  id: string;
  tenantId: string;
  source: string;
  eventName: string;
  tableName: string | null;
  recordId: string | null;
  payloadJson: Record<string, unknown>;
  createdAt: string;
  status: string;
  actorId: string | null;
}

const statusColors: Record<string, 'success' | 'warning' | 'error' | 'default'> = {
  PENDING: 'warning',
  PROCESSED: 'success',
  FAILED: 'error',
};

export const AdminEventLog: React.FC = () => {
  const [events, setEvents] = useState<SysEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [total, setTotal] = useState(0);
  const [eventNames, setEventNames] = useState<string[]>([]);
  const [tableNames, setTableNames] = useState<string[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<SysEvent | null>(null);

  const [filters, setFilters] = useState({
    eventName: '',
    tableName: '',
    status: '',
    from: '',
    to: '',
  });
  const [showFilters, setShowFilters] = useState(false);

  const fetchEvents = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params: Record<string, unknown> = {
        page: page + 1,
        pageSize: rowsPerPage,
      };
      if (filters.eventName) params.eventName = filters.eventName;
      if (filters.tableName) params.tableName = filters.tableName;
      if (filters.status) params.status = filters.status;
      if (filters.from) params.from = filters.from;
      if (filters.to) params.to = filters.to;

      const response = await api.get('/grc/event-log', { params });
      const data = response.data?.data || response.data;
      setEvents(data?.items || []);
      setTotal(data?.total || 0);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch events';
      setError(errorMessage);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [page, rowsPerPage, filters]);

  const fetchFilterOptions = useCallback(async () => {
    try {
      const [namesRes, tablesRes] = await Promise.all([
        api.get('/grc/event-log/event-names'),
        api.get('/grc/event-log/table-names'),
      ]);
      setEventNames(namesRes.data?.data || namesRes.data || []);
      setTableNames(tablesRes.data?.data || tablesRes.data || []);
    } catch {
      // non-fatal
    }
  }, []);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  useEffect(() => {
    fetchFilterOptions();
  }, [fetchFilterOptions]);

  const handleFilterChange = (field: string, value: string) => {
    setFilters(prev => ({ ...prev, [field]: value }));
    setPage(0);
  };

  const handleClearFilters = () => {
    setFilters({ eventName: '', tableName: '', status: '', from: '', to: '' });
    setPage(0);
  };

  const hasActiveFilters = Object.values(filters).some(v => v !== '');

  const columns: Column<SysEvent>[] = [
    {
      id: 'createdAt',
      label: 'Timestamp',
      minWidth: 160,
      format: (value) => value ? new Date(value as string).toLocaleString() : '-',
    },
    {
      id: 'eventName',
      label: 'Event',
      minWidth: 160,
    },
    {
      id: 'source',
      label: 'Source',
      minWidth: 120,
    },
    {
      id: 'tableName',
      label: 'Table',
      minWidth: 120,
      format: (value) => (value as string) || '-',
    },
    {
      id: 'recordId',
      label: 'Record ID',
      minWidth: 100,
      format: (value) => {
        const id = value as string;
        return id ? id.substring(0, 8) + '...' : '-';
      },
    },
    {
      id: 'status',
      label: 'Status',
      minWidth: 100,
      format: (value) => (
        <Chip
          label={value as string}
          size="small"
          color={statusColors[value as string] || 'default'}
        />
      ),
    },
    {
      id: 'actorId',
      label: 'Actor',
      minWidth: 100,
      format: (value) => {
        const actor = value as string;
        return actor ? actor.substring(0, 8) + '...' : '-';
      },
    },
  ];

  return (
    <Box>
      <AdminPageHeader
        title="Event Log"
        subtitle="View platform events emitted by CRUD, workflow, SLA, and business rules"
        breadcrumbs={[
          { label: 'Admin', href: '/admin' },
          { label: 'Event Log' },
        ]}
        actions={
          <>
            <Button
              startIcon={<FilterIcon />}
              onClick={() => setShowFilters(!showFilters)}
              color={hasActiveFilters ? 'primary' : 'inherit'}
            >
              Filters {hasActiveFilters && `(${Object.values(filters).filter(v => v).length})`}
            </Button>
            <Button startIcon={<RefreshIcon />} onClick={fetchEvents}>
              Refresh
            </Button>
          </>
        }
      />

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {showFilters && (
        <Box sx={{ mb: 3, p: 2, bgcolor: 'background.paper', borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} sm={6} md={2}>
              <TextField
                label="Event Name"
                select
                value={filters.eventName}
                onChange={(e) => handleFilterChange('eventName', e.target.value)}
                size="small"
                fullWidth
              >
                <MenuItem value="">All</MenuItem>
                {eventNames.map(n => <MenuItem key={n} value={n}>{n}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <TextField
                label="Table"
                select
                value={filters.tableName}
                onChange={(e) => handleFilterChange('tableName', e.target.value)}
                size="small"
                fullWidth
              >
                <MenuItem value="">All</MenuItem>
                {tableNames.map(n => <MenuItem key={n} value={n}>{n}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <TextField
                label="Status"
                select
                value={filters.status}
                onChange={(e) => handleFilterChange('status', e.target.value)}
                size="small"
                fullWidth
              >
                <MenuItem value="">All</MenuItem>
                <MenuItem value="PENDING">Pending</MenuItem>
                <MenuItem value="PROCESSED">Processed</MenuItem>
                <MenuItem value="FAILED">Failed</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <TextField
                label="From"
                type="date"
                value={filters.from}
                onChange={(e) => handleFilterChange('from', e.target.value)}
                size="small"
                fullWidth
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <TextField
                label="To"
                type="date"
                value={filters.to}
                onChange={(e) => handleFilterChange('to', e.target.value)}
                size="small"
                fullWidth
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <Button
                startIcon={<ClearIcon />}
                onClick={handleClearFilters}
                disabled={!hasActiveFilters}
                fullWidth
              >
                Clear
              </Button>
            </Grid>
          </Grid>
        </Box>
      )}

      <AdminTable<SysEvent>
        columns={columns}
        data={events}
        loading={loading}
        error={null}
        rowKey="id"
        onRowClick={(row) => setSelectedEvent(row)}
        pagination={{
          page,
          rowsPerPage,
          total,
          onPageChange: setPage,
          onRowsPerPageChange: (newRowsPerPage) => {
            setRowsPerPage(newRowsPerPage);
            setPage(0);
          },
        }}
        emptyMessage="No events found"
      />

      <Dialog
        open={!!selectedEvent}
        onClose={() => setSelectedEvent(null)}
        maxWidth="md"
        fullWidth
      >
        {selectedEvent && (
          <>
            <DialogTitle>
              Event: {selectedEvent.eventName}
            </DialogTitle>
            <DialogContent dividers>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary">ID</Typography>
                  <Typography variant="body2">{selectedEvent.id}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary">Status</Typography>
                  <Box>
                    <Chip
                      label={selectedEvent.status}
                      size="small"
                      color={statusColors[selectedEvent.status] || 'default'}
                    />
                  </Box>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary">Source</Typography>
                  <Typography variant="body2">{selectedEvent.source}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary">Table</Typography>
                  <Typography variant="body2">{selectedEvent.tableName || '-'}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary">Record ID</Typography>
                  <Typography variant="body2">{selectedEvent.recordId || '-'}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary">Actor</Typography>
                  <Typography variant="body2">{selectedEvent.actorId || '-'}</Typography>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="caption" color="text.secondary">Created At</Typography>
                  <Typography variant="body2">
                    {new Date(selectedEvent.createdAt).toLocaleString()}
                  </Typography>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="caption" color="text.secondary">Payload</Typography>
                  <Box
                    sx={{
                      mt: 0.5,
                      p: 1.5,
                      bgcolor: 'grey.50',
                      borderRadius: 1,
                      fontFamily: 'monospace',
                      fontSize: '0.8rem',
                      overflow: 'auto',
                      maxHeight: 300,
                    }}
                  >
                    <pre style={{ margin: 0 }}>
                      {JSON.stringify(selectedEvent.payloadJson, null, 2)}
                    </pre>
                  </Box>
                </Grid>
              </Grid>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setSelectedEvent(null)}>Close</Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Box>
  );
};

export default AdminEventLog;
