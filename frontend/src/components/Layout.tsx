import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { api } from '../services/api';
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
  Select,
  FormControl,
  SelectChangeEvent,
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
  MonitorHeart as SystemIcon,
  LibraryBooks as LibraryIcon,
  PlaylistAddCheck as AssuranceIcon,
  BugReport as FindingsIcon,
  TrendingUp as InsightsIcon,
  KeyboardArrowDown as ArrowDownIcon,
  BusinessCenter as BcmIcon,
  CalendarMonth as CalendarIcon,
  FitnessCenter as ExerciseIcon,
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { moduleApi } from '../services/platformApi';
import { ErrorBoundary } from './common/ErrorBoundary';
import { safeArray, safeIncludes } from '../utils/safeHelpers';
import { NotificationBell } from './NotificationBell';

const drawerWidth = 260;

// Storage key for last known good route (used by InitializationErrorBoundary)
const LAST_GOOD_ROUTE_KEY = 'lastKnownGoodRoute';

interface NavMenuChild {
  text: string;
  path: string;
  status?: 'active' | 'coming_soon';
}

interface NavMenuItem {
  text: string;
  icon: React.ReactNode;
  path: string;
  roles?: ('admin' | 'manager' | 'user')[];
  moduleKey?: string;
  children?: NavMenuChild[];
  testId?: string;
}

interface NavMenuGroup {
  id: string;
  text: string;
  icon: React.ReactNode;
  items: NavMenuItem[];
  roles?: ('admin' | 'manager' | 'user')[];
}

// Domain types for the domain switcher
type DomainType = 'grc' | 'itsm';

// Storage key for module preference
const MODULE_PREFERENCE_KEY = 'grc_preferred_module';

// Domain configuration
const domains: { id: DomainType; label: string; icon: React.ReactNode; enabled: boolean }[] = [
  { id: 'grc', label: 'GRC', icon: <GrcIcon />, enabled: true },
  { id: 'itsm', label: 'ITSM', icon: <ItsmIcon />, enabled: true },
];

// Standalone items (not in groups) - shown regardless of domain
const standaloneItems: NavMenuItem[] = [
  { text: 'Dashboard', icon: <DashboardIcon />, path: '/dashboard' },
  { text: 'To-Do', icon: <TodoIcon />, path: '/todos' },
];

