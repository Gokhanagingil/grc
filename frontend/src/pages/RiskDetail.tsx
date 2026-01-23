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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  LinearProgress,
} from '@mui/material';
import {
  Warning as RiskIcon,
  ArrowBack as BackIcon,
  Edit as EditIcon,
  History as HistoryIcon,
  Info as InfoIcon,
  Policy as PolicyIcon,
  Security as ControlIcon,
} from '@mui/icons-material';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  riskApi,
  unwrapResponse,
} from '../services/grcClient';
import { useAuth } from '../contexts/AuthContext';
import { LoadingState, ErrorState } from '../components/common';

interface Risk {
  id: string;
  tenantId: string;
  title: string;
  description: string | null;
  category: string | null;
  severity: string;
  likelihood: string;
  impact: string;
  riskScore: number | null;
  status: string;
  owner: string | null;
  mitigationStrategy: string | null;
  residualRisk: string | null;
  reviewDate: string | null;
  createdAt: string;
  updatedAt: string;
}

interface LinkedPolicy {
  id: string;
  title: string;
  status: string;
}

interface LinkedControl {
  id: string;
  name: string;
  code: string | null;
  status: string;
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
const LIKELIHOOD_OPTIONS = ['rare', 'unlikely', 'possible', 'likely', 'almost_certain'];
const IMPACT_OPTIONS = ['negligible', 'minor', 'moderate', 'major', 'catastrophic'];
const STATUS_OPTIONS = ['identified', 'assessed', 'mitigated', 'accepted', 'closed'];
const CATEGORY_OPTIONS = ['Operational', 'Financial', 'Strategic', 'Compliance', 'Technology', 'Reputational'];

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
    case 'identified': return 'error';
    case 'assessed': return 'warning';
    case 'mitigated': return 'success';
    case 'accepted': return 'info';
    case 'closed': return 'default';
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

export const RiskDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const tenantId = user?.tenantId || '';
  const isNewRisk = !id || id === 'new';

  const [risk, setRisk] = useState<Risk | null>(null);
  const [loading, setLoading] = useState(!isNewRisk);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [tabValue, setTabValue] = useState(0);
  const [saving, setSaving] = useState(false);

  const [linkedPolicies, setLinkedPolicies] = useState<LinkedPolicy[]>([]);
  const [linkedControls, setLinkedControls] = useState<LinkedControl[]>([]);
  const [relationsLoading, setRelationsLoading] = useState(false);

