import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Grid,
  Alert,
  CircularProgress,
  Card,
  CardContent,
  LinearProgress,
} from '@mui/material';
import {
  CheckCircle as CompliantIcon,
  Warning as PartialIcon,
  Error as NonCompliantIcon,
  HelpOutline as NotAssessedIcon,
} from '@mui/icons-material';
import {
  DashboardCard,
  MetricCard,
  Heatmap,
  DonutChart,
  StackedBarChart,
  FilterBar,
} from '../../components/dashboard';
import { grcDashboardApi, ComplianceOverviewData } from '../../services/grcClient';

const SEVERITY_COLORS = {
  critical: '#d32f2f',
  high: '#f57c00',
  medium: '#fbc02d',
  low: '#4caf50',
};

const STATUS_COLORS = {
  compliant: '#4caf50',
  partiallyCompliant: '#ff9800',
  nonCompliant: '#f44336',
  notAssessed: '#9e9e9e',
};

const ComplianceDashboard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ComplianceOverviewData | null>(null);
  const [family, setFamily] = useState<string>('');
  const [version, setVersion] = useState<string>('');
  const [families, setFamilies] = useState<string[]>([]);
  const [versions, setVersions] = useState<string[]>([]);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [overviewData, filtersData] = await Promise.all([
        grcDashboardApi.getComplianceOverview({
          family: family || undefined,
          version: version || undefined,
        }),
        grcDashboardApi.getFilters(),
      ]);
      
      setData(overviewData);
      setFamilies(filtersData.families || []);
      setVersions(filtersData.versions || []);
    } catch (err) {
      setError('Failed to load compliance dashboard data');
      console.error('Error fetching compliance dashboard:', err);
    } finally {
      setLoading(false);
    }
  }, [family, version]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleReset = () => {
    setFamily('');
    setVersion('');
  };

  if (loading && !data) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  const statusData = data ? [
    { name: 'Compliant', value: data.requirementStatus.compliant, color: STATUS_COLORS.compliant },
    { name: 'Partially Compliant', value: data.requirementStatus.partiallyCompliant, color: STATUS_COLORS.partiallyCompliant },
    { name: 'Non-Compliant', value: data.requirementStatus.nonCompliant, color: STATUS_COLORS.nonCompliant },
    { name: 'Not Assessed', value: data.requirementStatus.notAssessed, color: STATUS_COLORS.notAssessed },
  ] : [];

  const totalRequirements = statusData.reduce((sum, item) => sum + item.value, 0);

  const heatmapData = data?.clauseHeatmap.map(clause => ({
    rowLabel: `${clause.family} - ${clause.code}`,
    cells: [
      { label: 'Critical', value: clause.critical, color: clause.critical > 0 ? SEVERITY_COLORS.critical : undefined },
      { label: 'High', value: clause.high, color: clause.high > 0 ? SEVERITY_COLORS.high : undefined },
      { label: 'Medium', value: clause.medium, color: clause.medium > 0 ? SEVERITY_COLORS.medium : undefined },
      { label: 'Low', value: clause.low, color: clause.low > 0 ? SEVERITY_COLORS.low : undefined },
    ],
  })) || [];

  const domainBars = [
    { dataKey: 'requirements', name: 'Requirements', color: '#1976d2' },
    { dataKey: 'findings', name: 'Findings', color: '#f57c00' },
    { dataKey: 'capas', name: 'CAPAs', color: '#4caf50' },
  ];

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Compliance Dashboard
      </Typography>
      <Typography variant="body1" color="textSecondary" sx={{ mb: 3 }}>
        Track compliance status across standards and regulatory frameworks.
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <FilterBar
        filters={[
          {
            name: 'family',
            label: 'Standard Family',
            value: family,
            options: families.map(f => ({ value: f, label: f.toUpperCase() })),
            onChange: setFamily,
          },
          {
            name: 'version',
            label: 'Version',
            value: version,
            options: versions.map(v => ({ value: v, label: v })),
            onChange: setVersion,
          },
        ]}
        onRefresh={fetchData}
        onReset={handleReset}
      />

      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Compliant"
            value={data?.requirementStatus.compliant || 0}
            icon={<CompliantIcon />}
            color={STATUS_COLORS.compliant}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Partially Compliant"
            value={data?.requirementStatus.partiallyCompliant || 0}
            icon={<PartialIcon />}
            color={STATUS_COLORS.partiallyCompliant}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Non-Compliant"
            value={data?.requirementStatus.nonCompliant || 0}
            icon={<NonCompliantIcon />}
            color={STATUS_COLORS.nonCompliant}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Not Assessed"
            value={data?.requirementStatus.notAssessed || 0}
            icon={<NotAssessedIcon />}
            color={STATUS_COLORS.notAssessed}
          />
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <DashboardCard title="Compliance Status" subtitle="Overall requirement status breakdown">
            <DonutChart
              data={statusData}
              height={280}
              centerValue={totalRequirements}
              centerLabel="Total"
            />
          </DashboardCard>
        </Grid>

        <Grid item xs={12} md={6}>
          <DashboardCard title="Standards Coverage" subtitle="Compliance score by standard family">
            {data?.standardsCoverage && data.standardsCoverage.length > 0 ? (
              <Box sx={{ maxHeight: 280, overflow: 'auto' }}>
                {data.standardsCoverage.map((standard, index) => (
                  <Card key={index} variant="outlined" sx={{ mb: 1 }}>
                    <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                      <Box display="flex" justifyContent="space-between" alignItems="center" mb={0.5}>
                        <Typography variant="subtitle2">
                          {standard.family.toUpperCase()}
                        </Typography>
                        <Typography variant="body2" fontWeight="bold" color="primary">
                          {(standard.complianceScore * 100).toFixed(0)}%
                        </Typography>
                      </Box>
                      <LinearProgress
                        variant="determinate"
                        value={standard.complianceScore * 100}
                        sx={{ height: 8, borderRadius: 4 }}
                      />
                      <Box display="flex" justifyContent="space-between" mt={0.5}>
                        <Typography variant="caption" color="textSecondary">
                          {standard.audited} / {standard.totalRequirements} audited
                        </Typography>
                        <Typography variant="caption" color="textSecondary">
                          {standard.withFindings} with findings
                        </Typography>
                      </Box>
                    </CardContent>
                  </Card>
                ))}
              </Box>
            ) : (
              <Box display="flex" justifyContent="center" alignItems="center" height={200}>
                <Typography color="textSecondary">No standards coverage data available</Typography>
              </Box>
            )}
          </DashboardCard>
        </Grid>

        <Grid item xs={12} md={6}>
          <DashboardCard title="Clause Heatmap" subtitle="Findings severity by clause">
            {heatmapData.length > 0 ? (
              <Box sx={{ maxHeight: 300, overflow: 'auto' }}>
                <Heatmap
                  data={heatmapData}
                  columnLabels={['Critical', 'High', 'Medium', 'Low']}
                />
              </Box>
            ) : (
              <Box display="flex" justifyContent="center" alignItems="center" height={200}>
                <Typography color="textSecondary">No clause data available</Typography>
              </Box>
            )}
          </DashboardCard>
        </Grid>

        <Grid item xs={12} md={6}>
          <DashboardCard title="Domain Breakdown" subtitle="Requirements, findings, and CAPAs by domain">
            {data?.domainBreakdown && data.domainBreakdown.length > 0 ? (
              <StackedBarChart
                data={data.domainBreakdown}
                xAxisKey="domain"
                bars={domainBars}
                height={280}
              />
            ) : (
              <Box display="flex" justifyContent="center" alignItems="center" height={200}>
                <Typography color="textSecondary">No domain data available</Typography>
              </Box>
            )}
          </DashboardCard>
        </Grid>
      </Grid>
    </Box>
  );
};

export default ComplianceDashboard;
