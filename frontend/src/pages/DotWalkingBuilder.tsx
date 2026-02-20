import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Autocomplete,
  Chip,
  Alert,
  CircularProgress,
  Card,
  CardContent,
  Grid,
  Divider,
  IconButton,
  Tooltip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import {
  PlayArrow as TestIcon,
  Clear as ClearIcon,
  ContentCopy as CopyIcon,
  Help as HelpIcon,
} from '@mui/icons-material';
import { api } from '../services/api';
import { safeArray } from '../utils/safeHelpers';

interface Schema {
  entities: string[];
  fields: Record<string, string[]>;
  relationships: Record<string, Record<string, { entity: string; foreignKey: string; type: string }>>;
}

function unwrapApiResponse<T>(response: { data: unknown }): T {
  const data = response.data;
  if (data && typeof data === 'object' && 'success' in data && (data as { success: boolean }).success === true && 'data' in data) {
    return (data as { data: T }).data;
  }
  return data as T;
}

interface ParseResult {
  valid: boolean;
  error: string | null;
  segments: Array<{
    type: string;
    value: string;
    entity?: string;
    targetEntity?: string;
    relationshipType?: string;
  }>;
  depth: number;
}

interface TestResult {
  valid: boolean;
  error?: string;
  path?: string;
  depth?: number;
  sampleData?: any[];
  sampleCount?: number;
  suggestions?: string[];
}

