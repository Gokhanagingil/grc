import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  Grid,
  Chip,
  Alert,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Divider,
  Card,
  CardContent,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import WarningIcon from '@mui/icons-material/Warning';
import HealthAndSafetyIcon from '@mui/icons-material/HealthAndSafety';
import { itsmApi } from '../../services/grcClient';

interface HealthInfo {
  tenantId: string;
  buildSha: string;
  nodeEnv: string;
  uptime: number;
  timestamp: string;
}

interface TableCounts {
  tableName: string;
  businessRules: number;
  uiPolicies: number;
  uiActions: number;
  workflows: number;
  slaDefinitions: number;
}

interface ValidationError {
  type: string;
  table: string;
  field: string;
  detail: string;
}

interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  timestamp: string;
}

interface SlaSummary {
  total: number;
  inProgress: number;
  breached: number;
  met: number;
  paused: number;
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

function errorTypeColor(type: string): 'error' | 'warning' | 'info' {
  if (type === 'MISSING_CHOICES' || type === 'MISSING_WORKFLOW') return 'error';
  if (type === 'MALFORMED_WORKFLOW') return 'warning';
  return 'info';
}

export const ItsmDiagnostics: React.FC = () => {
  const [health, setHealth] = useState<HealthInfo | null>(null);
  const [counts, setCounts] = useState<TableCounts[]>([]);
  const [slaSummary, setSlaSummary] = useState<SlaSummary | null>(null);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [validating, setValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [healthRes, countsRes, slaRes] = await Promise.all([
        itsmApi.diagnostics.health(),
        itsmApi.diagnostics.counts(),
        itsmApi.diagnostics.slaSummary(),
      ]);
      setHealth(healthRes?.data?.data || healthRes?.data || healthRes);
      const countsData = countsRes?.data?.data || countsRes?.data || countsRes;
      setCounts(Array.isArray(countsData) ? countsData : []);
      setSlaSummary(slaRes?.data?.data || slaRes?.data || slaRes);
    } catch (err) {
      setError('Failed to load diagnostics data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleValidate = async () => {
    try {
      setValidating(true);
      setError(null);
      const res = await itsmApi.diagnostics.validateBaseline();
      setValidation(res?.data?.data || res?.data || res);
    } catch (err) {
      setError('Failed to run baseline validation');
      console.error(err);
    } finally {
      setValidating(false);
    }
  };

  if (loading) {
    return <Box sx={{ p: 3, textAlign: 'center' }}><CircularProgress /></Box>;
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <HealthAndSafetyIcon color="primary" sx={{ fontSize: 32 }} />
          <Box>
            <Typography variant="h5">Platform Runtime Diagnostics</Typography>
            <Typography variant="body2" color="text.secondary">
              Health checks, configuration counts, and baseline validation for ITSM runtime.
            </Typography>
          </Box>
        </Box>
        <Button variant="outlined" startIcon={<RefreshIcon />} onClick={loadData}>
          Refresh
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>Platform Health</Typography>
            <Divider sx={{ mb: 2 }} />
            {health ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2" color="text.secondary">Tenant ID</Typography>
                  <Typography variant="body2" fontFamily="monospace">{health.tenantId}</Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2" color="text.secondary">Build SHA</Typography>
                  <Chip label={health.buildSha || 'dev'} size="small" variant="outlined" />
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2" color="text.secondary">Environment</Typography>
                  <Chip
                    label={health.nodeEnv}
                    size="small"
                    color={health.nodeEnv === 'production' ? 'success' : 'warning'}
                  />
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2" color="text.secondary">Uptime</Typography>
                  <Typography variant="body2">{formatUptime(health.uptime)}</Typography>
                </Box>
              </Box>
            ) : (
              <Typography color="text.secondary">No health data available</Typography>
            )}
          </Paper>
        </Grid>

        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>SLA Instance Summary</Typography>
            <Divider sx={{ mb: 2 }} />
            {slaSummary ? (
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Card variant="outlined">
                    <CardContent sx={{ py: 1, '&:last-child': { pb: 1 } }}>
                      <Typography variant="h4" textAlign="center">{slaSummary.total}</Typography>
                      <Typography variant="body2" textAlign="center" color="text.secondary">Total</Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={6}>
                  <Card variant="outlined">
                    <CardContent sx={{ py: 1, '&:last-child': { pb: 1 } }}>
                      <Typography variant="h4" textAlign="center" color="info.main">{slaSummary.inProgress}</Typography>
                      <Typography variant="body2" textAlign="center" color="text.secondary">In Progress</Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={4}>
                  <Card variant="outlined">
                    <CardContent sx={{ py: 1, '&:last-child': { pb: 1 } }}>
                      <Typography variant="h5" textAlign="center" color="error.main">{slaSummary.breached}</Typography>
                      <Typography variant="caption" display="block" textAlign="center" color="text.secondary">Breached</Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={4}>
                  <Card variant="outlined">
                    <CardContent sx={{ py: 1, '&:last-child': { pb: 1 } }}>
                      <Typography variant="h5" textAlign="center" color="success.main">{slaSummary.met}</Typography>
                      <Typography variant="caption" display="block" textAlign="center" color="text.secondary">Met</Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={4}>
                  <Card variant="outlined">
                    <CardContent sx={{ py: 1, '&:last-child': { pb: 1 } }}>
                      <Typography variant="h5" textAlign="center" color="warning.main">{slaSummary.paused}</Typography>
                      <Typography variant="caption" display="block" textAlign="center" color="text.secondary">Paused</Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            ) : (
              <Typography color="text.secondary">No SLA data available</Typography>
            )}
          </Paper>
        </Grid>

        <Grid item xs={12}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>Active Configurations Per Table</Typography>
            <Divider sx={{ mb: 2 }} />
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold' }}>Table</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }} align="center">Business Rules</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }} align="center">UI Policies</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }} align="center">UI Actions</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }} align="center">Workflows</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }} align="center">SLA Definitions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {counts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} align="center">
                        <Typography color="text.secondary">No configuration data</Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    counts.map((row) => (
                      <TableRow key={row.tableName} hover>
                        <TableCell>
                          <Chip label={row.tableName} size="small" variant="outlined" />
                        </TableCell>
                        <TableCell align="center">{row.businessRules}</TableCell>
                        <TableCell align="center">{row.uiPolicies}</TableCell>
                        <TableCell align="center">{row.uiActions}</TableCell>
                        <TableCell align="center">{row.workflows}</TableCell>
                        <TableCell align="center">{row.slaDefinitions}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Grid>

        <Grid item xs={12}>
          <Paper sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Box>
                <Typography variant="h6">Baseline Validation</Typography>
                <Typography variant="body2" color="text.secondary">
                  Checks required choice sets, workflows, and SLA definitions for ITSM core fields.
                </Typography>
              </Box>
              <Button
                variant="contained"
                onClick={handleValidate}
                disabled={validating}
                startIcon={validating ? <CircularProgress size={16} /> : <HealthAndSafetyIcon />}
              >
                {validating ? 'Validating...' : 'Validate Baseline'}
              </Button>
            </Box>
            <Divider sx={{ mb: 2 }} />
            {validation ? (
              <Box>
                <Alert
                  severity={validation.valid ? 'success' : 'error'}
                  icon={validation.valid ? <CheckCircleIcon /> : <ErrorIcon />}
                  sx={{ mb: 2 }}
                >
                  {validation.valid
                    ? 'All baseline checks passed. Runtime configuration is healthy.'
                    : `${validation.errors.length} issue(s) found. Review and fix the errors below.`}
                </Alert>
                {validation.errors.length > 0 && (
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 'bold' }}>Type</TableCell>
                          <TableCell sx={{ fontWeight: 'bold' }}>Table</TableCell>
                          <TableCell sx={{ fontWeight: 'bold' }}>Field</TableCell>
                          <TableCell sx={{ fontWeight: 'bold' }}>Detail</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {validation.errors.map((err, idx) => (
                          <TableRow key={idx}>
                            <TableCell>
                              <Chip
                                icon={errorTypeColor(err.type) === 'error' ? <ErrorIcon /> : <WarningIcon />}
                                label={err.type}
                                size="small"
                                color={errorTypeColor(err.type)}
                                variant="outlined"
                              />
                            </TableCell>
                            <TableCell>{err.table}</TableCell>
                            <TableCell>{err.field || '—'}</TableCell>
                            <TableCell>{err.detail}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </Box>
            ) : (
              <Box sx={{ textAlign: 'center', py: 3 }}>
                <Typography color="text.secondary">
                  Click "Validate Baseline" to check your ITSM configuration health.
                </Typography>
              </Box>
            )}
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default ItsmDiagnostics;
