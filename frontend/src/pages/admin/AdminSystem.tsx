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
} from '@mui/icons-material';
import { AdminPageHeader, AdminCard } from '../../components/admin';
import { api } from '../../services/api';

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

export const AdminSystem: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

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

      {loading && !systemStatus ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      ) : systemStatus ? (
        <>
          <Card sx={{ 
            mb: 3, 
            bgcolor: overallHealth === 'healthy' 
              ? 'success.light' 
              : overallHealth === 'degraded' 
              ? 'warning.light' 
              : overallHealth === 'unavailable'
              ? 'grey.100'
              : 'error.light' 
          }}>
            <CardContent sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                {getStatusIcon(overallHealth)}
                <Box>
                  <Typography variant="h6">
                    System Status: {overallHealth.charAt(0).toUpperCase() + overallHealth.slice(1)}
                  </Typography>
                  {lastChecked && (
                    <Typography variant="body2" color="text.secondary">
                      Last checked: {lastChecked.toLocaleTimeString()}
                    </Typography>
                  )}
                </Box>
              </Box>
              <Chip
                label={overallHealth.toUpperCase()}
                color={getStatusColor(overallHealth)}
                size="medium"
              />
            </CardContent>
          </Card>

          <Typography variant="h6" gutterBottom>
            Health Checks
          </Typography>
          <Grid container spacing={3} sx={{ mb: 4 }}>
            <Grid item xs={12} sm={6} md={4}>
              <AdminCard title="API Gateway" icon={<ApiIcon />}>
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
              </AdminCard>
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <AdminCard title="Database" icon={<DatabaseIcon />}>
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
              </AdminCard>
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <AdminCard title="Authentication" icon={<InfoIcon />}>
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
              </AdminCard>
            </Grid>
          </Grid>

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
