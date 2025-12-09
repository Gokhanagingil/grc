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
} from '@mui/material';
import {
  Save as SaveIcon,
  ArrowBack as BackIcon,
  Edit as EditIcon,
  Lock as LockIcon,
  Visibility as ViewIcon,
} from '@mui/icons-material';
import { useNavigate, useParams } from 'react-router-dom';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { useAuth } from '../contexts/AuthContext';
import { LoadingState, ErrorState } from '../components/common';
import { ModuleGuard } from '../components/ModuleGuard';
import { useFormLayout } from '../hooks/useFormLayout';
import { useUiPolicy } from '../hooks/useUiPolicy';
import { api } from '../services/api';

interface Audit {
  id: number;
  name: string;
  description: string | null;
  audit_type: 'internal' | 'external';
  status: 'planned' | 'in_progress' | 'completed' | 'closed';
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  department: string | null;
  owner_id: number | null;
  lead_auditor_id: number | null;
  planned_start_date: string | null;
  planned_end_date: string | null;
  actual_start_date: string | null;
  actual_end_date: string | null;
  scope: string | null;
  objectives: string | null;
  methodology: string | null;
  findings_summary: string | null;
  recommendations: string | null;
  conclusion: string | null;
  owner_first_name?: string;
  owner_last_name?: string;
  owner_email?: string;
  lead_auditor_first_name?: string;
  lead_auditor_last_name?: string;
  lead_auditor_email?: string;
  created_at: string;
  updated_at: string;
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
  id: number;
  audit_id: number;
  title: string;
  description: string | null;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: string;
  owner_first_name?: string;
  owner_last_name?: string;
  capa_count: number;
  evidence_count: number;
  created_at: string;
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
  const isNew = id === 'new';
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
    const [criteria, setCriteria] = useState<AuditCriterion[]>([]);
    const [scopeObjects, setScopeObjects] = useState<ScopeObject[]>([]);
    const [relatedDataLoading, setRelatedDataLoading] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    audit_type: 'internal' as 'internal' | 'external',
    status: 'planned' as 'planned' | 'in_progress' | 'completed' | 'closed',
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
      const response = await api.get(`/api/grc/audits/${id}`);
      const auditData = response.data;
      setAudit(auditData);