  const [editDialogOpen, setEditDialogOpen] = useState(isNewRisk);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: '',
    severity: 'medium',
    likelihood: 'possible',
    impact: 'moderate',
    status: 'identified',
    owner: '',
    mitigationStrategy: '',
    residualRisk: '',
    reviewDate: '',
  });

  const fetchRisk = useCallback(async () => {
    if (!id || isNewRisk || !tenantId) return;

    setLoading(true);
    setError(null);

    try {
      const response = await riskApi.get(tenantId, id);
      const data = unwrapResponse<Risk>(response);
      setRisk(data);
      setFormData({
        title: data.title,
        description: data.description || '',
        category: data.category || '',
        severity: data.severity,
        likelihood: data.likelihood,
        impact: data.impact,
        status: data.status,
        owner: data.owner || '',
        mitigationStrategy: data.mitigationStrategy || '',
        residualRisk: data.residualRisk || '',
        reviewDate: data.reviewDate ? data.reviewDate.split('T')[0] : '',
      });
    } catch (err) {
      console.error('Error fetching risk:', err);
      setError('Failed to load risk details. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [id, isNewRisk, tenantId]);

  const fetchRelations = useCallback(async () => {
    if (!id || isNewRisk || !tenantId) return;

    setRelationsLoading(true);
    try {
      const policiesRes = await riskApi.getLinkedPolicies(tenantId, id).catch(() => ({ data: { data: [] } }));
      setLinkedPolicies(policiesRes.data?.data || policiesRes.data || []);
      // Controls API not yet implemented for risks
      setLinkedControls([]);
    } catch (err) {
      console.error('Failed to fetch relations:', err);
    } finally {
      setRelationsLoading(false);
    }
  }, [id, isNewRisk, tenantId]);

  useEffect(() => {
    fetchRisk();
  }, [fetchRisk]);

  useEffect(() => {
    if (tabValue === 1) {
      fetchRelations();
    }
  }, [tabValue, fetchRelations]);

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleSaveRisk = async () => {
    if (!tenantId) {
      setError('Tenant ID is required');
      return;
    }

    setSaving(true);
    try {
      const riskData = {
        title: formData.title,
        description: formData.description || undefined,
        category: formData.category || undefined,
        severity: formData.severity,
        likelihood: formData.likelihood,
        impact: formData.impact,
        status: formData.status,
        owner: formData.owner || undefined,
        mitigationStrategy: formData.mitigationStrategy || undefined,
        residualRisk: formData.residualRisk || undefined,
        reviewDate: formData.reviewDate || undefined,
      };

      if (isNewRisk) {
        const response = await riskApi.create(tenantId, riskData);
        const newRisk = unwrapResponse<Risk>(response);
        setSuccess('Risk created successfully');
        navigate(`/risks/${newRisk.id}`, { replace: true });
      } else if (id) {
        await riskApi.update(tenantId, id, riskData);
        setSuccess('Risk updated successfully');
        setEditDialogOpen(false);
        fetchRisk();
      }
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      setError(error.response?.data?.message || 'Failed to save risk');
    } finally {
      setSaving(false);
    }
  };

  const getRiskScoreColor = (score: number | null): 'success' | 'warning' | 'error' => {
    if (!score) return 'success';
    if (score >= 15) return 'error';
    if (score >= 8) return 'warning';
    return 'success';
  };

  if (loading) {
    return <LoadingState message="Loading risk details..." />;
  }

  if (error && !risk && !isNewRisk) {
    return <ErrorState message={error} onRetry={fetchRisk} />;
  }

  return (
    <Box sx={{ p: 3 }} data-testid="risk-detail-page">
      <Box display="flex" alignItems="center" gap={2} mb={3}>
        <IconButton onClick={() => navigate('/risk')} data-testid="back-button">
          <BackIcon />
        </IconButton>
        <Box flex={1}>
          <Typography variant="h4" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <RiskIcon color="warning" /> {isNewRisk ? 'New Risk' : risk?.title}
          </Typography>
          {!isNewRisk && risk && (
            <Typography variant="subtitle1" color="text.secondary">
              Risk ID: {risk.id.slice(0, 8)}...
            </Typography>
          )}
        </Box>
        {!isNewRisk && risk && (
          <>
            <Chip
              label={formatStatus(risk.severity)}
              color={getSeverityColor(risk.severity)}
            />
            <Chip
              label={formatStatus(risk.status)}
              color={getStatusColor(risk.status)}
            />
            <Button
              variant="outlined"
              startIcon={<EditIcon />}
              onClick={() => setEditDialogOpen(true)}
            >
              Edit
            </Button>
          </>
        )}
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>{success}</Alert>}

      {isNewRisk ? (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>Create New Risk</Typography>
            <Divider sx={{ mb: 2 }} />
            <Grid container spacing={2}>
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
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  multiline
                  rows={3}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Category</InputLabel>
                  <Select
                    value={formData.category}
                    label="Category"
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  >
                    <MenuItem value="">None</MenuItem>
                    {CATEGORY_OPTIONS.map((cat) => (
                      <MenuItem key={cat} value={cat}>{cat}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={6}>
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
              </Grid>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Likelihood</InputLabel>
                  <Select
                    value={formData.likelihood}
                    label="Likelihood"
                    onChange={(e) => setFormData({ ...formData, likelihood: e.target.value })}
                  >
                    {LIKELIHOOD_OPTIONS.map((lik) => (
                      <MenuItem key={lik} value={lik} sx={{ textTransform: 'capitalize' }}>
                        {lik.replace('_', ' ')}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Impact</InputLabel>
                  <Select
                    value={formData.impact}
                    label="Impact"
                    onChange={(e) => setFormData({ ...formData, impact: e.target.value })}
                  >
                    {IMPACT_OPTIONS.map((imp) => (
                      <MenuItem key={imp} value={imp} sx={{ textTransform: 'capitalize' }}>
                        {imp}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Status</InputLabel>
                  <Select
                    value={formData.status}
                    label="Status"
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  >
                    {STATUS_OPTIONS.map((stat) => (
                      <MenuItem key={stat} value={stat} sx={{ textTransform: 'capitalize' }}>
                        {stat}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Owner"
                  value={formData.owner}
                  onChange={(e) => setFormData({ ...formData, owner: e.target.value })}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Mitigation Strategy"
                  value={formData.mitigationStrategy}
                  onChange={(e) => setFormData({ ...formData, mitigationStrategy: e.target.value })}
                  multiline
                  rows={2}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Residual Risk"
                  value={formData.residualRisk}
                  onChange={(e) => setFormData({ ...formData, residualRisk: e.target.value })}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Review Date"
                  type="date"
                  value={formData.reviewDate}
                  onChange={(e) => setFormData({ ...formData, reviewDate: e.target.value })}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid item xs={12}>
                <Box display="flex" gap={2} justifyContent="flex-end">
                  <Button onClick={() => navigate('/risk')}>Cancel</Button>
                  <Button
                    variant="contained"
                    onClick={handleSaveRisk}
                    disabled={saving || !formData.title}
                  >
                    {saving ? 'Creating...' : 'Create Risk'}
                  </Button>
                </Box>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      ) : (
        <Paper sx={{ width: '100%' }}>
          <Tabs value={tabValue} onChange={handleTabChange}>
            <Tab icon={<InfoIcon />} label="Overview" iconPosition="start" />
            <Tab icon={<PolicyIcon />} label="Relations" iconPosition="start" />
            <Tab icon={<HistoryIcon />} label="Timeline" iconPosition="start" />
          </Tabs>

          <TabPanel value={tabValue} index={0}>
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>Risk Details</Typography>
                    <Divider sx={{ mb: 2 }} />
                    <Grid container spacing={2}>
                      <Grid item xs={4}><Typography color="text.secondary">Title</Typography></Grid>
                      <Grid item xs={8}><Typography>{risk?.title}</Typography></Grid>
                      <Grid item xs={4}><Typography color="text.secondary">Category</Typography></Grid>
                      <Grid item xs={8}><Typography>{risk?.category || '-'}</Typography></Grid>
                      <Grid item xs={4}><Typography color="text.secondary">Severity</Typography></Grid>
                      <Grid item xs={8}>
                        <Chip
                          label={formatStatus(risk?.severity || '')}
                          size="small"
                          color={getSeverityColor(risk?.severity || '')}
                        />
                      </Grid>
                      <Grid item xs={4}><Typography color="text.secondary">Status</Typography></Grid>
                      <Grid item xs={8}>
                        <Chip
                          label={formatStatus(risk?.status || '')}
                          size="small"
                          color={getStatusColor(risk?.status || '')}
                        />
                      </Grid>
                      <Grid item xs={4}><Typography color="text.secondary">Owner</Typography></Grid>
                      <Grid item xs={8}><Typography>{risk?.owner || '-'}</Typography></Grid>
                      <Grid item xs={4}><Typography color="text.secondary">Review Date</Typography></Grid>
                      <Grid item xs={8}><Typography>{formatDate(risk?.reviewDate)}</Typography></Grid>
                    </Grid>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} md={6}>
                <Card sx={{ mb: 2 }}>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>Risk Assessment</Typography>
                    <Divider sx={{ mb: 2 }} />
                    <Grid container spacing={2}>
                      <Grid item xs={4}><Typography color="text.secondary">Likelihood</Typography></Grid>
                      <Grid item xs={8}>
                        <Typography sx={{ textTransform: 'capitalize' }}>
                          {risk?.likelihood?.replace('_', ' ') || '-'}
                        </Typography>
                      </Grid>
                      <Grid item xs={4}><Typography color="text.secondary">Impact</Typography></Grid>
                      <Grid item xs={8}>
                        <Typography sx={{ textTransform: 'capitalize' }}>
                          {risk?.impact || '-'}
                        </Typography>
                      </Grid>
                      <Grid item xs={4}><Typography color="text.secondary">Risk Score</Typography></Grid>
                      <Grid item xs={8}>
                        {risk?.riskScore !== null && risk?.riskScore !== undefined ? (
                          <Box display="flex" alignItems="center" gap={1}>
                            <LinearProgress
                              variant="determinate"
                              value={Math.min((risk.riskScore / 25) * 100, 100)}
                              color={getRiskScoreColor(risk.riskScore)}
                              sx={{ flex: 1, height: 8, borderRadius: 4 }}
                            />
                            <Typography fontWeight="bold">{risk.riskScore}</Typography>
                          </Box>
                        ) : (
                          <Typography>-</Typography>
                        )}
                      </Grid>
                      <Grid item xs={4}><Typography color="text.secondary">Residual Risk</Typography></Grid>
                      <Grid item xs={8}><Typography>{risk?.residualRisk || '-'}</Typography></Grid>
                    </Grid>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>Description</Typography>
                    <Divider sx={{ mb: 2 }} />
                    <Typography>{risk?.description || 'No description provided.'}</Typography>
                  </CardContent>
                </Card>
              </Grid>
              {risk?.mitigationStrategy && (
                <Grid item xs={12}>
                  <Card>
                    <CardContent>
                      <Typography variant="h6" gutterBottom>Mitigation Strategy</Typography>
                      <Divider sx={{ mb: 2 }} />
                      <Typography>{risk.mitigationStrategy}</Typography>
                    </CardContent>
                  </Card>
                </Grid>
              )}
            </Grid>
          </TabPanel>

          <TabPanel value={tabValue} index={1}>
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Card>
                  <CardContent>
                    <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                      <Typography variant="h6">
                        <PolicyIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                        Linked Policies ({linkedPolicies.length})
                      </Typography>
                    </Box>
                    <Divider sx={{ mb: 2 }} />
                    {relationsLoading ? (
                      <LinearProgress />
                    ) : linkedPolicies.length === 0 ? (
                      <Typography color="text.secondary">No policies linked to this risk.</Typography>
                    ) : (
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>Title</TableCell>
                            <TableCell>Status</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {linkedPolicies.map((policy) => (
                            <TableRow key={policy.id} hover>
                              <TableCell>
                                <Link to={`/policies/${policy.id}`} style={{ textDecoration: 'none' }}>
                                  <Typography color="primary">{policy.title}</Typography>
                                </Link>
                              </TableCell>
                              <TableCell>
                                <Chip label={formatStatus(policy.status)} size="small" />
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} md={6}>
                <Card>
                  <CardContent>
                    <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                      <Typography variant="h6">
                        <ControlIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                        Linked Controls ({linkedControls.length})
                      </Typography>
                    </Box>
                    <Divider sx={{ mb: 2 }} />
                    {relationsLoading ? (
                      <LinearProgress />
                    ) : linkedControls.length === 0 ? (
                      <Typography color="text.secondary">No controls linked to this risk.</Typography>
                    ) : (
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>Code</TableCell>
                            <TableCell>Name</TableCell>
                            <TableCell>Status</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {linkedControls.map((control) => (
                            <TableRow key={control.id} hover>
                              <TableCell>{control.code || '-'}</TableCell>
                              <TableCell>
                                <Link to={`/controls/${control.id}`} style={{ textDecoration: 'none' }}>
                                  <Typography color="primary">{control.name}</Typography>
                                </Link>
                              </TableCell>
                              <TableCell>
                                <Chip label={formatStatus(control.status)} size="small" />
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </TabPanel>

          <TabPanel value={tabValue} index={2}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>Timeline</Typography>
                <Divider sx={{ mb: 2 }} />
                <Box sx={{ pl: 2, borderLeft: '2px solid', borderColor: 'divider' }}>
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="subtitle2">Created</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {formatDateTime(risk?.createdAt)}
                    </Typography>
                  </Box>
                  {risk?.updatedAt !== risk?.createdAt && (
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="subtitle2">Last Updated</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {formatDateTime(risk?.updatedAt)}
                      </Typography>
                    </Box>
                  )}
                  {risk?.reviewDate && (
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="subtitle2">Next Review</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {formatDate(risk.reviewDate)}
                      </Typography>
                    </Box>
                  )}
                </Box>
              </CardContent>
            </Card>
          </TabPanel>
        </Paper>
      )}

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen && !isNewRisk} onClose={() => setEditDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Edit Risk</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              fullWidth
              label="Title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              required
            />
            <TextField
              fullWidth
              label="Description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              multiline
              rows={3}
            />
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Category</InputLabel>
                  <Select
                    value={formData.category}
                    label="Category"
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  >
                    <MenuItem value="">None</MenuItem>
                    {CATEGORY_OPTIONS.map((cat) => (
                      <MenuItem key={cat} value={cat}>{cat}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={6}>
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
              </Grid>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Likelihood</InputLabel>
                  <Select
                    value={formData.likelihood}
                    label="Likelihood"
                    onChange={(e) => setFormData({ ...formData, likelihood: e.target.value })}
                  >
                    {LIKELIHOOD_OPTIONS.map((lik) => (
                      <MenuItem key={lik} value={lik} sx={{ textTransform: 'capitalize' }}>
                        {lik.replace('_', ' ')}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Impact</InputLabel>
                  <Select
                    value={formData.impact}
                    label="Impact"
                    onChange={(e) => setFormData({ ...formData, impact: e.target.value })}
                  >
                    {IMPACT_OPTIONS.map((imp) => (
                      <MenuItem key={imp} value={imp} sx={{ textTransform: 'capitalize' }}>
                        {imp}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Status</InputLabel>
                  <Select
                    value={formData.status}
                    label="Status"
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  >
                    {STATUS_OPTIONS.map((stat) => (
                      <MenuItem key={stat} value={stat} sx={{ textTransform: 'capitalize' }}>
                        {stat}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Owner"
                  value={formData.owner}
                  onChange={(e) => setFormData({ ...formData, owner: e.target.value })}
                />
              </Grid>
            </Grid>
            <TextField
              fullWidth
              label="Mitigation Strategy"
              value={formData.mitigationStrategy}
              onChange={(e) => setFormData({ ...formData, mitigationStrategy: e.target.value })}
              multiline
              rows={2}
            />
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Residual Risk"
                  value={formData.residualRisk}
                  onChange={(e) => setFormData({ ...formData, residualRisk: e.target.value })}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Review Date"
                  type="date"
                  value={formData.reviewDate}
                  onChange={(e) => setFormData({ ...formData, reviewDate: e.target.value })}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
            </Grid>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleSaveRisk}
            disabled={saving || !formData.title}
          >
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default RiskDetail;
