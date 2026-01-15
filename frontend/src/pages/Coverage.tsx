import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  LinearProgress,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Chip,
  Alert,
  Tabs,
  Tab,
  Paper,
} from '@mui/material';
import {
  CheckCircle as CoveredIcon,
  Cancel as UncoveredIcon,
  Warning as WarningIcon,
  Assessment as AssessmentIcon,
  AccountTree as ProcessIcon,
  Security as ControlIcon,
} from '@mui/icons-material';
import {
  coverageApi,
  CoverageSummary,
  RequirementCoverageResponse,
  ProcessCoverageResponse,
  unwrapResponse,
} from '../services/grcClient';
import { useAuth } from '../contexts/AuthContext';
import { LoadingState, ErrorState } from '../components/common';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`coverage-tabpanel-${index}`}
      aria-labelledby={`coverage-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  );
}

interface CoverageCardProps {
  title: string;
  percentage: number;
  covered: number;
  total: number;
  icon: React.ReactNode;
  color: string;
}

function CoverageCard({ title, percentage, covered, total, icon, color }: CoverageCardProps) {
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <Box sx={{ color, mr: 1 }}>{icon}</Box>
          <Typography variant="h6" component="div">
            {title}
          </Typography>
        </Box>
        <Typography variant="h3" component="div" sx={{ mb: 1, color }}>
          {percentage.toFixed(1)}%
        </Typography>
        <LinearProgress
          variant="determinate"
          value={percentage}
          sx={{
            height: 10,
            borderRadius: 5,
            mb: 1,
            backgroundColor: '#e0e0e0',
            '& .MuiLinearProgress-bar': {
              backgroundColor: color,
              borderRadius: 5,
            },
          }}
        />
        <Typography variant="body2" color="text.secondary">
          {covered} of {total} covered
        </Typography>
      </CardContent>
    </Card>
  );
}

export const Coverage: React.FC = () => {
  const { user } = useAuth();
  const tenantId = user?.tenantId || '';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tabValue, setTabValue] = useState(0);

  const [summary, setSummary] = useState<CoverageSummary | null>(null);
  const [requirementCoverage, setRequirementCoverage] = useState<RequirementCoverageResponse | null>(null);
  const [processCoverage, setProcessCoverage] = useState<ProcessCoverageResponse | null>(null);

  const fetchCoverageData = useCallback(async () => {
    if (!tenantId) return;

    setLoading(true);
    setError(null);

    try {
      const [summaryRes, reqRes, procRes] = await Promise.all([
        coverageApi.getSummary(tenantId),
        coverageApi.getRequirementCoverage(tenantId),
        coverageApi.getProcessCoverage(tenantId),
      ]);

      const summaryData = unwrapResponse<CoverageSummary>(summaryRes);
      const reqData = unwrapResponse<RequirementCoverageResponse>(reqRes);
      const procData = unwrapResponse<ProcessCoverageResponse>(procRes);

      setSummary(summaryData || null);
      setRequirementCoverage(reqData || null);
      setProcessCoverage(procData || null);
    } catch (err) {
      console.error('Error fetching coverage data:', err);
      setError('Failed to load coverage data. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    fetchCoverageData();
  }, [fetchCoverageData]);

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const getCoverageColor = (percentage: number): string => {
    if (percentage >= 80) return '#4caf50';
    if (percentage >= 50) return '#ff9800';
    return '#f44336';
  };

  if (loading) {
    return <LoadingState message="Loading coverage data..." />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={fetchCoverageData} />;
  }

  if (!summary) {
    return <ErrorState message="No coverage data available" />;
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <AssessmentIcon /> Coverage Dashboard
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        Monitor control coverage across requirements and processes
      </Typography>

      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={4}>
          <CoverageCard
            title="Requirement Coverage"
            percentage={summary.requirementCoverage}
            covered={summary.coveredRequirements}
            total={summary.totalRequirements}
            icon={<AssessmentIcon fontSize="large" />}
            color={getCoverageColor(summary.requirementCoverage)}
          />
        </Grid>
        <Grid item xs={12} md={4}>
          <CoverageCard
            title="Process Coverage"
            percentage={summary.processCoverage}
            covered={summary.coveredProcesses}
            total={summary.totalProcesses}
            icon={<ProcessIcon fontSize="large" />}
            color={getCoverageColor(summary.processCoverage)}
          />
        </Grid>
        <Grid item xs={12} md={4}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Box sx={{ color: summary.unlinkedControlsCount > 0 ? '#ff9800' : '#4caf50', mr: 1 }}>
                  <ControlIcon fontSize="large" />
                </Box>
                <Typography variant="h6" component="div">
                  Unlinked Controls
                </Typography>
              </Box>
              <Typography
                variant="h3"
                component="div"
                sx={{ mb: 1, color: summary.unlinkedControlsCount > 0 ? '#ff9800' : '#4caf50' }}
              >
                {summary.unlinkedControlsCount}
              </Typography>
              {summary.unlinkedControlsCount > 0 ? (
                <Alert severity="warning" sx={{ mt: 1 }}>
                  {summary.unlinkedControlsCount} control(s) not linked to any requirement or process
                </Alert>
              ) : (
                <Alert severity="success" sx={{ mt: 1 }}>
                  All controls are linked
                </Alert>
              )}
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Total Controls: {summary.totalControls}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Paper sx={{ width: '100%' }}>
        <Tabs value={tabValue} onChange={handleTabChange} aria-label="coverage tabs">
          <Tab label="Requirements" icon={<AssessmentIcon />} iconPosition="start" />
          <Tab label="Processes" icon={<ProcessIcon />} iconPosition="start" />
        </Tabs>

        <TabPanel value={tabValue} index={0}>
          {requirementCoverage && Array.isArray(requirementCoverage.requirements) && requirementCoverage.requirements.length > 0 ? (
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Code</TableCell>
                  <TableCell>Name</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="center">Controls</TableCell>
                  <TableCell align="center">Coverage</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {requirementCoverage.requirements.map((req) => (
                  <TableRow key={req.id}>
                    <TableCell>
                      <Typography variant="body2" fontWeight="medium">
                        {req.referenceCode}
                      </Typography>
                    </TableCell>
                    <TableCell>{req.title}</TableCell>
                    <TableCell>
                      <Chip label={req.status} size="small" variant="outlined" />
                    </TableCell>
                    <TableCell align="center">{req.controlCount}</TableCell>
                    <TableCell align="center">
                      {req.isCovered ? (
                        <Chip
                          icon={<CoveredIcon />}
                          label="Covered"
                          color="success"
                          size="small"
                        />
                      ) : (
                        <Chip
                          icon={<UncoveredIcon />}
                          label="Uncovered"
                          color="error"
                          size="small"
                        />
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <Box sx={{ p: 4, textAlign: 'center' }}>
              <WarningIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
              <Typography variant="h6" color="text.secondary">
                No requirements found
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Create requirements to track coverage
              </Typography>
            </Box>
          )}
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          {processCoverage && Array.isArray(processCoverage.processes) && processCoverage.processes.length > 0 ? (
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Code</TableCell>
                  <TableCell>Name</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="center">Controls</TableCell>
                  <TableCell align="center">Coverage</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {processCoverage.processes.map((proc) => (
                  <TableRow key={proc.id}>
                    <TableCell>
                      <Typography variant="body2" fontWeight="medium">
                        {proc.code}
                      </Typography>
                    </TableCell>
                    <TableCell>{proc.name}</TableCell>
                    <TableCell>
                      <Chip 
                        label={proc.isActive ? 'Active' : 'Inactive'} 
                        size="small" 
                        variant="outlined"
                        color={proc.isActive ? 'success' : 'default'}
                      />
                    </TableCell>
                    <TableCell align="center">{proc.controlCount}</TableCell>
                    <TableCell align="center">
                      {proc.isCovered ? (
                        <Chip
                          icon={<CoveredIcon />}
                          label="Covered"
                          color="success"
                          size="small"
                        />
                      ) : (
                        <Chip
                          icon={<UncoveredIcon />}
                          label="Uncovered"
                          color="error"
                          size="small"
                        />
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <Box sx={{ p: 4, textAlign: 'center' }}>
              <WarningIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
              <Typography variant="h6" color="text.secondary">
                No processes found
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Create processes to track coverage
              </Typography>
            </Box>
          )}
        </TabPanel>
      </Paper>
    </Box>
  );
};

export default Coverage;
