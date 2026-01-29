import React, { useState, useCallback, useMemo } from 'react';
import {
  Box,
  Chip,
  IconButton,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Grid,
  Button,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon,
  Gavel as ComplianceIcon,
  Description as ReportIcon,
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFnsV3';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { requirementApi } from '../services/grcClient';
import { useAuth } from '../contexts/AuthContext';
import {
  GenericListPage,
  ColumnDefinition,
  FilterOption,
  FilterBuilderBasic,
  FilterTree,
  FilterConfig,
} from '../components/common';
import { AuditReportDialog } from '../components/AuditReportDialog';
import { useUniversalList } from '../hooks/useUniversalList';
import {
  parseListQuery,
  serializeFilterTree,
  countFilterConditions,
} from '../utils/listQueryUtils';

interface ComplianceRequirement {
  id: number;
  title: string;
  description: string;
  regulation: string;
  category: string;
  status: string;
  due_date: string;
  evidence: string;
  owner_first_name: string;
  owner_last_name: string;
  assigned_first_name: string;
  assigned_last_name: string;
  created_at: string;
}

const REQUIREMENT_STATUS_VALUES = ['not_started', 'in_progress', 'implemented', 'verified', 'non_compliant'] as const;
const FRAMEWORK_VALUES = ['iso27001', 'soc2', 'gdpr', 'hipaa', 'pci_dss', 'nist', 'other'] as const;

const REQUIREMENT_FILTER_CONFIG: FilterConfig = {
  fields: [
    {
      name: 'title',
      label: 'Title',
      type: 'string',
    },
    {
      name: 'description',
      label: 'Description',
      type: 'string',
    },
    {
      name: 'regulation',
      label: 'Framework',
      type: 'enum',
      enumValues: [...FRAMEWORK_VALUES],
      enumLabels: {
        iso27001: 'ISO 27001',
        soc2: 'SOC 2',
        gdpr: 'GDPR',
        hipaa: 'HIPAA',
        pci_dss: 'PCI DSS',
        nist: 'NIST',
        other: 'Other',
      },
    },
    {
      name: 'category',
      label: 'Category',
      type: 'string',
    },
    {
      name: 'status',
      label: 'Status',
      type: 'enum',
      enumValues: [...REQUIREMENT_STATUS_VALUES],
      enumLabels: {
        not_started: 'Not Started',
        in_progress: 'In Progress',
        implemented: 'Implemented',
        verified: 'Verified',
        non_compliant: 'Non-Compliant',
      },
    },
    {
      name: 'due_date',
      label: 'Due Date',
      type: 'date',
    },
    {
      name: 'created_at',
      label: 'Created Date',
      type: 'date',
    },
  ],
  maxConditions: 10,
};

const getStatusColor = (status: string): 'error' | 'warning' | 'info' | 'success' | 'default' => {
  switch (status) {
    case 'verified': return 'success';
    case 'implemented': return 'info';
    case 'in_progress': return 'warning';
    case 'not_started': return 'default';
    case 'non_compliant': return 'error';
    default: return 'default';
  }
};

const formatStatus = (status: string): string => {
  return status.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
};

const formatDate = (dateString: string | null): string => {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleDateString();
};

const isOverdue = (dueDate: string | null): boolean => {
  if (!dueDate) return false;
  return new Date(dueDate) < new Date();
};

export const Compliance: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const tenantId = user?.tenantId || '';

  const statusFilter = searchParams.get('status') || '';
  const frameworkFilter = searchParams.get('regulation') || '';

  const parsedQuery = useMemo(() => parseListQuery(searchParams, {
    pageSize: 10,
    sort: 'created_at:DESC',
  }), [searchParams]);

  const advancedFilter = parsedQuery.filterTree;

  const additionalFilters = useMemo(() => {
    const filters: Record<string, unknown> = {};
    if (statusFilter) filters.status = statusFilter;
    if (frameworkFilter) filters.regulation = frameworkFilter;
    if (advancedFilter) {
      const serialized = serializeFilterTree(advancedFilter);
      if (serialized) filters.filter = serialized;
    }
    return filters;
  }, [statusFilter, frameworkFilter, advancedFilter]);

  const fetchRequirements = useCallback((params: Record<string, unknown>) => {
    return requirementApi.list(tenantId, params);
  }, [tenantId]);

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
  } = useUniversalList<ComplianceRequirement>({
    fetchFn: fetchRequirements,
    defaultPageSize: 10,
    defaultSort: 'created_at:DESC',
    syncToUrl: true,
    enabled: isAuthReady,
    additionalFilters,
  });

  const [openDialog, setOpenDialog] = useState(false);
  const [editingRequirement, setEditingRequirement] = useState<ComplianceRequirement | null>(null);
  const [openReportDialog, setOpenReportDialog] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    regulation: '',
    category: '',
    status: 'not_started',
    dueDate: null as Date | null,
    evidence: '',
    assignedTo: '',
  });

  const handleViewRequirement = useCallback((requirement: ComplianceRequirement) => {
    navigate(`/requirements/${requirement.id}`);
  }, [navigate]);

  const handleCreateRequirement = useCallback(() => {
    navigate('/requirements/new');
  }, [navigate]);

  const handleEditRequirement = useCallback((requirement: ComplianceRequirement) => {
    setEditingRequirement(requirement);
    setFormData({
      title: requirement.title,
      description: requirement.description || '',
      regulation: requirement.regulation || '',
      category: requirement.category || '',
      status: requirement.status,
      dueDate: requirement.due_date ? new Date(requirement.due_date) : null,
      evidence: requirement.evidence || '',
      assignedTo: '',
    });
    setOpenDialog(true);
  }, []);

  const handleSaveRequirement = useCallback(async () => {
    try {
      const requirementData = {
        title: formData.title,
        description: formData.description,
        framework: formData.regulation,
        referenceCode: `REQ-${Date.now()}`,
        category: formData.category,
        status: formData.status,
        dueDate: formData.dueDate?.toISOString().split('T')[0],
      };

      if (editingRequirement) {
        await requirementApi.update(tenantId, String(editingRequirement.id), requirementData);
      } else {
        await requirementApi.create(tenantId, requirementData);
      }

      setOpenDialog(false);
      refetch();
    } catch (err) {
      console.error('Failed to save requirement:', err);
    }
  }, [formData, editingRequirement, tenantId, refetch]);

  const handleDeleteRequirement = useCallback(async (id: number) => {
    if (window.confirm('Are you sure you want to delete this compliance requirement?')) {
      try {
        await requirementApi.delete(tenantId, String(id));
        refetch();
      } catch (err) {
        console.error('Failed to delete requirement:', err);
      }
    }
  }, [tenantId, refetch]);

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

  const handleFrameworkChange = useCallback((value: string) => {
    updateFilter('regulation', value);
  }, [updateFilter]);

  const getActiveFilters = useCallback((): FilterOption[] => {
    const filters: FilterOption[] = [];
    if (statusFilter) {
      filters.push({ key: 'status', label: 'Status', value: formatStatus(statusFilter) });
    }
    if (frameworkFilter) {
      filters.push({ key: 'regulation', label: 'Framework', value: frameworkFilter.toUpperCase() });
    }
    return filters;
  }, [statusFilter, frameworkFilter]);

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

  const columns: ColumnDefinition<ComplianceRequirement>[] = useMemo(() => [
    {
      key: 'title',
      header: 'Title',
      render: (requirement) => (
        <Box>
          <Typography
            variant="body2"
            fontWeight="medium"
            component="span"
            onClick={() => handleViewRequirement(requirement)}
            sx={{
              color: 'primary.main',
              cursor: 'pointer',
              '&:hover': {
                textDecoration: 'underline',
                color: 'primary.dark',
              },
            }}
          >
            {requirement.title}
          </Typography>
          {requirement.description && (
            <Typography variant="body2" color="textSecondary" sx={{ mt: 0.5 }}>
              {requirement.description}
            </Typography>
          )}
        </Box>
      ),
    },
    {
      key: 'regulation',
      header: 'Framework',
      render: (requirement) => requirement.regulation || '-',
    },
    {
      key: 'category',
      header: 'Category',
      render: (requirement) => requirement.category || '-',
    },
    {
      key: 'status',
      header: 'Status',
      render: (requirement) => (
        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
          <Chip
            label={formatStatus(requirement.status)}
            size="small"
            color={getStatusColor(requirement.status)}
          />
          {isOverdue(requirement.due_date) && requirement.status !== 'verified' && requirement.status !== 'implemented' && (
            <Chip
              label="Overdue"
              color="error"
              size="small"
            />
          )}
        </Box>
      ),
    },
    {
      key: 'owner',
      header: 'Owner',
      render: (requirement) => (
        requirement.owner_first_name || requirement.owner_last_name
          ? `${requirement.owner_first_name || ''} ${requirement.owner_last_name || ''}`.trim()
          : '-'
      ),
    },
    {
      key: 'due_date',
      header: 'Due Date',
      render: (requirement) => formatDate(requirement.due_date),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (requirement) => (
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <Tooltip title="View Details">
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                handleViewRequirement(requirement);
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
                handleEditRequirement(requirement);
              }}
            >
              <EditIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Delete">
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                handleDeleteRequirement(requirement.id);
              }}
            >
              <DeleteIcon />
            </IconButton>
          </Tooltip>
        </Box>
      ),
    },
  ], [handleViewRequirement, handleEditRequirement, handleDeleteRequirement]);

  const toolbarActions = useMemo(() => (
    <Box display="flex" gap={1} alignItems="center">
      <FilterBuilderBasic
        config={REQUIREMENT_FILTER_CONFIG}
        initialFilter={advancedFilter}
        onApply={handleAdvancedFilterApply}
        onClear={handleAdvancedFilterClear}
        activeFilterCount={activeAdvancedFilterCount}
      />
      <FormControl size="small" sx={{ minWidth: 140 }}>
        <InputLabel>Status</InputLabel>
        <Select
          value={statusFilter}
          label="Status"
          onChange={(e) => handleStatusChange(e.target.value)}
        >
          <MenuItem value="">All</MenuItem>
          <MenuItem value="not_started">Not Started</MenuItem>
          <MenuItem value="in_progress">In Progress</MenuItem>
          <MenuItem value="implemented">Implemented</MenuItem>
          <MenuItem value="verified">Verified</MenuItem>
          <MenuItem value="non_compliant">Non-Compliant</MenuItem>
        </Select>
      </FormControl>
      <FormControl size="small" sx={{ minWidth: 120 }}>
        <InputLabel>Framework</InputLabel>
        <Select
          value={frameworkFilter}
          label="Framework"
          onChange={(e) => handleFrameworkChange(e.target.value)}
        >
          <MenuItem value="">All</MenuItem>
          <MenuItem value="iso27001">ISO 27001</MenuItem>
          <MenuItem value="soc2">SOC 2</MenuItem>
          <MenuItem value="gdpr">GDPR</MenuItem>
          <MenuItem value="hipaa">HIPAA</MenuItem>
          <MenuItem value="pci_dss">PCI DSS</MenuItem>
          <MenuItem value="nist">NIST</MenuItem>
          <MenuItem value="other">Other</MenuItem>
        </Select>
      </FormControl>
      <Button
        variant="outlined"
        size="small"
        startIcon={<ReportIcon />}
        onClick={() => setOpenReportDialog(true)}
      >
        Report
      </Button>
    </Box>
  ), [statusFilter, frameworkFilter, handleStatusChange, handleFrameworkChange, advancedFilter, handleAdvancedFilterApply, handleAdvancedFilterClear, activeAdvancedFilterCount]);

  return (
    <>
      <GenericListPage<ComplianceRequirement>
        title="Compliance Management"
        icon={<ComplianceIcon />}
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
        getRowKey={(requirement) => String(requirement.id)}
        onRowClick={handleViewRequirement}
        searchPlaceholder="Search requirements..."
        emptyMessage="No compliance requirements found"
        emptyFilteredMessage="Try adjusting your filters or search query"
        filters={getActiveFilters()}
        onFilterRemove={handleFilterRemove}
        onClearFilters={handleClearFilters}
        toolbarActions={toolbarActions}
        createButtonLabel="New Requirement"
        onCreateClick={handleCreateRequirement}
        minTableWidth={900}
        testId="compliance-list-page"
      />

      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          {editingRequirement ? 'Edit Compliance Requirement' : 'Create New Compliance Requirement'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                required
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Description"
                multiline
                rows={3}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </Grid>
            <Grid item xs={6}>
              <FormControl fullWidth required>
                <InputLabel>Framework</InputLabel>
                <Select
                  value={formData.regulation}
                  label="Framework"
                  onChange={(e) => setFormData({ ...formData, regulation: e.target.value })}
                >
                  <MenuItem value="iso27001">ISO 27001</MenuItem>
                  <MenuItem value="soc2">SOC 2</MenuItem>
                  <MenuItem value="gdpr">GDPR</MenuItem>
                  <MenuItem value="hipaa">HIPAA</MenuItem>
                  <MenuItem value="pci_dss">PCI DSS</MenuItem>
                  <MenuItem value="nist">NIST</MenuItem>
                  <MenuItem value="other">Other</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Category"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              />
            </Grid>
            <Grid item xs={6}>
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  value={formData.status}
                  label="Status"
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                >
                  <MenuItem value="not_started">Not Started</MenuItem>
                  <MenuItem value="in_progress">In Progress</MenuItem>
                  <MenuItem value="implemented">Implemented</MenuItem>
                  <MenuItem value="verified">Verified</MenuItem>
                  <MenuItem value="non_compliant">Non-Compliant</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6}>
              <LocalizationProvider dateAdapter={AdapterDateFns}>
                <DatePicker
                  label="Due Date"
                  value={formData.dueDate}
                  onChange={(newValue: Date | null) =>
                    setFormData({ ...formData, dueDate: newValue })
                  }
                  slotProps={{
                    textField: { fullWidth: true },
                  }}
                />
              </LocalizationProvider>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Evidence"
                multiline
                rows={4}
                value={formData.evidence}
                onChange={(e) => setFormData({ ...formData, evidence: e.target.value })}
                placeholder="Describe the evidence or documentation required for compliance..."
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>Cancel</Button>
          <Button onClick={handleSaveRequirement} variant="contained">
            {editingRequirement ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      <AuditReportDialog
        open={openReportDialog}
        onClose={() => setOpenReportDialog(false)}
        auditContext={{
          requirements: items.map((r) => ({
            id: r.id,
            title: r.title,
            regulation: r.regulation,
            status: r.status,
            dueDate: r.due_date,
          })),
          totalRequirements: total,
          completedRequirements: items.filter((r) => r.status === 'verified' || r.status === 'implemented').length,
          pendingRequirements: items.filter((r) => r.status === 'not_started' || r.status === 'in_progress').length,
          generatedAt: new Date().toISOString(),
        }}
        title="Generate Compliance Report"
      />
    </>
  );
};
