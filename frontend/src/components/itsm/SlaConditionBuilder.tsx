/**
 * SLA Condition Builder — Tree-based AND/OR condition editor
 *
 * Supports nested groups with arbitrary depth for SLA Engine 2.0.
 * Designed to be reusable for future rule engines (filters, automation, etc.).
 */
import React, { useCallback } from 'react';
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
  Chip,
  Tooltip,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import PlaylistAddIcon from '@mui/icons-material/PlaylistAdd';

// ── Types ──────────────────────────────────────────────────────────────

export interface ConditionLeaf {
  field: string;
  operator: string;
  value?: string | string[] | number | null;
}

export interface ConditionGroup {
  operator: 'AND' | 'OR';
  children: ConditionNode[];
}

export type ConditionNode = ConditionLeaf | ConditionGroup;

export function isConditionGroup(node: ConditionNode): node is ConditionGroup {
  return 'children' in node && ('operator' in node) && (node as ConditionGroup).operator !== undefined && !('field' in node);
}

// ── Field Registry Metadata ────────────────────────────────────────────

export interface FieldRegistryEntry {
  key: string;
  label: string;
  type: 'string' | 'enum' | 'uuid' | 'number' | 'boolean' | 'date' | 'datetime';
  operators: string[];
  options?: string[];
}

const OPERATOR_LABELS: Record<string, string> = {
  is: 'is',
  is_not: 'is not',
  in: 'in',
  not_in: 'not in',
  contains: 'contains',
  is_empty: 'is empty',
  is_not_empty: 'is not empty',
  gt: '>',
  gte: '>=',
  lt: '<',
  lte: '<=',
};

const UNARY_OPERATORS = ['is_empty', 'is_not_empty'];
const ARRAY_OPERATORS = ['in', 'not_in'];

// Default field registry (used when server registry hasn't loaded yet)
const DEFAULT_FIELDS: FieldRegistryEntry[] = [
  { key: 'priority', label: 'Priority', type: 'enum', operators: ['is', 'is_not', 'in', 'not_in', 'is_empty', 'is_not_empty'], options: ['P1', 'P2', 'P3', 'P4'] },
  { key: 'impact', label: 'Impact', type: 'enum', operators: ['is', 'is_not', 'in', 'not_in', 'is_empty', 'is_not_empty'], options: ['HIGH', 'MEDIUM', 'LOW'] },
  { key: 'urgency', label: 'Urgency', type: 'enum', operators: ['is', 'is_not', 'in', 'not_in', 'is_empty', 'is_not_empty'], options: ['HIGH', 'MEDIUM', 'LOW'] },
  { key: 'category', label: 'Category', type: 'enum', operators: ['is', 'is_not', 'in', 'not_in', 'is_empty', 'is_not_empty'], options: ['HARDWARE', 'SOFTWARE', 'NETWORK', 'DATABASE', 'SECURITY', 'ACCESS', 'OTHER'] },
  { key: 'subcategory', label: 'Subcategory', type: 'string', operators: ['is', 'is_not', 'in', 'not_in', 'contains', 'is_empty', 'is_not_empty'] },
  { key: 'serviceId', label: 'Service', type: 'uuid', operators: ['is', 'is_not', 'in', 'not_in', 'is_empty', 'is_not_empty'] },
  { key: 'offeringId', label: 'Offering', type: 'uuid', operators: ['is', 'is_not', 'in', 'not_in', 'is_empty', 'is_not_empty'] },
  { key: 'assignmentGroup', label: 'Assignment Group', type: 'string', operators: ['is', 'is_not', 'in', 'not_in', 'is_empty', 'is_not_empty'] },
  { key: 'source', label: 'Source / Channel', type: 'enum', operators: ['is', 'is_not', 'in', 'not_in', 'is_empty', 'is_not_empty'], options: ['EMAIL', 'PHONE', 'WEB', 'CHAT', 'API', 'MONITORING', 'SELF_SERVICE'] },
  { key: 'status', label: 'Status', type: 'enum', operators: ['is', 'is_not', 'in', 'not_in'], options: ['NEW', 'IN_PROGRESS', 'ON_HOLD', 'RESOLVED', 'CLOSED', 'CANCELLED'] },
  { key: 'assignedTo', label: 'Assigned To', type: 'uuid', operators: ['is', 'is_not', 'is_empty', 'is_not_empty'] },
  { key: 'relatedService', label: 'Related Service', type: 'uuid', operators: ['is', 'is_not', 'is_empty', 'is_not_empty'] },
  { key: 'customerCompanyId', label: 'Customer Company', type: 'uuid', operators: ['is', 'is_not', 'in', 'not_in', 'is_empty', 'is_not_empty'] },
];

