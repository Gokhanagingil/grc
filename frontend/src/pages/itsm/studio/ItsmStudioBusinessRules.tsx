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

interface BusinessRuleAction {
  type: 'set_field' | 'reject' | 'add_work_note';
  field?: string;
  value?: string;
  message?: string;
}

interface BusinessRule {
  id: string;
  name: string;
  description: string | null;
  tableName: string;
  trigger: string;
  conditions: Condition[] | null;
  actions: BusinessRuleAction[];
  isActive: boolean;
  order: number;
  createdAt: string;
  updatedAt: string;
}

const TRIGGER_OPTIONS = [
  { value: 'BEFORE_INSERT', label: 'Before Insert' },
  { value: 'AFTER_INSERT', label: 'After Insert' },
  { value: 'BEFORE_UPDATE', label: 'Before Update' },
  { value: 'AFTER_UPDATE', label: 'After Update' },
];

const TABLE_OPTIONS = [
  { value: 'itsm_incidents', label: 'Incidents' },
  { value: 'itsm_changes', label: 'Changes' },
  { value: 'itsm_services', label: 'Services' },
];

const ACTION_TYPE_OPTIONS = [
  { value: 'set_field', label: 'Set Field' },
  { value: 'reject', label: 'Reject' },
  { value: 'add_work_note', label: 'Add Work Note' },
];

const emptyRule = {
  name: '',
  description: '',
  tableName: 'itsm_incidents',
  trigger: 'BEFORE_UPDATE',
  conditions: [] as Condition[],
  actions: [] as BusinessRuleAction[],
  isActive: true,
  order: 100,
};

