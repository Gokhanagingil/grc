import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  CircularProgress,
  Paper,
  TablePagination,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Switch,
  Chip,
  Breadcrumbs,
  Link,
  Collapse,
  Divider,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  ArrowBack as BackIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  Close as CloseIcon,
  SearchOutlined as SearchRefIcon,
} from '@mui/icons-material';
import {
  dynamicDataApi,
  DynamicRecordData,
  SysDictionaryData,
  CreateDynamicRecordDto,
  UpdateDynamicRecordDto,
} from '../services/grcClient';
import { useAuth } from '../contexts/AuthContext';

type FilterOperator = 'EQUALS' | 'NOT_EQUALS' | 'CONTAINS' | 'STARTS_WITH' | 'IN' | 'IS_EMPTY' | 'GT' | 'GTE' | 'LT' | 'LTE' | 'AFTER' | 'BEFORE';
type LogicalOperator = 'AND' | 'OR';

interface FilterCondition {
  id: string;
  field: string;
  operator: FilterOperator;
  value: string;
}

interface FilterGroup {
  logic: LogicalOperator;
  conditions: FilterCondition[];
}

const FILTER_OPERATORS: { value: FilterOperator; label: string; types?: string[] }[] = [
  { value: 'EQUALS', label: 'Equals' },
  { value: 'NOT_EQUALS', label: 'Not Equals' },
  { value: 'CONTAINS', label: 'Contains', types: ['string', 'text'] },
  { value: 'STARTS_WITH', label: 'Starts With', types: ['string', 'text'] },
  { value: 'IS_EMPTY', label: 'Is Empty' },
  { value: 'GT', label: 'Greater Than', types: ['integer', 'decimal'] },
  { value: 'GTE', label: 'Greater or Equal', types: ['integer', 'decimal'] },
  { value: 'LT', label: 'Less Than', types: ['integer', 'decimal'] },
  { value: 'LTE', label: 'Less or Equal', types: ['integer', 'decimal'] },
  { value: 'AFTER', label: 'After', types: ['date', 'datetime'] },
  { value: 'BEFORE', label: 'Before', types: ['date', 'datetime'] },
];

const getOperatorsForType = (fieldType: string): { value: FilterOperator; label: string }[] => {
  return FILTER_OPERATORS.filter((op) => !op.types || op.types.includes(fieldType));
};

let filterIdCounter = 0;
const nextFilterId = () => `f_${++filterIdCounter}`;

