import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  Chip,
  Card,
  CardContent,
  Grid,
  Tab,
  Tabs,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  CircularProgress,
  Divider,
  IconButton,
  Tooltip,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Timeline as TimelineIcon,
  Link as LinkIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
} from '@mui/icons-material';
import {
  itsmApi,
  ItsmMajorIncidentData,
  ItsmMajorIncidentUpdateData,
  ItsmMajorIncidentLinkData,
  UpdateItsmMajorIncidentDto,
  CreateItsmMajorIncidentUpdateDto,
  CreateItsmMajorIncidentLinkDto,
} from '../../services/grcClient';
import { useNotification } from '../../contexts/NotificationContext';

const statusColors: Record<string, 'default' | 'info' | 'warning' | 'success' | 'error'> = {
  DECLARED: 'error',
  INVESTIGATING: 'warning',
  MITIGATING: 'warning',
  MONITORING: 'info',
  RESOLVED: 'success',
  PIR_PENDING: 'info',
  CLOSED: 'default',
};

const VALID_TRANSITIONS: Record<string, string[]> = {
  DECLARED: ['INVESTIGATING'],
  INVESTIGATING: ['MITIGATING', 'MONITORING', 'RESOLVED'],
  MITIGATING: ['MONITORING', 'INVESTIGATING', 'RESOLVED'],
  MONITORING: ['RESOLVED', 'INVESTIGATING', 'MITIGATING'],
  RESOLVED: ['PIR_PENDING', 'CLOSED', 'INVESTIGATING'],
  PIR_PENDING: ['CLOSED'],
  CLOSED: [],
};

const UPDATE_TYPE_OPTIONS = [
  { value: 'TECHNICAL_UPDATE', label: 'Technical Update' },
  { value: 'STAKEHOLDER_UPDATE', label: 'Stakeholder Update' },
  { value: 'DECISION', label: 'Decision' },
  { value: 'ESCALATION', label: 'Escalation' },
  { value: 'COMMUNICATION', label: 'Communication' },
  { value: 'ACTION_TAKEN', label: 'Action Taken' },
  { value: 'BRIDGE_NOTE', label: 'Bridge Note' },
];

const LINK_TYPE_OPTIONS = [
  { value: 'INCIDENT', label: 'Incident' },
  { value: 'CHANGE', label: 'Change' },
  { value: 'PROBLEM', label: 'Problem' },
  { value: 'CMDB_SERVICE', label: 'CMDB Service' },
  { value: 'CMDB_OFFERING', label: 'CMDB Offering' },
  { value: 'CMDB_CI', label: 'CMDB CI' },
];

function toDisplayLabel(val: string): string {
  return val.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
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
      {value === index && <Box sx={{ pt: 2 }}>{children}</Box>}
    </div>
  );
}

