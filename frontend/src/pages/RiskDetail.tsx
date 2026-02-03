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
  CircularProgress,
  InputAdornment,
  List,
  ListItem,
  ListItemText,
  Checkbox,
  Tooltip,
} from '@mui/material';
import {
  Warning as RiskIcon,
  ArrowBack as BackIcon,
  Edit as EditIcon,
  History as HistoryIcon,
  Info as InfoIcon,
  Policy as PolicyIcon,
  Security as ControlIcon,
  Assignment as TreatmentIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
} from '@mui/icons-material';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  riskApi,
  policyApi,
  controlApi,
  unwrapResponse,
  unwrapArrayResponse,
  unwrapPaginatedResponse,
  ensureArray,
} from '../services/grcClient';
import { useAuth } from '../contexts/AuthContext';
import { LoadingState, ErrorState } from '../components/common';
import { TreatmentPlanTab } from '../components/risk';

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
  ownerDisplayName: string | null;
  mitigationStrategy: string | null;
  residualRisk: string | null;
  reviewDate: string | null;
  createdAt: string;
  updatedAt: string;
  // Residual risk fields
  inherentLikelihood: number | null;
  inherentImpact: number | null;
  inherentScore: number | null;
  residualLikelihood: number | null;
  residualImpact: number | null;
  residualScore: number | null;
  // ITIL lifecycle fields
  treatmentStrategy: string | null;
  nextReviewAt: string | null;
  reviewIntervalDays: number | null;
  acceptanceReason: string | null;
  acceptedByUserId: string | null;
  acceptedAt: string | null;
}

interface LinkedPolicy {
  id: string;
  name: string;
  title?: string; // Some endpoints may return title instead of name
  code: string | null;
  version?: string;
  status: string;
}

interface LinkedControl {
  id: string;
  name: string;
  code: string | null;
  status: string;
}

