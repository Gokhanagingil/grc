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
  AccountBalance as PolicyIcon,
  ArrowBack as BackIcon,
  History as HistoryIcon,
  Edit as EditIcon,
  Warning as RiskIcon,
} from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFnsV3';
import { policyApi, unwrapResponse } from '../services/grcClient';
import { useAuth } from '../contexts/AuthContext';
import { LoadingState, ErrorState } from '../components/common';
import { PolicyVersionsTab } from '../components/PolicyVersionsTab';

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

interface Policy {
  id: string;
  name: string;
  title?: string;
  summary?: string;
  description?: string;
  category: string;
  version: string;
  status: string;
  effectiveDate: string | null;
  reviewDate: string | null;
  content?: string;
  owner?: User;
  ownerUserId?: string;
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
      id={`policy-tabpanel-${index}`}
      aria-labelledby={`policy-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  );
}

const getStatusColor = (status: string): 'error' | 'warning' | 'info' | 'success' | 'default' => {
  switch (status?.toLowerCase()) {
    case 'active': return 'success';
    case 'draft': return 'warning';
    case 'archived': return 'default';
    case 'pending_review': return 'info';
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

export const PolicyDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const tenantId = user?.tenantId || '';

  const [policy, setPolicy] = useState<Policy | null>(null);
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
    category: '',
    version: '',
    status: '',
    effectiveDate: null as Date | null,
    reviewDate: null as Date | null,
    content: '',
  });

  const fetchPolicy = useCallback(async () => {
    if (!id || !tenantId) return;

    setLoading(true);
    setError(null);

    try {
      const response = await policyApi.get(tenantId, id);
      const data = unwrapResponse<Policy>(response);
      setPolicy(data);
    } catch (err) {
      console.error('Error fetching policy:', err);
      setError('Failed to load policy details. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [id, tenantId]);

  const fetchAssociatedRisks = useCallback(async () => {
    if (!id || !tenantId) return;

    setRisksLoading(true);
    try {
      const response = await policyApi.getLinkedRisks(tenantId, id);
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
    fetchPolicy();
  }, [fetchPolicy]);

  useEffect(() => {
    if (tabValue === 1) {
      fetchAssociatedRisks();
    }
  }, [tabValue, fetchAssociatedRisks]);

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleOpenEditDialog = () => {
    if (!policy) return;
    setFormData({
      title: policy.name || policy.title || '',
      description: policy.summary || policy.description || '',
      category: policy.category || '',
      version: policy.version || '',
      status: policy.status || '',
      effectiveDate: policy.effectiveDate ? new Date(policy.effectiveDate) : null,
      reviewDate: policy.reviewDate ? new Date(policy.reviewDate) : null,
      content: policy.content || '',
    });
    setEditDialogOpen(true);
  };

  const handleSavePolicy = async () => {
    if (!id || !tenantId) return;

    setSaving(true);
    try {
      const policyData = {
        name: formData.title,
        summary: formData.description,
        category: formData.category,
        version: formData.version,
        status: formData.status,
        effectiveDate: formData.effectiveDate?.toISOString().split('T')[0],
        reviewDate: formData.reviewDate?.toISOString().split('T')[0],
        content: formData.content,
      };

      await policyApi.update(tenantId, id, policyData);
      setSuccess('Policy updated successfully');
      setEditDialogOpen(false);
      await fetchPolicy();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      setError(error.response?.data?.message || 'Failed to update policy');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <LoadingState message="Loading policy details..." />;
  }

  if (error && !policy) {
    return <ErrorState message={error} onRetry={fetchPolicy} />;
  }

  if (!policy) {
    return <ErrorState message="Policy not found" />;
  }

  const policyTitle = policy.name || policy.title || 'Untitled Policy';
  const policyDescription = policy.summary || policy.description || '';
  const ownerName = policy.owner 
    ? `${policy.owner.firstName || ''} ${policy.owner.lastName || ''}`.trim() || policy.owner.email
    : '-';

  return (
    <Box sx={{ p: 3 }} data-testid="policy-detail-page">
      <Box display="flex" alignItems="center" gap={2} mb={3}>
        <IconButton onClick={() => navigate('/governance')} data-testid="back-button">
          <BackIcon />
        </IconButton>
        <Box flex={1}>
          <Typography variant="h4" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <PolicyIcon /> {policyTitle}
          </Typography>
          {policyDescription && (
            <Typography variant="body2" color="textSecondary" sx={{ mt: 0.5 }}>
              {policyDescription}
            </Typography>
          )}
        </Box>
        <Chip
          label={formatStatus(policy.status)}
          color={getStatusColor(policy.status)}
          size="medium"
        />
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
                  <Tab label="Versions" icon={<HistoryIcon />} iconPosition="start" />
                </Tabs>

                <TabPanel value={tabValue} index={0}>
                  <Box sx={{ p: 2 }}>
                    <Typography variant="h6" gutterBottom>Description</Typography>
                    <Typography variant="body1" paragraph>
                      {policyDescription || 'No description provided.'}
                    </Typography>

                    {policy.content && (
                      <>
                        <Divider sx={{ my: 2 }} />
                        <Typography variant="h6" gutterBottom>Content</Typography>
                        <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                          {policy.content}
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
                        No risks linked to this policy
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
                                  <PolicyVersionsTab policyId={id || ''} policyTitle={policyTitle} />
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
                <Typography variant="subtitle2" color="textSecondary">Category</Typography>
                <Typography>{policy.category || '-'}</Typography>
              </Box>

              <Box mb={2}>
                <Typography variant="subtitle2" color="textSecondary">Version</Typography>
                <Typography>{policy.version || '-'}</Typography>
              </Box>

              <Box mb={2}>
                <Typography variant="subtitle2" color="textSecondary">Status</Typography>
                <Chip
                  label={formatStatus(policy.status)}
                  color={getStatusColor(policy.status)}
                  size="small"
                />
              </Box>

              <Box mb={2}>
                <Typography variant="subtitle2" color="textSecondary">Owner</Typography>
                <Typography>{ownerName}</Typography>
              </Box>

              <Box mb={2}>
                <Typography variant="subtitle2" color="textSecondary">Effective Date</Typography>
                <Typography>{formatDate(policy.effectiveDate)}</Typography>
              </Box>

              <Box mb={2}>
                <Typography variant="subtitle2" color="textSecondary">Review Date</Typography>
                <Typography>{formatDate(policy.reviewDate)}</Typography>
              </Box>

              <Box mb={2}>
                <Typography variant="subtitle2" color="textSecondary">Created</Typography>
                <Typography>{formatDate(policy.createdAt)}</Typography>
              </Box>

              <Box>
                <Typography variant="subtitle2" color="textSecondary">Last Updated</Typography>
                <Typography>{formatDate(policy.updatedAt)}</Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Edit Policy</DialogTitle>
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
              <TextField
                fullWidth
                label="Category"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Version"
                value={formData.version}
                onChange={(e) => setFormData({ ...formData, version: e.target.value })}
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
                  <MenuItem value="draft">Draft</MenuItem>
                  <MenuItem value="active">Active</MenuItem>
                  <MenuItem value="archived">Archived</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Content"
                multiline
                rows={4}
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              />
            </Grid>
            <Grid item xs={6}>
              <LocalizationProvider dateAdapter={AdapterDateFns}>
                <DatePicker
                  label="Effective Date"
                  value={formData.effectiveDate}
                  onChange={(newValue: Date | null) =>
                    setFormData({ ...formData, effectiveDate: newValue })
                  }
                  slotProps={{
                    textField: { fullWidth: true },
                  }}
                />
              </LocalizationProvider>
            </Grid>
            <Grid item xs={6}>
              <LocalizationProvider dateAdapter={AdapterDateFns}>
                <DatePicker
                  label="Review Date"
                  value={formData.reviewDate}
                  onChange={(newValue: Date | null) =>
                    setFormData({ ...formData, reviewDate: newValue })
                  }
                  slotProps={{
                    textField: { fullWidth: true },
                  }}
                />
              </LocalizationProvider>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleSavePolicy} variant="contained" disabled={saving}>
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default PolicyDetail;