// ── Typed Value Editor Strategy ─────────────────────────────────────────

/**
 * Renders the appropriate value input based on field metadata + operator.
 * Strategy:
 *  - enum/choice fields with options → Select dropdown (single or multi)
 *  - boolean → true/false Select
 *  - number → numeric TextField
 *  - uuid → text input with UUID hint
 *  - date → date input
 *  - string (no options) → text input
 *  - unary operators (is_empty/is_not_empty) → no value input (handled by caller)
 *  - array operators (in/not_in) → multi-select if options, comma-separated text otherwise
 */
function renderValueEditor(
  leaf: ConditionLeaf,
  fieldMeta: FieldRegistryEntry | undefined,
  isArray: boolean,
  onChange: (updated: ConditionLeaf) => void,
): React.ReactNode {
  const fieldType = fieldMeta?.type ?? 'string';
  const options = fieldMeta?.options;

  // Boolean fields → true/false toggle select
  if (fieldType === 'boolean') {
    return (
      <FormControl size="small" sx={{ flex: 1, minWidth: 120 }}>
        <InputLabel>Value</InputLabel>
        <Select
          value={String(leaf.value ?? '')}
          label="Value"
          onChange={(e) => onChange({ ...leaf, value: e.target.value })}
        >
          <MenuItem value="true">True</MenuItem>
          <MenuItem value="false">False</MenuItem>
        </Select>
      </FormControl>
    );
  }

  // Number fields → numeric input
  if (fieldType === 'number') {
    return (
      <TextField
        size="small"
        type="number"
        label="Value"
        value={leaf.value ?? ''}
        onChange={(e) => {
          const val = e.target.value;
          onChange({ ...leaf, value: val === '' ? null : Number(val) });
        }}
        sx={{ flex: 1, minWidth: 120 }}
        inputProps={{ step: 'any' }}
      />
    );
  }

  // Date fields → date input
  if (fieldType === 'date') {
    return (
      <TextField
        size="small"
        type="date"
        label="Value"
        value={String(leaf.value ?? '')}
        onChange={(e) => onChange({ ...leaf, value: e.target.value })}
        sx={{ flex: 1, minWidth: 160 }}
        InputLabelProps={{ shrink: true }}
      />
    );
  }

  // Datetime fields → datetime-local input
  if (fieldType === 'datetime') {
    return (
      <TextField
        size="small"
        type="datetime-local"
        label="Value"
        value={String(leaf.value ?? '')}
        onChange={(e) => onChange({ ...leaf, value: e.target.value })}
        sx={{ flex: 1, minWidth: 200 }}
        InputLabelProps={{ shrink: true }}
      />
    );
  }

  // Enum/choice fields with options → select dropdown
  if (options && options.length > 0) {
    if (isArray) {
      return (
        <FormControl size="small" sx={{ flex: 1, minWidth: 160 }}>
          <InputLabel>Values</InputLabel>
          <Select
            multiple
            value={Array.isArray(leaf.value) ? leaf.value : (leaf.value ? [String(leaf.value)] : [])}
            label="Values"
            onChange={(e) => onChange({ ...leaf, value: e.target.value as string[] })}
            renderValue={(selected) => (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {(selected as string[]).map((v) => (<Chip key={v} label={v} size="small" />))}
              </Box>
            )}
          >
            {options.map((opt) => (
              <MenuItem key={opt} value={opt}>{opt}</MenuItem>
            ))}
          </Select>
        </FormControl>
      );
    }
    return (
      <FormControl size="small" sx={{ flex: 1, minWidth: 160 }}>
        <InputLabel>Value</InputLabel>
        <Select
          value={String(leaf.value ?? '')}
          label="Value"
          onChange={(e) => onChange({ ...leaf, value: e.target.value })}
        >
          {options.map((opt) => (
            <MenuItem key={opt} value={opt}>{opt}</MenuItem>
          ))}
        </Select>
      </FormControl>
    );
  }

  // UUID fields → text with hint
  if (fieldType === 'uuid') {
    return (
      <TextField
        size="small"
        label={isArray ? 'UUIDs (comma-separated)' : 'UUID'}
        placeholder="e.g., 00000000-0000-..."
        value={Array.isArray(leaf.value) ? leaf.value.join(', ') : (leaf.value ?? '')}
        onChange={(e) => {
          const raw = e.target.value;
          if (isArray) {
            onChange({ ...leaf, value: raw.split(',').map((v) => v.trim()).filter(Boolean) });
          } else {
            onChange({ ...leaf, value: raw });
          }
        }}
        sx={{ flex: 1 }}
      />
    );
  }

  // Default string fallback → text input
  return (
    <TextField
      size="small"
      label={isArray ? 'Values (comma-separated)' : 'Value'}
      value={Array.isArray(leaf.value) ? leaf.value.join(', ') : (leaf.value ?? '')}
      onChange={(e) => {
        const raw = e.target.value;
        if (isArray) {
          onChange({ ...leaf, value: raw.split(',').map((v) => v.trim()).filter(Boolean) });
        } else {
          onChange({ ...leaf, value: raw });
        }
      }}
      sx={{ flex: 1 }}
    />
  );
}

