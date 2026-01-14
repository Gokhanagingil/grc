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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
} from '@mui/material';
import {
  Build as CapaIcon,
  ArrowBack as BackIcon,
  History as HistoryIcon,
  Info as InfoIcon,
  Warning as IssueIcon,
  Edit as EditIcon,
} from '@mui/icons-material';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  capaApi,
  CapaData,
  UpdateCapaDto,
  CapaStatus,
  statusHistoryApi,
  unwrapResponse,
  StatusHistoryItem,
} from '../services/grcClient';
import { useAuth } from '../contexts/AuthContext';
import { LoadingState, ErrorState } from '../components/common';

const ALLOWED_TRANSITIONS: Record<CapaStatus, CapaStatus[]> = {
  'planned': ['in_progress', 'rejected'],
  'in_progress': ['implemented', 'planned', 'rejected'],
  'implemented': ['verified', 'in_progress'],
  'verified': ['closed', 'implemented'],
  'closed': ['in_progress'],
  'rejected': ['planned'],
};

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
      id={`capa-tabpanel-${index}`}
      aria-labelledby={`capa-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  );
}

const getStatusColor = (status: string): 'error' | 'warning' | 'info' | 'success' | 'default' => {
  switch (status) {
    case 'planned': return 'info';
    case 'in_progress': return 'warning';
    case 'implemented': return 'info';
    case 'verified': return 'success';
    case 'closed': return 'success';
    case 'rejected': return 'error';
    default: return 'default';
  }
};

const getPriorityColor = (priority: string): 'error' | 'warning' | 'info' | 'success' | 'default' => {
  switch (priority) {
    case 'critical': return 'error';
    case 'high': return 'error';
    case 'medium': return 'warning';
    case 'low': return 'info';
    default: return 'default';
  }
};

const formatStatus = (status: string): string => {
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

export const CapaDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const tenantId = user?.tenantId || '';

  const [capa, setCapa] = useState<CapaData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [tabValue, setTabValue] = useState(0);

  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<CapaStatus | ''>('');
  const [statusReason, setStatusReason] = useState('');
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editData, setEditData] = useState<UpdateCapaDto>({});
  const [saving, setSaving] = useState(false);

  const [statusHistory, setStatusHistory] = useState<StatusHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const fetchCapa = useCallback(async () => {
    if (!id || !tenantId) return;

    setLoading(true);
    setError(null);

    try {
      const response = await capaApi.get(tenantId, id);
      const data = unwrapResponse<CapaData>(response);
      setCapa(data);
    } catch (err) {
      console.error('Error fetching CAPA:', err);
      setError('Failed to load CAPA details. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [id, tenantId]);

  const fetchStatusHistory = useCallback(async () => {
    if (!id || !tenantId) return;

    setHistoryLoading(true);
    try {
      const response = await statusHistoryApi.getByEntity(tenantId, 'CAPA', id);
      const data = unwrapResponse<StatusHistoryItem[]>(response);
      setStatusHistory(data || []);
    } catch (err) {
      console.error('Error fetching status history:', err);
      setStatusHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }, [id, tenantId]);

  useEffect(() => {
    fetchCapa();
  }, [fetchCapa]);

  useEffect(() => {
    if (tabValue === 2) {
      fetchStatusHistory();
    }
  }, [tabValue, fetchStatusHistory]);

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleOpenStatusDialog = () => {
    setSelectedStatus('');
    setStatusReason('');
    setStatusDialogOpen(true);
  };

  const handleUpdateStatus = async () => {
    if (!id || !tenantId || !selectedStatus) return;

    setUpdatingStatus(true);
    try {
      await capaApi.updateStatus(tenantId, id, {
        status: selectedStatus,
        reason: statusReason || undefined,
      });
      setSuccess('Status updated successfully');
      setStatusDialogOpen(false);
      await fetchCapa();
      if (tabValue === 2) {
        await fetchStatusHistory();
      }
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      setError(error.response?.data?.message || 'Failed to update status');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleOpenEditDialog = () => {
    if (!capa) return;
    setEditData({
      title: capa.title,
      description: capa.description,
      priority: capa.priority,
      rootCauseAnalysis: capa.rootCauseAnalysis || undefined,
      actionPlan: capa.actionPlan || undefined,
      implementationNotes: capa.implementationNotes || undefined,
      verificationMethod: capa.verificationMethod || undefined,
      verificationNotes: capa.verificationNotes || undefined,
      closureNotes: capa.closureNotes || undefined,
    });
    setEditDialogOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!id || !tenantId) return;

    setSaving(true);
    try {
      await capaApi.update(tenantId, id, editData);
      setSuccess('CAPA updated successfully');
      setEditDialogOpen(false);
      await fetchCapa();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      setError(error.response?.data?.message || 'Failed to update CAPA');
    } finally {
      setSaving(false);
    }
  };

  const getAvailableTransitions = (): CapaStatus[] => {
    if (!capa) return [];
    return ALLOWED_TRANSITIONS[capa.status] || [];
  };

  if (loading) {
    return <LoadingState message="Loading CAPA details..." />;
  }

  if (error && !capa) {
    return <ErrorState message={error} onRetry={fetchCapa} />;
  }

  if (!capa) {
    return <ErrorState message="CAPA not found" />;
  }

    return (
      <Box sx={{ p: 3 }} data-testid="capa-detail-page">
        <Box display="flex" alignItems="center" gap={2} mb={3}>
          <IconButton onClick={() => navigate('/capa')} data-testid="back-button">
          <BackIcon />
        </IconButton>
        <Box flex={1}>
          <Typography variant="h4" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CapaIcon /> {capa.title}
          </Typography>
          <Typography variant="subtitle1" color="text.secondary">
            CAPA ID: {capa.id}
          </Typography>
        </Box>
        <Chip
          label={formatStatus(capa.priority)}
          color={getPriorityColor(capa.priority)}
          data-testid="capa-priority-chip"
        />
        <Chip
          label={formatStatus(capa.status)}
          color={getStatusColor(capa.status)}
          data-testid="capa-status-chip"
        />
        <Button
          variant="outlined"
          startIcon={<EditIcon />}
          onClick={handleOpenEditDialog}
          data-testid="edit-capa-button"
        >
          Edit
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>{success}</Alert>}

      <Paper sx={{ width: '100%' }}>
        <Tabs value={tabValue} onChange={handleTabChange} aria-label="capa detail tabs">
          <Tab icon={<InfoIcon />} label="Overview" iconPosition="start" data-testid="overview-tab" />
          <Tab icon={<IssueIcon />} label="Issue" iconPosition="start" data-testid="issue-tab" />
          <Tab icon={<HistoryIcon />} label="History" iconPosition="start" data-testid="history-tab" />
        </Tabs>

        <TabPanel value={tabValue} index={0}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>Basic Information</Typography>
                  <Divider sx={{ mb: 2 }} />
                  <Grid container spacing={2}>
                    <Grid item xs={4}><Typography color="text.secondary">Title</Typography></Grid>
                    <Grid item xs={8}><Typography>{capa.title}</Typography></Grid>
                    <Grid item xs={4}><Typography color="text.secondary">Type</Typography></Grid>
                    <Grid item xs={8}><Typography>{formatStatus(capa.type)}</Typography></Grid>
                    <Grid item xs={4}><Typography color="text.secondary">Priority</Typography></Grid>
                    <Grid item xs={8}><Chip label={formatStatus(capa.priority)} size="small" color={getPriorityColor(capa.priority)} /></Grid>
                    <Grid item xs={4}><Typography color="text.secondary">Status</Typography></Grid>
                    <Grid item xs={8}>
                      <Box display="flex" alignItems="center" gap={1}>
                        <Chip label={formatStatus(capa.status)} size="small" color={getStatusColor(capa.status)} />
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={handleOpenStatusDialog}
                          disabled={getAvailableTransitions().length === 0}
                          data-testid="change-status-button"
                        >
                          Change Status
                        </Button>
                      </Box>
                    </Grid>
                    <Grid item xs={4}><Typography color="text.secondary">Due Date</Typography></Grid>
                    <Grid item xs={8}><Typography>{formatDate(capa.dueDate)}</Typography></Grid>
                    <Grid item xs={4}><Typography color="text.secondary">Owner</Typography></Grid>
                    <Grid item xs={8}>
                      <Typography>
                        {capa.owner 
                          ? `${capa.owner.firstName || ''} ${capa.owner.lastName || ''} (${capa.owner.email})`.trim()
                          : '-'}
                      </Typography>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>Verification & Closure</Typography>
                  <Divider sx={{ mb: 2 }} />
                  <Grid container spacing={2}>
                    <Grid item xs={4}><Typography color="text.secondary">Verified At</Typography></Grid>
                    <Grid item xs={8}><Typography>{formatDateTime(capa.verifiedAt)}</Typography></Grid>
                    <Grid item xs={4}><Typography color="text.secondary">Verified By</Typography></Grid>
                    <Grid item xs={8}>
                      <Typography>
                        {capa.verifiedBy 
                          ? `${capa.verifiedBy.firstName || ''} ${capa.verifiedBy.lastName || ''}`
                          : '-'}
                      </Typography>
                    </Grid>
                    <Grid item xs={4}><Typography color="text.secondary">Closed At</Typography></Grid>
                    <Grid item xs={8}><Typography>{formatDateTime(capa.closedAt)}</Typography></Grid>
                    <Grid item xs={4}><Typography color="text.secondary">Closed By</Typography></Grid>
                    <Grid item xs={8}>
                      <Typography>
                        {capa.closedBy 
                          ? `${capa.closedBy.firstName || ''} ${capa.closedBy.lastName || ''}`
                          : '-'}
                      </Typography>
                    </Grid>
                    <Grid item xs={4}><Typography color="text.secondary">Created</Typography></Grid>
                    <Grid item xs={8}><Typography>{formatDateTime(capa.createdAt)}</Typography></Grid>
                    <Grid item xs={4}><Typography color="text.secondary">Updated</Typography></Grid>
                    <Grid item xs={8}><Typography>{formatDateTime(capa.updatedAt)}</Typography></Grid>
                  </Grid>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>Description</Typography>
                  <Divider sx={{ mb: 2 }} />
                  <Typography>{capa.description || 'No description provided.'}</Typography>
                </CardContent>
              </Card>
            </Grid>
            {capa.rootCauseAnalysis && (
              <Grid item xs={12}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>Root Cause Analysis</Typography>
                    <Divider sx={{ mb: 2 }} />
                    <Typography sx={{ whiteSpace: 'pre-wrap' }}>{capa.rootCauseAnalysis}</Typography>
                  </CardContent>
                </Card>
              </Grid>
            )}
            {capa.actionPlan && (
              <Grid item xs={12}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>Action Plan</Typography>
                    <Divider sx={{ mb: 2 }} />
                    <Typography sx={{ whiteSpace: 'pre-wrap' }}>{capa.actionPlan}</Typography>
                  </CardContent>
                </Card>
              </Grid>
            )}
            {capa.implementationNotes && (
              <Grid item xs={12}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>Implementation Notes</Typography>
                    <Divider sx={{ mb: 2 }} />
                    <Typography sx={{ whiteSpace: 'pre-wrap' }}>{capa.implementationNotes}</Typography>
                  </CardContent>
                </Card>
              </Grid>
            )}
            {capa.verificationMethod && (
              <Grid item xs={12}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>Verification Method</Typography>
                    <Divider sx={{ mb: 2 }} />
                    <Typography sx={{ whiteSpace: 'pre-wrap' }}>{capa.verificationMethod}</Typography>
                  </CardContent>
                </Card>
              </Grid>
            )}
            {capa.verificationNotes && (
              <Grid item xs={12}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>Verification Notes</Typography>
                    <Divider sx={{ mb: 2 }} />
                    <Typography sx={{ whiteSpace: 'pre-wrap' }}>{capa.verificationNotes}</Typography>
                  </CardContent>
                </Card>
              </Grid>
            )}
            {capa.closureNotes && (
              <Grid item xs={12}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>Closure Notes</Typography>
                    <Divider sx={{ mb: 2 }} />
                    <Typography sx={{ whiteSpace: 'pre-wrap' }}>{capa.closureNotes}</Typography>
                  </CardContent>
                </Card>
              </Grid>
            )}
          </Grid>
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Linked Issue</Typography>
              <Divider sx={{ mb: 2 }} />
              {capa.issue ? (
                <Grid container spacing={2}>
                  <Grid item xs={2}><Typography color="text.secondary">Title</Typography></Grid>
                  <Grid item xs={10}>
                    <Link to={`/issues/${capa.issue.id}`} style={{ textDecoration: 'none' }}>
                      <Typography color="primary" sx={{ cursor: 'pointer' }}>
                        {capa.issue.title}
                      </Typography>
                    </Link>
                  </Grid>
                  <Grid item xs={2}><Typography color="text.secondary">Status</Typography></Grid>
                  <Grid item xs={10}>
                    <Chip label={formatStatus(capa.issue.status)} size="small" />
                  </Grid>
                  <Grid item xs={2}><Typography color="text.secondary">Severity</Typography></Grid>
                  <Grid item xs={10}>
                    <Chip label={formatStatus(capa.issue.severity)} size="small" />
                  </Grid>
                  <Grid item xs={12}>
                    <Button
                      variant="outlined"
                      component={Link}
                      to={`/issues/${capa.issue.id}`}
                      startIcon={<IssueIcon />}
                      data-testid="view-issue-button"
                    >
                      View Issue Details
                    </Button>
                  </Grid>
                </Grid>
              ) : (
                <Typography color="text.secondary">
                  Issue ID: {capa.issueId}
                </Typography>
              )}
            </CardContent>
          </Card>
        </TabPanel>

        <TabPanel value={tabValue} index={2}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Status History</Typography>
              <Divider sx={{ mb: 2 }} />
              {historyLoading ? (
                <Typography>Loading history...</Typography>
              ) : statusHistory.length === 0 ? (
                <Typography color="text.secondary" data-testid="status-history-empty">No status history available.</Typography>
              ) : (
                <Table size="small" data-testid="status-history-table">
                  <TableHead>
                    <TableRow>
                      <TableCell>Date</TableCell>
                      <TableCell>Previous Status</TableCell>
                      <TableCell>New Status</TableCell>
                      <TableCell>Reason</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {statusHistory.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>{formatDateTime(item.createdAt)}</TableCell>
                        <TableCell>
                          {item.previousStatus ? (
                            <Chip label={formatStatus(item.previousStatus)} size="small" />
                          ) : (
                            '-'
                          )}
                        </TableCell>
                        <TableCell>
                          <Chip label={formatStatus(item.newStatus)} size="small" color={getStatusColor(item.newStatus)} />
                        </TableCell>
                        <TableCell>{item.changeReason || '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabPanel>
      </Paper>

      <Dialog open={statusDialogOpen} onClose={() => setStatusDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Change CAPA Status</DialogTitle>
        <DialogContent>
          <Box display="flex" flexDirection="column" gap={2} mt={1}>
            <Typography variant="body2" color="text.secondary">
              Current Status: <Chip label={formatStatus(capa.status)} size="small" color={getStatusColor(capa.status)} />
            </Typography>
            <FormControl fullWidth>
              <InputLabel>New Status</InputLabel>
              <Select
                value={selectedStatus}
                label="New Status"
                onChange={(e) => setSelectedStatus(e.target.value as CapaStatus)}
                data-testid="new-status-select"
              >
                {getAvailableTransitions().map((status) => (
                  <MenuItem key={status} value={status}>{formatStatus(status)}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="Reason (optional)"
              value={statusReason}
              onChange={(e) => setStatusReason(e.target.value)}
              fullWidth
              multiline
              rows={2}
              data-testid="status-reason-input"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setStatusDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleUpdateStatus}
            variant="contained"
            disabled={!selectedStatus || updatingStatus}
            data-testid="confirm-status-change-button"
          >
            {updatingStatus ? 'Updating...' : 'Update Status'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Edit CAPA</DialogTitle>
        <DialogContent>
          <Box display="flex" flexDirection="column" gap={2} mt={1}>
            <TextField
              label="Title"
              value={editData.title || ''}
              onChange={(e) => setEditData({ ...editData, title: e.target.value })}
              fullWidth
              data-testid="edit-title-input"
            />
            <TextField
              label="Description"
              value={editData.description || ''}
              onChange={(e) => setEditData({ ...editData, description: e.target.value })}
              fullWidth
              multiline
              rows={3}
              data-testid="edit-description-input"
            />
            <TextField
              label="Root Cause Analysis"
              value={editData.rootCauseAnalysis || ''}
              onChange={(e) => setEditData({ ...editData, rootCauseAnalysis: e.target.value })}
              fullWidth
              multiline
              rows={3}
              data-testid="edit-root-cause-input"
            />
            <TextField
              label="Action Plan"
              value={editData.actionPlan || ''}
              onChange={(e) => setEditData({ ...editData, actionPlan: e.target.value })}
              fullWidth
              multiline
              rows={3}
              data-testid="edit-action-plan-input"
            />
            <TextField
              label="Implementation Notes"
              value={editData.implementationNotes || ''}
              onChange={(e) => setEditData({ ...editData, implementationNotes: e.target.value })}
              fullWidth
              multiline
              rows={3}
              data-testid="edit-implementation-notes-input"
            />
            <TextField
              label="Verification Method"
              value={editData.verificationMethod || ''}
              onChange={(e) => setEditData({ ...editData, verificationMethod: e.target.value })}
              fullWidth
              multiline
              rows={2}
              data-testid="edit-verification-method-input"
            />
            <TextField
              label="Verification Notes"
              value={editData.verificationNotes || ''}
              onChange={(e) => setEditData({ ...editData, verificationNotes: e.target.value })}
              fullWidth
              multiline
              rows={2}
              data-testid="edit-verification-notes-input"
            />
            <TextField
              label="Closure Notes"
              value={editData.closureNotes || ''}
              onChange={(e) => setEditData({ ...editData, closureNotes: e.target.value })}
              fullWidth
              multiline
              rows={2}
              data-testid="edit-closure-notes-input"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleSaveEdit}
            variant="contained"
            disabled={saving}
            data-testid="save-edit-button"
          >
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default CapaDetail;
