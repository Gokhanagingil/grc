/**
 * FilterBuilderBasic Component
 *
 * A filter builder that supports creating conditions and nested AND/OR groups.
 * This component allows users to build complex filter trees like:
 * (field contains A AND field contains B) OR field contains C
 *
 * Supported operators:
 * - contains: String contains value
 * - is (equals): Exact match
 * - is_empty: Field is empty/null
 * - is_not_empty: Field is not empty/null
 * - after: Date is after value
 * - before: Date is before value
 */

import React, { useState, useMemo } from 'react';
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
  FolderOpen as GroupIcon,
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
  isFilterOrGroup,
} from './AdvancedFilter/types';

type JoinType = 'and' | 'or';

/**
 * Internal representation of a filter node for the UI.
 * This allows us to track nodes with unique IDs for React keys.
 */
interface FilterNodeUI {
  id: string;
  type: 'rule' | 'group';
  join?: JoinType;
  condition?: FilterCondition;
  children?: FilterNodeUI[];
}

let nodeIdCounter = 0;
function generateNodeId(): string {
  return `node-${++nodeIdCounter}-${Date.now()}`;
}

/**
 * Convert a FilterTree to our internal UI representation
 */
function filterTreeToUI(tree: FilterTree | null): FilterNodeUI {
  if (!tree) {
    return {
      id: generateNodeId(),
      type: 'group',
      join: 'and',
      children: [],
    };
  }

  if (isFilterCondition(tree)) {
    return {
      id: generateNodeId(),
      type: 'rule',
      condition: tree,
    };
  }

  if (isFilterAndGroup(tree)) {
    return {
      id: generateNodeId(),
      type: 'group',
      join: 'and',
      children: tree.and.map(filterTreeToUI),
    };
  }

  if (isFilterOrGroup(tree)) {
    return {
      id: generateNodeId(),
      type: 'group',
      join: 'or',
      children: tree.or.map(filterTreeToUI),
    };
  }

  return {
    id: generateNodeId(),
    type: 'group',
    join: 'and',
    children: [],
  };
}

/**
 * Convert our internal UI representation back to a FilterTree
 */
function uiToFilterTree(node: FilterNodeUI): FilterTree | null {
  if (node.type === 'rule' && node.condition) {
    return node.condition;
  }

  if (node.type === 'group' && node.children) {
    const validChildren = node.children
      .map(uiToFilterTree)
      .filter((child): child is FilterTree => child !== null);

    if (validChildren.length === 0) {
      return null;
    }

    if (validChildren.length === 1) {
      // Wrap single condition in a group for consistency
      if (node.join === 'or') {
        return { or: validChildren };
      }
      return { and: validChildren };
    }

    if (node.join === 'or') {
      return { or: validChildren };
    }
    return { and: validChildren };
  }

  return null;
}

/**
 * Count total conditions in a UI node tree
 */
function countUIConditions(node: FilterNodeUI): number {
  if (node.type === 'rule') {
    return 1;
  }
  if (node.children) {
    return node.children.reduce((sum, child) => sum + countUIConditions(child), 0);
  }
  return 0;
}

/**
 * Validate that all rules in the tree have valid values
 */
function validateUITree(node: FilterNodeUI): boolean {
  if (node.type === 'rule' && node.condition) {
    if (isEmptyOperator(node.condition.op)) {
      return node.condition.field !== '';
    }
    return node.condition.field !== '' && node.condition.value !== undefined && node.condition.value !== '';
  }
  if (node.type === 'group' && node.children) {
    if (node.children.length === 0) {
      return true; // Empty group is valid (will be filtered out)
    }
    return node.children.every(validateUITree);
  }
  return true;
}

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

interface FilterGroupProps {
  node: FilterNodeUI;
  fields: FieldDefinition[];
  onChange: (node: FilterNodeUI) => void;
  onRemove: () => void;
  canRemove: boolean;
  depth: number;
  maxDepth: number;
  maxConditions: number;
  currentConditionCount: number;
}

