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
import {
  Box,
  TextField,
  InputAdornment,
  IconButton,
  Chip,
  Button,
  Popover,
  Paper,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Tooltip,
  Divider,
  Typography,
  Grid,
} from '@mui/material';
import {
  Search as SearchIcon,
  FilterList as FilterIcon,
  Clear as ClearIcon,
  ArrowUpward as ArrowUpIcon,
  ArrowDownward as ArrowDownIcon,
  Sort as SortIcon,
} from '@mui/icons-material';

export interface FilterOption {
  key: string;
  label: string;
  value: string;
}

export interface SortOption {
  field: string;
  label: string;
}

export interface FilterField {
  key: string;
  label: string;
  type: 'select' | 'text';
  options?: Array<{ value: string; label: string }>;
  placeholder?: string;
}

export interface ListToolbarProps {
  // Search
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;

  // Filters
  filters?: FilterOption[];
  onFilterRemove?: (key: string) => void;
  onClearFilters?: () => void;
  filterFields?: FilterField[];
  onFilterChange?: (key: string, value: string) => void;

  // Sort
  sortField?: string;
  sortDirection?: 'ASC' | 'DESC';
  onSortChange?: (field: string, direction: 'ASC' | 'DESC') => void;
  sortOptions?: SortOption[];
  defaultSortField?: string;
  defaultSortDirection?: 'ASC' | 'DESC';

  // Actions
  actions?: React.ReactNode;
}