interface ControlWithEffectiveness {
  controlId: string;
  controlTitle: string;
  effectivenessRating: 'unknown' | 'effective' | 'partially_effective' | 'ineffective';
  reductionFactor: number;
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
// Impact uses the same RiskSeverity enum as severity in the backend
const IMPACT_OPTIONS = ['low', 'medium', 'high', 'critical'];
const STATUS_OPTIONS = ['draft', 'identified', 'assessed', 'treatment_planned', 'treating', 'mitigating', 'monitored', 'accepted', 'closed'];
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

/**
 * Get display label for a policy
 * Priority: code + name, or just name, with version if available
 */
const getPolicyDisplayLabel = (policy: LinkedPolicy): string => {
  const name = policy.name || policy.title || 'Unnamed Policy';
  const parts: string[] = [];
  if (policy.code) {
    parts.push(`[${policy.code}]`);
  }
  parts.push(name);
  if (policy.version) {
    parts.push(`v${policy.version}`);
  }
  return parts.join(' ');
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

  // Link Policy Modal state
  const [linkPolicyModalOpen, setLinkPolicyModalOpen] = useState(false);
  const [availablePolicies, setAvailablePolicies] = useState<LinkedPolicy[]>([]);
  const [policiesLoading, setPoliciesLoading] = useState(false);
  const [policySearchTerm, setPolicySearchTerm] = useState('');
  const [selectedPolicyIds, setSelectedPolicyIds] = useState<string[]>([]);
  const [linkingPolicy, setLinkingPolicy] = useState(false);

  // Link Control Modal state
  const [linkControlModalOpen, setLinkControlModalOpen] = useState(false);
  const [availableControls, setAvailableControls] = useState<LinkedControl[]>([]);
  const [controlsLoading, setControlsLoading] = useState(false);
  const [controlSearchTerm, setControlSearchTerm] = useState('');
  const [selectedControlIds, setSelectedControlIds] = useState<string[]>([]);
  const [linkingControl, setLinkingControl] = useState(false);

  // Mitigation summary state
  const [controlsWithEffectiveness, setControlsWithEffectiveness] = useState<ControlWithEffectiveness[]>([]);
  const [effectivenessLoading, setEffectivenessLoading] = useState(false);
  const [recalculating, setRecalculating] = useState(false);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: '',
    severity: 'medium',
    likelihood: 'possible',
    impact: 'medium',
    status: 'identified',
    ownerDisplayName: '',
    mitigationPlan: '',
    lastReviewedAt: '',
    // ITIL lifecycle fields
    treatmentStrategy: '',
    nextReviewAt: '',
    reviewIntervalDays: '',
    acceptanceReason: '',
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
        ownerDisplayName: data.ownerDisplayName || '',
        mitigationPlan: (data as unknown as { mitigationPlan?: string }).mitigationPlan || '',
        lastReviewedAt: (data as unknown as { lastReviewedAt?: string }).lastReviewedAt
          ? (data as unknown as { lastReviewedAt: string }).lastReviewedAt.split('T')[0]
          : '',
        // ITIL lifecycle fields
        treatmentStrategy: data.treatmentStrategy || '',
        nextReviewAt: data.nextReviewAt ? data.nextReviewAt.split('T')[0] : '',
        reviewIntervalDays: data.reviewIntervalDays?.toString() || '',
        acceptanceReason: data.acceptanceReason || '',
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
      const [policiesRes, controlsRes] = await Promise.all([
        riskApi.getLinkedPolicies(tenantId, id).catch(() => ({ data: [] })),
        riskApi.getLinkedControls(tenantId, id).catch(() => ({ data: { success: true, data: [] } })),
      ]);
      // Policies endpoint returns array directly (no envelope)
      // Controls endpoint returns { success: true, data: [...] } envelope
      const policies = unwrapArrayResponse<LinkedPolicy>(policiesRes);
      const controls = unwrapArrayResponse<LinkedControl>(controlsRes);
      setLinkedPolicies(policies);
      setLinkedControls(controls);
    } catch (err) {
      console.error('Failed to fetch relations:', err);
      setLinkedPolicies([]);
      setLinkedControls([]);
    } finally {
      setRelationsLoading(false);
    }
  }, [id, isNewRisk, tenantId]);

  // Fetch available policies for linking
  const fetchAvailablePolicies = useCallback(async () => {
    if (!tenantId) return;
    setPoliciesLoading(true);
    try {
      const params = new URLSearchParams();
      if (policySearchTerm) {
        params.set('search', policySearchTerm);
      }
      params.set('pageSize', '50');
      const response = await policyApi.list(tenantId, params);
      // Use unwrapPaginatedResponse for LIST-CONTRACT compliant endpoints
      const { items } = unwrapPaginatedResponse<LinkedPolicy>(response);
      const data = ensureArray<LinkedPolicy>(items);
      // Filter out already linked policies
      const linkedIds = new Set(ensureArray<LinkedPolicy>(linkedPolicies).map(p => p.id));
      setAvailablePolicies(data.filter((p: LinkedPolicy) => !linkedIds.has(p.id)));
    } catch (err) {
      console.error('Failed to fetch policies:', err);
      setAvailablePolicies([]);
    } finally {
      setPoliciesLoading(false);
    }
  }, [tenantId, policySearchTerm, linkedPolicies]);

  // Fetch available controls for linking
  const fetchAvailableControls = useCallback(async () => {
    if (!tenantId) return;
    setControlsLoading(true);
    try {
      const params: Record<string, unknown> = { pageSize: 50 };
      if (controlSearchTerm) {
        params.search = controlSearchTerm;
      }
      const response = await controlApi.list(tenantId, params);
      // Use unwrapPaginatedResponse for LIST-CONTRACT compliant endpoints
      const { items } = unwrapPaginatedResponse<LinkedControl>(response);
      const data = ensureArray<LinkedControl>(items);
      // Filter out already linked controls
      const linkedIds = new Set(ensureArray<LinkedControl>(linkedControls).map(c => c.id));
      setAvailableControls(data.filter((c: LinkedControl) => !linkedIds.has(c.id)));
    } catch (err) {
      console.error('Failed to fetch controls:', err);
      setAvailableControls([]);
    } finally {
      setControlsLoading(false);
    }
  }, [tenantId, controlSearchTerm, linkedControls]);

  // Link selected policies
  const handleLinkPolicies = async () => {
    if (!id || !tenantId || selectedPolicyIds.length === 0) return;
    setLinkingPolicy(true);
    try {
      for (const policyId of selectedPolicyIds) {
        await riskApi.linkPolicy(tenantId, id, policyId);
      }
      setSuccess(`Successfully linked ${selectedPolicyIds.length} policy(ies)`);
      setSelectedPolicyIds([]);
      setLinkPolicyModalOpen(false);
      fetchRelations();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error('Failed to link policies:', err);
      setError('Failed to link policies. Please try again.');
    } finally {
      setLinkingPolicy(false);
    }
  };

  // Unlink a policy
  const handleUnlinkPolicy = async (policyId: string) => {
    if (!id || !tenantId) return;
    try {
      await riskApi.unlinkPolicy(tenantId, id, policyId);
      setSuccess('Policy unlinked successfully');
      fetchRelations();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error('Failed to unlink policy:', err);
      setError('Failed to unlink policy. Please try again.');
    }
  };

  // Link selected controls
  const handleLinkControls = async () => {
    if (!id || !tenantId || selectedControlIds.length === 0) return;
    setLinkingControl(true);
    try {
      for (const controlId of selectedControlIds) {
        await riskApi.linkControl(tenantId, id, controlId);
      }
      setSuccess(`Successfully linked ${selectedControlIds.length} control(s)`);
      setSelectedControlIds([]);
      setLinkControlModalOpen(false);
      fetchRelations();
      fetchControlsWithEffectiveness();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error('Failed to link controls:', err);
      setError('Failed to link controls. Please try again.');
    } finally {
      setLinkingControl(false);
    }
  };

  // Unlink a control
  const handleUnlinkControl = async (controlId: string) => {
    if (!id || !tenantId) return;
    try {
      await riskApi.unlinkControl(tenantId, id, controlId);
      setSuccess('Control unlinked successfully');
      fetchRelations();
      fetchControlsWithEffectiveness();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error('Failed to unlink control:', err);
      setError('Failed to unlink control. Please try again.');
    }
  };

  // Fetch controls with effectiveness ratings for mitigation summary
  const fetchControlsWithEffectiveness = useCallback(async () => {
    if (!id || !tenantId) return;
    setEffectivenessLoading(true);
    try {
      const response = await riskApi.getControlsWithEffectiveness(tenantId, id);
      const data = unwrapArrayResponse(response.data);
      setControlsWithEffectiveness(data as ControlWithEffectiveness[]);
    } catch (err) {
      console.error('Failed to fetch controls with effectiveness:', err);
      setControlsWithEffectiveness([]);
    } finally {
      setEffectivenessLoading(false);
    }
  }, [id, tenantId]);

  // Recalculate residual risk
  const handleRecalculateResidual = async () => {
    if (!id || !tenantId) return;
    setRecalculating(true);
    try {
      const response = await riskApi.recalculateResidual(tenantId, id);
      const updatedRisk = unwrapResponse(response.data);
      if (updatedRisk) {
        setRisk(updatedRisk as Risk);
        setSuccess('Residual risk recalculated successfully');
        setTimeout(() => setSuccess(null), 3000);
      }
    } catch (err) {
      console.error('Failed to recalculate residual risk:', err);
      setError('Failed to recalculate residual risk. Please try again.');
    } finally {
      setRecalculating(false);
    }
  };

  // Open link policy modal
  const openLinkPolicyModal = () => {
    setLinkPolicyModalOpen(true);
    setPolicySearchTerm('');
    setSelectedPolicyIds([]);
    fetchAvailablePolicies();
  };

  // Open link control modal
  const openLinkControlModal = () => {
    setLinkControlModalOpen(true);
    setControlSearchTerm('');
    setSelectedControlIds([]);
    fetchAvailableControls();
  };

  // Effect to refetch policies when search term changes
  useEffect(() => {
    if (linkPolicyModalOpen) {
      const timer = setTimeout(() => {
        fetchAvailablePolicies();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [policySearchTerm, linkPolicyModalOpen, fetchAvailablePolicies]);

  // Effect to refetch controls when search term changes
  useEffect(() => {
    if (linkControlModalOpen) {
      const timer = setTimeout(() => {
        fetchAvailableControls();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [controlSearchTerm, linkControlModalOpen, fetchAvailableControls]);

  useEffect(() => {
    fetchRisk();
  }, [fetchRisk]);

  useEffect(() => {
    if (tabValue === 1) {
      fetchRelations();
    }
  }, [tabValue, fetchRelations]);

  // Fetch controls with effectiveness when risk is loaded (for Overview tab mitigation summary)
  useEffect(() => {
    if (risk && !isNewRisk) {
      fetchControlsWithEffectiveness();
    }
  }, [risk, isNewRisk, fetchControlsWithEffectiveness]);

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
      const riskData: Record<string, unknown> = {
        title: formData.title,
        description: formData.description || undefined,
        category: formData.category || undefined,
        severity: formData.severity,
        likelihood: formData.likelihood,
        impact: formData.impact,
        status: formData.status,
        ownerDisplayName: formData.ownerDisplayName || undefined,
        mitigationPlan: formData.mitigationPlan || undefined,
        lastReviewedAt: formData.lastReviewedAt || undefined,
        // ITIL lifecycle fields
        treatmentStrategy: formData.treatmentStrategy || undefined,
        nextReviewAt: formData.nextReviewAt || undefined,
        reviewIntervalDays: formData.reviewIntervalDays ? parseInt(formData.reviewIntervalDays, 10) : undefined,
        acceptanceReason: formData.treatmentStrategy === 'accept' ? formData.acceptanceReason || undefined : undefined,
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
      const error = err as { 
        response?: { 
          status?: number;
          data?: { message?: string | string[]; error?: string } 
        } 
      };
      // Build a more informative error message
      let errorMessage = 'Failed to save risk';
      if (error.response?.data?.message) {
        const msg = error.response.data.message;
        errorMessage = Array.isArray(msg) ? msg.join(', ') : msg;
      } else if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      }
      // Add status code context for debugging
      if (error.response?.status) {
        errorMessage = `[${error.response.status}] ${errorMessage}`;
      }
      setError(errorMessage);
      console.error('Risk save error:', error.response?.data || error);
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
                  value={formData.ownerDisplayName}
                  onChange={(e) => setFormData({ ...formData, ownerDisplayName: e.target.value })}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Mitigation Plan"
                  value={formData.mitigationPlan}
                  onChange={(e) => setFormData({ ...formData, mitigationPlan: e.target.value })}
                  multiline
                  rows={2}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Last Reviewed"
                  type="date"
                  value={formData.lastReviewedAt}
                  onChange={(e) => setFormData({ ...formData, lastReviewedAt: e.target.value })}
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
                      <Tab icon={<TreatmentIcon />} label="Treatment Plan" iconPosition="start" />
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
                          {risk?.inherentLikelihood && ` (${risk.inherentLikelihood}/5)`}
                        </Typography>
                      </Grid>
                      <Grid item xs={4}><Typography color="text.secondary">Impact</Typography></Grid>
                      <Grid item xs={8}>
                        <Typography sx={{ textTransform: 'capitalize' }}>
                          {risk?.impact || '-'}
                          {risk?.inherentImpact && ` (${risk.inherentImpact}/5)`}
                        </Typography>
                      </Grid>
                      <Grid item xs={12}>
                        <Divider sx={{ my: 1 }} />
                      </Grid>
                      <Grid item xs={4}><Typography color="text.secondary" fontWeight="medium">Inherent Risk</Typography></Grid>
                      <Grid item xs={8}>
                        {risk?.inherentScore !== null && risk?.inherentScore !== undefined ? (
                          <Box display="flex" alignItems="center" gap={1}>
                            <LinearProgress
                              variant="determinate"
                              value={Math.min((risk.inherentScore / 25) * 100, 100)}
                              color={getRiskScoreColor(risk.inherentScore)}
                              sx={{ flex: 1, height: 8, borderRadius: 4 }}
                            />
                            <Typography fontWeight="bold">{risk.inherentScore}</Typography>
                          </Box>
                        ) : risk?.riskScore !== null && risk?.riskScore !== undefined ? (
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
                      <Grid item xs={4}><Typography color="text.secondary" fontWeight="medium">Residual Risk</Typography></Grid>
                      <Grid item xs={8}>
                        {risk?.residualScore !== null && risk?.residualScore !== undefined ? (
                          <Box display="flex" alignItems="center" gap={1}>
                            <LinearProgress
                              variant="determinate"
                              value={Math.min((risk.residualScore / 25) * 100, 100)}
                              color={getRiskScoreColor(risk.residualScore)}
                              sx={{ flex: 1, height: 8, borderRadius: 4 }}
                            />
                            <Tooltip title={`Residual: ${risk.residualScore} (Inherent: ${risk.inherentScore || risk.riskScore || '-'})`}>
                              <Typography fontWeight="bold" color={getRiskScoreColor(risk.residualScore) + '.main'}>
                                {risk.residualScore}
                              </Typography>
                            </Tooltip>
                          </Box>
                        ) : (
                          <Typography color="text.secondary">
                            {linkedControls.length === 0 ? 'Link controls to calculate' : 'Calculating...'}
                          </Typography>
                        )}
                      </Grid>
                      {typeof risk?.residualScore === 'number' && typeof risk?.inherentScore === 'number' && risk.residualScore < risk.inherentScore && (
                        <>
                          <Grid item xs={4}><Typography color="text.secondary">Risk Reduction</Typography></Grid>
                          <Grid item xs={8}>
                            <Chip
                              label={`-${Math.round((risk.inherentScore - risk.residualScore) / risk.inherentScore * 100)}%`}
                              color="success"
                              size="small"
                              sx={{ fontWeight: 'bold' }}
                            />
                          </Grid>
                        </>
                      )}
                      <Grid item xs={12}>
                        <Divider sx={{ my: 1 }} />
                      </Grid>
                      <Grid item xs={4}><Typography color="text.secondary">Appetite Status</Typography></Grid>
                      <Grid item xs={8}>
                        {(() => {
                          const DEFAULT_APPETITE = 9;
                          const effectiveScore = risk?.residualScore ?? risk?.inherentScore ?? risk?.riskScore ?? 0;
                          const isAboveAppetite = effectiveScore > DEFAULT_APPETITE;
                          return (
                            <Chip
                              label={isAboveAppetite ? 'Above Appetite' : 'Within Appetite'}
                              color={isAboveAppetite ? 'error' : 'success'}
                              size="small"
                              sx={{ fontWeight: 'medium' }}
                            />
                          );
                        })()}
                      </Grid>
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
              <Grid item xs={12}>
                <Card>
                  <CardContent>
                    <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                      <Typography variant="h6">
                        <ControlIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                        Mitigation Summary
                      </Typography>
                      <Button
                        variant="outlined"
                        size="small"
                        onClick={handleRecalculateResidual}
                        disabled={recalculating || controlsWithEffectiveness.length === 0}
                        data-testid="recalculate-residual-button"
                      >
                        {recalculating ? <CircularProgress size={16} sx={{ mr: 1 }} /> : null}
                        {recalculating ? 'Recalculating...' : 'Recalculate Residual'}
                      </Button>
                    </Box>
                    <Divider sx={{ mb: 2 }} />
                    {effectivenessLoading ? (
                      <LinearProgress />
                    ) : controlsWithEffectiveness.length === 0 ? (
                      <Box textAlign="center" py={3}>
                        <Typography color="text.secondary" gutterBottom>
                          No controls linked to this risk.
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Link controls in the Relations tab to reduce residual risk.
                        </Typography>
                      </Box>
                    ) : (
                      <>
                        <Box sx={{ mb: 2, p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
                          <Grid container spacing={2}>
                            <Grid item xs={6}>
                              <Typography variant="body2" color="text.secondary">Controls Linked</Typography>
                              <Typography variant="h6">{controlsWithEffectiveness.length}</Typography>
                            </Grid>
                            <Grid item xs={6}>
                              <Typography variant="body2" color="text.secondary">Estimated Mitigation</Typography>
                              <Typography variant="h6" color="success.main">
                                {(() => {
                                  const totalReduction = controlsWithEffectiveness.reduce((acc, ctrl) => {
                                    return acc + (1 - acc) * ctrl.reductionFactor;
                                  }, 0);
                                  return `${Math.round(totalReduction * 100)}%`;
                                })()}
                              </Typography>
                            </Grid>
                          </Grid>
                        </Box>
                        <Typography variant="subtitle2" gutterBottom>Linked Controls with Effectiveness</Typography>
                        <Table size="small">
                          <TableHead>
                            <TableRow>
                              <TableCell>Control</TableCell>
                              <TableCell>Effectiveness</TableCell>
                              <TableCell align="right">Reduction Factor</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {controlsWithEffectiveness.map((ctrl) => (
                              <TableRow key={ctrl.controlId} hover>
                                <TableCell>
                                  <Link to={`/controls/${ctrl.controlId}`} style={{ textDecoration: 'none' }}>
                                    <Typography color="primary">{ctrl.controlTitle}</Typography>
                                  </Link>
                                </TableCell>
                                <TableCell>
                                  <Chip
                                    label={formatStatus(ctrl.effectivenessRating)}
                                    size="small"
                                    color={
                                      ctrl.effectivenessRating === 'effective' ? 'success' :
                                      ctrl.effectivenessRating === 'partially_effective' ? 'warning' :
                                      ctrl.effectivenessRating === 'ineffective' ? 'error' : 'default'
                                    }
                                  />
                                </TableCell>
                                <TableCell align="right">
                                  <Typography variant="body2" fontWeight="medium">
                                    {Math.round(ctrl.reductionFactor * 100)}%
                                  </Typography>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </>
                    )}
                  </CardContent>
                </Card>
              </Grid>
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
                      <Button
                        variant="outlined"
                        size="small"
                        startIcon={<AddIcon />}
                        onClick={openLinkPolicyModal}
                        data-testid="link-policy-button"
                      >
                        Link Policy
                      </Button>
                    </Box>
                    <Divider sx={{ mb: 2 }} />
                    {relationsLoading ? (
                      <LinearProgress />
                    ) : linkedPolicies.length === 0 ? (
                      <Box textAlign="center" py={3}>
                        <Typography color="text.secondary" gutterBottom>
                          No policies linked to this risk.
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Link a policy to establish governance relationships.
                        </Typography>
                      </Box>
                    ) : (
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>Policy</TableCell>
                            <TableCell>Status</TableCell>
                            <TableCell align="right">Actions</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {linkedPolicies.map((policy) => (
                            <TableRow key={policy.id} hover>
                              <TableCell>
                                <Link to={`/policies/${policy.id}`} style={{ textDecoration: 'none' }}>
                                  <Typography color="primary">{getPolicyDisplayLabel(policy)}</Typography>
                                </Link>
                              </TableCell>
                              <TableCell>
                                <Chip label={formatStatus(policy.status)} size="small" />
                              </TableCell>
                              <TableCell align="right">
                                <Tooltip title="Unlink policy">
                                  <IconButton
                                    size="small"
                                    color="error"
                                    onClick={() => handleUnlinkPolicy(policy.id)}
                                    data-testid={`unlink-policy-${policy.id}`}
                                  >
                                    <DeleteIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
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
                      <Button
                        variant="outlined"
                        size="small"
                        startIcon={<AddIcon />}
                        onClick={openLinkControlModal}
                        data-testid="link-control-button"
                      >
                        Link Control
                      </Button>
                    </Box>
                    <Divider sx={{ mb: 2 }} />
                    {relationsLoading ? (
                      <LinearProgress />
                    ) : linkedControls.length === 0 ? (
                      <Box textAlign="center" py={3}>
                        <Typography color="text.secondary" gutterBottom>
                          No controls linked to this risk.
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Link a control to start reducing residual risk.
                        </Typography>
                      </Box>
                    ) : (
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>Code</TableCell>
                            <TableCell>Name</TableCell>
                            <TableCell>Status</TableCell>
                            <TableCell align="right">Actions</TableCell>
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
                              <TableCell align="right">
                                <Tooltip title="Unlink control">
                                  <IconButton
                                    size="small"
                                    color="error"
                                    onClick={() => handleUnlinkControl(control.id)}
                                    data-testid={`unlink-control-${control.id}`}
                                  >
                                    <DeleteIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
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
                      {risk && (
                        <TreatmentPlanTab riskId={risk.id} tenantId={risk.tenantId} />
                      )}
                    </TabPanel>

                    <TabPanel value={tabValue} index={3}>
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
                  value={formData.ownerDisplayName}
                  onChange={(e) => setFormData({ ...formData, ownerDisplayName: e.target.value })}
                />
              </Grid>
            </Grid>
            <TextField
              fullWidth
              label="Mitigation Plan"
              value={formData.mitigationPlan}
              onChange={(e) => setFormData({ ...formData, mitigationPlan: e.target.value })}
              multiline
              rows={2}
            />
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Last Reviewed"
                  type="date"
                  value={formData.lastReviewedAt}
                  onChange={(e) => setFormData({ ...formData, lastReviewedAt: e.target.value })}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
            </Grid>

            {/* ITIL Lifecycle Fields */}
            <Typography variant="subtitle2" sx={{ mt: 2, mb: 1, color: 'text.secondary' }}>
              Treatment & Review
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Treatment Strategy</InputLabel>
                  <Select
                    value={formData.treatmentStrategy}
                    label="Treatment Strategy"
                    onChange={(e) => setFormData({ ...formData, treatmentStrategy: e.target.value })}
                  >
                    <MenuItem value="">None</MenuItem>
                    <MenuItem value="avoid">Avoid</MenuItem>
                    <MenuItem value="mitigate">Mitigate</MenuItem>
                    <MenuItem value="transfer">Transfer</MenuItem>
                    <MenuItem value="accept">Accept</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Next Review Date"
                  type="date"
                  value={formData.nextReviewAt}
                  onChange={(e) => setFormData({ ...formData, nextReviewAt: e.target.value })}
                  InputLabelProps={{ shrink: true }}
                  helperText={formData.nextReviewAt && new Date(formData.nextReviewAt) < new Date() ? 'Overdue!' : ''}
                  error={formData.nextReviewAt ? new Date(formData.nextReviewAt) < new Date() : false}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Review Interval (days)"
                  type="number"
                  value={formData.reviewIntervalDays}
                  onChange={(e) => setFormData({ ...formData, reviewIntervalDays: e.target.value })}
                  inputProps={{ min: 1, max: 365 }}
                  helperText="How often should this risk be reviewed?"
                />
              </Grid>
              {formData.treatmentStrategy === 'accept' && (
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Acceptance Reason"
                    value={formData.acceptanceReason}
                    onChange={(e) => setFormData({ ...formData, acceptanceReason: e.target.value })}
                    multiline
                    rows={2}
                    helperText="Required when accepting a risk - explain why the risk is being accepted"
                  />
                </Grid>
              )}
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

      {/* Link Policy Modal */}
      <Dialog
        open={linkPolicyModalOpen}
        onClose={() => setLinkPolicyModalOpen(false)}
        maxWidth="sm"
        fullWidth
        data-testid="link-policy-modal"
      >
        <DialogTitle>Link Policies to Risk</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            <TextField
              fullWidth
              placeholder="Search policies..."
              value={policySearchTerm}
              onChange={(e) => setPolicySearchTerm(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
              }}
              sx={{ mb: 2 }}
            />
            {policiesLoading ? (
              <Box display="flex" justifyContent="center" py={3}>
                <CircularProgress size={32} />
              </Box>
            ) : availablePolicies.length === 0 ? (
              <Box textAlign="center" py={3}>
                <Typography color="text.secondary">
                  {policySearchTerm ? 'No policies found matching your search.' : 'No policies available to link.'}
                </Typography>
              </Box>
            ) : (
              <List sx={{ maxHeight: 300, overflow: 'auto' }}>
                {availablePolicies.map((policy) => (
                  <ListItem
                    key={policy.id}
                    dense
                    sx={{ borderBottom: '1px solid', borderColor: 'divider' }}
                  >
                    <Checkbox
                      edge="start"
                      checked={selectedPolicyIds.includes(policy.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedPolicyIds([...selectedPolicyIds, policy.id]);
                        } else {
                          setSelectedPolicyIds(selectedPolicyIds.filter(id => id !== policy.id));
                        }
                      }}
                    />
                    <ListItemText
                      primary={getPolicyDisplayLabel(policy)}
                      secondary={formatStatus(policy.status)}
                    />
                  </ListItem>
                ))}
              </List>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLinkPolicyModalOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleLinkPolicies}
            disabled={linkingPolicy || selectedPolicyIds.length === 0}
          >
            {linkingPolicy ? 'Linking...' : `Link ${selectedPolicyIds.length} Policy(ies)`}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Link Control Modal */}
      <Dialog
        open={linkControlModalOpen}
        onClose={() => setLinkControlModalOpen(false)}
        maxWidth="sm"
        fullWidth
        data-testid="link-control-modal"
      >
        <DialogTitle>Link Controls to Risk</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            <TextField
              fullWidth
              placeholder="Search controls..."
              value={controlSearchTerm}
              onChange={(e) => setControlSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
              }}
              sx={{ mb: 2 }}
            />
            {controlsLoading ? (
              <Box display="flex" justifyContent="center" py={3}>
                <CircularProgress size={32} />
              </Box>
            ) : availableControls.length === 0 ? (
              <Box textAlign="center" py={3}>
                <Typography color="text.secondary">
                  {controlSearchTerm ? 'No controls found matching your search.' : 'No controls available to link.'}
                </Typography>
              </Box>
            ) : (
              <List sx={{ maxHeight: 300, overflow: 'auto' }}>
                {availableControls.map((control) => (
                  <ListItem
                    key={control.id}
                    dense
                    sx={{ borderBottom: '1px solid', borderColor: 'divider' }}
                  >
                    <Checkbox
                      edge="start"
                      checked={selectedControlIds.includes(control.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedControlIds([...selectedControlIds, control.id]);
                        } else {
                          setSelectedControlIds(selectedControlIds.filter(id => id !== control.id));
                        }
                      }}
                    />
                    <ListItemText
                      primary={control.name}
                      secondary={`${control.code || 'No code'} - ${formatStatus(control.status)}`}
                    />
                  </ListItem>
                ))}
              </List>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLinkControlModalOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleLinkControls}
            disabled={linkingControl || selectedControlIds.length === 0}
          >
            {linkingControl ? 'Linking...' : `Link ${selectedControlIds.length} Control(s)`}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default RiskDetail;
