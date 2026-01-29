import React, { ReactNode } from 'react';
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
} from '@mui/material';
import { LoadingState, ErrorState, EmptyState, ResponsiveTable, TableToolbar, FilterOption } from './index';

export interface ColumnDefinition<T> {
  key: string;
  header: string;
  render: (item: T) => ReactNode;
  width?: number | string;
}

export interface GenericListPageProps<T> {
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
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  onSearchChange?: (search: string) => void;
  onRefresh: () => void;
  onClearError?: () => void;
  getRowKey: (item: T) => string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  emptyFilteredMessage?: string;
  filters?: FilterOption[];
  onFilterRemove?: (key: string) => void;
  onClearFilters?: () => void;
  toolbarActions?: ReactNode;
  headerActions?: ReactNode;
  banner?: ReactNode;
  minTableWidth?: number;
  rowsPerPageOptions?: number[];
  /** data-testid for e2e testing */
  testId?: string;
  /** Callback when a row is clicked (for navigation to detail page) */
  onRowClick?: (item: T) => void;
}

export function GenericListPage<T>({
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
  onPageChange,
  onPageSizeChange,
  onSearchChange,
  onRefresh,
  onClearError,
  getRowKey,
  searchPlaceholder = 'Search...',
  emptyMessage = 'No items found',
  emptyFilteredMessage = 'Try adjusting your filters or search query',
  filters = [],
  onFilterRemove,
  onClearFilters,
  toolbarActions,
  headerActions,
  banner,
  minTableWidth = 800,
  rowsPerPageOptions = [5, 10, 25, 50],
  testId,
  onRowClick,
}: GenericListPageProps<T>) {
  const hasFiltersOrSearch = filters.length > 0 || search.length > 0;

  const handleChangePage = (_event: unknown, newPage: number) => {
    onPageChange(newPage + 1);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    onPageSizeChange(parseInt(event.target.value, 10));
  };

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
      <Box sx={{ p: 3 }} data-testid={testId || 'universal-list-page'}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" sx={{ display: 'flex', alignItems: 'center', gap: 1 }} data-testid="list-header-title">
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

      <TableToolbar
        searchValue={search}
        onSearchChange={onSearchChange || (() => {})}
        searchPlaceholder={searchPlaceholder}
        filters={filters}
        onFilterRemove={onFilterRemove}
        onClearFilters={onClearFilters}
        onRefresh={onRefresh}
        loading={isLoading}
        actions={toolbarActions}
      />

      <Card>
        <CardContent>
          <ResponsiveTable minWidth={minTableWidth}>
            <Table data-testid="list-table">
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
                  <TableRow data-testid="list-empty">
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
                      data-testid="list-row"
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

export default GenericListPage;
