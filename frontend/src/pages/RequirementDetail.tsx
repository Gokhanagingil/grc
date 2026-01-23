import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Chip,
  Alert,
  Tabs,
  Tab,
  Paper,
  IconButton,
  Divider,
  CircularProgress,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import {
  Gavel as RequirementIcon,
  ArrowBack as BackIcon,
  Edit as EditIcon,
  Warning as RiskIcon,
  Security as ControlIcon,
} from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFnsV3';
import { requirementApi, unwrapResponse } from '../services/grcClient';
import { useAuth } from '../contexts/AuthContext';
import { LoadingState, ErrorState } from '../components/common';

interface Risk {
  id: string;
  title: string;
  severity: string;
  status: string;
}

interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
}

interface Requirement {
  id: string;
  title: string;
  description?: string;
  framework: string;
  referenceCode?: string;
  category?: string;
  status: string;
  dueDate?: string | null;
  evidence?: string;
  owner?: User;
  ownerUserId?: string;
  assignedTo?: User;
  assignedToUserId?: string;
  createdAt: string;
  updatedAt: string;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`requirement-tabpanel-${index}`}
      aria-labelledby={`requirement-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  );
}

const getStatusColor = (status: string): 'error' | 'warning' | 'info' | 'success' | 'default' => {
  switch (status?.toLowerCase()) {
    case 'verified': return 'success';
    case 'implemented': return 'info';
    case 'in_progress': return 'warning';
    case 'not_started': return 'default';
    case 'non_compliant': return 'error';
    default: return 'default';
  }
};

const formatStatus = (status: string): string => {
  if (!status) return '-';
  return status.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
};

const formatDate = (dateString: string | null | undefined): string => {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleDateString();
};

const formatFramework = (framework: string): string => {
  const frameworkLabels: Record<string, string> = {
    iso27001: 'ISO 27001',
    soc2: 'SOC 2',
    gdpr: 'GDPR',
    hipaa: 'HIPAA',
    pci_dss: 'PCI DSS',
    nist: 'NIST',
    other: 'Other',
  };
  return frameworkLabels[framework?.toLowerCase()] || framework || '-';
};

export const RequirementDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const tenantId = user?.tenantId || '';

  const [requirement, setRequirement] = useState<Requirement | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [tabValue, setTabValue] = useState(0);

  const [associatedRisks, setAssociatedRisks] = useState<Risk[]>([]);
  const [risksLoading, setRisksLoading] = useState(false);

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    framework: '',
    category: '',
    status: '',
    dueDate: null as Date | null,
    evidence: '',
  });

  const fetchRequirement = useCallback(async () => {
    if (!id || !tenantId) return;

    setLoading(true);
    setError(null);

    try {
      const response = await requirementApi.get(tenantId, id);
      const data = unwrapResponse<Requirement>(response);
      setRequirement(data);
    } catch (err) {
      console.error('Error fetching requirement:', err);
      setError('Failed to load requirement details. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [id, tenantId]);

  const fetchAssociatedRisks = useCallback(async () => {
    if (!id || !tenantId) return;

    setRisksLoading(true);
    try {
      const response = await requirementApi.getLinkedRisks(tenantId, id);
      const risks = unwrapResponse<Risk[]>(response) || [];
      setAssociatedRisks(risks);
    } catch (err) {
      console.error('Failed to fetch associated risks:', err);
      setAssociatedRisks([]);
    } finally {
      setRisksLoading(false);
    }
  }, [id, tenantId]);

  useEffect(() => {
    fetchRequirement();
  }, [fetchRequirement]);

  useEffect(() => {
    if (tabValue === 1) {
      fetchAssociatedRisks();
    }
  }, [tabValue, fetchAssociatedRisks]);

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleOpenEditDialog = () => {
    if (!requirement) return;
    setFormData({
      title: requirement.title || '',
      description: requirement.description || '',
      framework: requirement.framework || '',
      category: requirement.category || '',
      status: requirement.status || '',
      dueDate: requirement.dueDate ? new Date(requirement.dueDate) : null,
      evidence: requirement.evidence || '',
    });
    setEditDialogOpen(true);
  };

  const handleSaveRequirement = async () => {
    if (!id || !tenantId) return;

    setSaving(true);
    try {
      const requirementData = {
        title: formData.title,
        description: formData.description,
        framework: formData.framework,
        category: formData.category,
        status: formData.status,
        dueDate: formData.dueDate?.toISOString().split('T')[0],
      };

      await requirementApi.update(tenantId, id, requirementData);
      setSuccess('Requirement updated successfully');
      setEditDialogOpen(false);
      await fetchRequirement();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      setError(error.response?.data?.message || 'Failed to update requirement');
    } finally {
      setSaving(false);
    }
  };

  const isOverdue = (dueDate: string | null | undefined): boolean => {
    if (!dueDate) return false;
    return new Date(dueDate) < new Date();
  };

  if (loading) {
    return <LoadingState message="Loading requirement details..." />;
  }

  if (error && !requirement) {
    return <ErrorState message={error} onRetry={fetchRequirement} />;
  }

  if (!requirement) {
    return <ErrorState message="Requirement not found" />;
  }

  const ownerName = requirement.owner 
    ? `${requirement.owner.firstName || ''} ${requirement.owner.lastName || ''}`.trim() || requirement.owner.email
    : '-';
  
  const assignedToName = requirement.assignedTo
    ? `${requirement.assignedTo.firstName || ''} ${requirement.assignedTo.lastName || ''}`.trim() || requirement.assignedTo.email
    : '-';

  return (
    <Box sx={{ p: 3 }} data-testid="requirement-detail-page">
      <Box display="flex" alignItems="center" gap={2} mb={3}>
        <IconButton onClick={() => navigate('/compliance')} data-testid="back-button">
          <BackIcon />
        </IconButton>
        <Box flex={1}>
          <Typography variant="h4" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <RequirementIcon /> {requirement.title}
          </Typography>
          {requirement.referenceCode && (
            <Typography variant="body2" color="textSecondary" sx={{ mt: 0.5 }}>
              Reference: {requirement.referenceCode}
            </Typography>
          )}
        </Box>
        <Box display="flex" gap={1} alignItems="center">
          <Chip
            label={formatStatus(requirement.status)}
            color={getStatusColor(requirement.status)}
            size="medium"
          />
          {isOverdue(requirement.dueDate) && requirement.status !== 'verified' && (
            <Chip label="Overdue" color="error" size="medium" />
          )}
        </Box>
        <Button
          variant="outlined"
          startIcon={<EditIcon />}
          onClick={handleOpenEditDialog}
        >
          Edit
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Paper variant="outlined">
                <Tabs value={tabValue} onChange={handleTabChange}>
                  <Tab label="Overview" />
                  <Tab label={`Risks (${associatedRisks.length})`} icon={<RiskIcon />} iconPosition="start" />
                  <Tab label="Controls" icon={<ControlIcon />} iconPosition="start" />
                </Tabs>

                <TabPanel value={tabValue} index={0}>
                  <Box sx={{ p: 2 }}>
                    <Typography variant="h6" gutterBottom>Description</Typography>
                    <Typography variant="body1" paragraph>
                      {requirement.description || 'No description provided.'}
                    </Typography>

                    {requirement.evidence && (
                      <>
                        <Divider sx={{ my: 2 }} />
                        <Typography variant="h6" gutterBottom>Evidence Requirements</Typography>
                        <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                          {requirement.evidence}
                        </Typography>
                      </>
                    )}
                  </Box>
                </TabPanel>

                <TabPanel value={tabValue} index={1}>
                  <Box sx={{ p: 2 }}>
                    {risksLoading ? (
                      <Box display="flex" justifyContent="center" py={4}>
                        <CircularProgress />
                      </Box>
                    ) : associatedRisks.length === 0 ? (
                      <Typography color="textSecondary" align="center" py={2}>
                        No risks linked to this requirement
                      </Typography>
                    ) : (
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                        {associatedRisks.map((risk) => (
                          <Chip
                            key={risk.id}
                            label={`${risk.title} (${risk.severity})`}
                            color={risk.severity === 'critical' ? 'error' : risk.severity === 'high' ? 'warning' : 'default'}
                            variant="outlined"
                            onClick={() => navigate(`/risk?id=${risk.id}`)}
                            sx={{ cursor: 'pointer' }}
                          />
                        ))}
                      </Box>
                    )}
                  </Box>
                </TabPanel>

                <TabPanel value={tabValue} index={2}>
                  <Box sx={{ p: 2 }}>
                    <Typography color="textSecondary" align="center" py={2}>
                      Control mappings coming soon
                    </Typography>
                  </Box>
                </TabPanel>
              </Paper>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Details</Typography>
              <Divider sx={{ mb: 2 }} />

              <Box mb={2}>
                <Typography variant="subtitle2" color="textSecondary">Framework</Typography>
                <Typography>{formatFramework(requirement.framework)}</Typography>
              </Box>

              <Box mb={2}>
                <Typography variant="subtitle2" color="textSecondary">Category</Typography>
                <Typography>{requirement.category || '-'}</Typography>
              </Box>

              <Box mb={2}>
                <Typography variant="subtitle2" color="textSecondary">Status</Typography>
                <Chip
                  label={formatStatus(requirement.status)}
                  color={getStatusColor(requirement.status)}
                  size="small"
                />
              </Box>

              <Box mb={2}>
                <Typography variant="subtitle2" color="textSecondary">Owner</Typography>
                <Typography>{ownerName}</Typography>
              </Box>

              <Box mb={2}>
                <Typography variant="subtitle2" color="textSecondary">Assigned To</Typography>
                <Typography>{assignedToName}</Typography>
              </Box>

              <Box mb={2}>
                <Typography variant="subtitle2" color="textSecondary">Due Date</Typography>
                <Box display="flex" alignItems="center" gap={1}>
                  <Typography>{formatDate(requirement.dueDate)}</Typography>
                  {isOverdue(requirement.dueDate) && requirement.status !== 'verified' && (
                    <Chip label="Overdue" color="error" size="small" />
                  )}
                </Box>
              </Box>

              <Box mb={2}>
                <Typography variant="subtitle2" color="textSecondary">Created</Typography>
                <Typography>{formatDate(requirement.createdAt)}</Typography>
              </Box>

              <Box>
                <Typography variant="subtitle2" color="textSecondary">Last Updated</Typography>
                <Typography>{formatDate(requirement.updatedAt)}</Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Edit Requirement</DialogTitle>
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
                  value={formData.framework}
                  label="Framework"
                  onChange={(e) => setFormData({ ...formData, framework: e.target.value })}
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
                label="Evidence Requirements"
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
          <Button onClick={() => setEditDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleSaveRequirement} variant="contained" disabled={saving}>
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default RequirementDetail;
