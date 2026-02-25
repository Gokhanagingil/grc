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
import { ActivityStream } from '../../components/itsm/ActivityStream';
import { IncidentImpactTab } from '../../components/itsm/IncidentImpactTab';
import { classifyApiError } from '../../utils/apiErrorClassifier';
import {
  normalizeUpdatePayload,
  INCIDENT_UPDATE_FIELDS,
  INCIDENT_EMPTY_STRING_FIELDS,
} from '../../utils/payloadNormalizer';
import { calculatePriorityFromMatrix, getPriorityLabel, getPriorityColor } from '../../utils/priorityMatrix';

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

  // SLA linkage state
  const [slaInstances, setSlaInstances] = useState<SlaInstanceRecord[]>([]);
  const [showSlaSection, setShowSlaSection] = useState(true);
  const [slaRefreshing, setSlaRefreshing] = useState(false);

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
      if (field === 'impact' || field === 'urgency') {
        updated.priority = calculatePriorityFromMatrix(
          field === 'impact' ? value : prev.impact,
          field === 'urgency' ? value : prev.urgency,
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
        };
        const cleanPayload = normalizeUpdatePayload(
          rawPayload,
          INCIDENT_UPDATE_FIELDS,
          INCIDENT_EMPTY_STRING_FIELDS,
        );
        await itsmApi.incidents.update(id, cleanPayload as UpdateItsmIncidentDto);
        showNotification('Incident updated successfully', 'success');
        fetchIncident();
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
    }finally {
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
      console.error('Error unlinking risk:', error);
      showNotification('Failed to unlink risk', 'error');
    }
  };

  const handleUnlinkControl = async (controlId: string) => {
    if (!id) return;
    try {
      await itsmApi.incidents.unlinkControl(id, controlId);
      showNotification('Control unlinked successfully', 'success');
      setLinkedControls((prev) => prev.filter((c) => c.id !== controlId));
    } catch (error) {
      console.error('Error unlinking control:', error);
      showNotification('Failed to unlink control', 'error');
    }
  };

  // B1: Link Risk handler
  const handleOpenLinkRisk = async () => {
    setLinkRiskOpen(true);
    setLinkSearchRisk('');
    if (!tenantId) return;
    try {
      const resp = await riskApi.list(tenantId);
      const items = unwrapArrayResponse<LinkedRisk>(resp);
      // Filter out already-linked risks
      const linkedIds = new Set(linkedRisks.map((r) => r.id));
      setAvailableRisks(items.filter((r) => !linkedIds.has(r.id)));
    } catch {
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
    if (!tenantId) return;
    try {
      const resp = await controlApi.list(tenantId);
      const items = unwrapArrayResponse<LinkedControl>(resp);
      // Filter out already-linked controls
      const linkedIds = new Set(linkedControls.map((c) => c.id));
      setAvailableControls(items.filter((c) => !linkedIds.has(c.id)));
    } catch {
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
    } catch {
      showNotification('Failed to refresh SLA data', 'error');
    } finally {
      setSlaRefreshing(false);
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
        <Box sx={{ display: 'flex', gap: 1 }}>
          {!isNew && incident.id && (
            <Button
              variant="outlined"
              startIcon={<CopilotIcon />}
              onClick={() => setCopilotOpen(true)}
              color="secondary"
            >
              Copilot
            </Button>
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

      {/* Incident Intelligence Summary — WOW card */}
      {!isNew && incident.id && (
        <Card
          sx={{
            mb: 3,
            background: incident.priority === 'p1'
              ? 'linear-gradient(135deg, #d32f2f 0%, #b71c1c 100%)'
              : incident.priority === 'p2'
              ? 'linear-gradient(135deg, #ed6c02 0%, #e65100 100%)'
              : incident.priority === 'p3'
              ? 'linear-gradient(135deg, #2196f3 0%, #1565c0 100%)'
              : 'linear-gradient(135deg, #2e7d32 0%, #1b5e20 100%)',
            color: 'white',
          }}
          data-testid="incident-intelligence-summary"
        >
          <CardContent sx={{ py: 2, '&:last-child': { pb: 2 } }}>
            <Typography variant="subtitle2" sx={{ opacity: 0.85, mb: 1.5, fontWeight: 600, letterSpacing: 1 }}>
              INCIDENT INTELLIGENCE
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 3, flexWrap: 'wrap' }}>
              {/* Priority badge */}
              <Box sx={{ textAlign: 'center', minWidth: 60 }}>
                <Typography variant="h4" fontWeight={700} lineHeight={1}>
                  {(incident.priority || 'P3').toUpperCase()}
                </Typography>
                <Typography variant="caption" sx={{ opacity: 0.85 }}>Priority</Typography>
              </Box>
              <Divider orientation="vertical" flexItem sx={{ borderColor: 'rgba(255,255,255,0.3)' }} />
              {/* SLA summary */}
              <Box sx={{ textAlign: 'center', minWidth: 60 }}>
                <Typography variant="h5" fontWeight={700} lineHeight={1}>
                  {slaInstances.length}
                </Typography>
                <Typography variant="caption" sx={{ opacity: 0.85 }}>SLA Records</Typography>
              </Box>
              {slaInstances.some(s => s.breached) && (
                <Chip
                  label={`${slaInstances.filter(s => s.breached).length} Breached`}
                  size="small"
                  sx={{ bgcolor: 'rgba(255,255,255,0.25)', color: 'white', fontWeight: 600 }}
                />
              )}
              <Divider orientation="vertical" flexItem sx={{ borderColor: 'rgba(255,255,255,0.3)' }} />
              {/* Linked risks */}
              <Box sx={{ textAlign: 'center', minWidth: 60 }}>
                <Typography variant="h5" fontWeight={700} lineHeight={1}>
                  {linkedRisks.length}
                </Typography>
                <Typography variant="caption" sx={{ opacity: 0.85 }}>Linked Risks</Typography>
              </Box>
              <Divider orientation="vertical" flexItem sx={{ borderColor: 'rgba(255,255,255,0.3)' }} />
              {/* Linked controls */}
              <Box sx={{ textAlign: 'center', minWidth: 60 }}>
                <Typography variant="h5" fontWeight={700} lineHeight={1}>
                  {linkedControls.length}
                </Typography>
                <Typography variant="caption" sx={{ opacity: 0.85 }}>Linked Controls</Typography>
              </Box>
              <Divider orientation="vertical" flexItem sx={{ borderColor: 'rgba(255,255,255,0.3)' }} />
              {/* Health badges */}
              <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                {linkedRisks.length === 0 && (
                  <Chip label="No Linked Risks" size="small" sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white' }} />
                )}
                {slaInstances.length === 0 && (
                  <Chip label="No SLA" size="small" sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white' }} />
                )}
                <Chip label="Priority Auto-managed" size="small" sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white' }} />
                {incident.state === 'resolved' && (
                  <Chip label="Resolved" size="small" sx={{ bgcolor: 'rgba(76,175,80,0.4)', color: 'white' }} />
                )}
              </Box>
            </Box>
          </CardContent>
        </Card>
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
                    helperText="Auto-computed from Impact × Urgency — updates live"
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
