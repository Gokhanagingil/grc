import React, { useState } from 'react';
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
}

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
}) => {
  const [columnMenuAnchor, setColumnMenuAnchor] = useState<null | HTMLElement>(null);

  const handleColumnMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setColumnMenuAnchor(event.currentTarget);
  };

  const handleColumnMenuClose = () => {
    setColumnMenuAnchor(null);
  };

  const hasActiveFilters = filters.length > 0;
  const hasColumnConfig = columns.length > 0 && onColumnToggle;

  return (
    <Box sx={{ mb: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
        {onSearchChange && (
          <TextField
            placeholder={searchPlaceholder}
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            size="small"
            sx={{ minWidth: 250, maxWidth: 350 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon color="action" />
                </InputAdornment>
              ),
              endAdornment: searchValue ? (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={() => onSearchChange('')}>
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
              {onClearFilters && filters.length > 1 && (
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
                    onClick={() => onColumnToggle(column.id)}
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
