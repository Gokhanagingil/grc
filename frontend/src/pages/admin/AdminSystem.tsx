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
  Divider,
  Skeleton,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  CheckCircle as HealthyIcon,
  Error as UnhealthyIcon,
  Info as InfoIcon,
  Storage as DatabaseIcon,
  Cloud as ApiIcon,
  Timer as UptimeIcon,
  Code as VersionIcon,
  Business as TenantIcon,
  PlayArrow as TestIcon,
  Email as EmailIcon,
  Webhook as WebhookIcon,
  Schedule as ScheduleIcon,
  Work as JobIcon,
} from '@mui/icons-material';
import { AdminPageHeader, AdminCard } from '../../components/admin';
import { api, STORAGE_TENANT_ID_KEY } from '../../services/api';
import { t, ADMIN_PLATFORM_KEYS } from '../../i18n';

interface HealthCheck {
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unavailable';
  message?: string;
  responseTime?: number;
}

interface SystemStatus {
  frontendVersion: string;
  apiBaseUrl: string;
  health: {
    api: HealthCheck;
    database: HealthCheck;
    auth: HealthCheck;
  };
  uptime?: number;
  environment?: string;
}

interface OnboardingTestResult {
  success: boolean;
  tenantId: string | null;
  enabledModules: Record<string, string[]> | null;
  error?: string;
  responseTime?: number;
}

interface NotificationStatusSummary {
  email: {
    enabled: boolean;
    configured: boolean;
  };
  webhook: {
    enabled: boolean;
    configured: boolean;
  };
  recentLogs: {
    total: number;
    success: number;
    failed: number;
    lastAttempt: string | null;
  };
}

interface JobInfo {
  name: string;
  description: string;
  enabled: boolean;
  scheduleIntervalMs: number | null;
  lastRun: {
    jobId: string;
    status: string;
    startedAt: string;
    completedAt: string;
    durationMs: number;
    summary?: string;
  } | null;
  nextRunAt: string | null;
  runCount: number;
  successCount: number;
  failureCount: number;
}

interface JobsStatusSummary {
  registeredJobs: JobInfo[];
  totalJobs: number;
  enabledJobs: number;
  recentRuns: {
    jobId: string;
    jobName: string;
    status: string;
    startedAt: string;
    completedAt: string;
    durationMs: number;
    summary?: string;
  }[];
}

interface PlatformValidationResult {
  hasResult: boolean;
  result: {
    success: boolean;
    timestamp: string;
    summary: {
      total: number;
      passed: number;
      failed: number;
    };
  } | null;
}

