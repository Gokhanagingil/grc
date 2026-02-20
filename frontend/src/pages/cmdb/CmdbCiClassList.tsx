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
} from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';
import { GenericListPage, ColumnDefinition } from '../../components/common/GenericListPage';
import { cmdbApi, CmdbCiClassData } from '../../services/grcClient';
import { useNotification } from '../../contexts/NotificationContext';

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

  const fetchItems = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await cmdbApi.classes.list({ page, pageSize, q: search });
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
      console.error('Error fetching CI classes:', err);
      setError('Failed to load CI classes.');
      showNotification('Failed to load CI classes.', 'error');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search, showNotification]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

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
      const axiosErr = err as { response?: { status?: number } };
      if (axiosErr?.response?.status === 403) {
        showNotification('You don\'t have permission to create CI classes.', 'error');
      } else {
        showNotification('Failed to create CI class', 'error');
      }
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
        <Chip
          label={row.isActive ? 'Active' : 'Inactive'}
          size="small"
          color={row.isActive ? 'success' : 'default'}
        />
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
          CI Classes
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setDialogOpen(true)}
        >
          New Class
        </Button>
      </Box>

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
        onRowClick={(row) => navigate(`/cmdb/cis?classId=${row.id}`)}
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
