import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Button,
  Grid,
  Typography,
  Chip,
  Alert,
  CircularProgress,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Collapse,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Tooltip,
  LinearProgress,
  Skeleton,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  CheckCircle as PassedIcon,
  Error as FailedIcon,
  SkipNext as SkippedIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  FiberManualRecord as DotIcon,
  Timer as TimerIcon,
  Speed as SpeedIcon,
  GitHub as GitIcon,
} from '@mui/icons-material';
import { AdminPageHeader } from '../../components/admin';
import { api, getTenantId } from '../../services/api';

interface HealthCheck {
  id: string;
  module: string;
  checkName: string;
  status: 'PASSED' | 'FAILED' | 'SKIPPED';
  durationMs: number;
  httpStatus: number | null;
  errorMessage: string | null;
  requestUrl: string | null;
  responseSnippet: Record<string, unknown> | null;
}

interface HealthRun {
  id: string;
  suite: string;
  status: string;
  triggeredBy: string;
  totalChecks: number;
  passedChecks: number;
  failedChecks: number;
  skippedChecks: number;
  durationMs: number;
  gitSha: string | null;
  gitRef: string | null;
  startedAt: string;
  finishedAt: string | null;
  tenantId: string | null;
  checks?: HealthCheck[];
}

interface HealthBadge {
  status: 'GREEN' | 'AMBER' | 'RED' | 'UNKNOWN';
  suite: string;
  passRate: number;
  totalChecks: number;
  passedChecks: number;
  failedChecks: number;
  lastRunAt: string | null;
  lastRunId: string | null;
}

const statusColor = (status: string): 'success' | 'error' | 'warning' | 'default' => {
  switch (status) {
    case 'PASSED':
    case 'GREEN':
      return 'success';
    case 'FAILED':
    case 'RED':
      return 'error';
    case 'AMBER':
      return 'warning';
    default:
      return 'default';
  }
};

const statusIcon = (status: string) => {
  switch (status) {
    case 'PASSED':
      return <PassedIcon fontSize="small" color="success" />;
    case 'FAILED':
      return <FailedIcon fontSize="small" color="error" />;
    case 'SKIPPED':
      return <SkippedIcon fontSize="small" color="action" />;
    default:
      return <DotIcon fontSize="small" color="action" />;
  }
};

const formatDuration = (ms: number): string => {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const mins = Math.floor(ms / 60000);
  const secs = Math.floor((ms % 60000) / 1000);
  return `${mins}m ${secs}s`;
};

