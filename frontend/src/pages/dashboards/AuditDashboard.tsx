import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Grid,
  Alert,
  CircularProgress,
} from '@mui/material';
import {
  Assessment as AuditIcon,
  Warning as WarningIcon,
  CheckCircle as CheckIcon,
  Schedule as ScheduleIcon,
} from '@mui/icons-material';
import {
  DashboardCard,
  MetricCard,
  Heatmap,
  PipelineChart,
  StackedBarChart,
  BarList,
  FilterBar,
} from '../../components/dashboard';
import { grcDashboardApi, AuditOverviewData } from '../../services/grcClient';

const SEVERITY_COLORS = {
  critical: '#d32f2f',
  high: '#f57c00',
  medium: '#fbc02d',
  low: '#4caf50',
};

const AuditDashboard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AuditOverviewData | null>(null);
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [department, setDepartment] = useState<string>('');
  const [departments, setDepartments] = useState<string[]>([]);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [overviewData, filtersData] = await Promise.all([
        grcDashboardApi.getAuditOverview({
          from: dateFrom || undefined,
          to: dateTo || undefined,
          department: department || undefined,
        }),
        grcDashboardApi.getFilters(),
      ]);
      
      setData(overviewData);
      setDepartments(filtersData.departments || []);
    } catch (err) {
      setError('Failed to load audit dashboard data');
      console.error('Error fetching audit dashboard:', err);
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, department]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleReset = () => {
    setDateFrom('');
    setDateTo('');
    setDepartment('');
  };

  if (loading && !data) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  const pipelineData = data ? [
    { name: 'Draft', value: data.auditPipeline.draft, color: '#90caf9' },
    { name: 'Planned', value: data.auditPipeline.planned, color: '#64b5f6' },
    { name: 'Fieldwork', value: data.auditPipeline.fieldwork, color: '#42a5f5' },
    { name: 'Reporting', value: data.auditPipeline.reporting, color: '#2196f3' },
    { name: 'Final', value: data.auditPipeline.final, color: '#1e88e5' },
    { name: 'Closed', value: data.auditPipeline.closed, color: '#1565c0' },
  ] : [];

  const heatmapData = data?.findingsByDepartment.map(dept => ({
    rowLabel: dept.department,
    cells: [
      { label: 'Critical', value: dept.critical, color: dept.critical > 0 ? SEVERITY_COLORS.critical : undefined },
      { label: 'High', value: dept.high, color: dept.high > 0 ? SEVERITY_COLORS.high : undefined },
      { label: 'Medium', value: dept.medium, color: dept.medium > 0 ? SEVERITY_COLORS.medium : undefined },
      { label: 'Low', value: dept.low, color: dept.low > 0 ? SEVERITY_COLORS.low : undefined },
    ],
  })) || [];

  const topRiskAreasData = data?.topRiskAreas.map(risk => ({
    label: risk.riskTitle,
    value: risk.relatedFindings,
    color: SEVERITY_COLORS[risk.maxSeverity as keyof typeof SEVERITY_COLORS] || '#1976d2',
  })) || [];

  const calendarBars = [
    { dataKey: 'planned', name: 'Planned', color: '#64b5f6', stackId: 'stack' },
    { dataKey: 'fieldwork', name: 'Fieldwork', color: '#42a5f5', stackId: 'stack' },
    { dataKey: 'reporting', name: 'Reporting', color: '#2196f3', stackId: 'stack' },
    { dataKey: 'closed', name: 'Closed', color: '#1565c0', stackId: 'stack' },
  ];

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Audit Dashboard
      </Typography>
      <Typography variant="body1" color="textSecondary" sx={{ mb: 3 }}>
        Monitor audit pipeline, findings, and CAPA performance across the organization.
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
        filters={[
          {
            name: 'department',
            label: 'Department',
            value: department,
            options: departments.map(d => ({ value: d, label: d })),
            onChange: setDepartment,
          },
        ]}
        onRefresh={fetchData}
        onReset={handleReset}
      />

      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Total CAPAs"
            value={data?.capaPerformance.total || 0}
            icon={<AuditIcon />}
            color="#1976d2"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Open CAPAs"
            value={data?.capaPerformance.open || 0}
            icon={<ScheduleIcon />}
            color="#ff9800"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Overdue CAPAs"
            value={data?.capaPerformance.overdue || 0}
            icon={<WarningIcon />}
            color="#f44336"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Validated Rate"
            value={`${((data?.capaPerformance.validatedRate || 0) * 100).toFixed(0)}%`}
            subtitle={`Avg closure: ${data?.capaPerformance.avgClosureDays || 0} days`}
            icon={<CheckIcon />}
            color="#4caf50"
          />
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <DashboardCard title="Audit Pipeline" subtitle="Current status of all audits">
            <PipelineChart data={pipelineData} layout="vertical" height={250} />
          </DashboardCard>
        </Grid>

        <Grid item xs={12} md={6}>
          <DashboardCard title="Findings by Department" subtitle="Severity breakdown per department">
            {heatmapData.length > 0 ? (
              <Heatmap
                data={heatmapData}
                columnLabels={['Critical', 'High', 'Medium', 'Low']}
              />
            ) : (
              <Box display="flex" justifyContent="center" alignItems="center" height={200}>
                <Typography color="textSecondary">No findings data available</Typography>
              </Box>
            )}
          </DashboardCard>
        </Grid>

        <Grid item xs={12} md={6}>
          <DashboardCard title="Top Risk Areas" subtitle="Risks with most related findings">
            {topRiskAreasData.length > 0 ? (
              <BarList items={topRiskAreasData} />
            ) : (
              <Box display="flex" justifyContent="center" alignItems="center" height={200}>
                <Typography color="textSecondary">No risk data available</Typography>
              </Box>
            )}
          </DashboardCard>
        </Grid>

        <Grid item xs={12} md={6}>
          <DashboardCard title="Audit Calendar" subtitle="12-month audit activity">
            {data?.auditCalendar && data.auditCalendar.length > 0 ? (
              <StackedBarChart
                data={data.auditCalendar}
                xAxisKey="month"
                bars={calendarBars}
                height={250}
              />
            ) : (
              <Box display="flex" justifyContent="center" alignItems="center" height={200}>
                <Typography color="textSecondary">No calendar data available</Typography>
              </Box>
            )}
          </DashboardCard>
        </Grid>
      </Grid>
    </Box>
  );
};

export default AuditDashboard;
