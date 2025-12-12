import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Grid,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Chip,
  Paper,
  CircularProgress,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Checkbox,
  ListItemText,
} from '@mui/material';
import {
  Save as SaveIcon,
  ArrowBack as BackIcon,
  Edit as EditIcon,
  Lock as LockIcon,
  Visibility as ViewIcon,
  Description as ReportIcon,
  CheckCircle as FinalizeIcon,
  Archive as ArchiveIcon,
  Send as SubmitIcon,
  Add as AddIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
} from '@mui/icons-material';
import { useNavigate, useParams } from 'react-router-dom';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { useAuth } from '../contexts/AuthContext';
import { LoadingState, ErrorState } from '../components/common';
import { ModuleGuard } from '../components/ModuleGuard';
import { AuditScopeCard, RequirementDetailDrawer } from '../components/audit';
import { useFormLayout } from '../hooks/useFormLayout';
import { useUiPolicy } from '../hooks/useUiPolicy';
import { api } from '../services/api';

const unwrapResponse = <T,>(response: { data: { success?: boolean; data?: T } | T }): T | null => {
  try {
    const data = response.data;
    if (data && typeof data === 'object' && 'success' in data && 'data' in data) {
      return (data as { success: boolean; data: T }).data;
    }
    return data as T;
  } catch {
    return null;
  }
};

interface Audit {
  id: string;
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
  scope: string | null;
  objectives: string | null;
  methodology: string | null;
  findingsSummary: string | null;
  recommendations: string | null;
  conclusion: string | null;
  owner?: { firstName?: string; lastName?: string; email?: string };
  leadAuditor?: { firstName?: string; lastName?: string; email?: string };
  createdAt: string;
  updatedAt: string;
}

interface AuditPermissions {
  read: boolean;
  write: boolean;
  delete: boolean;
  maskedFields: string[];
  deniedFields: string[];
}

interface User {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
}

interface Finding {
  id: string;
  auditId: string;
  title: string;
  description: string | null;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: string;
  ownerUserId?: string;
  owner?: { firstName?: string; lastName?: string };
  dueDate?: string;
  capas?: Array<{ id: string }>;
  issueRequirements?: Array<{ id: string; requirementId: string }>;
  createdAt: string;
}

interface AuditRequirement {
  id: string;
  auditId: string;
  requirementId: string;
  status: 'planned' | 'in_scope' | 'sampled' | 'tested' | 'completed';
  notes?: string;
  framework?: string;
  referenceCode?: string;
  title?: string;
  description?: string | null;
  category?: string | null;
  priority?: string | null;
  requirement?: {
    id: string;
    framework: string;
    referenceCode: string;
    title: string;
    description?: string;
    category?: string;
    priority?: string;
    status?: string;
  };
  createdAt: string;
}

interface AuditCriterion {
  id: number;
  audit_id: number;
  requirement_id: number;
  title: string;
  description: string | null;
  regulation: string | null;
  category: string | null;
  status: string | null;
}

interface ScopeObject {
  id: number;
  audit_id: number;
  object_type: string;
  object_id: string;
  object_name: string | null;
}

interface AuditReport {
  id: number;
  audit_id: number;
  version: number;
  status: 'draft' | 'under_review' | 'final' | 'archived';
  created_by: number;
  created_by_first_name?: string;
  created_by_last_name?: string;
  created_at: string;
  updated_at: string;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div role="tabpanel" hidden={value !== index} {...other}>
      {value === index && <Box sx={{ pt: 2 }}>{children}</Box>}
    </div>
  );
}

