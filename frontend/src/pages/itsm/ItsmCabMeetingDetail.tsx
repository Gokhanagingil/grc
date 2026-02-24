import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  CardHeader,
  Chip,
  TextField,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  IconButton,
  Tooltip,
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Stack,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Grid,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  Save as SaveIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Gavel as GavelIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { itsmApi, CabMeetingData, CabAgendaItemData, UpdateCabMeetingDto, unwrapResponse } from '../../services/grcClient';
import { classifyApiError } from '../../utils/apiErrorClassifier';
import {
  normalizeUpdatePayload,
  CAB_MEETING_UPDATE_FIELDS,
  CAB_MEETING_EMPTY_STRING_FIELDS,
} from '../../utils/payloadNormalizer';

const CAB_STATUS_COLORS: Record<string, 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info'> = {
  DRAFT: 'default',
  SCHEDULED: 'primary',
  IN_PROGRESS: 'warning',
  COMPLETED: 'success',
  CANCELLED: 'error',
};

const DECISION_STATUS_COLORS: Record<string, 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info'> = {
  PENDING: 'default',
  APPROVED: 'success',
  REJECTED: 'error',
  DEFERRED: 'warning',
  CONDITIONAL: 'info',
};

const CAB_STATUSES = ['DRAFT', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];
const DECISION_STATUSES = ['PENDING', 'APPROVED', 'REJECTED', 'DEFERRED', 'CONDITIONAL'];

