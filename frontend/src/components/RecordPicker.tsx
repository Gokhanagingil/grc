import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Autocomplete,
  TextField,
  CircularProgress,
  Box,
  Typography,
  Chip,
} from '@mui/material';
import { useAuth } from '../contexts/AuthContext';
import { searchApi } from '../services/grcClient';

export type RecordPickerEntityType = 'policy' | 'risk' | 'issue' | 'audit';

export interface RecordPickerOption {
  id: string;
  code: string | null;
  title: string;
  status?: string;
}

export interface RecordPickerProps {
  entityType: RecordPickerEntityType;
  value: string | null;
  onChange: (id: string | null, record: RecordPickerOption | null) => void;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  error?: boolean;
  helperText?: string;
  required?: boolean;
}

interface SearchResponse {
  data?: {
    success?: boolean;
    data?: {
      items?: Array<{
        id: string;
        code?: string | null;
        title?: string;
        name?: string;
        status?: string;
      }>;
    };
    items?: Array<{
      id: string;
      code?: string | null;
      title?: string;
      name?: string;
      status?: string;
    }>;
  };
}

const DEBOUNCE_MS = 400;

export const RecordPicker: React.FC<RecordPickerProps> = ({
  entityType,
  value,
  onChange,
  label,
  placeholder,
  disabled = false,
  error = false,
  helperText,
  required = false,
}) => {
  const { user } = useAuth();
  const [inputValue, setInputValue] = useState('');
  const [options, setOptions] = useState<RecordPickerOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedOption, setSelectedOption] = useState<RecordPickerOption | null>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const tenantId = user?.tenantId || '';

  const getEntityLabel = () => {
    switch (entityType) {
      case 'policy':
        return 'Policy';
      case 'risk':
        return 'Risk';
      case 'issue':
        return 'Issue/Finding';
      case 'audit':
        return 'Audit';
      default:
        return 'Record';
    }
  };

  const searchRecords = useCallback(
    async (query: string) => {
      if (!tenantId) return;

      setLoading(true);
      try {
        let response: SearchResponse;
        const searchQuery = { query, pageSize: 20 };

        switch (entityType) {
          case 'policy':
            response = await searchApi.searchPolicies(tenantId, searchQuery);
            break;
          case 'risk':
            response = await searchApi.searchRisks(tenantId, searchQuery);
            break;
          case 'issue':
            response = await searchApi.searchIssues(tenantId, searchQuery);
            break;
          case 'audit':
            response = await searchApi.searchAudits(tenantId, searchQuery);
            break;
          default:
            return;
        }

        const data = response.data;
        let items: Array<{
          id: string;
          code?: string | null;
          title?: string;
          name?: string;
          status?: string;
        }> = [];

        if (data?.success && data?.data?.items) {
          items = data.data.items;
        } else if (data?.items) {
          items = data.items;
        } else if (Array.isArray(data)) {
          items = data;
        }

        const mappedOptions: RecordPickerOption[] = items.map((item) => ({
          id: item.id,
          code: item.code || null,
          title: item.title || item.name || 'Untitled',
          status: item.status,
        }));

        setOptions(mappedOptions);
      } catch (err) {
        console.error('Failed to search records:', err);
        setOptions([]);
      } finally {
        setLoading(false);
      }
    },
    [entityType, tenantId],
  );

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (inputValue.length >= 1) {
      debounceRef.current = setTimeout(() => {
        searchRecords(inputValue);
      }, DEBOUNCE_MS);
    } else {
      searchRecords('');
    }

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [inputValue, searchRecords]);

  useEffect(() => {
    if (value && options.length > 0) {
      const found = options.find((opt) => opt.id === value);
      if (found && (!selectedOption || selectedOption.id !== found.id)) {
        setSelectedOption(found);
      }
    } else if (!value && selectedOption) {
      setSelectedOption(null);
    }
  }, [value, options, selectedOption]);

  const handleChange = (
    _event: React.SyntheticEvent,
    newValue: RecordPickerOption | null,
  ) => {
    setSelectedOption(newValue);
    onChange(newValue?.id || null, newValue);
  };

  const handleInputChange = (
    _event: React.SyntheticEvent,
    newInputValue: string,
  ) => {
    setInputValue(newInputValue);
  };

  return (
    <Autocomplete
      value={selectedOption}
      onChange={handleChange}
      inputValue={inputValue}
      onInputChange={handleInputChange}
      options={options}
      loading={loading}
      disabled={disabled}
      getOptionLabel={(option) => {
        if (option.code) {
          return `${option.code} - ${option.title}`;
        }
        return option.title;
      }}
      isOptionEqualToValue={(option, val) => option.id === val.id}
      filterOptions={(x) => x}
      renderOption={(props, option) => (
        <Box component="li" {...props} key={option.id}>
          <Box sx={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {option.code && (
                <Chip
                  label={option.code}
                  size="small"
                  variant="outlined"
                  sx={{ fontFamily: 'monospace', fontWeight: 500 }}
                />
              )}
              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                {option.title}
              </Typography>
            </Box>
            {option.status && (
              <Typography variant="caption" color="text.secondary">
                Status: {option.status}
              </Typography>
            )}
          </Box>
        </Box>
      )}
      renderInput={(params) => (
        <TextField
          {...params}
          label={label || `Select ${getEntityLabel()}`}
          placeholder={placeholder || `Search ${getEntityLabel().toLowerCase()}s...`}
          required={required}
          error={error}
          helperText={helperText}
          InputProps={{
            ...params.InputProps,
            endAdornment: (
              <>
                {loading ? <CircularProgress color="inherit" size={20} /> : null}
                {params.InputProps.endAdornment}
              </>
            ),
          }}
        />
      )}
    />
  );
};

export default RecordPicker;