      setFormData({
        name: auditData.name || '',
        description: auditData.description || '',
        audit_type: auditData.audit_type || 'internal',
        status: auditData.status || 'planned',
        risk_level: auditData.risk_level || 'medium',
        department: auditData.department || '',
        lead_auditor_id: auditData.lead_auditor_id,
        planned_start_date: auditData.planned_start_date ? new Date(auditData.planned_start_date) : null,
        planned_end_date: auditData.planned_end_date ? new Date(auditData.planned_end_date) : null,
        actual_start_date: auditData.actual_start_date ? new Date(auditData.actual_start_date) : null,
        actual_end_date: auditData.actual_end_date ? new Date(auditData.actual_end_date) : null,
        scope: auditData.scope || '',
        objectives: auditData.objectives || '',
        methodology: auditData.methodology || '',
        findings_summary: auditData.findings_summary || '',
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
      const response = await api.get(`/api/grc/audits/${id}/permissions`);
      setPermissions(response.data);
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
        const [findingsRes, criteriaRes, scopeRes] = await Promise.all([
          api.get(`/api/grc/audits/${id}/findings`),
          api.get(`/api/grc/audits/${id}/criteria`),
          api.get(`/api/grc/audits/${id}/scope-objects`)
        ]);
        setFindings(findingsRes.data || []);
        setCriteria(criteriaRes.data || []);
        setScopeObjects(scopeRes.data || []);
      } catch {
        setFindings([]);
        setCriteria([]);
        setScopeObjects([]);
      } finally {
        setRelatedDataLoading(false);
      }
    }, [id, isNew]);

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

      const payload = {
        ...formData,
        planned_start_date: formData.planned_start_date?.toISOString().split('T')[0] || null,
        planned_end_date: formData.planned_end_date?.toISOString().split('T')[0] || null,
        actual_start_date: formData.actual_start_date?.toISOString().split('T')[0] || null,
        actual_end_date: formData.actual_end_date?.toISOString().split('T')[0] || null,
      };

      if (isNew) {
        const response = await api.post('/api/grc/audits', payload);
        setSuccess('Audit created successfully');
        setTimeout(() => navigate(`/audits/${response.data.audit.id}`), 1500);
      } else {
        await api.put(`/api/grc/audits/${id}`, payload);
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

                {!isNew && audit && (
                  <Card sx={{ mb: 3 }}>
                    <CardContent>
                      <Typography variant="h6" gutterBottom>Audit Information</Typography>
                      <Grid container spacing={2}>
                        <Grid item xs={12} md={6}>
                          <Typography variant="body2" color="textSecondary">Owner</Typography>
                          <Typography>
                            {audit.owner_first_name && audit.owner_last_name
                              ? `${audit.owner_first_name} ${audit.owner_last_name}`
                              : 'Not assigned'}
                            {audit.owner_email && (
                              <Typography variant="body2" color="textSecondary" component="span">
                                {' '}({audit.owner_email})
                              </Typography>
                            )}
                          </Typography>
                        </Grid>
                        <Grid item xs={12} md={6}>
                          <Typography variant="body2" color="textSecondary">Lead Auditor</Typography>
                          <Typography>
                            {audit.lead_auditor_first_name && audit.lead_auditor_last_name
                              ? `${audit.lead_auditor_first_name} ${audit.lead_auditor_last_name}`
                              : 'Not assigned'}
                            {audit.lead_auditor_email && (
                              <Typography variant="body2" color="textSecondary" component="span">
                                {' '}({audit.lead_auditor_email})
                              </Typography>
                            )}
                          </Typography>
                        </Grid>
                        <Grid item xs={12} md={6}>
                          <Typography variant="body2" color="textSecondary">Created</Typography>
                          <Typography>{new Date(audit.created_at).toLocaleString()}</Typography>
                        </Grid>
                        <Grid item xs={12} md={6}>
                          <Typography variant="body2" color="textSecondary">Last Updated</Typography>
                          <Typography>{new Date(audit.updated_at).toLocaleString()}</Typography>
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
                          <Tab label={`Findings (${findings.length})`} />
                          <Tab label={`Criteria (${criteria.length})`} />
                          <Tab label={`Scope Objects (${scopeObjects.length})`} />
                        </Tabs>
                      </Box>

                      <TabPanel value={activeTab} index={0}>
                        {relatedDataLoading ? (
                          <Box display="flex" justifyContent="center" p={3}>
                            <CircularProgress />
                          </Box>
                        ) : findings.length === 0 ? (
                          <Typography color="textSecondary" sx={{ p: 2 }}>No findings recorded for this audit.</Typography>
                        ) : (
                          <TableContainer>
                            <Table size="small">
                              <TableHead>
                                <TableRow>
                                  <TableCell>Title</TableCell>
                                  <TableCell>Severity</TableCell>
                                  <TableCell>Status</TableCell>
                                  <TableCell>Owner</TableCell>
                                  <TableCell>CAPAs</TableCell>
                                  <TableCell>Evidence</TableCell>
                                  <TableCell>Actions</TableCell>
                                </TableRow>
                              </TableHead>
                              <TableBody>
                                {findings.map((finding) => (
                                  <TableRow key={finding.id}>
                                    <TableCell>{finding.title}</TableCell>
                                    <TableCell>
                                      <Chip 
                                        label={finding.severity} 
                                        size="small"
                                        color={
                                          finding.severity === 'critical' ? 'error' :
                                          finding.severity === 'high' ? 'warning' :
                                          finding.severity === 'medium' ? 'info' : 'default'
                                        }
                                      />
                                    </TableCell>
                                    <TableCell>
                                      <Chip 
                                        label={finding.status.replace(/_/g, ' ')} 
                                        size="small"
                                        variant="outlined"
                                      />
                                    </TableCell>
                                    <TableCell>
                                      {finding.owner_first_name && finding.owner_last_name
                                        ? `${finding.owner_first_name} ${finding.owner_last_name}`
                                        : '-'}
                                    </TableCell>
                                    <TableCell>{finding.capa_count}</TableCell>
                                    <TableCell>{finding.evidence_count}</TableCell>
                                    <TableCell>
                                      <IconButton 
                                        size="small" 
                                        onClick={() => navigate(`/findings/${finding.id}`)}
                                        title="View Finding"
                                      >
                                        <ViewIcon fontSize="small" />
                                      </IconButton>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </TableContainer>
                        )}
                      </TabPanel>

                      <TabPanel value={activeTab} index={1}>
                        {relatedDataLoading ? (
                          <Box display="flex" justifyContent="center" p={3}>
                            <CircularProgress />
                          </Box>
                        ) : criteria.length === 0 ? (
                          <Typography color="textSecondary" sx={{ p: 2 }}>No criteria linked to this audit.</Typography>
                        ) : (
                          <TableContainer>
                            <Table size="small">
                              <TableHead>
                                <TableRow>
                                  <TableCell>Title</TableCell>
                                  <TableCell>Regulation</TableCell>
                                  <TableCell>Category</TableCell>
                                  <TableCell>Status</TableCell>
                                </TableRow>
                              </TableHead>
                              <TableBody>
                                {criteria.map((criterion) => (
                                  <TableRow key={criterion.id}>
                                    <TableCell>{criterion.title}</TableCell>
                                    <TableCell>{criterion.regulation || '-'}</TableCell>
                                    <TableCell>{criterion.category || '-'}</TableCell>
                                    <TableCell>
                                      {criterion.status ? (
                                        <Chip label={criterion.status} size="small" variant="outlined" />
                                      ) : '-'}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </TableContainer>
                        )}
                      </TabPanel>

                      <TabPanel value={activeTab} index={2}>
                        {relatedDataLoading ? (
                          <Box display="flex" justifyContent="center" p={3}>
                            <CircularProgress />
                          </Box>
                        ) : scopeObjects.length === 0 ? (
                          <Typography color="textSecondary" sx={{ p: 2 }}>No scope objects defined for this audit.</Typography>
                        ) : (
                          <TableContainer>
                            <Table size="small">
                              <TableHead>
                                <TableRow>
                                  <TableCell>Object Type</TableCell>
                                  <TableCell>Object ID</TableCell>
                                  <TableCell>Name</TableCell>
                                </TableRow>
                              </TableHead>
                              <TableBody>
                                {scopeObjects.map((obj) => (
                                  <TableRow key={obj.id}>
                                    <TableCell>
                                      <Chip label={obj.object_type} size="small" variant="outlined" />
                                    </TableCell>
                                    <TableCell>{obj.object_id}</TableCell>
                                    <TableCell>{obj.object_name || '-'}</TableCell>
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
      </Box>
    </ModuleGuard>
  );
};

export default AuditDetail;
