import React from 'react';
import {
  Box,
  Chip,
  FormControl,
  FormHelperText,
  InputLabel,
  MenuItem,
  Select,
  Switch,
  FormControlLabel,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import type { EffectiveFieldDefinition } from '../../services/grcClient';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface SchemaFieldRendererProps {
  field: EffectiveFieldDefinition;
  value: unknown;
  onChange: (key: string, value: unknown) => void;
  error?: string;
  disabled?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Renders a single form field based on the effective schema definition.
 * Shows an inherited badge when the field comes from a parent class.
 */
export const SchemaFieldRenderer: React.FC<SchemaFieldRendererProps> = ({
  field,
  value,
  onChange,
  error,
  disabled = false,
}) => {
  const isReadOnly = disabled || field.readOnly;
  const fieldId = `schema-field-${field.key}`;

  // ----- Label with provenance badge -----
  const labelContent = (
    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
      <span>{field.label}</span>
      {field.inherited && (
        <Tooltip title={`Inherited from ${field.sourceClassName}`} arrow>
          <Chip
            label={field.sourceClassName}
            size="small"
            variant="outlined"
            color="info"
            sx={{ height: 18, fontSize: '0.65rem', ml: 0.5 }}
            data-testid={`inherited-badge-${field.key}`}
          />
        </Tooltip>
      )}
    </Box>
  );

  // ----- Render by dataType -----
  switch (field.dataType) {
    // ---- Boolean ----
    case 'boolean':
      return (
        <Box data-testid={fieldId}>
          <FormControlLabel
            control={
              <Switch
                checked={Boolean(value)}
                onChange={(e) => onChange(field.key, e.target.checked)}
                disabled={isReadOnly}
                data-testid={`${fieldId}-input`}
              />
            }
            label={labelContent}
          />
          {field.inherited && (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', ml: 6 }}>
              Source: {field.sourceClassName}
            </Typography>
          )}
          {error && <FormHelperText error>{error}</FormHelperText>}
          {field.helpText && <FormHelperText>{field.helpText}</FormHelperText>}
        </Box>
      );

    // ---- Enum / choices ----
    case 'enum':
      return (
        <FormControl
          fullWidth
          error={Boolean(error)}
          required={field.required}
          disabled={isReadOnly}
          data-testid={fieldId}
        >
          <InputLabel>{labelContent}</InputLabel>
          <Select
            value={(value as string) ?? ''}
            label={field.label}
            onChange={(e) => onChange(field.key, e.target.value)}
            data-testid={`${fieldId}-input`}
          >
            {!field.required && (
              <MenuItem value="">
                <em>None</em>
              </MenuItem>
            )}
            {(field.choices ?? []).map((choice) => (
              <MenuItem key={choice} value={choice}>
                {choice}
              </MenuItem>
            ))}
          </Select>
          {error && <FormHelperText>{error}</FormHelperText>}
          {field.helpText && !error && <FormHelperText>{field.helpText}</FormHelperText>}
        </FormControl>
      );

    // ---- Number ----
    case 'number':
      return (
        <TextField
          fullWidth
          type="number"
          label={labelContent}
          value={value ?? ''}
          onChange={(e) => {
            const v = e.target.value;
            onChange(field.key, v === '' ? null : Number(v));
          }}
          required={field.required}
          disabled={isReadOnly}
          error={Boolean(error)}
          helperText={error || field.helpText}
          data-testid={fieldId}
          inputProps={{
            'data-testid': `${fieldId}-input`,
          }}
        />
      );

    // ---- Date ----
    case 'date':
      return (
        <TextField
          fullWidth
          type="date"
          label={labelContent}
          value={
            value
              ? typeof value === 'string'
                ? value.substring(0, 10)
                : ''
              : ''
          }
          onChange={(e) => onChange(field.key, e.target.value || null)}
          required={field.required}
          disabled={isReadOnly}
          error={Boolean(error)}
          helperText={error || field.helpText}
          InputLabelProps={{ shrink: true }}
          data-testid={fieldId}
          inputProps={{
            'data-testid': `${fieldId}-input`,
          }}
        />
      );

    // ---- Text (multiline) ----
    case 'text':
      return (
        <TextField
          fullWidth
          multiline
          rows={3}
          label={labelContent}
          value={(value as string) ?? ''}
          onChange={(e) => onChange(field.key, e.target.value)}
          required={field.required}
          disabled={isReadOnly}
          error={Boolean(error)}
          helperText={error || field.helpText}
          inputProps={{
            maxLength: field.maxLength,
            'data-testid': `${fieldId}-input`,
          }}
          data-testid={fieldId}
        />
      );

    // ---- JSON ----
    case 'json':
      return (
        <TextField
          fullWidth
          multiline
          rows={4}
          label={labelContent}
          value={
            typeof value === 'object' && value !== null
              ? JSON.stringify(value, null, 2)
              : (value as string) ?? ''
          }
          onChange={(e) => {
            try {
              const parsed = JSON.parse(e.target.value);
              onChange(field.key, parsed);
            } catch {
              // keep raw string while user is typing
              onChange(field.key, e.target.value);
            }
          }}
          required={field.required}
          disabled={isReadOnly}
          error={Boolean(error)}
          helperText={error || field.helpText || 'Enter valid JSON'}
          data-testid={fieldId}
          inputProps={{
            'data-testid': `${fieldId}-input`,
          }}
        />
      );

    // ---- String / Reference / default ----
    case 'string':
    case 'reference':
    default:
      return (
        <TextField
          fullWidth
          label={labelContent}
          value={(value as string) ?? ''}
          onChange={(e) => onChange(field.key, e.target.value)}
          required={field.required}
          disabled={isReadOnly}
          error={Boolean(error)}
          helperText={error || field.helpText}
          inputProps={{
            maxLength: field.maxLength,
            'data-testid': `${fieldId}-input`,
          }}
          data-testid={fieldId}
        />
      );
  }
};

export default SchemaFieldRenderer;