// GRC domain menu groups - Clean labels without "GRC > " prefix
const grcMenuGroups: NavMenuGroup[] = [
  {
    id: 'library',
    text: 'Library',
    icon: <LibraryIcon />,
    items: [
      { 
        text: 'Policies', 
        icon: <GovernanceIcon />, 
        path: '/governance', 
        moduleKey: 'policy',
      },
      { 
        text: 'Requirements', 
        icon: <ComplianceIcon />, 
        path: '/compliance', 
        moduleKey: 'compliance',
      },
      { 
        text: 'Controls', 
        icon: <ComplianceIcon />, 
        path: '/controls', 
        moduleKey: 'compliance',
      },
      { 
        text: 'Processes', 
        icon: <ProcessIcon />, 
        path: '/processes',
      },
      { 
        text: 'Standards', 
        icon: <LibraryIcon />, 
        path: '/standards',
      },
      { 
        text: 'SOA', 
        icon: <AssuranceIcon />, 
        path: '/soa',
      },
    ],
  },
  {
    id: 'assurance',
    text: 'Assurance',
    icon: <AssuranceIcon />,
    items: [
      { 
        text: 'Audits', 
        icon: <AuditIcon />, 
        path: '/audits', 
        moduleKey: 'audit',
      },
      { 
        text: 'Control Tests', 
        icon: <AuditIcon />, 
        path: '/control-tests',
      },
      { 
        text: 'Test Results', 
        icon: <AuditIcon />, 
        path: '/test-results',
      },
      { 
        text: 'Evidence', 
        icon: <AuditIcon />, 
        path: '/evidence',
      },
    ],
  },
  {
    id: 'findings',
    text: 'Findings & Remediation',
    icon: <FindingsIcon />,
    items: [
      { 
        text: 'Issues', 
        icon: <ViolationIcon />, 
        path: '/issues',
      },
      { 
        text: 'CAPA', 
        icon: <ViolationIcon />, 
        path: '/capa',
      },
    ],
  },
  {
    id: 'risk',
    text: 'Risk & Exceptions',
    icon: <RiskIcon />,
    items: [
      { 
        text: 'Risk Register', 
        icon: <RiskIcon />, 
        path: '/risk', 
        moduleKey: 'risk',
      },
      { 
        text: 'Violations', 
        icon: <ViolationIcon />, 
        path: '/violations',
      },
    ],
  },
  {
    id: 'insights',
    text: 'Insights',
    icon: <InsightsIcon />,
    items: [
      { 
        text: 'GRC Insights', 
        icon: <ComplianceDashboardIcon />, 
        path: '/insights',
      },
      { 
        text: 'Coverage', 
        icon: <ComplianceDashboardIcon />, 
        path: '/coverage',
      },
    ],
  },
  {
    id: 'bcm',
    text: 'BCM',
    icon: <BcmIcon />,
    items: [
      { 
        text: 'Services', 
        icon: <BcmIcon />, 
        path: '/bcm/services',
        testId: 'sidebar-bcm-services',
      },
      { 
        text: 'Exercises', 
        icon: <ExerciseIcon />, 
        path: '/bcm/exercises',
        testId: 'sidebar-bcm-exercises',
      },
    ],
  },
  {
    id: 'calendar',
    text: 'Calendar',
    icon: <CalendarIcon />,
    items: [
      { 
        text: 'GRC Calendar', 
        icon: <CalendarIcon />, 
        path: '/calendar',
        testId: 'sidebar-calendar',
      },
    ],
  },
];

