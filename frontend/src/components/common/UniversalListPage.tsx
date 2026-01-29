import React, { ReactNode, useState, useCallback, useMemo } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TablePagination,
  Alert,
  SvgIconProps,
  Button,
  IconButton,
  Menu,
  MenuItem,
  Divider,
  Chip,
  Stack,
  TextField,
  InputAdornment,
  Tooltip,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import {
  Search as SearchIcon,
  FilterList as FilterListIcon,
  Refresh as RefreshIcon,
  ViewColumn as ViewColumnIcon,
  Save as SaveIcon,
  Star as StarIcon,
  StarBorder as StarBorderIcon,
  ExpandMore as ExpandMoreIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { LoadingState, ErrorState, EmptyState, ResponsiveTable } from './index';
import { FilterTree, FilterCondition } from '../../utils/listQueryUtils';

export interface ColumnDefinition<T> {
  key: string;
  header: string;
  render: (item: T) => ReactNode;
  width?: number | string;
  sortable?: boolean;
}

export interface SavedView {
  id: string;
  name: string;
  isDefault: boolean;
  columns?: string[];
  defaultSort?: string;
  defaultFilter?: string;
  defaultSearch?: string;
}

export interface FilterFieldConfig {
  field: string;
  label: string;
  type: 'string' | 'enum' | 'date' | 'number' | 'boolean';
  enumValues?: { value: string; label: string }[];
}

export interface UniversalListPageProps<T> {
  title: string;
  icon?: React.ReactElement<SvgIconProps>;
  items: T[];
  columns: ColumnDefinition<T>[];
  total: number;
  page: number;
  pageSize: number;
  isLoading: boolean;
  error: string | null;
  search: string;
  sort?: string;
  filterTree?: FilterTree | null;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  onSearchChange: (search: string) => void;
  onSortChange?: (sort: string) => void;
  onFilterChange?: (filter: FilterTree | null) => void;
  onRefresh: () => void;
  onClearError?: () => void;
  getRowKey: (item: T) => string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  emptyFilteredMessage?: string;
  headerActions?: ReactNode;
  banner?: ReactNode;
  minTableWidth?: number;
  rowsPerPageOptions?: number[];
  onRowClick?: (item: T) => void;
  filterFields?: FilterFieldConfig[];
  savedViews?: SavedView[];
  onSaveView?: (name: string, isDefault: boolean) => void;
  onLoadView?: (view: SavedView) => void;
  onSetDefaultView?: (viewId: string) => void;
  showFilterBuilder?: boolean;
  showSavedViews?: boolean;
}

function extractFilterConditions(tree: FilterTree | null): FilterCondition[] {
  if (!tree) return [];
  
  const conditions: FilterCondition[] = [];
  
  function traverse(node: FilterTree) {
    if ('field' in node && 'op' in node) {
      conditions.push(node as FilterCondition);
    } else if ('and' in node) {
      node.and.forEach(traverse);
    } else if ('or' in node) {
      node.or.forEach(traverse);
    }
  }
  
  traverse(tree);
  return conditions;
}

function formatFilterValue(condition: FilterCondition): string {
  const { op, value } = condition;
  
  if (op === 'is_empty' || op === 'is_not_empty') {
    return op === 'is_empty' ? 'is empty' : 'is not empty';
  }
  
  const opLabels: Record<string, string> = {
    is: 'is',
    is_not: 'is not',
    contains: 'contains',
    not_contains: 'does not contain',
    gt: '>',
    gte: '>=',
    lt: '<',
    lte: '<=',
    after: 'after',
    before: 'before',
  };
  
  const opLabel = opLabels[op] || op;
  return `${opLabel} "${value}"`;
}

export function UniversalListPage<T>({
  title,
  icon,
  items,
  columns,
  total,
  page,
  pageSize,
  isLoading,
  error,
  search,
  filterTree,
  onPageChange,
  onPageSizeChange,
  onSearchChange,
  onFilterChange,
  onRefresh,
  onClearError,
  getRowKey,
  searchPlaceholder = 'Search...',
  emptyMessage = 'No items found',
  emptyFilteredMessage = 'Try adjusting your filters or search query',
  headerActions,
  banner,
  minTableWidth = 800,
  rowsPerPageOptions = [5, 10, 25, 50],
  onRowClick,
  filterFields = [],
  savedViews = [],
  onSaveView,
  onLoadView,
  onSetDefaultView,
  showFilterBuilder = true,
  showSavedViews = true,
}: UniversalListPageProps<T>) {
  const [searchInput, setSearchInput] = useState(search);
  const [filterAnchorEl, setFilterAnchorEl] = useState<null | HTMLElement>(null);
  const [viewsAnchorEl, setViewsAnchorEl] = useState<null | HTMLElement>(null);
  const [searchDebounceTimer, setSearchDebounceTimer] = useState<NodeJS.Timeout | null>(null);

  const activeFilters = useMemo(() => extractFilterConditions(filterTree || null), [filterTree]);
  const hasFiltersOrSearch = activeFilters.length > 0 || search.length > 0;

  const handleSearchInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchInput(value);
    
    if (searchDebounceTimer) {
      clearTimeout(searchDebounceTimer);
    }
    
    const timer = setTimeout(() => {
      onSearchChange(value);
    }, 300);
    
    setSearchDebounceTimer(timer);
  }, [onSearchChange, searchDebounceTimer]);

  const handleClearSearch = useCallback(() => {
    setSearchInput('');
    onSearchChange('');
  }, [onSearchChange]);

  const handleChangePage = (_event: unknown, newPage: number) => {
    onPageChange(newPage + 1);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    onPageSizeChange(parseInt(event.target.value, 10));
  };

  const handleFilterClick = (event: React.MouseEvent<HTMLElement>) => {
    setFilterAnchorEl(event.currentTarget);
  };

  const handleFilterClose = () => {
    setFilterAnchorEl(null);
  };

  const handleViewsClick = (event: React.MouseEvent<HTMLElement>) => {
    setViewsAnchorEl(event.currentTarget);
  };

  const handleViewsClose = () => {
    setViewsAnchorEl(null);
  };

  const handleRemoveFilter = useCallback((index: number) => {
    if (!filterTree || !onFilterChange) return;
    
    const newConditions = activeFilters.filter((_, i) => i !== index);
    if (newConditions.length === 0) {
      onFilterChange(null);
    } else if (newConditions.length === 1) {
      onFilterChange(newConditions[0] as FilterTree);
    } else {
      onFilterChange({ and: newConditions as FilterTree[] });
    }
  }, [filterTree, activeFilters, onFilterChange]);

  const handleClearAllFilters = useCallback(() => {
    if (onFilterChange) {
      onFilterChange(null);
    }
    handleClearSearch();
  }, [onFilterChange, handleClearSearch]);

  const handleLoadView = useCallback((view: SavedView) => {
    if (onLoadView) {
      onLoadView(view);
    }
    handleViewsClose();
  }, [onLoadView]);

  const handleSetDefaultView = useCallback((viewId: string) => {
    if (onSetDefaultView) {
      onSetDefaultView(viewId);
    }
  }, [onSetDefaultView]);

  if (isLoading && items.length === 0) {
    return <LoadingState message={`Loading ${title.toLowerCase()}...`} />;
  }

  if (error && items.length === 0) {
    return (
      <ErrorState
        title={`Failed to load ${title.toLowerCase()}`}
        message={error}
        onRetry={onRefresh}
      />
    );
  }

  return (
    <Box sx={{ p: 3 }} data-testid="universal-list-page">
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {icon} {title}
        </Typography>
        {headerActions}
      </Box>

      {banner}

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={onClearError}>
          {error}
        </Alert>
      )}

      <Card sx={{ mb: 2 }}>
        <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
          <Stack direction="row" spacing={2} alignItems="center">
            <TextField
              size="small"
              placeholder={searchPlaceholder}
              value={searchInput}
              onChange={handleSearchInputChange}
              data-testid="universal-search-input"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon color="action" />
                  </InputAdornment>
                ),
                endAdornment: searchInput && (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={handleClearSearch}>
                      <CloseIcon fontSize="small" />
                    </IconButton>
                  </InputAdornment>
                ),
              }}
              sx={{ minWidth: 250 }}
            />

            {showFilterBuilder && filterFields.length > 0 && (
              <>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<FilterListIcon />}
                  onClick={handleFilterClick}
                  data-testid="open-filter-builder"
                >
                  Filter
                  {activeFilters.length > 0 && (
                    <Chip
                      size="small"
                      label={activeFilters.length}
                      sx={{ ml: 1, height: 20, minWidth: 20 }}
                    />
                  )}
                </Button>
                <Menu
                  anchorEl={filterAnchorEl}
                  open={Boolean(filterAnchorEl)}
                  onClose={handleFilterClose}
                  data-testid="filter-builder-panel"
                  PaperProps={{ sx: { minWidth: 300, p: 2 } }}
                >
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>
                    Filter by
                  </Typography>
                  {filterFields.map((field) => (
                    <MenuItem
                      key={field.field}
                      onClick={() => {
                        handleFilterClose();
                      }}
                    >
                      {field.label}
                    </MenuItem>
                  ))}
                  {activeFilters.length > 0 && (
                    <>
                      <Divider sx={{ my: 1 }} />
                      <MenuItem onClick={handleClearAllFilters}>
                        <ListItemText primary="Clear all filters" />
                      </MenuItem>
                    </>
                  )}
                </Menu>
              </>
            )}

            {showSavedViews && savedViews.length > 0 && (
              <>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<ViewColumnIcon />}
                  endIcon={<ExpandMoreIcon />}
                  onClick={handleViewsClick}
                  data-testid="saved-views-dropdown"
                >
                  Views
                </Button>
                <Menu
                  anchorEl={viewsAnchorEl}
                  open={Boolean(viewsAnchorEl)}
                  onClose={handleViewsClose}
                  PaperProps={{ sx: { minWidth: 200 } }}
                >
                  {savedViews.map((view) => (
                    <MenuItem
                      key={view.id}
                      onClick={() => handleLoadView(view)}
                    >
                      <ListItemIcon>
                        {view.isDefault ? (
                          <StarIcon fontSize="small" color="primary" />
                        ) : (
                          <IconButton
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSetDefaultView(view.id);
                            }}
                          >
                            <StarBorderIcon fontSize="small" />
                          </IconButton>
                        )}
                      </ListItemIcon>
                      <ListItemText primary={view.name} />
                    </MenuItem>
                  ))}
                  {onSaveView && (
                    <>
                      <Divider />
                      <MenuItem
                        onClick={() => {
                          handleViewsClose();
                          const name = prompt('Enter view name:');
                          if (name) {
                            onSaveView(name, false);
                          }
                        }}
                      >
                        <ListItemIcon>
                          <SaveIcon fontSize="small" />
                        </ListItemIcon>
                        <ListItemText primary="Save current view" />
                      </MenuItem>
                    </>
                  )}
                </Menu>
              </>
            )}

            <Box sx={{ flexGrow: 1 }} />

            <Tooltip title="Refresh">
              <IconButton onClick={onRefresh} disabled={isLoading}>
                <RefreshIcon />
              </IconButton>
            </Tooltip>
          </Stack>

          {activeFilters.length > 0 && (
            <Stack direction="row" spacing={1} sx={{ mt: 1.5 }} flexWrap="wrap" useFlexGap>
              {activeFilters.map((condition, index) => (
                <Chip
                  key={`${condition.field}-${index}`}
                  label={`${condition.field} ${formatFilterValue(condition)}`}
                  size="small"
                  onDelete={() => handleRemoveFilter(index)}
                  variant="outlined"
                />
              ))}
              <Chip
                label="Clear all"
                size="small"
                onClick={handleClearAllFilters}
                color="default"
                variant="outlined"
              />
            </Stack>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <ResponsiveTable minWidth={minTableWidth}>
            <Table>
              <TableHead>
                <TableRow>
                  {columns.map((column) => (
                    <TableCell key={column.key} style={{ width: column.width }}>
                      {column.header}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {items.length === 0 ? (
                  <TableRow data-testid="empty-state">
                    <TableCell colSpan={columns.length} align="center" sx={{ py: 0, border: 'none' }}>
                      <EmptyState
                        icon={icon ? React.cloneElement(icon, { sx: { fontSize: 64, color: 'text.disabled' } }) : undefined}
                        title={emptyMessage}
                        message={hasFiltersOrSearch ? emptyFilteredMessage : undefined}
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((item, index) => (
                    <TableRow
                      key={getRowKey(item)}
                      hover
                      onClick={() => onRowClick?.(item)}
                      sx={{ cursor: onRowClick ? 'pointer' : 'default' }}
                      data-testid={index === 0 ? 'list-row' : undefined}
                    >
                      {columns.map((column) => (
                        <TableCell key={column.key}>
                          {column.render(item)}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </ResponsiveTable>
          <TablePagination
            component="div"
            count={total}
            page={page - 1}
            onPageChange={handleChangePage}
            rowsPerPage={pageSize}
            onRowsPerPageChange={handleChangeRowsPerPage}
            rowsPerPageOptions={rowsPerPageOptions}
          />
        </CardContent>
      </Card>
    </Box>
  );
}

export default UniversalListPage;
