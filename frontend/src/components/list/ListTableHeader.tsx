import React, { useCallback } from 'react';
import { TableCell, TableSortLabel, Tooltip } from '@mui/material';
import { parseSort, buildSort } from '../../utils/listQueryUtils';

export interface ListTableHeaderProps {
  field: string;
  label: string;
  sort: string;
  onSortChange: (sort: string) => void;
  sortable?: boolean;
  align?: 'left' | 'center' | 'right';
  width?: number | string;
  minWidth?: number | string;
}

export const ListTableHeader: React.FC<ListTableHeaderProps> = ({
  field,
  label,
  sort,
  onSortChange,
  sortable = true,
  align = 'left',
  width,
  minWidth,
}) => {
  const parsedSort = parseSort(sort);
  const isActive = parsedSort?.field === field;
  const currentDirection = parsedSort?.direction || 'DESC';

  const handleClick = useCallback(() => {
    if (!sortable) return;

    let newSort: string;
    if (!isActive) {
      newSort = buildSort(field, 'ASC');
    } else if (currentDirection === 'ASC') {
      newSort = buildSort(field, 'DESC');
    } else {
      newSort = '';
    }
    onSortChange(newSort);
  }, [sortable, isActive, currentDirection, field, onSortChange]);

  const getNextSortLabel = useCallback(() => {
    if (!isActive) {
      return 'Sort ascending';
    } else if (currentDirection === 'ASC') {
      return 'Sort descending';
    } else {
      return 'Clear sort';
    }
  }, [isActive, currentDirection]);

  const cellStyle: React.CSSProperties = {
    width: width,
    minWidth: minWidth,
  };

  if (!sortable) {
    return (
      <TableCell align={align} style={cellStyle}>
        {label}
      </TableCell>
    );
  }

  return (
    <TableCell align={align} style={cellStyle} sortDirection={isActive ? (currentDirection.toLowerCase() as 'asc' | 'desc') : false}>
      <Tooltip title={getNextSortLabel()} placement="top">
        <TableSortLabel
          active={isActive}
          direction={isActive ? (currentDirection.toLowerCase() as 'asc' | 'desc') : 'asc'}
          onClick={handleClick}
        >
          {label}
        </TableSortLabel>
      </Tooltip>
    </TableCell>
  );
};

export interface ColumnDefinition {
  field: string;
  label: string;
  sortable?: boolean;
  align?: 'left' | 'center' | 'right';
  width?: number | string;
  minWidth?: number | string;
}

export interface ListTableHeaderRowProps {
  columns: ColumnDefinition[];
  sort: string;
  onSortChange: (sort: string) => void;
}

export const ListTableHeaderRow: React.FC<ListTableHeaderRowProps> = ({
  columns,
  sort,
  onSortChange,
}) => {
  return (
    <>
      {columns.map((column) => (
        <ListTableHeader
          key={column.field}
          field={column.field}
          label={column.label}
          sort={sort}
          onSortChange={onSortChange}
          sortable={column.sortable}
          align={column.align}
          width={column.width}
          minWidth={column.minWidth}
        />
      ))}
    </>
  );
};

export default ListTableHeader;