// ── Sub-Components ─────────────────────────────────────────────────────

interface LeafEditorProps {
  leaf: ConditionLeaf;
  fields: FieldRegistryEntry[];
  onChange: (updated: ConditionLeaf) => void;
  onRemove: () => void;
}

const LeafEditor: React.FC<LeafEditorProps> = ({ leaf, fields, onChange, onRemove }) => {
  const fieldMeta = fields.find((f) => f.key === leaf.field);
  const allowedOps = fieldMeta?.operators ?? ['is', 'is_not', 'in', 'not_in', 'is_empty', 'is_not_empty'];
  const isUnary = UNARY_OPERATORS.includes(leaf.operator);
  const isArray = ARRAY_OPERATORS.includes(leaf.operator);

  return (
    <Box sx={{ display: 'flex', gap: 1, mb: 1, alignItems: 'center' }}>
      <FormControl size="small" sx={{ minWidth: 160 }} data-testid="sla-condition-field-wrap">
        <InputLabel>Field</InputLabel>
        <Select
          value={leaf.field || ''}
          label="Field"
          onChange={(e) => onChange({ ...leaf, field: e.target.value, operator: 'is', value: '' })}
        >
          {fields.map((f) => (
            <MenuItem key={f.key} value={f.key}>{f.label}</MenuItem>
          ))}
        </Select>
      </FormControl>

      <FormControl size="small" sx={{ minWidth: 120 }}>
        <InputLabel>Operator</InputLabel>
        <Select
          value={leaf.operator || 'is'}
          label="Operator"
          onChange={(e) => onChange({ ...leaf, operator: e.target.value })}
        >
          {allowedOps.map((op) => (
            <MenuItem key={op} value={op}>{OPERATOR_LABELS[op] ?? op}</MenuItem>
          ))}
        </Select>
      </FormControl>

      {!isUnary && renderValueEditor(leaf, fieldMeta, isArray, onChange)}

      <Tooltip title="Remove condition">
        <IconButton size="small" onClick={onRemove} color="error">
          <DeleteIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    </Box>
  );
};

// ── Group Editor ───────────────────────────────────────────────────────

interface GroupEditorProps {
  group: ConditionGroup;
  fields: FieldRegistryEntry[];
  onChange: (updated: ConditionGroup) => void;
  onRemove?: () => void;
  depth: number;
}