const FilterGroup: React.FC<FilterGroupProps> = ({
  node,
  fields,
  onChange,
  onRemove,
  canRemove,
  depth,
  maxDepth,
  maxConditions,
  currentConditionCount,
}) => {
  const handleJoinChange = (_: React.MouseEvent<HTMLElement>, newJoin: JoinType | null) => {
    if (newJoin) {
      onChange({ ...node, join: newJoin });
    }
  };

  const handleAddRule = () => {
    if (currentConditionCount >= maxConditions) return;
    const newRule: FilterNodeUI = {
      id: generateNodeId(),
      type: 'rule',
      condition: createEmptyCondition(fields),
    };
    onChange({
      ...node,
      children: [...(node.children || []), newRule],
    });
  };

  const handleAddGroup = () => {
    if (depth >= maxDepth || currentConditionCount >= maxConditions) return;
    const newGroup: FilterNodeUI = {
      id: generateNodeId(),
      type: 'group',
      join: 'and',
      children: [],
    };
    onChange({
      ...node,
      children: [...(node.children || []), newGroup],
    });
  };

  const handleChildChange = (index: number, updatedChild: FilterNodeUI) => {
    const newChildren = [...(node.children || [])];
    newChildren[index] = updatedChild;
    onChange({ ...node, children: newChildren });
  };

  const handleChildRemove = (index: number) => {
    const newChildren = (node.children || []).filter((_, i) => i !== index);
    onChange({ ...node, children: newChildren });
  };

  const children = node.children || [];
  const isRoot = depth === 0;

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2,
        borderLeft: isRoot ? 'none' : '3px solid',
        borderLeftColor: isRoot ? 'transparent' : (node.join === 'or' ? 'warning.main' : 'primary.main'),
        backgroundColor: isRoot ? 'transparent' : 'action.hover',
      }}
      data-testid="filter-group"
    >
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={children.length > 0 ? 2 : 0}>
        <Box display="flex" alignItems="center" gap={1}>
          {!isRoot && <GroupIcon fontSize="small" color="action" />}
          {children.length > 1 && (
            <ToggleButtonGroup
              value={node.join}
              exclusive
              onChange={handleJoinChange}
              size="small"
              data-testid="filter-group-join"
            >
              <ToggleButton value="and" data-testid="filter-group-join-and">
                AND
              </ToggleButton>
              <ToggleButton value="or" data-testid="filter-group-join-or">
                OR
              </ToggleButton>
            </ToggleButtonGroup>
          )}
          {children.length <= 1 && !isRoot && (
            <Typography variant="caption" color="text.secondary">
              Group
            </Typography>
          )}
        </Box>
        <Box display="flex" gap={0.5}>
          <Button
            size="small"
            startIcon={<AddIcon />}
            onClick={handleAddRule}
            disabled={currentConditionCount >= maxConditions}
            data-testid="filter-group-add-rule"
          >
            Rule
          </Button>
          {depth < maxDepth && (
            <Button
              size="small"
              startIcon={<GroupIcon />}
              onClick={handleAddGroup}
              disabled={currentConditionCount >= maxConditions}
              data-testid="filter-group-add-group"
            >
              Group
            </Button>
          )}
          {canRemove && (
            <IconButton
              size="small"
              onClick={onRemove}
              color="error"
              data-testid="filter-group-remove"
            >
              <DeleteIcon fontSize="small" />
            </IconButton>
          )}
        </Box>
      </Box>

      {children.length === 0 ? (
        <Box textAlign="center" py={2}>
          <Typography color="text.secondary" variant="body2">
            {isRoot ? 'No filter conditions. Click "Rule" to add one.' : 'Empty group. Add rules or remove this group.'}
          </Typography>
        </Box>
      ) : (
        <Stack spacing={1.5}>
          {children.map((child, index) => (
            <Box key={child.id}>
              {index > 0 && (
                <Typography
                  variant="caption"
                  color={node.join === 'or' ? 'warning.main' : 'primary.main'}
                  sx={{ display: 'block', mb: 0.5, fontWeight: 'bold' }}
                >
                  {node.join === 'and' ? 'AND' : 'OR'}
                </Typography>
              )}
              {child.type === 'rule' && child.condition ? (
                <FilterConditionRow
                  condition={child.condition}
                  fields={fields}
                  onChange={(condition) => handleChildChange(index, { ...child, condition })}
                  onRemove={() => handleChildRemove(index)}
                  canRemove={true}
                />
              ) : (
                <FilterGroup
                  node={child}
                  fields={fields}
                  onChange={(updatedChild) => handleChildChange(index, updatedChild)}
                  onRemove={() => handleChildRemove(index)}
                  canRemove={true}
                  depth={depth + 1}
                  maxDepth={maxDepth}
                  maxConditions={maxConditions}
                  currentConditionCount={currentConditionCount}
                />
              )}
            </Box>
          ))}
        </Stack>
      )}
    </Paper>
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
  const [rootNode, setRootNode] = useState<FilterNodeUI>(() => {
    // Initialize with the initial filter or an empty root group
    if (initialFilter) {
      const uiTree = filterTreeToUI(initialFilter);
      // Ensure root is always a group
      if (uiTree.type === 'rule') {
        return {
          id: generateNodeId(),
          type: 'group',
          join: 'and',
          children: [uiTree],
        };
      }
      return uiTree;
    }
    return {
      id: generateNodeId(),
      type: 'group',
      join: 'and',
      children: [],
    };
  });

  const maxConditions = config.maxConditions || 30;
  const maxDepth = config.maxDepth || 3;

  const handleOpen = () => {
    // Reset to initial filter when opening
    if (initialFilter) {
      const uiTree = filterTreeToUI(initialFilter);
      if (uiTree.type === 'rule') {
        setRootNode({
          id: generateNodeId(),
          type: 'group',
          join: 'and',
          children: [uiTree],
        });
      } else {
        setRootNode(uiTree);
      }
    } else {
      setRootNode({
        id: generateNodeId(),
        type: 'group',
        join: 'and',
        children: [],
      });
    }
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
  };

  const handleApply = () => {
    const filterTree = uiToFilterTree(rootNode);
    onApply(filterTree);
    setOpen(false);
  };

  const handleClear = () => {
    setRootNode({
      id: generateNodeId(),
      type: 'group',
      join: 'and',
      children: [],
    });
    onClear();
    setOpen(false);
  };

  const currentConditionCount = useMemo(() => countUIConditions(rootNode), [rootNode]);
  const isValidFilter = useMemo(() => validateUITree(rootNode), [rootNode]);
  const hasConditions = currentConditionCount > 0;

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
          <Box display="flex" alignItems="center" gap={1}>
            <FilterIcon />
            <Typography variant="h6">Filter Builder</Typography>
            {currentConditionCount > 0 && (
              <Chip
                label={`${currentConditionCount} condition${currentConditionCount !== 1 ? 's' : ''}`}
                size="small"
                color="primary"
                variant="outlined"
              />
            )}
          </Box>
        </DialogTitle>

        <DialogContent dividers>
          <FilterGroup
            node={rootNode}
            fields={config.fields}
            onChange={setRootNode}
            onRemove={() => {}}
            canRemove={false}
            depth={0}
            maxDepth={maxDepth}
            maxConditions={maxConditions}
            currentConditionCount={currentConditionCount}
          />

          {currentConditionCount >= maxConditions && (
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
            disabled={hasConditions && !isValidFilter}
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
