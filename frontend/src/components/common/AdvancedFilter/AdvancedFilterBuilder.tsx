/**
 * Advanced Filter Builder Component
 *
 * A reusable filter builder UI that allows users to create complex filter conditions
 * with AND/OR groups. Supports multiple field types and operators.
 */

import React, { useState, useCallback } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  IconButton,
  Typography,
  Paper,
  Chip,
  Stack,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  FilterList as FilterIcon,
} from '@mui/icons-material';
import {
  FilterCondition,
  FilterTree,
  FilterConfig,
  FieldDefinition,
  FilterOperator,
  OPERATORS_BY_TYPE,
  OPERATOR_LABELS,
  isEmptyOperator,
  createEmptyCondition,
} from './types';

interface FilterConditionRowProps {
  condition: FilterCondition;
  fields: FieldDefinition[];
  onChange: (condition: FilterCondition) => void;
  onRemove: () => void;
  canRemove: boolean;
}

const FilterConditionRow: React.FC<FilterConditionRowProps> = ({
  condition,
  fields,
  onChange,
  onRemove,
  canRemove,
}) => {
  const selectedField = fields.find((f) => f.name === condition.field);
  const fieldType = selectedField?.type || 'string';
  const availableOperators = OPERATORS_BY_TYPE[fieldType];

  const handleFieldChange = (fieldName: string) => {
    const newField = fields.find((f) => f.name === fieldName);
    const newType = newField?.type || 'string';
    const newOperators = OPERATORS_BY_TYPE[newType];
    const newOp = newOperators.includes(condition.op) ? condition.op : newOperators[0];

    onChange({
      ...condition,
      field: fieldName,
      op: newOp,
      value: isEmptyOperator(newOp) ? undefined : '',
    });
  };

  const handleOperatorChange = (op: FilterOperator) => {
    onChange({
      ...condition,
      op,
      value: isEmptyOperator(op) ? undefined : condition.value || '',
    });
  };

  const handleValueChange = (value: string) => {
    onChange({
      ...condition,
      value,
    });
  };

  const renderValueInput = () => {
    if (isEmptyOperator(condition.op)) {
      return null;
    }

    if (selectedField?.type === 'enum' && selectedField.enumValues) {
      return (
        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel>Value</InputLabel>
          <Select
            value={condition.value || ''}
            label="Value"
            onChange={(e) => handleValueChange(String(e.target.value))}
          >
            {selectedField.enumValues.map((enumValue) => (
              <MenuItem key={enumValue} value={enumValue}>
                {selectedField.enumLabels?.[enumValue] || enumValue}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      );
    }

    if (selectedField?.type === 'date') {
      return (
        <TextField
          type="date"
          size="small"
          value={condition.value || ''}
          onChange={(e) => handleValueChange(e.target.value)}
          sx={{ minWidth: 150 }}
          InputLabelProps={{ shrink: true }}
        />
      );
    }

    if (selectedField?.type === 'number') {
      return (
        <TextField
          type="number"
          size="small"
          placeholder="Value"
          value={condition.value || ''}
          onChange={(e) => handleValueChange(e.target.value)}
          sx={{ minWidth: 120 }}
        />
      );
    }

    if (selectedField?.type === 'boolean') {
      return (
        <FormControl size="small" sx={{ minWidth: 100 }}>
          <InputLabel>Value</InputLabel>
          <Select
            value={condition.value?.toString() || ''}
            label="Value"
            onChange={(e) => handleValueChange(String(e.target.value))}
          >
            <MenuItem value="true">Yes</MenuItem>
            <MenuItem value="false">No</MenuItem>
          </Select>
        </FormControl>
      );
    }

    return (
      <TextField
        size="small"
        placeholder="Value"
        value={condition.value || ''}
        onChange={(e) => handleValueChange(e.target.value)}
        sx={{ minWidth: 150, flexGrow: 1 }}
      />
    );
  };

  return (
    <Box display="flex" alignItems="center" gap={1} flexWrap="wrap">
      <FormControl size="small" sx={{ minWidth: 150 }}>
        <InputLabel>Field</InputLabel>
        <Select
          value={condition.field}
          label="Field"
          onChange={(e) => handleFieldChange(String(e.target.value))}
        >
          {fields.map((field) => (
            <MenuItem key={field.name} value={field.name}>
              {field.label}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <FormControl size="small" sx={{ minWidth: 150 }}>
        <InputLabel>Operator</InputLabel>
        <Select
          value={condition.op}
          label="Operator"
          onChange={(e) => handleOperatorChange(e.target.value as FilterOperator)}
        >
          {availableOperators.map((op) => (
            <MenuItem key={op} value={op}>
              {OPERATOR_LABELS[op]}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {renderValueInput()}

      {canRemove && (
        <IconButton size="small" onClick={onRemove} color="error">
          <DeleteIcon fontSize="small" />
        </IconButton>
      )}
    </Box>
  );
};

interface AdvancedFilterBuilderProps {
  config: FilterConfig;
  initialFilter?: FilterTree | null;
  onApply: (filter: FilterTree | null) => void;
  onClear: () => void;
  activeFilterCount?: number;
}

export const AdvancedFilterBuilder: React.FC<AdvancedFilterBuilderProps> = ({
  config,
  initialFilter,
  onApply,
  onClear,
  activeFilterCount = 0,
}) => {
  const [open, setOpen] = useState(false);
  const [conditions, setConditions] = useState<FilterCondition[]>(() => {
    if (initialFilter && 'and' in initialFilter) {
      return initialFilter.and.filter(
        (item): item is FilterCondition => 'field' in item && 'op' in item,
      );
    }
    if (initialFilter && 'field' in initialFilter) {
      return [initialFilter as FilterCondition];
    }
    return [];
  });

  const maxConditions = config.maxConditions || 30;

  const handleOpen = () => {
    if (initialFilter && 'and' in initialFilter) {
      setConditions(
        initialFilter.and.filter(
          (item): item is FilterCondition => 'field' in item && 'op' in item,
        ),
      );
    } else if (initialFilter && 'field' in initialFilter) {
      setConditions([initialFilter as FilterCondition]);
    } else {
      setConditions([]);
    }
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
  };

  const handleAddCondition = useCallback(() => {
    if (conditions.length < maxConditions) {
      setConditions((prev) => [...prev, createEmptyCondition(config.fields)]);
    }
  }, [conditions.length, maxConditions, config.fields]);

  const handleRemoveCondition = useCallback((index: number) => {
    setConditions((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleConditionChange = useCallback((index: number, condition: FilterCondition) => {
    setConditions((prev) => prev.map((c, i) => (i === index ? condition : c)));
  }, []);

  const handleApply = () => {
    if (conditions.length === 0) {
      onApply(null);
    } else if (conditions.length === 1) {
      onApply(conditions[0]);
    } else {
      onApply({ and: conditions });
    }
    setOpen(false);
  };

  const handleClear = () => {
    setConditions([]);
    onClear();
    setOpen(false);
  };

  const isValidFilter = conditions.every((c) => {
    if (isEmptyOperator(c.op)) {
      return c.field !== '';
    }
    return c.field !== '' && c.value !== undefined && c.value !== '';
  });

  return (
    <>
      <Button
        variant={activeFilterCount > 0 ? 'contained' : 'outlined'}
        size="small"
        startIcon={<FilterIcon />}
        onClick={handleOpen}
        color={activeFilterCount > 0 ? 'primary' : 'inherit'}
      >
        Filter
        {activeFilterCount > 0 && (
          <Chip
            label={activeFilterCount}
            size="small"
            color="default"
            sx={{ ml: 1, height: 20, minWidth: 20 }}
          />
        )}
      </Button>

      <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            <FilterIcon />
            <Typography variant="h6">Advanced Filter</Typography>
          </Box>
        </DialogTitle>

        <DialogContent dividers>
          {conditions.length === 0 ? (
            <Box textAlign="center" py={4}>
              <Typography color="text.secondary" gutterBottom>
                No filter conditions added
              </Typography>
              <Button
                variant="outlined"
                startIcon={<AddIcon />}
                onClick={handleAddCondition}
              >
                Add Condition
              </Button>
            </Box>
          ) : (
            <Stack spacing={2}>
              {conditions.map((condition, index) => (
                <Paper key={index} variant="outlined" sx={{ p: 2 }}>
                  {index > 0 && (
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ display: 'block', mb: 1 }}
                    >
                      AND
                    </Typography>
                  )}
                  <FilterConditionRow
                    condition={condition}
                    fields={config.fields}
                    onChange={(c) => handleConditionChange(index, c)}
                    onRemove={() => handleRemoveCondition(index)}
                    canRemove={conditions.length > 0}
                  />
                </Paper>
              ))}

              {conditions.length < maxConditions && (
                <Button
                  variant="text"
                  startIcon={<AddIcon />}
                  onClick={handleAddCondition}
                  sx={{ alignSelf: 'flex-start' }}
                >
                  Add Condition
                </Button>
              )}
            </Stack>
          )}

          {conditions.length >= maxConditions && (
            <Typography variant="caption" color="warning.main" sx={{ mt: 2, display: 'block' }}>
              Maximum number of conditions ({maxConditions}) reached
            </Typography>
          )}
        </DialogContent>

        <DialogActions>
          <Button onClick={handleClear} color="inherit">
            Clear All
          </Button>
          <Box flexGrow={1} />
          <Button onClick={handleClose}>Cancel</Button>
          <Button
            onClick={handleApply}
            variant="contained"
            disabled={conditions.length > 0 && !isValidFilter}
          >
            Apply Filter
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default AdvancedFilterBuilder;
