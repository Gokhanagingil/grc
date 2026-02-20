import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Chip,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
} from '@mui/material';
import { Upload as UploadIcon } from '@mui/icons-material';
import { GenericListPage, ColumnDefinition } from '../../components/common/GenericListPage';
import { cmdbImportApi, CmdbImportJobData } from '../../services/grcClient';
import { useNotification } from '../../contexts/NotificationContext';

const statusColors: Record<string, 'success' | 'warning' | 'error' | 'default' | 'info' | 'primary'> = {
  PENDING: 'default',
  PARSING: 'info',
  RECONCILING: 'warning',
  COMPLETED: 'success',
  FAILED: 'error',
  APPLIED: 'primary',
};

export const CmdbImportJobList: React.FC = () => {
  const navigate = useNavigate();
  const { showNotification } = useNotification();
  const [items, setItems] = useState<CmdbImportJobData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [jsonInput, setJsonInput] = useState('');
  const [creating, setCreating] = useState(false);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await cmdbImportApi.jobs.list({ page, pageSize, q: search });
      const data = response.data;
      if (data && 'data' in data) {
        const inner = data.data;
        if (inner && 'items' in inner) {
          setItems(Array.isArray(inner.items) ? inner.items : []);
          setTotal(inner.total || 0);
        } else {
          setItems(Array.isArray(inner) ? inner : []);
          setTotal(data.total || 0);
        }
      } else {
        setItems([]);
        setTotal(0);
      }
    } catch (err) {
      console.error('Error fetching import jobs:', err);
      setError('Failed to load import jobs.');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const handleCreate = async () => {
    setCreating(true);
    try {
      const rows = JSON.parse(jsonInput);
      if (!Array.isArray(rows) || rows.length === 0) {
        showNotification('Please provide a non-empty JSON array of rows', 'error');
        setCreating(false);
        return;
      }
      await cmdbImportApi.jobs.create({ dryRun: true, rows });
      showNotification('Import job created successfully (dry-run)', 'success');
      setCreateOpen(false);
      setJsonInput('');
      fetchItems();
    } catch (err) {
      console.error('Error creating import job:', err);
      showNotification('Failed to create import job. Check JSON format.', 'error');
    } finally {
      setCreating(false);
    }
  };

  const columns: ColumnDefinition<CmdbImportJobData>[] = useMemo(() => [
    {
      key: 'id',
      header: 'Job ID',
      render: (row) => (
        <Typography variant="body2" fontWeight={500} sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
          {row.id.substring(0, 8)}...
        </Typography>
      ),
    },
    {
      key: 'source',
      header: 'Source',
      render: (row) => (
        <Typography variant="body2" color="text.secondary">
          {row.source?.name || 'Direct Import'}
        </Typography>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <Chip label={row.status} size="small" color={statusColors[row.status] || 'default'} />
      ),
    },
    {
      key: 'dryRun',
      header: 'Mode',
      render: (row) => (
        <Chip
          label={row.dryRun ? 'Dry Run' : 'Live'}
          size="small"
          variant="outlined"
          color={row.dryRun ? 'info' : 'success'}
        />
      ),
    },
    {
      key: 'totalRows',
      header: 'Rows',
      render: (row) => (
        <Typography variant="body2">{row.totalRows}</Typography>
      ),
    },
    {
      key: 'counts',
      header: 'Create / Update / Conflict / Error',
      render: (row) => (
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <Chip label={row.createdCount} size="small" color="success" variant="outlined" sx={{ minWidth: 32 }} />
          <Chip label={row.updatedCount} size="small" color="info" variant="outlined" sx={{ minWidth: 32 }} />
          <Chip label={row.conflictCount} size="small" color="warning" variant="outlined" sx={{ minWidth: 32 }} />
          <Chip label={row.errorCount} size="small" color="error" variant="outlined" sx={{ minWidth: 32 }} />
        </Box>
      ),
    },
    {
      key: 'createdAt',
      header: 'Created',
      render: (row) => (
        <Typography variant="body2" color="text.secondary">
          {new Date(row.createdAt).toLocaleString()}
        </Typography>
      ),
    },
  ], []);

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" fontWeight={600}>
          Import Jobs
        </Typography>
        <Button
          variant="contained"
          startIcon={<UploadIcon />}
          onClick={() => setCreateOpen(true)}
        >
          New Import (Dry Run)
        </Button>
      </Box>

      <GenericListPage<CmdbImportJobData>
        title="Import Jobs"
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
        onRowClick={(row) => navigate(`/cmdb/import-jobs/${row.id}`)}
        emptyMessage="No import jobs found. Create your first dry-run import."
        searchPlaceholder="Search import jobs..."
        getRowKey={(row) => row.id}
      />

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>New Import Job (Dry Run)</DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }}>
            Paste JSON rows below. Each row should be an object with CI fields like hostname, ip_address, serial_number, environment, etc.
          </Alert>
          <TextField
            multiline
            rows={12}
            fullWidth
            placeholder={`[\n  { "hostname": "web-server-01", "ip_address": "10.0.1.10", "environment": "production" },\n  { "hostname": "db-server-01", "ip_address": "10.0.2.20", "serial_number": "SN-12345" }\n]`}
            value={jsonInput}
            onChange={(e) => setJsonInput(e.target.value)}
            sx={{ fontFamily: 'monospace', mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleCreate} disabled={creating || !jsonInput.trim()}>
            {creating ? 'Creating...' : 'Run Dry-Run Import'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default CmdbImportJobList;
