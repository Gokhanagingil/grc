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
  Button,
  IconButton,
  Divider,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  Warning as ViolationIcon,
  ArrowBack as BackIcon,
  Edit as EditIcon,
  History as HistoryIcon,
  Info as InfoIcon,
} from '@mui/icons-material';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  processViolationApi,
  unwrapResponse,
} from '../services/grcClient';
import { useAuth } from '../contexts/AuthContext';
import { LoadingState, ErrorState } from '../components/common';

interface ProcessViolation {
  id: string;
  tenantId: string;
  controlResultId: string;
  processId: string;
  controlId: string;
  severity: string;
  status: string;
  description: string | null;
  remediationPlan: string | null;
  remediationDeadline: string | null;
  resolvedAt: string | null;
  resolvedBy: string | null;
  createdAt: string;
  updatedAt: string;
  process?: {
    id: string;
    name: string;
    code: string;
  };
  control?: {
    id: string;
    name: string;
  };
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
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  );
}

const SEVERITY_OPTIONS = ['low', 'medium', 'high', 'critical'];
const STATUS_OPTIONS = ['open', 'in_progress', 'resolved', 'accepted'];

const getSeverityColor = (severity: string): 'error' | 'warning' | 'info' | 'success' | 'default' => {
  switch (severity?.toLowerCase()) {
    case 'critical': return 'error';
    case 'high': return 'warning';
    case 'medium': return 'info';
    case 'low': return 'success';
    default: return 'default';
  }
};

const getStatusColor = (status: string): 'error' | 'warning' | 'info' | 'success' | 'default' => {
  switch (status?.toLowerCase()) {
    case 'open': return 'error';
    case 'in_progress': return 'warning';
    case 'resolved': return 'success';
    case 'accepted': return 'info';
    default: return 'default';
  }
};

const formatStatus = (status: string): string => {
  if (!status) return '-';
  return status.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
};

const formatDate = (dateString: string | null | undefined): string => {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleDateString();
};

const formatDateTime = (dateString: string | null | undefined): string => {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleString();
};

