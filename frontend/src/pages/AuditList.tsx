import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Button,
  Chip,
  IconButton,
  Tooltip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Typography,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon,
  FactCheck as AuditIcon,
} from '@mui/icons-material';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  GenericListPage,
  ColumnDefinition,
  FilterOption,
  FilterBuilderBasic,
  FilterConfig,
  FilterTree,
} from '../components/common';
import { ModuleGuard } from '../components/ModuleGuard';
import { api } from '../services/api';
import { useUniversalList } from '../hooks/useUniversalList';
import {
  parseListQuery,
  serializeFilterTree,
  countFilterConditions,
} from '../utils/listQueryUtils';


interface Audit {
  id: string;
  code: string | null;
  name: string;
  description: string | null;
  auditType: 'internal' | 'external' | 'regulatory' | 'compliance';
  status: 'planned' | 'in_progress' | 'completed' | 'closed' | 'cancelled';
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  department: string | null;
  ownerUserId: string | null;
  leadAuditorId: string | null;
  plannedStartDate: string | null;
  plannedEndDate: string | null;
  actualStartDate: string | null;
  actualEndDate: string | null;
  owner?: { firstName?: string; lastName?: string };
  leadAuditor?: { firstName?: string; lastName?: string };
  createdAt: string;
  updatedAt: string;
}

const AUDIT_STATUS_VALUES = ['planned', 'in_progress', 'completed', 'closed', 'cancelled'] as const;
const AUDIT_RISK_LEVEL_VALUES = ['low', 'medium', 'high', 'critical'] as const;
const AUDIT_TYPE_VALUES = ['internal', 'external', 'regulatory', 'compliance'] as const;

const AUDIT_FILTER_CONFIG: FilterConfig = {
  fields: [
    {
      name: 'name',
      label: 'Name',
      type: 'string',
    },
    {
      name: 'code',
      label: 'Code',
      type: 'string',
    },
    {
      name: 'description',
      label: 'Description',
      type: 'string',
    },
    {
      name: 'status',
      label: 'Status',
      type: 'enum',
      enumValues: [...AUDIT_STATUS_VALUES],
      enumLabels: {
        planned: 'Planned',
        in_progress: 'In Progress',
        completed: 'Completed',
        closed: 'Closed',
        cancelled: 'Cancelled',
      },
    },
    {
      name: 'riskLevel',
      label: 'Risk Level',
      type: 'enum',
      enumValues: [...AUDIT_RISK_LEVEL_VALUES],
      enumLabels: {
        low: 'Low',
        medium: 'Medium',
        high: 'High',
        critical: 'Critical',
      },
    },
    {
      name: 'auditType',
      label: 'Audit Type',
      type: 'enum',
      enumValues: [...AUDIT_TYPE_VALUES],
      enumLabels: {
        internal: 'Internal',
        external: 'External',
        regulatory: 'Regulatory',
        compliance: 'Compliance',
      },
    },
    {
      name: 'department',
      label: 'Department',
      type: 'string',
    },
    {
      name: 'plannedStartDate',
      label: 'Planned Start Date',
      type: 'date',
    },
    {
      name: 'plannedEndDate',
      label: 'Planned End Date',
      type: 'date',
    },
    {
      name: 'createdAt',
      label: 'Created Date',
      type: 'date',
    },
  ],
  maxConditions: 10,
};

const getStatusColor = (status: string): 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning' => {
  switch (status) {
    case 'planned': return 'default';
    case 'in_progress': return 'primary';
    case 'completed': return 'success';
    case 'closed': return 'info';
    case 'cancelled': return 'error';
    default: return 'default';
  }
};

const getRiskLevelColor = (level: string): 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning' => {
  switch (level) {
    case 'low': return 'success';
    case 'medium': return 'warning';
    case 'high': return 'error';
    case 'critical': return 'error';
    default: return 'default';
  }
};

const formatStatus = (status: string): string => {
  return status.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
};

const formatDate = (dateStr: string | null): string => {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString();
};

