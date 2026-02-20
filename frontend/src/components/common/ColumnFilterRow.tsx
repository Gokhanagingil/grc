import React, { useCallback } from 'react';
import {
  Box,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  IconButton,
  Tooltip,
  SelectChangeEvent,
} from '@mui/material';
import { Clear as ClearIcon } from '@mui/icons-material';
import { FieldSchema, ColumnFilter, SchemaDataType } from '../../services/grcClient';

interface ColumnFilterRowProps {
  fields: FieldSchema[];
  visibleColumns: string[];
  filters: Record<string, ColumnFilter>;
  onFilterChange: (fieldName: string, filter: ColumnFilter | null) => void;
}

const STRING_OPS = [
  { value: 'ilike', label: 'Contains' },
  { value: 'eq', label: 'Equals' },
  { value: 'startsWith', label: 'Starts with' },
  { value: 'endsWith', label: 'Ends with' },
];

const NUMBER_OPS = [
  { value: 'eq', label: '=' },
  { value: 'gte', label: '>=' },
  { value: 'lte', label: '<=' },
];

const DATE_OPS = [
  { value: 'gte', label: 'After' },
  { value: 'lte', label: 'Before' },
];

function getDefaultOp(dataType: SchemaDataType): string {
  switch (dataType) {
    case 'string':
      return 'ilike';
    case 'number':
      return 'eq';
    case 'date':
      return 'gte';
    case 'enum':
      return 'eq';
    case 'boolean':
      return 'eq';
    default:
      return 'eq';
  }
}

interface FilterInputProps {
  field: FieldSchema;
  filter: ColumnFilter | undefined;
  onFilterChange: (filter: ColumnFilter | null) => void;
}

function FilterInput({ field, filter, onFilterChange }: FilterInputProps) {
  const handleValueChange = useCallback(
    (value: string) => {
      if (!value) {
        onFilterChange(null);
        return;
      }
      onFilterChange({
        op: filter?.op || getDefaultOp(field.dataType),
        value,
      });
    },
    [field.dataType, filter?.op, onFilterChange],
  );

  const handleOpChange = useCallback(
    (op: string) => {
      if (!filter?.value) return;
      onFilterChange({
        ...filter,
        op,
      });
    },
    [filter, onFilterChange],
  );

  const handleClear = useCallback(() => {
    onFilterChange(null);
  }, [onFilterChange]);

  const currentValue = filter?.value !== undefined ? String(filter.value) : '';

  switch (field.dataType) {
    case 'enum':
      return (
        <FormControl size="small" fullWidth>
          <InputLabel>{field.label}</InputLabel>
          <Select
            value={currentValue}
            onChange={(e: SelectChangeEvent) => handleValueChange(e.target.value)}
            label={field.label}
            endAdornment={
              currentValue && (
                <IconButton size="small" onClick={handleClear} sx={{ mr: 2 }}>
                  <ClearIcon fontSize="small" />
                </IconButton>
              )
            }
          >
            <MenuItem value="">
              <em>All</em>
            </MenuItem>
            {field.enumValues?.map((val) => (
              <MenuItem key={val} value={val}>
                {val}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      );

    case 'boolean':
      return (
        <FormControl size="small" fullWidth>
          <InputLabel>{field.label}</InputLabel>
          <Select
            value={currentValue}
            onChange={(e: SelectChangeEvent) => handleValueChange(e.target.value)}
            label={field.label}
            endAdornment={
              currentValue && (
                <IconButton size="small" onClick={handleClear} sx={{ mr: 2 }}>
                  <ClearIcon fontSize="small" />
                </IconButton>
              )
            }
          >
            <MenuItem value="">
              <em>All</em>
            </MenuItem>
            <MenuItem value="true">Yes</MenuItem>
            <MenuItem value="false">No</MenuItem>
          </Select>
        </FormControl>
      );

    case 'date':
      return (
        <Box display="flex" gap={0.5} alignItems="center">
          <FormControl size="small" sx={{ minWidth: 80 }}>
            <Select
              value={filter?.op || 'gte'}
              onChange={(e: SelectChangeEvent) => handleOpChange(e.target.value)}
              size="small"
            >
              {DATE_OPS.map((op) => (
                <MenuItem key={op.value} value={op.value}>
                  {op.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            type="date"
            size="small"
            value={currentValue}
            onChange={(e) => handleValueChange(e.target.value)}
            InputLabelProps={{ shrink: true }}
            sx={{ flex: 1 }}
          />
          {currentValue && (
            <Tooltip title="Clear">
              <IconButton size="small" onClick={handleClear}>
                <ClearIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      );

    case 'number':
      return (
        <Box display="flex" gap={0.5} alignItems="center">
          <FormControl size="small" sx={{ minWidth: 60 }}>
            <Select
              value={filter?.op || 'eq'}
              onChange={(e: SelectChangeEvent) => handleOpChange(e.target.value)}
              size="small"
            >
              {NUMBER_OPS.map((op) => (
                <MenuItem key={op.value} value={op.value}>
                  {op.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            type="number"
            size="small"
            placeholder={field.label}
            value={currentValue}
            onChange={(e) => handleValueChange(e.target.value)}
            sx={{ flex: 1 }}
          />
          {currentValue && (
            <Tooltip title="Clear">
              <IconButton size="small" onClick={handleClear}>
                <ClearIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      );

    case 'string':
    default:
      return (
        <Box display="flex" gap={0.5} alignItems="center">
          <FormControl size="small" sx={{ minWidth: 100 }}>
            <Select
              value={filter?.op || 'ilike'}
              onChange={(e: SelectChangeEvent) => handleOpChange(e.target.value)}
              size="small"
            >
              {STRING_OPS.map((op) => (
                <MenuItem key={op.value} value={op.value}>
                  {op.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            size="small"
            placeholder={field.label}
            value={currentValue}
            onChange={(e) => handleValueChange(e.target.value)}
            sx={{ flex: 1 }}
          />
          {currentValue && (
            <Tooltip title="Clear">
              <IconButton size="small" onClick={handleClear}>
                <ClearIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      );
  }
}

export function ColumnFilterRow({
  fields,
  visibleColumns,
  filters,
  onFilterChange,
}: ColumnFilterRowProps) {
  const fieldMap = new Map(fields.map((f) => [f.name, f]));

  const visibleFilterableFields = visibleColumns
    .map((col) => fieldMap.get(col))
    .filter((f): f is FieldSchema => f !== undefined && f.filterable);

  if (visibleFilterableFields.length === 0) {
    return null;
  }

  return (
    <Box
      sx={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 1,
        p: 1,
        bgcolor: 'grey.50',
        borderRadius: 1,
        mb: 2,
      }}
    >
      {visibleFilterableFields.map((field) => (
        <Box key={field.name} sx={{ minWidth: 180, maxWidth: 280, flex: '1 1 200px' }}>
          <FilterInput
            field={field}
            filter={filters[field.name]}
            onFilterChange={(filter) => onFilterChange(field.name, filter)}
          />
        </Box>
      ))}
    </Box>
  );
}

export default ColumnFilterRow;