export const AdminSystem: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [onboardingTestLoading, setOnboardingTestLoading] = useState(false);
  const [onboardingTestResult, setOnboardingTestResult] = useState<OnboardingTestResult | null>(null);
  
  // Notifications state (FAZ 5)
  const [notificationStatus, setNotificationStatus] = useState<NotificationStatusSummary | null>(null);
  const [notificationLoading, setNotificationLoading] = useState(false);
  const [notificationTestLoading, setNotificationTestLoading] = useState<'email' | 'webhook' | null>(null);
  const [notificationTestResult, setNotificationTestResult] = useState<{ success: boolean; message: string } | null>(null);
  
  // Jobs state (FAZ 5)
  const [jobsStatus, setJobsStatus] = useState<JobsStatusSummary | null>(null);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [jobTriggerLoading, setJobTriggerLoading] = useState<string | null>(null);
  const [platformValidation, setPlatformValidation] = useState<PlatformValidationResult | null>(null);

  const checkHealth = async (endpoint: string): Promise<HealthCheck> => {
    const startTime = Date.now();
    try {
      const response = await api.get(endpoint, { timeout: 5000 });
      const responseTime = Date.now() - startTime;
      const data = response.data?.data || response.data;
      return {
        status: data?.status === 'OK' || response.status === 200 ? 'healthy' : 'degraded',
        message: data?.message || 'OK',
        responseTime,
      };
    } catch (err: unknown) {
      const responseTime = Date.now() - startTime;
      // Check if it's a 404 or network error (endpoint not available)
      if (err && typeof err === 'object' && 'response' in err) {
        const axiosError = err as { response?: { status?: number } };
        if (axiosError.response?.status === 404) {
          return {
            status: 'unavailable',
            message: 'Endpoint not available',
            responseTime,
          };
        }
      }
      
      // Check for network errors
      if (err && typeof err === 'object' && 'message' in err) {
        const errorMessage = (err as { message: string }).message;
        if (errorMessage.includes('Network Error') || errorMessage.includes('timeout')) {
          return {
            status: 'unavailable',
            message: 'Service unavailable',
            responseTime,
          };
        }
      }
      
      // Other errors are considered unhealthy
      return {
        status: 'unhealthy',
        message: err instanceof Error ? err.message : 'Health check failed',
        responseTime,
      };
    }
  };

  const fetchSystemStatus = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [apiHealth, dbHealth, authHealth] = await Promise.all([
        checkHealth('/health/live'),
        checkHealth('/health/db'),
        checkHealth('/health/auth'),
      ]);

      let uptime: number | undefined;
      let environment: string | undefined;
      try {
        const detailedHealth = await api.get('/health/detailed');
        const data = detailedHealth.data?.data || detailedHealth.data;
        uptime = data?.uptime;
        environment = data?.environment;
      } catch {
        // Detailed health endpoint may not exist
      }

      setSystemStatus({
        frontendVersion: process.env.REACT_APP_VERSION || '1.0.0',
        apiBaseUrl: process.env.REACT_APP_API_URL || api.defaults.baseURL || 'http://localhost:3002',
        health: {
          api: apiHealth,
          database: dbHealth,
          auth: authHealth,
        },
        uptime,
        environment,
      });
      setLastChecked(new Date());
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch system status';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSystemStatus();
  }, [fetchSystemStatus]);

  const getCurrentTenantId = (): string | null => {
    return localStorage.getItem(STORAGE_TENANT_ID_KEY);
  };

  const isTenantHeaderInjectionActive = (): boolean => {
    const tenantId = getCurrentTenantId();
    return tenantId !== null && tenantId.length > 0;
  };

  const testOnboardingContext = async () => {
    const tenantId = getCurrentTenantId();
    setOnboardingTestLoading(true);
    setOnboardingTestResult(null);

    const startTime = Date.now();
    try {
      if (!tenantId) {
        setOnboardingTestResult({
          success: false,
          tenantId: null,
          enabledModules: null,
          error: 'No tenant ID found in localStorage. Please log in first.',
          responseTime: Date.now() - startTime,
        });
        return;
      }

      const response = await api.get('/onboarding/context', {
        headers: { 'x-tenant-id': tenantId },
        timeout: 10000,
      });

      const responseTime = Date.now() - startTime;
      const data = response.data?.data || response.data;
      const context = data?.context || data;

      setOnboardingTestResult({
        success: true,
        tenantId,
        enabledModules: context?.enabledModules || null,
        responseTime,
      });
    } catch (err: unknown) {
      const responseTime = Date.now() - startTime;
      let errorMessage = 'Failed to fetch onboarding context';
      
      if (err && typeof err === 'object' && 'response' in err) {
        const axiosError = err as { response?: { status?: number; data?: { message?: string } } };
        if (axiosError.response?.status === 400) {
          errorMessage = axiosError.response.data?.message || 'Bad request - missing x-tenant-id header';
        } else if (axiosError.response?.status === 401) {
          errorMessage = 'Unauthorized - please log in again';
        } else if (axiosError.response?.status === 404) {
          errorMessage = 'Onboarding context endpoint not found';
        }
      } else if (err instanceof Error) {
        errorMessage = err.message;
      }

      setOnboardingTestResult({
        success: false,
        tenantId,
        enabledModules: null,
        error: errorMessage,
        responseTime,
      });
    } finally {
      setOnboardingTestLoading(false);
    }
  };

  // Fetch notification status (FAZ 5)
  const fetchNotificationStatus = useCallback(async () => {
    const tenantId = getCurrentTenantId();
    if (!tenantId) return;

    setNotificationLoading(true);
    try {
      const response = await api.get('/admin/notifications/status', {
        headers: { 'x-tenant-id': tenantId },
        timeout: 10000,
      });
      const data = response.data?.data || response.data;
      setNotificationStatus(data);
    } catch {
      // Endpoint may not exist yet
      setNotificationStatus(null);
    } finally {
      setNotificationLoading(false);
    }
  }, []);

  // Test notification (FAZ 5)
  const testNotification = async (provider: 'email' | 'webhook') => {
    const tenantId = getCurrentTenantId();
    if (!tenantId) return;

    setNotificationTestLoading(provider);
    setNotificationTestResult(null);
    try {
      const response = await api.post(
        '/admin/notifications/test',
        { provider },
        {
          headers: { 'x-tenant-id': tenantId },
          timeout: 30000,
        }
      );
      const data = response.data?.data || response.data;
      setNotificationTestResult({
        success: data.success,
        message: data.messageCode || (data.success ? 'Test notification sent' : 'Test notification failed'),
      });
      // Refresh status after test
      fetchNotificationStatus();
    } catch (err: unknown) {
      let message = 'Failed to send test notification';
      if (err && typeof err === 'object' && 'response' in err) {
        const axiosError = err as { response?: { data?: { message?: string } } };
        message = axiosError.response?.data?.message || message;
      }
      setNotificationTestResult({ success: false, message });
    } finally {
      setNotificationTestLoading(null);
    }
  };

  // Fetch jobs status (FAZ 5)
  const fetchJobsStatus = useCallback(async () => {
    const tenantId = getCurrentTenantId();
    if (!tenantId) return;

    setJobsLoading(true);
    try {
      const [statusResponse, validationResponse] = await Promise.all([
        api.get('/admin/jobs/status', {
          headers: { 'x-tenant-id': tenantId },
          timeout: 10000,
        }),
        api.get('/admin/jobs/platform-validation', {
          headers: { 'x-tenant-id': tenantId },
          timeout: 10000,
        }),
      ]);
      const statusData = statusResponse.data?.data || statusResponse.data;
      const validationData = validationResponse.data?.data || validationResponse.data;
      setJobsStatus(statusData);
      setPlatformValidation(validationData);
    } catch {
      // Endpoint may not exist yet
      setJobsStatus(null);
      setPlatformValidation(null);
    } finally {
      setJobsLoading(false);
    }
  }, []);

  // Trigger job manually (FAZ 5)
  const triggerJob = async (jobName: string) => {
    const tenantId = getCurrentTenantId();
    if (!tenantId) return;

    setJobTriggerLoading(jobName);
    try {
      await api.post(
        `/admin/jobs/trigger/${jobName}`,
        {},
        {
          headers: { 'x-tenant-id': tenantId },
          timeout: 120000, // Jobs can take a while
        }
      );
      // Refresh status after trigger
      fetchJobsStatus();
    } catch {
      // Handle error silently, status will show result
    } finally {
      setJobTriggerLoading(null);
    }
  };

  // Fetch platform data on mount (FAZ 5)
  useEffect(() => {
    if (getCurrentTenantId()) {
      fetchNotificationStatus();
      fetchJobsStatus();
    }
  }, [fetchNotificationStatus, fetchJobsStatus]);

  const formatEnabledModules = (modules: Record<string, string[]> | null): string => {
    if (!modules) return 'None';
    const entries = Object.entries(modules);
    if (entries.length === 0) return 'None';
    
    const parts: string[] = [];
    for (const [suite, moduleList] of entries) {
      if (moduleList && moduleList.length > 0) {
        parts.push(`${suite}: [${moduleList.join(', ')}]`);
      }
    }
    return parts.length > 0 ? parts.join('; ') : 'All suites empty';
  };

  const formatUptime = (seconds?: number): string => {
    if (!seconds) return 'N/A';
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${days}d ${hours}h ${minutes}m`;
  };

  const getStatusColor = (status: string): 'success' | 'warning' | 'error' | 'default' => {
    switch (status) {
      case 'healthy':
        return 'success';
      case 'degraded':
        return 'warning';
      case 'unhealthy':
        return 'error';
      case 'unavailable':
        return 'default';
      default:
        return 'default';
    }
  };

  const getStatusIcon = (status: string) => {
    if (status === 'healthy') {
      return <HealthyIcon color="success" />;
    } else if (status === 'unavailable') {
      return <InfoIcon color="action" />;
    } else {
      return <UnhealthyIcon color="error" />;
    }
  };

  const overallHealth = systemStatus
    ? Object.values(systemStatus.health).every(h => h.status === 'healthy')
      ? 'healthy'
      : Object.values(systemStatus.health).every(h => h.status === 'unavailable')
      ? 'unavailable'
      : Object.values(systemStatus.health).some(h => h.status === 'unhealthy')
      ? 'unhealthy'
      : 'degraded'
    : 'unknown';
  
  const hasUnavailableEndpoints = systemStatus
    ? Object.values(systemStatus.health).some(h => h.status === 'unavailable')
    : false;

  return (
    <Box>
      <AdminPageHeader
        title="System Status"
        subtitle="Monitor system health and configuration"
        breadcrumbs={[
          { label: 'Admin', href: '/admin' },
          { label: 'System' },
        ]}
        actions={
          <Button startIcon={<RefreshIcon />} onClick={fetchSystemStatus} disabled={loading}>
            {loading ? 'Checking...' : 'Refresh'}
          </Button>
        }
      />

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {hasUnavailableEndpoints && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Health endpoints are not available in this environment. Some status information may be unavailable.
        </Alert>
      )}

      {/* Overall status card - always rendered with loading state support */}
      <Card sx={{ 
        mb: 3, 
        bgcolor: loading && !systemStatus 
          ? 'grey.100'
          : overallHealth === 'healthy' 
          ? 'success.light' 
          : overallHealth === 'degraded' 
          ? 'warning.light' 
          : overallHealth === 'unavailable'
          ? 'grey.100'
          : 'error.light' 
      }}>
        <CardContent sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {loading && !systemStatus ? (
              <CircularProgress size={24} />
            ) : (
              getStatusIcon(overallHealth)
            )}
            <Box>
              <Typography variant="h6">
                {loading && !systemStatus 
                  ? 'Checking System Status...' 
                  : `System Status: ${overallHealth.charAt(0).toUpperCase() + overallHealth.slice(1)}`}
              </Typography>
              {lastChecked && (
                <Typography variant="body2" color="text.secondary">
                  Last checked: {lastChecked.toLocaleTimeString()}
                </Typography>
              )}
            </Box>
          </Box>
          {loading && !systemStatus ? (
            <Skeleton variant="rounded" width={80} height={24} />
          ) : (
            <Chip
              label={overallHealth.toUpperCase()}
              color={getStatusColor(overallHealth)}
              size="medium"
            />
          )}
        </CardContent>
      </Card>

      <Typography variant="h6" gutterBottom>
        Health Checks
      </Typography>
      {/* Widgets container - always present with data-testid for E2E tests */}
      <Grid container spacing={3} sx={{ mb: 4 }} data-testid="system-status-widgets">
        <Grid item xs={12} sm={6} md={4}>
          <AdminCard title="API" icon={<ApiIcon />}>
            {loading && !systemStatus ? (
              <Box>
                <Skeleton variant="rounded" width={80} height={24} sx={{ mb: 1 }} />
                <Skeleton variant="text" width={60} />
              </Box>
            ) : systemStatus ? (
              <>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Chip
                    label={systemStatus.health.api.status.toUpperCase()}
                    color={getStatusColor(systemStatus.health.api.status)}
                    size="small"
                  />
                  {systemStatus.health.api.responseTime && (
                    <Typography variant="caption" color="text.secondary">
                      {systemStatus.health.api.responseTime}ms
                    </Typography>
                  )}
                </Box>
                {systemStatus.health.api.message && systemStatus.health.api.status !== 'healthy' && (
                  <Typography 
                    variant="caption" 
                    color={systemStatus.health.api.status === 'unavailable' ? 'text.secondary' : 'error'} 
                    sx={{ mt: 1, display: 'block' }}
                  >
                    {systemStatus.health.api.message}
                  </Typography>
                )}
              </>
            ) : (
              <Typography variant="body2" color="text.secondary">No data</Typography>
            )}
          </AdminCard>
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <AdminCard title="Database" icon={<DatabaseIcon />}>
            {loading && !systemStatus ? (
              <Box>
                <Skeleton variant="rounded" width={80} height={24} sx={{ mb: 1 }} />
                <Skeleton variant="text" width={60} />
              </Box>
            ) : systemStatus ? (
              <>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Chip
                    label={systemStatus.health.database.status.toUpperCase()}
                    color={getStatusColor(systemStatus.health.database.status)}
                    size="small"
                  />
                  {systemStatus.health.database.responseTime && (
                    <Typography variant="caption" color="text.secondary">
                      {systemStatus.health.database.responseTime}ms
                    </Typography>
                  )}
                </Box>
                {systemStatus.health.database.message && systemStatus.health.database.status !== 'healthy' && (
                  <Typography 
                    variant="caption" 
                    color={systemStatus.health.database.status === 'unavailable' ? 'text.secondary' : 'error'} 
                    sx={{ mt: 1, display: 'block' }}
                  >
                    {systemStatus.health.database.message}
                  </Typography>
                )}
              </>
            ) : (
              <Typography variant="body2" color="text.secondary">No data</Typography>
            )}
          </AdminCard>
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <AdminCard title="Auth" icon={<InfoIcon />}>
            {loading && !systemStatus ? (
              <Box>
                <Skeleton variant="rounded" width={80} height={24} sx={{ mb: 1 }} />
                <Skeleton variant="text" width={60} />
              </Box>
            ) : systemStatus ? (
              <>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Chip
                    label={systemStatus.health.auth.status.toUpperCase()}
                    color={getStatusColor(systemStatus.health.auth.status)}
                    size="small"
                  />
                  {systemStatus.health.auth.responseTime && (
                    <Typography variant="caption" color="text.secondary">
                      {systemStatus.health.auth.responseTime}ms
                    </Typography>
                  )}
                </Box>
                {systemStatus.health.auth.message && systemStatus.health.auth.status !== 'healthy' && (
                  <Typography 
                    variant="caption" 
                    color={systemStatus.health.auth.status === 'unavailable' ? 'text.secondary' : 'error'} 
                    sx={{ mt: 1, display: 'block' }}
                  >
                    {systemStatus.health.auth.message}
                  </Typography>
                )}
              </>
            ) : (
              <Typography variant="body2" color="text.secondary">No data</Typography>
            )}
          </AdminCard>
        </Grid>
      </Grid>

      {/* System Information and remaining sections - only show when data is available */}
      {systemStatus ? (
        <>
          <Typography variant="h6" gutterBottom>
            System Information
          </Typography>
          <Grid container spacing={3}>
            <Grid item xs={12} sm={6} md={3}>
              <AdminCard
                title="Frontend Version"
                icon={<VersionIcon />}
                value={systemStatus.frontendVersion}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <AdminCard
                title="API Base URL"
                icon={<ApiIcon />}
                value={systemStatus.apiBaseUrl}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <AdminCard
                title="Uptime"
                icon={<UptimeIcon />}
                value={formatUptime(systemStatus.uptime)}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <AdminCard
                title="Environment"
                icon={<InfoIcon />}
                value={systemStatus.environment || 'production'}
              />
            </Grid>
          </Grid>

          <Divider sx={{ my: 4 }} />

          <Typography variant="h6" gutterBottom>
            Tenant Diagnostics
          </Typography>
          <Grid container spacing={3} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={6} md={4}>
              <AdminCard title="Current Tenant ID" icon={<TenantIcon />}>
                <Typography 
                  variant="body2" 
                  sx={{ 
                    fontFamily: 'monospace', 
                    wordBreak: 'break-all',
                    color: getCurrentTenantId() ? 'text.primary' : 'error.main'
                  }}
                >
                  {getCurrentTenantId() || 'Not set (login required)'}
                </Typography>
              </AdminCard>
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <AdminCard title="Tenant Header Injection" icon={<ApiIcon />}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Chip
                    label={isTenantHeaderInjectionActive() ? 'ACTIVE' : 'INACTIVE'}
                    color={isTenantHeaderInjectionActive() ? 'success' : 'error'}
                    size="small"
                  />
                  <Typography variant="caption" color="text.secondary">
                    {isTenantHeaderInjectionActive() 
                      ? 'x-tenant-id header will be added to API calls' 
                      : 'No tenant ID available for header injection'}
                  </Typography>
                </Box>
              </AdminCard>
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <AdminCard title="Test Onboarding Context" icon={<TestIcon />}>
                <Button
                  variant="contained"
                  size="small"
                  onClick={testOnboardingContext}
                  disabled={onboardingTestLoading || !getCurrentTenantId()}
                  startIcon={onboardingTestLoading ? <CircularProgress size={16} /> : <TestIcon />}
                  sx={{ mb: 1 }}
                >
                  {onboardingTestLoading ? 'Testing...' : 'Test Context'}
                </Button>
                {!getCurrentTenantId() && (
                  <Typography variant="caption" color="text.secondary" display="block">
                    Login required to test
                  </Typography>
                )}
              </AdminCard>
            </Grid>
          </Grid>

          {onboardingTestResult && (
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="subtitle1" gutterBottom>
                  Onboarding Context Test Result
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <Chip
                    label={onboardingTestResult.success ? 'SUCCESS' : 'FAILED'}
                    color={onboardingTestResult.success ? 'success' : 'error'}
                    size="small"
                  />
                  {onboardingTestResult.responseTime && (
                    <Typography variant="caption" color="text.secondary">
                      {onboardingTestResult.responseTime}ms
                    </Typography>
                  )}
                </Box>
                {onboardingTestResult.error && (
                  <Alert severity="error" sx={{ mb: 2 }}>
                    {onboardingTestResult.error}
                  </Alert>
                )}
                {onboardingTestResult.success && (
                  <Box>
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      <strong>Tenant ID:</strong>{' '}
                      <code style={{ fontFamily: 'monospace' }}>{onboardingTestResult.tenantId}</code>
                    </Typography>
                    <Typography variant="body2">
                      <strong>Enabled Modules:</strong>{' '}
                      {formatEnabledModules(onboardingTestResult.enabledModules)}
                    </Typography>
                    {onboardingTestResult.enabledModules && 
                     Object.values(onboardingTestResult.enabledModules).every(arr => arr.length === 0) && (
                      <Alert severity="warning" sx={{ mt: 2 }}>
                        All module arrays are empty. Run the onboarding seed script to enable modules for this tenant.
                      </Alert>
                    )}
                  </Box>
                )}
              </CardContent>
            </Card>
          )}

          {/* Notification Status Section (FAZ 5) */}
          <Divider sx={{ my: 4 }} />
          <Typography variant="h6" gutterBottom>
            {t(ADMIN_PLATFORM_KEYS.notifications.title)}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {t(ADMIN_PLATFORM_KEYS.notifications.subtitle)}
          </Typography>
          
          {notificationLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
              <CircularProgress size={24} />
            </Box>
          ) : notificationStatus ? (
            <>
              <Grid container spacing={3} sx={{ mb: 3 }}>
                <Grid item xs={12} sm={6} md={4}>
                  <AdminCard title={t(ADMIN_PLATFORM_KEYS.notifications.emailProvider)} icon={<EmailIcon />}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                      <Chip
                        label={notificationStatus.email.enabled ? t(ADMIN_PLATFORM_KEYS.notifications.enabled) : t(ADMIN_PLATFORM_KEYS.notifications.disabled)}
                        color={notificationStatus.email.enabled ? 'success' : 'default'}
                        size="small"
                      />
                      <Chip
                        label={notificationStatus.email.configured ? t(ADMIN_PLATFORM_KEYS.notifications.configured) : t(ADMIN_PLATFORM_KEYS.notifications.notConfigured)}
                        color={notificationStatus.email.configured ? 'info' : 'warning'}
                        size="small"
                        variant="outlined"
                      />
                    </Box>
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={() => testNotification('email')}
                      disabled={notificationTestLoading !== null || !notificationStatus.email.enabled}
                      startIcon={notificationTestLoading === 'email' ? <CircularProgress size={16} /> : <TestIcon />}
                      fullWidth
                    >
                      {t(ADMIN_PLATFORM_KEYS.notifications.testEmail)}
                    </Button>
                  </AdminCard>
                </Grid>
                <Grid item xs={12} sm={6} md={4}>
                  <AdminCard title={t(ADMIN_PLATFORM_KEYS.notifications.webhookProvider)} icon={<WebhookIcon />}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                      <Chip
                        label={notificationStatus.webhook.enabled ? t(ADMIN_PLATFORM_KEYS.notifications.enabled) : t(ADMIN_PLATFORM_KEYS.notifications.disabled)}
                        color={notificationStatus.webhook.enabled ? 'success' : 'default'}
                        size="small"
                      />
                      <Chip
                        label={notificationStatus.webhook.configured ? t(ADMIN_PLATFORM_KEYS.notifications.configured) : t(ADMIN_PLATFORM_KEYS.notifications.notConfigured)}
                        color={notificationStatus.webhook.configured ? 'info' : 'warning'}
                        size="small"
                        variant="outlined"
                      />
                    </Box>
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={() => testNotification('webhook')}
                      disabled={notificationTestLoading !== null || !notificationStatus.webhook.enabled}
                      startIcon={notificationTestLoading === 'webhook' ? <CircularProgress size={16} /> : <TestIcon />}
                      fullWidth
                    >
                      {t(ADMIN_PLATFORM_KEYS.notifications.testWebhook)}
                    </Button>
                  </AdminCard>
                </Grid>
                <Grid item xs={12} sm={6} md={4}>
                  <AdminCard title={t(ADMIN_PLATFORM_KEYS.notifications.recentLogs)} icon={<InfoIcon />}>
                    <Typography variant="body2">
                      <strong>Total:</strong> {notificationStatus.recentLogs.total}
                    </Typography>
                    <Typography variant="body2" color="success.main">
                      <strong>{t(ADMIN_PLATFORM_KEYS.notifications.success)}:</strong> {notificationStatus.recentLogs.success}
                    </Typography>
                    <Typography variant="body2" color="error.main">
                      <strong>{t(ADMIN_PLATFORM_KEYS.notifications.failed)}:</strong> {notificationStatus.recentLogs.failed}
                    </Typography>
                    {notificationStatus.recentLogs.lastAttempt && (
                      <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                        {t(ADMIN_PLATFORM_KEYS.notifications.lastAttempt)}: {new Date(notificationStatus.recentLogs.lastAttempt).toLocaleString()}
                      </Typography>
                    )}
                  </AdminCard>
                </Grid>
              </Grid>
              
              {notificationTestResult && (
                <Alert 
                  severity={notificationTestResult.success ? 'success' : 'error'} 
                  sx={{ mb: 3 }}
                  onClose={() => setNotificationTestResult(null)}
                >
                  {notificationTestResult.message}
                </Alert>
              )}
            </>
          ) : (
            <Alert severity="info" sx={{ mb: 3 }}>
              {!getCurrentTenantId() 
                ? 'Login required to view notification status' 
                : 'Notification status not available. The notifications module may not be configured.'}
            </Alert>
          )}

          {/* Background Jobs Section (FAZ 5) */}
          <Divider sx={{ my: 4 }} />
          <Typography variant="h6" gutterBottom>
            {t(ADMIN_PLATFORM_KEYS.jobs.title)}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {t(ADMIN_PLATFORM_KEYS.jobs.subtitle)}
          </Typography>
          
          {jobsLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
              <CircularProgress size={24} />
            </Box>
          ) : jobsStatus ? (
            <>
              {/* Platform Validation Summary */}
              <Card sx={{ mb: 3 }}>
                <CardContent>
                  <Typography variant="subtitle1" gutterBottom>
                    {t(ADMIN_PLATFORM_KEYS.jobs.platformValidation)}
                  </Typography>
                  {platformValidation?.hasResult && platformValidation.result ? (
                    <Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        {platformValidation.result.success ? (
                          <HealthyIcon color="success" />
                        ) : (
                          <UnhealthyIcon color="error" />
                        )}
                        <Typography variant="body1">
                          {platformValidation.result.success 
                            ? t(ADMIN_PLATFORM_KEYS.jobs.validationPassed)
                            : t(ADMIN_PLATFORM_KEYS.jobs.validationFailed)}
                        </Typography>
                      </Box>
                      <Typography variant="body2" color="text.secondary">
                        Checks: {platformValidation.result.summary.passed}/{platformValidation.result.summary.total} passed
                        {platformValidation.result.summary.failed > 0 && (
                          <span style={{ color: 'red' }}> ({platformValidation.result.summary.failed} failed)</span>
                        )}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" display="block">
                        Last run: {new Date(platformValidation.result.timestamp).toLocaleString()}
                      </Typography>
                    </Box>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      {t(ADMIN_PLATFORM_KEYS.jobs.noValidationResult)}
                    </Typography>
                  )}
                </CardContent>
              </Card>

              {/* Registered Jobs */}
              <Typography variant="subtitle1" gutterBottom>
                {t(ADMIN_PLATFORM_KEYS.jobs.registeredJobs)} ({jobsStatus.enabledJobs}/{jobsStatus.totalJobs} enabled)
              </Typography>
              <Grid container spacing={3} sx={{ mb: 3 }}>
                {jobsStatus.registeredJobs.map((job) => (
                  <Grid item xs={12} sm={6} md={4} key={job.name}>
                    <AdminCard title={job.name} icon={<JobIcon />}>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                        {job.description}
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        <Chip
                          label={job.enabled ? 'Enabled' : 'Disabled'}
                          color={job.enabled ? 'success' : 'default'}
                          size="small"
                        />
                        {job.scheduleIntervalMs && (
                          <Chip
                            icon={<ScheduleIcon />}
                            label={`Every ${Math.round(job.scheduleIntervalMs / 3600000)}h`}
                            size="small"
                            variant="outlined"
                          />
                        )}
                      </Box>
                      <Typography variant="caption" display="block">
                        Runs: {job.runCount} (Success: {job.successCount}, Failed: {job.failureCount})
                      </Typography>
                      {job.lastRun && (
                        <Typography variant="caption" color="text.secondary" display="block">
                          Last: {new Date(job.lastRun.startedAt).toLocaleString()} ({job.lastRun.status})
                        </Typography>
                      )}
                      {job.nextRunAt && (
                        <Typography variant="caption" color="text.secondary" display="block">
                          Next: {new Date(job.nextRunAt).toLocaleString()}
                        </Typography>
                      )}
                      <Button
                        variant="outlined"
                        size="small"
                        onClick={() => triggerJob(job.name)}
                        disabled={jobTriggerLoading !== null || !job.enabled}
                        startIcon={jobTriggerLoading === job.name ? <CircularProgress size={16} /> : <TestIcon />}
                        fullWidth
                        sx={{ mt: 1 }}
                      >
                        {t(ADMIN_PLATFORM_KEYS.jobs.triggerJob)}
                      </Button>
                    </AdminCard>
                  </Grid>
                ))}
              </Grid>

              {/* Recent Job Runs */}
              {jobsStatus.recentRuns.length > 0 && (
                <Card>
                  <CardContent>
                    <Typography variant="subtitle1" gutterBottom>
                      {t(ADMIN_PLATFORM_KEYS.jobs.recentRuns)}
                    </Typography>
                    {jobsStatus.recentRuns.slice(0, 5).map((run) => (
                      <Box key={run.jobId} sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
                        <Chip
                          label={run.status}
                          color={run.status === 'success' ? 'success' : run.status === 'failed' ? 'error' : 'default'}
                          size="small"
                        />
                        <Typography variant="body2" sx={{ flex: 1 }}>
                          {run.jobName}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {run.durationMs}ms
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {new Date(run.startedAt).toLocaleString()}
                        </Typography>
                      </Box>
                    ))}
                  </CardContent>
                </Card>
              )}
            </>
          ) : (
            <Alert severity="info" sx={{ mb: 3 }}>
              {!getCurrentTenantId() 
                ? 'Login required to view jobs status' 
                : 'Jobs status not available. The jobs module may not be configured.'}
            </Alert>
          )}
        </>
      ) : (
        <Alert severity="warning">
          Unable to fetch system status. Please try refreshing.
        </Alert>
      )}
    </Box>
  );
};

export default AdminSystem;