// ITSM domain menu groups - ITIL v5 aligned
const itsmMenuGroups: NavMenuGroup[] = [
  {
    id: 'cmdb',
    text: 'CMDB',
    icon: <SystemIcon />,
    items: [
      {
        text: 'Services',
        icon: <ItsmIcon />,
        path: '/cmdb/services',
        testId: 'nav-cmdb-services',
      },
      {
        text: 'Configuration Items',
        icon: <SystemIcon />,
        path: '/cmdb/cis',
        testId: 'nav-cmdb-cis',
      },
      {
        text: 'CI Classes',
        icon: <LibraryIcon />,
        path: '/cmdb/classes',
        testId: 'nav-cmdb-classes',
      },
      {
        text: 'Import Jobs',
        icon: <SystemIcon />,
        path: '/cmdb/import-jobs',
        testId: 'nav-cmdb-import-jobs',
      },
      {
        text: 'Reconcile Rules',
        icon: <LibraryIcon />,
        path: '/cmdb/reconcile-rules',
        testId: 'nav-cmdb-reconcile-rules',
      },
    ],
  },
  {
    id: 'itsm-service-management',
    text: 'Service Management',
    icon: <ItsmIcon />,
    items: [
      { 
        text: 'Services', 
        icon: <ItsmIcon />, 
        path: '/itsm/services',
        testId: 'nav-itsm-services',
      },
    ],
  },
  {
    id: 'itsm-incidents',
    text: 'Incident Management',
    icon: <IncidentIcon />,
    items: [
      { 
        text: 'Incidents', 
        icon: <IncidentIcon />, 
        path: '/itsm/incidents',
        testId: 'nav-itsm-incidents',
      },
    ],
  },
  {
    id: 'itsm-changes',
    text: 'Change Management',
    icon: <SettingsIcon />,
    items: [
      { 
        text: 'Changes', 
        icon: <SettingsIcon />, 
        path: '/itsm/changes',
        testId: 'nav-itsm-changes',
      },
      {
        text: 'Change Calendar',
        icon: <CalendarIcon />,
        path: '/itsm/change-calendar',
        testId: 'nav-itsm-change-calendar',
      },
    ],
  },
  {
    id: 'itsm-major-incidents',
    text: 'Major Incidents',
    icon: <IncidentIcon />,
    items: [
      {
        text: 'Major Incidents',
        icon: <IncidentIcon />,
        path: '/itsm/major-incidents',
        testId: 'nav-itsm-major-incidents',
      },
    ],
  },
  {
    id: 'itsm-problems',
    text: 'Problem Management',
    icon: <FindingsIcon />,
    items: [
      {
        text: 'Problems',
        icon: <FindingsIcon />,
        path: '/itsm/problems',
        testId: 'nav-itsm-problems',
      },
      {
        text: 'Known Errors',
        icon: <FindingsIcon />,
        path: '/itsm/known-errors',
        testId: 'nav-itsm-known-errors',
      },
    ],
  },
  {
    id: 'itsm-analytics',
    text: 'Analytics',
    icon: <InsightsIcon />,
    items: [
      {
        text: 'ITSM Analytics',
        icon: <InsightsIcon />,
        path: '/itsm/analytics',
        testId: 'nav-itsm-analytics',
      },
    ],
  },
  {
    id: 'itsm-studio',
    text: 'ITSM Studio',
    icon: <AdminIcon />,
    roles: ['admin'],
    items: [
      {
        text: 'Tables',
        icon: <LibraryIcon />,
        path: '/itsm/studio/tables',
        testId: 'nav-itsm-studio-tables',
        roles: ['admin'],
      },
      {
        text: 'Choices',
        icon: <SettingsIcon />,
        path: '/itsm/studio/choices',
        testId: 'nav-itsm-studio-choices',
        roles: ['admin'],
      },
      {
        text: 'Business Rules',
        icon: <ProcessIcon />,
        path: '/itsm/studio/business-rules',
        testId: 'nav-itsm-studio-business-rules',
        roles: ['admin'],
      },
      {
        text: 'UI Policies',
        icon: <AssuranceIcon />,
        path: '/itsm/studio/ui-policies',
        testId: 'nav-itsm-studio-ui-policies',
        roles: ['admin'],
      },
      {
        text: 'UI Actions',
        icon: <IncidentIcon />,
        path: '/itsm/studio/ui-actions',
        testId: 'nav-itsm-studio-ui-actions',
        roles: ['admin'],
      },
      {
        text: 'Workflows',
        icon: <DotWalkingIcon />,
        path: '/itsm/studio/workflows',
        testId: 'nav-itsm-studio-workflows',
        roles: ['admin'],
      },
      {
        text: 'SLA',
        icon: <GrcHealthIcon />,
        path: '/itsm/studio/sla',
        testId: 'nav-itsm-studio-sla',
        roles: ['admin'],
      },
    ],
  },
];

// Shared menu groups (shown in all domains)
const sharedMenuGroups: NavMenuGroup[] = [
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
    text: 'Administration',
    icon: <AdminIcon />,
    roles: ['admin'],
    items: [
      { text: 'User Management', icon: <UsersIcon />, path: '/users', roles: ['admin', 'manager'] },
      { text: 'Admin Panel', icon: <AdminIcon />, path: '/admin', roles: ['admin'], moduleKey: 'platform.admin' },
      { text: 'Platform Builder', icon: <SettingsIcon />, path: '/admin/platform-builder', roles: ['admin'] },
      { text: 'System', icon: <SystemIcon />, path: '/admin/system', roles: ['admin'] },
      { text: 'Data Model', icon: <DotWalkingIcon />, path: '/admin/data-model', roles: ['admin'] },
      { text: 'Query Builder', icon: <DotWalkingIcon />, path: '/dotwalking' },
    ],
  },
];

// Helper to get menu groups for a domain
const getMenuGroupsForDomain = (domain: DomainType): NavMenuGroup[] => {
  switch (domain) {
    case 'grc':
      return [...grcMenuGroups, ...sharedMenuGroups];
    case 'itsm':
      return [...itsmMenuGroups, ...sharedMenuGroups];
    default:
      return [...grcMenuGroups, ...sharedMenuGroups];
  }
};

