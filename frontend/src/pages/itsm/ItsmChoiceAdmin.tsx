import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { itsmApi, ItsmChoiceData, ItsmManagedTable } from '../../services/grcClient';
import { useNotification } from '../../contexts/NotificationContext';
import { invalidateChoiceCache } from '../../hooks/useItsmChoices';

const TABLE_LABELS: Record<string, string> = {
  itsm_incidents: 'Incidents',
  itsm_changes: 'Changes',
  itsm_services: 'Services',
};

function toFieldLabel(field: string): string {
  return field.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

interface ChoiceFormData {
  tableName: string;
  fieldName: string;
  value: string;
  label: string;
  sortOrder: number;
  isActive: boolean;
}

const EMPTY_FORM: ChoiceFormData = {
  tableName: '',
  fieldName: '',
  value: '',
  label: '',
  sortOrder: 0,
  isActive: true,
};

export const ItsmChoiceAdmin: React.FC = () => {
  const { showNotification } = useNotification();

  const [managedTables, setManagedTables] = useState<ItsmManagedTable[]>([]);
  const [selectedTable, setSelectedTable] = useState('');
  const [selectedField, setSelectedField] = useState('');
  const [choices, setChoices] = useState<ItsmChoiceData[]>([]);
  const [loading, setLoading] = useState(false);
  const [tablesLoading, setTablesLoading] = useState(true);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ChoiceFormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const fetchTables = useCallback(async () => {
    setTablesLoading(true);
    try {
      const response = await itsmApi.choices.tables();
      const raw = response.data;
      let tables: ItsmManagedTable[] = [];
      if (raw && typeof raw === 'object' && 'tables' in raw) {
        tables = (raw as { tables: ItsmManagedTable[] }).tables;
      } else if (raw && typeof raw === 'object' && 'data' in raw) {
        const inner = (raw as { data: { tables: ItsmManagedTable[] } }).data;
        if (inner && 'tables' in inner) {
          tables = inner.tables;
        }
      }
      setManagedTables(tables);
      if (tables.length > 0 && !selectedTable) {
        setSelectedTable(tables[0].name);
        if (tables[0].fields.length > 0) {
          setSelectedField(tables[0].fields[0]);
        }
      }
    } catch (err) {
      console.error('Failed to load managed tables:', err);
      showNotification('Failed to load managed tables', 'error');
    } finally {
      setTablesLoading(false);
    }
  }, [showNotification, selectedTable]);

  const fetchChoices = useCallback(async () => {
    if (!selectedTable) return;
    setLoading(true);
    try {
      let url: string;
      if (selectedField) {
        url = selectedField;
      } else {
        url = undefined as unknown as string;
      }
      const response = await itsmApi.choices.list(selectedTable, url || undefined);
      const raw = response.data;

      let items: ItsmChoiceData[] = [];
      if (raw && typeof raw === 'object' && 'data' in raw) {
        const inner = (raw as { data: unknown }).data;
        if (Array.isArray(inner)) {
          items = inner;
        } else if (inner && typeof inner === 'object') {
          for (const arr of Object.values(inner as Record<string, ItsmChoiceData[]>)) {
            if (Array.isArray(arr)) {
              items = items.concat(arr);
            }
          }
        }
      } else if (Array.isArray(raw)) {
        items = raw;
      } else if (raw && typeof raw === 'object') {
        for (const arr of Object.values(raw as Record<string, ItsmChoiceData[]>)) {
          if (Array.isArray(arr)) {
            items = items.concat(arr);
          }
        }
      }

      items.sort((a, b) => {
        if (a.fieldName !== b.fieldName) return a.fieldName.localeCompare(b.fieldName);
        return (a.sortOrder || 0) - (b.sortOrder || 0);
      });

      setChoices(items);
    } catch (err) {
      console.error('Failed to load choices:', err);
      showNotification('Failed to load choices', 'error');
    } finally {
      setLoading(false);
    }
  }, [selectedTable, selectedField, showNotification]);

  useEffect(() => {
    fetchTables();
  }, [fetchTables]);

  useEffect(() => {
    if (selectedTable) {
      fetchChoices();
    }
  }, [selectedTable, selectedField, fetchChoices]);

  const currentTableFields = managedTables.find((t) => t.name === selectedTable)?.fields || [];

  const handleTableChange = (table: string) => {
    setSelectedTable(table);
    setSelectedField('');
  };

  const openCreateDialog = () => {
    setEditingId(null);
    setForm({
      ...EMPTY_FORM,
      tableName: selectedTable,
      fieldName: selectedField || (currentTableFields[0] || ''),
    });
    setDialogOpen(true);
  };

  const openEditDialog = (choice: ItsmChoiceData) => {
    setEditingId(choice.id);
    setForm({
      tableName: choice.tableName,
      fieldName: choice.fieldName,
      value: choice.value,
      label: choice.label,
      sortOrder: choice.sortOrder,
      isActive: choice.isActive,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.value.trim() || !form.label.trim()) {
      showNotification('Value and Label are required', 'error');
      return;
    }
    if (!form.tableName || !form.fieldName) {
      showNotification('Table and Field are required', 'error');
      return;
    }

    setSaving(true);
    try {
      if (editingId) {
        await itsmApi.choices.update(editingId, {
          label: form.label,
          sortOrder: form.sortOrder,
          isActive: form.isActive,
        });
        showNotification('Choice updated', 'success');
      } else {
        await itsmApi.choices.create({
          tableName: form.tableName,
          fieldName: form.fieldName,
          value: form.value,
          label: form.label,
          sortOrder: form.sortOrder,
          isActive: form.isActive,
        });
        showNotification('Choice created', 'success');
      }
      invalidateChoiceCache(form.tableName);
      setDialogOpen(false);
      fetchChoices();
    } catch (err) {
      console.error('Failed to save choice:', err);
      showNotification('Failed to save choice', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (choice: ItsmChoiceData) => {
    if (!window.confirm(`Deactivate choice "${choice.label}"?`)) return;
    try {
      await itsmApi.choices.delete(choice.id);
      showNotification('Choice deactivated', 'success');
      invalidateChoiceCache(choice.tableName);
      fetchChoices();
    } catch (err) {
      console.error('Failed to deactivate choice:', err);
      showNotification('Failed to deactivate choice', 'error');
    }
  };

  if (tablesLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" fontWeight={600}>
          Choice Management
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Tooltip title="Refresh">
            <IconButton onClick={fetchChoices}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          <Button variant="contained" startIcon={<AddIcon />} onClick={openCreateDialog} disabled={!selectedTable}>
            New Choice
          </Button>
        </Box>
      </Box>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={5}>
              <FormControl fullWidth size="small">
                <InputLabel>Table</InputLabel>
                <Select
                  value={selectedTable}
                  label="Table"
                  onChange={(e) => handleTableChange(e.target.value)}
                >
                  {managedTables.map((t) => (
                    <MenuItem key={t.name} value={t.name}>
                      {TABLE_LABELS[t.name] || t.name} ({t.name})
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={5}>
              <FormControl fullWidth size="small">
                <InputLabel>Field</InputLabel>
                <Select
                  value={selectedField}
                  label="Field"
                  onChange={(e) => setSelectedField(e.target.value)}
                >
                  <MenuItem value="">All Fields</MenuItem>
                  {currentTableFields.map((f) => (
                    <MenuItem key={f} value={f}>
                      {toFieldLabel(f)}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={2}>
              <Typography variant="body2" color="text.secondary">
                {choices.length} choice{choices.length !== 1 ? 's' : ''}
              </Typography>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <Card>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Field</TableCell>
                <TableCell>Value</TableCell>
                <TableCell>Label</TableCell>
                <TableCell align="center">Order</TableCell>
                <TableCell align="center">Active</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                    <CircularProgress size={24} />
                  </TableCell>
                </TableRow>
              ) : choices.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                    <Typography variant="body2" color="text.secondary">
                      No choices found. Click "New Choice" to add one.
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                choices.map((choice) => (
                  <TableRow key={choice.id} hover>
                    <TableCell>{toFieldLabel(choice.fieldName)}</TableCell>
                    <TableCell>
                      <code>{choice.value}</code>
                    </TableCell>
                    <TableCell>{choice.label}</TableCell>
                    <TableCell align="center">{choice.sortOrder}</TableCell>
                    <TableCell align="center">
                      <Chip
                        label={choice.isActive ? 'Active' : 'Inactive'}
                        color={choice.isActive ? 'success' : 'default'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell align="right">
                      <IconButton size="small" onClick={() => openEditDialog(choice)}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <IconButton size="small" onClick={() => handleDelete(choice)} color="error">
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingId ? 'Edit Choice' : 'New Choice'}</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <FormControl fullWidth size="small" disabled={!!editingId}>
              <InputLabel>Table</InputLabel>
              <Select
                value={form.tableName}
                label="Table"
                onChange={(e) => setForm((p) => ({ ...p, tableName: e.target.value, fieldName: '' }))}
              >
                {managedTables.map((t) => (
                  <MenuItem key={t.name} value={t.name}>
                    {TABLE_LABELS[t.name] || t.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth size="small" disabled={!!editingId}>
              <InputLabel>Field</InputLabel>
              <Select
                value={form.fieldName}
                label="Field"
                onChange={(e) => setForm((p) => ({ ...p, fieldName: e.target.value }))}
              >
                {(managedTables.find((t) => t.name === form.tableName)?.fields || []).map((f) => (
                  <MenuItem key={f} value={f}>
                    {toFieldLabel(f)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Divider />
            <TextField
              fullWidth
              size="small"
              label="Value (canonical, e.g. open, p1, STANDARD)"
              value={form.value}
              onChange={(e) => setForm((p) => ({ ...p, value: e.target.value }))}
              disabled={!!editingId}
            />
            <TextField
              fullWidth
              size="small"
              label="Label (display name)"
              value={form.label}
              onChange={(e) => setForm((p) => ({ ...p, label: e.target.value }))}
            />
            <TextField
              fullWidth
              size="small"
              type="number"
              label="Sort Order"
              value={form.sortOrder}
              onChange={(e) => setForm((p) => ({ ...p, sortOrder: parseInt(e.target.value, 10) || 0 }))}
            />
            <FormControl fullWidth size="small">
              <InputLabel>Active</InputLabel>
              <Select
                value={form.isActive ? 'true' : 'false'}
                label="Active"
                onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.value === 'true' }))}
              >
                <MenuItem value="true">Active</MenuItem>
                <MenuItem value="false">Inactive</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ItsmChoiceAdmin;