export const AuditList: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const tenantId = user?.tenantId || '';

  const statusFilter = searchParams.get('status') || '';
  const riskLevelFilter = searchParams.get('riskLevel') || '';
  const auditTypeFilter = searchParams.get('auditType') || '';
  const departmentFilter = searchParams.get('department') || '';

  const parsedQuery = useMemo(() => parseListQuery(searchParams, {
    pageSize: 10,
    sort: 'createdAt:DESC',
  }), [searchParams]);

  const advancedFilter = parsedQuery.filterTree;

  const additionalFilters = useMemo(() => {
    const filters: Record<string, unknown> = {};
    if (statusFilter) filters.status = statusFilter;
    if (riskLevelFilter) filters.riskLevel = riskLevelFilter;
    if (auditTypeFilter) filters.auditType = auditTypeFilter;
    if (departmentFilter) filters.department = departmentFilter;
    if (advancedFilter) {
      const serialized = serializeFilterTree(advancedFilter);
      if (serialized) filters.filter = serialized;
    }
    return filters;
  }, [statusFilter, riskLevelFilter, auditTypeFilter, departmentFilter, advancedFilter]);

  const fetchAudits = useCallback((params: Record<string, unknown>) => {
    const queryParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        queryParams.set(key, String(value));
      }
    });
    return api.get(`/grc/audits?${queryParams.toString()}`);
  }, []);

  const isAuthReady = !authLoading && !!tenantId;

  const {
    items,
    total,
    page,
    pageSize,
    search,
    isLoading,
    error,
    setPage,
    setPageSize,
    setSearch,
    refetch,
  } = useUniversalList<Audit>({
    fetchFn: fetchAudits,
    defaultPageSize: 10,
    defaultSort: 'createdAt:DESC',
    syncToUrl: true,
    enabled: isAuthReady,
    additionalFilters,
  });

  const userRole = user?.role;
  const isAuthorizedRole = userRole === 'admin' || userRole === 'manager';
  const [canCreate, setCanCreate] = useState(isAuthorizedRole);
  const [departments, setDepartments] = useState<string[]>([]);

  const fetchCanCreate = useCallback(async () => {
    const isAuthorizedByRole = userRole === 'admin' || userRole === 'manager';
    if (isAuthorizedByRole) {
      setCanCreate(true);
      return;
    }
    try {
      const response = await api.get('/grc/audits/can/create');
      const data = response.data?.data || response.data;
      const allowed = data?.allowed === true;
      setCanCreate(allowed);
    } catch {
      setCanCreate(false);
    }
  }, [userRole]);

  const fetchDepartments = useCallback(async () => {
    try {
      const response = await api.get('/grc/audits/distinct/department');
      const data = response.data?.data || response.data;
      setDepartments(data || []);
    } catch {
      setDepartments([]);
    }
  }, []);

  useEffect(() => {
    fetchCanCreate();
    fetchDepartments();
  }, [fetchCanCreate, fetchDepartments]);

  const handleViewAudit = useCallback((audit: Audit) => {
    navigate(`/audits/${audit.id}`);
  }, [navigate]);

  const handleCreateAudit = useCallback(() => {
    navigate('/audits/new');
  }, [navigate]);

  const handleDeleteAudit = useCallback(async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this audit?')) return;
    try {
      await api.delete(`/grc/audits/${id}`);
      refetch();
    } catch (err) {
      console.error('Failed to delete audit:', err);
    }
  }, [refetch]);

  const updateFilter = useCallback((key: string, value: string) => {
    const newParams = new URLSearchParams(searchParams);
    if (value === '') {
      newParams.delete(key);
    } else {
      newParams.set(key, value);
    }
    newParams.set('page', '1');
    setSearchParams(newParams, { replace: true });
  }, [searchParams, setSearchParams]);

  const handleStatusChange = useCallback((value: string) => {
    updateFilter('status', value);
  }, [updateFilter]);

  const handleRiskLevelChange = useCallback((value: string) => {
    updateFilter('riskLevel', value);
  }, [updateFilter]);

  const handleAuditTypeChange = useCallback((value: string) => {
    updateFilter('auditType', value);
  }, [updateFilter]);

  const handleDepartmentChange = useCallback((value: string) => {
    updateFilter('department', value);
  }, [updateFilter]);

  const getActiveFilters = useCallback((): FilterOption[] => {
    const filters: FilterOption[] = [];
    if (statusFilter) {
      filters.push({ key: 'status', label: 'Status', value: formatStatus(statusFilter) });
    }
    if (riskLevelFilter) {
      filters.push({ key: 'riskLevel', label: 'Risk', value: riskLevelFilter.charAt(0).toUpperCase() + riskLevelFilter.slice(1) });
    }
    if (auditTypeFilter) {
      filters.push({ key: 'auditType', label: 'Type', value: auditTypeFilter.charAt(0).toUpperCase() + auditTypeFilter.slice(1) });
    }
    if (departmentFilter) {
      filters.push({ key: 'department', label: 'Dept', value: departmentFilter });
    }
    return filters;
  }, [statusFilter, riskLevelFilter, auditTypeFilter, departmentFilter]);

  const handleFilterRemove = useCallback((key: string) => {
    const newParams = new URLSearchParams(searchParams);
    newParams.delete(key);
    newParams.set('page', '1');
    setSearchParams(newParams, { replace: true });
  }, [searchParams, setSearchParams]);

  const handleClearFilters = useCallback(() => {
    const newParams = new URLSearchParams();
    const currentSearch = searchParams.get('search');
    const currentSort = searchParams.get('sort');
    const currentPageSize = searchParams.get('pageSize');
    if (currentSearch) newParams.set('search', currentSearch);
    if (currentSort) newParams.set('sort', currentSort);
    if (currentPageSize) newParams.set('pageSize', currentPageSize);
    newParams.set('page', '1');
    setSearchParams(newParams, { replace: true });
  }, [searchParams, setSearchParams]);

  const handleAdvancedFilterApply = useCallback((filter: FilterTree | null) => {
    const newParams = new URLSearchParams(searchParams);
    if (filter) {
      const serialized = serializeFilterTree(filter);
      if (serialized) {
        newParams.set('filter', serialized);
      }
    } else {
      newParams.delete('filter');
    }
    newParams.set('page', '1');
    setSearchParams(newParams, { replace: true });
  }, [searchParams, setSearchParams]);

  const handleAdvancedFilterClear = useCallback(() => {
    const newParams = new URLSearchParams(searchParams);
    newParams.delete('filter');
    newParams.set('page', '1');
    setSearchParams(newParams, { replace: true });
  }, [searchParams, setSearchParams]);

  const activeAdvancedFilterCount = advancedFilter ? countFilterConditions(advancedFilter) : 0;

  const columns: ColumnDefinition<Audit>[] = useMemo(() => [
    {
      key: 'code',
      header: 'Code',
      render: (audit) => (
        <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 500 }}>
          {audit.code || '-'}
        </Typography>
      ),
    },
    {
      key: 'name',
      header: 'Name',
      render: (audit) => (
        <Box>
          <Typography
            variant="body2"
            fontWeight="medium"
            component="span"
            onClick={() => handleViewAudit(audit)}
            sx={{
              color: 'primary.main',
              cursor: 'pointer',
              '&:hover': {
                textDecoration: 'underline',
                color: 'primary.dark',
              },
            }}
          >
            {audit.name}
          </Typography>
          {audit.description && (
            <Typography variant="body2" color="textSecondary" noWrap sx={{ maxWidth: 200, mt: 0.5 }}>
              {audit.description}
            </Typography>
          )}
        </Box>
      ),
    },
    {
      key: 'auditType',
      header: 'Type',
      render: (audit) => (
        <Chip
          label={audit.auditType.charAt(0).toUpperCase() + audit.auditType.slice(1)}
          size="small"
          variant="outlined"
        />
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (audit) => (
        <Chip
          label={formatStatus(audit.status)}
          size="small"
          color={getStatusColor(audit.status)}
        />
      ),
    },
    {
      key: 'riskLevel',
      header: 'Risk Level',
      render: (audit) => (
        <Chip
          label={audit.riskLevel.charAt(0).toUpperCase() + audit.riskLevel.slice(1)}
          size="small"
          color={getRiskLevelColor(audit.riskLevel)}
        />
      ),
    },
    {
      key: 'department',
      header: 'Department',
      render: (audit) => audit.department || '-',
    },
    {
      key: 'owner',
      header: 'Owner',
      render: (audit) => (
        audit.owner?.firstName && audit.owner?.lastName
          ? `${audit.owner.firstName} ${audit.owner.lastName}`
          : '-'
      ),
    },
    {
      key: 'plannedDates',
      header: 'Planned Dates',
      render: (audit) => (
        audit.plannedStartDate || audit.plannedEndDate ? (
          <Typography variant="body2">
            {formatDate(audit.plannedStartDate)} - {formatDate(audit.plannedEndDate)}
          </Typography>
        ) : '-'
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (audit) => (
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <Tooltip title="View">
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                handleViewAudit(audit);
              }}
            >
              <ViewIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Edit">
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/audits/${audit.id}/edit`);
              }}
            >
              <EditIcon />
            </IconButton>
          </Tooltip>
          {(user?.role === 'admin' || user?.role === 'manager') && (
            <Tooltip title="Delete">
              <IconButton
                size="small"
                color="error"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteAudit(audit.id);
                }}
              >
                <DeleteIcon />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      ),
    },
  ], [handleViewAudit, handleDeleteAudit, navigate, user?.role]);

  const toolbarActions = useMemo(() => (
    <Box display="flex" gap={1} flexWrap="wrap" alignItems="center">
      <FilterBuilderBasic
        config={AUDIT_FILTER_CONFIG}
        initialFilter={advancedFilter}
        onApply={handleAdvancedFilterApply}
        onClear={handleAdvancedFilterClear}
        activeFilterCount={activeAdvancedFilterCount}
      />
      <FormControl size="small" sx={{ minWidth: 120 }}>
        <InputLabel>Status</InputLabel>
        <Select
          value={statusFilter}
          label="Status"
          onChange={(e) => handleStatusChange(e.target.value)}
        >
          <MenuItem value="">All</MenuItem>
          <MenuItem value="planned">Planned</MenuItem>
          <MenuItem value="in_progress">In Progress</MenuItem>
          <MenuItem value="completed">Completed</MenuItem>
          <MenuItem value="closed">Closed</MenuItem>
          <MenuItem value="cancelled">Cancelled</MenuItem>
        </Select>
      </FormControl>
      <FormControl size="small" sx={{ minWidth: 120 }}>
        <InputLabel>Risk Level</InputLabel>
        <Select
          value={riskLevelFilter}
          label="Risk Level"
          onChange={(e) => handleRiskLevelChange(e.target.value)}
        >
          <MenuItem value="">All</MenuItem>
          <MenuItem value="low">Low</MenuItem>
          <MenuItem value="medium">Medium</MenuItem>
          <MenuItem value="high">High</MenuItem>
          <MenuItem value="critical">Critical</MenuItem>
        </Select>
      </FormControl>
      <FormControl size="small" sx={{ minWidth: 100 }}>
        <InputLabel>Type</InputLabel>
        <Select
          value={auditTypeFilter}
          label="Type"
          onChange={(e) => handleAuditTypeChange(e.target.value)}
        >
          <MenuItem value="">All</MenuItem>
          <MenuItem value="internal">Internal</MenuItem>
          <MenuItem value="external">External</MenuItem>
          <MenuItem value="regulatory">Regulatory</MenuItem>
          <MenuItem value="compliance">Compliance</MenuItem>
        </Select>
      </FormControl>
      {departments.length > 0 && (
        <FormControl size="small" sx={{ minWidth: 130 }}>
          <InputLabel>Department</InputLabel>
          <Select
            value={departmentFilter}
            label="Department"
            onChange={(e) => handleDepartmentChange(e.target.value)}
          >
            <MenuItem value="">All</MenuItem>
            {departments.map((dept) => (
              <MenuItem key={dept} value={dept}>{dept}</MenuItem>
            ))}
          </Select>
        </FormControl>
      )}
    </Box>
  ), [statusFilter, riskLevelFilter, auditTypeFilter, departmentFilter, departments, handleStatusChange, handleRiskLevelChange, handleAuditTypeChange, handleDepartmentChange, advancedFilter, handleAdvancedFilterApply, handleAdvancedFilterClear, activeAdvancedFilterCount]);

  return (
    <ModuleGuard moduleKey="audit">
      <GenericListPage<Audit>
        title="Audit Management"
        icon={<AuditIcon />}
        items={items}
        columns={columns}
        total={total}
        page={page}
        pageSize={pageSize}
        isLoading={isLoading || authLoading}
        error={error}
        search={search}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        onSearchChange={setSearch}
        onRefresh={refetch}
        getRowKey={(audit) => audit.id}
        onRowClick={handleViewAudit}
        searchPlaceholder="Search audits..."
        emptyMessage="No audits found"
        emptyFilteredMessage="Try adjusting your filters or search query"
        filters={getActiveFilters()}
        onFilterRemove={handleFilterRemove}
        onClearFilters={handleClearFilters}
        toolbarActions={toolbarActions}
        headerActions={canCreate ? (
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleCreateAudit}
          >
            New Audit
          </Button>
        ) : undefined}
        minTableWidth={1000}
        testId="audit-list-page"
      />
    </ModuleGuard>
  );
};

export default AuditList;
