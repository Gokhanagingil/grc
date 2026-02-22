import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box,
  Typography,
  Grid,
  Alert,
  CircularProgress,
  Tabs,
  Tab,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Tooltip,
  IconButton,
} from '@mui/material';
import {
  InboxOutlined as EmptyIcon,
} from '@mui/icons-material';
import {
  BugReport as ProblemIcon,
  Warning as MajorIncidentIcon,
  Assignment as PirIcon,
  CheckCircle as ClosureIcon,
  MenuBook as KnownErrorIcon,
  Speed as SpeedIcon,
  TrendingUp as TrendIcon,
  Inventory as BacklogIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import {
  DashboardCard,
  MetricCard,
  TrendChart,
  BarList,
  DonutChart,
  PipelineChart,
  FilterBar,
} from '../../components/dashboard';
import {
  itsmAnalyticsApi,
  ExecutiveSummaryData,
  ProblemTrendsData,
  MajorIncidentMetricsData,
  PirEffectivenessData,
  KnownErrorLifecycleData,
  ClosureEffectivenessData,
  BacklogSummaryData,
  AnalyticsFilterParams,
} from '../../services/grcClient';

// ============================================================================
// Color Constants
// ============================================================================

const COLORS = {
  primary: '#1976d2',
  success: '#4caf50',
  warning: '#ff9800',
  error: '#f44336',
  info: '#2196f3',
  purple: '#9c27b0',
  teal: '#009688',
  indigo: '#3f51b5',
  pink: '#e91e63',
  amber: '#ffc107',
  deepOrange: '#ff5722',
  lime: '#cddc39',
};

const STATE_COLORS: Record<string, string> = {
  NEW: COLORS.info,
  UNDER_INVESTIGATION: COLORS.warning,
  KNOWN_ERROR: COLORS.deepOrange,
  ROOT_CAUSE_IDENTIFIED: COLORS.purple,
  RESOLVED: COLORS.success,
  CLOSED: '#78909c',
  REOPENED: COLORS.error,
  // MI statuses
  DECLARED: COLORS.error,
  INVESTIGATING: COLORS.warning,
  MITIGATING: COLORS.amber,
  MONITORING: COLORS.info,
  PIR_PENDING: COLORS.purple,
  // PIR statuses
  DRAFT: '#90a4ae',
  IN_REVIEW: COLORS.warning,
  APPROVED: COLORS.success,
  // PIR Action statuses
  OPEN: COLORS.info,
  IN_PROGRESS: COLORS.warning,
  COMPLETED: COLORS.success,
  OVERDUE: COLORS.error,
  CANCELLED: '#9e9e9e',
  // KE states
  CANDIDATE: COLORS.info,
  PUBLISHED: COLORS.success,
  RETIRED: '#78909c',
  // KC statuses
  REVIEWED: COLORS.warning,
  REJECTED: COLORS.error,
  // Fix statuses
  NO_FIX: '#9e9e9e',
  WORKAROUND: COLORS.warning,
  FIX_IN_PROGRESS: COLORS.info,
  FIX_AVAILABLE: COLORS.success,
};

const PRIORITY_COLORS: Record<string, string> = {
  P1: COLORS.error,
  CRITICAL: COLORS.error,
  P2: COLORS.warning,
  HIGH: COLORS.warning,
  P3: COLORS.info,
  MEDIUM: COLORS.info,
  P4: '#78909c',
  LOW: '#78909c',
};

// ============================================================================
// Tab Panel Helper
// ============================================================================

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index }) => (
  <div role="tabpanel" hidden={value !== index}>
    {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
  </div>
);

// ============================================================================
// Main Dashboard Component
// ============================================================================

const ItsmAnalyticsDashboard: React.FC = () => {
  const [tab, setTab] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter state
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [severity, setSeverity] = useState('');
  const [priority, setPriority] = useState('');
  const [service, setService] = useState('');
  const [team, setTeam] = useState('');
  const [category, setCategory] = useState('');

  // Last updated timestamp
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const refreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [, forceRender] = useState(0);

  // Tick every 30s to keep "Last updated" label fresh
  useEffect(() => {
    refreshTimerRef.current = setInterval(() => forceRender((n) => n + 1), 30_000);
    return () => { if (refreshTimerRef.current) clearInterval(refreshTimerRef.current); };
  }, []);

  // Data state
  const [execSummary, setExecSummary] = useState<ExecutiveSummaryData | null>(null);
  const [problemTrends, setProblemTrends] = useState<ProblemTrendsData | null>(null);
  const [miMetrics, setMiMetrics] = useState<MajorIncidentMetricsData | null>(null);
  const [pirEffectiveness, setPirEffectiveness] = useState<PirEffectivenessData | null>(null);
  const [keLifecycle, setKeLifecycle] = useState<KnownErrorLifecycleData | null>(null);
  const [closureData, setClosureData] = useState<ClosureEffectivenessData | null>(null);
  const [backlog, setBacklog] = useState<BacklogSummaryData | null>(null);

  const buildFilter = useCallback((): AnalyticsFilterParams => ({
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    severity: severity || undefined,
    priority: priority || undefined,
    serviceId: service || undefined,
    team: team || undefined,
    category: category || undefined,
  }), [dateFrom, dateTo, severity, priority, service, team, category]);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const filter = buildFilter();

      const [exec, problems, mi, pir, ke, closure, bl] = await Promise.all([
        itsmAnalyticsApi.getExecutiveSummary(filter).catch(() => null),
        itsmAnalyticsApi.getProblemTrends(filter).catch(() => null),
        itsmAnalyticsApi.getMajorIncidentMetrics(filter).catch(() => null),
        itsmAnalyticsApi.getPirEffectiveness(filter).catch(() => null),
        itsmAnalyticsApi.getKnownErrorLifecycle(filter).catch(() => null),
        itsmAnalyticsApi.getClosureEffectiveness(filter).catch(() => null),
        itsmAnalyticsApi.getBacklog(filter).catch(() => null),
      ]);

      setExecSummary(exec);
      setProblemTrends(problems);
      setMiMetrics(mi);
      setPirEffectiveness(pir);
      setKeLifecycle(ke);
      setClosureData(closure);
      setBacklog(bl);
      setLastUpdated(new Date());
    } catch (err) {
      setError('Failed to load analytics dashboard data');
      console.error('Analytics fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [buildFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleReset = () => {
    setDateFrom('');
    setDateTo('');
    setSeverity('');
    setPriority('');
    setService('');
    setTeam('');
    setCategory('');
  };

  const severityOptions = [
    { value: 'SEV1', label: 'SEV1' },
    { value: 'SEV2', label: 'SEV2' },
    { value: 'SEV3', label: 'SEV3' },
  ];

  const priorityOptions = [
    { value: 'P1', label: 'P1 - Critical' },
    { value: 'P2', label: 'P2 - High' },
    { value: 'P3', label: 'P3 - Medium' },
    { value: 'P4', label: 'P4 - Low' },
  ];

  const categoryOptions = [
    { value: 'Network', label: 'Network' },
    { value: 'Security', label: 'Security' },
    { value: 'Application', label: 'Application' },
    { value: 'Infrastructure', label: 'Infrastructure' },
    { value: 'Database', label: 'Database' },
  ];

  const teamOptions = [
    { value: 'Platform', label: 'Platform' },
    { value: 'Security', label: 'Security' },
    { value: 'Network', label: 'Network' },
    { value: 'DevOps', label: 'DevOps' },
    { value: 'DBA', label: 'DBA' },
  ];

  const formatRelativeTime = (date: Date): string => {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 10) return 'just now';
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  };

  if (loading && !execSummary) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
        <Box>
          <Typography variant="h4" fontWeight="bold" gutterBottom>
            ITSM Analytics
          </Typography>
          <Typography variant="body1" color="textSecondary">
            Closed-loop operational intelligence across Problem, Major Incident, PIR, Known Error, and Knowledge lifecycle.
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {lastUpdated && (
            <Typography variant="caption" color="textSecondary">
              Updated {formatRelativeTime(lastUpdated)}
            </Typography>
          )}
          <Tooltip title="Refresh all tabs">
            <IconButton onClick={fetchData} color="primary" size="large" disabled={loading}>
              <RefreshIcon sx={{ animation: loading ? 'spin 1s linear infinite' : 'none', '@keyframes spin': { '0%': { transform: 'rotate(0deg)' }, '100%': { transform: 'rotate(360deg)' } } }} />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Filters */}
      <FilterBar
        dateFrom={dateFrom}
        dateTo={dateTo}
        onDateFromChange={setDateFrom}
        onDateToChange={setDateTo}
        filters={[
          {
            name: 'severity',
            label: 'Severity',
            value: severity,
            options: severityOptions,
            onChange: setSeverity,
          },
          {
            name: 'priority',
            label: 'Priority',
            value: priority,
            options: priorityOptions,
            onChange: setPriority,
          },
          {
            name: 'category',
            label: 'Category',
            value: category,
            options: categoryOptions,
            onChange: setCategory,
          },
          {
            name: 'team',
            label: 'Team',
            value: team,
            options: teamOptions,
            onChange: setTeam,
          },
        ]}
        onRefresh={fetchData}
        onReset={handleReset}
      />

      {/* Tabs */}
      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        sx={{ mb: 1, borderBottom: 1, borderColor: 'divider' }}
        variant="scrollable"
        scrollButtons="auto"
      >
        <Tab icon={<SpeedIcon />} iconPosition="start" label="Executive Summary" />
        <Tab icon={<ProblemIcon />} iconPosition="start" label="Problem Trends" />
        <Tab icon={<MajorIncidentIcon />} iconPosition="start" label="Major Incidents" />
        <Tab icon={<PirIcon />} iconPosition="start" label="PIR Effectiveness" />
        <Tab icon={<KnownErrorIcon />} iconPosition="start" label="Known Errors" />
        <Tab icon={<ClosureIcon />} iconPosition="start" label="Closure" />
        <Tab icon={<BacklogIcon />} iconPosition="start" label="Backlog" />
      </Tabs>

      {/* Tab 0: Executive Summary */}
      <TabPanel value={tab} index={0}>
        <ExecutiveSummaryTab data={execSummary} />
      </TabPanel>

      {/* Tab 1: Problem Trends */}
      <TabPanel value={tab} index={1}>
        <ProblemTrendsTab data={problemTrends} />
      </TabPanel>

      {/* Tab 2: Major Incident Metrics */}
      <TabPanel value={tab} index={2}>
        <MajorIncidentTab data={miMetrics} />
      </TabPanel>

      {/* Tab 3: PIR Effectiveness */}
      <TabPanel value={tab} index={3}>
        <PirEffectivenessTab data={pirEffectiveness} />
      </TabPanel>

      {/* Tab 4: Known Error Lifecycle */}
      <TabPanel value={tab} index={4}>
        <KnownErrorTab data={keLifecycle} />
      </TabPanel>

      {/* Tab 5: Closure Effectiveness */}
      <TabPanel value={tab} index={5}>
        <ClosureTab data={closureData} />
      </TabPanel>

      {/* Tab 6: Backlog */}
      <TabPanel value={tab} index={6}>
        <BacklogTab data={backlog} />
      </TabPanel>
    </Box>
  );
};

