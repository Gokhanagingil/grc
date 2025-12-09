import React, { useState, useMemo, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  AppBar,
  Box,
  CssBaseline,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
  Avatar,
  Menu,
  MenuItem,
  Divider,
  Chip,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Dashboard as DashboardIcon,
  AccountBalance as GovernanceIcon,
  Security as RiskIcon,
  Gavel as ComplianceIcon,
  People as UsersIcon,
  Logout as LogoutIcon,
  Settings as SettingsIcon,
  AdminPanelSettings as AdminIcon,
  CheckCircle as TodoIcon,
  AccountTree as DotWalkingIcon,
  ReportProblem as IncidentIcon,
  FactCheck as AuditIcon,
  Assessment as AuditDashboardIcon,
  VerifiedUser as ComplianceDashboardIcon,
  HealthAndSafety as GrcHealthIcon,
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { moduleApi } from '../services/platformApi';

const drawerWidth = 240;

interface NavMenuItem {
  text: string;
  icon: React.ReactNode;
  path: string;
  roles?: ('admin' | 'manager' | 'user')[];
  moduleKey?: string;
}

const menuItems: NavMenuItem[] = [
  { text: 'Dashboard', icon: <DashboardIcon />, path: '/dashboard' },
  { text: 'To-Do', icon: <TodoIcon />, path: '/todos' },
  { text: 'Governance', icon: <GovernanceIcon />, path: '/governance', moduleKey: 'policy' },
  { text: 'Risk Management', icon: <RiskIcon />, path: '/risk', moduleKey: 'risk' },
  { text: 'Compliance', icon: <ComplianceIcon />, path: '/compliance', moduleKey: 'compliance' },
  { text: 'Audits', icon: <AuditIcon />, path: '/audits', moduleKey: 'audit' },
  { text: 'Incidents', icon: <IncidentIcon />, path: '/incidents', moduleKey: 'itsm.incident' },
  { text: 'Audit Dashboard', icon: <AuditDashboardIcon />, path: '/dashboards/audit', moduleKey: 'audit' },
  { text: 'Compliance Dashboard', icon: <ComplianceDashboardIcon />, path: '/dashboards/compliance', moduleKey: 'compliance' },
  { text: 'GRC Health', icon: <GrcHealthIcon />, path: '/dashboards/grc-health', roles: ['admin', 'manager'] },
  { text: 'Query Builder', icon: <DotWalkingIcon />, path: '/dotwalking' },
  { text: 'User Management', icon: <UsersIcon />, path: '/users', roles: ['admin', 'manager'] },
  { text: 'Admin Panel', icon: <AdminIcon />, path: '/admin', roles: ['admin'], moduleKey: 'platform.admin' },
];

export const Layout: React.FC = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [enabledModules, setEnabledModules] = useState<string[]>([]);
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const fetchEnabledModules = async () => {
      try {
        const response = await moduleApi.getEnabled();
        setEnabledModules(response.data.enabledModules);
      } catch (error) {
        console.error('Error fetching enabled modules:', error);
        setEnabledModules(['risk', 'policy', 'compliance', 'audit', 'platform.admin']);
      }
    };
    fetchEnabledModules();
  }, []);

  const filteredMenuItems = useMemo(() => {
    if (!user) return [];
    return menuItems.filter((item) => {
      if (item.roles && !item.roles.includes(user.role)) {
        return false;
      }
      if (item.moduleKey && !enabledModules.includes(item.moduleKey)) {
        return false;
      }
      return true;
    });
  }, [user, enabledModules]);

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleProfileMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleProfileMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    logout();
    handleProfileMenuClose();
  };

  const drawer = (
    <div>
      <Toolbar>
        <Typography variant="h6" noWrap component="div" sx={{ fontWeight: 'bold' }}>
          GRC Platform
        </Typography>
      </Toolbar>
      <Divider />
      <List>
        {filteredMenuItems.map((item) => (
          <ListItem key={item.text} disablePadding>
            <ListItemButton
              selected={location.pathname === item.path}
              onClick={() => navigate(item.path)}
              sx={{
                '&.Mui-selected': {
                  backgroundColor: 'primary.main',
                  color: 'white',
                  '&:hover': {
                    backgroundColor: 'primary.dark',
                  },
                },
              }}
            >
              <ListItemIcon
                sx={{
                  color: location.pathname === item.path ? 'white' : 'inherit',
                }}
              >
                {item.icon}
              </ListItemIcon>
              <ListItemText primary={item.text} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
    </div>
  );

  return (
    <Box sx={{ display: 'flex' }}>
      <CssBaseline />
      <AppBar
        position="fixed"
        sx={{
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          ml: { sm: `${drawerWidth}px` },
        }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { sm: 'none' } }}
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
            {menuItems.find(item => item.path === location.pathname)?.text || 'GRC Platform'}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Chip
              label={user?.role?.toUpperCase()}
              size="small"
              color={user?.role === 'admin' ? 'error' : user?.role === 'manager' ? 'warning' : 'default'}
              sx={{ fontWeight: 'bold' }}
            />
            <Typography variant="body2">
              {user?.firstName} {user?.lastName}
            </Typography>
            <IconButton
              size="large"
              edge="end"
              aria-label="account of current user"
              aria-controls="primary-search-account-menu"
              aria-haspopup="true"
              onClick={handleProfileMenuOpen}
              color="inherit"
            >
              <Avatar sx={{ width: 32, height: 32 }}>
                {user?.firstName?.[0]}{user?.lastName?.[0]}
              </Avatar>
            </IconButton>
          </Box>
        </Toolbar>
      </AppBar>
      <Box
        component="nav"
        sx={{ width: { sm: drawerWidth }, flexShrink: { sm: 0 } }}
        aria-label="mailbox folders"
      >
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{
            keepMounted: true,
          }}
          sx={{
            display: { xs: 'block', sm: 'none' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
          }}
        >
          {drawer}
        </Drawer>
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', sm: 'block' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
          }}
          open
        >
          {drawer}
        </Drawer>
      </Box>
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          width: { sm: `calc(100% - ${drawerWidth}px)` },
        }}
      >
        <Toolbar />
        <Outlet />
      </Box>
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleProfileMenuClose}
        onClick={handleProfileMenuClose}
      >
        <MenuItem onClick={handleProfileMenuClose}>
          <ListItemIcon>
            <SettingsIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Profile Settings</ListItemText>
        </MenuItem>
        <Divider />
        <MenuItem onClick={handleLogout}>
          <ListItemIcon>
            <LogoutIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Logout</ListItemText>
        </MenuItem>
      </Menu>
    </Box>
  );
};
