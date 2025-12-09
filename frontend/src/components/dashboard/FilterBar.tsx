import React from 'react';
import {
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Button,
  SelectChangeEvent,
} from '@mui/material';
import { FilterList as FilterIcon, Refresh as RefreshIcon } from '@mui/icons-material';

interface FilterOption {
  value: string;
  label: string;
}

interface FilterBarProps {
  dateFrom?: string;
  dateTo?: string;
  onDateFromChange?: (date: string) => void;
  onDateToChange?: (date: string) => void;
  filters?: Array<{
    name: string;
    label: string;
    value: string;
    options: FilterOption[];
    onChange: (value: string) => void;
  }>;
  onRefresh?: () => void;
  onReset?: () => void;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  dateFrom,
  dateTo,
  onDateFromChange,
  onDateToChange,
  filters = [],
  onRefresh,
  onReset,
}) => {
  const handleSelectChange = (onChange: (value: string) => void) => (
    event: SelectChangeEvent<string>
  ) => {
    onChange(event.target.value);
  };

  return (
    <Box
      sx={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 2,
        alignItems: 'center',
        mb: 3,
        p: 2,
        backgroundColor: 'background.paper',
        borderRadius: 1,
        boxShadow: 1,
      }}
    >
      <FilterIcon color="action" />
      
      {onDateFromChange && (
        <TextField
          label="From Date"
          type="date"
          value={dateFrom || ''}
          onChange={(e) => onDateFromChange(e.target.value)}
          InputLabelProps={{ shrink: true }}
          size="small"
          sx={{ minWidth: 150 }}
        />
      )}
      
      {onDateToChange && (
        <TextField
          label="To Date"
          type="date"
          value={dateTo || ''}
          onChange={(e) => onDateToChange(e.target.value)}
          InputLabelProps={{ shrink: true }}
          size="small"
          sx={{ minWidth: 150 }}
        />
      )}
      
      {filters.map((filter) => (
        <FormControl key={filter.name} size="small" sx={{ minWidth: 150 }}>
          <InputLabel>{filter.label}</InputLabel>
          <Select
            value={filter.value}
            label={filter.label}
            onChange={handleSelectChange(filter.onChange)}
          >
            <MenuItem value="">All</MenuItem>
            {filter.options.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      ))}
      
      <Box sx={{ flexGrow: 1 }} />
      
      {onReset && (
        <Button variant="outlined" size="small" onClick={onReset}>
          Reset
        </Button>
      )}
      
      {onRefresh && (
        <Button
          variant="contained"
          size="small"
          startIcon={<RefreshIcon />}
          onClick={onRefresh}
        >
          Refresh
        </Button>
      )}
    </Box>
  );
};
