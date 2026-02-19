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
  AutoAwesome as CopilotIcon,
} from '@mui/icons-material';
import { itsmApi } from '../../services/grcClient';
import { useNotification } from '../../contexts/NotificationContext';
import { useItsmChoices, ChoiceOption } from '../../hooks/useItsmChoices';
import { CopilotPanel } from '../../components/copilot/CopilotPanel';

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
  const priorityOptions = choices['priority'] || FALLBACK_CHOICES['priority'];
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

  // GRC Bridge state
  const [linkedRisks, setLinkedRisks] = useState<LinkedRisk[]>([]);
  const [linkedControls, setLinkedControls] = useState<LinkedControl[]>([]);
  const [showRisksSection, setShowRisksSection] = useState(false);
  const [showControlsSection, setShowControlsSection] = useState(false);
  const [copilotOpen, setCopilotOpen] = useState(false);

  const fetchIncident = useCallback(async () => {
    if (isNew || !id) return;
    
    setLoading(true);
    try {
      const response = await itsmApi.incidents.get(id);
      const data = response.data;
      if (data && 'data' in data) {
        setIncident(data.data);
      }

      // Fetch linked risks and controls
      try {
        const risksResponse = await itsmApi.incidents.getLinkedRisks(id);
        if (risksResponse.data && 'data' in risksResponse.data) {
          setLinkedRisks(Array.isArray(risksResponse.data.data) ? risksResponse.data.data : []);
        }
      } catch {
        // Ignore errors for linked risks
      }

      try {
        const controlsResponse = await itsmApi.incidents.getLinkedControls(id);
        if (controlsResponse.data && 'data' in controlsResponse.data) {
          setLinkedControls(Array.isArray(controlsResponse.data.data) ? controlsResponse.data.data : []);
        }
      } catch {
        // Ignore errors for linked controls
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

  const handleChange = (field: keyof ItsmIncident, value: string) => {
    setIncident((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!incident.shortDescription?.trim()) {
      showNotification('Short description is required', 'error');
      return;
    }

    setSaving(true);
    try {
      if (isNew) {
        const response = await itsmApi.incidents.create({
          shortDescription: incident.shortDescription,
          description: incident.description,
          state: incident.state,
          priority: incident.priority,
          impact: incident.impact,
          urgency: incident.urgency,
          category: incident.category,
          serviceId: incident.serviceId,
        });
        const data = response.data;
        if (data && 'data' in data && data.data?.id) {
          showNotification('Incident created successfully', 'success');
          navigate(`/itsm/incidents/${data.data.id}`);
        }
      } else if (id) {
        await itsmApi.incidents.update(id, {
          shortDescription: incident.shortDescription,
          description: incident.description,
          state: incident.state,
          priority: incident.priority,
          impact: incident.impact,
          urgency: incident.urgency,
          category: incident.category,
          resolutionNotes: incident.resolutionNotes,
        });
        showNotification('Incident updated successfully', 'success');
        fetchIncident();
      }
    } catch (error: unknown) {
      console.error('Error saving incident:', error);
      const axiosErr = error as { response?: { status?: number } };
      if (axiosErr?.response?.status === 403) {
        showNotification('You don\'t have permission to create incidents.', 'error');
      } else {
        showNotification('Failed to save incident', 'error');
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
                  <FormControl fullWidth>
                    <InputLabel>Priority</InputLabel>
                    <Select
                      value={incident.priority || 'p3'}
                      label="Priority"
                      onChange={(e) => handleChange('priority', e.target.value)}
                    >
                      {priorityOptions.map((option) => (
                        <MenuItem key={option.value} value={option.value}>
                          {option.label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
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
          {/* Service Info */}
          {incident.service && (
            <Card sx={{ mb: 2 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Service
                </Typography>
                <Typography variant="body1">{incident.service.name}</Typography>
              </CardContent>
            </Card>
          )}

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

      {!isNew && incident.id && incident.number && (
        <CopilotPanel
          open={copilotOpen}
          onClose={() => setCopilotOpen(false)}
          incidentSysId={incident.id}
          incidentNumber={incident.number}
        />
      )}
    </Box>
  );
};

export default ItsmIncidentDetail;