const DynamicDataList: React.FC = () => {
  const { tableName } = useParams<{ tableName: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const tenantId = user?.tenantId || '';

  const [records, setRecords] = useState<DynamicRecordData[]>([]);
  const [fields, setFields] = useState<SysDictionaryData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<string>('');
  const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>('DESC');

  const [openRecordDialog, setOpenRecordDialog] = useState(false);
  const [editingRecord, setEditingRecord] = useState<DynamicRecordData | null>(null);
  const [recordFormData, setRecordFormData] = useState<Record<string, unknown>>({});

  const [showFilters, setShowFilters] = useState(false);
  const [filterGroup, setFilterGroup] = useState<FilterGroup>({ logic: 'AND', conditions: [] });
  const [activeFilter, setActiveFilter] = useState<object | null>(null);

  const [refPickerOpen, setRefPickerOpen] = useState(false);
  const [refPickerField, setRefPickerField] = useState<SysDictionaryData | null>(null);
  const [refSearchQuery, setRefSearchQuery] = useState('');
  const [refSearchResults, setRefSearchResults] = useState<DynamicRecordData[]>([]);
  const [refSearchLoading, setRefSearchLoading] = useState(false);

  const buildFilterTree = useCallback((group: FilterGroup): object | null => {
    const validConditions = group.conditions.filter((c) => c.field && c.operator);
    if (validConditions.length === 0) return null;
    if (validConditions.length === 1) {
      const c = validConditions[0];
      return { field: c.field, operator: c.operator, value: c.operator === 'IS_EMPTY' ? '' : c.value };
    }
    return {
      [group.logic]: validConditions.map((c) => ({
        field: c.field,
        operator: c.operator,
        value: c.operator === 'IS_EMPTY' ? '' : c.value,
      })),
    };
  }, []);

  const fetchData = useCallback(async () => {
    if (!tenantId || !tableName) return;
    try {
      setLoading(true);
      const params: Record<string, unknown> = {
        page: page + 1,
        pageSize,
        search: search || undefined,
        sortBy: sortBy || undefined,
        sortOrder: sortBy ? sortOrder : undefined,
      };
      if (activeFilter) {
        params.filter = JSON.stringify(activeFilter);
      }
      const response = await dynamicDataApi.list(tenantId, tableName, params as Parameters<typeof dynamicDataApi.list>[2]);
      setRecords(response.records?.items || []);
      setTotal(response.records?.total || 0);
      setFields(response.fields || []);
    } catch (err: unknown) {
      const error = err as { response?: { status?: number; data?: { message?: string } } };
      if (error.response?.status === 404) {
        setError(`Table "${tableName}" not found or is not active`);
      } else {
        setError(error.response?.data?.message || 'Failed to fetch data');
      }
      setRecords([]);
      setFields([]);
    } finally {
      setLoading(false);
    }
  }, [tenantId, tableName, page, pageSize, search, sortBy, sortOrder, activeFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const getDisplayFields = () => {
    return fields
      .filter((f) => f.isActive)
      .sort((a, b) => a.fieldOrder - b.fieldOrder)
      .slice(0, 6);
  };

  const formatCellValue = (field: SysDictionaryData, value: unknown): React.ReactNode => {
    if (value === null || value === undefined) {
      return <Typography color="textSecondary">-</Typography>;
    }

    switch (field.type) {
      case 'boolean':
        return (
          <Chip
            size="small"
            label={value ? 'Yes' : 'No'}
            color={value ? 'success' : 'default'}
          />
        );
      case 'choice':
        const choiceOption = field.choiceOptions?.find((o) => o.value === value);
        return (
          <Chip
            size="small"
            label={choiceOption?.label || String(value)}
            variant="outlined"
          />
        );
      case 'date':
        return new Date(String(value)).toLocaleDateString();
      case 'datetime':
        return new Date(String(value)).toLocaleString();
      case 'decimal':
        return typeof value === 'number' ? value.toFixed(2) : String(value);
      case 'text':
        const textValue = String(value);
        return textValue.length > 50 ? `${textValue.substring(0, 50)}...` : textValue;
      default:
        return String(value);
    }
  };

  const handleOpenRecordDialog = (record?: DynamicRecordData) => {
    if (record) {
      setEditingRecord(record);
      setRecordFormData({ ...record.data });
    } else {
      setEditingRecord(null);
      const defaultData: Record<string, unknown> = {};
      fields.forEach((field) => {
        if (field.defaultValue !== null && field.defaultValue !== undefined) {
          defaultData[field.fieldName] = field.defaultValue;
        }
      });
      setRecordFormData(defaultData);
    }
    setOpenRecordDialog(true);
  };

  const handleSaveRecord = async () => {
    if (!tableName) return;
    try {
      if (editingRecord) {
        const updateData: UpdateDynamicRecordDto = { data: recordFormData };
        await dynamicDataApi.update(tenantId, tableName, editingRecord.recordId, updateData);
        setSuccess('Record updated successfully');
      } else {
        const createData: CreateDynamicRecordDto = { data: recordFormData };
        await dynamicDataApi.create(tenantId, tableName, createData);
        setSuccess('Record created successfully');
      }
      setOpenRecordDialog(false);
      fetchData();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      setError(error.response?.data?.message || 'Failed to save record');
    }
  };

  const handleDeleteRecord = async (record: DynamicRecordData) => {
    if (!window.confirm('Are you sure you want to delete this record?')) return;
    if (!tableName) return;
    try {
      await dynamicDataApi.delete(tenantId, tableName, record.recordId);
      setSuccess('Record deleted successfully');
      fetchData();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      setError(error.response?.data?.message || 'Failed to delete record');
    }
  };

  const handleFieldChange = (fieldName: string, value: unknown) => {
    setRecordFormData((prev) => ({ ...prev, [fieldName]: value }));
  };

  const handleAddFilterCondition = () => {
    const activeFields = fields.filter((f) => f.isActive);
    setFilterGroup((prev) => ({
      ...prev,
      conditions: [
        ...prev.conditions,
        { id: nextFilterId(), field: activeFields[0]?.fieldName || '', operator: 'EQUALS', value: '' },
      ],
    }));
  };

  const handleRemoveFilterCondition = (id: string) => {
    setFilterGroup((prev) => ({
      ...prev,
      conditions: prev.conditions.filter((c) => c.id !== id),
    }));
  };

  const handleUpdateFilterCondition = (id: string, updates: Partial<FilterCondition>) => {
    setFilterGroup((prev) => ({
      ...prev,
      conditions: prev.conditions.map((c) => (c.id === id ? { ...c, ...updates } : c)),
    }));
  };

  const handleApplyFilter = () => {
    const tree = buildFilterTree(filterGroup);
    setActiveFilter(tree);
    setPage(0);
  };

  const handleClearFilter = () => {
    setFilterGroup({ logic: 'AND', conditions: [] });
    setActiveFilter(null);
    setPage(0);
  };

  const handleOpenRefPicker = (field: SysDictionaryData) => {
    setRefPickerField(field);
    setRefSearchQuery('');
    setRefSearchResults([]);
    setRefPickerOpen(true);
  };

  const handleRefSearch = async () => {
    if (!refPickerField?.referenceTable || !tenantId) return;
    try {
      setRefSearchLoading(true);
      const response = await dynamicDataApi.list(tenantId, refPickerField.referenceTable, {
        page: 1,
        pageSize: 20,
        search: refSearchQuery || undefined,
      });
      setRefSearchResults(response.records?.items || []);
    } catch {
      setRefSearchResults([]);
    } finally {
      setRefSearchLoading(false);
    }
  };

  const handleSelectRef = (recordId: string) => {
    if (refPickerField) {
      handleFieldChange(refPickerField.fieldName, recordId);
    }
    setRefPickerOpen(false);
  };

  const renderFieldInput = (field: SysDictionaryData) => {
    const value = recordFormData[field.fieldName];
    const isReadOnly = field.readOnly && !!editingRecord;
    const maxLen = field.maxLength;

    switch (field.type) {
      case 'boolean':
        return (
          <FormControlLabel
            control={
              <Switch
                checked={Boolean(value)}
                onChange={(e) => handleFieldChange(field.fieldName, e.target.checked)}
                disabled={isReadOnly}
              />
            }
            label={field.label}
          />
        );
      case 'choice':
        return (
          <FormControl fullWidth>
            <InputLabel>{field.label}</InputLabel>
            <Select
              value={value || ''}
              label={field.label}
              onChange={(e) => handleFieldChange(field.fieldName, e.target.value)}
              required={field.isRequired}
              disabled={isReadOnly}
            >
              <MenuItem value="">
                <em>None</em>
              </MenuItem>
              {(field.choiceOptions || []).map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        );
      case 'text':
        return (
          <TextField
            fullWidth
            label={field.label}
            multiline
            rows={3}
            value={value || ''}
            onChange={(e) => handleFieldChange(field.fieldName, e.target.value)}
            required={field.isRequired}
            disabled={isReadOnly}
            inputProps={{ maxLength: maxLen || undefined }}
            helperText={maxLen ? `Max ${maxLen} characters` : undefined}
          />
        );
      case 'integer':
        return (
          <TextField
            fullWidth
            label={field.label}
            type="number"
            value={value ?? ''}
            onChange={(e) => handleFieldChange(field.fieldName, e.target.value ? parseInt(e.target.value, 10) : null)}
            required={field.isRequired}
            disabled={isReadOnly}
            inputProps={{ step: 1 }}
          />
        );
      case 'decimal':
        return (
          <TextField
            fullWidth
            label={field.label}
            type="number"
            value={value ?? ''}
            onChange={(e) => handleFieldChange(field.fieldName, e.target.value ? parseFloat(e.target.value) : null)}
            required={field.isRequired}
            disabled={isReadOnly}
            inputProps={{ step: 0.01 }}
          />
        );
      case 'date':
        return (
          <TextField
            fullWidth
            label={field.label}
            type="date"
            value={value || ''}
            onChange={(e) => handleFieldChange(field.fieldName, e.target.value)}
            required={field.isRequired}
            disabled={isReadOnly}
            InputLabelProps={{ shrink: true }}
          />
        );
      case 'datetime':
        return (
          <TextField
            fullWidth
            label={field.label}
            type="datetime-local"
            value={value || ''}
            onChange={(e) => handleFieldChange(field.fieldName, e.target.value)}
            required={field.isRequired}
            disabled={isReadOnly}
            InputLabelProps={{ shrink: true }}
          />
        );
      case 'reference':
        return (
          <Box display="flex" gap={1} alignItems="flex-start">
            <TextField
              fullWidth
              label={`${field.label} (ID)`}
              value={value || ''}
              onChange={(e) => handleFieldChange(field.fieldName, e.target.value)}
              required={field.isRequired}
              disabled={isReadOnly}
              helperText={field.referenceTable ? `Reference to ${field.referenceTable}` : undefined}
            />
            {field.referenceTable && !isReadOnly && (
              <IconButton
                onClick={() => handleOpenRefPicker(field)}
                title="Search reference"
                sx={{ mt: 1 }}
              >
                <SearchRefIcon />
              </IconButton>
            )}
          </Box>
        );
      default:
        return (
          <TextField
            fullWidth
            label={field.label}
            value={value || ''}
            onChange={(e) => handleFieldChange(field.fieldName, e.target.value)}
            required={field.isRequired}
            disabled={isReadOnly}
            inputProps={{ maxLength: maxLen || undefined }}
            helperText={maxLen ? `Max ${maxLen} characters` : undefined}
          />
        );
    }
  };

  const isFormValid = () => {
    for (const field of fields) {
      if (field.isRequired && field.isActive) {
        const value = recordFormData[field.fieldName];
        if (value === null || value === undefined || value === '') {
          return false;
        }
      }
    }
    return true;
  };

  const displayFields = getDisplayFields();
  const tableLabel = tableName?.replace(/^u_/, '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) || 'Data';

  return (
    <Box>
      <Box mb={2}>
        <Breadcrumbs>
          <Link
            component="button"
            variant="body2"
            onClick={() => navigate('/admin/platform-builder')}
            underline="hover"
          >
            Platform Builder
          </Link>
          <Typography color="text.primary">{tableLabel}</Typography>
        </Breadcrumbs>
      </Box>

      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box display="flex" alignItems="center" gap={2}>
          <IconButton onClick={() => navigate('/admin/platform-builder')}>
            <BackIcon />
          </IconButton>
          <Box>
            <Typography variant="h5">{tableLabel}</Typography>
            <Typography variant="body2" color="textSecondary">
              {tableName}
            </Typography>
          </Box>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpenRecordDialog()}
          disabled={fields.length === 0}
        >
          New Record
        </Button>
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

      <Paper sx={{ mb: 2, p: 2 }}>
        <Box display="flex" gap={2} alignItems="center" flexWrap="wrap">
          <TextField
            size="small"
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            InputProps={{
              startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />,
            }}
            sx={{ width: 300 }}
          />
          {displayFields.length > 0 && (
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>Sort By</InputLabel>
              <Select
                value={sortBy}
                label="Sort By"
                onChange={(e) => setSortBy(e.target.value)}
              >
                <MenuItem value="">
                  <em>None</em>
                </MenuItem>
                {displayFields.map((field) => (
                  <MenuItem key={field.fieldName} value={field.fieldName}>
                    {field.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
          {sortBy && (
            <FormControl size="small" sx={{ minWidth: 100 }}>
              <InputLabel>Order</InputLabel>
              <Select
                value={sortOrder}
                label="Order"
                onChange={(e) => setSortOrder(e.target.value as 'ASC' | 'DESC')}
              >
                <MenuItem value="ASC">Ascending</MenuItem>
                <MenuItem value="DESC">Descending</MenuItem>
              </Select>
            </FormControl>
          )}
          <Button
            size="small"
            variant={showFilters ? 'contained' : 'outlined'}
            startIcon={<FilterIcon />}
            onClick={() => setShowFilters(!showFilters)}
          >
            Filters{activeFilter ? ' (Active)' : ''}
          </Button>
          <IconButton onClick={fetchData} title="Refresh">
            <RefreshIcon />
          </IconButton>
        </Box>

        <Collapse in={showFilters}>
          <Divider sx={{ my: 2 }} />
          <Box>
            <Box display="flex" alignItems="center" gap={2} mb={2}>
              <Typography variant="subtitle2">Filter Logic:</Typography>
              <FormControl size="small" sx={{ minWidth: 100 }}>
                <Select
                  value={filterGroup.logic}
                  onChange={(e) => setFilterGroup((prev) => ({ ...prev, logic: e.target.value as LogicalOperator }))}
                >
                  <MenuItem value="AND">AND (all match)</MenuItem>
                  <MenuItem value="OR">OR (any match)</MenuItem>
                </Select>
              </FormControl>
              <Button size="small" startIcon={<AddIcon />} onClick={handleAddFilterCondition}>
                Add Condition
              </Button>
              <Button size="small" variant="contained" onClick={handleApplyFilter} disabled={filterGroup.conditions.length === 0}>
                Apply
              </Button>
              {activeFilter && (
                <Button size="small" color="warning" onClick={handleClearFilter}>
                  Clear
                </Button>
              )}
            </Box>
            {filterGroup.conditions.map((condition) => {
              const selectedField = fields.find((f) => f.fieldName === condition.field);
              const operators = selectedField ? getOperatorsForType(selectedField.type) : FILTER_OPERATORS;
              return (
                <Box key={condition.id} display="flex" gap={1} alignItems="center" mb={1}>
                  <FormControl size="small" sx={{ minWidth: 150 }}>
                    <InputLabel>Field</InputLabel>
                    <Select
                      value={condition.field}
                      label="Field"
                      onChange={(e) => handleUpdateFilterCondition(condition.id, { field: e.target.value })}
                    >
                      {fields.filter((f) => f.isActive).map((f) => (
                        <MenuItem key={f.fieldName} value={f.fieldName}>{f.label}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <FormControl size="small" sx={{ minWidth: 150 }}>
                    <InputLabel>Operator</InputLabel>
                    <Select
                      value={condition.operator}
                      label="Operator"
                      onChange={(e) => handleUpdateFilterCondition(condition.id, { operator: e.target.value as FilterOperator })}
                    >
                      {operators.map((op) => (
                        <MenuItem key={op.value} value={op.value}>{op.label}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  {condition.operator !== 'IS_EMPTY' && (
                    <TextField
                      size="small"
                      label="Value"
                      value={condition.value}
                      onChange={(e) => handleUpdateFilterCondition(condition.id, { value: e.target.value })}
                      sx={{ minWidth: 200 }}
                    />
                  )}
                  <IconButton size="small" onClick={() => handleRemoveFilterCondition(condition.id)}>
                    <CloseIcon fontSize="small" />
                  </IconButton>
                </Box>
              );
            })}
          </Box>
        </Collapse>
      </Paper>

      <Paper>
        {loading ? (
          <Box display="flex" justifyContent="center" py={4}>
            <CircularProgress />
          </Box>
        ) : records.length === 0 ? (
          <Box textAlign="center" py={4}>
            <Typography color="textSecondary">
              {fields.length === 0
                ? 'No fields defined for this table. Add fields in Platform Builder first.'
                : 'No records found. Create your first record to get started.'}
            </Typography>
          </Box>
        ) : (
          <>
            <Table size="small">
              <TableHead>
                <TableRow>
                  {displayFields.map((field) => (
                    <TableCell key={field.fieldName}>{field.label}</TableCell>
                  ))}
                  <TableCell>Created</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {records.map((record) => (
                  <TableRow key={record.id} hover>
                    {displayFields.map((field) => (
                      <TableCell key={field.fieldName}>
                        {formatCellValue(field, record.data[field.fieldName])}
                      </TableCell>
                    ))}
                    <TableCell>
                      <Typography variant="caption">
                        {new Date(record.createdAt).toLocaleDateString()}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <IconButton
                        size="small"
                        onClick={() => handleOpenRecordDialog(record)}
                        title="Edit"
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => handleDeleteRecord(record)}
                        title="Delete"
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
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
              rowsPerPageOptions={[5, 10, 25, 50]}
            />
          </>
        )}
      </Paper>

      <Dialog
        open={openRecordDialog}
        onClose={() => setOpenRecordDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {editingRecord ? 'Edit Record' : 'Create New Record'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
              {fields
                .filter((f) => f.isActive)
                .sort((a, b) => a.fieldOrder - b.fieldOrder)
                .map((field) => (
                <Box key={field.fieldName}>
                  {renderFieldInput(field)}
                </Box>
              ))}
            {fields.filter((f) => f.isActive).length === 0 && (
              <Typography color="textSecondary">
                No fields defined for this table.
              </Typography>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenRecordDialog(false)}>Cancel</Button>
          <Button
            onClick={handleSaveRecord}
            variant="contained"
            disabled={!isFormValid()}
          >
            {editingRecord ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={refPickerOpen} onClose={() => setRefPickerOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          Select Reference{refPickerField?.referenceTable ? ` (${refPickerField.referenceTable})` : ''}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 1, display: 'flex', gap: 1, mb: 2 }}>
            <TextField
              fullWidth
              size="small"
              placeholder="Search records..."
              value={refSearchQuery}
              onChange={(e) => setRefSearchQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleRefSearch(); }}
            />
            <Button variant="contained" onClick={handleRefSearch} disabled={refSearchLoading}>
              Search
            </Button>
          </Box>
          {refSearchLoading ? (
            <Box display="flex" justifyContent="center" py={4}>
              <CircularProgress />
            </Box>
          ) : refSearchResults.length === 0 ? (
            <Box textAlign="center" py={4}>
              <Typography color="textSecondary">
                {refSearchQuery ? 'No results found.' : 'Enter a search term and click Search.'}
              </Typography>
            </Box>
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Record ID</TableCell>
                  <TableCell>Data</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {refSearchResults.map((rec) => (
                  <TableRow key={rec.id} hover sx={{ cursor: 'pointer' }} onClick={() => handleSelectRef(rec.recordId)}>
                    <TableCell>
                      <Typography variant="body2" fontFamily="monospace">
                        {rec.recordId}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" noWrap sx={{ maxWidth: 400 }}>
                        {JSON.stringify(rec.data).substring(0, 100)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Button size="small" onClick={() => handleSelectRef(rec.recordId)}>
                        Select
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRefPickerOpen(false)}>Cancel</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default DynamicDataList;
