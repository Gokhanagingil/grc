import React from 'react';
import {
  Box,
  Button,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
  Paper,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';

export interface Condition {
  field: string;
  operator: string;
  value?: string | string[];
}

interface ConditionBuilderProps {
  conditions: Condition[];
  onChange: (conditions: Condition[]) => void;
  fields?: string[];
  operators?: { value: string; label: string }[];
}

const DEFAULT_OPERATORS = [
  { value: 'eq', label: '=' },
  { value: 'neq', label: '!=' },
  { value: 'in', label: 'in' },
  { value: 'not_in', label: 'not in' },
  { value: 'is_set', label: 'is set' },
  { value: 'is_empty', label: 'is empty' },
  { value: 'contains', label: 'contains' },
  { value: 'changed', label: 'changed' },
];

const DEFAULT_FIELDS = [
  'status', 'state', 'priority', 'impact', 'urgency', 'category',
  'type', 'risk', 'criticality', 'assignmentGroup', 'assignedTo',
  'approvalStatus', 'tier',
];

export const ConditionBuilder: React.FC<ConditionBuilderProps> = ({
  conditions,
  onChange,
  fields = DEFAULT_FIELDS,
  operators = DEFAULT_OPERATORS,
}) => {
  const handleAdd = () => {
    onChange([...conditions, { field: '', operator: 'eq', value: '' }]);
  };

  const handleRemove = (index: number) => {
    onChange(conditions.filter((_, i) => i !== index));
  };

  const handleChange = (index: number, key: keyof Condition, val: string) => {
    const updated = [...conditions];
    if (key === 'value') {
      const op = updated[index].operator;
      if (op === 'in' || op === 'not_in') {
        updated[index] = { ...updated[index], value: val.split(',').map(v => v.trim()) };
      } else {
        updated[index] = { ...updated[index], value: val };
      }
    } else {
      updated[index] = { ...updated[index], [key]: val };
    }
    onChange(updated);
  };

  const noValueOps = ['is_set', 'is_empty', 'changed'];

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Typography variant="subtitle2" gutterBottom>
        Conditions (AND)
      </Typography>
      {conditions.map((condition, index) => (
        <Box key={index} sx={{ display: 'flex', gap: 1, mb: 1, alignItems: 'center' }}>
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel>Field</InputLabel>
            <Select
              value={condition.field}
              label="Field"
              onChange={(e) => handleChange(index, 'field', e.target.value)}
            >
              {fields.map((f) => (
                <MenuItem key={f} value={f}>{f}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Operator</InputLabel>
            <Select
              value={condition.operator}
              label="Operator"
              onChange={(e) => handleChange(index, 'operator', e.target.value)}
            >
              {operators.map((op) => (
                <MenuItem key={op.value} value={op.value}>{op.label}</MenuItem>
              ))}
            </Select>
          </FormControl>
          {!noValueOps.includes(condition.operator) && (
            <TextField
              size="small"
              label="Value"
              value={Array.isArray(condition.value) ? condition.value.join(', ') : (condition.value || '')}
              onChange={(e) => handleChange(index, 'value', e.target.value)}
              sx={{ flex: 1 }}
              helperText={
                (condition.operator === 'in' || condition.operator === 'not_in')
                  ? 'Comma-separated values'
                  : undefined
              }
            />
          )}
          <IconButton size="small" onClick={() => handleRemove(index)} color="error">
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Box>
      ))}
      <Button startIcon={<AddIcon />} size="small" onClick={handleAdd}>
        Add Condition
      </Button>
    </Paper>
  );
};

export default ConditionBuilder;
