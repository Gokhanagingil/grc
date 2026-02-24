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
import { itsmApi, ItsmProblemData } from '../../services/grcClient';
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
  return 'Failed to load problems. Please try again.';
}

const stateColors: Record<string, 'default' | 'info' | 'warning' | 'success' | 'error'> = {
  NEW: 'info',
  UNDER_INVESTIGATION: 'warning',
  KNOWN_ERROR: 'error',
  RESOLVED: 'success',
  CLOSED: 'default',
};

const priorityColors: Record<string, 'error' | 'warning' | 'info' | 'success' | 'default'> = {
  P1: 'error',
  P2: 'warning',
  P3: 'info',
  P4: 'success',
};

const STATE_FILTER_OPTIONS = [
  { value: 'NEW', label: 'New' },
  { value: 'UNDER_INVESTIGATION', label: 'Under Investigation' },
  { value: 'KNOWN_ERROR', label: 'Known Error' },
  { value: 'RESOLVED', label: 'Resolved' },
  { value: 'CLOSED', label: 'Closed' },
];

const PRIORITY_FILTER_OPTIONS = [
  { value: 'P1', label: 'P1 - Critical' },
  { value: 'P2', label: 'P2 - High' },
  { value: 'P3', label: 'P3 - Medium' },
  { value: 'P4', label: 'P4 - Low' },
];

function toDisplayLabel(val: unknown): string {
  if (val == null) return '\u2014';
  if (typeof val !== 'string') return String(val);
  if (val.trim() === '') return '\u2014';
  return val.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export const ItsmProblemList: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { showNotification } = useNotification();
  const [problems, setProblems] = useState<ItsmProblemData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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

  const fetchProblems = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await itsmApi.problems.list({
        page,
        pageSize,
        search: search || undefined,
        state: stateFilter || undefined,
        priority: priorityFilter || undefined,
      });
      const data = response.data;
      if (data && typeof data === 'object') {
        const envelope = data as Record<string, unknown>;
        const inner = envelope.data;
        if (inner && typeof inner === 'object' && !Array.isArray(inner) && 'items' in (inner as Record<string, unknown>)) {
          const paginated = inner as { items: ItsmProblemData[]; total: number };
          setProblems(Array.isArray(paginated.items) ? paginated.items : []);
          setTotal(paginated.total || 0);
        } else if (Array.isArray(inner)) {
          setProblems(inner as ItsmProblemData[]);
          setTotal((inner as ItsmProblemData[]).length);
        } else {
          setProblems([]);
          setTotal(0);
        }
      } else {
        setProblems([]);
        setTotal(0);
      }
    } catch (err) {
      console.error('Error fetching problems:', err);
      const msg = getErrorMessage(err);
      setError(msg);
      showNotification(msg, 'error');
      setProblems([]);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search, stateFilter, priorityFilter, showNotification]);

  useEffect(() => {
    fetchProblems();
  }, [fetchProblems]);

  const columns: ColumnDefinition<ItsmProblemData>[] = useMemo(() => [
    {
      key: 'number',
      header: 'Number',
      render: (row) => (
        <Typography variant="body2" fontWeight={500} data-testid="problem-number">
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
      key: 'state',
      header: 'State',
      render: (row) => {
        const state = row.state || 'NEW';
        return (
          <Chip
            label={toDisplayLabel(state)}
            size="small"
            color={stateColors[state] || 'default'}
          />
        );
      },
    },
    {
      key: 'priority',
      header: 'Priority',
      render: (row) => (
        <Chip
          label={row.priority || '-'}
          size="small"
          color={priorityColors[row.priority] || 'default'}
          variant="outlined"
        />
      ),
    },
    {
      key: 'impact',
      header: 'Impact',
      render: (row) => (
        <Typography variant="body2" color="text.secondary">
          {row.impact ? toDisplayLabel(row.impact) : '-'}
        </Typography>
      ),
    },
    {
      key: 'category',
      header: 'Category',
      render: (row) => (
        <Typography variant="body2" color="text.secondary">
          {row.category ? toDisplayLabel(row.category) : '-'}
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
      <FormControl size="small" sx={{ minWidth: 160 }}>
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
      <FormControl size="small" sx={{ minWidth: 130 }}>
        <InputLabel>Priority</InputLabel>
        <Select
          value={priorityFilter}
          label="Priority"
          onChange={(e) => updateParams({ priority: e.target.value, page: '1' })}
        >
          <MenuItem value="">All Priorities</MenuItem>
          {PRIORITY_FILTER_OPTIONS.map((opt) => (
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
          Problems
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          {filterActions}
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => navigate('/itsm/problems/new')}
            data-testid="create-problem-btn"
          >
            New Problem
          </Button>
        </Box>
      </Box>

      <GenericListPage<ItsmProblemData>
        title="Problems"
        items={problems}
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
        onRefresh={fetchProblems}
        onRowClick={(row) => {
          const params = searchParams.toString();
          navigate(`/itsm/problems/${row.id}${params ? `?returnParams=${encodeURIComponent(params)}` : ''}`);
        }}
        emptyMessage="No problems found"
        searchPlaceholder="Search problems..."
        getRowKey={(row) => row.id}
        testId="itsm-problem-list"
      />
    </Box>
  );
};

export default ItsmProblemList;