export const DotWalkingBuilder: React.FC = () => {
  const [schema, setSchema] = useState<Schema | null>(null);
  const [path, setPath] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSchema = useCallback(async () => {
    try {
      const response = await api.get('/admin/data-model/dotwalking/schema');
      const schemaData = unwrapApiResponse<Schema | null>(response);
      if (schemaData) {
        setSchema({
          entities: safeArray(schemaData.entities),
          fields: schemaData.fields ?? {},
          relationships: schemaData.relationships ?? {},
        });
      } else {
        setSchema({ entities: [], fields: {}, relationships: {} });
        setError('Schema endpoint returned empty data. Dot-walking may not be available.');
      }
    } catch (err: unknown) {
      setSchema({ entities: [], fields: {}, relationships: {} });
      const errorMessage = err instanceof Error ? err.message : 'Failed to load schema';
      setError(`Failed to load schema: ${errorMessage}. The dot-walking feature may not be available.`);
    }
  }, []);

  const fetchSuggestions = useCallback(async (currentPath: string) => {
    try {
      const response = await api.get(`/admin/data-model/dotwalking/suggestions?path=${encodeURIComponent(currentPath)}`);
      const data = unwrapApiResponse<{ suggestions?: string[] } | string[] | null>(response);
      const suggestionsList = Array.isArray(data) 
        ? data 
        : safeArray(data?.suggestions);
      setSuggestions(suggestionsList);
    } catch {
      setSuggestions([]);
    }
  }, []);

  const validatePath = useCallback(async (currentPath: string) => {
    if (!currentPath) {
      setParseResult(null);
      return;
    }
    try {
      const response = await api.post('/admin/data-model/dotwalking/validate', { path: currentPath });
      const data = unwrapApiResponse<ParseResult | null>(response);
      if (data) {
        setParseResult({
          valid: data.valid ?? false,
          error: data.error ?? null,
          segments: safeArray(data.segments),
          depth: data.depth ?? 0,
        });
      } else {
        setParseResult({
          valid: false,
          error: 'Validation endpoint returned empty data',
          segments: [],
          depth: 0,
        });
      }
    } catch (err: unknown) {
      const errorResponse = err as { response?: { data?: { message?: string } } };
      setParseResult({
        valid: false,
        error: errorResponse?.response?.data?.message || 'Validation failed',
        segments: [],
        depth: 0
      });
    }
  }, []);

  useEffect(() => {
    fetchSchema();
  }, [fetchSchema]);

  useEffect(() => {
    const debounce = setTimeout(() => {
      fetchSuggestions(path);
      validatePath(path);
    }, 300);
    return () => clearTimeout(debounce);
  }, [path, fetchSuggestions, validatePath]);

  const handleTest = async () => {
    if (!path) return;
    setLoading(true);
    setTestResult(null);
    try {
      const response = await api.post('/admin/data-model/dotwalking/test', { path });
      const data = unwrapApiResponse<TestResult | null>(response);
      if (data) {
        setTestResult({
          valid: data.valid ?? false,
          error: data.error,
          path: data.path,
          depth: data.depth,
          sampleData: safeArray(data.sampleData),
          sampleCount: data.sampleCount ?? 0,
          suggestions: safeArray(data.suggestions),
        });
      } else {
        setTestResult({
          valid: false,
          error: 'Test endpoint returned empty data'
        });
      }
    } catch (err: unknown) {
      const errorResponse = err as { response?: { data?: { message?: string } } };
      setTestResult({
        valid: false,
        error: errorResponse?.response?.data?.message || 'Test failed'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setPath('');
    setParseResult(null);
    setTestResult(null);
    setSuggestions([]);
  };

  const handleCopyPath = () => {
    navigator.clipboard.writeText(path);
  };

  const handleSuggestionClick = (suggestion: string) => {
    const parts = path.split('.');
    parts[parts.length - 1] = suggestion;
    setPath(parts.join('.'));
  };

  const appendToPath = (value: string) => {
    if (path) {
      setPath(`${path}.${value}`);
    } else {
      setPath(value);
    }
  };

  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom>
        Dot-Walking Query Builder
      </Typography>

      <Typography variant="body2" color="text.secondary" paragraph>
        Build queries to traverse relationships between entities. Use dot notation to access related data 
        (e.g., risks.owner.email to get the email of a risk's owner).
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 3, mb: 3 }}>
            <Box display="flex" gap={2} alignItems="flex-start">
              <Autocomplete
                freeSolo
                fullWidth
                options={suggestions}
                inputValue={path}
                onInputChange={(_, value) => setPath(value)}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Dot-Walking Path"
                    placeholder="e.g., risks.owner.email"
                    helperText={parseResult?.error || 'Enter a path to traverse entity relationships'}
                    error={parseResult ? !parseResult.valid : false}
                  />
                )}
              />
              <Tooltip title="Test Query">
                <span>
                  <Button
                    variant="contained"
                    onClick={handleTest}
                    disabled={!path || loading || (!!parseResult && !parseResult.valid)}
                    startIcon={loading ? <CircularProgress size={20} /> : <TestIcon />}
                  >
                    Test
                  </Button>
                </span>
              </Tooltip>
              <Tooltip title="Copy Path">
                <IconButton onClick={handleCopyPath} disabled={!path}>
                  <CopyIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title="Clear">
                <IconButton onClick={handleClear}>
                  <ClearIcon />
                </IconButton>
              </Tooltip>
            </Box>

            {parseResult && parseResult.valid && (
              <Box mt={2}>
                <Typography variant="subtitle2" gutterBottom>
                  Path Analysis
                </Typography>
                <Box display="flex" gap={1} flexWrap="wrap">
                  {parseResult.segments.map((segment, index) => (
                    <Chip
                      key={index}
                      label={segment.value}
                      color={
                        segment.type === 'entity' ? 'primary' :
                        segment.type === 'relationship' ? 'secondary' : 'default'
                      }
                      size="small"
                      title={`Type: ${segment.type}${segment.targetEntity ? `, Target: ${segment.targetEntity}` : ''}`}
                    />
                  ))}
                </Box>
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                  Depth: {parseResult.depth} relationship(s)
                </Typography>
              </Box>
            )}
          </Paper>

          {testResult && (
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Test Results
              </Typography>
              
              {testResult.valid ? (
                <>
                  <Alert severity="success" sx={{ mb: 2 }}>
                    Query executed successfully. Found {testResult.sampleCount} record(s).
                  </Alert>
                  
                  {testResult.sampleData && testResult.sampleData.length > 0 && testResult.sampleData[0] && (
                    <TableContainer sx={{ maxHeight: 400 }}>
                      <Table size="small" stickyHeader>
                        <TableHead>
                          <TableRow>
                            {Object.keys(testResult.sampleData[0]).map((key) => (
                              <TableCell key={key}>{key}</TableCell>
                            ))}
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {testResult.sampleData.filter(row => row != null).map((row, index) => (
                            <TableRow key={index}>
                              {Object.values(row).map((value: unknown, cellIndex) => (
                                <TableCell key={cellIndex}>
                                  {typeof value === 'object' ? JSON.stringify(value) : String(value ?? '-')}
                                </TableCell>
                              ))}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  )}
                </>
              ) : (
                <Alert severity="error">
                  {testResult.error}
                  {testResult.suggestions && testResult.suggestions.length > 0 && (
                    <Box mt={1}>
                      <Typography variant="caption">Did you mean: </Typography>
                      {testResult.suggestions.map((s, i) => (
                        <Chip
                          key={i}
                          label={s}
                          size="small"
                          onClick={() => handleSuggestionClick(s)}
                          sx={{ ml: 0.5 }}
                        />
                      ))}
                    </Box>
                  )}
                </Alert>
              )}
            </Paper>
          )}
        </Grid>

        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 2 }}>
            <Box display="flex" alignItems="center" gap={1} mb={2}>
              <HelpIcon color="primary" />
              <Typography variant="h6">Schema Reference</Typography>
            </Box>

            {schema ? (
              <>
                <Typography variant="subtitle2" gutterBottom>
                  Available Entities
                </Typography>
                <Box display="flex" gap={0.5} flexWrap="wrap" mb={2}>
                  {schema.entities.map((entity) => (
                    <Chip
                      key={entity}
                      label={entity}
                      size="small"
                      onClick={() => appendToPath(entity)}
                      clickable
                    />
                  ))}
                </Box>

                <Divider sx={{ my: 2 }} />

                <Typography variant="subtitle2" gutterBottom>
                  Quick Examples
                </Typography>
                <Box display="flex" flexDirection="column" gap={1}>
                  {[
                    'risks.owner.email',
                    'policies.owner.department',
                    'compliance_requirements.assignee.first_name',
                    'organizations.parent.name',
                    'risk_assessments.risk.title',
                  ].map((example) => (
                    <Card key={example} variant="outlined" sx={{ cursor: 'pointer' }} onClick={() => setPath(example)}>
                      <CardContent sx={{ py: 1, '&:last-child': { pb: 1 } }}>
                        <Typography variant="body2" fontFamily="monospace">
                          {example}
                        </Typography>
                      </CardContent>
                    </Card>
                  ))}
                </Box>

                <Divider sx={{ my: 2 }} />

                <Typography variant="subtitle2" gutterBottom>
                  Relationship Types
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  <strong>1-1:</strong> Single related record (e.g., owner, assignee)
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  <strong>1-n:</strong> Multiple related records (e.g., assessments)
                </Typography>
              </>
            ) : (
              <Box display="flex" justifyContent="center" p={2}>
                <CircularProgress size={24} />
              </Box>
            )}
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default DotWalkingBuilder;