export const ListToolbar: React.FC<ListToolbarProps> = ({
  searchValue = '',
  onSearchChange,
  searchPlaceholder = 'Search...',
  filters = [],
  onFilterRemove,
  onClearFilters,
  filterFields = [],
  onFilterChange,
  sortField,
  sortDirection = 'DESC',
  onSortChange,
  sortOptions = [],
  defaultSortField,
  defaultSortDirection = 'DESC',
  actions,
}) => {
  const [filterAnchor, setFilterAnchor] = useState<null | HTMLElement>(null);
  const [localSearchValue, setLocalSearchValue] = useState(searchValue);
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize filter values from active filters
  useEffect(() => {
    const values: Record<string, string> = {};
    filters.forEach((filter) => {
      values[filter.key] = filter.value;
    });
    setFilterValues(values);
  }, [filters]);

  // Sync local search value with prop
  useEffect(() => {
    setLocalSearchValue(searchValue);
  }, [searchValue]);

  // Debounced search handler - 800ms debounce, minLength 2
  const handleSearchChange = useCallback((value: string) => {
    setLocalSearchValue(value);
    
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Only trigger search if value is empty or has at least 2 characters
    // This reduces API calls for single-character searches
    const shouldSearch = value === '' || value.length >= 2;

    debounceTimerRef.current = setTimeout(() => {
      if (onSearchChange && shouldSearch) {
        onSearchChange(value);
      }
    }, 800); // Increased debounce to 800ms to reduce rate limit pressure
  }, [onSearchChange]);

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  const handleFilterOpen = (event: React.MouseEvent<HTMLButtonElement>) => {
    setFilterAnchor(event.currentTarget);
  };

  const handleFilterClose = () => {
    setFilterAnchor(null);
  };

  const handleFilterFieldChange = (key: string, value: string) => {
    setFilterValues((prev) => ({ ...prev, [key]: value }));
    if (onFilterChange) {
      onFilterChange(key, value);
    }
  };

  const handleSortChange = (field: string) => {
    if (!onSortChange) return;
    
    // If clicking the same field, toggle direction
    if (field === sortField) {
      onSortChange(field, sortDirection === 'ASC' ? 'DESC' : 'ASC');
    } else {
      // New field - use default direction or DESC
      onSortChange(field, defaultSortDirection || 'DESC');
    }
  };

  const getCurrentSortOption = () => {
    const currentField = sortField || defaultSortField;
    if (!currentField) return null;
    return sortOptions.find((opt) => opt.field === currentField);
  };

  const currentSortOption = getCurrentSortOption();
  const hasActiveFilters = filters.length > 0;
  const filterOpen = Boolean(filterAnchor);

  // Determine if sort should be displayed (if non-default or has options)
  const shouldShowSort = sortOptions.length > 0 && (sortField !== defaultSortField || sortDirection !== defaultSortDirection);

  return (
    <Box sx={{ mb: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
        {/* Search Input - Always visible */}
        {onSearchChange && (
          <TextField
            placeholder={searchPlaceholder}
            value={localSearchValue}
            onChange={(e) => handleSearchChange(e.target.value)}
            size="small"
            sx={{ minWidth: 250, maxWidth: 350 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon color="action" />
                </InputAdornment>
              ),
              endAdornment: localSearchValue ? (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={() => handleSearchChange('')}>
                    <ClearIcon fontSize="small" />
                  </IconButton>
                </InputAdornment>
              ) : null,
            }}
          />
        )}

        {/* Filter Button */}
        {filterFields.length > 0 && (
          <>
            <Button
              variant={hasActiveFilters ? 'contained' : 'outlined'}
              startIcon={<FilterIcon />}
              onClick={handleFilterOpen}
              size="small"
              color={hasActiveFilters ? 'primary' : 'inherit'}
            >
              Filter
              {hasActiveFilters && ` (${filters.length})`}
            </Button>
            <Popover
              open={filterOpen}
              anchorEl={filterAnchor}
              onClose={handleFilterClose}
              anchorOrigin={{
                vertical: 'bottom',
                horizontal: 'left',
              }}
              transformOrigin={{
                vertical: 'top',
                horizontal: 'left',
              }}
            >
              <Paper sx={{ p: 2, minWidth: 300, maxWidth: 400 }}>
                <Typography variant="h6" gutterBottom>
                  Filters
                </Typography>
                <Divider sx={{ mb: 2 }} />
                <Grid container spacing={2}>
                  {filterFields.map((field) => (
                    <Grid item xs={12} key={field.key}>
                      {field.type === 'select' ? (
                        <FormControl fullWidth size="small">
                          <InputLabel>{field.label}</InputLabel>
                          <Select
                            value={filterValues[field.key] || ''}
                            label={field.label}
                            onChange={(e) => handleFilterFieldChange(field.key, e.target.value)}
                          >
                            <MenuItem value="">All</MenuItem>
                            {field.options?.map((option) => (
                              <MenuItem key={option.value} value={option.value}>
                                {option.label}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      ) : (
                        <TextField
                          fullWidth
                          size="small"
                          label={field.label}
                          placeholder={field.placeholder}
                          value={filterValues[field.key] || ''}
                          onChange={(e) => handleFilterFieldChange(field.key, e.target.value)}
                        />
                      )}
                    </Grid>
                  ))}
                </Grid>
                {hasActiveFilters && onClearFilters && (
                  <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
                    <Button size="small" onClick={() => { onClearFilters(); handleFilterClose(); }}>
                      Clear All
                    </Button>
                  </Box>
                )}
              </Paper>
            </Popover>
          </>
        )}

        {/* Sort Dropdown */}
        {sortOptions.length > 0 && (
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Sort by</InputLabel>
            <Select
              value={sortField || defaultSortField || ''}
              label="Sort by"
              onChange={(e) => handleSortChange(e.target.value)}
              renderValue={(value) => {
                const option = sortOptions.find((opt) => opt.field === value);
                return option ? option.label : value;
              }}
            >
              {sortOptions.map((option) => (
                <MenuItem key={option.field} value={option.field}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <SortIcon fontSize="small" />
                    {option.label}
                    {sortField === option.field && (
                      sortDirection === 'ASC' ? (
                        <ArrowUpIcon fontSize="small" sx={{ ml: 'auto' }} />
                      ) : (
                        <ArrowDownIcon fontSize="small" sx={{ ml: 'auto' }} />
                      )
                    )}
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}

        {/* Active Filter Chips */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexGrow: 1, flexWrap: 'wrap' }}>
          {hasActiveFilters && (
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
              {onClearFilters && (
                <Button
                  size="small"
                  onClick={onClearFilters}
                  startIcon={<ClearIcon />}
                  sx={{ ml: 1 }}
                >
                  Clear All
                </Button>
              )}
            </>
          )}
        </Box>

        {/* Actions */}
        {actions && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {actions}
          </Box>
        )}
      </Box>

      {hasActiveFilters && <Divider sx={{ mt: 2 }} />}
    </Box>
  );
};

export default ListToolbar;
