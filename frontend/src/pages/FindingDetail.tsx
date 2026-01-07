import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Tooltip,
  Snackbar,
} from '@mui/material';
import {
  Save as SaveIcon,
  ArrowBack as BackIcon,
  Edit as EditIcon,
  Lock as LockIcon,
  CloudUpload as UploadIcon,
  Download as DownloadIcon,
  Share as ShareIcon,
  Delete as DeleteIcon,
  ContentCopy as CopyIcon,
  Add as AddIcon,
} from '@mui/icons-material';
import { useNavigate, useParams } from 'react-router-dom';
import { LoadingState, ErrorState } from '../components/common';
import { ModuleGuard } from '../components/ModuleGuard';
import { api } from '../services/api';

interface Finding {
  id: number;
  audit_id: number;
  title: string;
  description: string | null;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: string;
  root_cause: string | null;
  recommendation: string | null;
  management_response: string | null;
  owner_id: number | null;
  owner_first_name?: string;
  owner_last_name?: string;
  audit_name?: string;
  created_at: string;
  updated_at: string;
}

interface FindingPermissions {
  read: boolean;
  write: boolean;
  delete: boolean;
  maskedFields: string[];
  deniedFields: string[];
}

interface RelatedRisk {
  id: number;
  risk_id: number;
  relation_type: string;
  title: string;
  severity: string;
  status: string;
}

interface RelatedRequirement {
  id: number;
  requirement_id: number;
  title: string;
  regulation: string | null;
  status: string | null;
}

interface Evidence {
  id: number;
  title: string;
  description: string | null;
  type: string;
  storage_type: string;
  storage_ref: string | null;
  uploaded_at: string;
  file_name: string | null;
  mime_type: string | null;
  file_size: number | null;
  storage_path: string | null;
  checksum: string | null;
  deleted_at: string | null;
  uploaded_by_first_name?: string;
  uploaded_by_last_name?: string;
}

interface ShareLink {
  id: number;
  token: string;
  shareUrl: string;
  expiresAt: string;
  maxDownloads: number | null;
}

interface CAPA {
  id: number;
  title: string;
  description: string | null;
  type: string;
  status: string;
  validation_status: string;
  due_date: string | null;
  owner_first_name?: string;
  owner_last_name?: string;
}

interface User {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
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

const FINDING_STATUSES = [
  { value: 'draft', label: 'Draft' },
  { value: 'under_discussion', label: 'Under Discussion' },
  { value: 'action_agreed', label: 'Action Agreed' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'pending_validation', label: 'Pending Validation' },
  { value: 'closed', label: 'Closed' },
  { value: 'reopened', label: 'Reopened' },
];

const SEVERITY_OPTIONS = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' },
];