// ============================================================================
// Executive Summary Tab
// ============================================================================

const ExecutiveSummaryTab: React.FC<{ data: ExecutiveSummaryData | null }> = ({ data }) => {
  if (!data) return <EmptyState message="No executive summary data available" />;

  const trendLines = [
    { dataKey: 'opened', name: 'Opened', color: COLORS.warning },
    { dataKey: 'closed', name: 'Closed', color: COLORS.success },
    { dataKey: 'resolved', name: 'Resolved', color: COLORS.info },
  ];

  const severityDonut = (data.severityDistribution || []).map(s => ({
    name: s.label,
    value: s.count,
    color: STATE_COLORS[s.label] || PRIORITY_COLORS[s.label] || COLORS.info,
  }));

  return (
    <>
      {/* KPI Row */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Open Problems"
            value={data.kpis.openProblems}
            subtitle={`${data.kpis.totalProblems} total`}
            icon={<ProblemIcon />}
            color={COLORS.warning}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Major Incidents"
            value={data.kpis.openMajorIncidents}
            subtitle="Active"
            icon={<MajorIncidentIcon />}
            color={COLORS.error}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Overdue Actions"
            value={data.kpis.actionOverdueCount}
            subtitle="Past due date"
            icon={<PirIcon />}
            color={COLORS.deepOrange}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Published KEs"
            value={data.kpis.knownErrorsPublished}
            subtitle={`${data.kpis.knowledgeCandidatesGenerated} KC pending`}
            icon={<KnownErrorIcon />}
            color={COLORS.teal}
          />
        </Grid>
      </Grid>

      {/* Health Scores Row */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Closure Rate"
            value={`${data.closureEffectiveness.problemClosureRate}%`}
            subtitle={data.closureEffectiveness.avgDaysToCloseProblem != null ? `Avg ${data.closureEffectiveness.avgDaysToCloseProblem}d to close` : 'No closures yet'}
            icon={<ClosureIcon />}
            color={data.closureEffectiveness.problemClosureRate >= 70 ? COLORS.success : data.closureEffectiveness.problemClosureRate >= 40 ? COLORS.warning : COLORS.error}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="PIR Completion"
            value={`${data.kpis.pirCompletionPct}%`}
            subtitle="PIRs approved/closed"
            icon={<PirIcon />}
            color={data.kpis.pirCompletionPct >= 80 ? COLORS.success : data.kpis.pirCompletionPct >= 50 ? COLORS.warning : COLORS.error}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Action Completion"
            value={`${data.closureEffectiveness.actionClosureRate}%`}
            subtitle={data.closureEffectiveness.avgDaysToCloseAction != null ? `Avg ${data.closureEffectiveness.avgDaysToCloseAction}d` : 'No completions'}
            icon={<TrendIcon />}
            color={data.closureEffectiveness.actionClosureRate >= 80 ? COLORS.success : data.closureEffectiveness.actionClosureRate >= 50 ? COLORS.warning : COLORS.error}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Reopen Rate"
            value={`${data.kpis.problemReopenRate}%`}
            subtitle="Problems reopened"
            icon={<ProblemIcon />}
            color={data.kpis.problemReopenRate <= 5 ? COLORS.success : data.kpis.problemReopenRate <= 15 ? COLORS.warning : COLORS.error}
          />
        </Grid>
      </Grid>

      {/* Charts Row */}
      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          <DashboardCard title="Problem Trend" subtitle="Monthly opened / closed / resolved">
            {data.problemTrend.length > 0 ? (
              <TrendChart data={data.problemTrend} xAxisKey="period" lines={trendLines} height={280} />
            ) : (
              <EmptyState message="No trend data yet" />
            )}
          </DashboardCard>
        </Grid>
        <Grid item xs={12} md={4}>
          <DashboardCard title="Severity Distribution" subtitle="Problem severity breakdown">
            {severityDonut.length > 0 ? (
              <DonutChart
                data={severityDonut}
                height={280}
                centerValue={data.kpis.totalProblems}
                centerLabel="Total"
              />
            ) : (
              <EmptyState message="No severity data" />
            )}
          </DashboardCard>
        </Grid>
      </Grid>
    </>
  );
};

// ============================================================================
// Problem Trends Tab
// ============================================================================

const ProblemTrendsTab: React.FC<{ data: ProblemTrendsData | null }> = ({ data }) => {
  if (!data) return <EmptyState message="No problem trends data available" />;

  const stateDonut = data.stateDistribution.map(s => ({
    name: s.label,
    value: s.count,
    color: STATE_COLORS[s.label] || COLORS.info,
  }));

  const priorityPipeline = data.priorityDistribution.map(p => ({
    name: p.label,
    value: p.count,
    color: PRIORITY_COLORS[p.label] || COLORS.info,
  }));

  const categoryBars = data.categoryDistribution.map(c => ({
    label: c.label || 'Uncategorized',
    value: c.count,
    color: COLORS.indigo,
  }));

  const agingPipeline = data.aging.map(a => ({
    name: a.bucket,
    value: a.count,
  }));

  const trendLines = [
    { dataKey: 'opened', name: 'Opened', color: COLORS.warning },
    { dataKey: 'closed', name: 'Closed', color: COLORS.success },
    { dataKey: 'resolved', name: 'Resolved', color: COLORS.info },
  ];

  return (
    <>
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={4}>
          <MetricCard
            title="Reopened Problems"
            value={data.reopenedCount}
            subtitle="Indicates recurring issues"
            icon={<ProblemIcon />}
            color={data.reopenedCount > 0 ? COLORS.error : COLORS.success}
          />
        </Grid>
        <Grid item xs={12} sm={4}>
          <MetricCard
            title="Avg Days Open"
            value={data.avgDaysOpen}
            subtitle="Open problem age"
            icon={<SpeedIcon />}
            color={data.avgDaysOpen > 30 ? COLORS.error : data.avgDaysOpen > 14 ? COLORS.warning : COLORS.success}
          />
        </Grid>
        <Grid item xs={12} sm={4}>
          <MetricCard
            title="Total States"
            value={data.stateDistribution.reduce((s, d) => s + d.count, 0)}
            subtitle={`${data.stateDistribution.length} unique states`}
            icon={<TrendIcon />}
            color={COLORS.primary}
          />
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <DashboardCard title="State Distribution" subtitle="Current problem states">
            {stateDonut.length > 0 ? (
              <DonutChart data={stateDonut} height={280} />
            ) : (
              <EmptyState message="No state data" />
            )}
          </DashboardCard>
        </Grid>
        <Grid item xs={12} md={6}>
          <DashboardCard title="Priority Breakdown" subtitle="Problems by priority level">
            {priorityPipeline.length > 0 ? (
              <PipelineChart data={priorityPipeline} height={280} />
            ) : (
              <EmptyState message="No priority data" />
            )}
          </DashboardCard>
        </Grid>
        <Grid item xs={12} md={6}>
          <DashboardCard title="Category Distribution" subtitle="Problems by category">
            {categoryBars.length > 0 ? (
              <BarList items={categoryBars} />
            ) : (
              <EmptyState message="No category data" />
            )}
          </DashboardCard>
        </Grid>
        <Grid item xs={12} md={6}>
          <DashboardCard title="Aging Buckets" subtitle="Open problem age distribution">
            {agingPipeline.length > 0 ? (
              <PipelineChart data={agingPipeline} height={280} />
            ) : (
              <EmptyState message="No aging data" />
            )}
          </DashboardCard>
        </Grid>
        <Grid item xs={12}>
          <DashboardCard title="Problem Trend" subtitle="Monthly opened / closed / resolved">
            {data.trend.length > 0 ? (
              <TrendChart data={data.trend} xAxisKey="period" lines={trendLines} height={300} />
            ) : (
              <EmptyState message="No trend data" />
            )}
          </DashboardCard>
        </Grid>
      </Grid>
    </>
  );
};

// ============================================================================
// Major Incident Tab
// ============================================================================

const MajorIncidentTab: React.FC<{ data: MajorIncidentMetricsData | null }> = ({ data }) => {
  if (!data) return <EmptyState message="No major incident metrics available" />;

  const statusDonut = data.byStatus.map(s => ({
    name: s.label,
    value: s.count,
    color: STATE_COLORS[s.label] || COLORS.info,
  }));

  const severityPipeline = data.bySeverity.map(s => ({
    name: s.label,
    value: s.count,
    color: s.label === 'SEV1' ? COLORS.error : s.label === 'SEV2' ? COLORS.warning : COLORS.info,
  }));

  const trendLines = [
    { dataKey: 'opened', name: 'Declared', color: COLORS.error },
    { dataKey: 'closed', name: 'Closed', color: COLORS.success },
    { dataKey: 'resolved', name: 'Resolved', color: COLORS.info },
  ];

  return (
    <>
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={3}>
          <MetricCard
            title="Total Major Incidents"
            value={data.totalCount}
            icon={<MajorIncidentIcon />}
            color={COLORS.error}
          />
        </Grid>
        <Grid item xs={12} sm={3}>
          <MetricCard
            title="MTTR"
            value={data.mttrHours != null ? `${data.mttrHours}h` : 'N/A'}
            subtitle="Mean Time to Resolve"
            icon={<SpeedIcon />}
            color={COLORS.warning}
          />
        </Grid>
        <Grid item xs={12} sm={3}>
          <MetricCard
            title="Avg Bridge Duration"
            value={data.avgBridgeDurationHours != null ? `${data.avgBridgeDurationHours}h` : 'N/A'}
            subtitle="Average bridge call"
            icon={<TrendIcon />}
            color={COLORS.info}
          />
        </Grid>
        <Grid item xs={12} sm={3}>
          <MetricCard
            title="PIR Completion"
            value={`${data.pirCompletionRate}%`}
            subtitle="MIs with completed PIR"
            icon={<PirIcon />}
            color={data.pirCompletionRate >= 80 ? COLORS.success : COLORS.warning}
          />
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <DashboardCard title="Status Distribution" subtitle="MI by current status">
            {statusDonut.length > 0 ? (
              <DonutChart data={statusDonut} height={280} centerValue={data.totalCount} centerLabel="Total" />
            ) : (
              <EmptyState message="No status data" />
            )}
          </DashboardCard>
        </Grid>
        <Grid item xs={12} md={6}>
          <DashboardCard title="Severity Breakdown" subtitle="MI by severity level">
            {severityPipeline.length > 0 ? (
              <PipelineChart data={severityPipeline} height={280} />
            ) : (
              <EmptyState message="No severity data" />
            )}
          </DashboardCard>
        </Grid>
        <Grid item xs={12}>
          <DashboardCard title="Major Incident Trend" subtitle="Monthly declared / resolved / closed">
            {data.trend.length > 0 ? (
              <TrendChart data={data.trend} xAxisKey="period" lines={trendLines} height={300} />
            ) : (
              <EmptyState message="No trend data" />
            )}
          </DashboardCard>
        </Grid>
      </Grid>
    </>
  );
};

// ============================================================================
// PIR Effectiveness Tab
// ============================================================================

const PirEffectivenessTab: React.FC<{ data: PirEffectivenessData | null }> = ({ data }) => {
  if (!data) return <EmptyState message="No PIR effectiveness data available" />;

  const statusDonut = data.statusDistribution.map(s => ({
    name: s.label,
    value: s.count,
    color: STATE_COLORS[s.label] || COLORS.info,
  }));

  const kcStatusDonut = data.knowledgeCandidatesByStatus.map(s => ({
    name: s.label,
    value: s.count,
    color: STATE_COLORS[s.label] || COLORS.info,
  }));

  return (
    <>
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={4} md={2}>
          <MetricCard title="Total PIRs" value={data.totalPirs} icon={<PirIcon />} color={COLORS.primary} />
        </Grid>
        <Grid item xs={12} sm={4} md={2}>
          <MetricCard
            title="Action Completion"
            value={`${data.actionCompletionRate}%`}
            icon={<ClosureIcon />}
            color={data.actionCompletionRate >= 80 ? COLORS.success : COLORS.warning}
          />
        </Grid>
        <Grid item xs={12} sm={4} md={2}>
          <MetricCard
            title="Overdue Actions"
            value={data.actionOverdueCount}
            icon={<MajorIncidentIcon />}
            color={data.actionOverdueCount > 0 ? COLORS.error : COLORS.success}
          />
        </Grid>
        <Grid item xs={12} sm={4} md={2}>
          <MetricCard
            title="Avg Days to Complete"
            value={data.avgDaysToCompleteAction ?? 'N/A'}
            icon={<SpeedIcon />}
            color={COLORS.info}
          />
        </Grid>
        <Grid item xs={12} sm={4} md={2}>
          <MetricCard
            title="Knowledge Candidates"
            value={data.knowledgeCandidateCount}
            icon={<KnownErrorIcon />}
            color={COLORS.teal}
          />
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <DashboardCard title="PIR Status" subtitle="Distribution by status">
            {statusDonut.length > 0 ? (
              <DonutChart data={statusDonut} height={280} centerValue={data.totalPirs} centerLabel="PIRs" />
            ) : (
              <EmptyState message="No PIR status data" />
            )}
          </DashboardCard>
        </Grid>
        <Grid item xs={12} md={6}>
          <DashboardCard title="Knowledge Candidate Status" subtitle="KC status breakdown">
            {kcStatusDonut.length > 0 ? (
              <DonutChart data={kcStatusDonut} height={280} centerValue={data.knowledgeCandidateCount} centerLabel="KC" />
            ) : (
              <EmptyState message="No KC data" />
            )}
          </DashboardCard>
        </Grid>
      </Grid>
    </>
  );
};

// ============================================================================
// Known Error Tab
// ============================================================================

const KnownErrorTab: React.FC<{ data: KnownErrorLifecycleData | null }> = ({ data }) => {
  if (!data) return <EmptyState message="No known error lifecycle data available" />;

  const stateDonut = data.stateDistribution.map(s => ({
    name: s.label,
    value: s.count,
    color: STATE_COLORS[s.label] || COLORS.info,
  }));

  const fixBars = data.fixStatusDistribution.map(f => ({
    label: f.label || 'Unknown',
    value: f.count,
    color: STATE_COLORS[f.label] || COLORS.info,
  }));

  return (
    <>
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={4} md={2}>
          <MetricCard title="Total KEs" value={data.totalCount} icon={<KnownErrorIcon />} color={COLORS.primary} />
        </Grid>
        <Grid item xs={12} sm={4} md={2}>
          <MetricCard title="Publication Rate" value={`${data.publicationRate}%`} icon={<ClosureIcon />} color={COLORS.success} />
        </Grid>
        <Grid item xs={12} sm={4} md={2}>
          <MetricCard title="Retirement Rate" value={`${data.retirementRate}%`} icon={<BacklogIcon />} color="#78909c" />
        </Grid>
        <Grid item xs={12} sm={4} md={2}>
          <MetricCard
            title="Problem→KE Conversion"
            value={`${data.problemToKeConversionRate}%`}
            icon={<ProblemIcon />}
            color={data.problemToKeConversionRate >= 50 ? COLORS.success : COLORS.warning}
          />
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <DashboardCard title="KE State Distribution" subtitle="Current known error states">
            {stateDonut.length > 0 ? (
              <DonutChart data={stateDonut} height={280} centerValue={data.totalCount} centerLabel="KEs" />
            ) : (
              <EmptyState message="No state data" />
            )}
          </DashboardCard>
        </Grid>
        <Grid item xs={12} md={6}>
          <DashboardCard title="Fix Status" subtitle="Permanent fix progress">
            {fixBars.length > 0 ? (
              <BarList items={fixBars} />
            ) : (
              <EmptyState message="No fix status data" />
            )}
          </DashboardCard>
        </Grid>
      </Grid>
    </>
  );
};

// ============================================================================
// Closure Effectiveness Tab
// ============================================================================

const ClosureTab: React.FC<{ data: ClosureEffectivenessData | null }> = ({ data }) => {
  if (!data) return <EmptyState message="No closure effectiveness data available" />;

  const trendLines = [
    { dataKey: 'opened', name: 'Opened', color: COLORS.warning },
    { dataKey: 'closed', name: 'Closed', color: COLORS.success },
    { dataKey: 'resolved', name: 'Resolved', color: COLORS.info },
  ];

  return (
    <>
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Reopen Rate"
            value={`${data.reopenedProblemRate}%`}
            subtitle={`${data.reopenedProblems} reopened`}
            icon={<ProblemIcon />}
            color={data.reopenedProblemRate <= 5 ? COLORS.success : data.reopenedProblemRate <= 15 ? COLORS.warning : COLORS.error}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Action Completion"
            value={`${data.actionClosureRate}%`}
            icon={<ClosureIcon />}
            color={data.actionClosureRate >= 80 ? COLORS.success : COLORS.warning}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Avg Problem Close"
            value={data.avgDaysToCloseProblem != null ? `${data.avgDaysToCloseProblem}d` : 'N/A'}
            subtitle="Days to close"
            icon={<SpeedIcon />}
            color={COLORS.info}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="PIR Closure Rate"
            value={`${data.pirClosureRate}%`}
            icon={<PirIcon />}
            color={data.pirClosureRate >= 80 ? COLORS.success : COLORS.warning}
          />
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        <Grid item xs={12}>
          <DashboardCard title="Closure Trend" subtitle="Problem open/close trend over time">
            {data.problemClosureRateTrend.length > 0 ? (
              <TrendChart data={data.problemClosureRateTrend} xAxisKey="period" lines={trendLines} height={320} />
            ) : (
              <EmptyState message="No closure trend data" />
            )}
          </DashboardCard>
        </Grid>
      </Grid>
    </>
  );
};

// ============================================================================
// Backlog Tab
// ============================================================================

const BacklogTab: React.FC<{ data: BacklogSummaryData | null }> = ({ data }) => {
  if (!data) return <EmptyState message="No backlog data available" />;

  const problemBars = data.openProblemsByPriority.map(p => ({
    label: p.label || 'Unset',
    value: p.count,
    color: PRIORITY_COLORS[p.label] || COLORS.info,
  }));

  const actionBars = data.openActionsByPriority.map(a => ({
    label: a.label || 'Unset',
    value: a.count,
    color: PRIORITY_COLORS[a.label] || COLORS.info,
  }));

  return (
    <>
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Overdue Actions"
            value={data.overdueActions}
            icon={<MajorIncidentIcon />}
            color={data.overdueActions > 0 ? COLORS.error : COLORS.success}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Stale Items"
            value={data.staleItems}
            subtitle="Not updated in 30+ days"
            icon={<BacklogIcon />}
            color={data.staleItems > 0 ? COLORS.warning : COLORS.success}
          />
        </Grid>
      </Grid>

      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={6}>
          <DashboardCard title="Open Problems by Priority" subtitle="Problem backlog">
            {problemBars.length > 0 ? (
              <BarList items={problemBars} />
            ) : (
              <EmptyState message="No open problems" />
            )}
          </DashboardCard>
        </Grid>
        <Grid item xs={12} md={6}>
          <DashboardCard title="Open Actions by Priority" subtitle="Action backlog">
            {actionBars.length > 0 ? (
              <BarList items={actionBars} />
            ) : (
              <EmptyState message="No open actions" />
            )}
          </DashboardCard>
        </Grid>
      </Grid>

      {/* Backlog Items Table */}
      {data.items.length > 0 && (
        <DashboardCard title="Top Backlog Items" subtitle="Sorted by priority and age" minHeight={200}>
          <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 500 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>Type</TableCell>
                  <TableCell>Title</TableCell>
                  <TableCell>Priority</TableCell>
                  <TableCell>State</TableCell>
                  <TableCell align="right">Age (days)</TableCell>
                  <TableCell>Assignee</TableCell>
                  <TableCell>Last Updated</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.items.slice(0, 50).map((item) => (
                  <TableRow key={`${item.type}-${item.id}`} hover>
                    <TableCell>
                      <Chip
                        label={item.type}
                        size="small"
                        color={item.type === 'PROBLEM' ? 'warning' : 'info'}
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell sx={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      <Tooltip title={item.title}>
                        <span>{item.title || '-'}</span>
                      </Tooltip>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={item.priority || '-'}
                        size="small"
                        sx={{
                          backgroundColor: PRIORITY_COLORS[item.priority] || '#9e9e9e',
                          color: 'white',
                          fontWeight: 'bold',
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={item.state}
                        size="small"
                        sx={{
                          backgroundColor: STATE_COLORS[item.state] || '#9e9e9e',
                          color: 'white',
                        }}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Typography
                        variant="body2"
                        color={item.ageDays > 30 ? 'error' : item.ageDays > 14 ? 'warning.main' : 'textPrimary'}
                        fontWeight={item.ageDays > 30 ? 'bold' : 'normal'}
                      >
                        {item.ageDays}
                      </Typography>
                    </TableCell>
                    <TableCell>{item.assignee || '-'}</TableCell>
                    <TableCell>{new Date(item.lastUpdated).toLocaleDateString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </DashboardCard>
      )}
    </>
  );
};

// ============================================================================
// Empty State Helper
// ============================================================================

const EmptyState: React.FC<{ message: string; suggestion?: string }> = ({ message, suggestion }) => (
  <Box
    display="flex"
    flexDirection="column"
    justifyContent="center"
    alignItems="center"
    height={200}
    sx={{ opacity: 0.7 }}
  >
    <EmptyIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
    <Typography variant="body1" color="textSecondary" fontWeight={500}>
      {message}
    </Typography>
    <Typography variant="caption" color="textSecondary" sx={{ mt: 0.5 }}>
      {suggestion || 'Try adjusting your filters or run the seed script to populate data.'}
    </Typography>
  </Box>
);

export default ItsmAnalyticsDashboard;
