import React, { useCallback, useMemo } from 'react';
import {
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
  Tooltip,
  InputAdornment,
  CircularProgress,
} from '@mui/material';
import {
  Sort as SortIcon,
  ArrowUpward as AscIcon,
  ArrowDownward as DescIcon,
} from '@mui/icons-material';
import { parseSort, buildSort, SortDirection } from '../../utils/listQueryUtils';
import { useListOptions } from '../../hooks/useListOptions';
import { SortableField } from '../../services/grcClient';

export interface SortDropdownProps {
  entity: string;
  sort: string;
  onSortChange: (sort: string) => void;
  sortOptions?: SortableField[];
  disabled?: boolean;
  size?: 'small' | 'medium';
}

export const SortDropdown: React.FC<SortDropdownProps> = ({
  entity,
  sort,
  onSortChange,
  sortOptions: propSortOptions,
  disabled = false,
  size = 'small',
}) => {
  const { sortableFields, isLoading } = useListOptions(entity);

  const effectiveSortOptions = useMemo(() => {
    if (propSortOptions && propSortOptions.length > 0) {
      return propSortOptions;
    }
    return sortableFields;
  }, [propSortOptions, sortableFields]);

  const parsedSort = parseSort(sort);
  const currentSortField = parsedSort?.field || '';
  const currentSortDirection = parsedSort?.direction || 'DESC';

  const handleSortFieldChange = useCallback((field: string) => {
    if (field) {
      const newSort = buildSort(field, currentSortDirection);
      onSortChange(newSort);
    }
  }, [onSortChange, currentSortDirection]);

  const handleSortDirectionToggle = useCallback(() => {
    if (currentSortField) {
      const newDirection: SortDirection = currentSortDirection === 'ASC' ? 'DESC' : 'ASC';
      const newSort = buildSort(currentSortField, newDirection);
      onSortChange(newSort);
    }
  }, [onSortChange, currentSortField, currentSortDirection]);

  if (effectiveSortOptions.length === 0 && !isLoading) {
    return null;
  }

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
      <FormControl size={size} sx={{ minWidth: 140 }} disabled={disabled || isLoading}>
        <InputLabel>Sort by</InputLabel>
        <Select
          value={currentSortField}
          label="Sort by"
          onChange={(e) => handleSortFieldChange(String(e.target.value))}
          startAdornment={
            <InputAdornment position="start">
              {isLoading ? (
                <CircularProgress size={16} />
              ) : (
                <SortIcon fontSize="small" color="action" />
              )}
            </InputAdornment>
          }
        >
          <MenuItem value="">
            <em>None</em>
          </MenuItem>
          {effectiveSortOptions.map((option) => (
            <MenuItem key={option.name} value={option.name}>
              {option.label}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      {currentSortField && (
        <Tooltip title={`Sort ${currentSortDirection === 'ASC' ? 'Descending' : 'Ascending'}`}>
          <IconButton
            size="small"
            onClick={handleSortDirectionToggle}
            disabled={disabled}
          >
            {currentSortDirection === 'ASC' ? (
              <AscIcon fontSize="small" />
            ) : (
              <DescIcon fontSize="small" />
            )}
          </IconButton>
        </Tooltip>
      )}
    </Box>
  );
};

export default SortDropdown;