export const AuditDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  useAuth();
  // Check for create mode: either no id (from /audits/new route) or id === 'new' (from /audits/:id route)
  const isNew = !id || id === 'new';
  const isEditMode = window.location.pathname.endsWith('/edit') || isNew;

    const [audit, setAudit] = useState<Audit | null>(null);
    const [loading, setLoading] = useState(!isNew);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [permissions, setPermissions] = useState<AuditPermissions | null>(null);
    const [users, setUsers] = useState<User[]>([]);
  
                const [activeTab, setActiveTab] = useState(0);
                const [findings, setFindings] = useState<Finding[]>([]);
                const [auditRequirements, setAuditRequirements] = useState<AuditRequirement[]>([]);
                const [reports, setReports] = useState<AuditReport[]>([]);
        const [relatedDataLoading, setRelatedDataLoading] = useState(false);
        const [generatingReport, setGeneratingReport] = useState(false);
        const [reportActionLoading, setReportActionLoading] = useState<number | null>(null);
        const [addRequirementModalOpen, setAddRequirementModalOpen] = useState(false);
        const [addFindingModalOpen, setAddFindingModalOpen] = useState(false);
        const [availableRequirements, setAvailableRequirements] = useState<Array<{ id: string; framework: string; referenceCode: string; title: string }>>([]);
        const [selectedRequirementIds, setSelectedRequirementIds] = useState<string[]>([]);
        const [findingFormData, setFindingFormData] = useState({
          title: '',
          description: '',
          severity: 'medium' as 'low' | 'medium' | 'high' | 'critical',
          status: 'open',
          ownerUserId: '',
          dueDate: '',
          requirementIds: [] as string[],
        });
        const [savingRequirements, setSavingRequirements] = useState(false);
        const [savingFinding, setSavingFinding] = useState(false);
        const [requirementDrawerOpen, setRequirementDrawerOpen] = useState(false);
        const [selectedRequirement, setSelectedRequirement] = useState<AuditRequirement | null>(null);
        const [frameworkFilter, setFrameworkFilter] = useState<string>('');
        const [domainFilter, setDomainFilter] = useState<string>('');
        const [searchFilter, setSearchFilter] = useState<string>('');

    const [formData, setFormData] = useState({
      name: '',
      description: '',
      audit_type: 'internal' as 'internal' | 'external' | 'regulatory' | 'compliance',
      status: 'planned' as 'planned' | 'in_progress' | 'completed' | 'closed' | 'cancelled',
      risk_level: 'medium' as 'low' | 'medium' | 'high' | 'critical',
      department: '',
      lead_auditor_id: null as number | null,
      planned_start_date: null as Date | null,
      planned_end_date: null as Date | null,
      actual_start_date: null as Date | null,
      actual_end_date: null as Date | null,
      scope: '',
      objectives: '',
      methodology: '',
      findings_summary: '',
      recommendations: '',
      conclusion: '',
    });

  const { layout, isLoading: layoutLoading } = useFormLayout('audits');
  const { 
    isFieldHidden: uiPolicyHidden, 
    isFieldReadonly: uiPolicyReadonly, 
    isFieldMandatory: uiPolicyMandatory,
    evaluatePolicies 
  } = useUiPolicy('audits');

  const fetchAudit = useCallback(async () => {
    if (isNew) return;

    try {
      setLoading(true);
      setError('');
      const response = await api.get(`/grc/audits/${id}`);
      const auditData = unwrapResponse<Audit>(response);
      
      if (!auditData) {
        setError('Failed to load audit data. Please try again.');
        return;
      }
      
      setAudit(auditData);

            setFormData({
              name: auditData.name || '',
              description: auditData.description || '',
              audit_type: auditData.auditType || 'internal',
              status: auditData.status || 'planned',
              risk_level: auditData.riskLevel || 'medium',
              department: auditData.department || '',
              lead_auditor_id: auditData.leadAuditorId ? Number(auditData.leadAuditorId) : null,
              planned_start_date: auditData.plannedStartDate ? new Date(auditData.plannedStartDate) : null,
              planned_end_date: auditData.plannedEndDate ? new Date(auditData.plannedEndDate) : null,
              actual_start_date: auditData.actualStartDate ? new Date(auditData.actualStartDate) : null,
              actual_end_date: auditData.actualEndDate ? new Date(auditData.actualEndDate) : null,
              scope: auditData.scope || '',
              objectives: auditData.objectives || '',
              methodology: auditData.methodology || '',
              findings_summary: auditData.findingsSummary || '',
              recommendations: auditData.recommendations || '',
              conclusion: auditData.conclusion || '',
            });
    } catch (err: unknown) {
      const error = err as { response?: { status?: number; data?: { message?: string } } };
      if (error.response?.status === 403) {
        setError('You do not have permission to view this audit.');
      } else if (error.response?.status === 404) {
        setError('Audit not found.');
      } else {
        setError(error.response?.data?.message || 'Failed to fetch audit');
      }
    } finally {
      setLoading(false);
    }
  }, [id, isNew]);

  const fetchPermissions = useCallback(async () => {
    if (isNew) {
      setPermissions({ read: true, write: true, delete: false, maskedFields: [], deniedFields: [] });
      return;
    }

    try {
      const response = await api.get(`/grc/audits/${id}/permissions`);
      const permissionsData = unwrapResponse<AuditPermissions>(response);
      setPermissions(permissionsData || { read: true, write: false, delete: false, maskedFields: [], deniedFields: [] });
    } catch {
      setPermissions({ read: true, write: false, delete: false, maskedFields: [], deniedFields: [] });
    }
  }, [id, isNew]);

    const fetchUsers = useCallback(async () => {
      try {
        const response = await api.get('/api/users');
        setUsers(response.data.users || response.data || []);
      } catch {
        setUsers([]);
      }
    }, []);

                const fetchRelatedData = useCallback(async () => {
                  if (isNew || !id) return;

                  try {
                    setRelatedDataLoading(true);
                    const [findingsRes, requirementsRes, reportsRes] = await Promise.all([
                      api.get(`/grc/audits/${id}/findings`),
                      api.get(`/grc/audits/${id}/requirements`),
                      api.get(`/grc/audits/${id}/reports`).catch(() => ({ data: [] }))
                    ]);
                    setFindings(unwrapResponse<Finding[]>(findingsRes) || []);
                    setAuditRequirements(unwrapResponse<AuditRequirement[]>(requirementsRes) || []);
                    setReports(unwrapResponse<AuditReport[]>(reportsRes) || []);
                  } catch {
                    setFindings([]);
                    setAuditRequirements([]);
                    setReports([]);
                  } finally {
                    setRelatedDataLoading(false);
                  }
                }, [id, isNew]);

    const handleGenerateReport = async () => {
      if (!id) return;
      try {
        setGeneratingReport(true);
        setError('');
        const response = await api.post(`/grc/audits/${id}/reports/generate`);
        setSuccess('Report generated successfully');
        const newReportId = response.data.report?.id;
        if (newReportId) {
          setTimeout(() => navigate(`/audits/${id}/reports/${newReportId}`), 1500);
        } else {
          const reportsRes = await api.get(`/grc/audits/${id}/reports`);
          setReports(reportsRes.data || []);
        }
      } catch (err: unknown) {
        const error = err as { response?: { data?: { message?: string } } };
        setError(error.response?.data?.message || 'Failed to generate report');
      } finally {
        setGeneratingReport(false);
      }
    };

    const handleReportStatusChange = async (reportId: number, newStatus: string) => {
      if (!id) return;
      try {
        setReportActionLoading(reportId);
        setError('');
        await api.patch(`/grc/audits/${id}/reports/${reportId}/status`, { status: newStatus });
        setSuccess(`Report status updated to ${newStatus.replace(/_/g, ' ')}`);
        const reportsRes = await api.get(`/grc/audits/${id}/reports`);
        setReports(reportsRes.data || []);
      } catch (err: unknown) {
        const error = err as { response?: { data?: { message?: string } } };
        setError(error.response?.data?.message || 'Failed to update report status');
      } finally {
        setReportActionLoading(null);
      }
    };

        const getReportStatusColor = (status: string): 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning' => {
          switch (status) {
            case 'draft': return 'default';
            case 'under_review': return 'info';
            case 'final': return 'success';
            case 'archived': return 'secondary';
            default: return 'default';
          }
        };

        const fetchAvailableRequirements = async () => {
          try {
            const response = await api.get('/grc/requirements');
            const data = unwrapResponse<Array<{ id: string; framework: string; referenceCode: string; title: string }>>(response);
            setAvailableRequirements(data || []);
          } catch {
            setAvailableRequirements([]);
          }
        };

        const handleOpenAddRequirementModal = () => {
          fetchAvailableRequirements();
          setSelectedRequirementIds([]);
          setAddRequirementModalOpen(true);
        };

        const handleAddRequirements = async () => {
          if (!id || selectedRequirementIds.length === 0) return;
          try {
            setSavingRequirements(true);
            setError('');
            await api.post(`/grc/audits/${id}/requirements`, { requirementIds: selectedRequirementIds });
            setSuccess('Requirements added to audit scope');
            setAddRequirementModalOpen(false);
            fetchRelatedData();
          } catch (err: unknown) {
            const error = err as { response?: { data?: { message?: string } } };
            setError(error.response?.data?.message || 'Failed to add requirements');
          } finally {
            setSavingRequirements(false);
          }
        };

        const handleRemoveRequirement = async (requirementId: string) => {
          if (!id) return;
          try {
            setError('');
            await api.delete(`/grc/audits/${id}/requirements/${requirementId}`);
            setSuccess('Requirement removed from audit scope');
            fetchRelatedData();
          } catch (err: unknown) {
            const error = err as { response?: { data?: { message?: string } } };
            setError(error.response?.data?.message || 'Failed to remove requirement');
          }
        };

        const handleOpenAddFindingModal = () => {
          setFindingFormData({
            title: '',
            description: '',
            severity: 'medium',
            status: 'open',
            ownerUserId: '',
            dueDate: '',
            requirementIds: [],
          });
          setAddFindingModalOpen(true);
        };

        const handleAddFinding = async () => {
          if (!id || !findingFormData.title.trim()) {
            setError('Finding title is required');
            return;
          }
          try {
            setSavingFinding(true);
            setError('');
            await api.post(`/grc/audits/${id}/findings`, {
              title: findingFormData.title,
              description: findingFormData.description || undefined,
              severity: findingFormData.severity,
              status: findingFormData.status,
              ownerUserId: findingFormData.ownerUserId || undefined,
              dueDate: findingFormData.dueDate || undefined,
              requirementIds: findingFormData.requirementIds.length > 0 ? findingFormData.requirementIds : undefined,
            });
            setSuccess('Finding created successfully');
            setAddFindingModalOpen(false);
            fetchRelatedData();
          } catch (err: unknown) {
            const error = err as { response?: { data?: { message?: string } } };
            setError(error.response?.data?.message || 'Failed to create finding');
          } finally {
            setSavingFinding(false);
          }
        };

        const getRequirementStatusColor = (status: string): 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning' => {
          switch (status) {
            case 'planned': return 'default';
            case 'in_scope': return 'info';
            case 'sampled': return 'primary';
            case 'tested': return 'warning';
            case 'completed': return 'success';
            default: return 'default';
          }
        };

        const handleOpenRequirementDrawer = (requirement: AuditRequirement) => {
          setSelectedRequirement(requirement);
          setRequirementDrawerOpen(true);
        };

        const handleCloseRequirementDrawer = () => {
          setRequirementDrawerOpen(false);
          setSelectedRequirement(null);
        };

        const handleOpenFinding = (findingId: string) => {
          navigate(`/findings/${findingId}`);
        };

        const handleAddFindingFromRequirement = (requirementId: string) => {
          setFindingFormData({
            title: '',
            description: '',
            severity: 'medium',
            status: 'open',
            ownerUserId: '',
            dueDate: '',
            requirementIds: [requirementId],
          });
          setAddFindingModalOpen(true);
        };

        const getUniqueFrameworks = (): string[] => {
          const frameworks = auditRequirements.map(r => r.framework || r.requirement?.framework);
          return [...new Set(frameworks)].filter(Boolean) as string[];
        };

        const getUniqueDomains = (): string[] => {
          const domains = auditRequirements
            .filter(r => !frameworkFilter || (r.framework || r.requirement?.framework) === frameworkFilter)
            .map(r => {
              const code = r.referenceCode || r.requirement?.referenceCode || '';
              const parts = code.split('.');
              return parts.length > 0 ? parts[0] : '';
            })
            .filter(Boolean);
          return [...new Set(domains)];
        };

        const getFilteredRequirements = (): AuditRequirement[] => {
          return auditRequirements.filter(r => {
            const framework = r.framework || r.requirement?.framework;
            const referenceCode = r.referenceCode || r.requirement?.referenceCode || '';
            const title = r.title || r.requirement?.title || '';
            const description = r.description || r.requirement?.description || '';
            
            if (frameworkFilter && framework !== frameworkFilter) return false;
            if (domainFilter) {
              if (!referenceCode.startsWith(domainFilter)) return false;
            }
            if (searchFilter) {
              const search = searchFilter.toLowerCase();
              const matchesTitle = title.toLowerCase().includes(search);
              const matchesDescription = description.toLowerCase().includes(search);
              const matchesCode = referenceCode.toLowerCase().includes(search);
              if (!matchesTitle && !matchesDescription && !matchesCode) return false;
            }
            return true;
          });
        };

        const getSeverityColor = (severity: string): 'error' | 'warning' | 'info' | 'default' => {
          switch (severity) {
            case 'critical': return 'error';
            case 'high': return 'warning';
            case 'medium': return 'info';
            default: return 'default';
          }
        };

        const getStatusColor = (status: string): 'default' | 'primary' | 'success' | 'warning' => {
          switch (status) {
            case 'open': return 'warning';
            case 'in_progress': return 'primary';
            case 'resolved':
            case 'closed': return 'success';
            default: return 'default';
          }
        };

        useEffect(() => {
      fetchAudit();
      fetchPermissions();
      fetchUsers();
      fetchRelatedData();
    }, [fetchAudit, fetchPermissions, fetchUsers, fetchRelatedData]);

  useEffect(() => {
    evaluatePolicies(formData);
  }, [formData, evaluatePolicies]);

  const handleSave = async () => {
    if (!formData.name.trim()) {
      setError('Name is required');
      return;
    }

    try {
      setSaving(true);
      setError('');

      // Transform snake_case formData to camelCase for backend DTO
      const payload = {
        name: formData.name,
        description: formData.description || undefined,
        auditType: formData.audit_type,
        status: formData.status,
        riskLevel: formData.risk_level,
        department: formData.department || undefined,
        leadAuditorId: formData.lead_auditor_id ? String(formData.lead_auditor_id) : undefined,
        plannedStartDate: formData.planned_start_date?.toISOString().split('T')[0] || undefined,
        plannedEndDate: formData.planned_end_date?.toISOString().split('T')[0] || undefined,
        scope: formData.scope || undefined,
        objectives: formData.objectives || undefined,
        methodology: formData.methodology || undefined,
      };

      if (isNew) {
        const response = await api.post('/grc/audits', payload);
        const createdAudit = unwrapResponse<{ id: string }>(response);
        const auditId = createdAudit?.id;
        
        if (!auditId) {
          setError('Audit was created but the system could not determine its ID. Please check the audit list.');
          return;
        }
        
        setSuccess('Audit created successfully');
        setTimeout(() => navigate(`/audits/${auditId}`), 1500);
      } else {
        await api.patch(`/grc/audits/${id}`, payload);
        setSuccess('Audit updated successfully');
        setTimeout(() => {
          setSuccess('');
          navigate(`/audits/${id}`);
        }, 1500);
      }
    } catch (err: unknown) {
      const error = err as { response?: { status?: number; data?: { message?: string } } };
      if (error.response?.status === 403) {
        setError('You do not have permission to save this audit.');
      } else {
        setError(error.response?.data?.message || 'Failed to save audit');
      }
    } finally {
      setSaving(false);
    }
  };

  const isFieldHidden = (fieldName: string): boolean => {
    if (permissions?.maskedFields.includes(fieldName)) return true;
    if (uiPolicyHidden(fieldName)) return true;
    if (layout?.hiddenFields?.includes(fieldName)) return true;
    return false;
  };

  const isFieldReadonly = (fieldName: string): boolean => {
    if (!isEditMode) return true;
    if (!permissions?.write) return true;
    if (permissions?.deniedFields.includes(fieldName)) return true;
    if (uiPolicyReadonly(fieldName)) return true;
    if (layout?.readonlyFields?.includes(fieldName)) return true;
    return false;
  };

  const isFieldMandatory = (fieldName: string): boolean => {
    if (fieldName === 'name') return true;
    return uiPolicyMandatory(fieldName);
  };

  const handleFieldChange = (field: string, value: unknown) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const renderField = (fieldName: string, label: string, type: 'text' | 'select' | 'date' | 'multiline' = 'text', options?: { value: string; label: string }[]) => {
    if (isFieldHidden(fieldName)) return null;

    const readonly = isFieldReadonly(fieldName);
    const mandatory = isFieldMandatory(fieldName);
    const value = formData[fieldName as keyof typeof formData];

    if (type === 'select' && options) {
      return (
        <FormControl fullWidth disabled={readonly}>
          <InputLabel required={mandatory}>{label}</InputLabel>
          <Select
            value={value || ''}
            label={label}
            onChange={(e) => handleFieldChange(fieldName, e.target.value)}
          >
            {options.map(opt => (
              <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
            ))}
          </Select>
          {readonly && <LockIcon sx={{ position: 'absolute', right: 40, top: 16, color: 'text.disabled', fontSize: 16 }} />}
        </FormControl>
      );
    }

    if (type === 'date') {
      return (
        <LocalizationProvider dateAdapter={AdapterDateFns}>
          <DatePicker
            label={label}
            value={value as Date | null}
            onChange={(newValue) => handleFieldChange(fieldName, newValue)}
            disabled={readonly}
            slotProps={{
              textField: {
                fullWidth: true,
                required: mandatory,
              },
            }}
          />
        </LocalizationProvider>
      );
    }

    return (
      <TextField
        fullWidth
        label={label}
        value={value || ''}
        onChange={(e) => handleFieldChange(fieldName, e.target.value)}
        disabled={readonly}
        required={mandatory}
        multiline={type === 'multiline'}
        rows={type === 'multiline' ? 4 : 1}
        InputProps={{
          endAdornment: readonly ? <LockIcon sx={{ color: 'text.disabled', fontSize: 16 }} /> : undefined,
        }}
      />
    );
  };

  if (loading || layoutLoading) {
    return (
      <ModuleGuard moduleKey="audit">
        <LoadingState message="Loading audit..." />
      </ModuleGuard>
    );
  }

  if (error && !audit && !isNew) {
    return (
      <ModuleGuard moduleKey="audit">
        <ErrorState
          title="Failed to load audit"
          message={error}
          onRetry={fetchAudit}
        />
      </ModuleGuard>
    );
  }

  return (
    <ModuleGuard moduleKey="audit">
      <Box>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Box display="flex" alignItems="center" gap={2}>
            <Button startIcon={<BackIcon />} onClick={() => navigate('/audits')}>
              Back to Audits
            </Button>
            <Typography variant="h4">
              {isNew ? 'New Audit' : isEditMode ? 'Edit Audit' : audit?.name}
            </Typography>
            {audit && !isEditMode && (
              <Chip
                label={audit.status.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                color={
                  audit.status === 'closed' ? 'info' :
                  audit.status === 'completed' ? 'success' :
                  audit.status === 'in_progress' ? 'primary' : 'default'
                }
              />
            )}
          </Box>
          <Box display="flex" gap={2}>
            {!isEditMode && permissions?.write && (
              <Button
                variant="contained"
                startIcon={<EditIcon />}
                onClick={() => navigate(`/audits/${id}/edit`)}
              >
                Edit
              </Button>
            )}
            {isEditMode && (
              <Button
                variant="contained"
                startIcon={saving ? <CircularProgress size={20} color="inherit" /> : <SaveIcon />}
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? 'Saving...' : 'Save'}
              </Button>
            )}
          </Box>
        </Box>

        {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
        {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

        {audit?.status === 'closed' && isEditMode && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            This audit is closed. Some fields may be read-only based on UI policies.
          </Alert>
        )}

        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>Basic Information</Typography>
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                {renderField('name', 'Audit Name')}
              </Grid>
              <Grid item xs={12} md={6}>
                {renderField('audit_type', 'Audit Type', 'select', [
                  { value: 'internal', label: 'Internal' },
                  { value: 'external', label: 'External' },
                ])}
              </Grid>
              <Grid item xs={12} md={6}>
                {renderField('status', 'Status', 'select', [
                  { value: 'planned', label: 'Planned' },
                  { value: 'in_progress', label: 'In Progress' },
                  { value: 'completed', label: 'Completed' },
                  { value: 'closed', label: 'Closed' },
                ])}
              </Grid>
              <Grid item xs={12} md={6}>
                {renderField('risk_level', 'Risk Level', 'select', [
                  { value: 'low', label: 'Low' },
                  { value: 'medium', label: 'Medium' },
                  { value: 'high', label: 'High' },
                  { value: 'critical', label: 'Critical' },
                ])}
              </Grid>
              <Grid item xs={12} md={6}>
                {renderField('department', 'Department')}
              </Grid>
              <Grid item xs={12} md={6}>
                {!isFieldHidden('lead_auditor_id') && (
                  <FormControl fullWidth disabled={isFieldReadonly('lead_auditor_id')}>
                    <InputLabel>Lead Auditor</InputLabel>
                    <Select
                      value={formData.lead_auditor_id || ''}
                      label="Lead Auditor"
                      onChange={(e) => handleFieldChange('lead_auditor_id', e.target.value || null)}
                    >
                      <MenuItem value="">None</MenuItem>
                      {users.map(u => (
                        <MenuItem key={u.id} value={u.id}>{u.first_name} {u.last_name}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                )}
              </Grid>
              <Grid item xs={12}>
                {renderField('description', 'Description', 'multiline')}
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>Schedule</Typography>
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                {renderField('planned_start_date', 'Planned Start Date', 'date')}
              </Grid>
              <Grid item xs={12} md={6}>
                {renderField('planned_end_date', 'Planned End Date', 'date')}
              </Grid>
              <Grid item xs={12} md={6}>
                {renderField('actual_start_date', 'Actual Start Date', 'date')}
              </Grid>
              <Grid item xs={12} md={6}>
                {renderField('actual_end_date', 'Actual End Date', 'date')}
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>Scope & Objectives</Typography>
            <Grid container spacing={3}>
              <Grid item xs={12}>
                {renderField('scope', 'Scope', 'multiline')}
              </Grid>
              <Grid item xs={12}>
                {renderField('objectives', 'Objectives', 'multiline')}
              </Grid>
              <Grid item xs={12}>
                {renderField('methodology', 'Methodology', 'multiline')}
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {!isFieldHidden('findings_summary') && !isFieldHidden('recommendations') && !isFieldHidden('conclusion') && (
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>Findings & Conclusions</Typography>
              <Grid container spacing={3}>
                <Grid item xs={12}>
                  {renderField('findings_summary', 'Findings Summary', 'multiline')}
                </Grid>
                <Grid item xs={12}>
                  {renderField('recommendations', 'Recommendations', 'multiline')}
                </Grid>
                <Grid item xs={12}>
                  {renderField('conclusion', 'Conclusion', 'multiline')}
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        )}

                {!isNew && audit && !isEditMode && (
                  <AuditScopeCard
                    audit={{
                      name: audit.name,
                      description: audit.description,
                      objectives: audit.objectives,
                      plannedStartDate: audit.plannedStartDate,
                      plannedEndDate: audit.plannedEndDate,
                      actualStartDate: audit.actualStartDate,
                      actualEndDate: audit.actualEndDate,
                      department: audit.department,
                    }}
                    frameworks={getUniqueFrameworks()}
                  />
                )}

                {!isNew && audit && (
                  <Card sx={{ mb: 3 }}>
                    <CardContent>
                      <Typography variant="h6" gutterBottom>Audit Information</Typography>
                      <Grid container spacing={2}>
                                                <Grid item xs={12} md={6}>
                                                  <Typography variant="body2" color="textSecondary">Owner</Typography>
                                                  <Typography>
                                                    {audit.owner?.firstName && audit.owner?.lastName
                                                      ? `${audit.owner.firstName} ${audit.owner.lastName}`
                                                      : 'Not assigned'}
                                                    {audit.owner?.email && (
                                                      <Typography variant="body2" color="textSecondary" component="span">
                                                        {' '}({audit.owner.email})
                                                      </Typography>
                                                    )}
                                                  </Typography>
                                                </Grid>
                                                <Grid item xs={12} md={6}>
                                                  <Typography variant="body2" color="textSecondary">Lead Auditor</Typography>
                                                  <Typography>
                                                    {audit.leadAuditor?.firstName && audit.leadAuditor?.lastName
                                                      ? `${audit.leadAuditor.firstName} ${audit.leadAuditor.lastName}`
                                                      : 'Not assigned'}
                                                    {audit.leadAuditor?.email && (
                                                      <Typography variant="body2" color="textSecondary" component="span">
                                                        {' '}({audit.leadAuditor.email})
                                                      </Typography>
                                                    )}
                                                  </Typography>
                                                </Grid>
                                                <Grid item xs={12} md={6}>
                                                  <Typography variant="body2" color="textSecondary">Created</Typography>
                                                  <Typography>{new Date(audit.createdAt).toLocaleString()}</Typography>
                                                </Grid>
                                                <Grid item xs={12} md={6}>
                                                  <Typography variant="body2" color="textSecondary">Last Updated</Typography>
                                                  <Typography>{new Date(audit.updatedAt).toLocaleString()}</Typography>
                                                </Grid>
                      </Grid>
                    </CardContent>
                  </Card>
                )}

                                {!isNew && audit && !isEditMode && (
                                  <Card sx={{ mb: 3 }}>
                                    <CardContent>
                                      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
                                        <Tabs value={activeTab} onChange={(_, newValue) => setActiveTab(newValue)}>
                                          <Tab label={`Scope & Standards (${auditRequirements.length})`} />
                                          <Tab label={`Findings & CAPA (${findings.length})`} />
                                          <Tab label={`Reports (${reports.length})`} icon={<ReportIcon />} iconPosition="start" />
                                        </Tabs>
                                      </Box>

                                      {/* Scope & Standards Tab */}
                                      <TabPanel value={activeTab} index={0}>
                                        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                                          <Typography variant="subtitle1">Requirements in Audit Scope</Typography>
                                          {permissions?.write && (
                                            <Button
                                              variant="contained"
                                              onClick={handleOpenAddRequirementModal}
                                              startIcon={<AddIcon />}
                                            >
                                              Add Requirements
                                            </Button>
                                          )}
                                        </Box>
                                        {relatedDataLoading ? (
                                          <Box display="flex" justifyContent="center" p={3}>
                                            <CircularProgress />
                                          </Box>
                                        ) : auditRequirements.length === 0 ? (
                                          <Typography color="textSecondary" sx={{ p: 2 }}>No requirements in audit scope. Click "Add Requirements" to add standards/requirements to this audit.</Typography>
                                        ) : (
                                          <Grid container spacing={2}>
                                            {/* Left Filter Panel */}
                                            <Grid item xs={12} md={3}>
                                              <Paper variant="outlined" sx={{ p: 2 }}>
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                                                  <FilterIcon color="action" />
                                                  <Typography variant="subtitle2">Filters</Typography>
                                                </Box>
                                                <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                                                  <InputLabel>Framework</InputLabel>
                                                  <Select
                                                    value={frameworkFilter}
                                                    label="Framework"
                                                    onChange={(e) => {
                                                      setFrameworkFilter(e.target.value);
                                                      setDomainFilter('');
                                                    }}
                                                  >
                                                    <MenuItem value="">All Frameworks</MenuItem>
                                                    {getUniqueFrameworks().map((fw) => (
                                                      <MenuItem key={fw} value={fw}>{fw}</MenuItem>
                                                    ))}
                                                  </Select>
                                                </FormControl>
                                                <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                                                  <InputLabel>Domain/Annex</InputLabel>
                                                  <Select
                                                    value={domainFilter}
                                                    label="Domain/Annex"
                                                    onChange={(e) => setDomainFilter(e.target.value)}
                                                  >
                                                    <MenuItem value="">All Domains</MenuItem>
                                                    {getUniqueDomains().map((domain) => (
                                                      <MenuItem key={domain} value={domain}>{domain}</MenuItem>
                                                    ))}
                                                  </Select>
                                                </FormControl>
                                                <TextField
                                                  fullWidth
                                                  size="small"
                                                  placeholder="Search requirements..."
                                                  value={searchFilter}
                                                  onChange={(e) => setSearchFilter(e.target.value)}
                                                  InputProps={{
                                                    startAdornment: <SearchIcon color="action" sx={{ mr: 1 }} />,
                                                  }}
                                                />
                                                {(frameworkFilter || domainFilter || searchFilter) && (
                                                  <Button
                                                    size="small"
                                                    onClick={() => {
                                                      setFrameworkFilter('');
                                                      setDomainFilter('');
                                                      setSearchFilter('');
                                                    }}
                                                    sx={{ mt: 1 }}
                                                  >
                                                    Clear Filters
                                                  </Button>
                                                )}
                                              </Paper>
                                            </Grid>
                                            {/* Right Panel - Requirement List */}
                                            <Grid item xs={12} md={9}>
                                              <TableContainer component={Paper} variant="outlined">
                                                <Table size="small">
                                                  <TableHead>
                                                    <TableRow>
                                                      <TableCell>Framework</TableCell>
                                                      <TableCell>Reference Code</TableCell>
                                                      <TableCell>Title</TableCell>
                                                      <TableCell>Description</TableCell>
                                                      <TableCell>Audit Status</TableCell>
                                                      <TableCell>Actions</TableCell>
                                                    </TableRow>
                                                  </TableHead>
                                                  <TableBody>
                                                    {getFilteredRequirements().map((ar) => (
                                                      <TableRow key={ar.id} hover>
                                                        <TableCell>
                                                          <Chip label={ar.framework || '-'} size="small" color="primary" variant="outlined" />
                                                        </TableCell>
                                                        <TableCell>
                                                          <Typography variant="body2" fontWeight="medium">
                                                            {ar.referenceCode || '-'}
                                                          </Typography>
                                                        </TableCell>
                                                        <TableCell>
                                                          <Typography variant="body2" noWrap sx={{ maxWidth: 200 }}>
                                                            {ar.title || '-'}
                                                          </Typography>
                                                        </TableCell>
                                                        <TableCell>
                                                          <Typography variant="body2" color="textSecondary" noWrap sx={{ maxWidth: 150 }}>
                                                            {ar.description ? ar.description.substring(0, 50) + (ar.description.length > 50 ? '...' : '') : '-'}
                                                          </Typography>
                                                        </TableCell>
                                                        <TableCell>
                                                          <Chip 
                                                            label={ar.status.replace(/_/g, ' ')} 
                                                            size="small"
                                                            color={getRequirementStatusColor(ar.status)}
                                                          />
                                                        </TableCell>
                                                        <TableCell>
                                                          <Box display="flex" gap={0.5}>
                                                            <Button 
                                                              size="small" 
                                                              variant="outlined"
                                                              onClick={() => handleOpenRequirementDrawer(ar)}
                                                            >
                                                              View
                                                            </Button>
                                                            {permissions?.write && (
                                                              <>
                                                                <Button
                                                                  size="small"
                                                                  variant="outlined"
                                                                  color="primary"
                                                                  onClick={() => handleAddFindingFromRequirement(ar.requirementId)}
                                                                >
                                                                  Add Finding
                                                                </Button>
                                                                <IconButton 
                                                                  size="small" 
                                                                  onClick={() => handleRemoveRequirement(ar.requirementId)}
                                                                  title="Remove from Scope"
                                                                  color="error"
                                                                >
                                                                  <ArchiveIcon fontSize="small" />
                                                                </IconButton>
                                                              </>
                                                            )}
                                                          </Box>
                                                        </TableCell>
                                                      </TableRow>
                                                    ))}
                                                    {getFilteredRequirements().length === 0 && (
                                                      <TableRow>
                                                        <TableCell colSpan={6} align="center">
                                                          <Typography color="textSecondary" sx={{ py: 2 }}>
                                                            No requirements match the current filters
                                                          </Typography>
                                                        </TableCell>
                                                      </TableRow>
                                                    )}
                                                  </TableBody>
                                                </Table>
                                              </TableContainer>
                                            </Grid>
                                          </Grid>
                                        )}
                                      </TabPanel>

                                      {/* Findings & CAPA Tab */}
                                      <TabPanel value={activeTab} index={1}>
                                        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                                          <Typography variant="subtitle1">Audit Findings</Typography>
                                          {permissions?.write && (
                                            <Button
                                              variant="contained"
                                              onClick={handleOpenAddFindingModal}
                                              startIcon={<AddIcon />}
                                            >
                                              Add Finding
                                            </Button>
                                          )}
                                        </Box>
                                        {relatedDataLoading ? (
                                          <Box display="flex" justifyContent="center" p={3}>
                                            <CircularProgress />
                                          </Box>
                                        ) : findings.length === 0 ? (
                                          <Typography color="textSecondary" sx={{ p: 2 }}>No findings recorded for this audit. Click "Add Finding" to create a new finding.</Typography>
                                        ) : (
                                          <TableContainer component={Paper} variant="outlined">
                                            <Table size="small">
                                              <TableHead>
                                                <TableRow>
                                                  <TableCell>Finding Title</TableCell>
                                                  <TableCell>Status</TableCell>
                                                  <TableCell>Severity</TableCell>
                                                  <TableCell>Assigned To</TableCell>
                                                  <TableCell>Related Requirements</TableCell>
                                                  <TableCell>Actions</TableCell>
                                                </TableRow>
                                              </TableHead>
                                              <TableBody>
                                                {findings.map((finding) => (
                                                  <TableRow key={finding.id} hover>
                                                    <TableCell>
                                                      <Typography variant="body2" fontWeight="medium">
                                                        {finding.title}
                                                      </Typography>
                                                      {finding.dueDate && (
                                                        <Typography variant="caption" color="textSecondary">
                                                          Due: {new Date(finding.dueDate).toLocaleDateString()}
                                                        </Typography>
                                                      )}
                                                    </TableCell>
                                                    <TableCell>
                                                      <Chip 
                                                        label={finding.status.replace(/_/g, ' ')} 
                                                        size="small"
                                                        color={getStatusColor(finding.status)}
                                                        variant="outlined"
                                                      />
                                                    </TableCell>
                                                    <TableCell>
                                                      <Chip 
                                                        label={finding.severity} 
                                                        size="small"
                                                        color={getSeverityColor(finding.severity)}
                                                      />
                                                    </TableCell>
                                                    <TableCell>
                                                      {finding.owner?.firstName && finding.owner?.lastName
                                                        ? `${finding.owner.firstName} ${finding.owner.lastName}`
                                                        : <Typography variant="body2" color="textSecondary">Unassigned</Typography>}
                                                    </TableCell>
                                                    <TableCell>
                                                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                                        {finding.issueRequirements && finding.issueRequirements.length > 0 ? (
                                                          finding.issueRequirements.map((ir) => (
                                                            <Chip
                                                              key={ir.id}
                                                              label={ir.requirement?.referenceCode || 'Req'}
                                                              size="small"
                                                              variant="outlined"
                                                              color="primary"
                                                              onClick={() => {
                                                                const matchingAuditReq = auditRequirements.find(
                                                                  ar => ar.requirementId === ir.requirementId
                                                                );
                                                                if (matchingAuditReq) {
                                                                  handleOpenRequirementDrawer(matchingAuditReq);
                                                                }
                                                              }}
                                                              sx={{ cursor: 'pointer' }}
                                                            />
                                                          ))
                                                        ) : (
                                                          <Typography variant="body2" color="textSecondary">-</Typography>
                                                        )}
                                                      </Box>
                                                    </TableCell>
                                                    <TableCell>
                                                      <Box display="flex" gap={0.5}>
                                                        <Button
                                                          size="small"
                                                          variant="outlined"
                                                          onClick={() => navigate(`/findings/${finding.id}`)}
                                                        >
                                                          View
                                                        </Button>
                                                        {finding.capas && finding.capas.length > 0 && (
                                                          <Chip
                                                            label={`${finding.capas.length} CAPA${finding.capas.length > 1 ? 's' : ''}`}
                                                            size="small"
                                                            color="info"
                                                            variant="outlined"
                                                          />
                                                        )}
                                                      </Box>
                                                    </TableCell>
                                                  </TableRow>
                                                ))}
                                              </TableBody>
                                            </Table>
                                          </TableContainer>
                                        )}
                                      </TabPanel>

                                      {/* Reports Tab */}
                                      <TabPanel value={activeTab} index={2}>
                        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                          <Typography variant="subtitle1">Audit Reports</Typography>
                          <Button
                            variant="contained"
                            startIcon={generatingReport ? <CircularProgress size={20} color="inherit" /> : <ReportIcon />}
                            onClick={handleGenerateReport}
                            disabled={generatingReport}
                          >
                            {generatingReport ? 'Generating...' : 'Generate Report'}
                          </Button>
                        </Box>
                        {relatedDataLoading ? (
                          <Box display="flex" justifyContent="center" p={3}>
                            <CircularProgress />
                          </Box>
                        ) : reports.length === 0 ? (
                          <Typography color="textSecondary" sx={{ p: 2 }}>No reports generated for this audit yet. Click "Generate Report" to create one.</Typography>
                        ) : (
                          <TableContainer>
                            <Table size="small">
                              <TableHead>
                                <TableRow>
                                  <TableCell>Version</TableCell>
                                  <TableCell>Status</TableCell>
                                  <TableCell>Created By</TableCell>
                                  <TableCell>Created At</TableCell>
                                  <TableCell>Actions</TableCell>
                                </TableRow>
                              </TableHead>
                              <TableBody>
                                {reports.map((report) => (
                                  <TableRow key={report.id}>
                                    <TableCell>v{report.version}</TableCell>
                                    <TableCell>
                                      <Chip 
                                        label={report.status.replace(/_/g, ' ')} 
                                        size="small"
                                        color={getReportStatusColor(report.status)}
                                      />
                                    </TableCell>
                                    <TableCell>
                                      {report.created_by_first_name && report.created_by_last_name
                                        ? `${report.created_by_first_name} ${report.created_by_last_name}`
                                        : '-'}
                                    </TableCell>
                                    <TableCell>{new Date(report.created_at).toLocaleString()}</TableCell>
                                    <TableCell>
                                      <Box display="flex" gap={0.5}>
                                        <IconButton 
                                          size="small" 
                                          onClick={() => navigate(`/audits/${id}/reports/${report.id}`)}
                                          title="View Report"
                                        >
                                          <ViewIcon fontSize="small" />
                                        </IconButton>
                                        {report.status === 'draft' && (
                                          <IconButton 
                                            size="small" 
                                            onClick={() => handleReportStatusChange(report.id, 'under_review')}
                                            title="Submit for Review"
                                            disabled={reportActionLoading === report.id}
                                          >
                                            {reportActionLoading === report.id ? <CircularProgress size={16} /> : <SubmitIcon fontSize="small" />}
                                          </IconButton>
                                        )}
                                        {report.status === 'under_review' && (
                                          <IconButton 
                                            size="small" 
                                            onClick={() => handleReportStatusChange(report.id, 'final')}
                                            title="Finalize Report"
                                            disabled={reportActionLoading === report.id}
                                          >
                                            {reportActionLoading === report.id ? <CircularProgress size={16} /> : <FinalizeIcon fontSize="small" />}
                                          </IconButton>
                                        )}
                                        {report.status === 'final' && (
                                          <IconButton 
                                            size="small" 
                                            onClick={() => handleReportStatusChange(report.id, 'archived')}
                                            title="Archive Report"
                                            disabled={reportActionLoading === report.id}
                                          >
                                            {reportActionLoading === report.id ? <CircularProgress size={16} /> : <ArchiveIcon fontSize="small" />}
                                          </IconButton>
                                        )}
                                      </Box>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </TableContainer>
                        )}
                      </TabPanel>
                    </CardContent>
                  </Card>
                )}

        {permissions && (
          <Paper sx={{ mt: 2, p: 2, bgcolor: 'grey.100' }}>
            <Typography variant="caption" color="textSecondary">
              Your permissions: 
              {permissions.read && ' Read'}
              {permissions.write && ' | Write'}
              {permissions.delete && ' | Delete'}
              {permissions.maskedFields.length > 0 && ` | Masked fields: ${permissions.maskedFields.join(', ')}`}
              {permissions.deniedFields.length > 0 && ` | Denied fields: ${permissions.deniedFields.join(', ')}`}
            </Typography>
          </Paper>
        )}

        {/* Add Requirements Modal */}
        <Dialog 
          open={addRequirementModalOpen} 
          onClose={() => setAddRequirementModalOpen(false)}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>Add Requirements to Audit Scope</DialogTitle>
          <DialogContent>
            <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
              Select requirements to add to this audit's scope. Requirements already in scope will be skipped.
            </Typography>
            {availableRequirements.length === 0 ? (
              <Typography color="textSecondary">No requirements available.</Typography>
            ) : (
              <TableContainer sx={{ maxHeight: 400 }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell padding="checkbox">
                        <Checkbox
                          indeterminate={selectedRequirementIds.length > 0 && selectedRequirementIds.length < availableRequirements.length}
                          checked={selectedRequirementIds.length === availableRequirements.length}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedRequirementIds(availableRequirements.map(r => r.id));
                            } else {
                              setSelectedRequirementIds([]);
                            }
                          }}
                        />
                      </TableCell>
                      <TableCell>Framework</TableCell>
                      <TableCell>Reference Code</TableCell>
                      <TableCell>Title</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {availableRequirements.map((req) => {
                      const isSelected = selectedRequirementIds.includes(req.id);
                      const isAlreadyInScope = auditRequirements.some(ar => ar.requirementId === req.id);
                      return (
                        <TableRow 
                          key={req.id} 
                          hover 
                          onClick={() => {
                            if (isAlreadyInScope) return;
                            if (isSelected) {
                              setSelectedRequirementIds(prev => prev.filter(id => id !== req.id));
                            } else {
                              setSelectedRequirementIds(prev => [...prev, req.id]);
                            }
                          }}
                          sx={{ 
                            cursor: isAlreadyInScope ? 'not-allowed' : 'pointer',
                            opacity: isAlreadyInScope ? 0.5 : 1,
                          }}
                        >
                          <TableCell padding="checkbox">
                            <Checkbox 
                              checked={isSelected || isAlreadyInScope} 
                              disabled={isAlreadyInScope}
                            />
                          </TableCell>
                          <TableCell>
                            <Chip label={req.framework} size="small" variant="outlined" />
                          </TableCell>
                          <TableCell>{req.referenceCode}</TableCell>
                          <TableCell>
                            <ListItemText 
                              primary={req.title}
                              secondary={isAlreadyInScope ? 'Already in scope' : undefined}
                            />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setAddRequirementModalOpen(false)}>Cancel</Button>
            <Button 
              variant="contained" 
              onClick={handleAddRequirements}
              disabled={selectedRequirementIds.length === 0 || savingRequirements}
              startIcon={savingRequirements ? <CircularProgress size={20} color="inherit" /> : undefined}
            >
              {savingRequirements ? 'Adding...' : `Add ${selectedRequirementIds.length} Requirement(s)`}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Add Finding Modal */}
        <Dialog 
          open={addFindingModalOpen} 
          onClose={() => setAddFindingModalOpen(false)}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>Create Audit Finding</DialogTitle>
          <DialogContent>
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Title"
                  value={findingFormData.title}
                  onChange={(e) => setFindingFormData(prev => ({ ...prev, title: e.target.value }))}
                  required
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Description"
                  value={findingFormData.description}
                  onChange={(e) => setFindingFormData(prev => ({ ...prev, description: e.target.value }))}
                  multiline
                  rows={3}
                />
              </Grid>
              <Grid item xs={6}>
                <FormControl fullWidth>
                  <InputLabel>Severity</InputLabel>
                  <Select
                    value={findingFormData.severity}
                    label="Severity"
                    onChange={(e) => setFindingFormData(prev => ({ ...prev, severity: e.target.value as 'low' | 'medium' | 'high' | 'critical' }))}
                  >
                    <MenuItem value="low">Low</MenuItem>
                    <MenuItem value="medium">Medium</MenuItem>
                    <MenuItem value="high">High</MenuItem>
                    <MenuItem value="critical">Critical</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={6}>
                <FormControl fullWidth>
                  <InputLabel>Status</InputLabel>
                  <Select
                    value={findingFormData.status}
                    label="Status"
                    onChange={(e) => setFindingFormData(prev => ({ ...prev, status: e.target.value }))}
                  >
                    <MenuItem value="open">Open</MenuItem>
                    <MenuItem value="in_progress">In Progress</MenuItem>
                    <MenuItem value="resolved">Resolved</MenuItem>
                    <MenuItem value="closed">Closed</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={6}>
                <FormControl fullWidth>
                  <InputLabel>Owner</InputLabel>
                  <Select
                    value={findingFormData.ownerUserId}
                    label="Owner"
                    onChange={(e) => setFindingFormData(prev => ({ ...prev, ownerUserId: e.target.value }))}
                  >
                    <MenuItem value="">None</MenuItem>
                    {users.map(u => (
                      <MenuItem key={u.id} value={String(u.id)}>{u.first_name} {u.last_name}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  label="Due Date"
                  type="date"
                  value={findingFormData.dueDate}
                  onChange={(e) => setFindingFormData(prev => ({ ...prev, dueDate: e.target.value }))}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              {auditRequirements.length > 0 && (
                <Grid item xs={12}>
                  <FormControl fullWidth>
                    <InputLabel>Link to Requirements</InputLabel>
                    <Select
                      multiple
                      value={findingFormData.requirementIds}
                      label="Link to Requirements"
                      onChange={(e) => setFindingFormData(prev => ({ ...prev, requirementIds: e.target.value as string[] }))}
                      renderValue={(selected) => (
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                          {(selected as string[]).map((value) => {
                            const ar = auditRequirements.find(r => r.requirementId === value);
                            return (
                              <Chip 
                                key={value} 
                                label={ar?.requirement?.referenceCode || value} 
                                size="small" 
                              />
                            );
                          })}
                        </Box>
                      )}
                    >
                      {auditRequirements.map((ar) => (
                        <MenuItem key={ar.requirementId} value={ar.requirementId}>
                          <Checkbox checked={findingFormData.requirementIds.includes(ar.requirementId)} />
                          <ListItemText 
                            primary={ar.requirement?.title || ar.requirementId}
                            secondary={`${ar.requirement?.framework || ''} - ${ar.requirement?.referenceCode || ''}`}
                          />
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
              )}
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setAddFindingModalOpen(false)}>Cancel</Button>
            <Button 
              variant="contained" 
              onClick={handleAddFinding}
              disabled={!findingFormData.title.trim() || savingFinding}
              startIcon={savingFinding ? <CircularProgress size={20} color="inherit" /> : undefined}
            >
              {savingFinding ? 'Creating...' : 'Create Finding'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Requirement Detail Drawer */}
        <RequirementDetailDrawer
          open={requirementDrawerOpen}
          onClose={handleCloseRequirementDrawer}
          requirement={selectedRequirement ? {
            id: selectedRequirement.requirementId,
            framework: selectedRequirement.framework || '',
            referenceCode: selectedRequirement.referenceCode || '',
            title: selectedRequirement.title || '',
            description: selectedRequirement.description,
            category: selectedRequirement.category,
            priority: selectedRequirement.priority,
            status: selectedRequirement.status,
          } : null}
          onOpenFinding={handleOpenFinding}
          onAddFinding={handleAddFindingFromRequirement}
        />
      </Box>
    </ModuleGuard>
  );
};

export default AuditDetail;