const GroupEditor: React.FC<GroupEditorProps> = ({ group, fields, onChange, onRemove, depth }) => {
  const handleChildChange = useCallback(
    (index: number, updated: ConditionNode) => {
      const newChildren = [...group.children];
      newChildren[index] = updated;
      onChange({ ...group, children: newChildren });
    },
    [group, onChange],
  );

  const handleChildRemove = useCallback(
    (index: number) => {
      onChange({ ...group, children: group.children.filter((_, i) => i !== index) });
    },
    [group, onChange],
  );

  const handleAddLeaf = useCallback(() => {
    onChange({
      ...group,
      children: [...group.children, { field: '', operator: 'is', value: '' }],
    });
  }, [group, onChange]);

  const handleAddGroup = useCallback(() => {
    onChange({
      ...group,
      children: [
        ...group.children,
        { operator: group.operator === 'AND' ? 'OR' : 'AND', children: [] },
      ],
    });
  }, [group, onChange]);

  const toggleOperator = useCallback(() => {
    onChange({ ...group, operator: group.operator === 'AND' ? 'OR' : 'AND' });
  }, [group, onChange]);

  const borderColors = ['primary.main', 'secondary.main', 'warning.main', 'success.main'];
  const borderColor = borderColors[depth % borderColors.length];

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 1.5,
        borderLeft: 3,
        borderColor,
        bgcolor: depth === 0 ? 'transparent' : 'action.hover',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <Chip
          label={group.operator}
          size="small"
          color={group.operator === 'AND' ? 'primary' : 'secondary'}
          onClick={toggleOperator}
          sx={{ cursor: 'pointer', fontWeight: 'bold' }}
        />
        <Typography variant="caption" color="text.secondary">
          {group.operator === 'AND' ? 'All conditions must match' : 'Any condition can match'}
        </Typography>
        <Box sx={{ flex: 1 }} />
        {onRemove && (
          <Tooltip title="Remove group">
            <IconButton size="small" onClick={onRemove} color="error">
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
      </Box>

      {group.children.map((child, index) => {
        if (isConditionGroup(child)) {
          return (
            <Box key={index} sx={{ ml: 1, mb: 1 }}>
              <GroupEditor
                group={child}
                fields={fields}
                onChange={(updated) => handleChildChange(index, updated)}
                onRemove={() => handleChildRemove(index)}
                depth={depth + 1}
              />
            </Box>
          );
        }
        return (
          <LeafEditor
            key={index}
            leaf={child}
            fields={fields}
            onChange={(updated) => handleChildChange(index, updated)}
            onRemove={() => handleChildRemove(index)}
          />
        );
      })}

      <Box sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
        <Button startIcon={<AddIcon />} size="small" onClick={handleAddLeaf}>
          Add Condition
        </Button>
        {depth < 3 && (
          <Button startIcon={<PlaylistAddIcon />} size="small" onClick={handleAddGroup} color="secondary">
            Add Group
          </Button>
        )}
      </Box>
    </Paper>
  );
};

// ── Main Component ─────────────────────────────────────────────────────

interface SlaConditionBuilderProps {
  value: ConditionNode | null;
  onChange: (tree: ConditionNode | null) => void;
  fields?: FieldRegistryEntry[];
}

export const SlaConditionBuilder: React.FC<SlaConditionBuilderProps> = ({
  value,
  onChange,
  fields = DEFAULT_FIELDS,
}) => {
  // Normalize: if value is a leaf, wrap in AND group
  const group: ConditionGroup = value
    ? isConditionGroup(value)
      ? value
      : { operator: 'AND', children: [value] }
    : { operator: 'AND', children: [] };

  const handleChange = (updated: ConditionGroup) => {
    // If empty, set to null
    if (updated.children.length === 0) {
      onChange(null);
    } else {
      onChange(updated);
    }
  };

  return (
    <Box>
      <Typography variant="subtitle2" gutterBottom>
        Matching Conditions
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
        Define when this SLA policy should apply. Leave empty to match all records.
      </Typography>
      <GroupEditor
        group={group}
        fields={fields}
        onChange={handleChange}
        depth={0}
      />
    </Box>
  );
};

export default SlaConditionBuilder;
