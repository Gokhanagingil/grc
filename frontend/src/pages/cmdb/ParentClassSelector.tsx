import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Autocomplete,
  TextField,
  Alert,
  CircularProgress,
  Chip,
} from '@mui/material';
import {
  cmdbApi,
  CmdbCiClassData,
  ClassDescendantEntry,
  ValidateInheritanceResponse,
} from '../../services/grcClient';

interface ParentClassSelectorProps {
  /** Current class ID (null for create mode) */
  classId: string | null;
  /** Current parent class ID */
  parentClassId: string | null | undefined;
  /** Callback when parent selection changes. Also receives validation result. */
  onParentChange: (parentId: string | null, validation: ValidateInheritanceResponse | null) => void;
  /** Whether selector is disabled */
  disabled?: boolean;
}

interface ClassOption {
  id: string;
  name: string;
  label: string;
  isAbstract?: boolean;
  disabled?: boolean;
  disabledReason?: string;
}

export const ParentClassSelector: React.FC<ParentClassSelectorProps> = ({
  classId,
  parentClassId,
  onParentChange,
  disabled = false,
}) => {
  const [options, setOptions] = useState<ClassOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationResult, setValidationResult] = useState<ValidateInheritanceResponse | null>(null);
  const [validating, setValidating] = useState(false);
  const [descendants, setDescendants] = useState<Set<string>>(new Set());
  const [selectedOption, setSelectedOption] = useState<ClassOption | null>(null);

  // Fetch class list and descendants
  const fetchOptions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch all classes
      const response = await cmdbApi.classes.list({ page: 1, pageSize: 500 });
      const data = response.data;
      let classes: CmdbCiClassData[] = [];
      if (data && 'data' in data) {
        const inner = data.data;
        if (inner && 'items' in inner && Array.isArray(inner.items)) {
          classes = inner.items;
        } else if (Array.isArray(inner)) {
          classes = inner;
        }
      }

      // Fetch descendants of current class (to exclude them)
      let descendantIds = new Set<string>();
      if (classId) {
        try {
          const descResponse = await cmdbApi.classes.descendants(classId);
          const descData = descResponse.data;
          let descList: ClassDescendantEntry[] = [];
          if (descData && 'data' in descData && Array.isArray(descData.data)) {
            descList = descData.data;
          } else if (Array.isArray(descData)) {
            descList = descData;
          }
          descendantIds = new Set(descList.map((d) => d.id));
        } catch {
          // Non-critical: descendants fetch failed, we'll just not exclude them
          console.warn('Could not fetch descendants for exclusion');
        }
      }
      setDescendants(descendantIds);

      // Build options list
      const opts: ClassOption[] = classes
        .filter((c) => c.id !== classId) // Exclude self
        .map((c) => {
          const isDescendant = descendantIds.has(c.id);
          return {
            id: c.id,
            name: c.name,
            label: c.label || c.name,
            isAbstract: c.isAbstract,
            disabled: isDescendant,
            disabledReason: isDescendant ? 'Cannot select descendant as parent (cycle)' : undefined,
          };
        });

      setOptions(opts);

      // Set initial selected option
      if (parentClassId) {
        const found = opts.find((o) => o.id === parentClassId);
        setSelectedOption(found || null);
      } else {
        setSelectedOption(null);
      }
    } catch (err) {
      console.error('Error fetching class options:', err);
      setError('Failed to load class list for parent selection.');
    } finally {
      setLoading(false);
    }
  }, [classId, parentClassId]);

  useEffect(() => {
    fetchOptions();
  }, [fetchOptions]);

  // Validate inheritance when selection changes
  const validateSelection = useCallback(
    async (newParentId: string | null) => {
      if (!classId) {
        // Create mode: skip validation (no ID yet)
        setValidationResult(null);
        return;
      }

      setValidating(true);
      setValidationResult(null);
      try {
        const response = await cmdbApi.classes.validateInheritance(classId, {
          parentClassId: newParentId,
        });
        const data = response.data;
        let result: ValidateInheritanceResponse | null = null;
        if (data && 'data' in data && data.data) {
          result = data.data as ValidateInheritanceResponse;
        } else if (data && typeof data === 'object' && 'valid' in data) {
          result = data as ValidateInheritanceResponse;
        }
        setValidationResult(result);
        onParentChange(newParentId, result);
      } catch (err) {
        console.error('Error validating inheritance:', err);
        // Non-blocking: show warning but don't prevent editing
        setValidationResult({
          valid: false,
          warnings: ['Validation service unavailable. Please verify parent assignment manually.'],
        });
        onParentChange(newParentId, null);
      } finally {
        setValidating(false);
      }
    },
    [classId, onParentChange]
  );

  const handleChange = useCallback(
    (_event: React.SyntheticEvent, value: ClassOption | null) => {
      setSelectedOption(value);
      const newParentId = value?.id ?? null;
      validateSelection(newParentId);
    },
    [validateSelection]
  );

  return (
    <Box data-testid="parent-class-selector">
      <Autocomplete
        options={options}
        value={selectedOption}
        onChange={handleChange}
        getOptionLabel={(option) => `${option.label} (${option.name})`}
        getOptionDisabled={(option) => !!option.disabled}
        isOptionEqualToValue={(option, value) => option.id === value.id}
        loading={loading}
        disabled={disabled}
        renderOption={(props, option) => (
          <Box
            component="li"
            {...props}
            key={option.id}
            data-testid={`parent-option-${option.id}`}
            sx={{ opacity: option.disabled ? 0.5 : 1 }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
              <Typography variant="body2">{option.label}</Typography>
              <Typography variant="caption" color="text.secondary" fontFamily="monospace">
                {option.name}
              </Typography>
              {option.isAbstract && (
                <Chip label="Abstract" size="small" variant="outlined" color="warning" />
              )}
              {option.disabled && (
                <Typography variant="caption" color="error.main" sx={{ ml: 'auto' }}>
                  {option.disabledReason}
                </Typography>
              )}
            </Box>
          </Box>
        )}
        renderInput={(params) => (
          <TextField
            {...params}
            label="Parent Class"
            placeholder="Select parent class (optional)"
            data-testid="parent-class-input"
            InputProps={{
              ...params.InputProps,
              endAdornment: (
                <>
                  {loading || validating ? <CircularProgress size={20} /> : null}
                  {params.InputProps.endAdornment}
                </>
              ),
            }}
            helperText={
              descendants.size > 0
                ? `${descendants.size} descendant(s) excluded to prevent cycles`
                : undefined
            }
          />
        )}
      />

      {error && (
        <Alert severity="warning" sx={{ mt: 1 }} data-testid="parent-selector-error">
          {error}
        </Alert>
      )}

      {validating && (
        <Box sx={{ mt: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
          <CircularProgress size={16} />
          <Typography variant="caption" color="text.secondary">
            Validating inheritance...
          </Typography>
        </Box>
      )}

      {validationResult && !validating && (
        <Box sx={{ mt: 1 }}>
          {validationResult.valid ? (
            <Alert severity="success" data-testid="parent-validation-success">
              Parent assignment is valid.
            </Alert>
          ) : (
            <>
              {validationResult.errors?.map((err, idx) => (
                <Alert key={idx} severity="error" sx={{ mb: 0.5 }} data-testid="parent-validation-error">
                  {err}
                </Alert>
              ))}
            </>
          )}
          {validationResult.warnings?.map((warn, idx) => (
            <Alert key={idx} severity="warning" sx={{ mb: 0.5 }} data-testid="parent-validation-warning">
              {warn}
            </Alert>
          ))}
        </Box>
      )}
    </Box>
  );
};

export default ParentClassSelector;
