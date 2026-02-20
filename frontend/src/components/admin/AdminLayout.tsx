import React, { useMemo } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  Box,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
  Typography,
  Chip,
} from '@mui/material';
import {
  People as UsersIcon,
  Security as RolesIcon,
  VpnKey as PermissionsIcon,
  Business as TenantsIcon,
  Settings as SettingsIcon,
  TableChart as TablesIcon,
  ViewColumn as FieldsIcon,
  AccountTree as WorkflowsIcon,
  ArrowBack as BackIcon,
  History as AuditLogsIcon,
  MonitorHeart as SystemIcon,
  Policy as FrameworksIcon,
  Schema as DataModelIcon,
  Build as QueryBuilderIcon,
  Notifications as NotificationsIcon,
  Api as ApiIcon,
  HealthAndSafety as HealthIcon,
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { ErrorBoundary } from '../common/ErrorBoundary';

const drawerWidth = 260;

interface AdminMenuItem {
  id: string;
  text: string;
  icon: React.ReactNode;
  path: string;
  disabled?: boolean;
  comingSoon?: boolean;
  requiredPermissions?: string[];
  children?: AdminMenuItem[];
}

const adminMenuItems: AdminMenuItem[] = [
  {
    id: 'users',
    text: 'Users',
    icon: <UsersIcon />,
    path: '/admin/users',
  },
  {
    id: 'roles',
    text: 'Roles',
    icon: <RolesIcon />,
    path: '/admin/roles',
  },
  {
    id: 'permissions',
    text: 'Permissions',
    icon: <PermissionsIcon />,
    path: '/admin/permissions',
    disabled: true,
  },
  {
    id: 'tenants',
    text: 'Tenants',
    icon: <TenantsIcon />,
    path: '/admin/tenants',
  },
  {
    id: 'audit-logs',
    text: 'Audit Logs',
    icon: <AuditLogsIcon />,
    path: '/admin/audit-logs',
  },
  {
    id: 'system',
    text: 'System Status',
    icon: <SystemIcon />,
    path: '/admin/system',
  },
  {
    id: 'settings',
    text: 'System Settings',
    icon: <SettingsIcon />,
    path: '/admin/settings',
  },
  {
    id: 'data-model',
    text: 'Data Model',
    icon: <DataModelIcon />,
    path: '/admin/data-model',
  },
  {
    id: 'frameworks',
    text: 'Frameworks',
    icon: <FrameworksIcon />,
    path: '/admin/frameworks',
  },
  {
    id: 'query-builder',
    text: 'Query Builder',
    icon: <QueryBuilderIcon />,
    path: '/dotwalking',
  },
  {
    id: 'notification-studio',
    text: 'Notification Studio',
    icon: <NotificationsIcon />,
    path: '/admin/notification-studio',
  },
  {
    id: 'api-catalog',
    text: 'API Catalog',
    icon: <ApiIcon />,
    path: '/admin/api-catalog',
  },
  {
    id: 'platform-health',
    text: 'Platform Health',
    icon: <HealthIcon />,
    path: '/admin/platform-health',
  },
];

const futureMenuItems: AdminMenuItem[] = [
  {
    id: 'tables',
    text: 'Tables',
    icon: <TablesIcon />,
    path: '/admin/tables',
    comingSoon: true,
  },
  {
    id: 'fields',
    text: 'Fields',
    icon: <FieldsIcon />,
    path: '/admin/fields',
    comingSoon: true,
  },
  {
    id: 'workflows',
    text: 'Workflows',
    icon: <WorkflowsIcon />,
    path: '/admin/workflows',
    comingSoon: true,
  },
];

export const AdminLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAdmin } = useAuth();

  const filteredMenuItems = useMemo(() => {
    if (!user || !isAdmin) return [];
    return adminMenuItems;
  }, [user, isAdmin]);

  const handleNavigation = (item: AdminMenuItem) => {
    if (item.disabled || item.comingSoon) return;
    navigate(item.path);
  };

  const isSelected = (path: string) => {
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  const drawer = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Typography variant="h6" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
          Admin Panel
        </Typography>
        <Typography variant="caption" color="text.secondary">
          System Administration
        </Typography>
      </Box>

      <List sx={{ flexGrow: 1, pt: 1 }}>
        <ListItem disablePadding>
          <ListItemButton onClick={() => navigate('/dashboard')}>
            <ListItemIcon>
              <BackIcon />
            </ListItemIcon>
            <ListItemText primary="Back to App" />
          </ListItemButton>
        </ListItem>

        <Divider sx={{ my: 1 }} />

        {filteredMenuItems.map((item) => {
          const testIdMap: Record<string, string> = {
            'users': 'nav-admin-users',
            'roles': 'nav-admin-roles',
            'tenants': 'nav-admin-tenants',
            'audit-logs': 'nav-admin-audit-logs',
            'system': 'nav-admin-system',
            'settings': 'nav-admin-settings',
          };
          const testId = testIdMap[item.id] || `nav-admin-${item.id}`;
          return (
            <ListItem key={item.id} disablePadding>
              <ListItemButton
                selected={isSelected(item.path)}
                onClick={() => handleNavigation(item)}
                disabled={item.disabled}
                data-testid={testId}
                sx={{
                  '&.Mui-selected': {
                    backgroundColor: 'primary.main',
                    color: 'white',
                    '&:hover': {
                      backgroundColor: 'primary.dark',
                    },
                    '& .MuiListItemIcon-root': {
                      color: 'white',
                    },
                  },
                  opacity: item.disabled ? 0.5 : 1,
                }}
              >
                <ListItemIcon
                  sx={{
                    color: isSelected(item.path) ? 'white' : 'inherit',
                  }}
                >
                  {item.icon}
                </ListItemIcon>
                <ListItemText primary={item.text} />
                {item.disabled && (
                  <Chip label="Read-only" size="small" variant="outlined" />
                )}
              </ListItemButton>
            </ListItem>
          );
        })}

        <Divider sx={{ my: 2 }} />

        <ListItem>
          <Typography variant="overline" color="text.secondary">
            Coming Soon
          </Typography>
        </ListItem>

        {futureMenuItems.map((item) => {
          const testIdMap: Record<string, string> = {
            'tables': 'section-tables-coming-soon',
            'fields': 'section-fields-coming-soon',
            'workflows': 'section-workflows-coming-soon',
          };
          const testId = testIdMap[item.id] || `section-${item.id}-coming-soon`;
          return (
            <ListItem key={item.id} disablePadding>
              <ListItemButton
                disabled
                data-testid={testId}
                sx={{ opacity: 0.5 }}
              >
                <ListItemIcon>{item.icon}</ListItemIcon>
                <ListItemText primary={item.text} />
                <Chip
                  label="Soon"
                  size="small"
                  color="info"
                  variant="outlined"
                />
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>

      <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
        <Typography variant="caption" color="text.secondary" display="block">
          Logged in as
        </Typography>
        <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
          {user?.firstName} {user?.lastName}
        </Typography>
        <Chip
          label={user?.role?.toUpperCase()}
          size="small"
          color="error"
          sx={{ mt: 0.5 }}
        />
      </Box>
    </Box>
  );

  if (!isAdmin) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
        }}
      >
        <Typography variant="h5" color="error">
          Access Denied: Admin privileges required
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <Drawer
        variant="permanent"
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: drawerWidth,
            boxSizing: 'border-box',
          },
        }}
      >
        {drawer}
      </Drawer>
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          backgroundColor: 'background.default',
          minHeight: '100vh',
        }}
      >
        <ErrorBoundary>
          <Outlet />
        </ErrorBoundary>
      </Box>
    </Box>
  );
};

export default AdminLayout;
