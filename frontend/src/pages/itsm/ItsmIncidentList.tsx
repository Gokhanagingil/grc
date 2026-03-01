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
  Alert,
} from '@mui/material';
import { Add as AddIcon, Warning as WarningIcon } from '@mui/icons-material';
import { GenericListPage, ColumnDefinition, FilterOption, FilterBuilderBasic, FilterTree, FilterConfig } from '../../components/common';
import { itsmApi } from '../../services/grcClient';
import { ApiError } from '../../services/api';
import { useNotification } from '../../contexts/NotificationContext';
import { useCompanyLookup } from '../../hooks/useCompanyLookup';
import {
  parseListQuery,
  buildListQueryParams,
  serializeFilterTree,
  countFilterConditions,
  extractFilterConditions,
} from '../../utils/listQueryUtils';
import { compileIncidentFilterTreeToQuery } from '../../utils/incidentFilterCompiler';

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.code === 'UNAUTHORIZED') {
    return 'Session expired. Please log in again.';
  }
  const axErr = error as { response?: { status?: number } };
  if (axErr.response?.status === 401) {
    return 'Session expired. Please log in again.';
  }
  return 'Failed to load ITSM incidents. Please try again.';
}

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
  customerCompany?: { id: string; name: string; type: string } | null;
  createdAt: string;
  updatedAt: string;
}

const stateColors: Record<string, 'default' | 'info' | 'warning' | 'success' | 'error'> = {
  new: 'info',
  open: 'info',
  in_progress: 'warning',
  resolved: 'success',
  closed: 'default',
};

const priorityColors: Record<string, 'error' | 'warning' | 'info' | 'success' | 'default'> = {
  p1: 'error',
  p2: 'warning',
  p3: 'info',
  p4: 'success',
};

const STATE_FILTER_OPTIONS = [
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' },
];
const PRIORITY_FILTER_OPTIONS = [
  { value: 'p1', label: 'P1 - Critical' },
  { value: 'p2', label: 'P2 - High' },
  { value: 'p3', label: 'P3 - Medium' },
  { value: 'p4', label: 'P4 - Low' },
];

