import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Box,
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
  Warning as WarningIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  Refresh as RefreshIcon,
  AutoAwesome as CopilotIcon,
} from '@mui/icons-material';
import { itsmApi, cmdbApi, riskApi, controlApi, CmdbServiceData, CmdbServiceOfferingData, UpdateItsmIncidentDto, unwrapResponse, unwrapArrayResponse } from '../../services/grcClient';
import { useNotification } from '../../contexts/NotificationContext';
import { useAuth } from '../../contexts/AuthContext';
import { useItsmChoices, ChoiceOption } from '../../hooks/useItsmChoices';
import { CopilotPanel } from '../../components/copilot/CopilotPanel';
import { IncidentCopilotPanel } from '../../components/copilot/IncidentCopilotPanel';
import { ActivityStream } from '../../components/itsm/ActivityStream';
import { IncidentImpactTab } from '../../components/itsm/IncidentImpactTab';
import { classifyApiError } from '../../utils/apiErrorClassifier';
import {
  normalizeUpdatePayload,
  INCIDENT_UPDATE_FIELDS,
  INCIDENT_EMPTY_STRING_FIELDS,
} from '../../utils/payloadNormalizer';
import { useCompanyLookup } from '../../hooks/useCompanyLookup';
import { calculatePriorityFromMatrix, fetchTenantMatrix, getPriorityLabel, getPriorityColor } from '../../utils/priorityMatrix';
import { IncidentCommandCenter } from '../../components/itsm/IncidentCommandCenter';

interface ItsmIncident {
  id: string;
  number: string;
  shortDescription: string;
  description?: string;
  state: string;
  priority: string;
  impact: string;
  urgency: string;
  category?: string;
  riskReviewRequired: boolean;
  serviceId?: string;
  offeringId?: string;
  service?: { id: string; name: string };
  assigneeId?: string;
  assignee?: { id: string; firstName: string; lastName: string };
  requesterId?: string;
  requester?: { id: string; firstName: string; lastName: string };
  customerCompanyId?: string;
  customerCompany?: { id: string; name: string; type: string } | null;
  resolutionNotes?: string;
  openedAt?: string;
  resolvedAt?: string;
  closedAt?: string;
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

interface SlaInstanceRecord {
  id: string;
  definitionId?: string;
  definition?: { id: string; name: string; targetType?: string };
  name?: string;
  state?: string;
  startTime?: string;
  breachTime?: string;
  elapsedMs?: number;
  remainingMs?: number;
  breached?: boolean;
  paused?: boolean;
}

const FALLBACK_CHOICES: Record<string, ChoiceOption[]> = {
  status: [
    { value: 'open', label: 'Open' },
    { value: 'in_progress', label: 'In Progress' },
    { value: 'resolved', label: 'Resolved' },
    { value: 'closed', label: 'Closed' },
  ],
  priority: [
    { value: 'p1', label: 'P1 - Critical' },
    { value: 'p2', label: 'P2 - High' },
    { value: 'p3', label: 'P3 - Medium' },
    { value: 'p4', label: 'P4 - Low' },
  ],
  impact: [
    { value: 'high', label: 'High' },
    { value: 'medium', label: 'Medium' },
    { value: 'low', label: 'Low' },
  ],
  urgency: [
    { value: 'high', label: 'High' },
    { value: 'medium', label: 'Medium' },
    { value: 'low', label: 'Low' },
  ],
  category: [
    { value: 'hardware', label: 'Hardware' },
    { value: 'software', label: 'Software' },
    { value: 'network', label: 'Network' },
    { value: 'access', label: 'Access' },
    { value: 'other', label: 'Other' },
  ],
  source: [
    { value: 'user', label: 'User' },
    { value: 'monitoring', label: 'Monitoring' },
    { value: 'email', label: 'Email' },
    { value: 'phone', label: 'Phone' },
    { value: 'self_service', label: 'Self Service' },
  ],
};

export const ItsmIncidentDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { showNotification } = useNotification();
  const isNew = !id || id === 'new';
  const { choices } = useItsmChoices('itsm_incidents', FALLBACK_CHOICES);

  const stateOptions = choices['status'] || FALLBACK_CHOICES['status'];
  const impactOptions = choices['impact'] || FALLBACK_CHOICES['impact'];
  const urgencyOptions = choices['urgency'] || FALLBACK_CHOICES['urgency'];
  const categoryOptions = choices['category'] || FALLBACK_CHOICES['category'];
  const { companies } = useCompanyLookup();

