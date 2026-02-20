import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Box,
  TextField,
  InputAdornment,
  IconButton,
  Chip,
  Button,
  Menu,
  MenuItem,
  Checkbox,
  ListItemText,
  Tooltip,
  Divider,
} from '@mui/material';
import {
  Search as SearchIcon,
  Refresh as RefreshIcon,
  FilterList as FilterIcon,
  ViewColumn as ColumnIcon,
  Clear as ClearIcon,
} from '@mui/icons-material';

export interface FilterOption {
  key: string;
  label: string;
  value: string;
}

export interface ColumnConfig {
  id: string;
  label: string;
  visible: boolean;
}

export interface TableToolbarProps {
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  filters?: FilterOption[];
  onFilterRemove?: (key: string) => void;
  onClearFilters?: () => void;
  onRefresh?: () => void;
  columns?: ColumnConfig[];
  onColumnToggle?: (columnId: string) => void;
  loading?: boolean;
  actions?: React.ReactNode;
  columnStorageKey?: string; // Optional key for localStorage persistence
}

// Safe localStorage helpers
const safeGetStorage = (key: string): Record<string, boolean> | null => {
  try {
    const stored = localStorage.getItem(key);
    if (!stored) return null;
    const parsed = JSON.parse(stored);
    if (typeof parsed === 'object' && parsed !== null) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
};

const safeSetStorage = (key: string, value: Record<string, boolean>): void => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage errors (quota exceeded, etc.)
  }
};

export const TableToolbar: React.FC<TableToolbarProps> = ({
  searchValue = '',
  onSearchChange,
  searchPlaceholder = 'Search...',
  filters = [],
  onFilterRemove,
  onClearFilters,
  onRefresh,
  columns = [],
  onColumnToggle,
  loading = false,
  actions,
  columnStorageKey,
}) => {
  const [columnMenuAnchor, setColumnMenuAnchor] = useState<null | HTMLElement>(null);
  const [localSearchValue, setLocalSearchValue] = useState(searchValue);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const hasInitializedColumnsRef = useRef(false);

  // Initialize columns from localStorage if storage key is provided
  useEffect(() => {
    if (columnStorageKey && columns.length > 0 && onColumnToggle && !hasInitializedColumnsRef.current) {
      const stored = safeGetStorage(columnStorageKey);
      if (stored) {
        // Apply stored column visibility
        columns.forEach((col) => {
          if (col.id in stored && col.visible !== stored[col.id]) {
            onColumnToggle(col.id);
          }
        });
      }
      hasInitializedColumnsRef.current = true;
    }
  }, [columnStorageKey, columns, onColumnToggle]);

  // Save column visibility to localStorage when it changes
  useEffect(() => {
    if (columnStorageKey && columns.length > 0) {
      const columnState: Record<string, boolean> = {};
      columns.forEach((col) => {
        columnState[col.id] = col.visible;
      });
      safeSetStorage(columnStorageKey, columnState);
    }
  }, [columnStorageKey, columns]);

  // Sync local search value with prop
  useEffect(() => {
    setLocalSearchValue(searchValue);
  }, [searchValue]);

  // Debounced search handler
  const handleSearchChange = useCallback((value: string) => {
    setLocalSearchValue(value);
    
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      if (onSearchChange) {
        onSearchChange(value);
      }
    }, 300);
  }, [onSearchChange]);

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  const handleColumnMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setColumnMenuAnchor(event.currentTarget);
  };

  const handleColumnMenuClose = () => {
    setColumnMenuAnchor(null);
  };

  const handleColumnToggle = (columnId: string) => {
    if (onColumnToggle) {
      onColumnToggle(columnId);
    }
  };

  const hasActiveFilters = filters.length > 0;
  const hasColumnConfig = columns.length > 0 && onColumnToggle;

  return (
    <Box sx={{ mb: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
        {onSearchChange && (
          <TextField
            placeholder={searchPlaceholder}
            value={localSearchValue}
            onChange={(e) => handleSearchChange(e.target.value)}
            size="small"
            sx={{ minWidth: 250, maxWidth: 350 }}
            data-testid="list-search"
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

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexGrow: 1 }}>
          {hasActiveFilters && (
            <>
              <FilterIcon color="action" fontSize="small" />
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

          {hasColumnConfig && (
            <>
              <Tooltip title="Toggle columns">
                <IconButton onClick={handleColumnMenuOpen} size="small">
                  <ColumnIcon />
                </IconButton>
              </Tooltip>
              <Menu
                anchorEl={columnMenuAnchor}
                open={Boolean(columnMenuAnchor)}
                onClose={handleColumnMenuClose}
              >
                {columns.map((column) => (
                  <MenuItem
                    key={column.id}
                    onClick={() => handleColumnToggle(column.id)}
                    dense
                  >
                    <Checkbox
                      checked={column.visible}
                      size="small"
                      sx={{ p: 0, mr: 1 }}
                    />
                    <ListItemText primary={column.label} />
                  </MenuItem>
                ))}
              </Menu>
            </>
          )}

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

export default TableToolbar;