function toDisplayLabel(val: unknown): string {
  if (val == null) return '\u2014';
  if (typeof val !== 'string') return String(val);
  if (val.trim() === '') return '\u2014';
  return val.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

const INCIDENT_FILTER_CONFIG: FilterConfig = {
  fields: [
    { name: 'state', label: 'State', type: 'enum', enumValues: ['new', 'open', 'in_progress', 'resolved', 'closed'], enumLabels: { new: 'New', open: 'Open', in_progress: 'In Progress', resolved: 'Resolved', closed: 'Closed' } },
    { name: 'priority', label: 'Priority', type: 'enum', enumValues: ['p1', 'p2', 'p3', 'p4'], enumLabels: { p1: 'P1 - Critical', p2: 'P2 - High', p3: 'P3 - Medium', p4: 'P4 - Low' } },
    { name: 'customerCompanyId', label: 'Customer Company', type: 'uuid' },
    { name: 'assignedTo', label: 'Assigned To', type: 'uuid' },
    { name: 'serviceId', label: 'Service', type: 'uuid' },
    { name: 'category', label: 'Category', type: 'string' },
    { name: 'subcategory', label: 'Subcategory', type: 'string' },
    { name: 'createdAt', label: 'Created At', type: 'date' },
  ],
  maxConditions: 10,
};

export const ItsmIncidentList: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { showNotification } = useNotification();
  const [incidents, setIncidents] = useState<ItsmIncident[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const { companies } = useCompanyLookup();

  const parsedQuery = useMemo(() => parseListQuery(searchParams, {
    pageSize: 20,
    sort: 'createdAt:DESC',
  }), [searchParams]);

  const {
    page,
    pageSize,
    q: search,
    sort,
    filterTree: advancedFilter,
  } = parsedQuery;

  const stateFilter = searchParams.get('state') || '';
  const priorityFilter = searchParams.get('priority') || '';
  const companyFilter = searchParams.get('customerCompanyId') || '';

  const updateUrl = useCallback((state: Partial<typeof parsedQuery>) => {
    const next = buildListQueryParams({ ...parsedQuery, ...state });
    const str = next.toString();
    setSearchParams(str ? `?${str}` : window.location.pathname, { replace: true });
  }, [parsedQuery, setSearchParams]);

  const updateParams = useCallback((updates: Record<string, string>) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      Object.entries(updates).forEach(([key, value]) => {
        if (value) next.set(key, value);
        else next.delete(key);
      });
      next.set('page', '1');
      return next;
    });
  }, [setSearchParams]);

  const { params: compiledFilterParams, unsupported } = useMemo(
    () => compileIncidentFilterTreeToQuery(advancedFilter ?? null),
    [advancedFilter],
  );

  const requestParams = useMemo(() => ({
    page,
    pageSize,
    q: search || undefined,
    sort: sort || undefined,
    state: stateFilter || compiledFilterParams.state,
    priority: priorityFilter || compiledFilterParams.priority,
    customerCompanyId: companyFilter || compiledFilterParams.customerCompanyId || undefined,
    assigneeId: compiledFilterParams.assigneeId,
    serviceId: compiledFilterParams.serviceId,
    category: compiledFilterParams.category,
    createdAtAfter: compiledFilterParams.createdAtAfter,
    createdAtBefore: compiledFilterParams.createdAtBefore,
  }), [page, pageSize, search, sort, stateFilter, priorityFilter, companyFilter, compiledFilterParams]);

  const fetchIncidents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await itsmApi.incidents.list(requestParams);
      const data = response.data;
      if (data && typeof data === 'object') {
        const envelope = data as { data?: ItsmIncident[] | { items: ItsmIncident[]; total: number }; total?: number };
        const inner = envelope.data;
        const totalVal = envelope.total;
        if (inner && typeof inner === 'object' && !Array.isArray(inner) && 'items' in inner) {
          const paginated = inner as { items: ItsmIncident[]; total: number };
          setIncidents(Array.isArray(paginated.items) ? paginated.items : []);
          setTotal(paginated.total ?? totalVal ?? 0);
        } else if (Array.isArray(inner)) {
          setIncidents(inner);
          setTotal(totalVal ?? inner.length);
        } else {
          setIncidents([]);
          setTotal(totalVal ?? 0);
        }
      } else {
        setIncidents([]);
        setTotal(0);
      }
    } catch (err) {
      console.error('Error fetching ITSM incidents:', err);
      const msg = getErrorMessage(err);
      setError(msg);
      showNotification(msg, 'error');
      setIncidents([]);
    } finally {
      setLoading(false);
    }
  }, [requestParams, showNotification]);

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
            <Chip icon={<WarningIcon />} label="Risk Review" size="small" color="error" variant="outlined" />
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
        const rawState = row.status || row.state || 'unknown';
        const key = rawState.toLowerCase();
        return (
          <Chip
            label={toDisplayLabel(rawState)}
            size="small"
            color={stateColors[key] || 'default'}
          />
        );
      },
    },
    {
      key: 'priority',
      header: 'Priority',
      render: (row) => (
        <Chip
          label={row.priority?.toUpperCase() || '-'}
          size="small"
          color={priorityColors[row.priority?.toLowerCase()] || 'default'}
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
      key: 'customerCompany',
      header: 'Company',
      render: (row) => (
        <Typography variant="body2" color="text.secondary">
          {row.customerCompany?.name || '-'}
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

  const getActiveFilters = useCallback((): FilterOption[] => {
    const filters: FilterOption[] = [];
    if (stateFilter) {
      const label = STATE_FILTER_OPTIONS.find(o => o.value === stateFilter)?.label ?? stateFilter;
      filters.push({ key: 'state', label: 'State', value: label });
    }
    if (priorityFilter) {
      const label = PRIORITY_FILTER_OPTIONS.find(o => o.value === priorityFilter)?.label ?? priorityFilter;
      filters.push({ key: 'priority', label: 'Priority', value: label });
    }
    if (companyFilter) {
      const name = companies.find(c => c.id === companyFilter)?.name ?? companyFilter;
      filters.push({ key: 'customerCompanyId', label: 'Company', value: name });
    }
    const conditions = extractFilterConditions(advancedFilter ?? null);
    conditions.forEach((c, i) => {
      const fieldLabel = INCIDENT_FILTER_CONFIG.fields.find(f => f.name === c.field)?.label ?? c.field;
      const val = c.value !== undefined && c.value !== '' ? String(c.value) : c.op;
      filters.push({ key: `filter-${i}`, label: fieldLabel, value: val });
    });
    return filters;
  }, [stateFilter, priorityFilter, companyFilter, advancedFilter, companies]);

  const handleFilterRemove = useCallback((key: string) => {
    if (key === 'state' || key === 'priority' || key === 'customerCompanyId') {
      updateParams({ [key]: '', page: '1' });
      return;
    }
    if (key.startsWith('filter-')) {
      const idx = parseInt(key.replace('filter-', ''), 10);
      const conditions = extractFilterConditions(advancedFilter ?? null);
      const nextConditions = conditions.filter((_, i) => i !== idx);
      if (nextConditions.length === 0) {
        updateUrl({ filterTree: null, page: 1 });
        return;
      }
      const nextTree: FilterTree = nextConditions.length === 1
        ? nextConditions[0]
        : { and: nextConditions };
      const serialized = serializeFilterTree(nextTree);
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        if (serialized) next.set('filter', serialized);
        else next.delete('filter');
        next.set('page', '1');
        return next;
      });
    }
  }, [advancedFilter, updateParams, updateUrl, setSearchParams]);

  const handleClearFilters = useCallback(() => {
    setSearchParams((prev) => {
      const next = new URLSearchParams();
      const q = prev.get('q');
      const sort = prev.get('sort');
      const pageSizeVal = prev.get('pageSize');
      if (q) next.set('q', q);
      if (sort) next.set('sort', sort);
      if (pageSizeVal) next.set('pageSize', pageSizeVal);
      next.set('page', '1');
      return next;
    });
  }, [setSearchParams]);

  const handleAdvancedFilterApply = useCallback((filter: FilterTree | null) => {
    updateUrl({ filterTree: filter ?? undefined, page: 1 });
  }, [updateUrl]);

  const handleAdvancedFilterClear = useCallback(() => {
    updateUrl({ filterTree: null, page: 1 });
  }, [updateUrl]);

  const activeAdvancedFilterCount = advancedFilter ? countFilterConditions(advancedFilter) : 0;

  const filterActions = (
    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
      <FilterBuilderBasic
        config={INCIDENT_FILTER_CONFIG}
        initialFilter={advancedFilter ?? undefined}
        onApply={handleAdvancedFilterApply}
        onClear={handleAdvancedFilterClear}
        activeFilterCount={activeAdvancedFilterCount}
      />
      <FormControl size="small" sx={{ minWidth: 130 }}>
        <InputLabel>State</InputLabel>
        <Select
          value={stateFilter}
          label="State"
          onChange={(e) => updateParams({ state: e.target.value })}
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
          onChange={(e) => updateParams({ priority: e.target.value })}
        >
          <MenuItem value="">All Priorities</MenuItem>
          {PRIORITY_FILTER_OPTIONS.map((opt) => (
            <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
          ))}
        </Select>
      </FormControl>
      <FormControl size="small" sx={{ minWidth: 160 }}>
        <InputLabel>Company</InputLabel>
        <Select
          value={companyFilter}
          label="Company"
          onChange={(e) => updateParams({ customerCompanyId: e.target.value })}
        >
          <MenuItem value="">All Companies</MenuItem>
          {companies.map((c) => (
            <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
          ))}
        </Select>
      </FormControl>
      <Button
        variant="contained"
        startIcon={<AddIcon />}
        onClick={() => navigate('/itsm/incidents/new')}
      >
        New Incident
      </Button>
    </Box>
  );

  return (
    <Box>
      {unsupported.length > 0 && (
        <Alert severity="info" sx={{ mb: 2 }}>
          This field isn&apos;t supported on Incidents yet: {unsupported.join(', ')}. Those conditions were not applied.
        </Alert>
      )}
      <GenericListPage<ItsmIncident>
        title="Incidents"
        items={incidents}
        columns={columns}
        isLoading={loading}
        error={error}
        onClearError={() => setError(null)}
        total={total}
        page={page}
        pageSize={pageSize}
        search={search}
        onPageChange={(p) => updateUrl({ page: p })}
        onPageSizeChange={(ps) => updateUrl({ pageSize: ps, page: 1 })}
        onSearchChange={(s) => updateUrl({ q: s, page: 1 })}
        onRefresh={fetchIncidents}
        onRowClick={(row) => {
          const params = searchParams.toString();
          navigate(`/itsm/incidents/${row.id}${params ? `?returnParams=${encodeURIComponent(params)}` : ''}`);
        }}
        emptyMessage="No incidents found"
        emptyFilteredMessage="Try adjusting your filters or search query"
        searchPlaceholder="Search incidents..."
        getRowKey={(row) => row.id}
        testId="itsm-incident-list"
        filters={getActiveFilters()}
        onFilterRemove={handleFilterRemove}
        onClearFilters={handleClearFilters}
        toolbarActions={filterActions}
      />
    </Box>
  );
};

export default ItsmIncidentList;
