import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Paper,
  CircularProgress,
  Alert,
} from '@mui/material';
import {
  Security as SecurityIcon,
  Gavel as ComplianceIcon,
  AccountBalance as GovernanceIcon,
  People as PeopleIcon,
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
import { api } from '../services/api';

interface DashboardStats {
  risks: {
    total: number;
    open: number;
    high: number;
    overdue: number;
  };
  compliance: {
    total: number;
    pending: number;
    completed: number;
    overdue: number;
  };
  policies: {
    total: number;
    active: number;
    draft: number;
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
}> = ({ title, value, icon, color, subtitle }) => (
  <Card>
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
  </Card>
);

export const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [riskTrends, setRiskTrends] = useState([]);
  const [complianceData, setComplianceData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const [overviewRes, trendsRes, complianceRes] = await Promise.all([
          api.get('/dashboard/overview'),
          api.get('/dashboard/risk-trends'),
          api.get('/dashboard/compliance-by-regulation'),
        ]);

        setStats(overviewRes.data);
        setRiskTrends(trendsRes.data);
        setComplianceData(complianceRes.data);
      } catch (err: any) {
        setError(err.response?.data?.message || 'Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return <Alert severity="error">{error}</Alert>;
  }

  if (!stats) {
    return <Alert severity="warning">No data available</Alert>;
  }

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'];

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Dashboard Overview
      </Typography>

      <Grid container spacing={3}>
        {/* Statistics Cards */}
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Total Risks"
            value={stats.risks.total}
            icon={<SecurityIcon sx={{ color: 'white' }} />}
            color="#f44336"
            subtitle={`${stats.risks.open} open, ${stats.risks.high} high severity`}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Compliance Items"
            value={stats.compliance.total}
            icon={<ComplianceIcon sx={{ color: 'white' }} />}
            color="#2196f3"
            subtitle={`${stats.compliance.pending} pending, ${stats.compliance.overdue} overdue`}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Policies"
            value={stats.policies.total}
            icon={<GovernanceIcon sx={{ color: 'white' }} />}
            color="#4caf50"
            subtitle={`${stats.policies.active} active, ${stats.policies.draft} draft`}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Users"
            value={stats.users.total}
            icon={<PeopleIcon sx={{ color: 'white' }} />}
            color="#ff9800"
            subtitle={`${stats.users.admins} admins, ${stats.users.managers} managers`}
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
        <Grid item xs={12}>
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
      </Grid>
    </Box>
  );
};
