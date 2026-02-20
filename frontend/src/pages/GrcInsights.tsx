import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Grid,
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
  Chip,
  Button,
} from '@mui/material';
import {
  Warning as IssueIcon,
  Assignment as CapaIcon,
  Cancel as FailIcon,
  Description as EvidenceIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { grcInsightsApi, GrcInsightsOverview } from '../services/grcClient';

const GrcInsights: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const tenantId = user?.tenantId || '';
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<GrcInsightsOverview | null>(null);

  const fetchData = useCallback(async () => {
    if (!tenantId) return;

    try {
      setLoading(true);
      setError(null);
      const overview = await grcInsightsApi.getOverview(tenantId);
      setData(overview);
    } catch (err) {
      setError('Failed to load GRC insights data');
      console.error('Error fetching GRC insights:', err);
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const getSeverityColor = (severity: string): 'error' | 'warning' | 'info' | 'success' => {
    switch (severity) {
      case 'CRITICAL':
        return 'error';
      case 'HIGH':
        return 'warning';
      case 'MEDIUM':
        return 'info';
      case 'LOW':
        return 'success';
      default:
        return 'info';
    }
  };

  if (loading && !data) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }} data-testid="grc-insights-page">
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h4" gutterBottom>
            GRC Insights
          </Typography>
          <Typography variant="body1" color="textSecondary">
            Overview of open issues, overdue CAPAs, and recent test failures.
          </Typography>
        </Box>
        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={fetchData}
          disabled={loading}
          data-testid="refresh-insights-btn"
        >
          Refresh
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} data-testid="insights-error">
          {error}
        </Alert>
      )}

      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card data-testid="total-issues-card">
            <CardContent>
              <Box display="flex" alignItems="center" mb={1}>
                <IssueIcon color="warning" sx={{ mr: 1 }} />
                <Typography variant="subtitle2" color="textSecondary">
                  Open Issues
                </Typography>
              </Box>
              <Typography variant="h3" component="div">
                {data?.summary.totalOpenIssues ?? 0}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Across all severities
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card data-testid="overdue-capas-card">
            <CardContent>
              <Box display="flex" alignItems="center" mb={1}>
                <CapaIcon color="error" sx={{ mr: 1 }} />
                <Typography variant="subtitle2" color="textSecondary">
                  Overdue CAPAs
                </Typography>
              </Box>
              <Typography variant="h3" component="div" color={data?.overdueCAPAsCount ? 'error.main' : 'inherit'}>
                {data?.overdueCAPAsCount ?? 0}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Past due date
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card data-testid="failed-tests-card">
            <CardContent>
              <Box display="flex" alignItems="center" mb={1}>
                <FailIcon color="error" sx={{ mr: 1 }} />
                <Typography variant="subtitle2" color="textSecondary">
                  Recent Failures
                </Typography>
              </Box>
              <Typography variant="h3" component="div">
                {data?.summary.totalFailedTests ?? 0}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Failed test results
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card data-testid="evidence-stats-card">
            <CardContent>
              <Box display="flex" alignItems="center" mb={1}>
                <EvidenceIcon color="primary" sx={{ mr: 1 }} />
                <Typography variant="subtitle2" color="textSecondary">
                  Evidence
                </Typography>
              </Box>
              <Typography variant="h3" component="div">
                {data?.evidenceStats.total ?? 0}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                {data?.evidenceStats.linked ?? 0} linked, {data?.evidenceStats.unlinked ?? 0} unlinked
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Card data-testid="issues-by-severity-card">
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Open Issues by Severity
              </Typography>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Severity</TableCell>
                      <TableCell align="right">Count</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const).map((severity) => (
                      <TableRow
                        key={severity}
                        hover
                        sx={{ cursor: 'pointer' }}
                        onClick={() => navigate(`/issues?severity=${severity}`)}
                        data-testid={`severity-row-${severity.toLowerCase()}`}
                      >
                        <TableCell>
                          <Chip
                            label={severity}
                            color={getSeverityColor(severity)}
                            size="small"
                          />
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="body1" fontWeight="medium">
                            {data?.openIssuesBySeverity[severity] ?? 0}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card data-testid="recent-failures-card">
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Recent Failed Test Results
              </Typography>
              {data?.recentFailTestResults && data.recentFailTestResults.length > 0 ? (
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Test Result</TableCell>
                        <TableCell>Control Test</TableCell>
                        <TableCell align="right">Date</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {data.recentFailTestResults.slice(0, 5).map((result) => (
                        <TableRow
                          key={result.id}
                          hover
                          sx={{ cursor: 'pointer' }}
                          onClick={() => navigate(`/test-results/${result.id}`)}
                          data-testid={`fail-result-row-${result.id}`}
                        >
                          <TableCell>
                            <Typography variant="body2" noWrap sx={{ maxWidth: 200 }}>
                              {result.name}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" color="textSecondary" noWrap sx={{ maxWidth: 150 }}>
                              {result.controlTestName || '-'}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            <Typography variant="body2" color="textSecondary">
                              {result.testedAt
                                ? new Date(result.testedAt).toLocaleDateString()
                                : '-'}
                            </Typography>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              ) : (
                <Box
                  display="flex"
                  justifyContent="center"
                  alignItems="center"
                  height={150}
                  data-testid="no-failures-message"
                >
                  <Typography color="textSecondary">
                    No recent failed test results
                  </Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default GrcInsights;
