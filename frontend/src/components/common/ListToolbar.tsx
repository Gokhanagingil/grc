import React, { useState, useEffect, useRef, useCallback } from 'react';
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
