import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Chip,
  Typography,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { GenericListPage, ColumnDefinition } from '../../components/common/GenericListPage';
import { itsmApi, ChangeTemplateData } from '../../services/grcClient';
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
  if (axErr.response?.status === 403) {
    return 'You do not have permission to view change templates.';
  }
  return 'Failed to load change templates. Please try again.';
}

export const ItsmChangeTemplateList: React.FC = () => {
  const navigate = useNavigate();
  const { showNotification } = useNotification();
  const [templates, setTemplates] = useState<ChangeTemplateData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [search, setSearch] = useState('');

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await itsmApi.changeTemplates.list({ page, pageSize, search: search || undefined });
      const data = response.data;
      if (data && typeof data === 'object') {
        const envelope = data as Record<string, unknown>;
        const inner = envelope.data;
        if (inner && typeof inner === 'object' && !Array.isArray(inner) && 'items' in (inner as Record<string, unknown>)) {
          const paginated = inner as { items: ChangeTemplateData[]; total: number };
          setTemplates(Array.isArray(paginated.items) ? paginated.items : []);
          setTotal(paginated.total || 0);
        } else if (Array.isArray(inner)) {
          setTemplates(inner as ChangeTemplateData[]);
          setTotal((inner as ChangeTemplateData[]).length);
        } else if (Array.isArray(data)) {
          setTemplates(data as ChangeTemplateData[]);
          setTotal((data as ChangeTemplateData[]).length);
        } else {
          setTemplates([]);
          setTotal(0);
        }
      } else {
        setTemplates([]);
        setTotal(0);
      }
    } catch (err) {
      console.error('Error fetching change templates:', err);
      const msg = getErrorMessage(err);
      setError(msg);
      showNotification(msg, 'error');
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search, showNotification]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const handleDelete = useCallback(async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this template?')) return;
    try {
      await itsmApi.changeTemplates.delete(id);
      showNotification('Template deleted successfully', 'success');
      fetchTemplates();
    } catch (err) {
      console.error('Error deleting template:', err);
      showNotification('Failed to delete template', 'error');
    }
  }, [fetchTemplates, showNotification]);

  const columns: ColumnDefinition<ChangeTemplateData>[] = useMemo(() => [
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
      key: 'code',
      header: 'Code',
      render: (row) => (
        <Typography variant="body2" color="text.secondary" fontFamily="monospace">
          {row.code}
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
          variant="outlined"
        />
      ),
    },
    {
      key: 'version',
      header: 'Version',
      render: (row) => (
        <Typography variant="body2" color="text.secondary">
          v{row.version}
        </Typography>
      ),
    },
    {
      key: 'tasks',
      header: 'Tasks',
      render: (row) => (
        <Typography variant="body2" color="text.secondary">
          {row.tasks?.length ?? 0}
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
    {
      key: 'actions',
      header: '',
      render: (row) => (
        <Tooltip title="Delete template">
          <IconButton
            size="small"
            onClick={(e) => handleDelete(row.id, e)}
            data-testid={`delete-template-${row.id}`}
          >
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      ),
    },
  ], [handleDelete]);

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" fontWeight={600}>
          Change Templates
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => navigate('/itsm/change-templates/new')}
          data-testid="create-template-btn"
        >
          New Template
        </Button>
      </Box>

      <GenericListPage<ChangeTemplateData>
        title="Change Templates"
        items={templates}
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
        onRefresh={fetchTemplates}
        onRowClick={(row) => navigate(`/itsm/change-templates/${row.id}`)}
        emptyMessage="No change templates found. Create one to get started."
        searchPlaceholder="Search templates..."
        getRowKey={(row) => row.id}
      />
    </Box>
  );
};

export default ItsmChangeTemplateList;