export const FindingDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNew = id === 'new';
  const isEditMode = window.location.pathname.endsWith('/edit') || isNew;

  const [finding, setFinding] = useState<Finding | null>(null);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [permissions, setPermissions] = useState<FindingPermissions | null>(null);
  const [users, setUsers] = useState<User[]>([]);

    const [activeTab, setActiveTab] = useState(0);
    const [relatedRisks, setRelatedRisks] = useState<RelatedRisk[]>([]);
    const [relatedRequirements, setRelatedRequirements] = useState<RelatedRequirement[]>([]);
    const [evidence, setEvidence] = useState<Evidence[]>([]);
    const [capas, setCapas] = useState<CAPA[]>([]);
    const [relatedDataLoading, setRelatedDataLoading] = useState(false);

    // Evidence upload/share state
    const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
    const [shareDialogOpen, setShareDialogOpen] = useState(false);
    const [selectedEvidence, setSelectedEvidence] = useState<Evidence | null>(null);
    const [uploading, setUploading] = useState(false);
    const [uploadFile, setUploadFile] = useState<File | null>(null);
    const [uploadTitle, setUploadTitle] = useState('');
    const [uploadDescription, setUploadDescription] = useState('');
    const [uploadType, setUploadType] = useState('document');
    const [shareExpiresAt, setShareExpiresAt] = useState('');
    const [shareMaxDownloads, setShareMaxDownloads] = useState<number | ''>('');
    const [createdShareLink, setCreatedShareLink] = useState<ShareLink | null>(null);
    const [snackbarOpen, setSnackbarOpen] = useState(false);
    const [snackbarMessage, setSnackbarMessage] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    severity: 'medium' as 'low' | 'medium' | 'high' | 'critical',
    status: 'draft',
    root_cause: '',
    recommendation: '',
    management_response: '',
    owner_id: null as number | null,
    audit_id: null as number | null,
  });

  const fetchFinding = useCallback(async () => {
    if (isNew) return;

    try {
      setLoading(true);
      setError('');
      const response = await api.get(`/grc/findings/${id}`);
      const findingData = response.data;
      setFinding(findingData);

      setFormData({
        title: findingData.title || '',
        description: findingData.description || '',
        severity: findingData.severity || 'medium',
        status: findingData.status || 'draft',
        root_cause: findingData.root_cause || '',
        recommendation: findingData.recommendation || '',
        management_response: findingData.management_response || '',
        owner_id: findingData.owner_id,
        audit_id: findingData.audit_id,
      });
    } catch (err: unknown) {
      const error = err as { response?: { status?: number; data?: { message?: string } } };
      if (error.response?.status === 403) {
        setError('You do not have permission to view this finding.');
      } else if (error.response?.status === 404) {
        setError('Finding not found.');
      } else {
        setError(error.response?.data?.message || 'Failed to fetch finding');
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
      const response = await api.get(`/grc/findings/${id}/permissions`);
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
      const [risksRes, reqsRes, evidenceRes, capasRes] = await Promise.all([
        api.get(`/grc/findings/${id}/risks`),
        api.get(`/grc/findings/${id}/requirements`),
        api.get(`/grc/evidence?finding_id=${id}`),
        api.get(`/grc/capas?finding_id=${id}`)
      ]);
      setRelatedRisks(risksRes.data || []);
      setRelatedRequirements(reqsRes.data || []);
      setEvidence(evidenceRes.data?.results || evidenceRes.data || []);
      setCapas(capasRes.data?.results || capasRes.data || []);
    } catch {
      setRelatedRisks([]);
      setRelatedRequirements([]);
      setEvidence([]);
      setCapas([]);
    } finally {
      setRelatedDataLoading(false);
    }
  }, [id, isNew]);

  useEffect(() => {
    fetchFinding();
    fetchPermissions();
    fetchUsers();
    fetchRelatedData();
  }, [fetchFinding, fetchPermissions, fetchUsers, fetchRelatedData]);

  const handleSave = async () => {
    if (!formData.title.trim()) {
      setError('Title is required');
      return;
    }

    try {
      setSaving(true);
      setError('');

      if (isNew) {
        const response = await api.post('/grc/findings', formData);
        setSuccess('Finding created successfully');
        setTimeout(() => navigate(`/findings/${response.data.finding.id}`), 1500);
      } else {
        await api.put(`/grc/findings/${id}`, formData);
        setSuccess('Finding updated successfully');
        setTimeout(() => {
          setSuccess('');
          navigate(`/findings/${id}`);
        }, 1500);
      }
    } catch (err: unknown) {
      const error = err as { response?: { status?: number; data?: { message?: string } } };
      if (error.response?.status === 403) {
        setError('You do not have permission to save this finding.');
      } else {
        setError(error.response?.data?.message || 'Failed to save finding');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleFieldChange = (field: string, value: unknown) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

    const isFieldReadonly = (fieldName: string): boolean => {
      if (!isEditMode) return true;
      if (!permissions?.write) return true;
      if (permissions?.deniedFields?.includes(fieldName)) return true;
      return false;
    };

    // Evidence upload handlers
    const handleOpenUploadDialog = () => {
      setUploadFile(null);
      setUploadTitle('');
      setUploadDescription('');
      setUploadType('document');
      setUploadDialogOpen(true);
    };

    const handleCloseUploadDialog = () => {
      setUploadDialogOpen(false);
      setUploadFile(null);
      setUploadTitle('');
      setUploadDescription('');
      setUploadType('document');
    };

    const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) {
        setUploadFile(file);
        if (!uploadTitle) {
          setUploadTitle(file.name.replace(/\.[^/.]+$/, ''));
        }
      }
    };

    const handleUploadEvidence = async () => {
      if (!uploadFile || !uploadTitle.trim()) {
        setError('Please select a file and provide a title');
        return;
      }

      try {
        setUploading(true);
        setError('');

        const formData = new FormData();
        formData.append('file', uploadFile);
        formData.append('title', uploadTitle);
        formData.append('description', uploadDescription);
        formData.append('type', uploadType);
        formData.append('finding_id', id || '');

        await api.post('/grc/evidence/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });

        setSuccess('Evidence uploaded successfully');
        handleCloseUploadDialog();
        fetchRelatedData();
      } catch (err: unknown) {
        const error = err as { response?: { data?: { message?: string } } };
        setError(error.response?.data?.message || 'Failed to upload evidence');
      } finally {
        setUploading(false);
      }
    };

    const handleDownloadEvidence = async (ev: Evidence) => {
      if (!ev.storage_path) {
        setError('No file attached to this evidence');
        return;
      }

      try {
        const response = await api.get(`/grc/evidence/${ev.id}/download`, {
          responseType: 'blob'
        });

        const blob = new Blob([response.data], { type: ev.mime_type || 'application/octet-stream' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = ev.file_name || 'download';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      } catch (err: unknown) {
        const error = err as { response?: { data?: { message?: string } } };
        setError(error.response?.data?.message || 'Failed to download evidence');
      }
    };

    const handleDeleteEvidence = async (ev: Evidence) => {
      if (!window.confirm(`Are you sure you want to delete "${ev.title}"?`)) {
        return;
      }

      try {
        await api.delete(`/grc/evidence/${ev.id}/soft`);
        setSuccess('Evidence deleted successfully');
        fetchRelatedData();
      } catch (err: unknown) {
        const error = err as { response?: { data?: { message?: string } } };
        setError(error.response?.data?.message || 'Failed to delete evidence');
      }
    };

    // Share link handlers
    const handleOpenShareDialog = (ev: Evidence) => {
      setSelectedEvidence(ev);
      const defaultExpiry = new Date();
      defaultExpiry.setDate(defaultExpiry.getDate() + 7);
      setShareExpiresAt(defaultExpiry.toISOString().slice(0, 16));
      setShareMaxDownloads('');
      setCreatedShareLink(null);
      setShareDialogOpen(true);
    };

    const handleCloseShareDialog = () => {
      setShareDialogOpen(false);
      setSelectedEvidence(null);
      setCreatedShareLink(null);
    };

    const handleCreateShareLink = async () => {
      if (!selectedEvidence || !shareExpiresAt) {
        setError('Please set an expiration date');
        return;
      }

      try {
        const response = await api.post(`/grc/evidence/${selectedEvidence.id}/share`, {
          expiresAt: new Date(shareExpiresAt).toISOString(),
          maxDownloads: shareMaxDownloads || null
        });

        setCreatedShareLink(response.data.share);
        setSuccess('Share link created successfully');
      } catch (err: unknown) {
        const error = err as { response?: { data?: { message?: string } } };
        setError(error.response?.data?.message || 'Failed to create share link');
      }
    };

    const handleCopyShareLink = () => {
      if (createdShareLink) {
        const fullUrl = `${window.location.origin}${createdShareLink.shareUrl}`;
        navigator.clipboard.writeText(fullUrl);
        setSnackbarMessage('Share link copied to clipboard');
        setSnackbarOpen(true);
      }
    };

    const formatFileSize = (bytes: number | null): string => {
      if (!bytes) return '-';
      if (bytes < 1024) return `${bytes} B`;
      if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    const EVIDENCE_TYPES = [
      { value: 'document', label: 'Document' },
      { value: 'screenshot', label: 'Screenshot' },
      { value: 'log', label: 'Log' },
      { value: 'config', label: 'Configuration' },
      { value: 'ticket', label: 'Ticket' },
      { value: 'interview', label: 'Interview' },
      { value: 'observation', label: 'Observation' },
    ];

    if (loading) {
    return (
      <ModuleGuard moduleKey="audit">
        <LoadingState message="Loading finding..." />
      </ModuleGuard>
    );
  }

  if (error && !finding && !isNew) {
    return (
      <ModuleGuard moduleKey="audit">
        <ErrorState
          title="Failed to load finding"
          message={error}
          onRetry={fetchFinding}
        />
      </ModuleGuard>
    );
  }

  return (
    <ModuleGuard moduleKey="audit">
      <Box>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Box display="flex" alignItems="center" gap={2}>
            <Button startIcon={<BackIcon />} onClick={() => finding?.audit_id ? navigate(`/audits/${finding.audit_id}`) : navigate('/audits')}>
              Back to Audit
            </Button>
            <Typography variant="h4">
              {isNew ? 'New Finding' : isEditMode ? 'Edit Finding' : finding?.title}
            </Typography>
            {finding && !isEditMode && (
              <>
                <Chip
                  label={finding.severity}
                  size="small"
                  color={
                    finding.severity === 'critical' ? 'error' :
                    finding.severity === 'high' ? 'warning' :
                    finding.severity === 'medium' ? 'info' : 'default'
                  }
                />
                <Chip
                  label={finding.status.replace(/_/g, ' ')}
                  size="small"
                  variant="outlined"
                />
              </>
            )}
          </Box>
          <Box display="flex" gap={2}>
            {!isEditMode && permissions?.write && (
              <Button
                variant="contained"
                startIcon={<EditIcon />}
                onClick={() => navigate(`/findings/${id}/edit`)}
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

        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>Finding Details</Typography>
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Title"
                  value={formData.title}
                  onChange={(e) => handleFieldChange('title', e.target.value)}
                  disabled={isFieldReadonly('title')}
                  required
                  InputProps={{
                    endAdornment: isFieldReadonly('title') ? <LockIcon sx={{ color: 'text.disabled', fontSize: 16 }} /> : undefined,
                  }}
                />
              </Grid>
              <Grid item xs={12} md={3}>
                <FormControl fullWidth disabled={isFieldReadonly('severity')}>
                  <InputLabel>Severity</InputLabel>
                  <Select
                    value={formData.severity}
                    label="Severity"
                    onChange={(e) => handleFieldChange('severity', e.target.value)}
                  >
                    {SEVERITY_OPTIONS.map(opt => (
                      <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={3}>
                <FormControl fullWidth disabled={isFieldReadonly('status')}>
                  <InputLabel>Status</InputLabel>
                  <Select
                    value={formData.status}
                    label="Status"
                    onChange={(e) => handleFieldChange('status', e.target.value)}
                  >
                    {FINDING_STATUSES.map(opt => (
                      <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth disabled={isFieldReadonly('owner_id')}>
                  <InputLabel>Owner</InputLabel>
                  <Select
                    value={formData.owner_id || ''}
                    label="Owner"
                    onChange={(e) => handleFieldChange('owner_id', e.target.value || null)}
                  >
                    <MenuItem value="">None</MenuItem>
                    {users.map(u => (
                      <MenuItem key={u.id} value={u.id}>{u.first_name} {u.last_name}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={6}>
                {finding?.audit_name && (
                  <TextField
                    fullWidth
                    label="Audit"
                    value={finding.audit_name}
                    disabled
                    InputProps={{
                      endAdornment: <LockIcon sx={{ color: 'text.disabled', fontSize: 16 }} />,
                    }}
                  />
                )}
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Description"
                  value={formData.description}
                  onChange={(e) => handleFieldChange('description', e.target.value)}
                  disabled={isFieldReadonly('description')}
                  multiline
                  rows={3}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Root Cause"
                  value={formData.root_cause}
                  onChange={(e) => handleFieldChange('root_cause', e.target.value)}
                  disabled={isFieldReadonly('root_cause')}
                  multiline
                  rows={2}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Recommendation"
                  value={formData.recommendation}
                  onChange={(e) => handleFieldChange('recommendation', e.target.value)}
                  disabled={isFieldReadonly('recommendation')}
                  multiline
                  rows={2}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Management Response"
                  value={formData.management_response}
                  onChange={(e) => handleFieldChange('management_response', e.target.value)}
                  disabled={isFieldReadonly('management_response')}
                  multiline
                  rows={2}
                />
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {!isNew && finding && !isEditMode && (
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
                <Tabs value={activeTab} onChange={(_, newValue) => setActiveTab(newValue)}>
                  <Tab label={`Related Risks (${relatedRisks.length})`} />
                  <Tab label={`Breached Requirements (${relatedRequirements.length})`} />
                  <Tab label={`Evidence (${evidence.length})`} />
                  <Tab label={`CAPAs (${capas.length})`} />
                </Tabs>
              </Box>

              <TabPanel value={activeTab} index={0}>
                {relatedDataLoading ? (
                  <Box display="flex" justifyContent="center" p={3}>
                    <CircularProgress />
                  </Box>
                ) : relatedRisks.length === 0 ? (
                  <Typography color="textSecondary" sx={{ p: 2 }}>No related risks linked to this finding.</Typography>
                ) : (
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Title</TableCell>
                          <TableCell>Relation Type</TableCell>
                          <TableCell>Severity</TableCell>
                          <TableCell>Status</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {relatedRisks.map((risk) => (
                          <TableRow key={risk.id}>
                            <TableCell>{risk.title}</TableCell>
                            <TableCell>
                              <Chip label={risk.relation_type || 'related'} size="small" variant="outlined" />
                            </TableCell>
                            <TableCell>
                              <Chip 
                                label={risk.severity} 
                                size="small"
                                color={
                                  risk.severity === 'critical' ? 'error' :
                                  risk.severity === 'high' ? 'warning' :
                                  risk.severity === 'medium' ? 'info' : 'default'
                                }
                              />
                            </TableCell>
                            <TableCell>{risk.status}</TableCell>
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
                ) : relatedRequirements.length === 0 ? (
                  <Typography color="textSecondary" sx={{ p: 2 }}>No breached requirements linked to this finding.</Typography>
                ) : (
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Title</TableCell>
                          <TableCell>Regulation</TableCell>
                          <TableCell>Status</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {relatedRequirements.map((req) => (
                          <TableRow key={req.id}>
                            <TableCell>{req.title}</TableCell>
                            <TableCell>{req.regulation || '-'}</TableCell>
                            <TableCell>
                              {req.status ? (
                                <Chip label={req.status} size="small" variant="outlined" />
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
                              <Box display="flex" justifyContent="flex-end" mb={2}>
                                <Button
                                  variant="contained"
                                  startIcon={<AddIcon />}
                                  onClick={handleOpenUploadDialog}
                                  size="small"
                                >
                                  Add Evidence
                                </Button>
                              </Box>
                              {relatedDataLoading ? (
                                <Box display="flex" justifyContent="center" p={3}>
                                  <CircularProgress />
                                </Box>
                              ) : evidence.length === 0 ? (
                                <Typography color="textSecondary" sx={{ p: 2 }}>No evidence attached to this finding.</Typography>
                              ) : (
                                <TableContainer>
                                  <Table size="small">
                                    <TableHead>
                                      <TableRow>
                                        <TableCell>File Name</TableCell>
                                        <TableCell>Type</TableCell>
                                        <TableCell>Size</TableCell>
                                        <TableCell>Uploaded By</TableCell>
                                        <TableCell>Uploaded</TableCell>
                                        <TableCell align="right">Actions</TableCell>
                                      </TableRow>
                                    </TableHead>
                                    <TableBody>
                                      {evidence.filter(ev => !ev.deleted_at).map((ev) => (
                                        <TableRow key={ev.id}>
                                          <TableCell>
                                            <Box>
                                              <Typography variant="body2">{ev.title}</Typography>
                                              {ev.file_name && (
                                                <Typography variant="caption" color="textSecondary">
                                                  {ev.file_name}
                                                </Typography>
                                              )}
                                            </Box>
                                          </TableCell>
                                          <TableCell>
                                            <Chip label={ev.type} size="small" variant="outlined" />
                                          </TableCell>
                                          <TableCell>{formatFileSize(ev.file_size)}</TableCell>
                                          <TableCell>
                                            {ev.uploaded_by_first_name && ev.uploaded_by_last_name
                                              ? `${ev.uploaded_by_first_name} ${ev.uploaded_by_last_name}`
                                              : '-'}
                                          </TableCell>
                                          <TableCell>{new Date(ev.uploaded_at).toLocaleDateString()}</TableCell>
                                          <TableCell align="right">
                                            <Box display="flex" justifyContent="flex-end" gap={0.5}>
                                              {ev.storage_path && (
                                                <Tooltip title="Download">
                                                  <IconButton
                                                    size="small"
                                                    onClick={() => handleDownloadEvidence(ev)}
                                                  >
                                                    <DownloadIcon fontSize="small" />
                                                  </IconButton>
                                                </Tooltip>
                                              )}
                                              {ev.storage_path && (
                                                <Tooltip title="Get Share Link">
                                                  <IconButton
                                                    size="small"
                                                    onClick={() => handleOpenShareDialog(ev)}
                                                  >
                                                    <ShareIcon fontSize="small" />
                                                  </IconButton>
                                                </Tooltip>
                                              )}
                                              <Tooltip title="Delete">
                                                <IconButton
                                                  size="small"
                                                  color="error"
                                                  onClick={() => handleDeleteEvidence(ev)}
                                                >
                                                  <DeleteIcon fontSize="small" />
                                                </IconButton>
                                              </Tooltip>
                                            </Box>
                                          </TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                </TableContainer>
                              )}
                            </TabPanel>

              <TabPanel value={activeTab} index={3}>
                {relatedDataLoading ? (
                  <Box display="flex" justifyContent="center" p={3}>
                    <CircularProgress />
                  </Box>
                ) : capas.length === 0 ? (
                  <Typography color="textSecondary" sx={{ p: 2 }}>No CAPAs created for this finding.</Typography>
                ) : (
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Title</TableCell>
                          <TableCell>Type</TableCell>
                          <TableCell>Status</TableCell>
                          <TableCell>Validation</TableCell>
                          <TableCell>Due Date</TableCell>
                          <TableCell>Owner</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {capas.map((capa) => (
                          <TableRow key={capa.id}>
                            <TableCell>{capa.title}</TableCell>
                            <TableCell>
                              <Chip 
                                label={capa.type} 
                                size="small" 
                                color={
                                  capa.type === 'corrective' ? 'primary' :
                                  capa.type === 'preventive' ? 'secondary' : 'default'
                                }
                              />
                            </TableCell>
                            <TableCell>
                              <Chip 
                                label={capa.status.replace(/_/g, ' ')} 
                                size="small"
                                color={
                                  capa.status === 'overdue' ? 'error' :
                                  capa.status === 'implemented' ? 'success' :
                                  capa.status === 'in_progress' ? 'primary' : 'default'
                                }
                                variant="outlined"
                              />
                            </TableCell>
                            <TableCell>
                              <Chip 
                                label={capa.validation_status.replace(/_/g, ' ')} 
                                size="small"
                                color={
                                  capa.validation_status === 'validated' ? 'success' :
                                  capa.validation_status === 'rejected' ? 'error' : 'default'
                                }
                                variant="outlined"
                              />
                            </TableCell>
                            <TableCell>
                              {capa.due_date ? new Date(capa.due_date).toLocaleDateString() : '-'}
                            </TableCell>
                            <TableCell>
                              {capa.owner_first_name && capa.owner_last_name
                                ? `${capa.owner_first_name} ${capa.owner_last_name}`
                                : '-'}
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

        {!isNew && finding && (
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Finding Information</Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <Typography variant="body2" color="textSecondary">Owner</Typography>
                  <Typography>
                    {finding.owner_first_name && finding.owner_last_name
                      ? `${finding.owner_first_name} ${finding.owner_last_name}`
                      : 'Not assigned'}
                  </Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="body2" color="textSecondary">Audit</Typography>
                  <Typography>{finding.audit_name || 'Unknown'}</Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="body2" color="textSecondary">Created</Typography>
                  <Typography>{new Date(finding.created_at).toLocaleString()}</Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="body2" color="textSecondary">Last Updated</Typography>
                  <Typography>{new Date(finding.updated_at).toLocaleString()}</Typography>
                </Grid>
              </Grid>
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
              {(permissions.maskedFields?.length ?? 0) > 0 && ` | Masked fields: ${permissions.maskedFields.join(', ')}`}
              {(permissions.deniedFields?.length ?? 0) > 0 && ` | Denied fields: ${permissions.deniedFields.join(', ')}`}
            </Typography>
          </Paper>
        )}

        {/* Upload Evidence Dialog */}
        <Dialog open={uploadDialogOpen} onClose={handleCloseUploadDialog} maxWidth="sm" fullWidth>
          <DialogTitle>Add Evidence</DialogTitle>
          <DialogContent>
            <Box sx={{ pt: 1 }}>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                style={{ display: 'none' }}
              />
              <Button
                variant="outlined"
                startIcon={<UploadIcon />}
                onClick={() => fileInputRef.current?.click()}
                fullWidth
                sx={{ mb: 2 }}
              >
                {uploadFile ? uploadFile.name : 'Select File'}
              </Button>
              <TextField
                fullWidth
                label="Title"
                value={uploadTitle}
                onChange={(e) => setUploadTitle(e.target.value)}
                required
                sx={{ mb: 2 }}
              />
              <TextField
                fullWidth
                label="Description"
                value={uploadDescription}
                onChange={(e) => setUploadDescription(e.target.value)}
                multiline
                rows={2}
                sx={{ mb: 2 }}
              />
              <FormControl fullWidth>
                <InputLabel>Type</InputLabel>
                <Select
                  value={uploadType}
                  label="Type"
                  onChange={(e) => setUploadType(e.target.value)}
                >
                  {EVIDENCE_TYPES.map(t => (
                    <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseUploadDialog}>Cancel</Button>
            <Button
              variant="contained"
              onClick={handleUploadEvidence}
              disabled={uploading || !uploadFile || !uploadTitle.trim()}
              startIcon={uploading ? <CircularProgress size={20} /> : <UploadIcon />}
            >
              {uploading ? 'Uploading...' : 'Upload'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Share Link Dialog */}
        <Dialog open={shareDialogOpen} onClose={handleCloseShareDialog} maxWidth="sm" fullWidth>
          <DialogTitle>Get Share Link</DialogTitle>
          <DialogContent>
            <Box sx={{ pt: 1 }}>
              {selectedEvidence && (
                <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                  Creating share link for: <strong>{selectedEvidence.title}</strong>
                </Typography>
              )}
              {!createdShareLink ? (
                <>
                  <TextField
                    fullWidth
                    label="Expires At"
                    type="datetime-local"
                    value={shareExpiresAt}
                    onChange={(e) => setShareExpiresAt(e.target.value)}
                    InputLabelProps={{ shrink: true }}
                    required
                    sx={{ mb: 2 }}
                  />
                  <TextField
                    fullWidth
                    label="Max Downloads (optional)"
                    type="number"
                    value={shareMaxDownloads}
                    onChange={(e) => setShareMaxDownloads(e.target.value ? parseInt(e.target.value) : '')}
                    inputProps={{ min: 1 }}
                    helperText="Leave empty for unlimited downloads"
                  />
                </>
              ) : (
                <Box>
                  <Alert severity="success" sx={{ mb: 2 }}>
                    Share link created successfully!
                  </Alert>
                  <TextField
                    fullWidth
                    label="Share URL"
                    value={`${window.location.origin}${createdShareLink.shareUrl}`}
                    InputProps={{
                      readOnly: true,
                      endAdornment: (
                        <IconButton onClick={handleCopyShareLink} size="small">
                          <CopyIcon />
                        </IconButton>
                      ),
                    }}
                    sx={{ mb: 2 }}
                  />
                  <Typography variant="body2" color="textSecondary">
                    Expires: {new Date(createdShareLink.expiresAt).toLocaleString()}
                    {createdShareLink.maxDownloads && ` | Max downloads: ${createdShareLink.maxDownloads}`}
                  </Typography>
                </Box>
              )}
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseShareDialog}>
              {createdShareLink ? 'Close' : 'Cancel'}
            </Button>
            {!createdShareLink && (
              <Button
                variant="contained"
                onClick={handleCreateShareLink}
                disabled={!shareExpiresAt}
                startIcon={<ShareIcon />}
              >
                Create Link
              </Button>
            )}
          </DialogActions>
        </Dialog>

        {/* Snackbar for copy confirmation */}
        <Snackbar
          open={snackbarOpen}
          autoHideDuration={3000}
          onClose={() => setSnackbarOpen(false)}
          message={snackbarMessage}
        />
      </Box>
    </ModuleGuard>
  );
};

export default FindingDetail;
