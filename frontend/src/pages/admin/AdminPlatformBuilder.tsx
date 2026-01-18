import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  CircularProgress,
  Paper,
  Tabs,
  Tab,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Switch,
  Tooltip,
  TablePagination,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  Visibility as PreviewIcon,
  TableChart as TableIcon,
  Settings as FieldsIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import {
  platformBuilderApi,
  SysDbObjectData,
  SysDictionaryData,
  CreateTableDto,
  UpdateTableDto,
  CreateFieldDto,
  UpdateFieldDto,
  ChoiceOption,
} from '../../services/grcClient';
import { useAuth } from '../../contexts/AuthContext';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div role="tabpanel" hidden={value !== index} {...other}>
      {value === index && <Box sx={{ p: 2 }}>{children}</Box>}
    </div>
  );
}

const FIELD_TYPES = [
  { value: 'string', label: 'String' },
  { value: 'text', label: 'Text (Long)' },
  { value: 'integer', label: 'Integer' },
  { value: 'decimal', label: 'Decimal' },
  { value: 'boolean', label: 'Boolean' },
  { value: 'date', label: 'Date' },
  { value: 'datetime', label: 'Date/Time' },
  { value: 'choice', label: 'Choice' },
  { value: 'reference', label: 'Reference' },
];

export const AdminPlatformBuilder: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const tenantId = user?.tenantId || '';

  const [tables, setTables] = useState<SysDbObjectData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');

  const [openTableDialog, setOpenTableDialog] = useState(false);
  const [editingTable, setEditingTable] = useState<SysDbObjectData | null>(null);
  const [tableFormData, setTableFormData] = useState<CreateTableDto>({
    name: '',
    label: '',
    description: '',
    isActive: true,
  });

  const [selectedTable, setSelectedTable] = useState<SysDbObjectData | null>(null);
  const [fields, setFields] = useState<SysDictionaryData[]>([]);
  const [fieldsLoading, setFieldsLoading] = useState(false);
  const [tabValue, setTabValue] = useState(0);

  const [openFieldDialog, setOpenFieldDialog] = useState(false);
  const [editingField, setEditingField] = useState<SysDictionaryData | null>(null);
  const [fieldFormData, setFieldFormData] = useState<CreateFieldDto>({
    fieldName: '',
    label: '',
    type: 'string',
    isRequired: false,
    isUnique: false,
    referenceTable: '',
    choiceOptions: [],
    defaultValue: '',
    fieldOrder: 0,
    isActive: true,
  });
  const [choiceOptionsText, setChoiceOptionsText] = useState('');

  const getErrorMessage = (err: unknown, defaultMessage: string): string => {
    const error = err as { response?: { status?: number; data?: { message?: string } } };
    const status = error.response?.status;
    const serverMessage = error.response?.data?.message;
    
    if (status === 401) {
      return 'Session expired or not authenticated. Please log in again.';
    }
    if (status === 403) {
      return 'You do not have permission to access this resource.';
    }
    if (status === 404) {
      return 'Resource not found. The endpoint may not be configured correctly.';
    }
    if (status && status >= 500) {
      return serverMessage || 'Server error. Please try again later.';
    }
    return serverMessage || defaultMessage;
  };

  const fetchTables = useCallback(async () => {
    if (!tenantId) return;
    try {
      setLoading(true);
      setError('');
      const response = await platformBuilderApi.listTables(tenantId, {
        page: page + 1,
        pageSize,
        search: search || undefined,
      });
      setTables(response.items || []);
      setTotal(response.total || 0);
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to fetch tables'));
      setTables([]);
    } finally {
      setLoading(false);
    }
  }, [tenantId, page, pageSize, search]);

  const fetchFields = useCallback(async (tableId: string) => {
    if (!tenantId) return;
    try {
      setFieldsLoading(true);
      const response = await platformBuilderApi.listFields(tenantId, tableId, {
        page: 1,
        pageSize: 100,
      });
      setFields(response.items || []);
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to fetch fields'));
      setFields([]);
    } finally {
      setFieldsLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    fetchTables();
  }, [fetchTables]);

  useEffect(() => {
    if (selectedTable) {
      fetchFields(selectedTable.id);
    }
  }, [selectedTable, fetchFields]);

  const handleOpenTableDialog = (table?: SysDbObjectData) => {
    if (table) {
      setEditingTable(table);
      setTableFormData({
        name: table.name,
        label: table.label,
        description: table.description || '',
        isActive: table.isActive,
      });
    } else {
      setEditingTable(null);
      setTableFormData({
        name: '',
        label: '',
        description: '',
        isActive: true,
      });
    }
    setOpenTableDialog(true);
  };

  const handleSaveTable = async () => {
    try {
      if (editingTable) {
        const updateData: UpdateTableDto = {
          label: tableFormData.label,
          description: tableFormData.description,
          isActive: tableFormData.isActive,
        };
        await platformBuilderApi.updateTable(tenantId, editingTable.id, updateData);
        setSuccess('Table updated successfully');
        if (selectedTable?.id === editingTable.id) {
          const updated = await platformBuilderApi.getTable(tenantId, editingTable.id);
          setSelectedTable(updated);
        }
      } else {
        await platformBuilderApi.createTable(tenantId, tableFormData);
        setSuccess('Table created successfully');
      }
      setOpenTableDialog(false);
      fetchTables();
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to save table'));
    }
  };

  const handleDeleteTable = async (table: SysDbObjectData) => {
    if (!window.confirm(`Are you sure you want to delete table "${table.label}"?`)) return;
    try {
      await platformBuilderApi.deleteTable(tenantId, table.id);
      setSuccess('Table deleted successfully');
      if (selectedTable?.id === table.id) {
        setSelectedTable(null);
        setFields([]);
      }
      fetchTables();
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to delete table'));
    }
  };

  const handleSelectTable = async (table: SysDbObjectData) => {
    try {
      const fullTable = await platformBuilderApi.getTable(tenantId, table.id);
      setSelectedTable(fullTable);
      setTabValue(0);
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to load table details'));
    }
  };

  const handleOpenFieldDialog = (field?: SysDictionaryData) => {
    if (field) {
      setEditingField(field);
      setFieldFormData({
        fieldName: field.fieldName,
        label: field.label,
        type: field.type,
        isRequired: field.isRequired,
        isUnique: field.isUnique,
        referenceTable: field.referenceTable || '',
        choiceOptions: field.choiceOptions || [],
        defaultValue: field.defaultValue || '',
        fieldOrder: field.fieldOrder,
        isActive: field.isActive,
      });
      setChoiceOptionsText(
        (field.choiceOptions || []).map((o) => `${o.value}:${o.label}`).join('\n')
      );
    } else {
      setEditingField(null);
      const maxOrder = fields.reduce((max, f) => Math.max(max, f.fieldOrder), 0);
      setFieldFormData({
        fieldName: '',
        label: '',
        type: 'string',
        isRequired: false,
        isUnique: false,
        referenceTable: '',
        choiceOptions: [],
        defaultValue: '',
        fieldOrder: maxOrder + 10,
        isActive: true,
      });
      setChoiceOptionsText('');
    }
    setOpenFieldDialog(true);
  };

  const parseChoiceOptions = (text: string): ChoiceOption[] => {
    return text
      .split('\n')
      .filter((line) => line.trim())
      .map((line) => {
        const [value, label] = line.split(':').map((s) => s.trim());
        return { value: value || '', label: label || value || '' };
      });
  };

  const handleSaveField = async () => {
    if (!selectedTable) return;
    try {
      const choiceOptions = fieldFormData.type === 'choice' ? parseChoiceOptions(choiceOptionsText) : undefined;
      
      if (editingField) {
        const updateData: UpdateFieldDto = {
          label: fieldFormData.label,
          type: fieldFormData.type,
          isRequired: fieldFormData.isRequired,
          isUnique: fieldFormData.isUnique,
          referenceTable: fieldFormData.type === 'reference' ? fieldFormData.referenceTable : undefined,
          choiceOptions,
          defaultValue: fieldFormData.defaultValue || undefined,
          fieldOrder: fieldFormData.fieldOrder,
          isActive: fieldFormData.isActive,
        };
        await platformBuilderApi.updateField(tenantId, editingField.id, updateData);
        setSuccess('Field updated successfully');
      } else {
        const createData: CreateFieldDto = {
          ...fieldFormData,
          referenceTable: fieldFormData.type === 'reference' ? fieldFormData.referenceTable : undefined,
          choiceOptions,
        };
        await platformBuilderApi.createField(tenantId, selectedTable.id, createData);
        setSuccess('Field created successfully');
      }
      setOpenFieldDialog(false);
      fetchFields(selectedTable.id);
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to save field'));
    }
  };

  const handleDeleteField = async (field: SysDictionaryData) => {
    if (!window.confirm(`Are you sure you want to delete field "${field.label}"?`)) return;
    if (!selectedTable) return;
    try {
      await platformBuilderApi.deleteField(tenantId, field.id);
      setSuccess('Field deleted successfully');
      fetchFields(selectedTable.id);
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to delete field'));
    }
  };

  const handlePreviewData = () => {
    if (selectedTable) {
      navigate(`/data/${selectedTable.name}`);
    }
  };

  const isTableNameValid = (name: string) => /^u_[a-z0-9_]+$/.test(name);
  const isFieldNameValid = (name: string) => /^[a-z][a-z0-9_]*$/.test(name);

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5">Platform Builder</Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>
          {success}
        </Alert>
      )}

      <Box display="flex" gap={2}>
        <Paper sx={{ width: 350, flexShrink: 0 }}>
          <Box p={2} borderBottom={1} borderColor="divider">
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography variant="h6">Tables</Typography>
              <Box>
                <IconButton size="small" onClick={fetchTables} title="Refresh">
                  <RefreshIcon />
                </IconButton>
                <Button
                  size="small"
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={() => handleOpenTableDialog()}
                  sx={{ ml: 1 }}
                >
                  New
                </Button>
              </Box>
            </Box>
            <TextField
              fullWidth
              size="small"
              placeholder="Search tables..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </Box>

          {loading ? (
            <Box display="flex" justifyContent="center" py={4}>
              <CircularProgress />
            </Box>
          ) : tables.length === 0 ? (
            <Box textAlign="center" py={4} px={2}>
              <TableIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
              <Typography color="textSecondary">
                No tables found. Create your first table to get started.
              </Typography>
            </Box>
          ) : (
            <>
              <Box sx={{ maxHeight: 400, overflow: 'auto' }}>
                {tables.map((table) => (
                  <Box
                    key={table.id}
                    sx={{
                      p: 2,
                      borderBottom: 1,
                      borderColor: 'divider',
                      cursor: 'pointer',
                      bgcolor: selectedTable?.id === table.id ? 'action.selected' : 'transparent',
                      '&:hover': { bgcolor: 'action.hover' },
                    }}
                    onClick={() => handleSelectTable(table)}
                  >
                    <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                      <Box>
                        <Typography variant="subtitle2">{table.label}</Typography>
                        <Typography variant="caption" color="textSecondary">
                          {table.name}
                        </Typography>
                      </Box>
                      <Box>
                        <Chip
                          size="small"
                          label={table.isActive ? 'Active' : 'Inactive'}
                          color={table.isActive ? 'success' : 'default'}
                          sx={{ mr: 1 }}
                        />
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenTableDialog(table);
                          }}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteTable(table);
                          }}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Box>
                    </Box>
                    {table.description && (
                      <Typography variant="body2" color="textSecondary" sx={{ mt: 0.5 }} noWrap>
                        {table.description}
                      </Typography>
                    )}
                    <Box display="flex" gap={2} mt={1}>
                      <Typography variant="caption" color="textSecondary">
                        {table.fieldCount ?? 0} fields
                      </Typography>
                      <Typography variant="caption" color="textSecondary">
                        {table.recordCount ?? 0} records
                      </Typography>
                    </Box>
                  </Box>
                ))}
              </Box>
              <TablePagination
                component="div"
                count={total}
                page={page}
                onPageChange={(_, newPage) => setPage(newPage)}
                rowsPerPage={pageSize}
                onRowsPerPageChange={(e) => {
                  setPageSize(parseInt(e.target.value, 10));
                  setPage(0);
                }}
                rowsPerPageOptions={[5, 10, 25]}
              />
            </>
          )}
        </Paper>

        <Paper sx={{ flex: 1 }}>
          {selectedTable ? (
            <>
              <Box p={2} borderBottom={1} borderColor="divider">
                <Box display="flex" justifyContent="space-between" alignItems="center">
                  <Box>
                    <Typography variant="h6">{selectedTable.label}</Typography>
                    <Typography variant="body2" color="textSecondary">
                      {selectedTable.name}
                    </Typography>
                  </Box>
                  <Button
                    variant="outlined"
                    startIcon={<PreviewIcon />}
                    onClick={handlePreviewData}
                  >
                    View Data
                  </Button>
                </Box>
              </Box>

              <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)}>
                <Tab icon={<FieldsIcon />} label="Fields" iconPosition="start" />
                <Tab icon={<PreviewIcon />} label="Preview" iconPosition="start" />
              </Tabs>

              <TabPanel value={tabValue} index={0}>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                  <Typography variant="subtitle1">
                    Field Definitions ({fields.length})
                  </Typography>
                  <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={() => handleOpenFieldDialog()}
                  >
                    Add Field
                  </Button>
                </Box>

                {fieldsLoading ? (
                  <Box display="flex" justifyContent="center" py={4}>
                    <CircularProgress />
                  </Box>
                ) : fields.length === 0 ? (
                  <Box textAlign="center" py={4}>
                    <Typography color="textSecondary">
                      No fields defined. Add fields to define the table structure.
                    </Typography>
                  </Box>
                ) : (
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Order</TableCell>
                        <TableCell>Field Name</TableCell>
                        <TableCell>Label</TableCell>
                        <TableCell>Type</TableCell>
                        <TableCell>Required</TableCell>
                        <TableCell>Unique</TableCell>
                        <TableCell>Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {fields
                        .sort((a, b) => a.fieldOrder - b.fieldOrder)
                        .map((field) => (
                          <TableRow key={field.id}>
                            <TableCell>{field.fieldOrder}</TableCell>
                            <TableCell>
                              <Typography variant="body2" fontFamily="monospace">
                                {field.fieldName}
                              </Typography>
                            </TableCell>
                            <TableCell>{field.label}</TableCell>
                            <TableCell>
                              <Chip
                                size="small"
                                label={field.type}
                                variant="outlined"
                              />
                              {field.type === 'reference' && field.referenceTable && (
                                <Typography variant="caption" display="block" color="textSecondary">
                                  → {field.referenceTable}
                                </Typography>
                              )}
                              {field.type === 'choice' && field.choiceOptions && (
                                <Tooltip title={field.choiceOptions.map((o) => o.label).join(', ')}>
                                  <Typography variant="caption" display="block" color="textSecondary">
                                    {field.choiceOptions.length} options
                                  </Typography>
                                </Tooltip>
                              )}
                            </TableCell>
                            <TableCell>
                              <Chip
                                size="small"
                                label={field.isRequired ? 'Yes' : 'No'}
                                color={field.isRequired ? 'primary' : 'default'}
                              />
                            </TableCell>
                            <TableCell>
                              <Chip
                                size="small"
                                label={field.isUnique ? 'Yes' : 'No'}
                                color={field.isUnique ? 'warning' : 'default'}
                              />
                            </TableCell>
                            <TableCell>
                              <IconButton
                                size="small"
                                onClick={() => handleOpenFieldDialog(field)}
                              >
                                <EditIcon fontSize="small" />
                              </IconButton>
                              <IconButton
                                size="small"
                                onClick={() => handleDeleteField(field)}
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                )}
              </TabPanel>

              <TabPanel value={tabValue} index={1}>
                <Box textAlign="center" py={4}>
                  <Typography color="textSecondary" gutterBottom>
                    Preview the table data and form
                  </Typography>
                  <Button
                    variant="contained"
                    startIcon={<PreviewIcon />}
                    onClick={handlePreviewData}
                  >
                    Open Data View
                  </Button>
                </Box>
              </TabPanel>
            </>
          ) : (
            <Box
              display="flex"
              flexDirection="column"
              alignItems="center"
              justifyContent="center"
              py={8}
            >
              <TableIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
              <Typography variant="h6" color="textSecondary">
                Select a table to view details
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Or create a new table to get started
              </Typography>
            </Box>
          )}
        </Paper>
      </Box>

      <Dialog open={openTableDialog} onClose={() => setOpenTableDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingTable ? 'Edit Table' : 'Create New Table'}</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              fullWidth
              label="Table Name"
              value={tableFormData.name}
              onChange={(e) => setTableFormData({ ...tableFormData, name: e.target.value.toLowerCase() })}
              required
              disabled={!!editingTable}
              helperText={
                editingTable
                  ? 'Table name cannot be changed after creation'
                  : 'Must start with u_ and contain only lowercase letters, numbers, and underscores (e.g., u_vendor, u_asset)'
              }
              error={tableFormData.name !== '' && !isTableNameValid(tableFormData.name)}
            />
            <TextField
              fullWidth
              label="Display Label"
              value={tableFormData.label}
              onChange={(e) => setTableFormData({ ...tableFormData, label: e.target.value })}
              required
              helperText="Human-readable name for the table"
            />
            <TextField
              fullWidth
              label="Description"
              multiline
              rows={3}
              value={tableFormData.description}
              onChange={(e) => setTableFormData({ ...tableFormData, description: e.target.value })}
            />
            <FormControlLabel
              control={
                <Switch
                  checked={tableFormData.isActive}
                  onChange={(e) => setTableFormData({ ...tableFormData, isActive: e.target.checked })}
                />
              }
              label="Active"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenTableDialog(false)}>Cancel</Button>
          <Button
            onClick={handleSaveTable}
            variant="contained"
            disabled={
              !tableFormData.name ||
              !tableFormData.label ||
              (!editingTable && !isTableNameValid(tableFormData.name))
            }
          >
            {editingTable ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={openFieldDialog} onClose={() => setOpenFieldDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingField ? 'Edit Field' : 'Add New Field'}</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              fullWidth
              label="Field Name"
              value={fieldFormData.fieldName}
              onChange={(e) => setFieldFormData({ ...fieldFormData, fieldName: e.target.value.toLowerCase() })}
              required
              disabled={!!editingField}
              helperText={
                editingField
                  ? 'Field name cannot be changed after creation'
                  : 'Must start with a letter and contain only lowercase letters, numbers, and underscores'
              }
              error={fieldFormData.fieldName !== '' && !isFieldNameValid(fieldFormData.fieldName)}
            />
            <TextField
              fullWidth
              label="Display Label"
              value={fieldFormData.label}
              onChange={(e) => setFieldFormData({ ...fieldFormData, label: e.target.value })}
              required
            />
            <FormControl fullWidth>
              <InputLabel>Field Type</InputLabel>
              <Select
                value={fieldFormData.type}
                label="Field Type"
                onChange={(e) => setFieldFormData({ ...fieldFormData, type: e.target.value as CreateFieldDto['type'] })}
                disabled={!!editingField}
              >
                {FIELD_TYPES.map((type) => (
                  <MenuItem key={type.value} value={type.value}>
                    {type.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {fieldFormData.type === 'reference' && (
              <TextField
                fullWidth
                label="Reference Table"
                value={fieldFormData.referenceTable}
                onChange={(e) => setFieldFormData({ ...fieldFormData, referenceTable: e.target.value })}
                helperText="Table name to reference (e.g., users, u_vendor)"
              />
            )}

            {fieldFormData.type === 'choice' && (
              <TextField
                fullWidth
                label="Choice Options"
                multiline
                rows={4}
                value={choiceOptionsText}
                onChange={(e) => setChoiceOptionsText(e.target.value)}
                helperText="One option per line in format: value:label (e.g., active:Active)"
              />
            )}

            <TextField
              fullWidth
              label="Default Value"
              value={fieldFormData.defaultValue}
              onChange={(e) => setFieldFormData({ ...fieldFormData, defaultValue: e.target.value })}
            />

            <TextField
              fullWidth
              label="Display Order"
              type="number"
              value={fieldFormData.fieldOrder}
              onChange={(e) => setFieldFormData({ ...fieldFormData, fieldOrder: parseInt(e.target.value, 10) || 0 })}
            />

            <Box display="flex" gap={2}>
              <FormControlLabel
                control={
                  <Switch
                    checked={fieldFormData.isRequired}
                    onChange={(e) => setFieldFormData({ ...fieldFormData, isRequired: e.target.checked })}
                  />
                }
                label="Required"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={fieldFormData.isUnique}
                    onChange={(e) => setFieldFormData({ ...fieldFormData, isUnique: e.target.checked })}
                  />
                }
                label="Unique"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={fieldFormData.isActive}
                    onChange={(e) => setFieldFormData({ ...fieldFormData, isActive: e.target.checked })}
                  />
                }
                label="Active"
              />
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenFieldDialog(false)}>Cancel</Button>
          <Button
            onClick={handleSaveField}
            variant="contained"
            disabled={
              !fieldFormData.fieldName ||
              !fieldFormData.label ||
              (!editingField && !isFieldNameValid(fieldFormData.fieldName))
            }
          >
            {editingField ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AdminPlatformBuilder;