// Legacy: Flat list for backward compatibility (page title lookup)
const menuGroups = [...grcMenuGroups, ...itsmMenuGroups, ...sharedMenuGroups];

// Flat list for backward compatibility (page title lookup)
const menuItems: NavMenuItem[] = [
  ...standaloneItems,
  ...menuGroups.flatMap(g => g.items),
];

const AppFooter: React.FC = () => {
  const [buildInfo, setBuildInfo] = useState<string>('Build: loading...');

  useEffect(() => {
    let cancelled = false;
    const fetchVersion = async () => {
      try {
        const resp = await api.get('/health/version');
        const version = resp.data?.data?.version || resp.data?.version;
        if (!cancelled && version) {
          const v = version as { commitShort?: string; buildTimestamp?: string };
          const sha = v.commitShort && v.commitShort !== 'unknown' ? v.commitShort : 'dev';
          const ts = v.buildTimestamp && v.buildTimestamp !== 'unknown'
            ? new Date(v.buildTimestamp).toLocaleString()
            : 'local';
          setBuildInfo(`Build: ${sha} \u2022 ${ts}`);
        } else if (!cancelled) {
          setBuildInfo('Build: unavailable');
        }
      } catch (err: unknown) {
        const status = (err as { response?: { status?: number } })?.response?.status;
        console.warn(`[BuildIndicator] /health/version failed: status=${status ?? 'network error'}`);
        if (!cancelled) setBuildInfo('Build: unavailable');
      }
    };
    fetchVersion();
    return () => { cancelled = true; };
  }, []);

  return (
    <Box
      component="footer"
      sx={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        py: 1.5,
        px: 2,
        mt: 3,
        borderTop: '1px solid',
        borderColor: 'divider',
        minHeight: 48,
      }}
      data-testid="app-footer"
    >
      <Typography variant="caption" color="text.disabled">
        &copy; {new Date().getFullYear()} GRC Platform
      </Typography>
      <Typography variant="caption" color="text.disabled" data-testid="build-indicator">
        {buildInfo}
      </Typography>
    </Box>
  );
};

