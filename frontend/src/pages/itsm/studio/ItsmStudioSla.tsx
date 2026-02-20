import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  IconButton,
  Switch,
  FormControlLabel,
  Alert,
  CircularProgress,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import { itsmApi, unwrapArrayResponse } from '../../../services/grcClient';

interface SlaDefinition {
  id: string;
  name: string;
  description: string | null;
  metric: string;
  targetSeconds: number;
  schedule: string;
  businessStartHour: number;
  businessEndHour: number;
  businessDays: number[];
  priorityFilter: string[] | null;
  serviceIdFilter: string | null;
  stopOnStates: string[];
  pauseOnStates: string[] | null;
  isActive: boolean;
  order: number;
  createdAt: string;
  updatedAt: string;
}

const METRIC_OPTIONS = [
  { value: 'RESPONSE_TIME', label: 'Response Time' },
  { value: 'RESOLUTION_TIME', label: 'Resolution Time' },
];

const SCHEDULE_OPTIONS = [
  { value: '24X7', label: '24x7' },
  { value: 'BUSINESS_HOURS', label: 'Business Hours' },
];

const PRIORITY_OPTIONS = ['p1', 'p2', 'p3', 'p4'];
const STATE_OPTIONS = ['open', 'in_progress', 'assigned', 'resolved', 'closed', 'on_hold', 'pending'];

const emptySla = {
  name: '',
  description: '',
  metric: 'RESOLUTION_TIME',
  targetSeconds: 14400,
  schedule: '24X7',
  businessStartHour: 9,
  businessEndHour: 17,
  businessDays: [1, 2, 3, 4, 5],
  priorityFilter: [] as string[],
  stopOnStates: ['resolved', 'closed'],
  pauseOnStates: [] as string[],
  isActive: true,
  order: 0,
};

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (hours > 0 && mins > 0) return `${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h`;
  return `${mins}m`;
}

