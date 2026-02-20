import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Typography,
  Button,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControlLabel,
  Switch,
  MenuItem,
  Select,
  IconButton,
  InputLabel,
  FormControl,
} from '@mui/material';
import { Add as AddIcon, Delete as DeleteIcon, Edit as EditIcon } from '@mui/icons-material';
import { GenericListPage, ColumnDefinition } from '../../components/common/GenericListPage';
import { cmdbImportApi, CmdbReconcileRuleData, CreateCmdbReconcileRuleDto } from '../../services/grcClient';
import { useNotification } from '../../contexts/NotificationContext';

interface FieldEntry {
  field: string;
  ciField: string;
  weight: number;
  uniqueRequired: boolean;
}

const DEFAULT_FIELD: FieldEntry = { field: '', ciField: '', weight: 1, uniqueRequired: false };

export const CmdbReconcileRules: React.FC = () => {
  const { showNotification } = useNotification();
  const [items, setItems] = useState<CmdbReconcileRuleData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [search, setSearch] = useState('');

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [strategyType, setStrategyType] = useState<'exact' | 'composite'>('exact');
  const [fields, setFields] = useState<FieldEntry[]>([{ ...DEFAULT_FIELD }]);
  const [precedence, setPrecedence] = useState(0);
  const [enabled, setEnabled] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await cmdbImportApi.rules.list({ page, pageSize, q: search });
      const data = response.data;
      if (data && 'data' in data) {
        const inner = data.data;
        if (inner && 'items' in inner) {
          setItems(Array.isArray(inner.items) ? inner.items : []);
          setTotal(inner.total || 0);
        } else {
          setItems(Array.isArray(inner) ? inner : []);
          setTotal(data.total || 0);
        }
      } else {
        setItems([]);
        setTotal(0);
      }
    } catch (err) {
      console.error('Error fetching rules:', err);
      setError('Failed to load reconcile rules.');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const resetForm = () => {
    setEditingId(null);
    setName('');
    setStrategyType('exact');
    setFields([{ ...DEFAULT_FIELD }]);
    setPrecedence(0);
    setEnabled(true);
  };

  const openCreate = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEdit = (rule: CmdbReconcileRuleData) => {
    setEditingId(rule.id);
    setName(rule.name);
    setStrategyType(rule.matchStrategy?.type || 'exact');
    setFields(
      rule.matchStrategy?.fields?.length
        ? rule.matchStrategy.fields.map((f) => ({
            field: f.field,
            ciField: f.ciField,
            weight: f.weight || 1,
            uniqueRequired: f.uniqueRequired || false,
          }))
        : [{ ...DEFAULT_FIELD }],
    );
    setPrecedence(rule.precedence);
    setEnabled(rule.enabled);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      showNotification('Name is required', 'error');
      return;
    }
    const validFields = fields.filter((f) => f.field.trim() && f.ciField.trim());
    if (validFields.length === 0) {
      showNotification('At least one field mapping is required', 'error');
      return;
    }

    setSaving(true);
    try {
      const dto: CreateCmdbReconcileRuleDto = {
        name: name.trim(),
        matchStrategy: {
          type: strategyType,
          fields: validFields,
        },
        precedence,
        enabled,
      };

      if (editingId) {
        await cmdbImportApi.rules.update(editingId, dto);
        showNotification('Rule updated', 'success');
      } else {
        await cmdbImportApi.rules.create(dto);
        showNotification('Rule created', 'success');
      }
      setDialogOpen(false);
      resetForm();
      fetchItems();
    } catch (err) {
      console.error('Error saving rule:', err);
      showNotification('Failed to save rule', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await cmdbImportApi.rules.delete(id);
      showNotification('Rule deleted', 'success');
      fetchItems();
    } catch (err) {
      console.error('Error deleting rule:', err);
      showNotification('Failed to delete rule', 'error');
    }
  };

  const addField = () => setFields([...fields, { ...DEFAULT_FIELD }]);
  const removeField = (i: number) => setFields(fields.filter((_, idx) => idx !== i));
  const updateField = (i: number, key: keyof FieldEntry, val: string | number | boolean) => {
    const updated = [...fields];
    const entry = { ...updated[i] };
    if (key === 'field') entry.field = val as string;
    else if (key === 'ciField') entry.ciField = val as string;
    else if (key === 'weight') entry.weight = val as number;
    else if (key === 'uniqueRequired') entry.uniqueRequired = val as boolean;
    updated[i] = entry;
    setFields(updated);
  };

  const columns: ColumnDefinition<CmdbReconcileRuleData>[] = useMemo(() => [
    {
      key: 'precedence',
      header: '#',
      render: (row) => <Typography variant="body2" fontWeight={600}>{row.precedence}</Typography>,
    },
    {
      key: 'name',
      header: 'Name',
      render: (row) => <Typography variant="body2" fontWeight={500}>{row.name}</Typography>,
    },
    {
      key: 'type',
      header: 'Strategy',
      render: (row) => (
        <Chip label={row.matchStrategy?.type || 'exact'} size="small" variant="outlined" />
      ),
    },
    {
      key: 'fields',
      header: 'Match Fields',
      render: (row) => (
        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
          {row.matchStrategy?.fields?.map((f, i) => (
            <Chip key={i} label={`${f.field} -> ${f.ciField}`} size="small" variant="outlined" />
          ))}
        </Box>
      ),
    },
    {
      key: 'enabled',
      header: 'Enabled',
      render: (row) => (
        <Chip label={row.enabled ? 'Yes' : 'No'} size="small" color={row.enabled ? 'success' : 'default'} />
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (row) => (
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <IconButton size="small" onClick={(e) => { e.stopPropagation(); openEdit(row); }}>
            <EditIcon fontSize="small" />
          </IconButton>
          <IconButton size="small" color="error" onClick={(e) => { e.stopPropagation(); handleDelete(row.id); }}>
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Box>
      ),
    },
  ], [handleDelete]);

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" fontWeight={600}>
          Reconcile Rules
        </Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
          New Rule
        </Button>
      </Box>

      <GenericListPage<CmdbReconcileRuleData>
        title="Reconcile Rules"
        items={items}
        columns={columns}
        isLoading={loading}
        error={error}
        onClearError={() => setError(null)}
        total={total}
        page={page}
        pageSize={pageSize}
        search={search}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        onSearchChange={setSearch}
        onRefresh={fetchItems}
        emptyMessage="No reconcile rules configured. Create rules to match imported rows against existing CIs."
        searchPlaceholder="Search rules..."
        getRowKey={(row) => row.id}
      />

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>{editingId ? 'Edit Reconcile Rule' : 'New Reconcile Rule'}</DialogTitle>
        <DialogContent>
          <TextField
            label="Rule Name"
            fullWidth
            value={name}
            onChange={(e) => setName(e.target.value)}
            sx={{ mt: 1, mb: 2 }}
          />

          <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
            <FormControl sx={{ minWidth: 200 }}>
              <InputLabel>Strategy Type</InputLabel>
              <Select
                value={strategyType}
                label="Strategy Type"
                onChange={(e) => setStrategyType(e.target.value as 'exact' | 'composite')}
              >
                <MenuItem value="exact">Exact Match</MenuItem>
                <MenuItem value="composite">Composite Match</MenuItem>
              </Select>
            </FormControl>
            <TextField
              label="Precedence"
              type="number"
              value={precedence}
              onChange={(e) => setPrecedence(parseInt(e.target.value, 10) || 0)}
              sx={{ width: 120 }}
            />
            <FormControlLabel
              control={<Switch checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />}
              label="Enabled"
            />
          </Box>

          <Typography variant="subtitle2" sx={{ mb: 1 }}>Field Mappings</Typography>
          {fields.map((f, i) => (
            <Box key={i} sx={{ display: 'flex', gap: 1, mb: 1, alignItems: 'center' }}>
              <TextField
                label="Import Field"
                size="small"
                value={f.field}
                onChange={(e) => updateField(i, 'field', e.target.value)}
                placeholder="e.g., hostname"
              />
              <Typography variant="body2">-&gt;</Typography>
              <TextField
                label="CI Field"
                size="small"
                value={f.ciField}
                onChange={(e) => updateField(i, 'ciField', e.target.value)}
                placeholder="e.g., name"
              />
              <TextField
                label="Weight"
                size="small"
                type="number"
                value={f.weight}
                onChange={(e) => updateField(i, 'weight', parseInt(e.target.value, 10) || 1)}
                sx={{ width: 80 }}
              />
              <FormControlLabel
                control={
                  <Switch
                    size="small"
                    checked={f.uniqueRequired}
                    onChange={(e) => updateField(i, 'uniqueRequired', e.target.checked)}
                  />
                }
                label="Required"
              />
              {fields.length > 1 && (
                <IconButton size="small" color="error" onClick={() => removeField(i)}>
                  <DeleteIcon fontSize="small" />
                </IconButton>
              )}
            </Box>
          ))}
          <Button size="small" onClick={addField} sx={{ mt: 1 }}>+ Add Field</Button>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : editingId ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default CmdbReconcileRules;
