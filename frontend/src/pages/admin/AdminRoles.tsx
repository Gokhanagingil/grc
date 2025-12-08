import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Typography,
  Chip,
  Grid,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
  Alert,
  CircularProgress,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Check as CheckIcon,
  Close as CloseIcon,
  AdminPanelSettings as AdminIcon,
  SupervisorAccount as ManagerIcon,
  Person as UserIcon,
} from '@mui/icons-material';
import { AdminPageHeader, AdminCard } from '../../components/admin';
import { api } from '../../services/api';

interface Permission {
  id: string;
  name: string;
  description: string;
}

interface RolePermissions {
  role: string;
  permissions: string[];
}

const ROLE_ICONS: Record<string, React.ReactNode> = {
  admin: <AdminIcon />,
  manager: <ManagerIcon />,
  user: <UserIcon />,
};

const ROLE_COLORS: Record<string, 'error' | 'warning' | 'default'> = {
  admin: 'error',
  manager: 'warning',
  user: 'default',
};

const ROLE_DESCRIPTIONS: Record<string, string> = {
  admin: 'Full system access including user management, settings, and all GRC/ITSM features',
  manager: 'Read/write access to GRC and ITSM features, including statistics',
  user: 'Read-only access to GRC and ITSM data',
};

const ALL_PERMISSIONS: Permission[] = [
  { id: 'grc:risk:read', name: 'View Risks', description: 'View risks and risk details' },
  { id: 'grc:risk:write', name: 'Manage Risks', description: 'Create, update, and delete risks' },
  { id: 'grc:policy:read', name: 'View Policies', description: 'View policies and policy details' },
  { id: 'grc:policy:write', name: 'Manage Policies', description: 'Create, update, and delete policies' },
  { id: 'grc:requirement:read', name: 'View Requirements', description: 'View requirements and requirement details' },
  { id: 'grc:requirement:write', name: 'Manage Requirements', description: 'Create, update, and delete requirements' },
  { id: 'grc:statistics:read', name: 'View Statistics', description: 'View statistics and analytics dashboards' },
  { id: 'grc:admin', name: 'Admin Access', description: 'Full administrative access to all GRC features' },
  { id: 'itsm:incident:read', name: 'View Incidents', description: 'View incidents and incident details' },
  { id: 'itsm:incident:write', name: 'Manage Incidents', description: 'Create, update, and delete incidents' },
  { id: 'itsm:statistics:read', name: 'ITSM Statistics', description: 'View ITSM statistics and analytics dashboards' },
];

const ROLE_PERMISSIONS_MAP: Record<string, string[]> = {
  admin: [
    'grc:risk:read',
    'grc:risk:write',
    'grc:policy:read',
    'grc:policy:write',
    'grc:requirement:read',
    'grc:requirement:write',
    'grc:statistics:read',
    'grc:admin',
    'itsm:incident:read',
    'itsm:incident:write',
    'itsm:statistics:read',
  ],
  manager: [
    'grc:risk:read',
    'grc:risk:write',
    'grc:policy:read',
    'grc:policy:write',
    'grc:requirement:read',
    'grc:requirement:write',
    'grc:statistics:read',
    'itsm:incident:read',
    'itsm:incident:write',
    'itsm:statistics:read',
  ],
  user: [
    'grc:risk:read',
    'grc:policy:read',
    'grc:requirement:read',
    'itsm:incident:read',
  ],
};

export const AdminRoles: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userStats, setUserStats] = useState<Record<string, number>>({});

  const fetchUserStats = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get('/users/statistics/overview');
      const data = response.data?.data || response.data;
      setUserStats({
        admin: data.admins || 0,
        manager: data.managers || 0,
        user: data.users || 0,
      });
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch user statistics';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUserStats();
  }, []);

  const roles = ['admin', 'manager', 'user'];

  return (
    <Box>
      <AdminPageHeader
        title="Roles & Permissions"
        subtitle="View role definitions and their associated permissions"
        breadcrumbs={[
          { label: 'Admin', href: '/admin' },
          { label: 'Roles' },
        ]}
        actions={
          <Button startIcon={<RefreshIcon />} onClick={fetchUserStats}>
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
        Role management is currently read-only. Custom role creation will be available in a future release.
      </Alert>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Grid container spacing={3}>
          {roles.map((role) => (
            <Grid item xs={12} md={4} key={role}>
              <Card sx={{ height: '100%' }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    <Box sx={{ color: `${ROLE_COLORS[role]}.main` }}>
                      {ROLE_ICONS[role]}
                    </Box>
                    <Typography variant="h6" sx={{ textTransform: 'capitalize' }}>
                      {role}
                    </Typography>
                    <Chip
                      label={`${userStats[role] || 0} users`}
                      size="small"
                      color={ROLE_COLORS[role]}
                    />
                  </Box>

                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    {ROLE_DESCRIPTIONS[role]}
                  </Typography>

                  <Divider sx={{ my: 2 }} />

                  <Typography variant="subtitle2" sx={{ mb: 1 }}>
                    Permissions
                  </Typography>

                  <List dense>
                    {ALL_PERMISSIONS.map((permission) => {
                      const hasPermission = ROLE_PERMISSIONS_MAP[role]?.includes(permission.id);
                      return (
                        <ListItem key={permission.id} sx={{ py: 0.5 }}>
                          <ListItemIcon sx={{ minWidth: 32 }}>
                            {hasPermission ? (
                              <CheckIcon color="success" fontSize="small" />
                            ) : (
                              <CloseIcon color="disabled" fontSize="small" />
                            )}
                          </ListItemIcon>
                          <ListItemText
                            primary={permission.name}
                            secondary={permission.description}
                            primaryTypographyProps={{
                              variant: 'body2',
                              color: hasPermission ? 'text.primary' : 'text.disabled',
                            }}
                            secondaryTypographyProps={{
                              variant: 'caption',
                              sx: { display: { xs: 'none', lg: 'block' } },
                            }}
                          />
                        </ListItem>
                      );
                    })}
                  </List>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      <Box sx={{ mt: 4 }}>
        <Typography variant="h6" gutterBottom>
          Permission Matrix
        </Typography>
        <Card>
          <CardContent>
            <Box sx={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '8px', borderBottom: '1px solid #ddd' }}>
                      Permission
                    </th>
                    {roles.map((role) => (
                      <th
                        key={role}
                        style={{
                          textAlign: 'center',
                          padding: '8px',
                          borderBottom: '1px solid #ddd',
                          textTransform: 'capitalize',
                        }}
                      >
                        {role}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ALL_PERMISSIONS.map((permission) => (
                    <tr key={permission.id}>
                      <td style={{ padding: '8px', borderBottom: '1px solid #eee' }}>
                        <Typography variant="body2">{permission.name}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {permission.id}
                        </Typography>
                      </td>
                      {roles.map((role) => (
                        <td
                          key={role}
                          style={{
                            textAlign: 'center',
                            padding: '8px',
                            borderBottom: '1px solid #eee',
                          }}
                        >
                          {ROLE_PERMISSIONS_MAP[role]?.includes(permission.id) ? (
                            <CheckIcon color="success" fontSize="small" />
                          ) : (
                            <CloseIcon color="disabled" fontSize="small" />
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </Box>
          </CardContent>
        </Card>
      </Box>
    </Box>
  );
};

export default AdminRoles;