  const handleBackToList= useCallback(() => {
    const returnParams = searchParams.get('returnParams');
    if (returnParams) {
      navigate(`/itsm/incidents?${decodeURIComponent(returnParams)}`);
    } else {
      navigate('/itsm/incidents');
    }
  }, [navigate, searchParams]);

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [incident, setIncident] = useState<Partial<ItsmIncident>>({
    shortDescription: '',
    description: '',
    state: 'open',
    priority: 'p3',
    impact: 'medium',
    urgency: 'medium',
  });

  // CMDB Service/Offering picker state
  const [cmdbServices, setCmdbServices] = useState<CmdbServiceData[]>([]);
  const [cmdbOfferings, setCmdbOfferings] = useState<CmdbServiceOfferingData[]>([]);

  // GRC Bridge state
  const [linkedRisks, setLinkedRisks] = useState<LinkedRisk[]>([]);
  const [linkedControls, setLinkedControls] = useState<LinkedControl[]>([]);
  const [showRisksSection, setShowRisksSection] = useState(false);
  const [showControlsSection, setShowControlsSection] = useState(false);
  const [copilotOpen, setCopilotOpen] = useState(false);
  const [aiCopilotOpen, setAiCopilotOpen] = useState(false);

  // SLA linkage state
  const [slaInstances, setSlaInstances] = useState<SlaInstanceRecord[]>([]);
  const [showSlaSection, setShowSlaSection] = useState(true);
  const [slaRefreshing, setSlaRefreshing] = useState(false);

  // Tenant-specific priority matrix for live recalculation
  const [tenantMatrix, setTenantMatrix] = useState<Record<string, Record<string, string>> | null>(null);
  const [matrixSource, setMatrixSource] = useState<'tenant' | 'default' | null>(null);

  // Affected CI count for command center (derived from IncidentImpactTab data)
  const [affectedCiCount, setAffectedCiCount] = useState(0);

  // Link Risk/Control dialog state
  const [linkRiskOpen, setLinkRiskOpen] = useState(false);
  const [linkControlOpen, setLinkControlOpen] = useState(false);
  const [availableRisks, setAvailableRisks] = useState<LinkedRisk[]>([]);
  const [availableControls, setAvailableControls] = useState<LinkedControl[]>([]);
  const [linkingRiskId, setLinkingRiskId] = useState<string | null>(null);
  const [linkingControlId, setLinkingControlId] = useState<string | null>(null);
  const [linkSearchRisk, setLinkSearchRisk] = useState('');
  const [linkSearchControl, setLinkSearchControl] = useState('');

  // Auth context for tenant-scoped API calls
  const { user } = useAuth();
  const tenantId = user?.tenantId || '';

  const fetchIncident = useCallback(async () => {
    if (isNew || !id) return;
    
    setLoading(true);
    try {
      const response = await itsmApi.incidents.get(id);
      const record = unwrapResponse<Record<string, unknown>>(response);
      if (record && typeof record === 'object' && 'id' in record) {
        // Backend returns 'status', frontend interface uses 'state'
        // Map status → state so UI rendering and save both work correctly
        setIncident({
          ...record,
          state: (record.status as string) || (record.state as string) || 'open',
        } as Partial<ItsmIncident>);
      }

      // Fetch linked risks and controls
      try {
        const risksResponse = await itsmApi.incidents.getLinkedRisks(id);
        setLinkedRisks(unwrapArrayResponse<LinkedRisk>(risksResponse));
      } catch {
        // Ignore errors for linked risks
      }

      try {
        const controlsResponse = await itsmApi.incidents.getLinkedControls(id);
        setLinkedControls(unwrapArrayResponse<LinkedControl>(controlsResponse));
      } catch {
        // Ignore errors for linked controls
      }

      // Fetch SLA instances for this incident
      try {
        const slaResponse = await itsmApi.sla.recordSlas('Incident', id);
        setSlaInstances(unwrapArrayResponse<SlaInstanceRecord>(slaResponse));
      } catch {
        // SLA fetch is non-critical — show empty state
        setSlaInstances([]);
      }
    } catch (error) {
      console.error('Error fetching ITSM incident:', error);
      showNotification('Failed to load ITSM incident', 'error');
      handleBackToList();
    } finally {
      setLoading(false);
    }
  }, [id, isNew, handleBackToList, showNotification]);

