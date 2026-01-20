import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  CircularProgress,
  LinearProgress,
  TablePagination,
  Tooltip,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon,
  Security as RiskIcon,
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFnsV3';
import { useSearchParams } from 'react-router-dom';
import { riskApi, policyApi, requirementApi, unwrapPaginatedResponse, unwrapResponse } from '../services/grcClient';
import { useAuth } from '../contexts/AuthContext';
import {
  LoadingState,
  ErrorState,
  EmptyState,
  ResponsiveTable,
  FilterOption,
  ListToolbar,
  FilterBuilderBasic,
  FilterConfig,
  FilterTree,
} from '../components/common';
import { FeatureGate, GrcFrameworkWarningBanner } from '../components/onboarding';
import { useUniversalList } from '../hooks/useUniversalList';
import {
  parseListQuery,
  serializeFilterTree,
  countFilterConditions,
} from '../utils/listQueryUtils';

// Policy interface for relationship management
interface Policy {
  id: string;
  name: string;
  code: string | null;
  status: string;
  category: string | null;
}

// Requirement interface for relationship management
interface Requirement {
  id: string;
  title: string;
  referenceCode: string;
  status: string;
  framework: string;
}

// Risk enums matching backend
export enum RiskSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export enum RiskLikelihood {
  RARE = 'rare',
  UNLIKELY = 'unlikely',
  POSSIBLE = 'possible',
  LIKELY = 'likely',
  ALMOST_CERTAIN = 'almost_certain',
}

export enum RiskStatus {
  DRAFT = 'draft',
  IDENTIFIED = 'identified',
  ASSESSED = 'assessed',
  MITIGATING = 'mitigating',
  ACCEPTED = 'accepted',
  CLOSED = 'closed',
}

// Risk interface matching NestJS backend response
interface Risk {
  id: string;
  tenantId: string;
  title: string;
  description: string | null;
  category: string | null;
  severity: RiskSeverity;
  likelihood: RiskLikelihood;
  impact: RiskSeverity;
  score: number | null;
  status: RiskStatus;
  ownerUserId: string | null;
  dueDate: string | null;
  mitigationPlan: string | null;
  tags: string[] | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
  updatedBy: string | null;
  isDeleted: boolean;
}

const RISK_FILTER_CONFIG: FilterConfig = {
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
      name: 'category',
      label: 'Category',
      type: 'string',
    },
    {
      name: 'status',
      label: 'Status',
      type: 'enum',
      enumValues: Object.values(RiskStatus),
      enumLabels: {
        [RiskStatus.DRAFT]: 'Draft',
        [RiskStatus.IDENTIFIED]: 'Identified',
        [RiskStatus.ASSESSED]: 'Assessed',
        [RiskStatus.MITIGATING]: 'Mitigating',
        [RiskStatus.ACCEPTED]: 'Accepted',
        [RiskStatus.CLOSED]: 'Closed',
      },
    },
    {
      name: 'severity',
      label: 'Severity',
      type: 'enum',
      enumValues: Object.values(RiskSeverity),
      enumLabels: {
        [RiskSeverity.LOW]: 'Low',
        [RiskSeverity.MEDIUM]: 'Medium',
        [RiskSeverity.HIGH]: 'High',
        [RiskSeverity.CRITICAL]: 'Critical',
      },
    },
    {
      name: 'likelihood',
      label: 'Likelihood',
      type: 'enum',
      enumValues: Object.values(RiskLikelihood),
      enumLabels: {
        [RiskLikelihood.RARE]: 'Rare',
        [RiskLikelihood.UNLIKELY]: 'Unlikely',
        [RiskLikelihood.POSSIBLE]: 'Possible',
        [RiskLikelihood.LIKELY]: 'Likely',
        [RiskLikelihood.ALMOST_CERTAIN]: 'Almost Certain',
      },
    },
    {
      name: 'createdAt',
      label: 'Created Date',
      type: 'date',
    },
    {
      name: 'updatedAt',
      label: 'Updated Date',
      type: 'date',
    },
    {
      name: 'dueDate',
      label: 'Due Date',
      type: 'date',
    },
  ],
  maxConditions: 30,
};

