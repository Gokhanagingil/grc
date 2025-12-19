import React, { useState, useMemo, useEffect, useRef } from 'react';
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
  Collapse,
  Breadcrumbs,
  Link,
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
  AccountTreeOutlined as ProcessIcon,
  Warning as ViolationIcon,
  ExpandLess,
  ExpandMore,
  Folder as GrcIcon,
  Build as ItsmIcon,
  NavigateNext as NavigateNextIcon,
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { moduleApi } from '../services/platformApi';
import { ErrorBoundary } from './common/ErrorBoundary';
import { safeArray, safeIncludes } from '../utils/safeHelpers';

const drawerWidth = 240;

// Storage key for last known good route (used by InitializationErrorBoundary)
const LAST_GOOD_ROUTE_KEY = 'lastKnownGoodRoute';

interface NavMenuItem {
  text: string;
  icon: React.ReactNode;
  path: string;
  roles?: ('admin' | 'manager' | 'user')[];
  moduleKey?: string;
}

interface NavMenuGroup {
  id: string;
  text: string;
  icon: React.ReactNode;
  items: NavMenuItem[];
  roles?: ('admin' | 'manager' | 'user')[];
}

// Standalone items (not in groups)
const standaloneItems: NavMenuItem[] = [
  { text: 'Dashboard', icon: <DashboardIcon />, path: '/dashboard' },
  { text: 'To-Do', icon: <TodoIcon />, path: '/todos' },
];

// Grouped navigation items
const menuGroups: NavMenuGroup[] = [
  {
    id: 'grc',
    text: 'GRC',
    icon: <GrcIcon />,
    items: [
      { text: 'Risk Management', icon: <RiskIcon />, path: '/risk', moduleKey: 'risk' },
      { text: 'Policies', icon: <GovernanceIcon />, path: '/governance', moduleKey: 'policy' },
      { text: 'Requirements', icon: <ComplianceIcon />, path: '/compliance', moduleKey: 'compliance' },
      { text: 'Audits', icon: <AuditIcon />, path: '/audits', moduleKey: 'audit' },
      { text: 'Processes', icon: <ProcessIcon />, path: '/processes' },
      { text: 'Violations', icon: <ViolationIcon />, path: '/violations' },
    ],
  },
  {
    id: 'itsm',
    text: 'ITSM',
    icon: <ItsmIcon />,
    items: [
      { text: 'Incidents', icon: <IncidentIcon />, path: '/incidents' },
    ],
  },
  {
    id: 'dashboards',
    text: 'Dashboards',
    icon: <AuditDashboardIcon />,
    items: [
      { text: 'Audit Dashboard', icon: <AuditDashboardIcon />, path: '/dashboards/audit', moduleKey: 'audit' },
      { text: 'Compliance Dashboard', icon: <ComplianceDashboardIcon />, path: '/dashboards/compliance', moduleKey: 'compliance' },
      { text: 'GRC Health', icon: <GrcHealthIcon />, path: '/dashboards/grc-health', roles: ['admin', 'manager'] },
    ],
  },
  {
    id: 'admin',
    text: 'Admin',
    icon: <AdminIcon />,
    roles: ['admin'],
    items: [
      { text: 'User Management', icon: <UsersIcon />, path: '/users', roles: ['admin', 'manager'] },
      { text: 'Admin Panel', icon: <AdminIcon />, path: '/admin', roles: ['admin'], moduleKey: 'platform.admin' },
      { text: 'Query Builder', icon: <DotWalkingIcon />, path: '/dotwalking' },
    ],
  },
];

// Flat list for backward compatibility (page title lookup)
const menuItems: NavMenuItem[] = [
  ...standaloneItems,
  ...menuGroups.flatMap(g => g.items),
];