  useEffect(() => {
    fetchIncident();
  }, [fetchIncident]);

  // Fetch tenant-specific priority matrix for live recalculation
  useEffect(() => {
    const loadMatrix = async () => {
      try {
        const matrix = await fetchTenantMatrix();
        setTenantMatrix(matrix);
        // Detect if the returned matrix differs from ITIL default (has custom entries)
        setMatrixSource('tenant');
      } catch {
        // Keep using default matrix on error
        setMatrixSource('default');
      }
    };
    loadMatrix();
  }, []);

  // Fetch affected CI count for command center health indicators
  useEffect(() => {
    if (isNew || !id) return;
    const loadCiCount = async () => {
      try {
        const response = await itsmApi.incidents.listAffectedCis(id, { page: 1, pageSize: 1 });
        const d = response.data as { data?: { total?: number } };
        setAffectedCiCount(d?.data?.total ?? 0);
      } catch {
        setAffectedCiCount(0);
      }
    };
    loadCiCount();
  }, [id, isNew]);

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
      if (!incident.serviceId) {
        setCmdbOfferings([]);
        return;
      }
      try {
        const res = await cmdbApi.serviceOfferings.list({ serviceId: incident.serviceId, pageSize: 100 });
        const d = res.data as { data?: { items?: CmdbServiceOfferingData[] } };
        if (d?.data?.items) setCmdbOfferings(d.data.items);
        else setCmdbOfferings([]);
      } catch { setCmdbOfferings([]); }
    };
    loadOfferings();
  }, [incident.serviceId]);

  const handleChange = (field: keyof ItsmIncident, value: string) => {
    setIncident((prev) => {
      const updated = { ...prev, [field]: value };
      // Live priority recalculation when impact or urgency changes
      // Uses tenant-specific matrix from ITSM Studio if available
      if (field === 'impact' || field === 'urgency') {
        updated.priority = calculatePriorityFromMatrix(
          field === 'impact' ? value : prev.impact,
          field === 'urgency' ? value : prev.urgency,
          tenantMatrix,
        );
      }
      return updated;
    });
  };

  const handleSave = async () => {
    if (!incident.shortDescription?.trim()) {
      showNotification('Short description is required', 'error');
      return;
    }

    setSaving(true);
    try {
      if (isNew) {
        // CREATE: Only send fields accepted by backend CreateIncidentDto
        // Do NOT send state, priority (server-managed / computed from impact+urgency)
        const createPayload = {
          shortDescription: incident.shortDescription,
          description: incident.description || undefined,
          impact: incident.impact || undefined,
          urgency: incident.urgency || undefined,
          category: incident.category || undefined, // empty string → undefined to avoid enum validation failure
          serviceId: incident.serviceId || undefined,
          offeringId: incident.offeringId || undefined,
          customerCompanyId: incident.customerCompanyId || undefined,
        };
        const response = await itsmApi.incidents.create(createPayload);
        const created = unwrapResponse<{ id?: string }>(response);
        const recordId = created && typeof created === 'object' && 'id' in created
          ? created.id
          : undefined;
        if (recordId) {
          showNotification('Incident created successfully', 'success');
          navigate(`/itsm/incidents/${recordId}`);
        } else {
          console.warn('[ItsmIncidentDetail] Create succeeded but response shape unexpected:', created);
          showNotification('Incident created. Redirecting to list.', 'success');
          navigate('/itsm/incidents');
        }
      } else if (id) {
        // UPDATE: Backend expects 'status' not 'state'; 'priority' is computed (forbidden), do not send.
        // Use normalizeUpdatePayload to strip forbidden fields and empty strings.
        const rawPayload: Record<string, unknown> = {
          shortDescription: incident.shortDescription,
          description: incident.description || undefined,
          status: incident.state || undefined, // frontend uses 'state', backend DTO expects 'status'
          impact: incident.impact || undefined,
          urgency: incident.urgency || undefined,
          category: incident.category || undefined,
          resolutionNotes: incident.resolutionNotes || undefined,
          serviceId: incident.serviceId || undefined,
          offeringId: incident.offeringId || undefined,
          customerCompanyId: incident.customerCompanyId || undefined,
        };
        const cleanPayload = normalizeUpdatePayload(
          rawPayload,
          INCIDENT_UPDATE_FIELDS,
          INCIDENT_EMPTY_STRING_FIELDS,
        );
        await itsmApi.incidents.update(id, cleanPayload as UpdateItsmIncidentDto);
        showNotification('Incident updated successfully', 'success');
        fetchIncident();
        refreshCiCount();
      }
    } catch (error: unknown) {
      console.error('Error saving incident:', error);
      const classified = classifyApiError(error);
      if (classified.kind === 'forbidden') {
        showNotification('You don\'t have permission to save incidents.', 'error');
      } else if (classified.kind === 'validation') {
        showNotification(`Validation failed: ${classified.message}`, 'error');
      } else if (classified.kind === 'conflict') {
        showNotification(classified.message, 'error');
      } else {
        showNotification(classified.message || 'Failed to save incident', 'error');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleUnlinkRisk = async (riskId: string) => {
    if (!id) return;
    try {
      await itsmApi.incidents.unlinkRisk(id, riskId);
      showNotification('Risk unlinked successfully', 'success');
      setLinkedRisks((prev) => prev.filter((r) => r.id !== riskId));
    } catch (error) {
      const classified = classifyApiError(error);
      if (classified.kind === 'forbidden') {
        showNotification('Permission denied: Cannot unlink risk.', 'error');
      } else if (classified.kind === 'not_found') {
        showNotification('Risk link not found. It may have already been removed.', 'warning');
        setLinkedRisks((prev) => prev.filter((r) => r.id !== riskId));
      } else {
        showNotification(classified.message || 'Failed to unlink risk', 'error');
      }
    }
  };

  const handleUnlinkControl = async (controlId: string) => {
    if (!id) return;
    try {
      await itsmApi.incidents.unlinkControl(id, controlId);
      showNotification('Control unlinked successfully', 'success');
      setLinkedControls((prev) => prev.filter((c) => c.id !== controlId));
    } catch (error) {
      const classified = classifyApiError(error);
      if (classified.kind === 'forbidden') {
        showNotification('Permission denied: Cannot unlink control.', 'error');
      } else if (classified.kind === 'not_found') {
        showNotification('Control link not found. It may have already been removed.', 'warning');
        setLinkedControls((prev) => prev.filter((c) => c.id !== controlId));
      } else {
        showNotification(classified.message || 'Failed to unlink control', 'error');
      }
    }
  };

  // B1: Link Risk handler
  const handleOpenLinkRisk = async () => {
    setLinkRiskOpen(true);
    setLinkSearchRisk('');
    if (!tenantId) {
      showNotification('Tenant context missing. Cannot load risks.', 'warning');
      return;
    }
    try {
      const resp = await riskApi.list(tenantId);
      const items = unwrapArrayResponse<LinkedRisk>(resp);
      // Filter out already-linked risks
      const linkedIds = new Set(linkedRisks.map((r) => r.id));
      setAvailableRisks(items.filter((r) => !linkedIds.has(r.id)));
    } catch (error) {
      const classified = classifyApiError(error);
      if (classified.kind === 'forbidden') {
        showNotification('Permission denied: Cannot view risks.', 'error');
      } else {
        showNotification('Failed to load available risks', 'error');
      }
      setAvailableRisks([]);
    }
  };

  const handleLinkRisk = async (riskId: string) => {
    if (!id) return;
    setLinkingRiskId(riskId);
    try {
      await itsmApi.incidents.linkRisk(id, riskId);
      showNotification('Risk linked successfully', 'success');
      // Refresh linked risks
      const risksResponse = await itsmApi.incidents.getLinkedRisks(id);
      setLinkedRisks(unwrapArrayResponse<LinkedRisk>(risksResponse));
      setLinkRiskOpen(false);
    } catch (error) {
      const classified = classifyApiError(error);
      showNotification(classified.message || 'Failed to link risk', 'error');
    } finally {
      setLinkingRiskId(null);
    }
  };

  // B2: Link Control handler
  const handleOpenLinkControl = async () => {
    setLinkControlOpen(true);
    setLinkSearchControl('');
    if (!tenantId) {
      showNotification('Tenant context missing. Cannot load controls.', 'warning');
      return;
    }
    try {
      const resp = await controlApi.list(tenantId);
      const items = unwrapArrayResponse<LinkedControl>(resp);
      // Filter out already-linked controls
      const linkedIds = new Set(linkedControls.map((c) => c.id));
      setAvailableControls(items.filter((c) => !linkedIds.has(c.id)));
    } catch (error) {
      const classified = classifyApiError(error);
      if (classified.kind === 'forbidden') {
        showNotification('Permission denied: Cannot view controls.', 'error');
      } else {
        showNotification('Failed to load available controls', 'error');
      }
      setAvailableControls([]);
    }
  };

  const handleLinkControl = async (controlId: string) => {
    if (!id) return;
    setLinkingControlId(controlId);
    try {
      await itsmApi.incidents.linkControl(id, controlId);
      showNotification('Control linked successfully', 'success');
      // Refresh linked controls
      const controlsResponse = await itsmApi.incidents.getLinkedControls(id);
      setLinkedControls(unwrapArrayResponse<LinkedControl>(controlsResponse));
      setLinkControlOpen(false);
    } catch (error) {
      const classified = classifyApiError(error);
      showNotification(classified.message || 'Failed to link control', 'error');
    } finally {
      setLinkingControlId(null);
    }
  };

  // B3: SLA Refresh handler
  const handleRefreshSla = async () => {
    if (!id) return;
    setSlaRefreshing(true);
    try {
      const slaResponse = await itsmApi.sla.recordSlas('Incident', id);
      setSlaInstances(unwrapArrayResponse<SlaInstanceRecord>(slaResponse));
      showNotification('SLA data refreshed', 'success');
    } catch (error) {
      const classified = classifyApiError(error);
      if (classified.kind === 'forbidden') {
        showNotification('Permission denied: Cannot refresh SLA data.', 'error');
      } else if (classified.kind === 'network') {
        showNotification('Network error refreshing SLA. Check your connection.', 'error');
      } else {
        showNotification(classified.message || 'Failed to refresh SLA data', 'error');
      }
    } finally {
      setSlaRefreshing(false);
    }
  };

  // B4: Recalculate Priority handler (re-fetch tenant matrix and recompute)
  const handleRecalculatePriority = async () => {
    try {
      const matrix = await fetchTenantMatrix();
      setTenantMatrix(matrix);
      setMatrixSource('tenant');
      const newPriority = calculatePriorityFromMatrix(
        incident.impact,
        incident.urgency,
        matrix,
      );
      setIncident((prev) => ({ ...prev, priority: newPriority }));
      showNotification(`Priority recalculated: ${newPriority.toUpperCase()}`, 'success');
    } catch {
      setMatrixSource('default');
      showNotification('Using default ITIL matrix for priority calculation', 'info');
    }
  };

  // B5: Refresh CI count after save/tab operations
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const refreshCiCount = useCallback(async () => {
    if (!id) return;
    try {
      const response = await itsmApi.incidents.listAffectedCis(id, { page: 1, pageSize: 1 });
      const d = response.data as { data?: { total?: number } };
      setAffectedCiCount(d?.data?.total ?? 0);
    } catch {
      // non-critical
    }
  }, [id]);

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
          onClick={handleBackToList}
        >
          Back to Incidents
        </Button>
      </Box>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography variant="h4" fontWeight={600}>
            {isNew ? 'New Incident' : incident.number}
          </Typography>
          {incident.riskReviewRequired && (
            <Chip
              icon={<WarningIcon />}
              label="Risk Review Required"
              color="error"
            />
          )}
        </Box>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          {!isNew && incident.id && (
            <>
              <Button
                variant="outlined"
                size="small"
                startIcon={<RefreshIcon />}
                onClick={handleRecalculatePriority}
                title="Re-fetch priority matrix and recalculate"
                data-testid="recalculate-priority-btn"
              >
                Recalculate Priority
              </Button>
              <Button
                variant="outlined"
                size="small"
                startIcon={<RefreshIcon />}
                onClick={handleRefreshSla}
                disabled={slaRefreshing}
                title="Refresh SLA records"
                data-testid="refresh-sla-btn"
              >
                {slaRefreshing ? 'Refreshing...' : 'Refresh SLA'}
              </Button>
              <Button
                variant="outlined"
                startIcon={<CopilotIcon />}
                onClick={() => setCopilotOpen(true)}
                color="secondary"
              >
                Copilot
              </Button>
              <Button
                variant="contained"
                startIcon={<CopilotIcon />}
                onClick={() => setAiCopilotOpen(true)}
                color="primary"
                size="small"
                data-testid="ai-copilot-btn"
              >
                AI Analyze
              </Button>
            </>
          )}
          <Button
            variant="contained"
            startIcon={<SaveIcon />}
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </Box>
      </Box>

      {/* ── Incident Command Center (WOW) ── */}
      {!isNew && incident.id && (
        <IncidentCommandCenter
          incident={incident}
          linkedRisks={linkedRisks}
          linkedControls={linkedControls}
          slaInstances={slaInstances}
          affectedCiCount={affectedCiCount}
          matrixSource={matrixSource}
        />
      )}

      <Grid container spacing={3}>
        <Grid item xs={12} lg={8}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Incident Details
              </Typography>
              <Divider sx={{ mb: 3 }} />

              <Grid container spacing={3}>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Short Description"
                    value={incident.shortDescription || ''}
                    onChange={(e) => handleChange('shortDescription', e.target.value)}
                    required
                  />
                </Grid>

                <Grid item xs={12} md={6}>
                  <FormControl fullWidth>
                    <InputLabel>State</InputLabel>
                    <Select
                      value={incident.state || 'open'}
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
                  <TextField
                    fullWidth
                    label="Priority"
                    value={getPriorityLabel(incident.priority || 'p3')}
                    InputProps={{
                      readOnly: true,
                      startAdornment: (
                        <Chip
                          label={(incident.priority || 'p3').toUpperCase()}
                          size="small"
                          color={getPriorityColor(incident.priority || 'p3')}
                          sx={{ mr: 1 }}
                        />
                      ),
                    }}
                    helperText={
                      `Computed: Impact (${(incident.impact || 'medium').charAt(0).toUpperCase() + (incident.impact || 'medium').slice(1)}) × Urgency (${(incident.urgency || 'medium').charAt(0).toUpperCase() + (incident.urgency || 'medium').slice(1)}) via ${matrixSource === 'tenant' ? 'Tenant' : 'ITIL'} Matrix`
                    }
                    data-testid="incident-priority-readonly"
                  />
                </Grid>

                <Grid item xs={12} md={6}>
                  <FormControl fullWidth>
                    <InputLabel>Impact</InputLabel>
                    <Select
                      value={incident.impact || 'medium'}
                      label="Impact"
                      onChange={(e) => handleChange('impact', e.target.value)}
                    >
                      {impactOptions.map((option) => (
                        <MenuItem key={option.value} value={option.value}>
                          {option.label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>

                <Grid item xs={12} md={6}>
                  <FormControl fullWidth>
                    <InputLabel>Urgency</InputLabel>
                    <Select
                      value={incident.urgency || 'medium'}
                      label="Urgency"
                      onChange={(e) => handleChange('urgency', e.target.value)}
                    >
                      {urgencyOptions.map((option) => (
                        <MenuItem key={option.value} value={option.value}>
                          {option.label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>

                <Grid item xs={12} md={6}>
                  <FormControl fullWidth>
                    <InputLabel>Category</InputLabel>
                    <Select
                      value={incident.category || ''}
                      label="Category"
                      onChange={(e) => handleChange('category', e.target.value)}
                    >
                      <MenuItem value=""><em>None</em></MenuItem>
                      {categoryOptions.map((option) => (
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
                    value={incident.description || ''}
                    onChange={(e) => handleChange('description', e.target.value)}
                    multiline
                    rows={4}
                  />
                </Grid>

                {(incident.state === 'resolved' || incident.state === 'closed') && (
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Resolution Notes"
                      value={incident.resolutionNotes || ''}
                      onChange={(e) => handleChange('resolutionNotes', e.target.value)}
                      multiline
                      rows={3}
                    />
                  </Grid>
                )}
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
                  value={incident.serviceId || ''}
                  label="CMDB Service"
                  data-testid="incident-service-select"
                  onChange={(e) => {
                    const val = e.target.value || undefined;
                    setIncident((prev) => ({ ...prev, serviceId: val, offeringId: undefined }));
                  }}
                >
                  <MenuItem value=""><em>None</em></MenuItem>
                  {cmdbServices.map((s) => (
                    <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl fullWidth disabled={!incident.serviceId}>
                <InputLabel>Offering</InputLabel>
                <Select
                  value={incident.offeringId || ''}
                  label="Offering"
                  data-testid="incident-offering-select"
                  onChange={(e) => {
                    const val = e.target.value || undefined;
                    setIncident((prev) => ({ ...prev, offeringId: val }));
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

          {/* Customer Company */}
          <Card sx={{ mb: 2 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Customer Company
              </Typography>
              <FormControl fullWidth>
                <InputLabel>Company</InputLabel>
                <Select
                  value={incident.customerCompanyId || ''}
                  label="Company"
                  data-testid="incident-company-select"
                  onChange={(e) => {
                    const val = e.target.value || undefined;
                    setIncident((prev) => ({ ...prev, customerCompanyId: val }));
                  }}
                >
                  <MenuItem value=""><em>None</em></MenuItem>
                  {companies.map((c) => (
                    <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </CardContent>
          </Card>

          {/* Timestamps */}
          {!isNew && (
            <Card sx={{ mb: 2 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Timeline
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Opened: {incident.openedAt ? new Date(incident.openedAt).toLocaleString() : '-'}
                </Typography>
                {incident.resolvedAt && (
                  <Typography variant="body2" color="text.secondary">
                    Resolved: {new Date(incident.resolvedAt).toLocaleString()}
                  </Typography>
                )}
                {incident.closedAt && (
                  <Typography variant="body2" color="text.secondary">
                    Closed: {new Date(incident.closedAt).toLocaleString()}
                  </Typography>
                )}
                <Divider sx={{ my: 1 }} />
                <Typography variant="body2" color="text.secondary">
                  Created: {new Date(incident.createdAt || '').toLocaleString()}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Updated: {new Date(incident.updatedAt || '').toLocaleString()}
                </Typography>
              </CardContent>
            </Card>
          )}

          {/* SLA Linkage */}
          {!isNew && (
            <Card sx={{ mb: 2 }} data-testid="incident-sla-section">
              <CardContent>
                <Box
                  sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                  onClick={() => setShowSlaSection(!showSlaSection)}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="h6">
                      SLA Linkage ({slaInstances.length})
                    </Typography>
                    <IconButton
                      size="small"
                      onClick={(e) => { e.stopPropagation(); handleRefreshSla(); }}
                      disabled={slaRefreshing}
                      title="Refresh SLA data"
                      data-testid="sla-refresh-btn"
                    >
                      {slaRefreshing ? <CircularProgress size={16} /> : <RefreshIcon fontSize="small" />}
                    </IconButton>
                  </Box>
                  <IconButton size="small">
                    {showSlaSection ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                  </IconButton>
                </Box>
                <Collapse in={showSlaSection}>
                  {slaInstances.length === 0 ? (
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }} data-testid="sla-empty-state">
                      No SLA records linked to this incident
                    </Typography>
                  ) : (
                    <List dense>
                      {slaInstances.map((sla) => (
                        <ListItem key={sla.id} disableGutters>
                          <ListItemText
                            primary={sla.definition?.name || sla.name || sla.id}
                            secondary={
                              <>
                                {sla.state && `State: ${sla.state}`}
                                {sla.breached != null && (
                                  <Chip
                                    label={sla.breached ? 'Breached' : 'Within SLA'}
                                    size="small"
                                    color={sla.breached ? 'error' : 'success'}
                                    variant="outlined"
                                    sx={{ ml: 1 }}
                                  />
                                )}
                              </>
                            }
                          />
                        </ListItem>
                      ))}
                    </List>
                  )}
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
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="h6">
                      Linked Risks ({linkedRisks.length})
                    </Typography>
                    <IconButton
                      size="small"
                      onClick={(e) => { e.stopPropagation(); handleOpenLinkRisk(); }}
                      title="Link a risk"
                      data-testid="link-risk-btn"
                    >
                      <AddIcon fontSize="small" />
                    </IconButton>
                  </Box>
                  <IconButton size="small">
                    {showRisksSection ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                  </IconButton>
                </Box>
                <Collapse in={showRisksSection}>
                  {linkedRisks.length === 0 ? (
                    <Box sx={{ textAlign: 'center', py: 2 }} data-testid="risks-empty-state">
                      <WarningIcon sx={{ fontSize: 32, color: 'text.disabled', mb: 0.5 }} />
                      <Typography variant="body2" color="text.secondary">
                        No linked risks yet
                      </Typography>
                      <Button
                        size="small"
                        startIcon={<AddIcon />}
                        onClick={handleOpenLinkRisk}
                        sx={{ mt: 1 }}
                      >
                        Link a Risk
                      </Button>
                    </Box>
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
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="h6">
                      Linked Controls ({linkedControls.length})
                    </Typography>
                    <IconButton
                      size="small"
                      onClick={(e) => { e.stopPropagation(); handleOpenLinkControl(); }}
                      title="Link a control"
                      data-testid="link-control-btn"
                    >
                      <AddIcon fontSize="small" />
                    </IconButton>
                  </Box>
                  <IconButton size="small">
                    {showControlsSection ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                  </IconButton>
                </Box>
                <Collapse in={showControlsSection}>
                  {linkedControls.length === 0 ? (
                    <Box sx={{ textAlign: 'center', py: 2 }} data-testid="controls-empty-state">
                      <WarningIcon sx={{ fontSize: 32, color: 'text.disabled', mb: 0.5 }} />
                      <Typography variant="body2" color="text.secondary">
                        No linked controls yet
                      </Typography>
                      <Button
                        size="small"
                        startIcon={<AddIcon />}
                        onClick={handleOpenLinkControl}
                        sx={{ mt: 1 }}
                      >
                        Link a Control
                      </Button>
                    </Box>
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

      {!isNew && incident.id && (
        <Box sx={{ mt: 3 }}>
          <IncidentImpactTab incidentId={incident.id} />
        </Box>
      )}

      {!isNew && incident.id && (
        <Box sx={{ mt: 3 }}>
          <ActivityStream table="incidents" recordId={incident.id} />
        </Box>
      )}

      {!isNew && incident.id && incident.number && (
        <CopilotPanel
          open={copilotOpen}
          onClose={() => setCopilotOpen(false)}
          incidentSysId={incident.id}
          incidentNumber={incident.number}
        />
      )}

      {!isNew && incident.id && incident.number && (
        <IncidentCopilotPanel
          open={aiCopilotOpen}
          onClose={() => setAiCopilotOpen(false)}
          incidentId={incident.id}
          incidentNumber={incident.number}
        />
      )}

      {/* B1: Link Risk Dialog */}
      <Dialog open={linkRiskOpen} onClose={() => setLinkRiskOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Link Risk to Incident</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            size="small"
            placeholder="Search risks by code or name..."
            value={linkSearchRisk}
            onChange={(e) => setLinkSearchRisk(e.target.value)}
            sx={{ mb: 2, mt: 1 }}
            data-testid="link-risk-search"
          />
          {availableRisks.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No available risks to link
            </Typography>
          ) : (
            <List dense sx={{ maxHeight: 300, overflow: 'auto' }}>
              {availableRisks
                .filter((r) => {
                  if (!linkSearchRisk) return true;
                  const q = linkSearchRisk.toLowerCase();
                  return (r.code || '').toLowerCase().includes(q) || (r.name || '').toLowerCase().includes(q);
                })
                .map((risk) => (
                  <ListItem
                    key={risk.id}
                    secondaryAction={
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => handleLinkRisk(risk.id)}
                        disabled={linkingRiskId === risk.id}
                      >
                        {linkingRiskId === risk.id ? 'Linking...' : 'Link'}
                      </Button>
                    }
                  >
                    <ListItemText primary={risk.code || risk.id} secondary={risk.name} />
                  </ListItem>
                ))}
            </List>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLinkRiskOpen(false)}>Cancel</Button>
        </DialogActions>
      </Dialog>

      {/* B2: Link Control Dialog */}
      <Dialog open={linkControlOpen} onClose={() => setLinkControlOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Link Control to Incident</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            size="small"
            placeholder="Search controls by code or name..."
            value={linkSearchControl}
            onChange={(e) => setLinkSearchControl(e.target.value)}
            sx={{ mb: 2, mt: 1 }}
            data-testid="link-control-search"
          />
          {availableControls.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No available controls to link
            </Typography>
          ) : (
            <List dense sx={{ maxHeight: 300, overflow: 'auto' }}>
              {availableControls
                .filter((c) => {
                  if (!linkSearchControl) return true;
                  const q = linkSearchControl.toLowerCase();
                  return (c.code || '').toLowerCase().includes(q) || (c.name || '').toLowerCase().includes(q);
                })
                .map((control) => (
                  <ListItem
                    key={control.id}
                    secondaryAction={
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => handleLinkControl(control.id)}
                        disabled={linkingControlId === control.id}
                      >
                        {linkingControlId === control.id ? 'Linking...' : 'Link'}
                      </Button>
                    }
                  >
                    <ListItemText primary={control.code || control.id} secondary={control.name} />
                  </ListItem>
                ))}
            </List>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLinkControlOpen(false)}>Cancel</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ItsmIncidentDetail;
