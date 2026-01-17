/**
 * ListToolbar Component
 *
 * An enhanced toolbar for list pages that provides:
 * - Debounced search input
 * - Sort dropdown (field + direction) with allowlist-driven options
 * - Page size selector
 * - Filter button with active filter count
 * - Refresh button
 * - Custom actions slot
 *
 * This component integrates with the unified list framework and provides
 * a consistent UI for all list pages.
 *
 * Supports two modes for sort options:
 * 1. Static: Pass sortOptions prop directly
 * 2. Dynamic: Pass entity prop to fetch options from backend allowlist endpoint
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Box,
  TextField,
  InputAdornment,
  IconButton,
  Chip,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Tooltip,
  Divider,
  CircularProgress,
} from '@mui/material';
import {
  Search as SearchIcon,
  Refresh as RefreshIcon,
  Clear as ClearIcon,
  Sort as SortIcon,
  ArrowUpward as AscIcon,
  ArrowDownward as DescIcon,
} from '@mui/icons-material';
import { SortDirection, parseSort, buildSort } from '../../utils/listQueryUtils';
import { useListOptions } from '../../hooks/useListOptions';

export interface SortOption {
  field: string;
  label: string;
}

export interface FilterChip {
  key: string;
  label: string;
  value: string;
}

export interface ListToolbarProps {
  entity?: string;
  search?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  searchDebounceMs?: number;
  sort?: string;
  onSortChange?: (sort: string) => void;
  sortOptions?: SortOption[];
  pageSize?: number;
  onPageSizeChange?: (pageSize: number) => void;
  pageSizeOptions?: number[];
  filters?: FilterChip[];
  onFilterRemove?: (key: string) => void;
  onClearFilters?: () => void;
  activeFilterCount?: number;
  onRefresh?: () => void;
  loading?: boolean;
  actions?: React.ReactNode;
  filterButton?: React.ReactNode;
  showSort?: boolean;
  showPageSize?: boolean;
}

export const ListToolbar: React.FC<ListToolbarProps> = ({
  entity,
  search = '',
  onSearchChange,
  searchPlaceholder = 'Search...',
  searchDebounceMs = 300,
  sort = '',
  onSortChange,
  sortOptions: propSortOptions = [],
  pageSize = 10,
  onPageSizeChange,
  pageSizeOptions = [5, 10, 25, 50],
  filters = [],
  onFilterRemove,
  onClearFilters,
  activeFilterCount = 0,
  onRefresh,
  loading = false,
  actions,
  filterButton,
  showSort = true,
  showPageSize = true,
}) => {
  const { sortableFields, isLoading: sortOptionsLoading } = useListOptions(entity || '');

  const sortOptions = React.useMemo(() => {
    if (propSortOptions.length > 0) {
      return propSortOptions;
    }
    if (entity && sortableFields.length > 0) {
      return sortableFields.map(f => ({ field: f.name, label: f.label }));
    }
    return [];
  }, [propSortOptions, entity, sortableFields]);
  const [localSearch, setLocalSearch] = useState(search);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setLocalSearch(search);
  }, [search]);

  const handleSearchChange = useCallback((value: string) => {
    setLocalSearch(value);
    
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      if (onSearchChange) {
        onSearchChange(value);
      }
    }, searchDebounceMs);
  }, [onSearchChange, searchDebounceMs]);

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  const parsedSort = parseSort(sort);
  const currentSortField = parsedSort?.field || '';
  const currentSortDirection = parsedSort?.direction || 'DESC';

  const handleSortFieldChange = useCallback((field: string) => {
    if (onSortChange && field) {
      const newSort = buildSort(field, currentSortDirection);
      onSortChange(newSort);
    }
  }, [onSortChange, currentSortDirection]);

  const handleSortDirectionToggle = useCallback(() => {
    if (onSortChange && currentSortField) {
      const newDirection: SortDirection = currentSortDirection === 'ASC' ? 'DESC' : 'ASC';
      const newSort = buildSort(currentSortField, newDirection);
      onSortChange(newSort);
    }
  }, [onSortChange, currentSortField, currentSortDirection]);

  const handlePageSizeChange = useCallback((newPageSize: number) => {
    if (onPageSizeChange) {
      onPageSizeChange(newPageSize);
    }
  }, [onPageSizeChange]);

  const hasActiveFilters = filters.length > 0 || activeFilterCount > 0;

  return (
    <Box sx={{ mb: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
        {onSearchChange && (
          <TextField
            placeholder={searchPlaceholder}
            value={localSearch}
            onChange={(e) => handleSearchChange(e.target.value)}
            size="small"
            sx={{ minWidth: 250, maxWidth: 350 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon color="action" />
                </InputAdornment>
              ),
              endAdornment: localSearch ? (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={() => handleSearchChange('')}>
                    <ClearIcon fontSize="small" />
                  </IconButton>
                </InputAdornment>
              ) : null,
            }}
          />
        )}

        {filterButton}

        {showSort && (sortOptions.length > 0 || sortOptionsLoading) && onSortChange && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <FormControl size="small" sx={{ minWidth: 140 }} disabled={sortOptionsLoading}>
              <InputLabel>Sort by</InputLabel>
              <Select
                value={currentSortField}
                label="Sort by"
                onChange={(e) => handleSortFieldChange(String(e.target.value))}
                startAdornment={
                  <InputAdornment position="start">
                    {sortOptionsLoading ? (
                      <CircularProgress size={16} />
                    ) : (
                      <SortIcon fontSize="small" color="action" />
                    )}
                  </InputAdornment>
                }
              >
                {sortOptions.map((option) => (
                  <MenuItem key={option.field} value={option.field}>
                    {option.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            {currentSortField && (
              <Tooltip title={`Sort ${currentSortDirection === 'ASC' ? 'Descending' : 'Ascending'}`}>
                <IconButton size="small" onClick={handleSortDirectionToggle} disabled={sortOptionsLoading}>
                  {currentSortDirection === 'ASC' ? <AscIcon fontSize="small" /> : <DescIcon fontSize="small" />}
                </IconButton>
              </Tooltip>
            )}
          </Box>
        )}

        {showPageSize && onPageSizeChange && (
          <FormControl size="small" sx={{ minWidth: 100 }}>
            <InputLabel>Show</InputLabel>
            <Select
              value={pageSize}
              label="Show"
              onChange={(e) => handlePageSizeChange(Number(e.target.value))}
            >
              {pageSizeOptions.map((size) => (
                <MenuItem key={size} value={size}>
                  {size}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexGrow: 1 }}>
          {filters.length > 0 && (
            <>
              {filters.map((filter) => (
                <Chip
                  key={filter.key}
                  label={`${filter.label}: ${filter.value}`}
                  size="small"
                  onDelete={onFilterRemove ? () => onFilterRemove(filter.key) : undefined}
                  color="primary"
                  variant="outlined"
                />
              ))}
              {onClearFilters && filters.length > 0 && (
                <Button
                  size="small"
                  onClick={onClearFilters}
                  startIcon={<ClearIcon />}
                  sx={{ ml: 1 }}
                >
                  Clear{filters.length > 1 ? ' All' : ''}
                </Button>
              )}
            </>
          )}
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {actions}

          {onRefresh && (
            <Tooltip title="Refresh">
              <IconButton onClick={onRefresh} disabled={loading} size="small">
                <RefreshIcon />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      </Box>

      {hasActiveFilters && <Divider sx={{ mt: 2 }} />}
    </Box>
  );
};

export default ListToolbar;
