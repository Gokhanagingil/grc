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
import { dashboardApi, RiskTrendDataPoint, ComplianceByRegulationItem } from '../services/grcClient';
import { useAuth } from '../contexts/AuthContext';
import { LoadingState, ErrorState } from '../components/common';

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

  // Get tenant ID from user context
  const tenantId = user?.tenantId || '';

  // Navigation handlers for clickable dashboard metrics
  const handleNavigateToRisks = () => navigate('/risk', { state: { source: 'dashboard' } });
  const handleNavigateToCompliance = () => navigate('/compliance', { state: { source: 'dashboard' } });
  const handleNavigateToPolicies = () => navigate('/governance', { state: { source: 'dashboard' } });
  const handleNavigateToIncidents = () => navigate('/incidents', { state: { source: 'dashboard' } });

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      
      // Fetch all dashboard data in parallel from dedicated NestJS endpoints
      const [overview, trends, complianceByReg] = await Promise.all([
        dashboardApi.getOverview(tenantId),
        dashboardApi.getRiskTrends(tenantId),
        dashboardApi.getComplianceByRegulation(tenantId),
      ]);
      
      setStats(overview);
      setRiskTrends(trends);
      setComplianceData(complianceByReg);
    } catch (err: unknown) {
      const error = err as { response?: { status?: number; data?: { message?: string; error?: { message?: string } } } };
      const status = error.response?.status;
      const message = error.response?.data?.error?.message || error.response?.data?.message;
      
      if (status === 401) {
        setError('Session expired. Please login again.');
      } else if (status === 403) {
        setError('You do not have permission to view the dashboard.');
      } else if (status === 404 || status === 502) {
        // Graceful degradation: show empty data instead of error
        setStats({
          risks: { total: 0, open: 0, high: 0, overdue: 0 },
          compliance: { total: 0, pending: 0, completed: 0, overdue: 0 },
          policies: { total: 0, active: 0, draft: 0 },
          users: { total: 0, admins: 0, managers: 0 },
        });
        setRiskTrends([]);
        setComplianceData([]);
        console.warn('Dashboard backend not available');
      } else {
        setError(message || 'Failed to load dashboard data. Please try again.');
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
      />
    );
  }

  if (!stats) {
    return (
      <ErrorState
        title="No data available"
        message="Dashboard data could not be loaded. Please try again."
        onRetry={fetchDashboardData}
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

        {/* Compliance Status */}
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Compliance Status
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
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {[
                    { name: 'Completed', value: stats.compliance.completed },
                    { name: 'Pending', value: stats.compliance.pending },
                    { name: 'Overdue', value: stats.compliance.overdue },
                  ].map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
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

        {/* Top 5 Open Risks */}
        {stats.risks.top5OpenRisks && stats.risks.top5OpenRisks.length > 0 && (
          <Grid item xs={12}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="h6" gutterBottom>
                Top 5 Open Risks
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {stats.risks.top5OpenRisks.map((risk, index) => (
                  <Box
                    key={risk.id}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      p: 1,
                      bgcolor: index % 2 === 0 ? '#f5f5f5' : 'white',
                      borderRadius: 1,
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Typography variant="body2" color="textSecondary">
                        #{index + 1}
                      </Typography>
                      <Typography variant="body1">{risk.title}</Typography>
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
