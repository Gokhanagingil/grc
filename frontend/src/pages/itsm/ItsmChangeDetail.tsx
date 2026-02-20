import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Card,
  CardContent,
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
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { itsmApi } from '../../services/grcClient';
import { useNotification } from '../../contexts/NotificationContext';
import { useItsmChoices, ChoiceOption } from '../../hooks/useItsmChoices';
import { ActivityStream } from '../../components/itsm/ActivityStream';

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

  // GRC Bridge state
  const [linkedRisks, setLinkedRisks] = useState<LinkedRisk[]>([]);
  const [linkedControls, setLinkedControls] = useState<LinkedControl[]>([]);
  const [showRisksSection, setShowRisksSection] = useState(false);
  const [showControlsSection, setShowControlsSection] = useState(false);

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

  const handleChange = (field: keyof ItsmChange, value: string) => {
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
          state: change.state as 'DRAFT' | 'ASSESS' | 'AUTHORIZE' | 'IMPLEMENT' | 'REVIEW' | 'CLOSED',
          risk: change.risk as 'LOW' | 'MEDIUM' | 'HIGH',
          approvalStatus: change.approvalStatus as 'NOT_REQUESTED' | 'REQUESTED' | 'APPROVED' | 'REJECTED',
          implementationPlan: change.implementationPlan,
          backoutPlan: change.backoutPlan,
          plannedStartAt: change.plannedStartAt,
          plannedEndAt: change.plannedEndAt,
          serviceId: change.serviceId,
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
        });
        showNotification('Change updated successfully', 'success');
        fetchChange();
      }
    } catch (error) {
      console.error('Error saving change:', error);
      showNotification('Failed to save change', 'error');
    } finally {
      setSaving(false);
    }
  };

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

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" fontWeight={600}>
          {isNew ? 'New Change' : change.number}
        </Typography>
        <Button
          variant="contained"
          startIcon={<SaveIcon />}
          onClick={handleSave}
          disabled={saving}
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
          {/* Service Info */}
          {change.service && (
            <Card sx={{ mb: 2 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Service
                </Typography>
                <Typography variant="body1">{change.service.name}</Typography>
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
    </Box>
  );
};

export default ItsmChangeDetail;
