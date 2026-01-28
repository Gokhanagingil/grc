import React, { useCallback, useMemo, useState } from 'react';
import {
  Box,
  Chip,
  IconButton,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Tooltip,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
} from '@mui/material';
import {
  Visibility as ViewIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Warning as IssueIcon,
} from '@mui/icons-material';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { issueApi, IssueData, CreateIssueDto } from '../services/grcClient';
import { useAuth } from '../contexts/AuthContext';
import { GenericListPage, ColumnDefinition, FilterOption } from '../components/common';
import { GrcFrameworkWarningBanner } from '../components/onboarding';
import { useListData } from '../hooks/useListData';
import { AdvancedFilterBuilder } from '../components/common/AdvancedFilter/AdvancedFilterBuilder';
import { FilterConfig } from '../components/common/AdvancedFilter/types';
import { ListToolbar } from '../components/common/ListToolbar';

export enum IssueType {
  INTERNAL_AUDIT = 'internal_audit',
  EXTERNAL_AUDIT = 'external_audit',
  INCIDENT = 'incident',
  SELF_ASSESSMENT = 'self_assessment',
  OTHER = 'other',
}

export enum IssueStatus {
  OPEN = 'open',
  IN_PROGRESS = 'in_progress',
  RESOLVED = 'resolved',
  CLOSED = 'closed',
  REJECTED = 'rejected',
}

export enum IssueSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

const getStatusColor = (status: string): 'error' | 'warning' | 'info' | 'success' | 'default' => {
  switch (status) {
    case IssueStatus.OPEN: return 'error';
    case IssueStatus.IN_PROGRESS: return 'warning';
    case IssueStatus.RESOLVED: return 'info';
    case IssueStatus.CLOSED: return 'success';
    case IssueStatus.REJECTED: return 'default';
    default: return 'default';
  }
};

const getSeverityColor = (severity: string): 'error' | 'warning' | 'info' | 'success' | 'default' => {
  switch (severity) {
    case IssueSeverity.CRITICAL: return 'error';
    case IssueSeverity.HIGH: return 'error';
    case IssueSeverity.MEDIUM: return 'warning';
    case IssueSeverity.LOW: return 'info';
    default: return 'default';
  }
};

const formatStatus = (status: string): string => {
  return status.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
};

const formatType = (type: string): string => {
  return type.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
};

const formatDate = (dateString: string | null | undefined): string => {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleDateString();
};

/**
 * Issue filter configuration for the advanced filter builder
 */
const ISSUE_FILTER_CONFIG: FilterConfig = {
  fields: [
    {
      name: 'title',
      label: 'Title',
      type: 'string',
    },
    {
      name: 'status',
      label: 'Status',
      type: 'enum',
      enumValues: Object.values(IssueStatus),
      enumLabels: {
        [IssueStatus.OPEN]: 'Open',
        [IssueStatus.IN_PROGRESS]: 'In Progress',
        [IssueStatus.RESOLVED]: 'Resolved',
        [IssueStatus.CLOSED]: 'Closed',
        [IssueStatus.REJECTED]: 'Rejected',
      },
    },
    {
      name: 'severity',
      label: 'Severity',
      type: 'enum',
      enumValues: Object.values(IssueSeverity),
      enumLabels: {
        [IssueSeverity.LOW]: 'Low',
        [IssueSeverity.MEDIUM]: 'Medium',
        [IssueSeverity.HIGH]: 'High',
        [IssueSeverity.CRITICAL]: 'Critical',
      },
    },
    {
      name: 'type',
      label: 'Type',
      type: 'enum',
      enumValues: Object.values(IssueType),
      enumLabels: {
        [IssueType.INTERNAL_AUDIT]: 'Internal Audit',
        [IssueType.EXTERNAL_AUDIT]: 'External Audit',
        [IssueType.INCIDENT]: 'Incident',
        [IssueType.SELF_ASSESSMENT]: 'Self Assessment',
        [IssueType.OTHER]: 'Other',
      },
    },
    {
      name: 'dueDate',
      label: 'Due Date',
      type: 'date',
    },
    {
      name: 'createdAt',
      label: 'Created At',
      type: 'date',
    },
  ],
  maxConditions: 10,
};