export const ItsmStudioSla: React.FC = () => {
  const [definitions, setDefinitions] = useState<SlaDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptySla);
  const [saving, setSaving] = useState(false);
  const [targetHours, setTargetHours] = useState(4);
  const [targetMins, setTargetMins] = useState(0);

  const loadDefinitions = useCallback(async () => {
    try {
      setLoading(true);
      const response = await itsmApi.sla.listDefinitions();
      const items = unwrapArrayResponse<SlaDefinition>(response);
      setDefinitions(items);
      setError(null);
    } catch (err) {
      setError('Failed to load SLA definitions');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadDefinitions(); }, [loadDefinitions]);

  const handleOpen = (def?: SlaDefinition) => {
    if (def) {
      setEditingId(def.id);
      const h = Math.floor(def.targetSeconds / 3600);
      const m = Math.floor((def.targetSeconds % 3600) / 60);
      setTargetHours(h);
      setTargetMins(m);
      setForm({
        name: def.name,
        description: def.description || '',
        metric: def.metric,
        targetSeconds: def.targetSeconds,
        schedule: def.schedule,
        businessStartHour: def.businessStartHour,
        businessEndHour: def.businessEndHour,
        businessDays: def.businessDays || [1, 2, 3, 4, 5],
        priorityFilter: def.priorityFilter || [],
        stopOnStates: def.stopOnStates || ['resolved', 'closed'],
        pauseOnStates: def.pauseOnStates || [],
        isActive: def.isActive,
        order: def.order,
      });
    } else {
      setEditingId(null);
      setTargetHours(4);
      setTargetMins(0);
      setForm({ ...emptySla, priorityFilter: [], stopOnStates: ['resolved', 'closed'], pauseOnStates: [] });
    }
    setDialogOpen(true);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const payload = {
        ...form,
        targetSeconds: targetHours * 3600 + targetMins * 60,
        priorityFilter: form.priorityFilter.length > 0 ? form.priorityFilter : null,
        pauseOnStates: form.pauseOnStates.length > 0 ? form.pauseOnStates : null,
      };
      if (editingId) {
        await itsmApi.sla.updateDefinition(editingId, payload);
      } else {
        await itsmApi.sla.createDefinition(payload);
      }
      setDialogOpen(false);
      loadDefinitions();
    } catch (err) {
      console.error('Save failed:', err);
      setError('Failed to save SLA definition');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this SLA definition?')) return;
    try {
      await itsmApi.sla.deleteDefinition(id);
      loadDefinitions();
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  if (loading) {
    return <Box sx={{ p: 3, textAlign: 'center' }}><CircularProgress /></Box>;
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h5">SLA Definitions</Typography>
          <Typography variant="body2" color="text.secondary">
            Define response and resolution time targets with schedule, priority filters, and state triggers.
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpen()}>
          New SLA
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 'bold' }}>Name</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>Metric</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>Target</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>Schedule</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>Priority Filter</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>Stop States</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>Active</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }} align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {definitions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} align="center">
                  <Typography color="text.secondary">No SLA definitions configured</Typography>
                </TableCell>
              </TableRow>
            ) : (
              definitions.map((def) => (
                <TableRow key={def.id} hover>
                  <TableCell>
                    <Typography fontWeight="bold">{def.name}</Typography>
                    {def.description && <Typography variant="body2" color="text.secondary">{def.description}</Typography>}
                  </TableCell>
                  <TableCell>
                    <Chip label={METRIC_OPTIONS.find(m => m.value === def.metric)?.label || def.metric} size="small" color={def.metric === 'RESPONSE_TIME' ? 'info' : 'warning'} />
                  </TableCell>
                  <TableCell><strong>{formatDuration(def.targetSeconds)}</strong></TableCell>
                  <TableCell>
                    <Chip label={SCHEDULE_OPTIONS.find(s => s.value === def.schedule)?.label || def.schedule} size="small" variant="outlined" />
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {def.priorityFilter?.map((p) => (<Chip key={p} label={p.toUpperCase()} size="small" />)) || <Typography variant="body2" color="text.secondary">All</Typography>}
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {def.stopOnStates?.map((s) => (<Chip key={s} label={s} size="small" variant="outlined" />))}
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Chip label={def.isActive ? 'Active' : 'Inactive'} size="small" color={def.isActive ? 'success' : 'default'} />
                  </TableCell>
                  <TableCell align="right">
                    <IconButton size="small" onClick={() => handleOpen(def)}><EditIcon fontSize="small" /></IconButton>
                    <IconButton size="small" onClick={() => handleDelete(def.id)} color="error"><DeleteIcon fontSize="small" /></IconButton>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>{editingId ? 'Edit SLA Definition' : 'New SLA Definition'}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required fullWidth />
            <TextField label="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} multiline rows={2} fullWidth />
            <Box sx={{ display: 'flex', gap: 2 }}>
              <FormControl fullWidth>
                <InputLabel>Metric</InputLabel>
                <Select value={form.metric} label="Metric" onChange={(e) => setForm({ ...form, metric: e.target.value })}>
                  {METRIC_OPTIONS.map((m) => (<MenuItem key={m.value} value={m.value}>{m.label}</MenuItem>))}
                </Select>
              </FormControl>
              <FormControl fullWidth>
                <InputLabel>Schedule</InputLabel>
                <Select value={form.schedule} label="Schedule" onChange={(e) => setForm({ ...form, schedule: e.target.value })}>
                  {SCHEDULE_OPTIONS.map((s) => (<MenuItem key={s.value} value={s.value}>{s.label}</MenuItem>))}
                </Select>
              </FormControl>
            </Box>

            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
              <TextField label="Target Hours" type="number" value={targetHours} onChange={(e) => setTargetHours(parseInt(e.target.value) || 0)} sx={{ width: 140 }} />
              <TextField label="Target Minutes" type="number" value={targetMins} onChange={(e) => setTargetMins(parseInt(e.target.value) || 0)} sx={{ width: 140 }} />
              <Typography variant="body2" color="text.secondary">= {formatDuration(targetHours * 3600 + targetMins * 60)}</Typography>
            </Box>

            {form.schedule === 'BUSINESS_HOURS' && (
              <Box sx={{ display: 'flex', gap: 2 }}>
                <TextField label="Business Start Hour" type="number" value={form.businessStartHour} onChange={(e) => setForm({ ...form, businessStartHour: parseInt(e.target.value) || 0 })} sx={{ width: 180 }} />
                <TextField label="Business End Hour" type="number" value={form.businessEndHour} onChange={(e) => setForm({ ...form, businessEndHour: parseInt(e.target.value) || 0 })} sx={{ width: 180 }} />
              </Box>
            )}

            <FormControl fullWidth>
              <InputLabel>Priority Filter</InputLabel>
              <Select
                multiple
                value={form.priorityFilter}
                label="Priority Filter"
                onChange={(e) => setForm({ ...form, priorityFilter: e.target.value as string[] })}
                renderValue={(selected) => (<Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>{selected.map((v) => (<Chip key={v} label={v.toUpperCase()} size="small" />))}</Box>)}
              >
                {PRIORITY_OPTIONS.map((p) => (<MenuItem key={p} value={p}>{p.toUpperCase()}</MenuItem>))}
              </Select>
            </FormControl>

            <Box sx={{ display: 'flex', gap: 2 }}>
              <FormControl fullWidth>
                <InputLabel>Stop on States</InputLabel>
                <Select
                  multiple
                  value={form.stopOnStates}
                  label="Stop on States"
                  onChange={(e) => setForm({ ...form, stopOnStates: e.target.value as string[] })}
                  renderValue={(selected) => selected.join(', ')}
                >
                  {STATE_OPTIONS.map((s) => (<MenuItem key={s} value={s}>{s}</MenuItem>))}
                </Select>
              </FormControl>
              <FormControl fullWidth>
                <InputLabel>Pause on States</InputLabel>
                <Select
                  multiple
                  value={form.pauseOnStates}
                  label="Pause on States"
                  onChange={(e) => setForm({ ...form, pauseOnStates: e.target.value as string[] })}
                  renderValue={(selected) => selected.join(', ')}
                >
                  {STATE_OPTIONS.map((s) => (<MenuItem key={s} value={s}>{s}</MenuItem>))}
                </Select>
              </FormControl>
            </Box>

            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField label="Order" type="number" value={form.order} onChange={(e) => setForm({ ...form, order: parseInt(e.target.value) || 0 })} sx={{ width: 120 }} />
              <FormControlLabel control={<Switch checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />} label="Active" />
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving || !form.name}>{saving ? 'Saving...' : 'Save'}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ItsmStudioSla;