export const ItsmStudioBusinessRules: React.FC = () => {
  const [rules, setRules] = useState<BusinessRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyRule);
  const [saving, setSaving] = useState(false);

  const loadRules = useCallback(async () => {
    try {
      setLoading(true);
      const response = await itsmApi.businessRules.list();
      const data = response?.data?.data || response?.data || response || [];
      setRules(Array.isArray(data) ? data : []);
      setError(null);
    } catch (err) {
      setError('Failed to load business rules');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadRules(); }, [loadRules]);

  const handleOpen = (rule?: BusinessRule) => {
    if (rule) {
      setEditingId(rule.id);
      setForm({
        name: rule.name,
        description: rule.description || '',
        tableName: rule.tableName,
        trigger: rule.trigger,
        conditions: rule.conditions || [],
        actions: rule.actions || [],
        isActive: rule.isActive,
        order: rule.order,
      });
    } else {
      setEditingId(null);
      setForm({ ...emptyRule, conditions: [], actions: [] });
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
        await itsmApi.businessRules.update(editingId, payload);
      } else {
        await itsmApi.businessRules.create(payload);
      }
      setDialogOpen(false);
      loadRules();
    } catch (err) {
      console.error('Save failed:', err);
      setError('Failed to save business rule');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this business rule?')) return;
    try {
      await itsmApi.businessRules.delete(id);
      loadRules();
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  const addAction = () => {
    setForm({ ...form, actions: [...form.actions, { type: 'set_field', field: '', value: '' }] });
  };

  const removeAction = (index: number) => {
    setForm({ ...form, actions: form.actions.filter((_, i) => i !== index) });
  };

  const updateAction = (index: number, key: string, val: string) => {
    const updated = [...form.actions];
    updated[index] = { ...updated[index], [key]: val };
    setForm({ ...form, actions: updated });
  };

  if (loading) {
    return <Box sx={{ p: 3, textAlign: 'center' }}><CircularProgress /></Box>;
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h5">Business Rules</Typography>
          <Typography variant="body2" color="text.secondary">
            BEFORE/AFTER triggers that execute actions on record insert or update.
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpen()}>
          New Rule
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 'bold' }}>Name</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>Table</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>Trigger</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>Conditions</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>Actions</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>Order</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>Active</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }} align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rules.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} align="center">
                  <Typography color="text.secondary">No business rules configured</Typography>
                </TableCell>
              </TableRow>
            ) : (
              rules.map((rule) => (
                <TableRow key={rule.id} hover>
                  <TableCell>{rule.name}</TableCell>
                  <TableCell>
                    <Chip label={rule.tableName} size="small" variant="outlined" />
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={TRIGGER_OPTIONS.find(t => t.value === rule.trigger)?.label || rule.trigger}
                      size="small"
                      color={rule.trigger.startsWith('BEFORE') ? 'warning' : 'info'}
                    />
                  </TableCell>
                  <TableCell>{rule.conditions?.length || 0}</TableCell>
                  <TableCell>{rule.actions?.length || 0}</TableCell>
                  <TableCell>{rule.order}</TableCell>
                  <TableCell>
                    <Chip label={rule.isActive ? 'Active' : 'Inactive'} size="small" color={rule.isActive ? 'success' : 'default'} />
                  </TableCell>
                  <TableCell align="right">
                    <IconButton size="small" onClick={() => handleOpen(rule)}><EditIcon fontSize="small" /></IconButton>
                    <IconButton size="small" onClick={() => handleDelete(rule.id)} color="error"><DeleteIcon fontSize="small" /></IconButton>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>{editingId ? 'Edit Business Rule' : 'New Business Rule'}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              label="Name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              fullWidth
            />
            <TextField
              label="Description"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              multiline
              rows={2}
              fullWidth
            />
            <Box sx={{ display: 'flex', gap: 2 }}>
              <FormControl fullWidth>
                <InputLabel>Table</InputLabel>
                <Select
                  value={form.tableName}
                  label="Table"
                  onChange={(e) => setForm({ ...form, tableName: e.target.value })}
                >
                  {TABLE_OPTIONS.map((t) => (
                    <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl fullWidth>
                <InputLabel>Trigger</InputLabel>
                <Select
                  value={form.trigger}
                  label="Trigger"
                  onChange={(e) => setForm({ ...form, trigger: e.target.value })}
                >
                  {TRIGGER_OPTIONS.map((t) => (
                    <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                label="Order"
                type="number"
                value={form.order}
                onChange={(e) => setForm({ ...form, order: parseInt(e.target.value) || 0 })}
                sx={{ width: 120 }}
              />
              <FormControlLabel
                control={<Switch checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />}
                label="Active"
              />
            </Box>

            <ConditionBuilder
              conditions={form.conditions}
              onChange={(conditions) => setForm({ ...form, conditions })}
            />

            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="subtitle2" gutterBottom>Actions</Typography>
              {form.actions.map((action, index) => (
                <Box key={index} sx={{ display: 'flex', gap: 1, mb: 1, alignItems: 'center' }}>
                  <FormControl size="small" sx={{ minWidth: 140 }}>
                    <InputLabel>Type</InputLabel>
                    <Select
                      value={action.type}
                      label="Type"
                      onChange={(e) => updateAction(index, 'type', e.target.value)}
                    >
                      {ACTION_TYPE_OPTIONS.map((t) => (
                        <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  {action.type === 'set_field' && (
                    <>
                      <TextField
                        size="small"
                        label="Field"
                        value={action.field || ''}
                        onChange={(e) => updateAction(index, 'field', e.target.value)}
                      />
                      <TextField
                        size="small"
                        label="Value"
                        value={action.value || ''}
                        onChange={(e) => updateAction(index, 'value', e.target.value)}
                        sx={{ flex: 1 }}
                      />
                    </>
                  )}
                  {action.type === 'reject' && (
                    <TextField
                      size="small"
                      label="Rejection Message"
                      value={action.message || ''}
                      onChange={(e) => updateAction(index, 'message', e.target.value)}
                      sx={{ flex: 1 }}
                    />
                  )}
                  {action.type === 'add_work_note' && (
                    <TextField
                      size="small"
                      label="Note Message"
                      value={action.message || ''}
                      onChange={(e) => updateAction(index, 'message', e.target.value)}
                      sx={{ flex: 1 }}
                    />
                  )}
                  <IconButton size="small" onClick={() => removeAction(index)} color="error">
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Box>
              ))}
              <Button startIcon={<AddIcon />} size="small" onClick={addAction}>
                Add Action
              </Button>
            </Paper>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving || !form.name}>
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ItsmStudioBusinessRules;
