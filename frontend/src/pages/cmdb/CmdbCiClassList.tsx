import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Chip,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
} from '@mui/material';
import {
  Add as AddIcon,
  AccountTree as TreeIcon,
} from '@mui/icons-material';
import { GenericListPage, ColumnDefinition } from '../../components/common/GenericListPage';
import {
  cmdbApi,
  CmdbCiClassData,
  ClassSummaryResponse,
  ContentPackStatusResponse,
  unwrapPaginatedResponse,
  unwrapResponse,
} from '../../services/grcClient';
import { useNotification } from '../../contexts/NotificationContext';
import { classifyApiError } from '../../utils/apiErrorClassifier';

export const CmdbCiClassList: React.FC = () => {
  const navigate = useNavigate();
  const { showNotification } = useNotification();
  const [items, setItems] = useState<CmdbCiClassData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newClass, setNewClass] = useState({ name: '', label: '', description: '' });
  const [saving, setSaving] = useState(false);
  const [summary, setSummary] = useState<ClassSummaryResponse | null>(null);
  const [contentPackStatus, setContentPackStatus] = useState<ContentPackStatusResponse | null>(null);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await cmdbApi.classes.list({ page, pageSize, q: search });
      const result = unwrapPaginatedResponse<CmdbCiClassData>(response);
      setItems(Array.isArray(result.items) ? result.items : []);
      setTotal(result.total || 0);
    } catch (err) {
      const classified = classifyApiError(err);
      console.error('Error fetching CI classes:', err);
      if (classified.kind === 'forbidden') {
        setError('You do not have permission to view CI classes. Contact your administrator.');
      } else if (classified.kind === 'network') {
        setError('Network error. Please check your connection and try again.');
      } else {
        setError(classified.message || 'Failed to load CI classes.');
      }
      showNotification(classified.message || 'Failed to load CI classes.', 'error');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search, showNotification]);

  const fetchSummary = useCallback(async () => {
    try {
      const response = await cmdbApi.classes.summary();
      const data = unwrapResponse<ClassSummaryResponse>(response);
      if (data && typeof data === 'object' && 'total' in data) {
        setSummary(data);
      }
    } catch {
      // Summary fetch is non-critical
    }
  }, []);

  const fetchContentPackStatus = useCallback(async () => {
    try {
      const response = await cmdbApi.classes.contentPackStatus();
      const data = unwrapResponse<ContentPackStatusResponse>(response);
      if (data && typeof data === 'object' && 'applied' in data) {
        setContentPackStatus(data);
      }
    } catch {
      // Content pack status fetch is non-critical
    }
  }, []);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  useEffect(() => {
    fetchSummary();
    fetchContentPackStatus();
  }, [fetchSummary, fetchContentPackStatus]);

  const handleCreate = async () => {
    if (!newClass.name.trim() || !newClass.label.trim()) {
      showNotification('Name and label are required', 'error');
      return;
    }
    setSaving(true);
    try {
      await cmdbApi.classes.create({
        name: newClass.name,
        label: newClass.label,
        description: newClass.description || undefined,
      });
      showNotification('CI class created successfully', 'success');
      setDialogOpen(false);
      setNewClass({ name: '', label: '', description: '' });
      fetchItems();
    } catch (err: unknown) {
      console.error('Error creating CI class:', err);
      const classified = classifyApiError(err);
      showNotification(classified.message || 'Failed to create CI class', 'error');
    } finally {
      setSaving(false);
    }
  };

  const columns: ColumnDefinition<CmdbCiClassData>[] = useMemo(() => [
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
      key: 'label',
      header: 'Label',
      render: (row) => (
        <Typography variant="body2">
          {row.label}
        </Typography>
      ),
    },
    {
      key: 'parentClassId',
      header: 'Parent Class',
      render: (row) => {
        if (!row.parentClassId) return <Typography variant="body2" color="text.secondary">-</Typography>;
        const parent = items.find((c) => c.id === row.parentClassId);
        return (
          <Chip
            label={parent?.label || row.parentClassId.substring(0, 8)}
            size="small"
            variant="outlined"
            color="info"
          />
        );
      },
    },
    {
      key: 'fieldsSchema',
      header: 'Fields',
      render: (row) => {
        const count = Array.isArray(row.fieldsSchema) ? row.fieldsSchema.length : 0;
        return (
          <Typography variant="body2" color="text.secondary">
            {count > 0 ? `${count} field${count > 1 ? 's' : ''}` : '-'}
          </Typography>
        );
      },
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
      key: 'isActive',
      header: 'Status',
      render: (row) => (
        <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
              {row.isSystem && (
                <Chip
                  label="System"
                  size="small"
                  color="primary"
                  data-testid={`system-badge-${row.id}`}
                />
              )}
              {!row.isSystem && (
                <Chip
                  label="Custom"
                  size="small"
                  variant="outlined"
                  color="secondary"
                  data-testid={`custom-badge-${row.id}`}
                />
              )}
              <Chip
                label={row.isActive ? 'Active' : 'Inactive'}
                size="small"
                color={row.isActive ? 'success' : 'default'}
              />
              {row.isAbstract && (
                <Chip
                  label="Abstract"
                  size="small"
                  variant="outlined"
                  color="warning"
                  data-testid={`abstract-badge-${row.id}`}
                />
              )}
        </Box>
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
  ], [items]);

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" fontWeight={600}>
          CI Classes
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            startIcon={<TreeIcon />}
            onClick={() => navigate('/cmdb/classes/tree')}
            data-testid="btn-view-tree"
          >
            Class Tree
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setDialogOpen(true)}
          >
            New Class
          </Button>
        </Box>
      </Box>

      {summary && (
        <Box sx={{ mb: 2, display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center' }} data-testid="class-summary-banner">
          <Chip label={`${summary.total} Total`} size="small" variant="outlined" />
          <Chip label={`${summary.system} System`} size="small" color="primary" variant="outlined" />
          <Chip label={`${summary.custom} Custom`} size="small" color="secondary" variant="outlined" />
          <Chip label={`${summary.abstract} Abstract`} size="small" color="warning" variant="outlined" />
          {contentPackStatus && (
            <Chip
              label={contentPackStatus.applied
                ? `Content Pack: ${contentPackStatus.version || 'Applied'}`
                : 'Content Pack: Not Applied'}
              size="small"
              color={contentPackStatus.applied ? 'success' : 'default'}
              variant="outlined"
              data-testid="content-pack-chip"
            />
          )}
        </Box>
      )}

      {/* Content pack not applied warning */}
      {contentPackStatus && !contentPackStatus.applied && !loading && (
        <Alert severity="info" sx={{ mb: 2 }} data-testid="content-pack-not-applied-alert">
          <Typography variant="subtitle2" gutterBottom>Baseline Content Pack Not Applied</Typography>
          <Typography variant="body2">
            The CMDB baseline content pack provides system CI classes (e.g., Hardware, Server, Network, Application).
            Ask an administrator to run the content-pack seed to populate the class hierarchy.
          </Typography>
        </Alert>
      )}

      <GenericListPage<CmdbCiClassData>
        title="CI Classes"
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
        onRowClick={(row) => navigate(`/cmdb/classes/${row.id}`)}
        emptyMessage="No CI classes found"
        searchPlaceholder="Search classes..."
        getRowKey={(row) => row.id}
      />

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>New CI Class</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              fullWidth
              label="Name (identifier)"
              value={newClass.name}
              onChange={(e) => setNewClass({ ...newClass, name: e.target.value })}
              required
              placeholder="e.g., server, vm, database"
            />
            <TextField
              fullWidth
              label="Label (display name)"
              value={newClass.label}
              onChange={(e) => setNewClass({ ...newClass, label: e.target.value })}
              required
              placeholder="e.g., Server, Virtual Machine"
            />
            <TextField
              fullWidth
              label="Description"
              value={newClass.description}
              onChange={(e) => setNewClass({ ...newClass, description: e.target.value })}
              multiline
              rows={3}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleCreate} disabled={saving}>
            {saving ? 'Creating...' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default CmdbCiClassList;
