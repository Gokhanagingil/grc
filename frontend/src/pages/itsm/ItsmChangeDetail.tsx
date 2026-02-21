import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Badge,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  Grid,
  IconButton,
  InputLabel,
  List,
  ListItem,
  ListItemText,
  MenuItem,
  Select,
  TextField,
  Typography,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Save as SaveIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Delete as DeleteIcon,
  Warning as WarningIcon,
  Refresh as RefreshIcon,
  Gavel as GavelIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  PlayArrow as PlayArrowIcon,
} from '@mui/icons-material';
import { itsmApi, cmdbApi, CmdbServiceData, CmdbServiceOfferingData, ItsmCalendarConflictData, ItsmApprovalData, RiskAssessmentData, RiskFactorData } from '../../services/grcClient';
import { CustomerRiskIntelligence } from '../../components/itsm/CustomerRiskIntelligence';
import { GovernanceBanner } from '../../components/itsm/GovernanceBanner';
import { useNotification } from '../../contexts/NotificationContext';
import { useItsmChoices, ChoiceOption } from '../../hooks/useItsmChoices';
import { ActivityStream } from '../../components/itsm/ActivityStream';
import { AxiosError } from 'axios';

interface ApiValidationErrorData {
  error?: {
    message?: string;
    fieldErrors?: { field: string; message: string }[];
  };
  message?: string | string[];
}

interface ItsmChange {
  id: string;
  number: string;
  title: string;
  description?: string;
  type: string;
  state: string;
  risk: string;
  approvalStatus: string;
  implementationPlan?: string;
  backoutPlan?: string;
  plannedStartAt?: string;
  plannedEndAt?: string;
  actualStartAt?: string;
  actualEndAt?: string;
  serviceId?: string;
  offeringId?: string;
  service?: { id: string; name: string };
  createdAt: string;
  updatedAt: string;
}

interface LinkedRisk {
  id: string;
  code: string;
  name: string;
  status: string;
}

interface LinkedControl {
  id: string;
  code: string;
  name: string;
  status: string;
}

const FALLBACK_CHOICES: Record<string, ChoiceOption[]> = {
  type: [
    { value: 'STANDARD', label: 'Standard' },
    { value: 'NORMAL', label: 'Normal' },
    { value: 'EMERGENCY', label: 'Emergency' },
  ],
  state: [
    { value: 'DRAFT', label: 'Draft' },
    { value: 'ASSESS', label: 'Assess' },
    { value: 'AUTHORIZE', label: 'Authorize' },
    { value: 'IMPLEMENT', label: 'Implement' },
    { value: 'REVIEW', label: 'Review' },
    { value: 'CLOSED', label: 'Closed' },
  ],
  risk: [
    { value: 'LOW', label: 'Low' },
    { value: 'MEDIUM', label: 'Medium' },
    { value: 'HIGH', label: 'High' },
  ],
};

