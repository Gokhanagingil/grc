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
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import { itsmApi } from '../../../services/grcClient';
import { ConditionBuilder, Condition } from '../../../components/itsm/ConditionBuilder';

interface FieldEffect {
  field: string;
  visible?: boolean;
  mandatory?: boolean;
  readOnly?: boolean;
}

interface UiPolicy {
  id: string;
  name: string;
  description: string | null;
  tableName: string;
  conditions: Condition[] | null;
  fieldEffects: FieldEffect[];
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

const FIELD_OPTIONS = [
  'status', 'state', 'priority', 'impact', 'urgency', 'category',
  'type', 'risk', 'criticality', 'assignmentGroup', 'assignedTo',
  'approvalStatus', 'tier', 'description', 'resolutionNotes',
];

const emptyPolicy = {
  name: '',
  description: '',
  tableName: 'itsm_incidents',
  conditions: [] as Condition[],
  fieldEffects: [] as FieldEffect[],
  isActive: true,
  order: 100,
};

export const ItsmStudioUiPolicies: React.FC = () => {
  const [policies, setPolicies] = useState<UiPolicy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyPolicy);
  const [saving, setSaving] = useState(false);

  const loadPolicies = useCallback(async () => {
    try {
      setLoading(true);
      const response = await itsmApi.uiPolicies.list();
      const data = response?.data?.data || response?.data || response || [];
      setPolicies(Array.isArray(data) ? data : []);
      setError(null);
    } catch (err) {
      setError('Failed to load UI policies');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadPolicies(); }, [loadPolicies]);

  const handleOpen = (policy?: UiPolicy) => {
    if (policy) {
      setEditingId(policy.id);
      setForm({
        name: policy.name,
        description: policy.description || '',
        tableName: policy.tableName,
        conditions: policy.conditions || [],
        fieldEffects: policy.fieldEffects || [],
        isActive: policy.isActive,
        order: policy.order,
      });
    } else {
      setEditingId(null);
      setForm({ ...emptyPolicy, conditions: [], fieldEffects: [] });
    }
    setDialogOpen(true);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const payload = {
        ...form,
        conditions: form.conditions.length > 0 ? form.conditions : null,
      };
      if (editingId) {
        await itsmApi.uiPolicies.update(editingId, payload);
      } else {
        await itsmApi.uiPolicies.create(payload);
      }
      setDialogOpen(false);
      loadPolicies();
    } catch (err) {
      console.error('Save failed:', err);
      setError('Failed to save UI policy');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this UI policy?')) return;
    try {
      await itsmApi.uiPolicies.delete(id);
      loadPolicies();
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  const addFieldEffect = () => {
    setForm({ ...form, fieldEffects: [...form.fieldEffects, { field: '', visible: true, mandatory: false, readOnly: false }] });
  };

  const removeFieldEffect = (index: number) => {
    setForm({ ...form, fieldEffects: form.fieldEffects.filter((_, i) => i !== index) });
  };

  const updateFieldEffect = (index: number, key: string, val: string | boolean) => {
    const updated = [...form.fieldEffects];
    updated[index] = { ...updated[index], [key]: val };
    setForm({ ...form, fieldEffects: updated });
  };

  if (loading) {
    return <Box sx={{ p: 3, textAlign: 'center' }}><CircularProgress /></Box>;
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h5">UI Policies</Typography>
          <Typography variant="body2" color="text.secondary">
            Condition-based rules that control field visibility, mandatory state, and read-only state.
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpen()}>
          New Policy
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 'bold' }}>Name</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>Table</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>Conditions</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>Field Effects</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>Order</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>Active</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }} align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {policies.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} align="center">
                  <Typography color="text.secondary">No UI policies configured</Typography>
                </TableCell>
              </TableRow>
            ) : (
              policies.map((policy) => (
                <TableRow key={policy.id} hover>
                  <TableCell>{policy.name}</TableCell>
                  <TableCell><Chip label={policy.tableName} size="small" variant="outlined" /></TableCell>
                  <TableCell>{policy.conditions?.length || 0}</TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {policy.fieldEffects?.map((ef, i) => (
                        <Chip
                          key={i}
                          label={`${ef.field}: ${[
                            ef.visible === false ? 'hidden' : '',
                            ef.mandatory ? 'required' : '',
                            ef.readOnly ? 'readonly' : '',
                          ].filter(Boolean).join(', ') || 'visible'}`}
                          size="small"
                          variant="outlined"
                        />
                      ))}
                    </Box>
                  </TableCell>
                  <TableCell>{policy.order}</TableCell>
                  <TableCell>
                    <Chip label={policy.isActive ? 'Active' : 'Inactive'} size="small" color={policy.isActive ? 'success' : 'default'} />
                  </TableCell>
                  <TableCell align="right">
                    <IconButton size="small" onClick={() => handleOpen(policy)}><EditIcon fontSize="small" /></IconButton>
                    <IconButton size="small" onClick={() => handleDelete(policy.id)} color="error"><DeleteIcon fontSize="small" /></IconButton>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>{editingId ? 'Edit UI Policy' : 'New UI Policy'}</DialogTitle>
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

            <ConditionBuilder conditions={form.conditions} onChange={(conditions) => setForm({ ...form, conditions })} />

            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="subtitle2" gutterBottom>Field Effects</Typography>
              {form.fieldEffects.map((effect, index) => (
                <Box key={index} sx={{ display: 'flex', gap: 1, mb: 1, alignItems: 'center' }}>
                  <FormControl size="small" sx={{ minWidth: 160 }}>
                    <InputLabel>Field</InputLabel>
                    <Select value={effect.field} label="Field" onChange={(e) => updateFieldEffect(index, 'field', e.target.value)}>
                      {FIELD_OPTIONS.map((f) => (<MenuItem key={f} value={f}>{f}</MenuItem>))}
                    </Select>
                  </FormControl>
                  <FormControlLabel
                    control={<Checkbox size="small" checked={effect.visible !== false} onChange={(e) => updateFieldEffect(index, 'visible', e.target.checked)} />}
                    label="Visible"
                  />
                  <FormControlLabel
                    control={<Checkbox size="small" checked={effect.mandatory === true} onChange={(e) => updateFieldEffect(index, 'mandatory', e.target.checked)} />}
                    label="Mandatory"
                  />
                  <FormControlLabel
                    control={<Checkbox size="small" checked={effect.readOnly === true} onChange={(e) => updateFieldEffect(index, 'readOnly', e.target.checked)} />}
                    label="Read-only"
                  />
                  <IconButton size="small" onClick={() => removeFieldEffect(index)} color="error"><DeleteIcon fontSize="small" /></IconButton>
                </Box>
              ))}
              <Button startIcon={<AddIcon />} size="small" onClick={addFieldEffect}>Add Field Effect</Button>
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

export default ItsmStudioUiPolicies;
