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

interface Schema {
  entities: string[];
  fields: Record<string, string[]>;
  relationships: Record<string, Record<string, { entity: string; foreignKey: string; type: string }>>;
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
  const [schema, setSchema] = useState<Schema>({ entities: [], fields: {}, relationships: {} });
  const [path, setPath] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSchema = useCallback(async () => {
    try {
      const response = await api.get('/dotwalking/schema');
      const schemaData = response?.data;
      if (schemaData && typeof schemaData === 'object') {
        setSchema({
          entities: Array.isArray(schemaData.entities) ? schemaData.entities : [],
          fields: schemaData.fields && typeof schemaData.fields === 'object' ? schemaData.fields : {},
          relationships: schemaData.relationships && typeof schemaData.relationships === 'object' ? schemaData.relationships : {},
        });
      } else {
        setSchema({ entities: [], fields: {}, relationships: {} });
      }
    } catch (err: any) {
      setError('Failed to load schema');
      setSchema({ entities: [], fields: {}, relationships: {} });
    }
  }, []);

  const fetchSuggestions = useCallback(async (currentPath: string) => {
    try {
      const response = await api.get(`/dotwalking/suggestions?path=${encodeURIComponent(currentPath)}`);
      const suggestions = Array.isArray(response?.data?.suggestions) ? response.data.suggestions : [];
      setSuggestions(suggestions);
    } catch (err) {
      setSuggestions([]);
    }
  }, []);

  const validatePath = useCallback(async (currentPath: string) => {
    if (!currentPath) {
      setParseResult(null);
      return;
    }
    try {
      const response = await api.post('/dotwalking/validate', { path: currentPath });
      setParseResult(response.data);
    } catch (err: any) {
      setParseResult({
        valid: false,
        error: err.response?.data?.message || 'Validation failed',
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
      const response = await api.post('/dotwalking/test', { path });
      const testData = response?.data;
      setTestResult({
        valid: testData?.valid === true,
        error: testData?.error,
        path: testData?.path,
        depth: typeof testData?.depth === 'number' ? testData.depth : undefined,
        sampleData: Array.isArray(testData?.sampleData) ? testData.sampleData : [],
        sampleCount: typeof testData?.sampleCount === 'number' ? testData.sampleCount : 0,
        suggestions: Array.isArray(testData?.suggestions) ? testData.suggestions : [],
      });
    } catch (err: any) {
      setTestResult({
        valid: false,
        error: err.response?.data?.message || 'Test failed',
        sampleData: [],
        sampleCount: 0,
        suggestions: [],
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
                    disabled={!path || loading || (parseResult ? !parseResult.valid : false)}
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
                  
                  {testResult.sampleData && Array.isArray(testResult.sampleData) && testResult.sampleData.length > 0 && (
                    <TableContainer sx={{ maxHeight: 400 }}>
                      <Table size="small" stickyHeader>
                        <TableHead>
                          <TableRow>
                            {Object.keys(testResult.sampleData[0] || {}).map((key) => (
                              <TableCell key={key}>{key}</TableCell>
                            ))}
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {testResult.sampleData.map((row, index) => (
                            <TableRow key={index}>
                              {Object.values(row || {}).map((value: any, cellIndex) => (
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
                  {testResult.suggestions && Array.isArray(testResult.suggestions) && testResult.suggestions.length > 0 && (
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

            {schema.entities && schema.entities.length > 0 ? (
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
                {schema.entities.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    No schema available
                  </Typography>
                ) : (
                  <CircularProgress size={24} />
                )}
              </Box>
            )}
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default DotWalkingBuilder;