export default function ItsmCabMeetingDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [meeting, setMeeting] = useState<CabMeetingData | null>(null);
  const [agenda, setAgenda] = useState<CabAgendaItemData[]>([]);
  const [loading, setLoading] = useState(true);
  const [agendaLoading, setAgendaLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Edit form state
  const [editTitle, setEditTitle] = useState('');
  const [editStatus, setEditStatus] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editSummary, setEditSummary] = useState('');
  const [editMeetingAt, setEditMeetingAt] = useState('');
  const [editEndAt, setEditEndAt] = useState('');

  // Add change dialog
  const [addChangeOpen, setAddChangeOpen] = useState(false);
  const [changeIdInput, setChangeIdInput] = useState('');
  const [addingChange, setAddingChange] = useState(false);

  // Decision dialog
  const [decisionOpen, setDecisionOpen] = useState(false);
  const [decisionItemId, setDecisionItemId] = useState('');
  const [decisionStatus, setDecisionStatus] = useState('APPROVED');
  const [decisionNote, setDecisionNote] = useState('');
  const [decisionConditions, setDecisionConditions] = useState('');
  const [recordingDecision, setRecordingDecision] = useState(false);

  const fetchMeeting = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await itsmApi.cabMeetings.get(id);
      const data = unwrapResponse<CabMeetingData>(res);
      if (data) {
        setMeeting(data);
        setEditTitle(data.title || '');
        setEditStatus(data.status || 'DRAFT');
        setEditNotes(data.notes || '');
        setEditSummary(data.summary || '');
        setEditMeetingAt(data.meetingAt ? toLocalDatetimeInput(data.meetingAt) : '');
        setEditEndAt(data.endAt ? toLocalDatetimeInput(data.endAt) : '');
      }
    } catch (err: unknown) {
      const classified = classifyApiError(err);
      setError(classified.message || 'Failed to load meeting');
    } finally {
      setLoading(false);
    }
  }, [id]);

  const fetchAgenda = useCallback(async () => {
    if (!id) return;
    setAgendaLoading(true);
    try {
      const res = await itsmApi.cabMeetings.listAgenda(id);
      const data = res?.data;
      if (Array.isArray(data)) {
        setAgenda(data);
      } else if (data?.items) {
        setAgenda(data.items);
      } else if (data?.data) {
        setAgenda(data.data);
      } else {
        setAgenda([]);
      }
    } catch {
      setAgenda([]);
    } finally {
      setAgendaLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchMeeting();
    fetchAgenda();
  }, [fetchMeeting, fetchAgenda]);

  const handleSave = async () => {
    if (!id) return;
    setSaving(true);
    setError(null);
    try {
      const rawPayload: Record<string, unknown> = {
        title: editTitle,
        status: editStatus,
        notes: editNotes || undefined,
        summary: editSummary || undefined,
        meetingAt: editMeetingAt ? new Date(editMeetingAt).toISOString() : undefined,
        endAt: editEndAt ? new Date(editEndAt).toISOString() : undefined,
      };
      const cleanPayload = normalizeUpdatePayload(
        rawPayload,
        CAB_MEETING_UPDATE_FIELDS,
        CAB_MEETING_EMPTY_STRING_FIELDS,
      );
      await itsmApi.cabMeetings.update(id, cleanPayload as UpdateCabMeetingDto);
      fetchMeeting();
      setError(null);
    } catch (err: unknown) {
      const classified = classifyApiError(err);
      if (classified.kind === 'validation') {
        setError(`Validation failed: ${classified.message}`);
      } else if (classified.kind === 'forbidden') {
        setError('You do not have permission to update this meeting.');
      } else {
        setError(classified.message || 'Failed to save meeting');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleAddChange = async () => {
    if (!id || !changeIdInput) return;
    // Validate UUID format before sending to avoid opaque "verification failed" errors
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(changeIdInput.trim())) {
      setError('Invalid Change ID format. Please enter a valid UUID (e.g., 550e8400-e29b-41d4-a716-446655440000).');
      return;
    }
    setAddingChange(true);
    setError(null);
    try {
      await itsmApi.cabMeetings.addAgendaItem(id, { changeId: changeIdInput.trim() });
      setAddChangeOpen(false);
      setChangeIdInput('');
      fetchAgenda();
    } catch (err: unknown) {
      const classified = classifyApiError(err);
      if (classified.kind === 'validation') {
        setError(`Validation failed: ${classified.message}`);
      } else if (classified.kind === 'not_found') {
        setError('Change not found. Please verify the Change ID exists and belongs to your tenant.');
      } else if (classified.kind === 'forbidden') {
        setError('You do not have permission to modify the agenda.');
      } else {
        setError(classified.message || 'Failed to add change to agenda');
      }
    } finally {
      setAddingChange(false);
    }
  };

  const handleRemoveAgendaItem = async (itemId: string) => {
    if (!id) return;
    if (!window.confirm('Remove this change from the agenda?')) return;
    try {
      await itsmApi.cabMeetings.removeAgendaItem(id, itemId);
      fetchAgenda();
    } catch (err: unknown) {
      const classified = classifyApiError(err);
      setError(classified.message || 'Failed to remove agenda item');
    }
  };

  const openDecisionDialog = (itemId: string, currentStatus: string) => {
    setDecisionItemId(itemId);
    setDecisionStatus(currentStatus === 'PENDING' ? 'APPROVED' : currentStatus);
    setDecisionNote('');
    setDecisionConditions('');
    setDecisionOpen(true);
  };

  const handleRecordDecision = async () => {
    if (!id || !decisionItemId) return;
    setRecordingDecision(true);
    setError(null);
    try {
      await itsmApi.cabMeetings.recordDecision(id, decisionItemId, {
        decisionStatus: decisionStatus,
        decisionNote: decisionNote || undefined,
        conditions: decisionConditions || undefined,
      });
      setDecisionOpen(false);
      fetchAgenda();
    } catch (err: unknown) {
      const classified = classifyApiError(err);
      if (classified.kind === 'validation') {
        setError(`Decision validation failed: ${classified.message}`);
      } else {
        setError(classified.message || 'Failed to record decision');
      }
    } finally {
      setRecordingDecision(false);
    }
  };

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return '-';
    try {
      return new Date(dateStr).toLocaleString();
    } catch {
      return dateStr;
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!meeting) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">Meeting not found</Alert>
        <Button startIcon={<BackIcon />} onClick={() => navigate('/itsm/change-management/cab')} sx={{ mt: 2 }}>
          Back to CAB Meetings
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <IconButton onClick={() => navigate('/itsm/change-management/cab')}>
            <BackIcon />
          </IconButton>
          <Box>
            <Typography variant="h5">
              {meeting.code} - {meeting.title}
            </Typography>
            <Chip
              label={meeting.status}
              size="small"
              color={CAB_STATUS_COLORS[meeting.status] || 'default'}
              sx={{ mt: 0.5 }}
            />
          </Box>
        </Box>
        <Stack direction="row" spacing={1}>
          <Tooltip title="Refresh">
            <IconButton onClick={() => { fetchMeeting(); fetchAgenda(); }}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          <Button
            variant="contained"
            startIcon={<SaveIcon />}
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </Stack>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* Meeting Details Form */}
      <Card sx={{ mb: 3 }}>
        <CardHeader title="Meeting Details" />
        <CardContent>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <TextField
                label="Title"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                fullWidth
                size="small"
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Status</InputLabel>
                <Select
                  value={editStatus}
                  label="Status"
                  onChange={(e) => setEditStatus(e.target.value)}
                >
                  {CAB_STATUSES.map((s) => (
                    <MenuItem key={s} value={s}>{s}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={3}>
              <Typography variant="body2" color="text.secondary">
                Code: <strong>{meeting.code}</strong>
              </Typography>
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                label="Meeting Date & Time"
                type="datetime-local"
                value={editMeetingAt}
                onChange={(e) => setEditMeetingAt(e.target.value)}
                fullWidth
                size="small"
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                label="End Date & Time"
                type="datetime-local"
                value={editEndAt}
                onChange={(e) => setEditEndAt(e.target.value)}
                fullWidth
                size="small"
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                label="Notes"
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                fullWidth
                size="small"
                multiline
                rows={3}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                label="Summary"
                value={editSummary}
                onChange={(e) => setEditSummary(e.target.value)}
                fullWidth
                size="small"
                multiline
                rows={3}
              />
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Agenda */}
      <Card>
        <CardHeader
          title="Agenda"
          action={
            <Button
              variant="outlined"
              startIcon={<AddIcon />}
              size="small"
              onClick={() => setAddChangeOpen(true)}
            >
              Add Change
            </Button>
          }
        />
        <Divider />
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell width={50}>#</TableCell>
                <TableCell>Change</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Risk</TableCell>
                <TableCell>Decision</TableCell>
                <TableCell>Decision Note</TableCell>
                <TableCell>Decision Date</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {agendaLoading ? (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                    <CircularProgress size={24} />
                  </TableCell>
                </TableRow>
              ) : agenda.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                    <Typography color="text.secondary">
                      No changes on the agenda. Click &quot;Add Change&quot; to add one.
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                agenda.map((item, idx) => (
                  <TableRow key={item.id} hover>
                    <TableCell>{idx + 1}</TableCell>
                    <TableCell>
                      <Box
                        sx={{ cursor: 'pointer', color: 'primary.main', '&:hover': { textDecoration: 'underline' } }}
                        onClick={() => navigate(`/itsm/changes/${item.changeId}`)}
                      >
                        <Typography variant="body2" fontWeight={600}>
                          {item.change?.number || item.changeId?.slice(0, 8) || '-'}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {item.change?.title || ''}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip label={item.change?.type || '-'} size="small" variant="outlined" />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={item.change?.risk || '-'}
                        size="small"
                        color={
                          item.change?.risk === 'HIGH' ? 'error' :
                          item.change?.risk === 'MEDIUM' ? 'warning' : 'default'
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={item.decisionStatus}
                        size="small"
                        color={DECISION_STATUS_COLORS[item.decisionStatus] || 'default'}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption">
                        {item.decisionNote || '-'}
                      </Typography>
                    </TableCell>
                    <TableCell>{formatDate(item.decisionAt)}</TableCell>
                    <TableCell align="right">
                      <Tooltip title="Record Decision">
                        <IconButton
                          size="small"
                          onClick={() => openDecisionDialog(item.id, item.decisionStatus)}
                        >
                          <GavelIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Remove from Agenda">
                        <IconButton
                          size="small"
                          onClick={() => handleRemoveAgendaItem(item.id)}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      {/* Add Change Dialog */}
      <Dialog open={addChangeOpen} onClose={() => setAddChangeOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add Change to Agenda</DialogTitle>
        <DialogContent>
          <TextField
            label="Change ID"
            value={changeIdInput}
            onChange={(e) => setChangeIdInput(e.target.value)}
            fullWidth
            size="small"
            sx={{ mt: 1 }}
            placeholder="Enter change UUID"
            helperText="Paste the Change record ID"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddChangeOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleAddChange}
            disabled={addingChange || !changeIdInput}
          >
            {addingChange ? 'Adding...' : 'Add'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Decision Dialog */}
      <Dialog open={decisionOpen} onClose={() => setDecisionOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Record Decision</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <FormControl fullWidth size="small">
              <InputLabel>Decision</InputLabel>
              <Select
                value={decisionStatus}
                label="Decision"
                onChange={(e) => setDecisionStatus(e.target.value)}
              >
                {DECISION_STATUSES.map((s) => (
                  <MenuItem key={s} value={s}>{s}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="Decision Note"
              value={decisionNote}
              onChange={(e) => setDecisionNote(e.target.value)}
              fullWidth
              multiline
              rows={3}
            />
            {decisionStatus === 'CONDITIONAL' && (
              <TextField
                label="Conditions"
                value={decisionConditions}
                onChange={(e) => setDecisionConditions(e.target.value)}
                fullWidth
                multiline
                rows={2}
                helperText="Specify conditions that must be met"
              />
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDecisionOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleRecordDecision}
            disabled={recordingDecision}
          >
            {recordingDecision ? 'Saving...' : 'Save Decision'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

function toLocalDatetimeInput(isoStr: string): string {
  try {
    const d = new Date(isoStr);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return '';
  }
}