export const ViolationDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const tenantId = user?.tenantId || '';

  const [violation, setViolation] = useState<ProcessViolation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [tabValue, setTabValue] = useState(0);
  const [saving, setSaving] = useState(false);

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    severity: '',
    status: '',
    description: '',
    remediationPlan: '',
    remediationDeadline: '',
  });

  const fetchViolation = useCallback(async () => {
    if (!id || !tenantId) return;

    setLoading(true);
    setError(null);

    try {
      const response = await processViolationApi.get(tenantId, id);
      const data = unwrapResponse<ProcessViolation>(response);
      setViolation(data);
      setFormData({
        severity: data.severity,
        status: data.status,
        description: data.description || '',
        remediationPlan: data.remediationPlan || '',
        remediationDeadline: data.remediationDeadline ? data.remediationDeadline.split('T')[0] : '',
      });
    } catch (err) {
      console.error('Error fetching violation:', err);
      setError('Failed to load violation details. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [id, tenantId]);

  useEffect(() => {
    fetchViolation();
  }, [fetchViolation]);

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleSaveViolation = async () => {
    if (!tenantId || !id) {
      setError('Violation context is required');
      return;
    }

    setSaving(true);
    try {
      const updateData: Record<string, unknown> = {
        severity: formData.severity,
        status: formData.status,
        description: formData.description || undefined,
        remediationPlan: formData.remediationPlan || undefined,
        remediationDeadline: formData.remediationDeadline || undefined,
      };

      if (formData.status === 'resolved' && violation?.status !== 'resolved') {
        updateData.resolvedAt = new Date().toISOString();
        updateData.resolvedBy = user?.id;
      }

      await processViolationApi.update(tenantId, id, updateData);
      setSuccess('Violation updated successfully');
      setEditDialogOpen(false);
      fetchViolation();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      setError(error.response?.data?.message || 'Failed to update violation');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <LoadingState message="Loading violation details..." />;
  }

  if (error && !violation) {
    return <ErrorState message={error} onRetry={fetchViolation} />;
  }

  if (!violation) {
    return <ErrorState message="Violation not found" />;
  }

  return (
    <Box sx={{ p: 3 }} data-testid="violation-detail-page">
      <Box display="flex" alignItems="center" gap={2} mb={3}>
        <IconButton onClick={() => navigate('/violations')} data-testid="back-button">
          <BackIcon />
        </IconButton>
        <Box flex={1}>
          <Typography variant="h4" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <ViolationIcon color="warning" /> Process Violation
          </Typography>
          <Typography variant="subtitle1" color="text.secondary">
            ID: {violation.id.slice(0, 8)}...
          </Typography>
        </Box>
        <Chip
          label={formatStatus(violation.severity)}
          color={getSeverityColor(violation.severity)}
        />
        <Chip
          label={formatStatus(violation.status)}
          color={getStatusColor(violation.status)}
        />
        <Button
          variant="outlined"
          startIcon={<EditIcon />}
          onClick={() => setEditDialogOpen(true)}
        >
          Edit
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>{success}</Alert>}

      <Paper sx={{ width: '100%' }}>
        <Tabs value={tabValue} onChange={handleTabChange}>
          <Tab icon={<InfoIcon />} label="Overview" iconPosition="start" />
          <Tab icon={<HistoryIcon />} label="Timeline" iconPosition="start" />
        </Tabs>

        <TabPanel value={tabValue} index={0}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>Violation Details</Typography>
                  <Divider sx={{ mb: 2 }} />
                  <Grid container spacing={2}>
                    <Grid item xs={4}><Typography color="text.secondary">Severity</Typography></Grid>
                    <Grid item xs={8}>
                      <Chip
                        label={formatStatus(violation.severity)}
                        size="small"
                        color={getSeverityColor(violation.severity)}
                      />
                    </Grid>
                    <Grid item xs={4}><Typography color="text.secondary">Status</Typography></Grid>
                    <Grid item xs={8}>
                      <Chip
                        label={formatStatus(violation.status)}
                        size="small"
                        color={getStatusColor(violation.status)}
                      />
                    </Grid>
                    <Grid item xs={4}><Typography color="text.secondary">Process</Typography></Grid>
                    <Grid item xs={8}>
                      {violation.process ? (
                        <Link to={`/processes/${violation.processId}`} style={{ textDecoration: 'none' }}>
                          <Typography color="primary">
                            {violation.process.name} ({violation.process.code})
                          </Typography>
                        </Link>
                      ) : (
                        <Typography>{violation.processId}</Typography>
                      )}
                    </Grid>
                    <Grid item xs={4}><Typography color="text.secondary">Control</Typography></Grid>
                    <Grid item xs={8}>
                      <Typography>{violation.control?.name || violation.controlId}</Typography>
                    </Grid>
                    <Grid item xs={4}><Typography color="text.secondary">Created</Typography></Grid>
                    <Grid item xs={8}><Typography>{formatDateTime(violation.createdAt)}</Typography></Grid>
                    <Grid item xs={4}><Typography color="text.secondary">Updated</Typography></Grid>
                    <Grid item xs={8}><Typography>{formatDateTime(violation.updatedAt)}</Typography></Grid>
                  </Grid>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={6}>
              <Card sx={{ mb: 2 }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom>Description</Typography>
                  <Divider sx={{ mb: 2 }} />
                  <Typography>{violation.description || 'No description provided.'}</Typography>
                </CardContent>
              </Card>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>Remediation</Typography>
                  <Divider sx={{ mb: 2 }} />
                  <Grid container spacing={2}>
                    <Grid item xs={4}><Typography color="text.secondary">Plan</Typography></Grid>
                    <Grid item xs={8}>
                      <Typography>{violation.remediationPlan || 'No remediation plan defined.'}</Typography>
                    </Grid>
                    <Grid item xs={4}><Typography color="text.secondary">Deadline</Typography></Grid>
                    <Grid item xs={8}><Typography>{formatDate(violation.remediationDeadline)}</Typography></Grid>
                    {violation.resolvedAt && (
                      <>
                        <Grid item xs={4}><Typography color="text.secondary">Resolved At</Typography></Grid>
                        <Grid item xs={8}><Typography>{formatDateTime(violation.resolvedAt)}</Typography></Grid>
                      </>
                    )}
                  </Grid>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Timeline</Typography>
              <Divider sx={{ mb: 2 }} />
              <Box sx={{ pl: 2, borderLeft: '2px solid', borderColor: 'divider' }}>
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2">Created</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {formatDateTime(violation.createdAt)}
                  </Typography>
                </Box>
                {violation.updatedAt !== violation.createdAt && (
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="subtitle2">Last Updated</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {formatDateTime(violation.updatedAt)}
                    </Typography>
                  </Box>
                )}
                {violation.resolvedAt && (
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="subtitle2" color="success.main">Resolved</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {formatDateTime(violation.resolvedAt)}
                    </Typography>
                  </Box>
                )}
              </Box>
            </CardContent>
          </Card>
        </TabPanel>
      </Paper>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Violation</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <FormControl fullWidth>
              <InputLabel>Severity</InputLabel>
              <Select
                value={formData.severity}
                label="Severity"
                onChange={(e) => setFormData({ ...formData, severity: e.target.value })}
              >
                {SEVERITY_OPTIONS.map((sev) => (
                  <MenuItem key={sev} value={sev} sx={{ textTransform: 'capitalize' }}>
                    {sev}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel>Status</InputLabel>
              <Select
                value={formData.status}
                label="Status"
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              >
                {STATUS_OPTIONS.map((stat) => (
                  <MenuItem key={stat} value={stat} sx={{ textTransform: 'capitalize' }}>
                    {stat.replace('_', ' ')}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              fullWidth
              label="Description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              multiline
              rows={3}
            />
            <TextField
              fullWidth
              label="Remediation Plan"
              value={formData.remediationPlan}
              onChange={(e) => setFormData({ ...formData, remediationPlan: e.target.value })}
              multiline
              rows={3}
            />
            <TextField
              fullWidth
              label="Remediation Deadline"
              type="date"
              value={formData.remediationDeadline}
              onChange={(e) => setFormData({ ...formData, remediationDeadline: e.target.value })}
              InputLabelProps={{ shrink: true }}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleSaveViolation}
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ViolationDetail;