export const Layout: React.FC = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [enabledModules, setEnabledModules] = useState<string[]>([]);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    grc: true,
    itsm: false,
    dashboards: false,
    admin: false,
  });
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const fetchEnabledModules = async () => {
      console.log('[Layout] Fetching enabled modules...');
      try {
        const response = await moduleApi.getEnabled();
        // Handle both envelope format {success: true, data: {enabledModules: [...]}} 
        // and flat format {enabledModules: [...]}
        const responseData = response.data;
        let modules: string[] = [];
        
        if (responseData && typeof responseData === 'object') {
          // Check for NestJS envelope format
          if ('success' in responseData && 'data' in responseData) {
            const envelopeData = (responseData as { success: boolean; data: { enabledModules?: unknown } }).data;
            modules = safeArray(envelopeData?.enabledModules as string[] | undefined);
          } else if ('enabledModules' in responseData) {
            // Flat format
            modules = safeArray((responseData as { enabledModules?: unknown }).enabledModules as string[] | undefined);
          }
        }
        
        // If no modules found, use defaults
        if (modules.length === 0) {
          console.warn('[Layout] No enabled modules found in response, using defaults');
          modules = ['risk', 'policy', 'compliance', 'audit', 'platform.admin'];
        }
        
        console.log('[Layout] Enabled modules loaded:', modules.length, 'modules');
        setEnabledModules(modules);
      } catch (error) {
        console.error('[Layout] Error fetching enabled modules:', error);
        console.log('[Layout] Using default modules due to fetch error');
        setEnabledModules(['risk', 'policy', 'compliance', 'audit', 'platform.admin']);
      }
    };
    fetchEnabledModules();
  }, []);

  // Auto-expand group containing current path
  useEffect(() => {
    for (const group of menuGroups) {
      if (group.items.some(item => location.pathname.startsWith(item.path))) {
        setExpandedGroups(prev => ({ ...prev, [group.id]: true }));
        break;
      }
    }
  }, [location.pathname]);

  // Track last known good route for Safe Home strategy
  // This runs after successful render, so if we get here, the route is "good"
  const hasTrackedRoute = useRef(false);
  useEffect(() => {
    // Only track after initial render and if we have a valid path
    if (!hasTrackedRoute.current && location.pathname && location.pathname !== '/login') {
      hasTrackedRoute.current = true;
    }
    
    // Update last known good route on successful navigation
    // Exclude login page and error-prone paths
    const excludedPaths = ['/login', '/register', '/error'];
    const isExcluded = excludedPaths.some(p => location.pathname.startsWith(p));
    
    if (!isExcluded && location.pathname) {
      try {
        sessionStorage.setItem(LAST_GOOD_ROUTE_KEY, location.pathname);
      } catch {
        // Ignore storage errors
      }
    }
  }, [location.pathname]);

  const filterItem = (item: NavMenuItem): boolean => {
    if (!user) return false;
    // Use safeIncludes for role check (item.roles is static, but being defensive)
    if (item.roles && !safeIncludes(item.roles, user.role)) {
      return false;
    }
    // Use safeIncludes for module check (enabledModules comes from API)
    if (item.moduleKey && !safeIncludes(enabledModules, item.moduleKey)) {
      return false;
    }
    return true;
  };

  const filteredStandaloneItems = useMemo(() => {
    return standaloneItems.filter(filterItem);
  }, [user, enabledModules]);

  const filteredGroups = useMemo(() => {
    if (!user) return [];
    return menuGroups
      .filter(group => !group.roles || safeIncludes(group.roles, user.role))
      .map(group => ({
        ...group,
        items: group.items.filter(filterItem),
      }))
      .filter(group => group.items.length > 0);
  }, [user, enabledModules]);

  const filteredMenuItems = useMemo(() => {
    if (!user) return [];
    return menuItems.filter(filterItem);
  }, [user, enabledModules]);

  const handleGroupToggle = (groupId: string) => {
    setExpandedGroups(prev => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleProfileMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleProfileMenuClose = () => {
    setAnchorEl(null);
  };

  const handleProfileSettings = () => {
    handleProfileMenuClose();
    navigate('/profile');
  };

  const handleLogout = () => {
    logout();
    handleProfileMenuClose();
  };

  const isItemSelected = (path: string) => {
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  // Generate safe fallback label from path segment
  const getFallbackLabel = (segment: string): string => {
    if (!segment || segment.trim() === '') {
      return 'Details';
    }

    // Check if segment looks like an ID (numeric or UUID-like)
    const isIdLike = /^\d+$/.test(segment) || /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(segment);
    if (isIdLike) {
      return 'Details';
    }

    // Convert segment to readable label
    // Replace dashes and underscores with spaces, then title case
    const cleaned = segment
      .replace(/[-_]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (!cleaned) {
      return 'Details';
    }

    // Title case: capitalize first letter of each word
    return cleaned
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };

  // Generate breadcrumbs from current path
  const getBreadcrumbs = () => {
    const pathParts = location.pathname.split('/').filter(Boolean);
    const breadcrumbs: { label: string; path: string }[] = [];
    
    // Find the current item and its group
    let currentItem: NavMenuItem | undefined;
    let currentGroup: NavMenuGroup | undefined;
    
    for (const group of menuGroups) {
      const item = group.items.find(i => location.pathname.startsWith(i.path));
      if (item) {
        currentItem = item;
        currentGroup = group;
        break;
      }
    }
    
    // Check standalone items
    if (!currentItem) {
      currentItem = standaloneItems.find(i => location.pathname.startsWith(i.path));
    }
    
    // Build breadcrumbs
    if (currentGroup) {
      const groupLabel = currentGroup.text || getFallbackLabel(currentGroup.id);
      breadcrumbs.push({ label: groupLabel, path: currentGroup.items[0]?.path || '/' });
    }
    
    if (currentItem) {
      const itemLabel = currentItem.text || getFallbackLabel(pathParts[0] || '');
      breadcrumbs.push({ label: itemLabel, path: currentItem.path });
    }
    
    // Handle sub-pages (e.g., /audits/123)
    if (pathParts.length > 1) {
      const subPathParts = pathParts.slice(1);
      const subPath = subPathParts.join('/');
      
      if (subPath === 'new') {
        breadcrumbs.push({ label: 'New', path: location.pathname });
      } else if (subPath === 'edit') {
        breadcrumbs.push({ label: 'Edit', path: location.pathname });
      } else if (subPath && currentItem) {
        // Use fallback label for the last segment
        const lastSegment = subPathParts[subPathParts.length - 1];
        const fallbackLabel = getFallbackLabel(lastSegment);
        breadcrumbs.push({ label: fallbackLabel, path: location.pathname });
      }
    }
    
    // If no breadcrumbs were found, generate from path
    if (breadcrumbs.length === 0 && pathParts.length > 0) {
      pathParts.forEach((part, index) => {
        const path = '/' + pathParts.slice(0, index + 1).join('/');
        const label = getFallbackLabel(part);
        breadcrumbs.push({ label, path });
      });
    }
    
    // Ensure at least one breadcrumb
    if (breadcrumbs.length === 0) {
      breadcrumbs.push({ label: 'GRC Platform', path: '/' });
    }
    
    return breadcrumbs;
  };

  const breadcrumbs = getBreadcrumbs();
  const pageTitle = breadcrumbs.length > 0 
    ? breadcrumbs[breadcrumbs.length - 1]?.label || 'GRC Platform'
    : menuItems.find(item => item.path === location.pathname)?.text || 'GRC Platform';

  const drawer = (
    <div>
      <Toolbar>
        <Typography variant="h6" noWrap component="div" sx={{ fontWeight: 'bold' }}>
          GRC Platform
        </Typography>
      </Toolbar>
      <Divider />
      <List>
        {/* Standalone items */}
        {filteredStandaloneItems.map((item) => (
          <ListItem key={item.text} disablePadding>
            <ListItemButton
              selected={isItemSelected(item.path)}
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
                  color: isItemSelected(item.path) ? 'white' : 'inherit',
                }}
              >
                {item.icon}
              </ListItemIcon>
              <ListItemText primary={item.text} />
            </ListItemButton>
          </ListItem>
        ))}

        {/* Grouped items */}
        {filteredGroups.map((group) => (
          <React.Fragment key={group.id}>
            <ListItem disablePadding>
              <ListItemButton onClick={() => handleGroupToggle(group.id)}>
                <ListItemIcon>{group.icon}</ListItemIcon>
                <ListItemText 
                  primary={group.text} 
                  primaryTypographyProps={{ fontWeight: 'medium' }}
                />
                {expandedGroups[group.id] ? <ExpandLess /> : <ExpandMore />}
              </ListItemButton>
            </ListItem>
            <Collapse in={expandedGroups[group.id]} timeout="auto" unmountOnExit>
              <List component="div" disablePadding>
                {group.items.map((item) => (
                  <ListItem key={item.text} disablePadding>
                    <ListItemButton
                      selected={isItemSelected(item.path)}
                      onClick={() => navigate(item.path)}
                      sx={{
                        pl: 4,
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
                          color: isItemSelected(item.path) ? 'white' : 'inherit',
                          minWidth: 36,
                        }}
                      >
                        {item.icon}
                      </ListItemIcon>
                      <ListItemText primary={item.text} />
                    </ListItemButton>
                  </ListItem>
                ))}
              </List>
            </Collapse>
          </React.Fragment>
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
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="h6" noWrap component="div">
              {pageTitle}
            </Typography>
            {breadcrumbs.length > 1 && (
              <Breadcrumbs 
                separator={<NavigateNextIcon fontSize="small" sx={{ color: 'rgba(255,255,255,0.7)' }} />}
                sx={{ 
                  '& .MuiBreadcrumbs-li': { color: 'rgba(255,255,255,0.7)' },
                  '& .MuiBreadcrumbs-separator': { mx: 0.5 },
                }}
              >
                {breadcrumbs.slice(0, -1).map((crumb, index) => (
                  <Link
                    key={index}
                    component="button"
                    variant="body2"
                    onClick={() => navigate(crumb.path)}
                    sx={{ 
                      color: 'rgba(255,255,255,0.7)', 
                      textDecoration: 'none',
                      '&:hover': { textDecoration: 'underline' },
                      cursor: 'pointer',
                    }}
                  >
                    {crumb.label || 'Page'}
                  </Link>
                ))}
                <Typography variant="body2" sx={{ color: 'white' }}>
                  {breadcrumbs[breadcrumbs.length - 1]?.label || 'Page'}
                </Typography>
              </Breadcrumbs>
            )}
          </Box>
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
        <ErrorBoundary>
          <Outlet />
        </ErrorBoundary>
      </Box>
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleProfileMenuClose}
        onClick={handleProfileMenuClose}
      >
        <MenuItem onClick={handleProfileSettings}>
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