export const Layout: React.FC = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [enabledModules, setEnabledModules] = useState<string[]>([]);
  // Load initial domain from localStorage or default to 'grc'
  const [currentDomain, setCurrentDomain] = useState<DomainType>(() => {
    try {
      const saved = localStorage.getItem(MODULE_PREFERENCE_KEY);
      if (saved === 'grc' || saved === 'itsm') {
        return saved;
      }
    } catch {
      // Ignore localStorage errors
    }
    return 'grc';
  });
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    library: true,
    assurance: false,
    findings: false,
    risk: false,
    insights: false,
    bcm: false,
    calendar: false,
    'itsm-service-management': false,
    'itsm-incidents': false,
    'itsm-changes': false,
    dashboards: false,
    admin: false,
  });
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  // Get menu groups for current domain
  const domainMenuGroups = useMemo(() => getMenuGroupsForDomain(currentDomain), [currentDomain]);
  
  // Handle domain change with localStorage persistence
  const handleDomainChange = (event: SelectChangeEvent<DomainType>) => {
    const newDomain = event.target.value as DomainType;
    setCurrentDomain(newDomain);
    
    // Persist to localStorage
    try {
      localStorage.setItem(MODULE_PREFERENCE_KEY, newDomain);
    } catch {
      // Ignore localStorage errors
    }
    
    // Reset expanded groups when switching domains
    setExpandedGroups({
      library: newDomain === 'grc',
      assurance: false,
      findings: false,
      risk: false,
      insights: false,
      bcm: false,
      calendar: false,
      'itsm-service-management': newDomain === 'itsm',
      'itsm-incidents': false,
      'itsm-changes': false,
      dashboards: false,
      admin: false,
    });
  };

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

  // Auto-expand group and item containing current path
  useEffect(() => {
    for (const group of menuGroups) {
      const matchingItem = group.items.find(item => {
        // Check if current path matches item path or any of its children
        if (location.pathname.startsWith(item.path)) return true;
        if (item.children) {
          return item.children.some(child => location.pathname.startsWith(child.path));
        }
        return false;
      });
      
      if (matchingItem) {
        setExpandedGroups(prev => ({ ...prev, [group.id]: true }));
        // Also expand the item if it has children
        if (matchingItem.children && matchingItem.children.length > 0) {
          const itemKey = `${group.id}-${matchingItem.text}`;
          setExpandedItems(prev => ({ ...prev, [itemKey]: true }));
        }
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

  const filterItem = useCallback((item: NavMenuItem): boolean => {
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
  }, [user, enabledModules]);

  const filteredStandaloneItems = useMemo(() => {
    return standaloneItems.filter(filterItem);
  }, [filterItem]);

  const filteredGroups = useMemo(() => {
    if (!user) return [];
    return domainMenuGroups
      .filter(group => !group.roles || safeIncludes(group.roles, user.role))
      .map(group => ({
        ...group,
        items: group.items.filter(filterItem),
      }))
      .filter(group => group.items.length > 0);
  }, [user, filterItem, domainMenuGroups]);

  const handleGroupToggle = (groupId: string) => {
    setExpandedGroups(prev => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  const handleItemToggle = (itemKey: string) => {
    setExpandedItems(prev => ({ ...prev, [itemKey]: !prev[itemKey] }));
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
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* NILES Logo Header */}
      <Box 
        sx={{ 
          p: 2, 
          display: 'flex', 
          alignItems: 'center', 
          gap: 1.5,
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Box
          component="img"
          src="/brand/niles-icon.svg"
          alt="NILES"
          sx={{ 
            width: 28, 
            height: 28,
          }}
        />
        <Typography 
          variant="h6" 
          sx={{ 
            fontWeight: 600, 
            color: 'primary.main',
            letterSpacing: '0.02em',
          }}
        >
          NILES
        </Typography>
      </Box>
      
      {/* Domain Switcher Header */}
      <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Typography 
          variant="overline" 
          sx={{ 
            color: 'text.secondary', 
            fontSize: '0.65rem', 
            fontWeight: 600,
            letterSpacing: '0.1em',
            display: 'block',
            mb: 0.5,
          }}
        >
          Current Module
        </Typography>
        <FormControl fullWidth size="small">
          <Select
            value={currentDomain}
            onChange={handleDomainChange}
            IconComponent={ArrowDownIcon}
            sx={{
              backgroundColor: 'primary.main',
              color: 'white',
              fontWeight: 600,
              '& .MuiSelect-icon': { color: 'white' },
              '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
              '&:hover': { backgroundColor: 'primary.dark' },
              '&.Mui-focused .MuiOutlinedInput-notchedOutline': { border: 'none' },
              borderRadius: 1.5,
            }}
          >
            {domains.map((domain) => (
              <MenuItem 
                key={domain.id} 
                value={domain.id}
                disabled={!domain.enabled}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                }}
              >
                {domain.icon}
                <Typography component="span" sx={{ fontWeight: 500 }}>
                  {domain.label}
                </Typography>
                {!domain.enabled && (
                  <Chip 
                    label="Coming Soon" 
                    size="small" 
                    sx={{ 
                      ml: 'auto', 
                      height: 20, 
                      fontSize: '0.65rem',
                    }} 
                  />
                )}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>
      
      <List sx={{ flexGrow: 1, overflow: 'auto', pt: 1 }}>
        {/* Standalone items */}
        {filteredStandaloneItems.map((item) => {
          const testId = item.path === '/dashboard' ? 'nav-dashboard' : `nav-${item.text.toLowerCase().replace(/\s+/g, '-')}`;
          return (
            <ListItem key={item.text} disablePadding>
              <ListItemButton
                selected={isItemSelected(item.path)}
                onClick={() => navigate(item.path)}
                data-testid={testId}
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
          );
        })}

        {/* Grouped items with 2-level nested menu support */}
        {filteredGroups.map((group) => {
          // Generate stable test IDs for navigation groups
          // GRC groups use 'nav-group-grc-{subgroup}' pattern, admin uses 'nav-admin'
          const isGrcGroup = ['library', 'assurance', 'findings', 'risk', 'insights', 'bcm', 'calendar'].includes(group.id);
          const groupTestId = group.id === 'admin' ? 'nav-admin' : (isGrcGroup ? `nav-group-grc-${group.id}` : `nav-group-${group.id}`);
          return (
            <React.Fragment key={group.id}>
              <ListItem disablePadding>
                <ListItemButton 
                  onClick={() => handleGroupToggle(group.id)}
                  data-testid={groupTestId || undefined}
                >
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
                  {group.items.map((item) => {
                    const itemKey = `${group.id}-${item.text}`;
                    const hasChildren = item.children && item.children.length > 0;
                    let testId: string | undefined;
                    if (item.testId) {
                      testId = item.testId;
                    } else if (item.path === '/audits') {
                      testId = 'nav-audit';
                    } else if (item.path.startsWith('/admin')) {
                      testId = undefined;
                    } else {
                      testId = `nav-${item.text.toLowerCase().replace(/\s+/g, '-')}`;
                    }
                    
                    // If item has children, render expandable sub-menu
                    if (hasChildren) {
                      return (
                        <React.Fragment key={item.text}>
                          <ListItem disablePadding>
                            <ListItemButton
                              onClick={() => handleItemToggle(itemKey)}
                              data-testid={testId}
                              sx={{ pl: 4 }}
                            >
                              <ListItemIcon sx={{ minWidth: 36 }}>
                                {item.icon}
                              </ListItemIcon>
                              <ListItemText primary={item.text} />
                              {expandedItems[itemKey] ? <ExpandLess /> : <ExpandMore />}
                            </ListItemButton>
                          </ListItem>
                          <Collapse in={expandedItems[itemKey]} timeout="auto" unmountOnExit>
                            <List component="div" disablePadding>
                              {item.children?.map((child) => {
                                const isComingSoon = child.status === 'coming_soon';
                                const childSelected = isItemSelected(child.path);
                                return (
                                  <ListItem key={child.text} disablePadding>
                                    <ListItemButton
                                      selected={childSelected}
                                      onClick={() => navigate(child.path)}
                                      sx={{
                                        pl: 7,
                                        '&.Mui-selected': {
                                          backgroundColor: 'primary.main',
                                          color: 'white',
                                          '&:hover': {
                                            backgroundColor: 'primary.dark',
                                          },
                                        },
                                      }}
                                    >
                                      <ListItemText 
                                        primary={child.text}
                                        secondary={isComingSoon ? 'Coming Soon' : undefined}
                                        primaryTypographyProps={{ 
                                          fontSize: '0.875rem',
                                          color: childSelected ? 'inherit' : (isComingSoon ? 'text.secondary' : 'inherit'),
                                        }}
                                        secondaryTypographyProps={{
                                          fontSize: '0.7rem',
                                          color: 'warning.main',
                                        }}
                                      />
                                      {isComingSoon && (
                                        <Chip 
                                          label="Soon" 
                                          size="small" 
                                          color="warning" 
                                          sx={{ 
                                            height: 18, 
                                            fontSize: '0.65rem',
                                            '& .MuiChip-label': { px: 0.75 },
                                          }} 
                                        />
                                      )}
                                    </ListItemButton>
                                  </ListItem>
                                );
                              })}
                            </List>
                          </Collapse>
                        </React.Fragment>
                      );
                    }
                    
                    // Items without children render as before
                    return (
                      <ListItem key={item.text} disablePadding>
                        <ListItemButton
                          selected={isItemSelected(item.path)}
                          onClick={() => navigate(item.path)}
                          data-testid={testId}
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
                    );
                  })}
                </List>
              </Collapse>
            </React.Fragment>
          );
        })}
      </List>
    </Box>
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
            data-testid="btn-toggle-sidebar"
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
            <NotificationBell />
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
          display: 'flex',
          flexDirection: 'column',
          minHeight: '100vh',
        }}
      >
        <Toolbar />
        <Box sx={{ flex: 1 }}>
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </Box>
        <AppFooter />
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