export const RiskManagement: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [openDialog, setOpenDialog] = useState(false);
  const [openViewDialog, setOpenViewDialog] = useState(false);
  const [editingRisk, setEditingRisk] = useState<Risk | null>(null);
  const [viewingRisk, setViewingRisk] = useState<Risk | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: '',
    severity: RiskSeverity.MEDIUM,
    likelihood: RiskLikelihood.POSSIBLE,
    impact: RiskSeverity.MEDIUM,
    status: RiskStatus.DRAFT,
    mitigationPlan: '',
    dueDate: null as Date | null,
  });

  // Relationship management state
  const [allPolicies, setAllPolicies] = useState<Policy[]>([]);
  const [allRequirements, setAllRequirements] = useState<Requirement[]>([]);
  const [linkedPolicies, setLinkedPolicies] = useState<Policy[]>([]);
  const [linkedRequirements, setLinkedRequirements] = useState<Requirement[]>([]);
  const [selectedPolicyIds, setSelectedPolicyIds] = useState<string[]>([]);
  const [selectedRequirementIds, setSelectedRequirementIds] = useState<string[]>([]);
  const [relationshipLoading, setRelationshipLoading] = useState(false);
  const [relationshipSaving, setRelationshipSaving] = useState(false);

  // Get tenant ID from user context
  const tenantId = user?.tenantId || '';

  // Parse URL query params for unified list state
  const parsedQuery = useMemo(() => parseListQuery(searchParams, {
    pageSize: 10,
    sort: 'createdAt:DESC',
  }), [searchParams]);

  const statusFilter = searchParams.get('status') || '';
  const severityFilter = searchParams.get('severity') || '';
  const advancedFilter = parsedQuery.filterTree;

  // Build additional filters from URL params
  const additionalFilters = useMemo(() => {
    const filters: Record<string, unknown> = {};
    if (statusFilter) filters.status = statusFilter;
    if (severityFilter) filters.severity = severityFilter;
    if (advancedFilter) {
      const serialized = serializeFilterTree(advancedFilter);
      if (serialized) filters.filter = serialized;
    }
    return filters;
  }, [statusFilter, severityFilter, advancedFilter]);

  // Fetch function for useUniversalList
  // Note: riskApi.list expects URLSearchParams, so we convert the params object
  const fetchRisks = useCallback((params: Record<string, unknown>) => {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        searchParams.set(key, String(value));
      }
    });
    return riskApi.list(tenantId, searchParams);
  }, [tenantId]);

  const isAuthReady = !authLoading && !!tenantId;

  const {
    items: risks,
    total,
    page,
    pageSize,
    search,
    isLoading: loading,
    error: listError,
    setPage,
    setPageSize,
    setSearch,
    refetch,
  } = useUniversalList<Risk>({
    fetchFn: fetchRisks,
    defaultPageSize: 10,
    defaultSort: 'createdAt:DESC',
    syncToUrl: true,
    enabled: isAuthReady,
    additionalFilters,
  });

  // Fetch all policies and requirements for relationship dropdowns
  const fetchAllPoliciesAndRequirements = useCallback(async () => {
    if (!tenantId) return;
    try {
      const [policiesResponse, requirementsResponse] = await Promise.all([
        policyApi.list(tenantId, new URLSearchParams({ pageSize: '100' })),
        requirementApi.list(tenantId, new URLSearchParams({ pageSize: '100' })),
      ]);
      const policiesResult = unwrapPaginatedResponse<Policy>(policiesResponse);
      const requirementsResult = unwrapPaginatedResponse<Requirement>(requirementsResponse);
      setAllPolicies(policiesResult.items);
      setAllRequirements(requirementsResult.items);
    } catch (err) {
      console.error('Failed to fetch policies/requirements for relationships:', err);
    }
  }, [tenantId]);

  // Fetch linked policies and requirements for a specific risk
  const fetchRiskRelationships = useCallback(async (riskId: string) => {
    if (!tenantId) return;
    setRelationshipLoading(true);
    try {
      const [policiesResponse, requirementsResponse] = await Promise.all([
        riskApi.getLinkedPolicies(tenantId, riskId),
        riskApi.getLinkedRequirements(tenantId, riskId),
      ]);
      const policies = unwrapResponse<Policy[]>(policiesResponse) || [];
      const requirements = unwrapResponse<Requirement[]>(requirementsResponse) || [];
      setLinkedPolicies(policies);
      setLinkedRequirements(requirements);
      setSelectedPolicyIds(policies.map(p => p.id));
      setSelectedRequirementIds(requirements.map(r => r.id));
    } catch (err) {
      console.error('Failed to fetch risk relationships:', err);
      setLinkedPolicies([]);
      setLinkedRequirements([]);
      setSelectedPolicyIds([]);
      setSelectedRequirementIds([]);
    } finally {
      setRelationshipLoading(false);
    }
  }, [tenantId]);

  // Save relationship changes
  const handleSaveRelationships = async () => {
    if (!tenantId || !viewingRisk) return;
    setRelationshipSaving(true);
    try {
      await Promise.all([
        riskApi.linkPolicies(tenantId, viewingRisk.id, selectedPolicyIds),
        riskApi.linkRequirements(tenantId, viewingRisk.id, selectedRequirementIds),
      ]);
      setSuccess('Relationships updated successfully');
      // Refresh linked items
      await fetchRiskRelationships(viewingRisk.id);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Failed to save relationships:', err);
      setError('Failed to save relationships');
    } finally {
      setRelationshipSaving(false);
    }
  };

  // Fetch all policies/requirements on mount
  useEffect(() => {
    fetchAllPoliciesAndRequirements();
  }, [fetchAllPoliciesAndRequirements]);

  const handleCreateRisk = () => {
    setEditingRisk(null);
    setFormData({
      title: '',
      description: '',
      category: '',
      severity: RiskSeverity.MEDIUM,
      likelihood: RiskLikelihood.POSSIBLE,
      impact: RiskSeverity.MEDIUM,
      status: RiskStatus.DRAFT,
      mitigationPlan: '',
      dueDate: null,
    });
    setOpenDialog(true);
  };

  const handleEditRisk = (risk: Risk) => {
    setEditingRisk(risk);
    setFormData({
      title: risk.title,
      description: risk.description || '',
      category: risk.category || '',
      severity: risk.severity,
      likelihood: risk.likelihood,
      impact: risk.impact,
      status: risk.status,
      mitigationPlan: risk.mitigationPlan || '',
      dueDate: risk.dueDate ? new Date(risk.dueDate) : null,
    });
    setOpenDialog(true);
  };

  const handleViewRisk = (risk: Risk) => {
    setViewingRisk(risk);
    setOpenViewDialog(true);
    // Fetch relationships when viewing a risk
    fetchRiskRelationships(risk.id);
  };

  const handleSaveRisk = async () => {
    if (!tenantId) {
      setError('Tenant ID is required');
      return;
    }

    try {
      const riskData = {
        title: formData.title,
        description: formData.description || undefined,
        category: formData.category || undefined,
        severity: formData.severity,
        likelihood: formData.likelihood,
        impact: formData.impact,
        status: formData.status,
        mitigationPlan: formData.mitigationPlan || undefined,
        dueDate: formData.dueDate?.toISOString().split('T')[0] || undefined,
      };

      // Use centralized API client - no more /nest/ prefix
      if (editingRisk) {
        await riskApi.update(tenantId, editingRisk.id, riskData);
        setSuccess('Risk updated successfully');
      } else {
        await riskApi.create(tenantId, riskData);
        setSuccess('Risk created successfully');
      }

      setOpenDialog(false);
      setError('');
      refetch();
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      setError(error.response?.data?.message || 'Failed to save risk');
    }
  };

  const handleDeleteRisk = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this risk?')) {
      try {
        // Use centralized API client - no more /nest/ prefix
        await riskApi.delete(tenantId, id);
        setSuccess('Risk deleted successfully');
        refetch();
        
        // Clear success message after 3 seconds
        setTimeout(() => setSuccess(''), 3000);
      } catch (err: unknown) {
        const errorObj = err as { response?: { data?: { message?: string } } };
        setError(errorObj.response?.data?.message || 'Failed to delete risk');
      }
    }
  };

  const handleChangePage = (_event: unknown, newPage: number) => {
    setPage(newPage + 1); // useUniversalList uses 1-based pagination
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setPageSize(parseInt(event.target.value, 10));
  };

  // URL-based filter handlers
  const handleStatusFilterChange = useCallback((value: string) => {
    const newParams = new URLSearchParams(searchParams);
    if (value) {
      newParams.set('status', value);
    } else {
      newParams.delete('status');
    }
    newParams.set('page', '1');
    setSearchParams(newParams, { replace: true });
  }, [searchParams, setSearchParams]);

  const handleSeverityFilterChange = useCallback((value: string) => {
    const newParams = new URLSearchParams(searchParams);
    if (value) {
      newParams.set('severity', value);
    } else {
      newParams.delete('severity');
    }
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

  const handleClearAllFilters = useCallback(() => {
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

  const handleFilterRemove = useCallback((key: string) => {
    const newParams = new URLSearchParams(searchParams);
    newParams.delete(key);
    newParams.set('page', '1');
    setSearchParams(newParams, { replace: true });
  }, [searchParams, setSearchParams]);

  const activeAdvancedFilterCount = advancedFilter ? countFilterConditions(advancedFilter) : 0;

  const getActiveFilters = useCallback((): FilterOption[] => {
    const filters: FilterOption[] = [];
    if (statusFilter) {
      filters.push({ key: 'status', label: 'Status', value: formatStatus(statusFilter as RiskStatus) });
    }
    if (severityFilter) {
      filters.push({ key: 'severity', label: 'Severity', value: formatSeverity(severityFilter as RiskSeverity) });
    }
    return filters;
  }, [statusFilter, severityFilter]);

  const getSeverityColor = (severity: RiskSeverity): 'error' | 'warning' | 'info' | 'success' | 'default' => {
    switch (severity) {
      case RiskSeverity.CRITICAL: return 'error';
      case RiskSeverity.HIGH: return 'warning';
      case RiskSeverity.MEDIUM: return 'info';
      case RiskSeverity.LOW: return 'success';
      default: return 'default';
    }
  };

  const getStatusColor = (status: RiskStatus): 'error' | 'warning' | 'info' | 'success' | 'default' => {
    switch (status) {
      case RiskStatus.CLOSED: return 'success';
      case RiskStatus.ACCEPTED: return 'info';
      case RiskStatus.MITIGATING: return 'warning';
      case RiskStatus.ASSESSED: return 'info';
      case RiskStatus.IDENTIFIED: return 'warning';
      case RiskStatus.DRAFT: return 'default';
      default: return 'default';
    }
  };

  const getRiskScoreColor = (score: number | null): 'error' | 'warning' | 'info' | 'success' => {
    if (!score) return 'info';
    if (score >= 16) return 'error';
    if (score >= 9) return 'warning';
    if (score >= 4) return 'info';
    return 'success';
  };

  const formatSeverity = (severity: RiskSeverity): string => {
    return severity.charAt(0).toUpperCase() + severity.slice(1);
  };

  const formatStatus = (status: RiskStatus): string => {
    return status.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  const formatLikelihood = (likelihood: RiskLikelihood): string => {
    return likelihood.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  // Combine local error state with list error
  const displayError = error || listError;

  if (loading && risks.length === 0) {
    return <LoadingState message="Loading risks..." />;
  }

  if (displayError && risks.length === 0) {
    return (
      <ErrorState
        title="Failed to load risks"
        message={displayError}
        onRetry={refetch}
      />
    );
  }

    return (
      <Box>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Typography variant="h4">Risk Management</Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleCreateRisk}
          >
            New Risk
          </Button>
        </Box>

        {/* Onboarding Framework Warning Banner */}
        <GrcFrameworkWarningBanner />

        {displayError && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{displayError}</Alert>}
        {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}

      {/* Toolbar with Search and Filters - Using Unified List Framework */}
      <ListToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search risks..."
        filters={getActiveFilters()}
        onFilterRemove={handleFilterRemove}
        onClearFilters={handleClearAllFilters}
        activeFilterCount={activeAdvancedFilterCount}
        onRefresh={refetch}
        loading={loading}
        filterButton={
          <FilterBuilderBasic
            config={RISK_FILTER_CONFIG}
            initialFilter={advancedFilter}
            onApply={handleAdvancedFilterApply}
            onClear={handleAdvancedFilterClear}
            activeFilterCount={activeAdvancedFilterCount}
          />
        }
        actions={
          <Box display="flex" gap={1} alignItems="center">
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>Status</InputLabel>
              <Select
                value={statusFilter}
                label="Status"
                onChange={(e) => handleStatusFilterChange(String(e.target.value))}
              >
                <MenuItem value="">All</MenuItem>
                {Object.values(RiskStatus).map((status) => (
                  <MenuItem key={status} value={status}>{formatStatus(status)}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>Severity</InputLabel>
              <Select
                value={severityFilter}
                label="Severity"
                onChange={(e) => handleSeverityFilterChange(String(e.target.value))}
              >
                <MenuItem value="">All</MenuItem>
                {Object.values(RiskSeverity).map((severity) => (
                  <MenuItem key={severity} value={severity}>{formatSeverity(severity)}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        }
      />

      <Card>
        <CardContent>
          <ResponsiveTable minWidth={900}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Title</TableCell>
                  <TableCell>Category</TableCell>
                  <TableCell>Severity</TableCell>
                  <TableCell>Likelihood</TableCell>
                  <TableCell>Score</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Due Date</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {risks.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} align="center" sx={{ py: 0, border: 'none' }}>
                      <EmptyState
                        icon={<RiskIcon sx={{ fontSize: 64, color: 'text.disabled' }} />}
                        title="No risks found"
                        message={tenantId ? 'Get started by creating your first risk assessment.' : 'Please select a tenant to view risks.'}
                        actionLabel={tenantId ? 'Create Risk' : undefined}
                        onAction={tenantId ? handleCreateRisk : undefined}
                        minHeight="200px"
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  risks.map((risk) => (
                    <TableRow 
                      key={risk.id} 
                      hover
                      sx={{ 
                        cursor: 'pointer',
                        '&:hover': { backgroundColor: 'action.hover' },
                      }}
                    >
                      <TableCell>
                        <Typography 
                          variant="subtitle2" 
                          component="span"
                          onClick={() => handleViewRisk(risk)}
                          sx={{ 
                            color: 'primary.main',
                            cursor: 'pointer',
                            '&:hover': { 
                              textDecoration: 'underline',
                              color: 'primary.dark',
                            },
                            fontWeight: 500,
                          }}
                        >
                          {risk.title}
                        </Typography>
                        {risk.description && (
                          <Typography variant="body2" color="textSecondary" noWrap sx={{ maxWidth: 200 }}>
                            {risk.description}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>{risk.category || '-'}</TableCell>
                      <TableCell>
                        <Chip
                          label={formatSeverity(risk.severity)}
                          color={getSeverityColor(risk.severity)}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={formatLikelihood(risk.likelihood)}
                          variant="outlined"
                          size="small"
                        />
                      </TableCell>
                                            <TableCell>
                                              <FeatureGate feature="advanced_risk_scoring">
                                                <Box display="flex" alignItems="center" gap={1}>
                                                  <Typography variant="body2">{risk.score ?? '-'}</Typography>
                                                  {risk.score && (
                                                    <LinearProgress
                                                      variant="determinate"
                                                      value={Math.min((risk.score / 20) * 100, 100)}
                                                      color={getRiskScoreColor(risk.score)}
                                                      sx={{ width: 50, height: 8, borderRadius: 4 }}
                                                    />
                                                  )}
                                                </Box>
                                              </FeatureGate>
                                            </TableCell>
                      <TableCell>
                        <Chip
                          label={formatStatus(risk.status)}
                          color={getStatusColor(risk.status)}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        {risk.dueDate ? new Date(risk.dueDate).toLocaleDateString() : '-'}
                      </TableCell>
                      <TableCell>
                        <Tooltip title="View">
                          <IconButton size="small" onClick={() => handleViewRisk(risk)}>
                            <ViewIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Edit">
                          <IconButton size="small" onClick={() => handleEditRisk(risk)}>
                            <EditIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete">
                          <IconButton size="small" onClick={() => handleDeleteRisk(risk.id)} color="error">
                            <DeleteIcon />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </ResponsiveTable>
          <TablePagination
            rowsPerPageOptions={[5, 10, 25, 50]}
            component="div"
            count={total}
            rowsPerPage={pageSize}
            page={page}
            onPageChange={handleChangePage}
            onRowsPerPageChange={handleChangeRowsPerPage}
          />
        </CardContent>
      </Card>

      {/* Create/Edit Risk Dialog */}
      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          {editingRisk ? 'Edit Risk' : 'Create New Risk'}
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
                error={!formData.title}
                helperText={!formData.title ? 'Title is required' : ''}
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
              <TextField
                fullWidth
                label="Category"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                placeholder="e.g., Operational, Financial, Compliance"
              />
            </Grid>
            <Grid item xs={6}>
              <FormControl fullWidth>
                <InputLabel>Severity</InputLabel>
                <Select
                  value={formData.severity}
                  label="Severity"
                  onChange={(e) => setFormData({ ...formData, severity: e.target.value as RiskSeverity })}
                >
                  {Object.values(RiskSeverity).map((severity) => (
                    <MenuItem key={severity} value={severity}>{formatSeverity(severity)}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6}>
              <FormControl fullWidth>
                <InputLabel>Likelihood</InputLabel>
                <Select
                  value={formData.likelihood}
                  label="Likelihood"
                  onChange={(e) => setFormData({ ...formData, likelihood: e.target.value as RiskLikelihood })}
                >
                  {Object.values(RiskLikelihood).map((likelihood) => (
                    <MenuItem key={likelihood} value={likelihood}>{formatLikelihood(likelihood)}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6}>
              <FormControl fullWidth>
                <InputLabel>Impact</InputLabel>
                <Select
                  value={formData.impact}
                  label="Impact"
                  onChange={(e) => setFormData({ ...formData, impact: e.target.value as RiskSeverity })}
                >
                  {Object.values(RiskSeverity).map((impact) => (
                    <MenuItem key={impact} value={impact}>{formatSeverity(impact)}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6}>
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  value={formData.status}
                  label="Status"
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as RiskStatus })}
                >
                  {Object.values(RiskStatus).map((status) => (
                    <MenuItem key={status} value={status}>{formatStatus(status)}</MenuItem>
                  ))}
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
                label="Mitigation Plan"
                multiline
                rows={4}
                value={formData.mitigationPlan}
                onChange={(e) => setFormData({ ...formData, mitigationPlan: e.target.value })}
                placeholder="Describe the plan to mitigate this risk..."
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>Cancel</Button>
          <Button 
            onClick={handleSaveRisk} 
            variant="contained"
            disabled={!formData.title}
          >
            {editingRisk ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* View Risk Dialog */}
      <Dialog open={openViewDialog} onClose={() => setOpenViewDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          Risk Details
        </DialogTitle>
        <DialogContent>
          {viewingRisk && (
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12}>
                <Typography variant="h6">{viewingRisk.title}</Typography>
              </Grid>
              {viewingRisk.description && (
                <Grid item xs={12}>
                  <Typography variant="subtitle2" color="textSecondary">Description</Typography>
                  <Typography>{viewingRisk.description}</Typography>
                </Grid>
              )}
              <Grid item xs={6}>
                <Typography variant="subtitle2" color="textSecondary">Category</Typography>
                <Typography>{viewingRisk.category || '-'}</Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="subtitle2" color="textSecondary">Status</Typography>
                <Chip
                  label={formatStatus(viewingRisk.status)}
                  color={getStatusColor(viewingRisk.status)}
                  size="small"
                />
              </Grid>
              <Grid item xs={4}>
                <Typography variant="subtitle2" color="textSecondary">Severity</Typography>
                <Chip
                  label={formatSeverity(viewingRisk.severity)}
                  color={getSeverityColor(viewingRisk.severity)}
                  size="small"
                />
              </Grid>
              <Grid item xs={4}>
                <Typography variant="subtitle2" color="textSecondary">Likelihood</Typography>
                <Chip
                  label={formatLikelihood(viewingRisk.likelihood)}
                  variant="outlined"
                  size="small"
                />
              </Grid>
              <Grid item xs={4}>
                <Typography variant="subtitle2" color="textSecondary">Impact</Typography>
                <Chip
                  label={formatSeverity(viewingRisk.impact)}
                  color={getSeverityColor(viewingRisk.impact)}
                  size="small"
                />
              </Grid>
              <Grid item xs={6}>
                <Typography variant="subtitle2" color="textSecondary">Risk Score</Typography>
                <Typography>{viewingRisk.score ?? 'Not calculated'}</Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="subtitle2" color="textSecondary">Due Date</Typography>
                <Typography>
                  {viewingRisk.dueDate ? new Date(viewingRisk.dueDate).toLocaleDateString() : '-'}
                </Typography>
              </Grid>
              {viewingRisk.mitigationPlan && (
                <Grid item xs={12}>
                  <Typography variant="subtitle2" color="textSecondary">Mitigation Plan</Typography>
                  <Typography>{viewingRisk.mitigationPlan}</Typography>
                </Grid>
              )}
              <Grid item xs={6}>
                <Typography variant="subtitle2" color="textSecondary">Created</Typography>
                <Typography>{new Date(viewingRisk.createdAt).toLocaleString()}</Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="subtitle2" color="textSecondary">Last Updated</Typography>
                <Typography>{new Date(viewingRisk.updatedAt).toLocaleString()}</Typography>
              </Grid>

              {/* Relationship Management Section */}
              <Grid item xs={12}>
                <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
                  <Typography variant="h6" gutterBottom>Linked Relationships</Typography>
                  {relationshipLoading ? (
                    <Box display="flex" justifyContent="center" py={2}>
                      <CircularProgress size={24} />
                    </Box>
                  ) : (
                    <Grid container spacing={2}>
                      {/* Linked Policies */}
                      <Grid item xs={12} md={6}>
                        <FormControl fullWidth size="small">
                          <InputLabel>Linked Policies</InputLabel>
                          <Select
                            multiple
                            value={selectedPolicyIds}
                            label="Linked Policies"
                            onChange={(e) => setSelectedPolicyIds(e.target.value as string[])}
                            renderValue={(selected) => (
                              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                {selected.map((id) => {
                                  const policy = allPolicies.find(p => p.id === id);
                                  return (
                                    <Chip
                                      key={id}
                                      label={policy ? `${policy.name}${policy.code ? ` [${policy.code}]` : ''}` : id}
                                      size="small"
                                      color="primary"
                                      variant="outlined"
                                    />
                                  );
                                })}
                              </Box>
                            )}
                          >
                            {allPolicies.map((policy) => (
                              <MenuItem key={policy.id} value={policy.id}>
                                {policy.name}{policy.code ? ` [${policy.code}]` : ''} - {policy.status}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                        {linkedPolicies.length > 0 && (
                          <Box sx={{ mt: 1 }}>
                            <Typography variant="caption" color="textSecondary">
                              Currently linked: {linkedPolicies.length} {linkedPolicies.length === 1 ? 'policy' : 'policies'}
                            </Typography>
                          </Box>
                        )}
                      </Grid>

                      {/* Linked Requirements */}
                      <Grid item xs={12} md={6}>
                        <FormControl fullWidth size="small">
                          <InputLabel>Linked Requirements</InputLabel>
                          <Select
                            multiple
                            value={selectedRequirementIds}
                            label="Linked Requirements"
                            onChange={(e) => setSelectedRequirementIds(e.target.value as string[])}
                            renderValue={(selected) => (
                              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                {selected.map((id) => {
                                  const requirement = allRequirements.find(r => r.id === id);
                                  return (
                                    <Chip
                                      key={id}
                                      label={requirement ? `[${requirement.framework.toUpperCase()}] ${requirement.referenceCode}` : id}
                                      size="small"
                                      color="secondary"
                                      variant="outlined"
                                    />
                                  );
                                })}
                              </Box>
                            )}
                          >
                            {allRequirements.map((requirement) => (
                              <MenuItem key={requirement.id} value={requirement.id}>
                                [{requirement.framework.toUpperCase()}] {requirement.referenceCode} - {requirement.title}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                        {linkedRequirements.length > 0 && (
                          <Box sx={{ mt: 1 }}>
                            <Typography variant="caption" color="textSecondary">
                              Currently linked: {linkedRequirements.length} {linkedRequirements.length === 1 ? 'requirement' : 'requirements'}
                            </Typography>
                          </Box>
                        )}
                      </Grid>

                      {/* Save Relationships Button */}
                      <Grid item xs={12}>
                        <Button
                          variant="outlined"
                          onClick={handleSaveRelationships}
                          disabled={relationshipSaving}
                          startIcon={relationshipSaving ? <CircularProgress size={16} /> : null}
                        >
                          {relationshipSaving ? 'Saving...' : 'Save Relationships'}
                        </Button>
                      </Grid>
                    </Grid>
                  )}
                </Box>
              </Grid>
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenViewDialog(false)}>Close</Button>
          <Button 
            onClick={() => {
              if (viewingRisk) {
                handleEditRisk(viewingRisk);
                setOpenViewDialog(false);
              }
            }} 
            variant="contained"
          >
            Edit
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