export const IssueList: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newIssue, setNewIssue] = useState<CreateIssueDto>({
    title: '',
    description: '',
    type: IssueType.INTERNAL_AUDIT,
    status: IssueStatus.OPEN,
    severity: IssueSeverity.MEDIUM,
  });
  
  const tenantId = user?.tenantId || '';
  
  const statusFilter = searchParams.get('status') || '';
  const severityFilter = searchParams.get('severity') || '';
  const typeFilter = searchParams.get('type') || '';

  const additionalFilters = useMemo(() => {
    const filters: Record<string, unknown> = {};
    if (statusFilter) filters.status = statusFilter;
    if (severityFilter) filters.severity = severityFilter;
    if (typeFilter) filters.type = typeFilter;
    return filters;
  }, [statusFilter, severityFilter, typeFilter]);

  const fetchIssues = useCallback((params: Record<string, unknown>) => {
    return issueApi.list(tenantId, params);
  }, [tenantId]);

  const isAuthReady = !authLoading && !!tenantId;

  const {
    items,
    total,
    state,
    isLoading,
    error,
    setPage,
    setPageSize,
    setSearch,
    setSort,
    setFilterTree,
    refetch,
    filterConditionCount,
    clearFilterWithNotification,
  } = useListData<IssueData>({
    fetchFn: fetchIssues,
    defaultPageSize: 10,
    defaultSort: 'createdAt:DESC',
    syncToUrl: true,
    enabled: isAuthReady,
    additionalFilters,
    entityName: 'issues',
  });

  const { page, pageSize, q: search, sort } = state;

  const handleViewIssue = useCallback((issue: IssueData) => {
    navigate(`/issues/${issue.id}`);
  }, [navigate]);

  const handleDeleteIssue = useCallback(async (issue: IssueData) => {
    if (window.confirm(`Are you sure you want to delete "${issue.title}"?`)) {
      try {
        await issueApi.delete(tenantId, issue.id);
        refetch();
      } catch (err) {
        console.error('Failed to delete issue:', err);
      }
    }
  }, [tenantId, refetch]);

  const handleCreateIssue = useCallback(async () => {
    try {
      await issueApi.create(tenantId, newIssue);
      setCreateDialogOpen(false);
      setNewIssue({
        title: '',
        description: '',
        type: IssueType.INTERNAL_AUDIT,
        status: IssueStatus.OPEN,
        severity: IssueSeverity.MEDIUM,
      });
      refetch();
    } catch (err) {
      console.error('Failed to create issue:', err);
    }
  }, [tenantId, newIssue, refetch]);

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

  const handleSeverityChange = useCallback((value: string) => {
    updateFilter('severity', value);
  }, [updateFilter]);

  const handleTypeChange = useCallback((value: string) => {
    updateFilter('type', value);
  }, [updateFilter]);

  const getActiveFilters = useCallback((): FilterOption[] => {
    const filters: FilterOption[] = [];
    if (statusFilter) {
      filters.push({ key: 'status', label: 'Status', value: formatStatus(statusFilter) });
    }
    if (severityFilter) {
      filters.push({ key: 'severity', label: 'Severity', value: formatStatus(severityFilter) });
    }
    if (typeFilter) {
      filters.push({ key: 'type', label: 'Type', value: formatType(typeFilter) });
    }
    return filters;
  }, [statusFilter, severityFilter, typeFilter]);

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

  const columns: ColumnDefinition<IssueData>[] = useMemo(() => [
    {
      key: 'code',
      header: 'Code',
      render: (issue) => (
        <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 500 }}>
          {issue.code || '-'}
        </Typography>
      ),
    },
    {
      key: 'title',
      header: 'Title',
      render: (issue) => (
        <Tooltip title={issue.description || ''}>
          <Typography 
            variant="body2" 
            component="span"
            onClick={() => handleViewIssue(issue)}
            sx={{ 
              maxWidth: 250, 
              overflow: 'hidden', 
              textOverflow: 'ellipsis', 
              whiteSpace: 'nowrap',
              color: 'primary.main',
              cursor: 'pointer',
              '&:hover': { 
                textDecoration: 'underline',
                color: 'primary.dark',
              },
              fontWeight: 500,
            }}
          >
            {issue.title}
          </Typography>
        </Tooltip>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      render: (issue) => (
        <Typography variant="body2">
          {formatType(issue.type)}
        </Typography>
      ),
    },
    {
      key: 'severity',
      header: 'Severity',
      render: (issue) => (
        <Chip
          label={formatStatus(issue.severity)}
          size="small"
          color={getSeverityColor(issue.severity)}
        />
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (issue) => (
        <Chip
          label={formatStatus(issue.status)}
          size="small"
          color={getStatusColor(issue.status)}
        />
      ),
    },
    {
      key: 'control',
      header: 'Control',
      render: (issue) => (
        <Typography variant="body2">
          {issue.control?.code || issue.control?.name || '-'}
        </Typography>
      ),
    },
    {
      key: 'dueDate',
      header: 'Due Date',
      render: (issue) => formatDate(issue.dueDate),
    },
    {
      key: 'createdAt',
      header: 'Created',
      render: (issue) => formatDate(issue.createdAt),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (issue) => (
        <Box display="flex" gap={0.5} onClick={(e) => e.stopPropagation()}>
          <Tooltip title="View Details">
            <IconButton
              size="small"
              onClick={() => handleViewIssue(issue)}
            >
              <ViewIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Delete">
            <IconButton
              size="small"
              onClick={() => handleDeleteIssue(issue)}
              color="error"
            >
              <DeleteIcon />
            </IconButton>
          </Tooltip>
        </Box>
      ),
    },
  ], [handleViewIssue, handleDeleteIssue]);

  const filterButton = useMemo(() => (
    <AdvancedFilterBuilder
      config={ISSUE_FILTER_CONFIG}
      initialFilter={state.filterTree}
      onApply={setFilterTree}
      onClear={clearFilterWithNotification}
      activeFilterCount={filterConditionCount}
    />
  ), [state.filterTree, setFilterTree, clearFilterWithNotification, filterConditionCount]);

  const toolbarActions = useMemo(() => (
    <Box display="flex" gap={1} alignItems="center">
      <FormControl size="small" sx={{ minWidth: 120 }}>
        <InputLabel>Status</InputLabel>
        <Select
          value={statusFilter}
          label="Status"
          onChange={(e) => handleStatusChange(e.target.value)}
        >
          <MenuItem value="">All</MenuItem>
          {Object.values(IssueStatus).map((status) => (
            <MenuItem key={status} value={status}>{formatStatus(status)}</MenuItem>
          ))}
        </Select>
      </FormControl>
      <FormControl size="small" sx={{ minWidth: 120 }}>
        <InputLabel>Severity</InputLabel>
        <Select
          value={severityFilter}
          label="Severity"
          onChange={(e) => handleSeverityChange(e.target.value)}
        >
          <MenuItem value="">All</MenuItem>
          {Object.values(IssueSeverity).map((severity) => (
            <MenuItem key={severity} value={severity}>{formatStatus(severity)}</MenuItem>
          ))}
        </Select>
      </FormControl>
      <FormControl size="small" sx={{ minWidth: 120 }}>
        <InputLabel>Type</InputLabel>
        <Select
          value={typeFilter}
          label="Type"
          onChange={(e) => handleTypeChange(e.target.value)}
        >
          <MenuItem value="">All</MenuItem>
          {Object.values(IssueType).map((type) => (
            <MenuItem key={type} value={type}>{formatType(type)}</MenuItem>
          ))}
        </Select>
      </FormControl>
      <Button
        variant="contained"
        startIcon={<AddIcon />}
        onClick={() => setCreateDialogOpen(true)}
      >
        Add Issue
      </Button>
    </Box>
  ), [statusFilter, severityFilter, typeFilter, handleStatusChange, handleSeverityChange, handleTypeChange]);

  const listToolbar = useMemo(() => (
    <ListToolbar
      entity="issues"
      search={search}
      onSearchChange={setSearch}
      searchPlaceholder="Search issues..."
      sort={sort}
      onSortChange={setSort}
      onRefresh={refetch}
      loading={isLoading}
      filterButton={filterButton}
      onClearFilters={handleClearFilters}
      filters={getActiveFilters()}
      onFilterRemove={handleFilterRemove}
    />
  ), [search, setSearch, sort, setSort, refetch, isLoading, filterButton, handleClearFilters, getActiveFilters, handleFilterRemove]);

  return (
    <>
            <GenericListPage<IssueData>
              title="Issues"
              icon={<IssueIcon />}
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
              onRefresh={refetch}
              getRowKey={(issue) => issue.id}
              emptyMessage="No issues found"
              emptyFilteredMessage="Try adjusting your filters or search query"
              filters={getActiveFilters()}
              onFilterRemove={handleFilterRemove}
              onClearFilters={handleClearFilters}
              toolbarActions={toolbarActions}
              banner={
                <>
                  <GrcFrameworkWarningBanner />
                  {listToolbar}
                </>
              }
              minTableWidth={1000}
              testId="issue-list-page"
              onRowClick={handleViewIssue}
            />

      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add New Issue</DialogTitle>
        <DialogContent>
          <Box display="flex" flexDirection="column" gap={2} mt={1}>
            <TextField
              label="Title"
              value={newIssue.title}
              onChange={(e) => setNewIssue({ ...newIssue, title: e.target.value })}
              fullWidth
              required
            />
            <TextField
              label="Description"
              value={newIssue.description}
              onChange={(e) => setNewIssue({ ...newIssue, description: e.target.value })}
              fullWidth
              multiline
              rows={3}
            />
            <FormControl fullWidth>
              <InputLabel>Type</InputLabel>
              <Select
                value={newIssue.type}
                label="Type"
                onChange={(e) => setNewIssue({ ...newIssue, type: e.target.value })}
              >
                {Object.values(IssueType).map((type) => (
                  <MenuItem key={type} value={type}>{formatType(type)}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel>Severity</InputLabel>
              <Select
                value={newIssue.severity}
                label="Severity"
                onChange={(e) => setNewIssue({ ...newIssue, severity: e.target.value })}
              >
                {Object.values(IssueSeverity).map((severity) => (
                  <MenuItem key={severity} value={severity}>{formatStatus(severity)}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel>Status</InputLabel>
              <Select
                value={newIssue.status}
                label="Status"
                onChange={(e) => setNewIssue({ ...newIssue, status: e.target.value })}
              >
                {Object.values(IssueStatus).map((status) => (
                  <MenuItem key={status} value={status}>{formatStatus(status)}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
          <Button 
            onClick={handleCreateIssue} 
            variant="contained"
            disabled={!newIssue.title}
          >
            Create
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default IssueList;
