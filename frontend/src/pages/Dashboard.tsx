import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Grid,
  Card,
  CardContent,
  CardActionArea,
  Typography,
  Paper,
} from '@mui/material';
import {
  Security as SecurityIcon,
  Gavel as ComplianceIcon,
  AccountBalance as GovernanceIcon,
  Warning as IncidentIcon,
} from '@mui/icons-material';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { dashboardApi, RiskTrendDataPoint, ComplianceByRegulationItem, API_PATHS } from '../services/grcClient';
import { useAuth } from '../contexts/AuthContext';
import { LoadingState, ErrorState } from '../components/common';
import { getApiBaseUrl } from '../config';

interface DashboardStats {
  risks: {
    total: number;
    open: number;
    high: number;
    overdue: number;
    top5OpenRisks?: Array<{
      id: string;
      title: string;
      severity: string;
      score: number | null;
    }>;
  };
  compliance: {
    total: number;
    pending: number;
    completed: number;
    overdue: number;
    coveragePercentage?: number;
  };
  policies: {
    total: number;
    active: number;
    draft: number;
    coveragePercentage?: number;
  };
  incidents?: {
    total: number;
    open: number;
    closed: number;
    resolved: number;
    resolvedToday?: number;
    avgResolutionTimeHours?: number | null;
  };
  users: {
    total: number;
    admins: number;
    managers: number;
  };
}

