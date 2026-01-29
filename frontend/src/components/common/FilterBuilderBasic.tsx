/**
 * FilterBuilderBasic Component
 *
 * A simplified filter builder that supports creating single conditions
 * and AND/OR groups. This is a streamlined version of AdvancedFilterBuilder
 * designed for the unified list framework.
 *
 * Supported operators:
 * - contains: String contains value
 * - is (equals): Exact match
 * - is_empty: Field is empty/null
 * - is_not_empty: Field is not empty/null
 * - after: Date is after value
 * - before: Date is before value
 */

import React, { useState, useCallback, useMemo } from 'react';
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
  Stack,
  Chip,
  ToggleButton,
  ToggleButtonGroup,
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
  isFilterCondition,
  isFilterAndGroup,
} from './AdvancedFilter/types';

type GroupType = 'and' | 'or';

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
        <FormControl size="small" sx={{ minWidth: 150 }} data-testid="filter-rule-value">
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
          data-testid="filter-rule-value"
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
          data-testid="filter-rule-value"
        />
      );
    }

    if (selectedField?.type === 'boolean') {
      return (
        <FormControl size="small" sx={{ minWidth: 100 }} data-testid="filter-rule-value">
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
        data-testid="filter-rule-value"
      />
    );
  };

  return (
    <Box display="flex" alignItems="center" gap={1} flexWrap="wrap" data-testid="filter-rule">
      <FormControl size="small" sx={{ minWidth: 150 }} data-testid="filter-rule-field">
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

      <FormControl size="small" sx={{ minWidth: 150 }} data-testid="filter-rule-operator">
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
        <IconButton size="small" onClick={onRemove} color="error" data-testid="filter-rule-remove">
          <DeleteIcon fontSize="small" />
        </IconButton>
      )}
    </Box>
  );
};

export interface FilterBuilderBasicProps {
  config: FilterConfig;
  initialFilter?: FilterTree | null;
  onApply: (filter: FilterTree | null) => void;
  onClear: () => void;
  activeFilterCount?: number;
  buttonVariant?: 'text' | 'outlined' | 'contained';
  buttonSize?: 'small' | 'medium' | 'large';
}

export const FilterBuilderBasic: React.FC<FilterBuilderBasicProps> = ({
  config,
  initialFilter,
  onApply,
  onClear,
  activeFilterCount = 0,
  buttonVariant = 'outlined',
  buttonSize = 'small',
}) => {
  const [open, setOpen] = useState(false);
  const [groupType, setGroupType] = useState<GroupType>('and');
  const [conditions, setConditions] = useState<FilterCondition[]>(() => {
    if (initialFilter && isFilterAndGroup(initialFilter)) {
      return initialFilter.and.filter(
        (item): item is FilterCondition => isFilterCondition(item),
      );
    }
    if (initialFilter && 'or' in initialFilter) {
      return initialFilter.or.filter(
        (item): item is FilterCondition => isFilterCondition(item),
      );
    }
    if (initialFilter && isFilterCondition(initialFilter)) {
      return [initialFilter];
    }
    return [];
  });

  const maxConditions = config.maxConditions || 30;

  const handleOpen = () => {
    if (initialFilter && isFilterAndGroup(initialFilter)) {
      setGroupType('and');
      setConditions(
        initialFilter.and.filter(
          (item): item is FilterCondition => isFilterCondition(item),
        ),
      );
    } else if (initialFilter && 'or' in initialFilter) {
      setGroupType('or');
      setConditions(
        initialFilter.or.filter(
          (item): item is FilterCondition => isFilterCondition(item),
        ),
      );
    } else if (initialFilter && isFilterCondition(initialFilter)) {
      setGroupType('and');
      setConditions([initialFilter]);
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

  const handleGroupTypeChange = useCallback((_: React.MouseEvent<HTMLElement>, newType: GroupType | null) => {
    if (newType) {
      setGroupType(newType);
    }
  }, []);

  const handleApply = () => {
    if (conditions.length === 0) {
      onApply(null);
    } else if (conditions.length === 1) {
      onApply({ and: [conditions[0]] });
    } else {
      if (groupType === 'and') {
        onApply({ and: conditions });
      } else {
        onApply({ or: conditions });
      }
    }
    setOpen(false);
  };

  const handleClear = () => {
    setConditions([]);
    onClear();
    setOpen(false);
  };

  const isValidFilter = useMemo(() => {
    return conditions.every((c) => {
      if (isEmptyOperator(c.op)) {
        return c.field !== '';
      }
      return c.field !== '' && c.value !== undefined && c.value !== '';
    });
  }, [conditions]);

  return (
    <>
      <Button
        variant={activeFilterCount > 0 ? 'contained' : buttonVariant}
        size={buttonSize}
        startIcon={<FilterIcon />}
        onClick={handleOpen}
        color={activeFilterCount > 0 ? 'primary' : 'inherit'}
        data-testid="filter-open"
      >
        Filter
        {activeFilterCount > 0 && (
          <Chip
            label={activeFilterCount}
            size="small"
            color="default"
            sx={{ ml: 1, height: 20, minWidth: 20 }}
            data-testid="filter-chip"
          />
        )}
      </Button>

      <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth data-testid="filter-panel">
        <DialogTitle>
          <Box display="flex" alignItems="center" justifyContent="space-between">
            <Box display="flex" alignItems="center" gap={1}>
              <FilterIcon />
              <Typography variant="h6">Filter</Typography>
            </Box>
            {conditions.length > 1 && (
              <ToggleButtonGroup
                value={groupType}
                exclusive
                onChange={handleGroupTypeChange}
                size="small"
                data-testid="filter-add-group"
              >
                <ToggleButton value="and">
                  Match ALL
                </ToggleButton>
                <ToggleButton value="or">
                  Match ANY
                </ToggleButton>
              </ToggleButtonGroup>
            )}
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
                data-testid="filter-add-rule"
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
                      {groupType === 'and' ? 'AND' : 'OR'}
                    </Typography>
                  )}
                  <FilterConditionRow
                    condition={condition}
                    fields={config.fields}
                    onChange={(c) => handleConditionChange(index, c)}
                    onRemove={() => handleRemoveCondition(index)}
                    canRemove={true}
                  />
                </Paper>
              ))}

              {conditions.length < maxConditions && (
                <Button
                  variant="text"
                  startIcon={<AddIcon />}
                  onClick={handleAddCondition}
                  sx={{ alignSelf: 'flex-start' }}
                  data-testid="filter-add-rule"
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
          <Button onClick={handleClear} color="inherit" data-testid="filter-clear">
            Clear All
          </Button>
          <Box flexGrow={1} />
          <Button onClick={handleClose} data-testid="filter-close">Cancel</Button>
          <Button
            onClick={handleApply}
            variant="contained"
            disabled={conditions.length > 0 && !isValidFilter}
            data-testid="filter-apply"
          >
            Apply Filter
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default FilterBuilderBasic;