const APPROVAL_OPTIONS = [
  { value: 'NOT_REQUESTED', label: 'Not Requested' },
  { value: 'REQUESTED', label: 'Requested' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
];

export const ItsmChangeDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showNotification } = useNotification();
  const isNew = id === 'new';
  const { choices } = useItsmChoices('itsm_changes', FALLBACK_CHOICES);

  const typeOptions = choices['type'] || FALLBACK_CHOICES['type'];
  const stateOptions = choices['state'] || FALLBACK_CHOICES['state'];
  const riskOptions = choices['risk'] || FALLBACK_CHOICES['risk'];

  const [loading, setLoading]= useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [change, setChange] = useState<Partial<ItsmChange>>({
    title: '',
    description: '',
    type: 'NORMAL',
    state: 'DRAFT',
    risk: 'LOW',
    approvalStatus: 'NOT_REQUESTED',
  });

  // CMDB Service/Offering picker state
  const [cmdbServices, setCmdbServices] = useState<CmdbServiceData[]>([]);
  const [cmdbOfferings, setCmdbOfferings] = useState<CmdbServiceOfferingData[]>([]);

  // Conflicts state
  const [conflicts, setConflicts] = useState<ItsmCalendarConflictData[]>([]);
  const [showConflictsSection, setShowConflictsSection] = useState(true);
  const [refreshingConflicts, setRefreshingConflicts] = useState(false);

  // Risk Assessment state
  const [riskAssessment, setRiskAssessment] = useState<RiskAssessmentData | null>(null);
  const [recalculating, setRecalculating] = useState(false);
  const [showRiskTab, setShowRiskTab] = useState(true);

  // GRC Bridge state
  const [linkedRisks, setLinkedRisks] = useState<LinkedRisk[]>([]);
  const [linkedControls, setLinkedControls] = useState<LinkedControl[]>([]);
  const [showRisksSection, setShowRisksSection] = useState(false);
  const [showControlsSection, setShowControlsSection] = useState(false);

  // Approval state
  const [approvals, setApprovals] = useState<ItsmApprovalData[]>([]);
  const [showApprovals, setShowApprovals] = useState(true);
  const [approvalDialogOpen, setApprovalDialogOpen] = useState(false);
  const [approvalDialogMode, setApprovalDialogMode] = useState<'approve' | 'reject'>('approve');
  const [approvalDialogTarget, setApprovalDialogTarget] = useState<string>('');
  const [approvalComment, setApprovalComment] = useState('');
  const [approvalBusy, setApprovalBusy] = useState(false);
  const [governanceError, setGovernanceError] = useState<string | null>(null);

  const fetchChange = useCallback(async () => {
    if (isNew || !id) return;
    
    setLoading(true);
    try {
      const response = await itsmApi.changes.get(id);
      const data = response.data;
      if (data && 'data' in data) {
        setChange(data.data);
      }

      // Fetch linked risks and controls
      try {
        const risksResponse = await itsmApi.changes.getLinkedRisks(id);
        if (risksResponse.data && 'data' in risksResponse.data) {
          setLinkedRisks(Array.isArray(risksResponse.data.data) ? risksResponse.data.data : []);
        }
      } catch {
        // Ignore errors for linked risks
      }

      try {
        const controlsResponse = await itsmApi.changes.getLinkedControls(id);
        if (controlsResponse.data && 'data' in controlsResponse.data) {
          setLinkedControls(Array.isArray(controlsResponse.data.data) ? controlsResponse.data.data : []);
        }
      } catch {
        // Ignore errors for linked controls
      }

      try {
        const conflictsResponse = await itsmApi.changes.conflicts(id);
        const cData = conflictsResponse.data as { data?: ItsmCalendarConflictData[] };
        if (cData?.data) {
          setConflicts(Array.isArray(cData.data) ? cData.data : []);
        }
      } catch {
        // Ignore errors for conflicts
      }

      try {
        const riskResponse = await itsmApi.changes.getRiskAssessment(id);
        const rData = riskResponse.data as { data?: { assessment?: RiskAssessmentData } | RiskAssessmentData };
        if (rData?.data) {
          // Handle both old shape (direct assessment) and new shape ({ assessment, policyEvaluation })
          const payload = rData.data;
          if ('assessment' in payload && payload.assessment) {
            setRiskAssessment(payload.assessment);
          } else if ('riskScore' in payload) {
            setRiskAssessment(payload as RiskAssessmentData);
          }
        }
      } catch {
        // Ignore - assessment may not exist yet
      }

      try {
        const approvalsResponse = await itsmApi.changes.listApprovals(id);
        const aData = approvalsResponse.data as { data?: ItsmApprovalData[] };
        if (aData?.data) {
          setApprovals(Array.isArray(aData.data) ? aData.data : []);
        }
      } catch {
        // Ignore - approvals may not exist yet
      }
    } catch (error) {
      console.error('Error fetching ITSM change:', error);
      showNotification('Failed to load ITSM change', 'error');
      navigate('/itsm/changes');
    } finally {
      setLoading(false);
    }
  }, [id, isNew, navigate, showNotification]);

  useEffect(() => {
    fetchChange();
  }, [fetchChange]);

  useEffect(() => {
    const loadServices = async () => {
      try {
        const res = await cmdbApi.services.list({ pageSize: 100 });
        const d = res.data as { data?: { items?: CmdbServiceData[] } };
        if (d?.data?.items) setCmdbServices(d.data.items);
      } catch { /* ignore */ }
    };
    loadServices();
  }, []);

  useEffect(() => {
    const loadOfferings = async () => {
      if (!change.serviceId) {
        setCmdbOfferings([]);
        return;
      }
      try {
        const res = await cmdbApi.serviceOfferings.list({ serviceId: change.serviceId, pageSize: 100 });
        const d = res.data as { data?: { items?: CmdbServiceOfferingData[] } };
        if (d?.data?.items) setCmdbOfferings(d.data.items);
        else setCmdbOfferings([]);
      } catch { setCmdbOfferings([]); }
    };
    loadOfferings();
  }, [change.serviceId]);

  const handleChange= (field: keyof ItsmChange, value: string) => {
    setChange((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!change.title?.trim()) {
      showNotification('Title is required', 'error');
      return;
    }

    setSaving(true);
    try {
      if (isNew) {
        const response = await itsmApi.changes.create({
          title: change.title,
          description: change.description,
          type: change.type as 'STANDARD' | 'NORMAL' | 'EMERGENCY',
          risk: change.risk as 'LOW' | 'MEDIUM' | 'HIGH',
          implementationPlan: change.implementationPlan,
          backoutPlan: change.backoutPlan,
          plannedStartAt: change.plannedStartAt,
          plannedEndAt: change.plannedEndAt,
          serviceId: change.serviceId,
          offeringId: change.offeringId,
        });
        const data = response.data;
        if (data && 'data' in data && data.data?.id) {
          showNotification('Change created successfully', 'success');
          navigate(`/itsm/changes/${data.data.id}`);
        }
      } else if (id) {
        await itsmApi.changes.update(id, {
          title: change.title,
          description: change.description,
          type: change.type as 'STANDARD' | 'NORMAL' | 'EMERGENCY',
          state: change.state as 'DRAFT' | 'ASSESS' | 'AUTHORIZE' | 'IMPLEMENT' | 'REVIEW' | 'CLOSED',
          risk: change.risk as 'LOW' | 'MEDIUM' | 'HIGH',
          approvalStatus: change.approvalStatus as 'NOT_REQUESTED' | 'REQUESTED' | 'APPROVED' | 'REJECTED',
          implementationPlan: change.implementationPlan,
          backoutPlan: change.backoutPlan,
          plannedStartAt: change.plannedStartAt,
          plannedEndAt: change.plannedEndAt,
          serviceId: change.serviceId,
          offeringId: change.offeringId,
        });
        showNotification('Change updated successfully', 'success');
        fetchChange();
      }
    } catch (error: unknown) {
      console.error('Error saving change:', error);
      const axiosErr = error as AxiosError<ApiValidationErrorData>;
      const fieldErrors = axiosErr?.response?.data?.error?.fieldErrors;
      const errMsg = axiosErr?.response?.data?.error?.message;
      const msgArr = axiosErr?.response?.data?.message;
      if (fieldErrors && fieldErrors.length > 0) {
        showNotification(fieldErrors.map(e => `${e.field}: ${e.message}`).join(', '), 'error');
      } else if (errMsg) {
        showNotification(errMsg, 'error');
      } else if (Array.isArray(msgArr)) {
        showNotification(msgArr.join(', '), 'error');
      } else {
        showNotification('Failed to save change', 'error');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleRequestApproval = async () => {
    if (!id) return;
    setApprovalBusy(true);
    setGovernanceError(null);
    try {
      await itsmApi.changes.requestApproval(id);
      showNotification('CAB approval requested', 'success');
      fetchChange();
    } catch (error) {
      const axiosErr = error as AxiosError<{ message?: string; reason?: string }>;
      if (axiosErr.response?.status === 409) {
        const msg = axiosErr.response.data?.message || axiosErr.response.data?.reason || 'Conflict detected';
        setGovernanceError(msg);
      } else {
        showNotification('Failed to request approval', 'error');
      }
    } finally {
      setApprovalBusy(false);
    }
  };

  const openApprovalDialog = (mode: 'approve' | 'reject', approvalId: string) => {
    setApprovalDialogMode(mode);
    setApprovalDialogTarget(approvalId);
    setApprovalComment('');
    setApprovalDialogOpen(true);
  };

  const handleApprovalDecision = async () => {
    if (!approvalDialogTarget) return;
    setApprovalBusy(true);
    setGovernanceError(null);
    try {
      if (approvalDialogMode === 'approve') {
        await itsmApi.changes.approveApproval(approvalDialogTarget, approvalComment || undefined);
        showNotification('Approval granted', 'success');
      } else {
        await itsmApi.changes.rejectApproval(approvalDialogTarget, approvalComment || undefined);
        showNotification('Approval rejected', 'success');
      }
      setApprovalDialogOpen(false);
      fetchChange();
    } catch (error) {
      const axiosErr = error as AxiosError<{ message?: string }>;
      showNotification(axiosErr.response?.data?.message || 'Failed to process approval', 'error');
    } finally {
      setApprovalBusy(false);
    }
  };

  const handleTransitionToImplement = async () => {
    if (!id) return;
    setApprovalBusy(true);
    setGovernanceError(null);
    try {
      await itsmApi.changes.update(id, {
        state: 'IMPLEMENT' as 'DRAFT' | 'ASSESS' | 'AUTHORIZE' | 'IMPLEMENT' | 'REVIEW' | 'CLOSED',
      });
      showNotification('Change moved to Implement', 'success');
      fetchChange();
    } catch (error) {
      const axiosErr = error as AxiosError<{ message?: string; reason?: string }>;
      if (axiosErr.response?.status === 409 || axiosErr.response?.status === 403) {
        const msg = axiosErr.response.data?.message || 'Transition blocked - approvals may be required';
        setGovernanceError(msg);
      } else {
        showNotification('Failed to transition change', 'error');
      }
    } finally {
      setApprovalBusy(false);
    }
  };

  const approvalStatusLabel = change.approvalStatus || 'NOT_REQUESTED';
  const hasRequestedApprovals = approvals.some(a => a.state === 'REQUESTED');
  const allApproved = approvals.length > 0 && approvals.every(a => a.state === 'APPROVED');
  const anyRejected = approvals.some(a => a.state === 'REJECTED');

  const handleUnlinkRisk = async (riskId: string) => {
    if (!id) return;
    try {
      await itsmApi.changes.unlinkRisk(id, riskId);
      showNotification('Risk unlinked successfully', 'success');
      setLinkedRisks((prev) => prev.filter((r) => r.id !== riskId));
    } catch (error) {
      console.error('Error unlinking risk:', error);
      showNotification('Failed to unlink risk', 'error');
    }
  };

  const handleUnlinkControl = async (controlId: string) => {
    if (!id) return;
    try {
      await itsmApi.changes.unlinkControl(id, controlId);
      showNotification('Control unlinked successfully', 'success');
      setLinkedControls((prev) => prev.filter((c) => c.id !== controlId));
    } catch (error) {
      console.error('Error unlinking control:', error);
      showNotification('Failed to unlink control', 'error');
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate('/itsm/changes')}
        >
          Back to Changes
        </Button>
      </Box>

      {/* Governance Error Banner */}
      {governanceError && (
        <Alert
          severity="error"
          onClose={() => setGovernanceError(null)}
          sx={{ mb: 2 }}
          action={
            <Button color="inherit" size="small" onClick={() => navigate('/itsm/calendar')}>
              View Calendar
            </Button>
          }
        >
          {governanceError}
        </Alert>
      )}

      {/* Decision Support + Governance Strip */}
      {!isNew && riskAssessment && (
        <Card
          sx={{
            mb: 2,
            background: riskAssessment.riskLevel === 'CRITICAL'
              ? 'linear-gradient(135deg, #d32f2f 0%, #b71c1c 100%)'
              : riskAssessment.riskLevel === 'HIGH'
              ? 'linear-gradient(135deg, #ed6c02 0%, #e65100 100%)'
              : riskAssessment.riskLevel === 'MEDIUM'
              ? 'linear-gradient(135deg, #2196f3 0%, #1565c0 100%)'
              : 'linear-gradient(135deg, #2e7d32 0%, #1b5e20 100%)',
            color: 'white',
          }}
        >
          <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Box sx={{ textAlign: 'center', minWidth: 60 }}>
                  <Typography variant="h4" fontWeight={700} lineHeight={1}>
                    {riskAssessment.riskScore}
                  </Typography>
                  <Typography variant="caption" sx={{ opacity: 0.9 }}>
                    Risk Score
                  </Typography>
                </Box>
                <Divider orientation="vertical" flexItem sx={{ borderColor: 'rgba(255,255,255,0.3)' }} />
                <Box>
                  <Chip
                    label={riskAssessment.riskLevel}
                    size="small"
                    sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white', fontWeight: 600 }}
                  />
                </Box>
                <Divider orientation="vertical" flexItem sx={{ borderColor: 'rgba(255,255,255,0.3)' }} />
                <Box sx={{ display: 'flex', gap: 2 }}>
                  <Typography variant="body2" sx={{ opacity: 0.9 }}>
                    {riskAssessment.impactedCiCount} CIs impacted
                  </Typography>
                  <Typography variant="body2" sx={{ opacity: 0.9 }}>
                    {riskAssessment.impactedServiceCount} services
                  </Typography>
                </Box>
                <Divider orientation="vertical" flexItem sx={{ borderColor: 'rgba(255,255,255,0.3)' }} />
                <Chip
                  label={approvalStatusLabel.replace('_', ' ')}
                  size="small"
                  data-testid="approval-status-badge"
                  sx={{
                    bgcolor: approvalStatusLabel === 'APPROVED' ? 'rgba(76,175,80,0.3)'
                      : approvalStatusLabel === 'REJECTED' ? 'rgba(244,67,54,0.3)'
                      : approvalStatusLabel === 'REQUESTED' ? 'rgba(255,193,7,0.3)'
                      : 'rgba(255,255,255,0.2)',
                    color: 'white',
                    fontWeight: 600,
                  }}
                />
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {riskAssessment.hasFreezeConflict && (
                  <Chip
                    icon={<WarningIcon sx={{ color: 'white !important' }} />}
                    label="Freeze Window"
                    size="small"
                    sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white' }}
                  />
                )}
                {riskAssessment.hasSlaRisk && (
                  <Chip
                    icon={<WarningIcon sx={{ color: 'white !important' }} />}
                    label="SLA At Risk"
                    size="small"
                    sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white' }}
                  />
                )}
                {conflicts.length > 0 && (
                  <Chip
                    label={`${conflicts.length} conflict${conflicts.length !== 1 ? 's' : ''}`}
                    size="small"
                    sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white' }}
                  />
                )}
                {/* Governance CTA Button */}
                {approvalStatusLabel === 'NOT_REQUESTED' && (change.state === 'ASSESS' || change.state === 'AUTHORIZE') && (
                  <Button
                    variant="contained"
                    size="small"
                    startIcon={<GavelIcon />}
                    onClick={handleRequestApproval}
                    disabled={approvalBusy}
                    data-testid="request-cab-btn"
                    sx={{ bgcolor: 'rgba(255,255,255,0.25)', color: 'white', '&:hover': { bgcolor: 'rgba(255,255,255,0.4)' } }}
                  >
                    {approvalBusy ? 'Requesting...' : 'Request CAB Approval'}
                  </Button>
                )}
                {allApproved && change.state !== 'IMPLEMENT' && change.state !== 'REVIEW' && change.state !== 'CLOSED' && (
                  <Button
                    variant="contained"
                    size="small"
                    startIcon={<PlayArrowIcon />}
                    onClick={handleTransitionToImplement}
                    disabled={approvalBusy}
                    data-testid="implement-btn"
                    sx={{ bgcolor: 'rgba(76,175,80,0.5)', color: 'white', '&:hover': { bgcolor: 'rgba(76,175,80,0.7)' } }}
                  >
                    {approvalBusy ? 'Processing...' : 'Implement'}
                  </Button>
                )}
              </Box>
            </Box>
          </CardContent>
        </Card>
      )}

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" fontWeight={600}>
          {isNew ? 'New Change' : change.number}
        </Typography>
        <Button
          variant="contained"
          startIcon={<SaveIcon />}
          onClick={handleSave}
          disabled={saving}
          data-testid="change-save-btn"
        >
          {saving ? 'Saving...' : 'Save'}
        </Button>
      </Box>

      <Grid container spacing={3}>
        <Grid item xs={12} lg={8}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Change Details
              </Typography>
              <Divider sx={{ mb: 3 }} />

              <Grid container spacing={3}>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Title"
                    value={change.title || ''}
                    onChange={(e) => handleChange('title', e.target.value)}
                    required
                    data-testid="change-title-input"
                  />
                </Grid>

                <Grid item xs={12} md={6}>
                  <FormControl fullWidth>
                    <InputLabel>Type</InputLabel>
                    <Select
                      value={change.type || 'NORMAL'}
                      label="Type"
                      onChange={(e) => handleChange('type', e.target.value)}
                    >
                      {typeOptions.map((option) => (
                        <MenuItem key={option.value} value={option.value}>
                          {option.label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>

                <Grid item xs={12} md={6}>
                  <FormControl fullWidth>
                    <InputLabel>State</InputLabel>
                    <Select
                      value={change.state || 'DRAFT'}
                      label="State"
                      onChange={(e) => handleChange('state', e.target.value)}
                    >
                      {stateOptions.map((option) => (
                        <MenuItem key={option.value} value={option.value}>
                          {option.label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>

                <Grid item xs={12} md={6}>
                  <FormControl fullWidth>
                    <InputLabel>Risk</InputLabel>
                    <Select
                      value={change.risk || 'LOW'}
                      label="Risk"
                      onChange={(e) => handleChange('risk', e.target.value)}
                    >
                      {riskOptions.map((option) => (
                        <MenuItem key={option.value} value={option.value}>
                          {option.label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>

                <Grid item xs={12} md={6}>
                  <FormControl fullWidth>
                    <InputLabel>Approval Status</InputLabel>
                    <Select
                      value={change.approvalStatus || 'NOT_REQUESTED'}
                      label="Approval Status"
                      onChange={(e) => handleChange('approvalStatus', e.target.value)}
                    >
                      {APPROVAL_OPTIONS.map((option) => (
                        <MenuItem key={option.value} value={option.value}>
                          {option.label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>

                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Description"
                    value={change.description || ''}
                    onChange={(e) => handleChange('description', e.target.value)}
                    multiline
                    rows={4}
                  />
                </Grid>

                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Implementation Plan"
                    value={change.implementationPlan || ''}
                    onChange={(e) => handleChange('implementationPlan', e.target.value)}
                    multiline
                    rows={3}
                  />
                </Grid>

                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Backout Plan"
                    value={change.backoutPlan || ''}
                    onChange={(e) => handleChange('backoutPlan', e.target.value)}
                    multiline
                    rows={3}
                  />
                </Grid>

                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Planned Start"
                    type="datetime-local"
                    value={change.plannedStartAt ? change.plannedStartAt.slice(0, 16) : ''}
                    onChange={(e) => handleChange('plannedStartAt', e.target.value)}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>

                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Planned End"
                    type="datetime-local"
                    value={change.plannedEndAt ? change.plannedEndAt.slice(0, 16) : ''}
                    onChange={(e) => handleChange('plannedEndAt', e.target.value)}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} lg={4}>
          {/* CMDB Service / Offering Picker */}
          <Card sx={{ mb: 2 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Service Binding
              </Typography>
              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel>CMDB Service</InputLabel>
                <Select
                  value={change.serviceId || ''}
                  label="CMDB Service"
                  data-testid="change-service-select"
                  onChange={(e) => {
                    const val = e.target.value || undefined;
                    setChange((prev) => ({ ...prev, serviceId: val, offeringId: undefined }));
                  }}
                >
                  <MenuItem value=""><em>None</em></MenuItem>
                  {cmdbServices.map((s) => (
                    <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl fullWidth disabled={!change.serviceId}>
                <InputLabel>Offering</InputLabel>
                <Select
                  value={change.offeringId || ''}
                  label="Offering"
                  data-testid="change-offering-select"
                  onChange={(e) => {
                    const val = e.target.value || undefined;
                    setChange((prev) => ({ ...prev, offeringId: val }));
                  }}
                >
                  <MenuItem value=""><em>None</em></MenuItem>
                  {cmdbOfferings.map((o) => (
                    <MenuItem key={o.id} value={o.id}>{o.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </CardContent>
          </Card>

          {/* Scheduling & Conflicts */}
          {!isNew && (change.plannedStartAt || change.plannedEndAt || conflicts.length > 0) && (
            <Card sx={{ mb: 2 }}>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }} onClick={() => setShowConflictsSection(!showConflictsSection)}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="h6">Scheduling</Typography>
                    {conflicts.length > 0 && (
                      <Badge badgeContent={conflicts.length} color="error">
                        <WarningIcon color="error" fontSize="small" />
                      </Badge>
                    )}
                  </Box>
                  <IconButton size="small">
                    {showConflictsSection ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                  </IconButton>
                </Box>
                <Collapse in={showConflictsSection}>
                  {change.plannedStartAt && (
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      Planned Start: {new Date(change.plannedStartAt).toLocaleString()}
                    </Typography>
                  )}
                  {change.plannedEndAt && (
                    <Typography variant="body2" color="text.secondary">
                      Planned End: {new Date(change.plannedEndAt).toLocaleString()}
                    </Typography>
                  )}
                  {conflicts.length > 0 && (
                    <Box sx={{ mt: 1.5 }}>
                      <Divider sx={{ mb: 1 }} />
                      <Typography variant="subtitle2" color="error.main" gutterBottom>
                        {conflicts.length} Conflict{conflicts.length !== 1 ? 's' : ''} Detected
                      </Typography>
                      <List dense disablePadding>
                        {conflicts.map(c => (
                          <ListItem key={c.id} disableGutters sx={{ py: 0.25 }}>
                            <ListItemText
                              primary={
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                  <Chip label={c.conflictType} size="small" color={c.conflictType === 'FREEZE_WINDOW' ? 'error' : c.conflictType === 'OVERLAP' ? 'warning' : 'default'} variant="outlined" />
                                  <Chip label={c.severity} size="small" color={c.severity === 'CRITICAL' ? 'error' : c.severity === 'HIGH' ? 'warning' : 'default'} variant="outlined" />
                                </Box>
                              }
                              secondary={
                                c.conflictingEvent?.title || c.conflictingFreeze?.name || (c.details as Record<string, string>)?.reason || 'Scheduling conflict'
                              }
                            />
                          </ListItem>
                        ))}
                      </List>
                    </Box>
                  )}
                  {conflicts.length === 0 && change.plannedStartAt && change.plannedEndAt && (
                    <Typography variant="body2" color="success.main" sx={{ mt: 1 }}>
                      No scheduling conflicts detected
                    </Typography>
                  )}
                  {change.id && (
                    <Button
                      size="small"
                      startIcon={<RefreshIcon />}
                      onClick={async () => {
                        setRefreshingConflicts(true);
                        try {
                          await itsmApi.changes.refreshConflicts(change.id!);
                          const resp = await itsmApi.changes.conflicts(change.id!);
                          const d = resp.data as { data?: ItsmCalendarConflictData[] };
                          if (d?.data) setConflicts(Array.isArray(d.data) ? d.data : []);
                          showNotification('Conflicts refreshed', 'success');
                        } catch {
                          showNotification('Failed to refresh conflicts', 'error');
                        } finally {
                          setRefreshingConflicts(false);
                        }
                      }}
                      disabled={refreshingConflicts}
                      sx={{ mt: 1 }}
                    >
                      {refreshingConflicts ? 'Refreshing...' : 'Refresh Conflicts'}
                    </Button>
                  )}
                </Collapse>
              </CardContent>
            </Card>
          )}

          {/* Risk Assessment Tab */}
          {!isNew && (
            <Card sx={{ mb: 2 }}>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }} onClick={() => setShowRiskTab(!showRiskTab)}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="h6">Risk Assessment</Typography>
                    {riskAssessment && (
                      <Chip
                        label={`${riskAssessment.riskScore} - ${riskAssessment.riskLevel}`}
                        size="small"
                        color={
                          riskAssessment.riskLevel === 'CRITICAL' ? 'error'
                          : riskAssessment.riskLevel === 'HIGH' ? 'warning'
                          : riskAssessment.riskLevel === 'MEDIUM' ? 'info'
                          : 'success'
                        }
                      />
                    )}
                  </Box>
                  <IconButton size="small">
                    {showRiskTab ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                  </IconButton>
                </Box>
                <Collapse in={showRiskTab}>
                  {riskAssessment ? (
                    <Box sx={{ mt: 1.5 }}>
                      {/* Score gauge */}
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                        <Box sx={{ position: 'relative', display: 'inline-flex' }}>
                          <CircularProgress
                            variant="determinate"
                            value={riskAssessment.riskScore}
                            size={80}
                            thickness={6}
                            color={
                              riskAssessment.riskLevel === 'CRITICAL' ? 'error'
                              : riskAssessment.riskLevel === 'HIGH' ? 'warning'
                              : riskAssessment.riskLevel === 'MEDIUM' ? 'info'
                              : 'success'
                            }
                          />
                          <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Typography variant="h6" fontWeight={700}>
                              {riskAssessment.riskScore}
                            </Typography>
                          </Box>
                        </Box>
                        <Box>
                          <Typography variant="body2" color="text.secondary">
                            Computed: {new Date(riskAssessment.computedAt).toLocaleString()}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {riskAssessment.impactedCiCount} CIs, {riskAssessment.impactedServiceCount} services impacted
                          </Typography>
                        </Box>
                      </Box>

                      {/* Breakdown list */}
                      <Divider sx={{ mb: 1.5 }} />
                      <Typography variant="subtitle2" gutterBottom>Factor Breakdown</Typography>
                      <List dense disablePadding>
                        {riskAssessment.breakdown.map((factor: RiskFactorData) => (
                          <ListItem key={factor.name} disableGutters sx={{ py: 0.25 }}>
                            <ListItemText
                              primary={
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <Typography variant="body2" fontWeight={500}>
                                    {factor.name}
                                  </Typography>
                                  <Typography variant="body2" color="text.secondary">
                                    {factor.weightedScore.toFixed(1)} pts ({factor.weight}% x {factor.score})
                                  </Typography>
                                </Box>
                              }
                              secondary={
                                <Box sx={{ mt: 0.25 }}>
                                  <Box sx={{ width: '100%', height: 4, bgcolor: 'grey.200', borderRadius: 2 }}>
                                    <Box sx={{
                                      width: `${Math.min(factor.score, 100)}%`,
                                      height: '100%',
                                      bgcolor: factor.score >= 75 ? 'error.main' : factor.score >= 50 ? 'warning.main' : factor.score >= 25 ? 'info.main' : 'success.main',
                                      borderRadius: 2,
                                    }} />
                                  </Box>
                                  <Typography variant="caption" color="text.secondary">
                                    {factor.evidence}
                                  </Typography>
                                </Box>
                              }
                            />
                          </ListItem>
                        ))}
                      </List>

                      {/* Warnings */}
                      {(riskAssessment.hasFreezeConflict || riskAssessment.hasSlaRisk) && (
                        <Box sx={{ mt: 1.5 }}>
                          <Divider sx={{ mb: 1 }} />
                          {riskAssessment.hasFreezeConflict && (
                            <Chip
                              icon={<WarningIcon />}
                              label="Change overlaps with a freeze window"
                              color="error"
                              variant="outlined"
                              size="small"
                              sx={{ mr: 0.5, mb: 0.5 }}
                            />
                          )}
                          {riskAssessment.hasSlaRisk && (
                            <Chip
                              icon={<WarningIcon />}
                              label="SLA breach risk during change window"
                              color="warning"
                              variant="outlined"
                              size="small"
                              sx={{ mb: 0.5 }}
                            />
                          )}
                        </Box>
                      )}
                    </Box>
                  ) : (
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      No risk assessment computed yet. Click Recalculate to generate one.
                    </Typography>
                  )}
                  <Button
                    size="small"
                    startIcon={<RefreshIcon />}
                    onClick={async () => {
                      if (!change.id) return;
                      setRecalculating(true);
                      try {
                        const resp = await itsmApi.changes.recalculateRisk(change.id);
                        const d = resp.data as { data?: { assessment?: RiskAssessmentData } };
                        if (d?.data?.assessment) {
                          setRiskAssessment(d.data.assessment);
                        }
                        showNotification('Risk recalculated', 'success');
                      } catch {
                        showNotification('Failed to recalculate risk', 'error');
                      } finally {
                        setRecalculating(false);
                      }
                    }}
                    disabled={recalculating}
                    sx={{ mt: 1.5 }}
                  >
                    {recalculating ? 'Recalculating...' : 'Recalculate Risk'}
                  </Button>
                </Collapse>
              </CardContent>
            </Card>
          )}

          {/* Change Governance Banner */}
          {!isNew && change.id && (
            <GovernanceBanner changeId={change.id} />
          )}

          {/* Customer Risk Intelligence Panel */}
          {!isNew && change.id && (
            <CustomerRiskIntelligence changeId={change.id} />
          )}

          {/* Timestamps */}
          {!isNew && (
            <Card sx={{ mb: 2 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Timeline
                </Typography>
                {change.actualStartAt && (
                  <Typography variant="body2" color="text.secondary">
                    Actual Start: {new Date(change.actualStartAt).toLocaleString()}
                  </Typography>
                )}
                {change.actualEndAt && (
                  <Typography variant="body2" color="text.secondary">
                    Actual End: {new Date(change.actualEndAt).toLocaleString()}
                  </Typography>
                )}
                <Divider sx={{ my: 1 }} />
                <Typography variant="body2" color="text.secondary">
                  Created: {new Date(change.createdAt || '').toLocaleString()}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Updated: {new Date(change.updatedAt || '').toLocaleString()}
                </Typography>
              </CardContent>
            </Card>
          )}

          {/* CAB Approvals */}
          {!isNew && approvals.length > 0 && (
            <Card sx={{ mb: 2 }}>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }} onClick={() => setShowApprovals(!showApprovals)}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="h6">CAB Approvals</Typography>
                    <Chip
                      label={approvals.length}
                      size="small"
                      color={anyRejected ? 'error' : allApproved ? 'success' : hasRequestedApprovals ? 'warning' : 'default'}
                    />
                  </Box>
                  <IconButton size="small">
                    {showApprovals ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                  </IconButton>
                </Box>
                <Collapse in={showApprovals}>
                  <List dense disablePadding>
                    {approvals.map((a) => (
                      <ListItem key={a.id} disableGutters sx={{ py: 0.5 }}>
                        <ListItemText
                          primary={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <Chip
                                label={a.state}
                                size="small"
                                color={a.state === 'APPROVED' ? 'success' : a.state === 'REJECTED' ? 'error' : a.state === 'REQUESTED' ? 'warning' : 'default'}
                                variant="outlined"
                              />
                              <Typography variant="body2" fontWeight={500}>
                                {a.approverRole}
                              </Typography>
                            </Box>
                          }
                          secondary={
                            <Box component="span">
                              {a.decidedAt && (
                                <Typography variant="caption" color="text.secondary" component="span">
                                  {new Date(a.decidedAt).toLocaleString()}
                                </Typography>
                              )}
                              {a.comment && (
                                <Typography variant="caption" color="text.secondary" component="span" sx={{ ml: 0.5 }}>
                                  - {a.comment}
                                </Typography>
                              )}
                            </Box>
                          }
                        />
                        {a.state === 'REQUESTED' && (
                          <Box sx={{ display: 'flex', gap: 0.5 }}>
                            <IconButton
                              size="small"
                              color="success"
                              onClick={() => openApprovalDialog('approve', a.id)}
                              data-testid={`approve-btn-${a.id}`}
                            >
                              <CheckCircleIcon fontSize="small" />
                            </IconButton>
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => openApprovalDialog('reject', a.id)}
                              data-testid={`reject-btn-${a.id}`}
                            >
                              <CancelIcon fontSize="small" />
                            </IconButton>
                          </Box>
                        )}
                      </ListItem>
                    ))}
                  </List>
                </Collapse>
              </CardContent>
            </Card>
          )}

          {/* GRC Bridge - Linked Risks */}
          {!isNew && (
            <Card sx={{ mb: 2 }}>
              <CardContent>
                <Box
                  sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                  onClick={() => setShowRisksSection(!showRisksSection)}
                >
                  <Typography variant="h6">
                    Linked Risks ({linkedRisks.length})
                  </Typography>
                  <IconButton size="small">
                    {showRisksSection ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                  </IconButton>
                </Box>
                <Collapse in={showRisksSection}>
                  {linkedRisks.length === 0 ? (
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      No linked risks
                    </Typography>
                  ) : (
                    <List dense>
                      {linkedRisks.map((risk) => (
                        <ListItem
                          key={risk.id}
                          secondaryAction={
                            <IconButton edge="end" size="small" onClick={() => handleUnlinkRisk(risk.id)}>
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          }
                        >
                          <ListItemText
                            primary={risk.code}
                            secondary={risk.name}
                          />
                        </ListItem>
                      ))}
                    </List>
                  )}
                </Collapse>
              </CardContent>
            </Card>
          )}

          {/* GRC Bridge - Linked Controls */}
          {!isNew && (
            <Card>
              <CardContent>
                <Box
                  sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                  onClick={() => setShowControlsSection(!showControlsSection)}
                >
                  <Typography variant="h6">
                    Linked Controls ({linkedControls.length})
                  </Typography>
                  <IconButton size="small">
                    {showControlsSection ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                  </IconButton>
                </Box>
                <Collapse in={showControlsSection}>
                  {linkedControls.length === 0 ? (
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      No linked controls
                    </Typography>
                  ) : (
                    <List dense>
                      {linkedControls.map((control) => (
                        <ListItem
                          key={control.id}
                          secondaryAction={
                            <IconButton edge="end" size="small" onClick={() => handleUnlinkControl(control.id)}>
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          }
                        >
                          <ListItemText
                            primary={control.code}
                            secondary={control.name}
                          />
                        </ListItem>
                      ))}
                    </List>
                  )}
                </Collapse>
              </CardContent>
            </Card>
          )}
        </Grid>
      </Grid>

      {!isNew && change.id && (
        <Box sx={{ mt: 3 }}>
          <ActivityStream table="changes" recordId={change.id} />
        </Box>
      )}

      {/* Approve/Reject Dialog */}
      <Dialog open={approvalDialogOpen} onClose={() => setApprovalDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {approvalDialogMode === 'approve' ? 'Approve Change' : 'Reject Change'}
        </DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            multiline
            rows={3}
            label="Comment (optional)"
            value={approvalComment}
            onChange={(e) => setApprovalComment(e.target.value)}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setApprovalDialogOpen(false)} disabled={approvalBusy}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color={approvalDialogMode === 'approve' ? 'success' : 'error'}
            onClick={handleApprovalDecision}
            disabled={approvalBusy}
            data-testid="confirm-approval-btn"
          >
            {approvalBusy ? 'Processing...' : approvalDialogMode === 'approve' ? 'Approve' : 'Reject'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ItsmChangeDetail;
