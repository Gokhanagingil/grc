import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  CircularProgress,
  Alert,
  Button,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  ToggleButtonGroup,
  ToggleButton,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { cmdbApi, EffectiveSchemaResponse, EffectiveFieldDefinition, unwrapResponse } from '../../services/grcClient';
import { classifyApiError } from '../../utils/apiErrorClassifier';

type FieldFilter = 'all' | 'local' | 'inherited';

interface EffectiveSchemaPanelProps {
  classId: string;
}

export const EffectiveSchemaPanel: React.FC<EffectiveSchemaPanelProps> = ({ classId }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [schema, setSchema] = useState<EffectiveSchemaResponse | null>(null);
  const [filter, setFilter] = useState<FieldFilter>('all');

  const fetchSchema = useCallback(async () => {
    if (!classId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await cmdbApi.classes.effectiveSchema(classId);
      const schemaData = unwrapResponse<EffectiveSchemaResponse>(response);
      if (schemaData && typeof schemaData === 'object' && 'effectiveFields' in schemaData) {
        setSchema(schemaData);
      } else {
        setSchema(null);
      }
    } catch (err) {
      console.error('Error fetching effective schema:', err);
      const classified = classifyApiError(err);
      if (classified.kind === 'forbidden') {
        setError('You do not have permission to view the effective schema.');
      } else if (classified.kind === 'network') {
        setError('Network error loading effective schema. Please try again.');
      } else {
        setError(classified.message || 'Failed to load effective schema. The class detail is still usable.');
      }
    } finally {
      setLoading(false);
    }
  }, [classId]);

  useEffect(() => {
    fetchSchema();
  }, [fetchSchema]);

  const filteredFields: EffectiveFieldDefinition[] = (() => {
    if (!schema?.effectiveFields) return [];
    const fields = Array.isArray(schema.effectiveFields) ? schema.effectiveFields : [];
    switch (filter) {
      case 'local':
        return fields.filter((f) => !f.inherited);
      case 'inherited':
        return fields.filter((f) => f.inherited);
      default:
        return fields;
    }
  })();

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }} data-testid="effective-schema-loading">
        <CircularProgress size={28} />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert
        severity="warning"
        data-testid="effective-schema-error"
        action={
          <Button color="inherit" size="small" onClick={fetchSchema}>
            Retry
          </Button>
        }
      >
        {error}
      </Alert>
    );
  }

  if (!schema || !schema.effectiveFields || schema.effectiveFields.length === 0) {
    return (
      <Alert severity="info" data-testid="effective-schema-empty">
        No effective fields resolved for this class. Fields can be added locally or inherited from parent classes.
      </Alert>
    );
  }

  const totalCount = schema.totalFieldCount ?? schema.effectiveFields.length;
  const inheritedCount = schema.inheritedFieldCount ?? schema.effectiveFields.filter((f) => f.inherited).length;
  const localCount = schema.localFieldCount ?? schema.effectiveFields.filter((f) => !f.inherited).length;

  return (
    <Box data-testid="effective-schema-panel">
      {/* Resolution summary */}
      <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap', alignItems: 'center' }}>
        <Chip
          label={`${totalCount} total`}
          size="small"
          color="primary"
          variant="outlined"
          data-testid="effective-schema-total"
        />
        <Chip
          label={`${localCount} local`}
          size="small"
          color="success"
          variant="outlined"
          data-testid="effective-schema-local-count"
        />
        <Chip
          label={`${inheritedCount} inherited`}
          size="small"
          color="info"
          variant="outlined"
          data-testid="effective-schema-inherited-count"
        />
        <Box sx={{ flexGrow: 1 }} />
        <ToggleButtonGroup
          value={filter}
          exclusive
          onChange={(_, val) => val && setFilter(val as FieldFilter)}
          size="small"
          data-testid="effective-schema-filter"
        >
          <ToggleButton value="all">All</ToggleButton>
          <ToggleButton value="local">Local</ToggleButton>
          <ToggleButton value="inherited">Inherited</ToggleButton>
        </ToggleButtonGroup>
        <Button
          size="small"
          startIcon={<RefreshIcon />}
          onClick={fetchSchema}
          data-testid="effective-schema-refresh"
        >
          Refresh
        </Button>
      </Box>

      {/* Ancestors chain */}
      {schema.ancestors && schema.ancestors.length > 0 && (
        <Box sx={{ mb: 2, display: 'flex', gap: 0.5, flexWrap: 'wrap', alignItems: 'center' }}>
          <Typography variant="caption" color="text.secondary" sx={{ mr: 0.5 }}>
            Inheritance chain:
          </Typography>
          {schema.ancestors.map((a, idx) => (
            <React.Fragment key={a.id}>
              <Chip
                label={a.label || a.name}
                size="small"
                variant="outlined"
                color="info"
              />
              {idx < schema.ancestors.length - 1 && (
                <Typography variant="caption" color="text.secondary">&rarr;</Typography>
              )}
            </React.Fragment>
          ))}
          <Typography variant="caption" color="text.secondary">&rarr;</Typography>
          <Chip
            label={schema.classLabel || schema.className}
            size="small"
            color="primary"
          />
        </Box>
      )}

      {/* Fields table */}
      {filteredFields.length === 0 ? (
        <Alert severity="info" data-testid="effective-schema-filter-empty">
          No {filter === 'local' ? 'local' : 'inherited'} fields found.
        </Alert>
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small" data-testid="effective-schema-table">
            <TableHead>
              <TableRow>
                <TableCell>Key</TableCell>
                <TableCell>Label</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Source</TableCell>
                <TableCell>Required</TableCell>
                <TableCell>Depth</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredFields.map((field) => (
                <TableRow
                  key={`${field.sourceClassId}-${field.key}`}
                  data-testid={`effective-field-${field.key}`}
                >
                  <TableCell>
                    <Typography variant="body2" fontFamily="monospace">
                      {field.key}
                    </Typography>
                  </TableCell>
                  <TableCell>{field.label}</TableCell>
                  <TableCell>
                    <Chip label={field.dataType} size="small" variant="outlined" />
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
                      {field.inherited ? (
                        <Chip
                          label={field.sourceClassName || 'inherited'}
                          size="small"
                          color="info"
                          variant="outlined"
                          data-testid={`field-inherited-badge-${field.key}`}
                        />
                      ) : (
                        <Chip
                          label="local"
                          size="small"
                          color="success"
                          data-testid={`field-local-badge-${field.key}`}
                        />
                      )}
                    </Box>
                  </TableCell>
                  <TableCell>
                    {field.required ? (
                      <Chip label="Required" size="small" color="error" variant="outlined" />
                    ) : (
                      <Typography variant="body2" color="text.secondary">Optional</Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">
                      {field.inheritanceDepth ?? 0}
                    </Typography>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
};

export default EffectiveSchemaPanel;
