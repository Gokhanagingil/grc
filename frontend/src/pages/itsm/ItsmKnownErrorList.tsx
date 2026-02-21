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
import { Add as AddIcon } from '@mui/icons-material';
import { GenericListPage, ColumnDefinition } from '../../components/common/GenericListPage';
import { itsmApi, ItsmKnownErrorData } from '../../services/grcClient';
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
  return 'Failed to load known errors. Please try again.';
}

const stateColors: Record<string, 'default' | 'info' | 'warning' | 'success' | 'error'> = {
  DRAFT: 'default',
  PUBLISHED: 'success',
  RETIRED: 'warning',
};

const fixStatusColors: Record<string, 'default' | 'info' | 'warning' | 'success' | 'error'> = {
  NONE: 'default',
  WORKAROUND_AVAILABLE: 'info',
  FIX_IN_PROGRESS: 'warning',
  FIX_DEPLOYED: 'success',
};

const STATE_FILTER_OPTIONS = [
  { value: 'DRAFT', label: 'Draft' },
  { value: 'PUBLISHED', label: 'Published' },
  { value: 'RETIRED', label: 'Retired' },
];

const FIX_STATUS_FILTER_OPTIONS = [
  { value: 'NONE', label: 'None' },
  { value: 'WORKAROUND_AVAILABLE', label: 'Workaround Available' },
  { value: 'FIX_IN_PROGRESS', label: 'Fix In Progress' },
  { value: 'FIX_DEPLOYED', label: 'Fix Deployed' },
];

function toDisplayLabel(val: string): string {
  return val.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export const ItsmKnownErrorList: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { showNotification } = useNotification();
  const [knownErrors, setKnownErrors] = useState<ItsmKnownErrorData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);

  const page = parseInt(searchParams.get('page') || '1', 10);
  const pageSize = parseInt(searchParams.get('pageSize') || '20', 10);
  const search = searchParams.get('q') || '';
  const stateFilter = searchParams.get('state') || '';
  const fixStatusFilter = searchParams.get('permanentFixStatus') || '';

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

  const fetchKnownErrors = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await itsmApi.knownErrors.list({
        page,
        pageSize,
        search: search || undefined,
        state: stateFilter || undefined,
        permanentFixStatus: fixStatusFilter || undefined,
      });
      const data = response.data;
      if (data && typeof data === 'object') {
        const envelope = data as Record<string, unknown>;
        const inner = envelope.data;
        if (inner && typeof inner === 'object' && !Array.isArray(inner) && 'items' in (inner as Record<string, unknown>)) {
          const paginated = inner as { items: ItsmKnownErrorData[]; total: number };
          setKnownErrors(Array.isArray(paginated.items) ? paginated.items : []);
          setTotal(paginated.total || 0);
        } else if (Array.isArray(inner)) {
          setKnownErrors(inner as ItsmKnownErrorData[]);
          setTotal((inner as ItsmKnownErrorData[]).length);
        } else {
          setKnownErrors([]);
          setTotal(0);
        }
      } else {
        setKnownErrors([]);
        setTotal(0);
      }
    } catch (err) {
      console.error('Error fetching known errors:', err);
      const msg = getErrorMessage(err);
      setError(msg);
      showNotification(msg, 'error');
      setKnownErrors([]);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search, stateFilter, fixStatusFilter, showNotification]);

  useEffect(() => {
    fetchKnownErrors();
  }, [fetchKnownErrors]);

  const columns: ColumnDefinition<ItsmKnownErrorData>[] = useMemo(() => [
    {
      key: 'title',
      header: 'Title',
      render: (row) => (
        <Typography variant="body2" fontWeight={500} noWrap sx={{ maxWidth: 300 }}>
          {row.title}
        </Typography>
      ),
    },
    {
      key: 'state',
      header: 'State',
      render: (row) => (
        <Chip
          label={toDisplayLabel(row.state || 'DRAFT')}
          size="small"
          color={stateColors[row.state] || 'default'}
        />
      ),
    },
    {
      key: 'permanentFixStatus',
      header: 'Fix Status',
      render: (row) => (
        <Chip
          label={toDisplayLabel(row.permanentFixStatus || 'NONE')}
          size="small"
          color={fixStatusColors[row.permanentFixStatus] || 'default'}
          variant="outlined"
        />
      ),
    },
    {
      key: 'workaround',
      header: 'Workaround',
      render: (row) => (
        <Typography variant="body2" color="text.secondary" noWrap sx={{ maxWidth: 200 }}>
          {row.workaround || '-'}
        </Typography>
      ),
    },
    {
      key: 'publishedAt',
      header: 'Published',
      render: (row) => (
        <Typography variant="body2" color="text.secondary">
          {row.publishedAt ? new Date(row.publishedAt).toLocaleDateString() : '-'}
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
            <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
          ))}
        </Select>
      </FormControl>
      <FormControl size="small" sx={{ minWidth: 180 }}>
        <InputLabel>Fix Status</InputLabel>
        <Select
          value={fixStatusFilter}
          label="Fix Status"
          onChange={(e) => updateParams({ permanentFixStatus: e.target.value, page: '1' })}
        >
          <MenuItem value="">All</MenuItem>
          {FIX_STATUS_FILTER_OPTIONS.map((opt) => (
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
          Known Errors
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          {filterActions}
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => navigate('/itsm/known-errors/new')}
            data-testid="create-known-error-btn"
          >
            New Known Error
          </Button>
        </Box>
      </Box>

      <GenericListPage<ItsmKnownErrorData>
        title="Known Errors"
        items={knownErrors}
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
        onRefresh={fetchKnownErrors}
        onRowClick={(row) => {
          navigate(`/itsm/known-errors/${row.id}`);
        }}
        emptyMessage="No known errors found"
        searchPlaceholder="Search known errors..."
        getRowKey={(row) => row.id}
        testId="itsm-known-error-list"
      />
    </Box>
  );
};

export default ItsmKnownErrorList;
