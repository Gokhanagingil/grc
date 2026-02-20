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
  Checkbox,
  Divider,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import { itsmApi } from '../../../services/grcClient';

interface WorkflowState {
  name: string;
  label: string;
  isInitial?: boolean;
  isFinal?: boolean;
}

interface WorkflowTransition {
  name: string;
  label: string;
  from: string;
  to: string;
  requiredRoles?: string[];
}

interface WorkflowDefinition {
  id: string;
  name: string;
  description: string | null;
  tableName: string;
  states: WorkflowState[];
  transitions: WorkflowTransition[];
  isActive: boolean;
  order: number;
  createdAt: string;
  updatedAt: string;
}

const TABLE_OPTIONS = [
  { value: 'itsm_incidents', label: 'Incidents' },
  { value: 'itsm_changes', label: 'Changes' },
  { value: 'itsm_services', label: 'Services' },
];

const ROLE_OPTIONS = ['admin', 'manager', 'user', 'itil_admin', 'change_manager', 'incident_manager'];

const emptyWorkflow = {
  name: '',
  description: '',
  tableName: 'itsm_incidents',
  states: [] as WorkflowState[],
  transitions: [] as WorkflowTransition[],
  isActive: true,
  order: 0,
};

export const ItsmStudioWorkflows: React.FC = () => {
  const [workflows, setWorkflows] = useState<WorkflowDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyWorkflow);
  const [saving, setSaving] = useState(false);

  const loadWorkflows = useCallback(async () => {
    try {
      setLoading(true);
      const response = await itsmApi.workflows.list();
      const data = response?.data?.data || response?.data || response || [];
      setWorkflows(Array.isArray(data) ? data : []);
      setError(null);
    } catch (err) {
      setError('Failed to load workflows');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadWorkflows(); }, [loadWorkflows]);

  const handleOpen = (wf?: WorkflowDefinition) => {
    if (wf) {
      setEditingId(wf.id);
      setForm({
        name: wf.name,
        description: wf.description || '',
        tableName: wf.tableName,
        states: wf.states || [],
        transitions: wf.transitions || [],
        isActive: wf.isActive,
        order: wf.order,
      });
    } else {
      setEditingId(null);
      setForm({ ...emptyWorkflow, states: [], transitions: [] });
    }
    setDialogOpen(true);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      if (editingId) {
        await itsmApi.workflows.update(editingId, form);
      } else {
        await itsmApi.workflows.create(form);
      }
      setDialogOpen(false);
      loadWorkflows();
    } catch (err) {
      console.error('Save failed:', err);
      setError('Failed to save workflow');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this workflow?')) return;
    try {
      await itsmApi.workflows.delete(id);
      loadWorkflows();
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  const addState = () => {
    setForm({ ...form, states: [...form.states, { name: '', label: '', isInitial: false, isFinal: false }] });
  };

  const removeState = (index: number) => {
    setForm({ ...form, states: form.states.filter((_, i) => i !== index) });
  };

  const updateState = (index: number, key: string, val: string | boolean) => {
    const updated = [...form.states];
    updated[index] = { ...updated[index], [key]: val };
    setForm({ ...form, states: updated });
  };

  const addTransition = () => {
    setForm({ ...form, transitions: [...form.transitions, { name: '', label: '', from: '', to: '', requiredRoles: [] }] });
  };

  const removeTransition = (index: number) => {
    setForm({ ...form, transitions: form.transitions.filter((_, i) => i !== index) });
  };

  const updateTransition = (index: number, key: string, val: string | string[]) => {
    const updated = [...form.transitions];
    updated[index] = { ...updated[index], [key]: val };
    setForm({ ...form, transitions: updated });
  };

  const stateNames = form.states.map(s => s.name).filter(Boolean);

  if (loading) {
    return <Box sx={{ p: 3, textAlign: 'center' }}><CircularProgress /></Box>;
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h5">Workflow Definitions</Typography>
          <Typography variant="body2" color="text.secondary">
            Define states and transitions for ITSM records with role-based constraints.
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpen()}>
          New Workflow
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 'bold' }}>Name</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>Table</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>States</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>Transitions</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>Active</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }} align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {workflows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center">
                  <Typography color="text.secondary">No workflow definitions configured</Typography>
                </TableCell>
              </TableRow>
            ) : (
              workflows.map((wf) => (
                <TableRow key={wf.id} hover>
                  <TableCell>
                    <Typography fontWeight="bold">{wf.name}</Typography>
                    {wf.description && <Typography variant="body2" color="text.secondary">{wf.description}</Typography>}
                  </TableCell>
                  <TableCell><Chip label={wf.tableName} size="small" variant="outlined" /></TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {wf.states?.map((s) => (
                        <Chip
                          key={s.name}
                          label={s.label || s.name}
                          size="small"
                          color={s.isInitial ? 'primary' : s.isFinal ? 'success' : 'default'}
                          variant={s.isInitial || s.isFinal ? 'filled' : 'outlined'}
                        />
                      ))}
                    </Box>
                  </TableCell>
                  <TableCell>{wf.transitions?.length || 0}</TableCell>
                  <TableCell>
                    <Chip label={wf.isActive ? 'Active' : 'Inactive'} size="small" color={wf.isActive ? 'success' : 'default'} />
                  </TableCell>
                  <TableCell align="right">
                    <IconButton size="small" onClick={() => handleOpen(wf)}><EditIcon fontSize="small" /></IconButton>
                    <IconButton size="small" onClick={() => handleDelete(wf.id)} color="error"><DeleteIcon fontSize="small" /></IconButton>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="lg" fullWidth>
        <DialogTitle>{editingId ? 'Edit Workflow' : 'New Workflow'}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required fullWidth />
            <TextField label="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} multiline rows={2} fullWidth />
            <Box sx={{ display: 'flex', gap: 2 }}>
              <FormControl fullWidth>
                <InputLabel>Table</InputLabel>
                <Select value={form.tableName} label="Table" onChange={(e) => setForm({ ...form, tableName: e.target.value })}>
                  {TABLE_OPTIONS.map((t) => (<MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>))}
                </Select>
              </FormControl>
              <TextField label="Order" type="number" value={form.order} onChange={(e) => setForm({ ...form, order: parseInt(e.target.value) || 0 })} sx={{ width: 120 }} />
              <FormControlLabel control={<Switch checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />} label="Active" />
            </Box>

            <Divider />
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="subtitle2" gutterBottom>States</Typography>
              {form.states.map((state, index) => (
                <Box key={index} sx={{ display: 'flex', gap: 1, mb: 1, alignItems: 'center' }}>
                  <TextField size="small" label="Name (key)" value={state.name} onChange={(e) => updateState(index, 'name', e.target.value)} sx={{ flex: 1 }} />
                  <TextField size="small" label="Label (display)" value={state.label} onChange={(e) => updateState(index, 'label', e.target.value)} sx={{ flex: 1 }} />
                  <FormControlLabel control={<Checkbox size="small" checked={state.isInitial === true} onChange={(e) => updateState(index, 'isInitial', e.target.checked)} />} label="Initial" />
                  <FormControlLabel control={<Checkbox size="small" checked={state.isFinal === true} onChange={(e) => updateState(index, 'isFinal', e.target.checked)} />} label="Final" />
                  <IconButton size="small" onClick={() => removeState(index)} color="error"><DeleteIcon fontSize="small" /></IconButton>
                </Box>
              ))}
              <Button startIcon={<AddIcon />} size="small" onClick={addState}>Add State</Button>
            </Paper>

            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="subtitle2" gutterBottom>Transitions</Typography>
              {form.transitions.map((transition, index) => (
                <Box key={index} sx={{ display: 'flex', gap: 1, mb: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                  <TextField size="small" label="Name (key)" value={transition.name} onChange={(e) => updateTransition(index, 'name', e.target.value)} sx={{ minWidth: 130 }} />
                  <TextField size="small" label="Label" value={transition.label} onChange={(e) => updateTransition(index, 'label', e.target.value)} sx={{ minWidth: 130 }} />
                  <FormControl size="small" sx={{ minWidth: 130 }}>
                    <InputLabel>From</InputLabel>
                    <Select value={transition.from} label="From" onChange={(e) => updateTransition(index, 'from', e.target.value)}>
                      {stateNames.map((s) => (<MenuItem key={s} value={s}>{s}</MenuItem>))}
                    </Select>
                  </FormControl>
                  <FormControl size="small" sx={{ minWidth: 130 }}>
                    <InputLabel>To</InputLabel>
                    <Select value={transition.to} label="To" onChange={(e) => updateTransition(index, 'to', e.target.value)}>
                      {stateNames.map((s) => (<MenuItem key={s} value={s}>{s}</MenuItem>))}
                    </Select>
                  </FormControl>
                  <FormControl size="small" sx={{ minWidth: 160 }}>
                    <InputLabel>Roles</InputLabel>
                    <Select
                      multiple
                      value={transition.requiredRoles || []}
                      label="Roles"
                      onChange={(e) => updateTransition(index, 'requiredRoles', e.target.value as string[])}
                      renderValue={(sel) => sel.join(', ')}
                    >
                      {ROLE_OPTIONS.map((r) => (<MenuItem key={r} value={r}>{r}</MenuItem>))}
                    </Select>
                  </FormControl>
                  <IconButton size="small" onClick={() => removeTransition(index)} color="error"><DeleteIcon fontSize="small" /></IconButton>
                </Box>
              ))}
              <Button startIcon={<AddIcon />} size="small" onClick={addTransition}>Add Transition</Button>
            </Paper>
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

export default ItsmStudioWorkflows;
