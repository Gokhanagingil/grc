import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Grid,
  Alert,
  CircularProgress,
} from '@mui/material';
import {
  TrendingUp as ScoreIcon,
  Repeat as RepeatIcon,
  Policy as PolicyIcon,
  BubbleChart as ClusterIcon,
} from '@mui/icons-material';
import {
  DashboardCard,
  MetricCard,
  RadarChart,
  BarList,
  StackedBarChart,
  FilterBar,
} from '../../components/dashboard';
import { grcDashboardApi, GrcHealthData } from '../../services/grcClient';

const GrcHealthDashboard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<GrcHealthData | null>(null);
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const healthData = await grcDashboardApi.getGrcHealth({
        from: dateFrom || undefined,
        to: dateTo || undefined,
      });
      
      setData(healthData);
    } catch (err) {
      setError('Failed to load GRC health dashboard data');
      console.error('Error fetching GRC health dashboard:', err);
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleReset = () => {
    setDateFrom('');
    setDateTo('');
  };

  if (loading && !data) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  const avgScore = data?.departmentScores.length
    ? data.departmentScores.reduce((sum, d) => sum + d.score, 0) / data.departmentScores.length
    : 0;

  const totalRepeatedFindings = data?.repeatedFindings.reduce((sum, f) => sum + f.count, 0) || 0;

  const avgPolicyCompliance = data?.policyCompliance.length
    ? data.policyCompliance.reduce((sum, p) => sum + p.acknowledgedRate, 0) / data.policyCompliance.length
    : 0;

  const totalHighRisks = data?.riskClusters.reduce((sum, c) => sum + c.highRisks, 0) || 0;

  const radarData = data?.departmentScores.map(dept => ({
    department: dept.department,
    'Audit Score': dept.auditScore,
    'Risk Score': dept.riskScore,
    'Policy Score': dept.policyScore,
    'CAPA Score': dept.capaScore,
  })) || [];

  const radarSeries = [
    { dataKey: 'Audit Score', name: 'Audit', color: '#1976d2' },
    { dataKey: 'Risk Score', name: 'Risk', color: '#f57c00' },
    { dataKey: 'Policy Score', name: 'Policy', color: '#4caf50' },
    { dataKey: 'CAPA Score', name: 'CAPA', color: '#9c27b0' },
  ];

  const repeatedFindingsData = data?.repeatedFindings.map(finding => ({
    label: finding.theme,
    value: finding.count,
    color: finding.count > 5 ? '#f44336' : finding.count > 3 ? '#ff9800' : '#4caf50',
  })) || [];

  const policyComplianceData = data?.policyCompliance.map(policy => ({
    label: policy.policyTitle,
    value: Math.round(policy.acknowledgedRate * 100),
    color: policy.acknowledgedRate >= 0.9 ? '#4caf50' : policy.acknowledgedRate >= 0.7 ? '#ff9800' : '#f44336',
  })) || [];

  const riskClusterBars = [
    { dataKey: 'openFindings', name: 'Open Findings', color: '#f57c00' },
    { dataKey: 'highRisks', name: 'High Risks', color: '#d32f2f' },
  ];

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        GRC Health Overview
      </Typography>
      <Typography variant="body1" color="textSecondary" sx={{ mb: 3 }}>
        Organization-level insights into governance, risk, and compliance health.
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <FilterBar
        dateFrom={dateFrom}
        dateTo={dateTo}
        onDateFromChange={setDateFrom}
        onDateToChange={setDateTo}
        onRefresh={fetchData}
        onReset={handleReset}
      />

      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Avg GRC Score"
            value={`${(avgScore * 100).toFixed(0)}%`}
            subtitle={`${data?.departmentScores.length || 0} departments`}
            icon={<ScoreIcon />}
            color="#1976d2"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Repeated Findings"
            value={totalRepeatedFindings}
            subtitle={`${data?.repeatedFindings.length || 0} themes`}
            icon={<RepeatIcon />}
            color="#f57c00"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Policy Compliance"
            value={`${(avgPolicyCompliance * 100).toFixed(0)}%`}
            subtitle={`${data?.policyCompliance.length || 0} policies`}
            icon={<PolicyIcon />}
            color="#4caf50"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="High Risk Clusters"
            value={totalHighRisks}
            subtitle={`${data?.riskClusters.length || 0} clusters`}
            icon={<ClusterIcon />}
            color="#d32f2f"
          />
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <DashboardCard title="Department GRC Scores" subtitle="Score breakdown by category">
            {radarData.length > 0 ? (
              <RadarChart
                data={radarData}
                nameKey="department"
                series={radarSeries}
                height={300}
              />
            ) : (
              <Box display="flex" justifyContent="center" alignItems="center" height={200}>
                <Typography color="textSecondary">No department score data available</Typography>
              </Box>
            )}
          </DashboardCard>
        </Grid>

        <Grid item xs={12} md={6}>
          <DashboardCard title="Repeated Findings" subtitle="Common finding themes across audits">
            {repeatedFindingsData.length > 0 ? (
              <BarList items={repeatedFindingsData} />
            ) : (
              <Box display="flex" justifyContent="center" alignItems="center" height={200}>
                <Typography color="textSecondary">No repeated findings data available</Typography>
              </Box>
            )}
          </DashboardCard>
        </Grid>

        <Grid item xs={12} md={6}>
          <DashboardCard title="Policy Compliance" subtitle="Acknowledgment rates by policy">
            {policyComplianceData.length > 0 ? (
              <BarList
                items={policyComplianceData}
                maxValue={100}
                valueFormatter={(v) => `${v}%`}
              />
            ) : (
              <Box display="flex" justifyContent="center" alignItems="center" height={200}>
                <Typography color="textSecondary">No policy compliance data available</Typography>
              </Box>
            )}
          </DashboardCard>
        </Grid>

        <Grid item xs={12} md={6}>
          <DashboardCard title="Risk Clusters" subtitle="Open findings and high risks by cluster">
            {data?.riskClusters && data.riskClusters.length > 0 ? (
              <StackedBarChart
                data={data.riskClusters}
                xAxisKey="cluster"
                bars={riskClusterBars}
                height={280}
              />
            ) : (
              <Box display="flex" justifyContent="center" alignItems="center" height={200}>
                <Typography color="textSecondary">No risk cluster data available</Typography>
              </Box>
            )}
          </DashboardCard>
        </Grid>
      </Grid>
    </Box>
  );
};

export default GrcHealthDashboard;