const formatTime = (iso: string): string => {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const AdminPlatformHealth: React.FC = () => {
  const [badge, setBadge] = useState<HealthBadge | null>(null);
  const [runs, setRuns] = useState<HealthRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [suiteFilter, setSuiteFilter] = useState<string>('');
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null);
  const [runChecks, setRunChecks] = useState<Record<string, HealthCheck[]>>({});
  const [checksLoading, setChecksLoading] = useState<string | null>(null);
  const [checkFilter, setCheckFilter] = useState<string>('all');
  const [scope, setScope] = useState<'global' | 'tenant'>('global');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const tenantParam = scope === 'tenant' ? getTenantId() : undefined;
      const baseParams: Record<string, string> = { suite: 'TIER1' };
      const runsParams: Record<string, string | number> = { limit: 20 };
      if (suiteFilter) runsParams.suite = suiteFilter;
      if (tenantParam) {
        baseParams.tenantId = tenantParam;
        runsParams.tenantId = tenantParam;
      }
      const [badgeRes, runsRes] = await Promise.all([
        api.get('/grc/platform-health/badge', { params: baseParams }),
        api.get('/grc/platform-health/runs', { params: runsParams }),
      ]);
      const badgeData = badgeRes.data?.data ?? badgeRes.data;
      setBadge(badgeData);
      const runsData = runsRes.data?.data ?? runsRes.data;
      setRuns(Array.isArray(runsData) ? runsData : []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load platform health data';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [suiteFilter, scope]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const toggleExpand = async (runId: string) => {
    if (expandedRunId === runId) {
      setExpandedRunId(null);
      return;
    }
    setExpandedRunId(runId);
    if (!runChecks[runId]) {
      setChecksLoading(runId);
      try {
        const tenantParam = scope === 'tenant' ? getTenantId() : undefined;
        const params: Record<string, string> = {};
        if (tenantParam) params.tenantId = tenantParam;
        const res = await api.get(`/grc/platform-health/runs/${runId}`, { params });
        const data = res.data?.data ?? res.data;
        setRunChecks((prev) => ({ ...prev, [runId]: data.checks || [] }));
      } catch {
        setRunChecks((prev) => ({ ...prev, [runId]: [] }));
      } finally {
        setChecksLoading(null);
      }
    }
  };

  const filteredChecks = (runId: string): HealthCheck[] => {
    const checks = runChecks[runId] || [];
    if (checkFilter === 'all') return checks;
    return checks.filter((c) => c.status === checkFilter.toUpperCase());
  };

  const badgeBgColor = badge
    ? badge.status === 'GREEN'
      ? '#e8f5e9'
      : badge.status === 'AMBER'
        ? '#fff3e0'
        : badge.status === 'RED'
          ? '#ffebee'
          : '#f5f5f5'
    : '#f5f5f5';

  const badgeTextColor = badge
    ? badge.status === 'GREEN'
      ? '#2e7d32'
      : badge.status === 'AMBER'
        ? '#e65100'
        : badge.status === 'RED'
          ? '#c62828'
          : '#757575'
    : '#757575';

  return (
    <Box>
      <AdminPageHeader
        title="Platform Health"
        subtitle="Smoke test results and system health at a glance"
        breadcrumbs={[
          { label: 'Admin', href: '/admin' },
          { label: 'Platform Health' },
        ]}
        actions={
          <Button
            startIcon={<RefreshIcon />}
            onClick={fetchData}
            disabled={loading}
          >
            {loading ? 'Loading...' : 'Refresh'}
          </Button>
        }
      />

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Health Badge Banner */}
      <Card
        sx={{ mb: 3, bgcolor: badgeBgColor, border: '1px solid', borderColor: badgeTextColor + '40' }}
        data-testid="health-badge-card"
      >
        <CardContent sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {loading && !badge ? (
              <CircularProgress size={24} />
            ) : (
              <Box
                sx={{
                  width: 48,
                  height: 48,
                  borderRadius: '50%',
                  bgcolor: badgeTextColor,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Typography variant="h6" sx={{ color: 'white', fontWeight: 'bold' }}>
                  {badge ? badge.passRate : 0}%
                </Typography>
              </Box>
            )}
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 'bold', color: badgeTextColor }}>
                {loading && !badge
                  ? 'Loading...'
                  : `Health: ${badge?.status || 'UNKNOWN'}`}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {badge?.lastRunAt
                  ? `Last Tier-1 run: ${formatTime(badge.lastRunAt)}`
                  : 'No runs recorded yet'}
              </Typography>
            </Box>
          </Box>
          {badge && (
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
              <Chip
                icon={<PassedIcon />}
                label={`${badge.passedChecks} passed`}
                color="success"
                variant="outlined"
                size="small"
              />
              {badge.failedChecks > 0 && (
                <Chip
                  icon={<FailedIcon />}
                  label={`${badge.failedChecks} failed`}
                  color="error"
                  variant="outlined"
                  size="small"
                />
              )}
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Summary Cards */}
      {badge && !loading && (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={6} sm={3}>
            <Card>
              <CardContent sx={{ textAlign: 'center', py: 1.5 }}>
                <SpeedIcon color="primary" />
                <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                  {badge.totalChecks}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Total Checks
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Card>
              <CardContent sx={{ textAlign: 'center', py: 1.5 }}>
                <PassedIcon color="success" />
                <Typography variant="h4" sx={{ fontWeight: 'bold', color: 'success.main' }}>
                  {badge.passedChecks}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Passed
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Card>
              <CardContent sx={{ textAlign: 'center', py: 1.5 }}>
                <FailedIcon color="error" />
                <Typography variant="h4" sx={{ fontWeight: 'bold', color: 'error.main' }}>
                  {badge.failedChecks}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Failed
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Card>
              <CardContent sx={{ textAlign: 'center', py: 1.5 }}>
                <TimerIcon color="action" />
                <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                  {badge.passRate}%
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Pass Rate
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {loading && !badge && (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          {[0, 1, 2, 3].map((i) => (
            <Grid item xs={6} sm={3} key={i}>
              <Skeleton variant="rounded" height={100} />
            </Grid>
          ))}
        </Grid>
      )}

      {/* Run History */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">Run History</Typography>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <ToggleButtonGroup
            value={scope}
            exclusive
            onChange={(_e, val) => { if (val) setScope(val); }}
            size="small"
            data-testid="scope-toggle"
          >
            <ToggleButton value="global">Global</ToggleButton>
            <ToggleButton value="tenant">Tenant</ToggleButton>
          </ToggleButtonGroup>
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel>Suite</InputLabel>
            <Select
              value={suiteFilter}
              label="Suite"
              onChange={(e) => setSuiteFilter(e.target.value)}
            >
              <MenuItem value="">All</MenuItem>
              <MenuItem value="TIER1">Tier-1</MenuItem>
              <MenuItem value="NIGHTLY">Nightly</MenuItem>
              <MenuItem value="MANUAL">Manual</MenuItem>
            </Select>
          </FormControl>
        </Box>
      </Box>

      {loading && runs.length === 0 ? (
        <Box>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} variant="rounded" height={56} sx={{ mb: 1 }} />
          ))}
        </Box>
      ) : runs.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }} data-testid="empty-runs">
          <Typography color="text.secondary">
            No platform health runs recorded yet.
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Runs are automatically ingested from CI after Tier-1 smoke tests complete.
          </Typography>
        </Paper>
      ) : (
        <TableContainer component={Paper}>
          <Table size="small" data-testid="runs-table">
            <TableHead>
              <TableRow>
                <TableCell width={40} />
                <TableCell>Status</TableCell>
                <TableCell>Suite</TableCell>
                <TableCell align="right">Passed</TableCell>
                <TableCell align="right">Failed</TableCell>
                <TableCell align="right">Duration</TableCell>
                <TableCell>Triggered By</TableCell>
                <TableCell>Started</TableCell>
                <TableCell>Git</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {runs.map((run) => (
                <React.Fragment key={run.id}>
                  <TableRow
                    hover
                    sx={{ cursor: 'pointer', '& > *': { borderBottom: expandedRunId === run.id ? 'none' : undefined } }}
                    onClick={() => toggleExpand(run.id)}
                    data-testid={`run-row-${run.id}`}
                  >
                    <TableCell>
                      <IconButton size="small">
                        {expandedRunId === run.id ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                      </IconButton>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={run.status}
                        color={statusColor(run.status)}
                        size="small"
                        variant="filled"
                      />
                    </TableCell>
                    <TableCell>
                      <Chip label={run.suite} size="small" variant="outlined" />
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" color="success.main" sx={{ fontWeight: 'bold' }}>
                        {run.passedChecks}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography
                        variant="body2"
                        color={run.failedChecks > 0 ? 'error.main' : 'text.secondary'}
                        sx={{ fontWeight: run.failedChecks > 0 ? 'bold' : 'normal' }}
                      >
                        {run.failedChecks}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2">{formatDuration(run.durationMs)}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{run.triggeredBy}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{formatTime(run.startedAt)}</Typography>
                    </TableCell>
                    <TableCell>
                      {run.gitSha && (
                        <Tooltip title={run.gitRef || run.gitSha}>
                          <Chip
                            icon={<GitIcon />}
                            label={run.gitSha.substring(0, 7)}
                            size="small"
                            variant="outlined"
                            sx={{ fontFamily: 'monospace' }}
                          />
                        </Tooltip>
                      )}
                    </TableCell>
                  </TableRow>

                  {/* Expanded Row - Check Details */}
                  <TableRow>
                    <TableCell colSpan={9} sx={{ p: 0 }}>
                      <Collapse in={expandedRunId === run.id} unmountOnExit>
                        <Box sx={{ p: 2, bgcolor: 'grey.50' }}>
                          {checksLoading === run.id ? (
                            <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                              <CircularProgress size={24} />
                            </Box>
                          ) : (
                            <>
                              {/* Progress bar */}
                              <Box sx={{ mb: 2 }}>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                                  <Typography variant="caption" color="text.secondary">
                                    {run.passedChecks}/{run.totalChecks} checks passed
                                  </Typography>
                                  <FormControl size="small" sx={{ minWidth: 120 }}>
                                    <Select
                                      value={checkFilter}
                                      onChange={(e) => setCheckFilter(e.target.value)}
                                      size="small"
                                      variant="standard"
                                      sx={{ fontSize: '0.75rem' }}
                                    >
                                      <MenuItem value="all">All checks</MenuItem>
                                      <MenuItem value="FAILED">Failed only</MenuItem>
                                      <MenuItem value="PASSED">Passed only</MenuItem>
                                    </Select>
                                  </FormControl>
                                </Box>
                                <LinearProgress
                                  variant="determinate"
                                  value={run.totalChecks > 0 ? (run.passedChecks / run.totalChecks) * 100 : 0}
                                  color={run.failedChecks > 0 ? 'error' : 'success'}
                                  sx={{ height: 6, borderRadius: 3 }}
                                />
                              </Box>

                              {/* Check results table */}
                              <TableContainer>
                                <Table size="small">
                                  <TableHead>
                                    <TableRow>
                                      <TableCell>Status</TableCell>
                                      <TableCell>Module</TableCell>
                                      <TableCell>Check</TableCell>
                                      <TableCell align="right">Duration</TableCell>
                                      <TableCell align="right">HTTP</TableCell>
                                      <TableCell>Error</TableCell>
                                    </TableRow>
                                  </TableHead>
                                  <TableBody>
                                    {filteredChecks(run.id).length === 0 ? (
                                      <TableRow>
                                        <TableCell colSpan={6} align="center">
                                          <Typography variant="body2" color="text.secondary">
                                            No checks match the current filter
                                          </Typography>
                                        </TableCell>
                                      </TableRow>
                                    ) : (
                                      filteredChecks(run.id).map((check) => (
                                        <TableRow key={check.id}>
                                          <TableCell>{statusIcon(check.status)}</TableCell>
                                          <TableCell>
                                            <Chip label={check.module} size="small" variant="outlined" />
                                          </TableCell>
                                          <TableCell>
                                            <Typography variant="body2">{check.checkName}</Typography>
                                            {check.requestUrl && (
                                              <Typography
                                                variant="caption"
                                                color="text.secondary"
                                                sx={{ fontFamily: 'monospace', display: 'block' }}
                                              >
                                                {check.requestUrl}
                                              </Typography>
                                            )}
                                          </TableCell>
                                          <TableCell align="right">
                                            <Typography variant="body2">
                                              {formatDuration(check.durationMs)}
                                            </Typography>
                                          </TableCell>
                                          <TableCell align="right">
                                            {check.httpStatus && (
                                              <Chip
                                                label={check.httpStatus}
                                                size="small"
                                                color={
                                                  check.httpStatus >= 200 && check.httpStatus < 300
                                                    ? 'success'
                                                    : check.httpStatus >= 400
                                                      ? 'error'
                                                      : 'default'
                                                }
                                                variant="outlined"
                                                sx={{ fontFamily: 'monospace', minWidth: 48 }}
                                              />
                                            )}
                                          </TableCell>
                                          <TableCell>
                                            {check.errorMessage && (
                                              <Typography
                                                variant="caption"
                                                color="error"
                                                sx={{
                                                  display: 'block',
                                                  maxWidth: 300,
                                                  overflow: 'hidden',
                                                  textOverflow: 'ellipsis',
                                                  whiteSpace: 'nowrap',
                                                }}
                                                title={check.errorMessage}
                                              >
                                                {check.errorMessage}
                                              </Typography>
                                            )}
                                          </TableCell>
                                        </TableRow>
                                      ))
                                    )}
                                  </TableBody>
                                </Table>
                              </TableContainer>
                            </>
                          )}
                        </Box>
                      </Collapse>
                    </TableCell>
                  </TableRow>
                </React.Fragment>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
};

export default AdminPlatformHealth;
