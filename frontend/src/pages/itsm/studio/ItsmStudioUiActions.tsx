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
import { itsmApi } from '../../../services/grcClient';
import { ConditionBuilder, Condition } from '../../../components/itsm/ConditionBuilder';

interface UiAction {
  id: string;
  name: string;
  label: string;
  description: string | null;
  tableName: string;
  workflowTransition: string | null;
  requiredRoles: string[] | null;
  showConditions: Condition[] | null;
  style: string;
  order: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

const TABLE_OPTIONS = [
  { value: 'itsm_incidents', label: 'Incidents' },
  { value: 'itsm_changes', label: 'Changes' },
  { value: 'itsm_services', label: 'Services' },
];

const STYLE_OPTIONS = [
  { value: 'primary', label: 'Primary' },
  { value: 'secondary', label: 'Secondary' },
  { value: 'success', label: 'Success' },
  { value: 'warning', label: 'Warning' },
  { value: 'error', label: 'Danger' },
];

const ROLE_OPTIONS = ['admin', 'manager', 'user', 'itil_admin', 'change_manager', 'incident_manager'];

const emptyAction = {
  name: '',
  label: '',
  description: '',
  tableName: 'itsm_incidents',
  workflowTransition: '',
  requiredRoles: [] as string[],
  showConditions: [] as Condition[],
  style: 'secondary',
  order: 100,
  isActive: true,
};

export const ItsmStudioUiActions: React.FC = () => {
  const [actions, setActions] = useState<UiAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyAction);
  const [saving, setSaving] = useState(false);

  const loadActions = useCallback(async () => {
    try {
      setLoading(true);
      const response = await itsmApi.uiActions.list();
      const data = response?.data?.data || response?.data || response || [];
      setActions(Array.isArray(data) ? data : []);
      setError(null);
    } catch (err) {
      setError('Failed to load UI actions');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadActions(); }, [loadActions]);

  const handleOpen = (action?: UiAction) => {
    if (action) {
      setEditingId(action.id);
      setForm({
        name: action.name,
        label: action.label,
        description: action.description || '',
        tableName: action.tableName,
        workflowTransition: action.workflowTransition || '',
        requiredRoles: action.requiredRoles || [],
        showConditions: action.showConditions || [],
        style: action.style || 'secondary',
        order: action.order,
        isActive: action.isActive,
      });
    } else {
      setEditingId(null);
      setForm({ ...emptyAction, requiredRoles: [], showConditions: [] });
    }
    setDialogOpen(true);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const payload = {
        ...form,
        workflowTransition: form.workflowTransition || null,
        requiredRoles: form.requiredRoles.length > 0 ? form.requiredRoles : null,
        showConditions: form.showConditions.length > 0 ? form.showConditions : null,
      };
      if (editingId) {
        await itsmApi.uiActions.update(editingId, payload);
      } else {
        await itsmApi.uiActions.create(payload);
      }
      setDialogOpen(false);
      loadActions();
    } catch (err) {
      console.error('Save failed:', err);
      setError('Failed to save UI action');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this UI action?')) return;
    try {
      await itsmApi.uiActions.delete(id);
      loadActions();
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
          <Typography variant="h5">UI Actions</Typography>
          <Typography variant="body2" color="text.secondary">
            Buttons mapped to workflow transitions or action handlers, gated by role.
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpen()}>
          New Action
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 'bold' }}>Label</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>Name</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>Table</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>Transition</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>Roles</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>Style</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>Order</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>Active</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }} align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {actions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} align="center">
                  <Typography color="text.secondary">No UI actions configured</Typography>
                </TableCell>
              </TableRow>
            ) : (
              actions.map((action) => (
                <TableRow key={action.id} hover>
                  <TableCell><strong>{action.label}</strong></TableCell>
                  <TableCell><Typography variant="body2" sx={{ fontFamily: 'monospace' }}>{action.name}</Typography></TableCell>
                  <TableCell><Chip label={action.tableName} size="small" variant="outlined" /></TableCell>
                  <TableCell>{action.workflowTransition || '—'}</TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {action.requiredRoles?.map((role) => (<Chip key={role} label={role} size="small" />)) || '—'}
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Chip label={action.style} size="small" color={action.style === 'primary' ? 'primary' : action.style === 'success' ? 'success' : action.style === 'error' ? 'error' : action.style === 'warning' ? 'warning' : 'default'} />
                  </TableCell>
                  <TableCell>{action.order}</TableCell>
                  <TableCell>
                    <Chip label={action.isActive ? 'Active' : 'Inactive'} size="small" color={action.isActive ? 'success' : 'default'} />
                  </TableCell>
                  <TableCell align="right">
                    <IconButton size="small" onClick={() => handleOpen(action)}><EditIcon fontSize="small" /></IconButton>
                    <IconButton size="small" onClick={() => handleDelete(action.id)} color="error"><DeleteIcon fontSize="small" /></IconButton>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>{editingId ? 'Edit UI Action' : 'New UI Action'}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField label="Name (identifier)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required fullWidth />
              <TextField label="Label (display)" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} required fullWidth />
            </Box>
            <TextField label="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} multiline rows={2} fullWidth />
            <Box sx={{ display: 'flex', gap: 2 }}>
              <FormControl fullWidth>
                <InputLabel>Table</InputLabel>
                <Select value={form.tableName} label="Table" onChange={(e) => setForm({ ...form, tableName: e.target.value })}>
                  {TABLE_OPTIONS.map((t) => (<MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>))}
                </Select>
              </FormControl>
              <TextField label="Workflow Transition" value={form.workflowTransition} onChange={(e) => setForm({ ...form, workflowTransition: e.target.value })} fullWidth placeholder="e.g. resolve, close, approve" />
            </Box>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <FormControl fullWidth>
                <InputLabel>Required Roles</InputLabel>
                <Select
                  multiple
                  value={form.requiredRoles}
                  label="Required Roles"
                  onChange={(e) => setForm({ ...form, requiredRoles: e.target.value as string[] })}
                  renderValue={(selected) => (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {selected.map((v) => (<Chip key={v} label={v} size="small" />))}
                    </Box>
                  )}
                >
                  {ROLE_OPTIONS.map((role) => (<MenuItem key={role} value={role}>{role}</MenuItem>))}
                </Select>
              </FormControl>
              <FormControl sx={{ minWidth: 140 }}>
                <InputLabel>Style</InputLabel>
                <Select value={form.style} label="Style" onChange={(e) => setForm({ ...form, style: e.target.value })}>
                  {STYLE_OPTIONS.map((s) => (<MenuItem key={s.value} value={s.value}>{s.label}</MenuItem>))}
                </Select>
              </FormControl>
            </Box>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField label="Order" type="number" value={form.order} onChange={(e) => setForm({ ...form, order: parseInt(e.target.value) || 0 })} sx={{ width: 120 }} />
              <FormControlLabel control={<Switch checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />} label="Active" />
            </Box>
            <ConditionBuilder
              conditions={form.showConditions}
              onChange={(showConditions) => setForm({ ...form, showConditions })}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving || !form.name || !form.label}>{saving ? 'Saving...' : 'Save'}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ItsmStudioUiActions;