export const ItsmMajorIncidentDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showNotification } = useNotification();

  const [mi, setMi] = useState<ItsmMajorIncidentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tabIndex, setTabIndex] = useState(0);

  // Edit mode
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<UpdateItsmMajorIncidentDto>({});
  const [saving, setSaving] = useState(false);

  // Timeline
  const [timeline, setTimeline] = useState<ItsmMajorIncidentUpdateData[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(false);

  // Links
  const [links, setLinks] = useState<ItsmMajorIncidentLinkData[]>([]);
  const [linksLoading, setLinksLoading] = useState(false);

  // Timeline post dialog
  const [timelineDialogOpen, setTimelineDialogOpen] = useState(false);
  const [timelineMessage, setTimelineMessage] = useState('');
  const [timelineType, setTimelineType] = useState('TECHNICAL_UPDATE');
  const [timelineVisibility, setTimelineVisibility] = useState('INTERNAL');
  const [postingUpdate, setPostingUpdate] = useState(false);

  // Link dialog
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkType, setLinkType] = useState('INCIDENT');
  const [linkRecordId, setLinkRecordId] = useState('');
  const [linkLabel, setLinkLabel] = useState('');
  const [linkNotes, setLinkNotes] = useState('');
  const [linkingRecord, setLinkingRecord] = useState(false);

  // Status change dialog
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [newStatus, setNewStatus] = useState('');
  const [resolutionSummary, setResolutionSummary] = useState('');
  const [changingStatus, setChangingStatus] = useState(false);

  const fetchMi = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const response = await itsmApi.majorIncidents.get(id);
      const data = (response.data as { data?: ItsmMajorIncidentData })?.data;
      if (data) {
        setMi(data);
      } else {
        setError('Major Incident not found');
      }
    } catch (err) {
      console.error('Error fetching major incident:', err);
      setError('Failed to load major incident');
    } finally {
      setLoading(false);
    }
  }, [id]);

  const fetchTimeline = useCallback(async () => {
    if (!id) return;
    setTimelineLoading(true);
    try {
      const response = await itsmApi.majorIncidents.getTimeline(id);
      const data = response.data as Record<string, unknown>;
      if (data && 'items' in data && Array.isArray(data.items)) {
        setTimeline(data.items as ItsmMajorIncidentUpdateData[]);
      }
    } catch (err) {
      console.error('Error fetching timeline:', err);
    } finally {
      setTimelineLoading(false);
    }
  }, [id]);

  const fetchLinks = useCallback(async () => {
    if (!id) return;
    setLinksLoading(true);
    try {
      const response = await itsmApi.majorIncidents.getLinks(id);
      const data = (response.data as { data?: ItsmMajorIncidentLinkData[] })?.data;
      if (Array.isArray(data)) {
        setLinks(data);
      }
    } catch (err) {
      console.error('Error fetching links:', err);
    } finally {
      setLinksLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchMi();
  }, [fetchMi]);

  useEffect(() => {
    if (tabIndex === 1) fetchTimeline();
    if (tabIndex === 2) fetchLinks();
  }, [tabIndex, fetchTimeline, fetchLinks]);

  const startEditing = () => {
    if (!mi) return;
    setEditForm({
      title: mi.title,
      description: mi.description || '',
      severity: mi.severity,
      commanderId: mi.commanderId || undefined,
      communicationsLeadId: mi.communicationsLeadId || undefined,
      techLeadId: mi.techLeadId || undefined,
      bridgeUrl: mi.bridgeUrl || '',
      bridgeChannel: mi.bridgeChannel || '',
      customerImpactSummary: mi.customerImpactSummary || '',
      businessImpactSummary: mi.businessImpactSummary || '',
    });
    setEditing(true);
  };

  const handleSave = async () => {
    if (!id) return;
    setSaving(true);
    try {
      await itsmApi.majorIncidents.update(id, editForm);
      showNotification('Major Incident updated', 'success');
      setEditing(false);
      fetchMi();
    } catch (err) {
      console.error('Error updating MI:', err);
      showNotification('Failed to update major incident', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async () => {
    if (!id || !newStatus) return;
    setChangingStatus(true);
    try {
      const dto: UpdateItsmMajorIncidentDto = { status: newStatus };
      if (newStatus === 'RESOLVED' && resolutionSummary) {
        dto.resolutionSummary = resolutionSummary;
      }
      await itsmApi.majorIncidents.update(id, dto);
      showNotification(`Status changed to ${toDisplayLabel(newStatus)}`, 'success');
      setStatusDialogOpen(false);
      setNewStatus('');
      setResolutionSummary('');
      fetchMi();
      if (tabIndex === 1) fetchTimeline();
    } catch (err) {
      const axErr = err as { response?: { data?: { message?: string } } };
      const msg = axErr.response?.data?.message || 'Failed to change status';
      showNotification(msg, 'error');
    } finally {
      setChangingStatus(false);
    }
  };

  const handlePostTimelineUpdate = async () => {
    if (!id || !timelineMessage.trim()) return;
    setPostingUpdate(true);
    try {
      const dto: CreateItsmMajorIncidentUpdateDto = {
        message: timelineMessage.trim(),
        updateType: timelineType,
        visibility: timelineVisibility,
      };
      await itsmApi.majorIncidents.postTimelineUpdate(id, dto);
      showNotification('Timeline update posted', 'success');
      setTimelineDialogOpen(false);
      setTimelineMessage('');
      fetchTimeline();
    } catch (err) {
      console.error('Error posting timeline update:', err);
      showNotification('Failed to post timeline update', 'error');
    } finally {
      setPostingUpdate(false);
    }
  };

  const handleLinkRecord = async () => {
    if (!id || !linkRecordId.trim()) return;
    setLinkingRecord(true);
    try {
      const dto: CreateItsmMajorIncidentLinkDto = {
        linkType,
        linkedRecordId: linkRecordId.trim(),
        linkedRecordLabel: linkLabel.trim() || undefined,
        notes: linkNotes.trim() || undefined,
      };
      await itsmApi.majorIncidents.linkRecord(id, dto);
      showNotification('Record linked successfully', 'success');
      setLinkDialogOpen(false);
      setLinkRecordId('');
      setLinkLabel('');
      setLinkNotes('');
      fetchLinks();
    } catch (err) {
      const axErr = err as { response?: { data?: { message?: string } } };
      const msg = axErr.response?.data?.message || 'Failed to link record';
      showNotification(msg, 'error');
    } finally {
      setLinkingRecord(false);
    }
  };

  const handleUnlink = async (linkId: string) => {
    if (!id) return;
    try {
      await itsmApi.majorIncidents.unlinkRecord(id, linkId);
      showNotification('Record unlinked', 'success');
      fetchLinks();
    } catch (err) {
      console.error('Error unlinking record:', err);
      showNotification('Failed to unlink record', 'error');
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error || !mi) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{error || 'Major Incident not found'}</Alert>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/itsm/major-incidents')} sx={{ mt: 2 }}>
          Back to List
        </Button>
      </Box>
    );
  }

  const availableTransitions = VALID_TRANSITIONS[mi.status] || [];

  return (
    <Box data-testid="mi-detail-page">
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
        <Box>
          <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/itsm/major-incidents')} sx={{ mb: 1 }}>
            Back to Major Incidents
          </Button>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography variant="h4" fontWeight={600} data-testid="mi-detail-title">
              {mi.number}: {mi.title}
            </Typography>
            <Chip
              label={toDisplayLabel(mi.status)}
              color={statusColors[mi.status] || 'default'}
              data-testid="mi-detail-status"
            />
            <Chip
              label={mi.severity}
              color={
                mi.severity === 'SEV1' ? 'error' : mi.severity === 'SEV2' ? 'warning' : 'info'
              }
              variant="outlined"
            />
          </Box>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          {availableTransitions.length > 0 && (
            <Button
              variant="outlined"
              color="primary"
              onClick={() => setStatusDialogOpen(true)}
              data-testid="change-status-btn"
            >
              Change Status
            </Button>
          )}
          {!editing ? (
            <Button
              variant="outlined"
              startIcon={<EditIcon />}
              onClick={startEditing}
              data-testid="edit-mi-btn"
            >
              Edit
            </Button>
          ) : (
            <>
              <Button
                variant="contained"
                startIcon={<SaveIcon />}
                onClick={handleSave}
                disabled={saving}
              >
                Save
              </Button>
              <Button
                variant="outlined"
                startIcon={<CancelIcon />}
                onClick={() => setEditing(false)}
              >
                Cancel
              </Button>
            </>
          )}
        </Box>
      </Box>

      {/* Tabs */}
      <Tabs value={tabIndex} onChange={(_, v) => setTabIndex(v)} sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tab label="Overview" data-testid="mi-tab-overview" />
        <Tab label="Timeline" data-testid="mi-tab-timeline" />
        <Tab label="Linked Records" data-testid="mi-tab-links" />
        <Tab label="Impact" data-testid="mi-tab-impact" />
        <Tab label="Communications" data-testid="mi-tab-comms" />
        <Tab label="PIR" data-testid="mi-tab-pir" />
      </Tabs>

      {/* Overview Tab */}
      <TabPanel value={tabIndex} index={0}>
        <Grid container spacing={3}>
          <Grid item xs={12} md={8}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>Details</Typography>
                {editing ? (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <TextField
                      label="Title"
                      value={editForm.title || ''}
                      onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                      fullWidth
                    />
                    <TextField
                      label="Description"
                      value={editForm.description || ''}
                      onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                      fullWidth
                      multiline
                      rows={4}
                    />
                    <TextField
                      label="Customer Impact Summary"
                      value={editForm.customerImpactSummary || ''}
                      onChange={(e) => setEditForm({ ...editForm, customerImpactSummary: e.target.value })}
                      fullWidth
                      multiline
                      rows={2}
                    />
                    <TextField
                      label="Business Impact Summary"
                      value={editForm.businessImpactSummary || ''}
                      onChange={(e) => setEditForm({ ...editForm, businessImpactSummary: e.target.value })}
                      fullWidth
                      multiline
                      rows={2}
                    />
                  </Box>
                ) : (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                    <Box>
                      <Typography variant="subtitle2" color="text.secondary">Description</Typography>
                      <Typography>{mi.description || 'No description provided'}</Typography>
                    </Box>
                    {mi.customerImpactSummary && (
                      <Box>
                        <Typography variant="subtitle2" color="text.secondary">Customer Impact</Typography>
                        <Typography>{mi.customerImpactSummary}</Typography>
                      </Box>
                    )}
                    {mi.businessImpactSummary && (
                      <Box>
                        <Typography variant="subtitle2" color="text.secondary">Business Impact</Typography>
                        <Typography>{mi.businessImpactSummary}</Typography>
                      </Box>
                    )}
                    {mi.resolutionSummary && (
                      <Box>
                        <Typography variant="subtitle2" color="text.secondary">Resolution Summary</Typography>
                        <Typography>{mi.resolutionSummary}</Typography>
                      </Box>
                    )}
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>Metadata</Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary">Number</Typography>
                    <Typography>{mi.number}</Typography>
                  </Box>
                  <Divider />
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary">Declared At</Typography>
                    <Typography>{mi.declaredAt ? new Date(mi.declaredAt).toLocaleString() : '-'}</Typography>
                  </Box>
                  {mi.resolvedAt && (
                    <>
                      <Divider />
                      <Box>
                        <Typography variant="subtitle2" color="text.secondary">Resolved At</Typography>
                        <Typography>{new Date(mi.resolvedAt).toLocaleString()}</Typography>
                      </Box>
                    </>
                  )}
                  {mi.closedAt && (
                    <>
                      <Divider />
                      <Box>
                        <Typography variant="subtitle2" color="text.secondary">Closed At</Typography>
                        <Typography>{new Date(mi.closedAt).toLocaleString()}</Typography>
                      </Box>
                    </>
                  )}
                </Box>
              </CardContent>
            </Card>

            <Card sx={{ mt: 2 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>Bridge / War Room</Typography>
                {editing ? (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <TextField
                      label="Bridge URL"
                      value={editForm.bridgeUrl || ''}
                      onChange={(e) => setEditForm({ ...editForm, bridgeUrl: e.target.value })}
                      fullWidth
                      size="small"
                    />
                    <TextField
                      label="Bridge Channel"
                      value={editForm.bridgeChannel || ''}
                      onChange={(e) => setEditForm({ ...editForm, bridgeChannel: e.target.value })}
                      fullWidth
                      size="small"
                    />
                  </Box>
                ) : (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <Box>
                      <Typography variant="subtitle2" color="text.secondary">URL</Typography>
                      <Typography>
                        {mi.bridgeUrl ? (
                          <a href={mi.bridgeUrl} target="_blank" rel="noopener noreferrer">{mi.bridgeUrl}</a>
                        ) : 'Not set'}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="subtitle2" color="text.secondary">Channel</Typography>
                      <Typography>{mi.bridgeChannel || 'Not set'}</Typography>
                    </Box>
                  </Box>
                )}
              </CardContent>
            </Card>

            <Card sx={{ mt: 2 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>Role Assignments</Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary">Commander</Typography>
                    <Typography>{mi.commanderId || 'Unassigned'}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary">Communications Lead</Typography>
                    <Typography>{mi.communicationsLeadId || 'Unassigned'}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary">Tech Lead</Typography>
                    <Typography>{mi.techLeadId || 'Unassigned'}</Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </TabPanel>

      {/* Timeline Tab */}
      <TabPanel value={tabIndex} index={1}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">Timeline</Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setTimelineDialogOpen(true)}
            data-testid="post-timeline-update-btn"
          >
            Post Update
          </Button>
        </Box>
        {timelineLoading ? (
          <CircularProgress />
        ) : timeline.length === 0 ? (
          <Paper sx={{ p: 3, textAlign: 'center' }}>
            <TimelineIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
            <Typography color="text.secondary">No timeline updates yet</Typography>
          </Paper>
        ) : (
          <List>
            {timeline.map((update) => (
              <ListItem key={update.id} sx={{ alignItems: 'flex-start', borderBottom: '1px solid', borderColor: 'divider' }}>
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Chip label={toDisplayLabel(update.updateType)} size="small" variant="outlined" />
                      <Chip
                        label={update.visibility}
                        size="small"
                        color={update.visibility === 'EXTERNAL' ? 'warning' : 'default'}
                      />
                      <Typography variant="caption" color="text.secondary">
                        {new Date(update.createdAt).toLocaleString()}
                      </Typography>
                    </Box>
                  }
                  secondary={
                    <Typography sx={{ mt: 0.5 }}>{update.message}</Typography>
                  }
                />
              </ListItem>
            ))}
          </List>
        )}
      </TabPanel>

      {/* Linked Records Tab */}
      <TabPanel value={tabIndex} index={2}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">Linked Records</Typography>
          <Button
            variant="contained"
            startIcon={<LinkIcon />}
            onClick={() => setLinkDialogOpen(true)}
            data-testid="link-record-btn"
          >
            Link Record
          </Button>
        </Box>
        {linksLoading ? (
          <CircularProgress />
        ) : links.length === 0 ? (
          <Paper sx={{ p: 3, textAlign: 'center' }}>
            <LinkIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
            <Typography color="text.secondary">No linked records yet</Typography>
          </Paper>
        ) : (
          <List>
            {links.map((link) => (
              <ListItem key={link.id} sx={{ borderBottom: '1px solid', borderColor: 'divider' }}>
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Chip label={toDisplayLabel(link.linkType)} size="small" variant="outlined" />
                      <Typography fontWeight={500}>
                        {link.linkedRecordLabel || link.linkedRecordId}
                      </Typography>
                    </Box>
                  }
                  secondary={link.notes || undefined}
                />
                <ListItemSecondaryAction>
                  <Tooltip title="Unlink">
                    <IconButton
                      edge="end"
                      onClick={() => handleUnlink(link.id)}
                      data-testid={`unlink-${link.id}`}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </Tooltip>
                </ListItemSecondaryAction>
              </ListItem>
            ))}
          </List>
        )}
      </TabPanel>

      {/* Impact Tab */}
      <TabPanel value={tabIndex} index={3}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>Impact Assessment</Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" color="text.secondary">Customer Impact</Typography>
                <Typography>{mi.customerImpactSummary || 'Not assessed'}</Typography>
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" color="text.secondary">Business Impact</Typography>
                <Typography>{mi.businessImpactSummary || 'Not assessed'}</Typography>
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" color="text.secondary">Primary Service</Typography>
                <Typography>{mi.primaryServiceId || 'Not specified'}</Typography>
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" color="text.secondary">Primary Offering</Typography>
                <Typography>{mi.primaryOfferingId || 'Not specified'}</Typography>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
        <Card sx={{ mt: 2 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>Impacted Services & CIs</Typography>
            {links.filter(l => ['CMDB_SERVICE', 'CMDB_OFFERING', 'CMDB_CI'].includes(l.linkType)).length === 0 ? (
              <Typography color="text.secondary">No CMDB records linked yet. Use the Linked Records tab to add impacted services and CIs.</Typography>
            ) : (
              <List>
                {links.filter(l => ['CMDB_SERVICE', 'CMDB_OFFERING', 'CMDB_CI'].includes(l.linkType)).map((link) => (
                  <ListItem key={link.id}>
                    <ListItemText
                      primary={link.linkedRecordLabel || link.linkedRecordId}
                      secondary={toDisplayLabel(link.linkType)}
                    />
                  </ListItem>
                ))}
              </List>
            )}
          </CardContent>
        </Card>
      </TabPanel>

      {/* Communications Tab */}
      <TabPanel value={tabIndex} index={4}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>Stakeholder Communications</Typography>
            {timeline.filter(u => u.visibility === 'EXTERNAL' || u.updateType === 'STAKEHOLDER_UPDATE' || u.updateType === 'COMMUNICATION').length === 0 ? (
              <Paper sx={{ p: 3, textAlign: 'center' }}>
                <Typography color="text.secondary">No stakeholder communications yet. Post an external update from the Timeline tab.</Typography>
              </Paper>
            ) : (
              <List>
                {timeline.filter(u => u.visibility === 'EXTERNAL' || u.updateType === 'STAKEHOLDER_UPDATE' || u.updateType === 'COMMUNICATION').map((update) => (
                  <ListItem key={update.id} sx={{ borderBottom: '1px solid', borderColor: 'divider' }}>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Chip label={toDisplayLabel(update.updateType)} size="small" />
                          <Typography variant="caption" color="text.secondary">
                            {new Date(update.createdAt).toLocaleString()}
                          </Typography>
                        </Box>
                      }
                      secondary={update.message}
                    />
                  </ListItem>
                ))}
              </List>
            )}
          </CardContent>
        </Card>
      </TabPanel>

      {/* PIR Tab (Placeholder) */}
      <TabPanel value={tabIndex} index={5}>
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="h6" gutterBottom>Post-Incident Review</Typography>
          <Typography color="text.secondary" gutterBottom>
            PIR functionality will be available after this major incident is resolved.
          </Typography>
          {mi.status === 'PIR_PENDING' && (
            <Alert severity="info" sx={{ mt: 2 }}>
              This major incident is pending PIR. PIR creation will be available in a future update.
            </Alert>
          )}
        </Paper>
      </TabPanel>

      {/* Status Change Dialog */}
      <Dialog
        open={statusDialogOpen}
        onClose={() => setStatusDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        data-testid="status-change-dialog"
      >
        <DialogTitle>Change Status</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <Typography>
              Current status: <Chip label={toDisplayLabel(mi.status)} color={statusColors[mi.status]} size="small" />
            </Typography>
            <FormControl fullWidth>
              <InputLabel>New Status</InputLabel>
              <Select
                value={newStatus}
                label="New Status"
                onChange={(e) => setNewStatus(e.target.value)}
                data-testid="new-status-select"
              >
                {availableTransitions.map((s) => (
                  <MenuItem key={s} value={s}>{toDisplayLabel(s)}</MenuItem>
                ))}
              </Select>
            </FormControl>
            {newStatus === 'RESOLVED' && (
              <TextField
                label="Resolution Summary"
                value={resolutionSummary}
                onChange={(e) => setResolutionSummary(e.target.value)}
                fullWidth
                multiline
                rows={3}
                required
                helperText="Required when resolving a major incident"
                data-testid="resolution-summary-input"
              />
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setStatusDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleStatusChange}
            variant="contained"
            disabled={!newStatus || changingStatus || (newStatus === 'RESOLVED' && !resolutionSummary.trim())}
            data-testid="confirm-status-change-btn"
          >
            {changingStatus ? 'Changing...' : 'Confirm'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Timeline Update Dialog */}
      <Dialog
        open={timelineDialogOpen}
        onClose={() => setTimelineDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        data-testid="timeline-update-dialog"
      >
        <DialogTitle>Post Timeline Update</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <TextField
              label="Message"
              value={timelineMessage}
              onChange={(e) => setTimelineMessage(e.target.value)}
              fullWidth
              multiline
              rows={3}
              required
              autoFocus
              data-testid="timeline-message-input"
            />
            <FormControl fullWidth>
              <InputLabel>Update Type</InputLabel>
              <Select
                value={timelineType}
                label="Update Type"
                onChange={(e) => setTimelineType(e.target.value)}
              >
                {UPDATE_TYPE_OPTIONS.map((opt) => (
                  <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel>Visibility</InputLabel>
              <Select
                value={timelineVisibility}
                label="Visibility"
                onChange={(e) => setTimelineVisibility(e.target.value)}
              >
                <MenuItem value="INTERNAL">Internal</MenuItem>
                <MenuItem value="EXTERNAL">External (Stakeholders)</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTimelineDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handlePostTimelineUpdate}
            variant="contained"
            disabled={!timelineMessage.trim() || postingUpdate}
            data-testid="confirm-post-update-btn"
          >
            {postingUpdate ? 'Posting...' : 'Post Update'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Link Record Dialog */}
      <Dialog
        open={linkDialogOpen}
        onClose={() => setLinkDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        data-testid="link-record-dialog"
      >
        <DialogTitle>Link Record</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <FormControl fullWidth>
              <InputLabel>Record Type</InputLabel>
              <Select
                value={linkType}
                label="Record Type"
                onChange={(e) => setLinkType(e.target.value)}
              >
                {LINK_TYPE_OPTIONS.map((opt) => (
                  <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="Record ID"
              value={linkRecordId}
              onChange={(e) => setLinkRecordId(e.target.value)}
              fullWidth
              required
              helperText="Enter the UUID of the record to link"
              data-testid="link-record-id-input"
            />
            <TextField
              label="Label (optional)"
              value={linkLabel}
              onChange={(e) => setLinkLabel(e.target.value)}
              fullWidth
              helperText="Display name for this linked record"
            />
            <TextField
              label="Notes (optional)"
              value={linkNotes}
              onChange={(e) => setLinkNotes(e.target.value)}
              fullWidth
              multiline
              rows={2}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLinkDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleLinkRecord}
            variant="contained"
            disabled={!linkRecordId.trim() || linkingRecord}
            data-testid="confirm-link-record-btn"
          >
            {linkingRecord ? 'Linking...' : 'Link Record'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ItsmMajorIncidentDetail;
