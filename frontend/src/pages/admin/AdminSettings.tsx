import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Button,
  Grid,
  Typography,
  Chip,
  Alert,
  CircularProgress,
  List,
  ListItem,
  ListItemText,
  Divider,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Storage as StorageIcon,
  Security as SecurityIcon,
  Settings as SettingsIcon,
  Info as InfoIcon,
  Cloud as CloudIcon,
  Timer as TimerIcon,
} from '@mui/icons-material';
import { AdminPageHeader, AdminCard } from '../../components/admin';
import { api } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

interface SystemInfo {
  backendVersion: string;
  frontendVersion: string;
  apiGatewayStatus: string;
  jwtExpiry: string;
  activeTenant: string;
  logLevel: string;
  storageProvider: string;
  nodeEnv: string;
  uptime: number;
  databaseStatus: string;
}

interface SystemSetting {
  key: string;
  value: string;
  description: string | null;
  category: string | null;
}

export const AdminSettings: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [settings, setSettings] = useState<SystemSetting[]>([]);

  const fetchSystemInfo = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Use /health/live and /health/db instead of non-existent /health/detailed
      const [liveResponse, dbResponse, settingsResponse] = await Promise.all([
        api.get('/health/live').catch(() => ({ data: null })),
        api.get('/health/db').catch(() => ({ data: null })),
        api.get('/settings/system').catch(() => ({ data: { settings: [] } })),
      ]);

      const liveData = liveResponse.data?.data || liveResponse.data;
      const dbData = dbResponse.data?.data || dbResponse.data;
      const settingsData = settingsResponse.data?.data?.settings || 
                          settingsResponse.data?.settings || [];

      setSystemInfo({
        backendVersion: liveData?.service || process.env.REACT_APP_VERSION || '1.0.0',
        frontendVersion: process.env.REACT_APP_VERSION || '1.0.0',
        apiGatewayStatus: liveData?.status === 'ok' ? 'Healthy' : 'Unknown',
        jwtExpiry: '24 hours',
        activeTenant: user?.tenantId || 'Default',
        logLevel: 'info',
        storageProvider: 'Local',
        nodeEnv: 'production',
        uptime: liveData?.uptime || 0,
        databaseStatus: dbData?.details?.connected ? 'OK' : 'Unknown',
      });

      setSettings(settingsData);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch system information';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [user?.tenantId]);

  useEffect(() => {
    fetchSystemInfo();
  }, [fetchSystemInfo]);

  const formatUptime = (seconds: number): string => {
    if (!seconds) return 'N/A';
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${days}d ${hours}h ${minutes}m`;
  };

  const groupedSettings = settings.reduce((acc, setting) => {
    const category = setting.category || 'general';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(setting);
    return acc;
  }, {} as Record<string, SystemSetting[]>);

  const categoryIcons: Record<string, React.ReactNode> = {
    security: <SecurityIcon />,
    localization: <SettingsIcon />,
    limits: <StorageIcon />,
    audit: <InfoIcon />,
    general: <SettingsIcon />,
  };

  return (
    <Box>
      <AdminPageHeader
        title="System Settings"
        subtitle="View system configuration and status"
        breadcrumbs={[
          { label: 'Admin', href: '/admin' },
          { label: 'Settings' },
        ]}
        actions={
          <Button startIcon={<RefreshIcon />} onClick={fetchSystemInfo}>
            Refresh
          </Button>
        }
      />

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Alert severity="info" sx={{ mb: 3 }}>
        System settings are currently read-only. Configuration changes require backend access.
      </Alert>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          <Typography variant="h6" gutterBottom>
            System Status
          </Typography>
          <Grid container spacing={3} sx={{ mb: 4 }}>
            <Grid item xs={12} sm={6} md={3}>
              <AdminCard
                title="Backend Version"
                icon={<InfoIcon />}
                value={systemInfo?.backendVersion || 'N/A'}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <AdminCard
                title="Frontend Version"
                icon={<InfoIcon />}
                value={systemInfo?.frontendVersion || 'N/A'}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <AdminCard
                title="API Gateway"
                icon={<CloudIcon />}
              >
                <Chip
                  label={systemInfo?.apiGatewayStatus || 'Unknown'}
                  color={systemInfo?.apiGatewayStatus === 'Healthy' ? 'success' : 'warning'}
                  size="small"
                />
              </AdminCard>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <AdminCard
                title="Database"
                icon={<StorageIcon />}
              >
                <Chip
                  label={systemInfo?.databaseStatus || 'Unknown'}
                  color={systemInfo?.databaseStatus === 'OK' ? 'success' : 'warning'}
                  size="small"
                />
              </AdminCard>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <AdminCard
                title="Uptime"
                icon={<TimerIcon />}
                value={formatUptime(systemInfo?.uptime || 0)}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <AdminCard
                title="JWT Expiry"
                icon={<SecurityIcon />}
                value={systemInfo?.jwtExpiry || 'N/A'}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <AdminCard
                title="Active Tenant"
                icon={<StorageIcon />}
                value={systemInfo?.activeTenant || 'N/A'}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <AdminCard
                title="Storage Provider"
                icon={<CloudIcon />}
                value={systemInfo?.storageProvider || 'N/A'}
              />
            </Grid>
          </Grid>

          <Typography variant="h6" gutterBottom>
            Configuration Settings
          </Typography>
          <Grid container spacing={3}>
            {Object.entries(groupedSettings).map(([category, categorySettings]) => (
              <Grid item xs={12} md={6} key={category}>
                <AdminCard
                  title={category.charAt(0).toUpperCase() + category.slice(1)}
                  icon={categoryIcons[category] || <SettingsIcon />}
                >
                  <List dense>
                    {categorySettings.map((setting, index) => (
                      <React.Fragment key={setting.key}>
                        {index > 0 && <Divider />}
                        <ListItem sx={{ px: 0 }}>
                          <ListItemText
                            primary={setting.key}
                            secondary={
                              <>
                                <Typography
                                  component="span"
                                  variant="body2"
                                  color="primary"
                                >
                                  {setting.value}
                                </Typography>
                                {setting.description && (
                                  <Typography
                                    component="span"
                                    variant="caption"
                                    display="block"
                                    color="text.secondary"
                                  >
                                    {setting.description}
                                  </Typography>
                                )}
                              </>
                            }
                          />
                        </ListItem>
                      </React.Fragment>
                    ))}
                    {categorySettings.length === 0 && (
                      <ListItem sx={{ px: 0 }}>
                        <ListItemText
                          primary="No settings configured"
                          secondary="Settings will appear here when configured"
                        />
                      </ListItem>
                    )}
                  </List>
                </AdminCard>
              </Grid>
            ))}
            {Object.keys(groupedSettings).length === 0 && (
              <Grid item xs={12}>
                <Alert severity="info">
                  No configuration settings found. Default system settings are being used.
                </Alert>
              </Grid>
            )}
          </Grid>

          <Box sx={{ mt: 4 }}>
            <Typography variant="h6" gutterBottom>
              Environment Information
            </Typography>
            <AdminCard title="Runtime Environment" icon={<InfoIcon />}>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" color="text.secondary">
                    Node Environment
                  </Typography>
                  <Typography variant="body1">
                    {systemInfo?.nodeEnv || 'N/A'}
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" color="text.secondary">
                    Log Level
                  </Typography>
                  <Typography variant="body1">
                    {systemInfo?.logLevel || 'N/A'}
                  </Typography>
                </Grid>
              </Grid>
            </AdminCard>
          </Box>
        </>
      )}
    </Box>
  );
};

export default AdminSettings;
