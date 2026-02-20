import React from 'react';
import {
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormHelperText,
  Switch,
  FormControlLabel,
  Autocomplete,
  Chip,
} from '@mui/material';

type FieldType = 'text' | 'email' | 'password' | 'number' | 'select' | 'multiselect' | 'switch' | 'textarea';

interface SelectOption {
  value: string | number;
  label: string;
}

interface AdminFormFieldProps {
  name: string;
  label: string;
  type?: FieldType;
  value: unknown;
  onChange: (name: string, value: unknown) => void;
  error?: string;
  helperText?: string;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  options?: SelectOption[];
  fullWidth?: boolean;
  multiline?: boolean;
  rows?: number;
  autoFocus?: boolean;
  inputProps?: object;
}

export const AdminFormField: React.FC<AdminFormFieldProps> = ({
  name,
  label,
  type = 'text',
  value,
  onChange,
  error,
  helperText,
  required = false,
  disabled = false,
  placeholder,
  options = [],
  fullWidth = true,
  multiline = false,
  rows = 4,
  autoFocus = false,
  inputProps = {},
}) => {
  const handleChange = (newValue: unknown) => {
    onChange(name, newValue);
  };

  if (type === 'switch') {
    return (
      <FormControl fullWidth={fullWidth} error={!!error}>
        <FormControlLabel
          control={
            <Switch
              checked={Boolean(value)}
              onChange={(e) => handleChange(e.target.checked)}
              disabled={disabled}
            />
          }
          label={label}
        />
        {(error || helperText) && (
          <FormHelperText error={!!error}>
            {error || helperText}
          </FormHelperText>
        )}
      </FormControl>
    );
  }

  if (type === 'select') {
    return (
      <FormControl fullWidth={fullWidth} error={!!error} required={required}>
        <InputLabel>{label}</InputLabel>
        <Select
          value={value || ''}
          label={label}
          onChange={(e) => handleChange(e.target.value)}
          disabled={disabled}
        >
          {options.map((option) => (
            <MenuItem key={option.value} value={option.value}>
              {option.label}
            </MenuItem>
          ))}
        </Select>
        {(error || helperText) && (
          <FormHelperText>{error || helperText}</FormHelperText>
        )}
      </FormControl>
    );
  }

  if (type === 'multiselect') {
    return (
      <FormControl fullWidth={fullWidth} error={!!error} required={required}>
        <Autocomplete
          multiple
          options={options}
          getOptionLabel={(option) => option.label}
          value={
            Array.isArray(value)
              ? options.filter((opt) =>
                  (value as (string | number)[]).includes(opt.value)
                )
              : []
          }
          onChange={(_, newValue) =>
            handleChange(newValue.map((v) => v.value))
          }
          disabled={disabled}
          renderInput={(params) => (
            <TextField
              {...params}
              label={label}
              placeholder={placeholder}
              error={!!error}
              helperText={error || helperText}
              required={required}
            />
          )}
          renderTags={(tagValue, getTagProps) =>
            tagValue.map((option, index) => (
              <Chip
                label={option.label}
                {...getTagProps({ index })}
                key={option.value}
              />
            ))
          }
        />
      </FormControl>
    );
  }

  if (type === 'textarea') {
    return (
      <TextField
        name={name}
        label={label}
        value={value || ''}
        onChange={(e) => handleChange(e.target.value)}
        error={!!error}
        helperText={error || helperText}
        required={required}
        disabled={disabled}
        placeholder={placeholder}
        fullWidth={fullWidth}
        multiline
        rows={rows}
        autoFocus={autoFocus}
        inputProps={inputProps}
      />
    );
  }

  return (
    <TextField
      name={name}
      label={label}
      type={type}
      value={value || ''}
      onChange={(e) => handleChange(e.target.value)}
      error={!!error}
      helperText={error || helperText}
      required={required}
      disabled={disabled}
      placeholder={placeholder}
      fullWidth={fullWidth}
      multiline={multiline}
      rows={multiline ? rows : undefined}
      autoFocus={autoFocus}
      inputProps={inputProps}
    />
  );
};

export default AdminFormField;