const StatCard: React.FC<{
  title: string;
  value: number;
  icon: React.ReactNode;
  color: string;
  subtitle?: string;
  onClick?: () => void;
}> = ({ title, value, icon, color, subtitle, onClick }) => {
  const cardContent = (
    <CardContent>
      <Box display="flex" alignItems="center" justifyContent="space-between">
        <Box>
          <Typography color="textSecondary" gutterBottom variant="h6">
            {title}
          </Typography>
          <Typography variant="h4" component="h2">
            {value}
          </Typography>
          {subtitle && (
            <Typography color="textSecondary" variant="body2">
              {subtitle}
            </Typography>
          )}
        </Box>
        <Box
          sx={{
            backgroundColor: color,
            borderRadius: '50%',
            p: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {icon}
        </Box>
      </Box>
    </CardContent>
  );

  if (onClick) {
    return (
      <Card sx={{ cursor: 'pointer', '&:hover': { boxShadow: 4 } }}>
        <CardActionArea onClick={onClick}>
          {cardContent}
        </CardActionArea>
      </Card>
    );
  }

  return <Card>{cardContent}</Card>;
};

export const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [riskTrends, setRiskTrends] = useState<RiskTrendDataPoint[]>([]);
  const [complianceData, setComplianceData] = useState<ComplianceByRegulationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [errorStatusCode, setErrorStatusCode] = useState<number | undefined>();
  const [errorEndpoint, setErrorEndpoint] = useState<string | undefined>();
  const [diagnosticHint, setDiagnosticHint] = useState<string | undefined>();

  // Get tenant ID from user context
  const tenantId = user?.tenantId || '';

  // Navigation handlers for clickable dashboard metrics
  const handleNavigateToRisks = () => navigate('/risk', { state: { source: 'dashboard' } });
  const handleNavigateToCompliance = () => navigate('/compliance', { state: { source: 'dashboard' } });
  const handleNavigateToPolicies = () => navigate('/governance', { state: { source: 'dashboard' } });
  const handleNavigateToIncidents = () => navigate('/incidents', { state: { source: 'dashboard' } });

  // Drill-down navigation for charts
  const handleComplianceStatusClick = (status: string) => {
    const statusMap: Record<string, string> = {
      'Completed': 'compliant',
      'Pending': 'in_progress',
      'Overdue': 'non_compliant',
    };
    const filterStatus = statusMap[status] || status.toLowerCase();
    navigate(`/compliance?status=${filterStatus}`, { state: { source: 'dashboard', filter: status } });
  };

  const handleTopRiskClick = (riskId: string) => {
    navigate(`/risk/${riskId}`, { state: { source: 'dashboard' } });
  };

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      setErrorStatusCode(undefined);
      setErrorEndpoint(undefined);
      setDiagnosticHint(undefined);
      
      // Diagnostics logging
      const apiBaseUrl = getApiBaseUrl();
      const endpoints = [
        API_PATHS.DASHBOARD.OVERVIEW,
        API_PATHS.DASHBOARD.RISK_TRENDS,
        API_PATHS.DASHBOARD.COMPLIANCE_BY_REGULATION,
      ];
      
      console.log('[Dashboard Diagnostics] Loading dashboard data:', {
        apiBaseUrl,
        tenantId: tenantId || '(not set)',
        endpoints: endpoints.map(ep => `${apiBaseUrl}${ep}`),
        timestamp: new Date().toISOString(),
      });
      
      // Fetch all dashboard data in parallel from dedicated NestJS endpoints
      const [overview, trends, complianceByReg] = await Promise.all([
        dashboardApi.getOverview(tenantId),
        dashboardApi.getRiskTrends(tenantId),
        dashboardApi.getComplianceByRegulation(tenantId),
      ]);
      
      // Validate response shapes
      if (!overview || typeof overview !== 'object') {
        throw new Error('Invalid response: overview data is not an object');
      }
      if (!Array.isArray(trends)) {
        console.warn('[Dashboard] Risk trends is not an array, defaulting to empty array');
      }
      if (!Array.isArray(complianceByReg)) {
        console.warn('[Dashboard] Compliance data is not an array, defaulting to empty array');
      }
      
      // Ensure stats has required structure with null checks
      const safeStats: DashboardStats = {
        risks: overview.risks || { total: 0, open: 0, high: 0, overdue: 0 },
        compliance: overview.compliance || { total: 0, pending: 0, completed: 0, overdue: 0 },
        policies: overview.policies || { total: 0, active: 0, draft: 0 },
        incidents: overview.incidents || { total: 0, open: 0, closed: 0, resolved: 0 },
        users: overview.users || { total: 0, admins: 0, managers: 0 },
      };
      
      setStats(safeStats);
      setRiskTrends(Array.isArray(trends) ? trends : []);
      setComplianceData(Array.isArray(complianceByReg) ? complianceByReg : []);
    } catch (err: unknown) {
      console.error('[Dashboard] Error fetching dashboard data:', err);
      
      // Enhanced error handling
      const axiosError = err as {
        response?: {
          status?: number;
          statusText?: string;
          data?: unknown;
          headers?: Record<string, string>;
        };
        request?: unknown;
        message?: string;
        code?: string;
      };
      
      const status = axiosError.response?.status;
      const responseData = axiosError.response?.data;
      const contentType = axiosError.response?.headers?.['content-type'] || 
                         axiosError.response?.headers?.['Content-Type'] || '';
      
      // Detect HTML responses (proxy/API mismatch)
      const isHtmlResponse = typeof responseData === 'string' && 
                            (responseData.trim().startsWith('<!DOCTYPE') || 
                             responseData.trim().startsWith('<html') ||
                             contentType.includes('text/html'));
      
      // Determine endpoint from error if available
      let endpoint: string = API_PATHS.DASHBOARD.OVERVIEW;
      if (axiosError.message?.includes('risk-trends')) {
        endpoint = API_PATHS.DASHBOARD.RISK_TRENDS;
      } else if (axiosError.message?.includes('compliance-by-regulation')) {
        endpoint = API_PATHS.DASHBOARD.COMPLIANCE_BY_REGULATION;
      }
      
      setErrorStatusCode(status);
      setErrorEndpoint(`${getApiBaseUrl()}${endpoint}`);
      
      // Set diagnostic hint for HTML responses
      if (isHtmlResponse) {
        setDiagnosticHint('API base URL or proxy mismatch detected. The server returned HTML instead of JSON. Please check your API configuration.');
      }
      
      // Handle specific status codes
      if (status === 401) {
        setError('Session expired. Please login again.');
      } else if (status === 403) {
        setError('You do not have permission to view the dashboard.');
      } else if (status === 404) {
        setError(`Dashboard endpoint not found (404). The API endpoint may not be available.`);
        setDiagnosticHint('The dashboard API endpoint was not found. Please verify the backend service is running and the API base URL is correct.');
      } else if (status === 500) {
        setError('Internal server error (500). The server encountered an error while processing your request.');
        setDiagnosticHint('A server error occurred. Please check backend logs or contact support.');
      } else if (status === 502 || status === 503) {
        setError('Service unavailable. The backend service may be down or unreachable.');
        setDiagnosticHint('The backend service is not responding. Please check if the service is running.');
      } else if (isHtmlResponse) {
        setError('Invalid response format. The server returned HTML instead of JSON.');
      } else {
        const message: string = (responseData && typeof responseData === 'object' && 'error' in responseData)
          ? (responseData as { error?: { message?: string } }).error?.message || 'Failed to load dashboard data. Please try again.'
          : (responseData && typeof responseData === 'object' && 'message' in responseData)
          ? (responseData as { message?: string }).message || 'Failed to load dashboard data. Please try again.'
          : axiosError.message || 'Failed to load dashboard data. Please try again.';
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  if (loading) {
    return <LoadingState message="Loading dashboard..." />;
  }

  if (error) {
    return (
      <ErrorState
        title="Failed to load dashboard"
        message={error}
        onRetry={fetchDashboardData}
        statusCode={errorStatusCode}
        endpoint={errorEndpoint}
        diagnosticHint={diagnosticHint}
      />
    );
  }

  if (!stats) {
    return (
      <ErrorState
        title="No data available"
        message="Dashboard data could not be loaded. Please try again."
        onRetry={fetchDashboardData}
        statusCode={errorStatusCode}
        endpoint={errorEndpoint}
        diagnosticHint={diagnosticHint || 'The dashboard returned no data. This may indicate a backend issue or empty dataset.'}
      />
    );
  }

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'];

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Dashboard Overview
      </Typography>

      <Grid container spacing={3}>
        {/* Statistics Cards - Clickable for drill-down navigation */}
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Total Risks"
            value={stats.risks.total}
            icon={<SecurityIcon sx={{ color: 'white' }} />}
            color="#f44336"
            subtitle={`${stats.risks.open} open, ${stats.risks.high} high severity`}
            onClick={handleNavigateToRisks}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Compliance Items"
            value={stats.compliance.total}
            icon={<ComplianceIcon sx={{ color: 'white' }} />}
            color="#2196f3"
            subtitle={`${stats.compliance.pending} pending, ${stats.compliance.overdue} overdue`}
            onClick={handleNavigateToCompliance}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Policies"
            value={stats.policies.total}
            icon={<GovernanceIcon sx={{ color: 'white' }} />}
            color="#4caf50"
            subtitle={`${stats.policies.active} active, ${stats.policies.draft} draft`}
            onClick={handleNavigateToPolicies}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Incidents"
            value={stats.incidents?.total || 0}
            icon={<IncidentIcon sx={{ color: 'white' }} />}
            color="#ff9800"
            subtitle={`${stats.incidents?.open || 0} open, ${stats.incidents?.resolved || 0} resolved`}
            onClick={handleNavigateToIncidents}
          />
        </Grid>

        {/* Risk Trends Chart */}
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Risk Trends (Last 30 Days)
            </Typography>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={riskTrends}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="total_risks" stroke="#8884d8" name="Total Risks" />
                <Line type="monotone" dataKey="critical" stroke="#f44336" name="Critical" />
                <Line type="monotone" dataKey="high" stroke="#ff9800" name="High" />
                <Line type="monotone" dataKey="medium" stroke="#2196f3" name="Medium" />
                <Line type="monotone" dataKey="low" stroke="#4caf50" name="Low" />
              </LineChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>

        {/* Compliance Status - Clickable for drill-down */}
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Compliance Status
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
              Click a segment to view filtered list
            </Typography>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={[
                    { name: 'Completed', value: stats.compliance.completed },
                    { name: 'Pending', value: stats.compliance.pending },
                    { name: 'Overdue', value: stats.compliance.overdue },
                  ]}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }: { name?: string; percent?: number }) => `${name ?? ''} ${((percent ?? 0) * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                  onClick={(data) => data && data.name && handleComplianceStatusClick(data.name)}
                  style={{ cursor: 'pointer' }}
                >
                  {[
                    { name: 'Completed', value: stats.compliance.completed },
                    { name: 'Pending', value: stats.compliance.pending },
                    { name: 'Overdue', value: stats.compliance.overdue },
                  ].map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} style={{ cursor: 'pointer' }} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>

        {/* Compliance by Regulation */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Compliance by Regulation
            </Typography>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={complianceData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="regulation" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="completed" fill="#4caf50" name="Completed" />
                <Bar dataKey="pending" fill="#ff9800" name="Pending" />
                <Bar dataKey="overdue" fill="#f44336" name="Overdue" />
              </BarChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>

        {/* Coverage KPIs */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Coverage KPIs
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
              <Box>
                <Typography variant="body2" color="textSecondary">
                  Policy Coverage
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box sx={{ flexGrow: 1, bgcolor: '#e0e0e0', borderRadius: 1, height: 20 }}>
                    <Box
                      sx={{
                        width: `${stats.policies.coveragePercentage ?? 0}%`,
                        bgcolor: '#4caf50',
                        borderRadius: 1,
                        height: '100%',
                      }}
                    />
                  </Box>
                  <Typography variant="body1" fontWeight="bold">
                    {stats.policies.coveragePercentage?.toFixed(1) ?? 0}%
                  </Typography>
                </Box>
              </Box>
              <Box>
                <Typography variant="body2" color="textSecondary">
                  Requirement Compliance
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box sx={{ flexGrow: 1, bgcolor: '#e0e0e0', borderRadius: 1, height: 20 }}>
                    <Box
                      sx={{
                        width: `${stats.compliance.coveragePercentage ?? 0}%`,
                        bgcolor: '#2196f3',
                        borderRadius: 1,
                        height: '100%',
                      }}
                    />
                  </Box>
                  <Typography variant="body1" fontWeight="bold">
                    {stats.compliance.coveragePercentage?.toFixed(1) ?? 0}%
                  </Typography>
                </Box>
              </Box>
              {stats.incidents && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="body2" color="textSecondary">
                    Incident Resolution
                  </Typography>
                  <Typography variant="body1">
                    Resolved Today: <strong>{stats.incidents.resolvedToday ?? 0}</strong>
                  </Typography>
                  <Typography variant="body1">
                    Avg Resolution Time: <strong>
                      {stats.incidents.avgResolutionTimeHours != null
                        ? `${stats.incidents.avgResolutionTimeHours.toFixed(1)} hours`
                        : 'N/A'}
                    </strong>
                  </Typography>
                </Box>
              )}
            </Box>
          </Paper>
        </Grid>

        {/* Top 5 Open Risks - Clickable for drill-down */}
        {stats.risks.top5OpenRisks && stats.risks.top5OpenRisks.length > 0 && (
          <Grid item xs={12}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="h6" gutterBottom>
                Top 5 Open Risks
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                Click a risk to view details
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {stats.risks.top5OpenRisks.map((risk, index) => (
                  <Box
                    key={risk.id}
                    onClick={() => handleTopRiskClick(risk.id)}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      p: 1,
                      bgcolor: index % 2 === 0 ? '#f5f5f5' : 'white',
                      borderRadius: 1,
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      '&:hover': {
                        bgcolor: 'action.hover',
                        transform: 'translateX(4px)',
                      },
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Typography variant="body2" color="textSecondary">
                        #{index + 1}
                      </Typography>
                      <Typography 
                        variant="body1" 
                        sx={{ 
                          color: 'primary.main',
                          '&:hover': { textDecoration: 'underline' },
                        }}
                      >
                        {risk.title}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Typography
                        variant="body2"
                        sx={{
                          px: 1,
                          py: 0.5,
                          borderRadius: 1,
                          bgcolor:
                            risk.severity === 'critical'
                              ? '#f44336'
                              : risk.severity === 'high'
                              ? '#ff9800'
                              : risk.severity === 'medium'
                              ? '#2196f3'
                              : '#4caf50',
                          color: 'white',
                          textTransform: 'capitalize',
                        }}
                      >
                        {risk.severity}
                      </Typography>
                      <Typography variant="body2" fontWeight="bold">
                        Score: {risk.score ?? 'N/A'}
                      </Typography>
                    </Box>
                  </Box>
                ))}
              </Box>
            </Paper>
          </Grid>
        )}
      </Grid>
    </Box>
  );
};
