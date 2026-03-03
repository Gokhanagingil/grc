import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  IconButton,
  Badge,
  Drawer,
  Box,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemButton,
  Button,
  Divider,
  CircularProgress,
  Alert,
  Chip,
  Tooltip,
  Tabs,
  Tab,
  Collapse,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  SelectChangeEvent,
  Fade,
} from '@mui/material';
import {
  Notifications as BellIcon,
  MarkEmailRead as MarkReadIcon,
  Close as CloseIcon,
  OpenInNew as OpenIcon,
  FiberManualRecord as DotIcon,
  Assignment as AssignIcon,
  Schedule as DueIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  Error as ErrorIcon,
  ExpandMore as ExpandIcon,
  ExpandLess as CollapseIcon,
  PersonAdd as AssignToMeIcon,
  CalendarMonth as CalendarIcon,
  FilterList as FilterIcon,
} from '@mui/icons-material';
import { api } from '../services/api';

/* ------------------------------------------------------------------ */
/* Types                                                                */
/* ------------------------------------------------------------------ */

interface NotificationAction {
  label: string;
  actionType: string;
  payload: Record<string, unknown>;
  requiresConfirm?: boolean;
}

interface UserNotification {
  id: string;
  title: string;
  body: string;
  type: string;
  severity: string;
  source: string;
  entityType: string | null;
  entityId: string | null;
  link: string | null;
  dueAt: string | null;
  actions: NotificationAction[];
  metadata: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
}

type TabValue = 'all' | 'assignments' | 'due_soon';

/* ------------------------------------------------------------------ */
/* Helpers                                                              */
/* ------------------------------------------------------------------ */

const severityColor: Record<string, 'error' | 'warning' | 'info' | 'default'> = {
  CRITICAL: 'error',
  WARNING: 'warning',
  INFO: 'info',
};

const sourceLabel: Record<string, string> = {
  TODO: 'To-Do',
  GRC: 'GRC',
  ITSM: 'ITSM',
  SYSTEM: 'System',
};

const typeIcon: Record<string, React.ReactNode> = {
  ASSIGNMENT: <AssignIcon fontSize="small" />,
  DUE_DATE: <DueIcon fontSize="small" />,
  STATUS_CHANGE: <WarningIcon fontSize="small" />,
};

const severityIcon: Record<string, React.ReactNode> = {
  CRITICAL: <ErrorIcon fontSize="small" color="error" />,
  WARNING: <WarningIcon fontSize="small" color="warning" />,
  INFO: <InfoIcon fontSize="small" color="info" />,
};

/** Map entity types to frontend routes for deep-linking. */
const entityRouteMap: Record<string, string> = {
  todo_task: '/todos',
  grc_risk: '/risk',
  grc_control: '/controls',
  grc_issue: '/issues',
  grc_capa: '/capa',
  grc_audit: '/audits',
  itsm_incident: '/itsm/incidents',
  itsm_change: '/itsm/changes',
};

/** Map entity types to human-readable labels. */
const entityLabel: Record<string, string> = {
  todo_task: 'To-Do Task',
  grc_risk: 'Risk',
  grc_control: 'Control',
  grc_issue: 'Issue',
  grc_capa: 'CAPA',
  grc_audit: 'Audit',
  itsm_incident: 'Incident',
  itsm_change: 'Change Request',
};

/** Map notification types to "Why you got this" explanations. */
const reasonMap: Record<string, string> = {
  ASSIGNMENT: 'Assigned to you',
  DUE_DATE: 'Due date approaching',
  STATUS_CHANGE: 'Status changed / Major attention',
  MENTION: 'You were mentioned',
  SYSTEM: 'System notification',
};

function resolveEntityRoute(entityType: string | null, entityId: string | null): string | null {
  if (!entityType) return null;
  const base = entityRouteMap[entityType];
  if (!base) return entityId ? `/${entityType}/${entityId}` : null;
  return entityId ? `${base}/${entityId}` : base;
}

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

function formatDueDate(dateStr: string | null): string | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = d.getTime() - now.getTime();
  const diffHours = Math.floor(diffMs / 3600000);
  if (diffHours < 0) return 'Overdue';
  if (diffHours < 1) return 'Due in < 1h';
  if (diffHours < 24) return `Due in ${diffHours}h`;
  const diffDays = Math.floor(diffHours / 24);
  return `Due in ${diffDays}d`;
}

/** Normalise backend response into UserNotification[]. */
function normaliseNotification(raw: Record<string, unknown>): UserNotification {
  return {
    id: raw.id as string,
    title: raw.title as string,
    body: raw.body as string,
    type: (raw.type as string) || 'GENERAL',
    severity: (raw.severity as string) || 'INFO',
    source: (raw.source as string) || 'SYSTEM',
    entityType: (raw.entityType as string) || (raw.entity_type as string) || null,
    entityId: (raw.entityId as string) || (raw.entity_id as string) || null,
    link: (raw.link as string) || null,
    dueAt: (raw.dueAt as string) || (raw.due_at as string) || null,
    actions: Array.isArray(raw.actions) ? raw.actions as NotificationAction[] : [],
    metadata: (raw.metadata as Record<string, unknown>) || {},
    readAt: (raw.readAt as string) || (raw.read_at as string) || null,
    createdAt: (raw.createdAt as string) || (raw.created_at as string) || '',
  };
}

/* ------------------------------------------------------------------ */
/* Animations (keyframes via sx)                                        */
/* ------------------------------------------------------------------ */

const pulseAnimation = {
  '@keyframes pulse': {
    '0%': { transform: 'scale(1)', opacity: 1 },
    '50%': { transform: 'scale(1.15)', opacity: 0.8 },
    '100%': { transform: 'scale(1)', opacity: 1 },
  },
};

/* ------------------------------------------------------------------ */
/* Component                                                            */
/* ------------------------------------------------------------------ */

export const NotificationBell: React.FC = () => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<UserNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Tabs + Filters
  const [activeTab, setActiveTab] = useState<TabValue>('all');
  const [severityFilter, setSeverityFilter] = useState<string>('');
  const [moduleFilter, setModuleFilter] = useState<string>('');
  const [showFilters, setShowFilters] = useState(false);

  // Smart preview card
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Action confirmation dialog
  const [confirmAction, setConfirmAction] = useState<{
    notification: UserNotification;
    action: NotificationAction;
    actionIndex: number;
  } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const loadNotifications = useCallback(async (tab?: TabValue, sev?: string, mod?: string) => {
    try {
      setLoading(true);
      setError('');
      const params: Record<string, string | number> = { pageSize: 50 };
      const tabVal = tab ?? activeTab;
      if (tabVal !== 'all') params.tab = tabVal;
      const sevVal = sev ?? severityFilter;
      if (sevVal) params.severity = sevVal;
      const modVal = mod ?? moduleFilter;
      if (modVal) params.module = modVal;

      const res = await api.get('/grc/user-notifications', { params });
      const data = res.data?.data || res.data;
      const rawItems = (data.items || []) as Record<string, unknown>[];
      const items = rawItems.map(normaliseNotification);
      setNotifications(items);
      setUnreadCount(data.unreadCount ?? items.filter((n) => !n.readAt).length);
    } catch (err: unknown) {
      const e = err as { response?: { status?: number }; message?: string };
      if (e.response?.status !== 401 && e.response?.status !== 403) {
        setError('Failed to load notifications');
      }
    } finally {
      setLoading(false);
    }
  }, [activeTab, severityFilter, moduleFilter]);

  // Polling for unread count (lightweight)
  const pollUnreadCount = useCallback(async () => {
    try {
      const res = await api.get('/grc/user-notifications/unread-count');
      const data = res.data?.data || res.data;
      setUnreadCount(data.unreadCount ?? 0);
    } catch {
      /* silent */
    }
  }, []);

  useEffect(() => {
    pollUnreadCount();
    const interval = setInterval(pollUnreadCount, 30000);
    return () => clearInterval(interval);
  }, [pollUnreadCount]);

  // Load full list when drawer opens
  useEffect(() => {
    if (open) {
      loadNotifications();
    }
  }, [open, activeTab, severityFilter, moduleFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleMarkRead = async (id: string) => {
    try {
      await api.post(`/grc/user-notifications/${id}/read`);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n)),
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {
      /* ignore */
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await api.post('/grc/user-notifications/read-all');
      const now = new Date().toISOString();
      setNotifications((prev) => prev.map((n) => ({ ...n, readAt: n.readAt || now })));
      setUnreadCount(0);
    } catch {
      /* ignore */
    }
  };

  const handleOpen = () => {
    setOpen(true);
  };

  /** Navigate to the related entity record. */
  const handleOpenRecord = (n: UserNotification) => {
    const route = resolveEntityRoute(n.entityType, n.entityId);
    if (route) {
      setOpen(false);
      navigate(route);
    } else if (n.link) {
      setOpen(false);
      navigate(n.link);
    }
  };

  /** Execute action via backend endpoint with optional confirmation. */
  const executeAction = async (n: UserNotification, action: NotificationAction, actionIndex: number) => {
    // OPEN_RECORD / OPEN_ENTITY: just navigate, no server call needed
    if (action.actionType === 'OPEN_RECORD' || action.actionType === 'OPEN_ENTITY') {
      const aEntityType = action.payload.entityType as string | undefined;
      const aEntityId = action.payload.entityId as string | undefined;
      const route = resolveEntityRoute(aEntityType || n.entityType, aEntityId || n.entityId);
      if (route) {
        setOpen(false);
        if (!n.readAt) handleMarkRead(n.id);
        navigate(route);
      }
      return;
    }

    // MARK_READ: simple, no confirmation
    if (action.actionType === 'MARK_READ') {
      if (!n.readAt) handleMarkRead(n.id);
      return;
    }

    // For ASSIGN_TO_ME, SET_DUE_DATE: call server-side execute endpoint
    try {
      setActionLoading(true);
      await api.post(`/grc/user-notifications/${n.id}/actions/${actionIndex}/execute`, {
        payload: action.payload,
      });
      // Auto mark-read after executing
      if (!n.readAt) {
        handleMarkRead(n.id);
      }
    } catch {
      /* silent — action may not be implemented yet */
    } finally {
      setActionLoading(false);
      setConfirmAction(null);
    }
  };

  /** Handle action button clicks (with confirmation gate). */
  const handleAction = (n: UserNotification, action: NotificationAction, actionIndex: number) => {
    if (action.requiresConfirm || action.actionType === 'ASSIGN_TO_ME' || action.actionType === 'SET_DUE_DATE') {
      setConfirmAction({ notification: n, action, actionIndex });
    } else {
      executeAction(n, action, actionIndex);
    }
  };

  const isRead = (n: UserNotification) => !!n.readAt;

  /** Build "Why you got this" text. */
  const getReasonText = (n: UserNotification): string => {
    const metaReason = n.metadata?.reason as string | undefined;
    if (metaReason) return metaReason;
    return reasonMap[n.type] || 'Notification';
  };

  /** Action icon helper. */
  const getActionIcon = (actionType: string) => {
    switch (actionType) {
      case 'OPEN_RECORD':
      case 'OPEN_ENTITY':
        return <OpenIcon fontSize="small" />;
      case 'ASSIGN_TO_ME':
        return <AssignToMeIcon fontSize="small" />;
      case 'SET_DUE_DATE':
        return <CalendarIcon fontSize="small" />;
      default:
        return undefined;
    }
  };

  // Filtered notifications (client-side additional filter on unread if needed)
  const filteredNotifications = useMemo(() => notifications, [notifications]);

  return (
    <>
      {/* Bell Icon with pulse animation */}
      <IconButton
        color="inherit"
        onClick={handleOpen}
        data-testid="notification-bell"
        aria-label="notifications"
        sx={{
          ...pulseAnimation,
          animation: unreadCount > 0 ? 'pulse 2s ease-in-out infinite' : 'none',
        }}
      >
        <Badge
          badgeContent={unreadCount}
          color="error"
          max={99}
          sx={{
            '& .MuiBadge-badge': {
              fontSize: '0.7rem',
              minWidth: 18,
              height: 18,
            },
          }}
        >
          <BellIcon />
        </Badge>
      </IconButton>

      {/* Notification Drawer */}
      <Drawer
        anchor="right"
        open={open}
        onClose={() => setOpen(false)}
        PaperProps={{
          sx: {
            width: 440,
            maxWidth: '100vw',
          },
        }}
        SlideProps={{ direction: 'left' }}
        data-testid="notification-drawer"
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          {/* Header */}
          <Box sx={{
            p: 2,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottom: 1,
            borderColor: 'divider',
            bgcolor: 'background.paper',
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <BellIcon color="primary" />
              <Typography variant="h6" fontWeight={600}>Notifications</Typography>
              {unreadCount > 0 && (
                <Chip
                  size="small"
                  label={unreadCount}
                  color="error"
                  sx={{ height: 22, fontSize: '0.75rem' }}
                />
              )}
            </Box>
            <Box>
              {unreadCount > 0 && (
                  <Tooltip title="Mark all as read">
                    <IconButton size="small" onClick={handleMarkAllRead} aria-label="Mark all read" sx={{ mr: 0.5 }}>
                      <MarkReadIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
              )}
              <Tooltip title="Filters">
                <IconButton
                  size="small"
                  onClick={() => setShowFilters(!showFilters)}
                  color={showFilters ? 'primary' : 'default'}
                  sx={{ mr: 0.5 }}
                >
                  <FilterIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <IconButton size="small" onClick={() => setOpen(false)} aria-label="close notifications">
                <CloseIcon fontSize="small" />
              </IconButton>
            </Box>
          </Box>

          {/* Tabs */}
          <Tabs
            value={activeTab}
            onChange={(_e, v: TabValue) => setActiveTab(v)}
            variant="fullWidth"
            sx={{
              minHeight: 40,
              borderBottom: 1,
              borderColor: 'divider',
              '& .MuiTab-root': { minHeight: 40, textTransform: 'none', fontSize: '0.85rem' },
            }}
          >
            <Tab label="All" value="all" />
            <Tab label="Assignments" value="assignments" />
            <Tab label="Due Soon" value="due_soon" />
          </Tabs>

          {/* Filters (collapsible) */}
          <Collapse in={showFilters}>
            <Box sx={{ p: 1.5, display: 'flex', gap: 1, borderBottom: 1, borderColor: 'divider', bgcolor: 'grey.50' }}>
              <FormControl size="small" sx={{ minWidth: 120 }}>
                <InputLabel>Severity</InputLabel>
                <Select
                  value={severityFilter}
                  label="Severity"
                  onChange={(e: SelectChangeEvent) => setSeverityFilter(e.target.value)}
                >
                  <MenuItem value="">All</MenuItem>
                  <MenuItem value="CRITICAL">Critical</MenuItem>
                  <MenuItem value="WARNING">Warning</MenuItem>
                  <MenuItem value="INFO">Info</MenuItem>
                </Select>
              </FormControl>
              <FormControl size="small" sx={{ minWidth: 120 }}>
                <InputLabel>Module</InputLabel>
                <Select
                  value={moduleFilter}
                  label="Module"
                  onChange={(e: SelectChangeEvent) => setModuleFilter(e.target.value)}
                >
                  <MenuItem value="">All</MenuItem>
                  <MenuItem value="TODO">To-Do</MenuItem>
                  <MenuItem value="GRC">GRC</MenuItem>
                  <MenuItem value="ITSM">ITSM</MenuItem>
                  <MenuItem value="SYSTEM">System</MenuItem>
                </Select>
              </FormControl>
              {(severityFilter || moduleFilter) && (
                <Button
                  size="small"
                  onClick={() => { setSeverityFilter(''); setModuleFilter(''); }}
                  sx={{ textTransform: 'none' }}
                >
                  Clear
                </Button>
              )}
            </Box>
          </Collapse>

          {/* Body */}
          <Box sx={{ flex: 1, overflow: 'auto' }}>
            {error && <Alert severity="error" sx={{ m: 1 }}>{error}</Alert>}

            {loading && notifications.length === 0 ? (
              <Box display="flex" justifyContent="center" py={4}>
                <CircularProgress size={24} />
              </Box>
            ) : filteredNotifications.length === 0 ? (
              <Fade in timeout={300}>
                <Box py={6} textAlign="center">
                  <BellIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
                  <Typography color="text.secondary">No notifications</Typography>
                  <Typography variant="caption" color="text.disabled">
                    {activeTab !== 'all' ? 'Try switching to the "All" tab' : 'You\'re all caught up!'}
                  </Typography>
                </Box>
              </Fade>
            ) : (
              <List disablePadding>
                {filteredNotifications.map((n) => (
                  <Fade in timeout={200} key={n.id}>
                    <Box>
                      <ListItem disablePadding>
                        <ListItemButton
                          onClick={() => {
                            if (!isRead(n)) handleMarkRead(n.id);
                            // Toggle smart preview card
                            setExpandedId(expandedId === n.id ? null : n.id);
                          }}
                          sx={{
                            bgcolor: isRead(n) ? 'transparent' : 'action.hover',
                            py: 1.5,
                            px: 2,
                            transition: 'background-color 0.2s ease',
                            '&:hover': {
                              bgcolor: isRead(n) ? 'action.hover' : 'action.selected',
                            },
                          }}
                        >
                          {/* Type icon + unread indicator */}
                          <Box sx={{ mr: 1.5, display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 28 }}>
                            {typeIcon[n.type] || severityIcon[n.severity] || <BellIcon fontSize="small" />}
                            {!isRead(n) && (
                              <DotIcon
                                sx={{
                                  fontSize: 8,
                                  mt: 0.5,
                                  color: severityColor[n.severity] === 'error'
                                    ? 'error.main'
                                    : severityColor[n.severity] === 'warning'
                                      ? 'warning.main'
                                      : 'primary.main',
                                  animation: 'pulse 2s ease-in-out infinite',
                                  ...pulseAnimation,
                                }}
                              />
                            )}
                          </Box>
                          <ListItemText
                            primary={
                              <Box display="flex" justifyContent="space-between" alignItems="center">
                                <Typography
                                  variant="subtitle2"
                                  sx={{ fontWeight: isRead(n) ? 'normal' : 600, lineHeight: 1.3 }}
                                  noWrap
                                >
                                  {n.title}
                                </Typography>
                                <Typography
                                  variant="caption"
                                  color="text.secondary"
                                  sx={{ ml: 1, whiteSpace: 'nowrap', flexShrink: 0 }}
                                >
                                  {formatTime(n.createdAt)}
                                </Typography>
                              </Box>
                            }
                            secondary={
                              <Box component="span" sx={{ display: 'block' }}>
                                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }} noWrap>
                                  {n.body}
                                </Typography>
                                {/* Tags */}
                                <Box sx={{ mt: 0.5, display: 'flex', gap: 0.5, flexWrap: 'wrap', alignItems: 'center' }}>
                                  {n.source && n.source !== 'SYSTEM' && (
                                    <Chip size="small" label={sourceLabel[n.source] || n.source} variant="outlined" sx={{ height: 20, fontSize: '0.7rem' }} />
                                  )}
                                  {n.severity && n.severity !== 'INFO' && (
                                    <Chip size="small" label={n.severity} color={severityColor[n.severity] || 'default'} sx={{ height: 20, fontSize: '0.7rem' }} />
                                  )}
                                  {n.dueAt && (
                                    <Chip
                                      size="small"
                                      label={formatDueDate(n.dueAt)}
                                      icon={<DueIcon style={{ fontSize: 14 }} />}
                                      color={new Date(n.dueAt).getTime() < Date.now() ? 'error' : 'warning'}
                                      variant="outlined"
                                      sx={{ height: 20, fontSize: '0.7rem' }}
                                    />
                                  )}
                                </Box>
                              </Box>
                            }
                          />
                          {/* Expand indicator */}
                          <Box sx={{ ml: 0.5, flexShrink: 0 }}>
                            {expandedId === n.id ? <CollapseIcon fontSize="small" color="action" /> : <ExpandIcon fontSize="small" color="action" />}
                          </Box>
                        </ListItemButton>
                      </ListItem>

                      {/* Smart Preview Card (WOW) */}
                      <Collapse in={expandedId === n.id} timeout={250}>
                        <Box sx={{
                          mx: 2,
                          mb: 1,
                          p: 1.5,
                          bgcolor: 'grey.50',
                          borderRadius: 1,
                          border: '1px solid',
                          borderColor: 'divider',
                        }}>
                          {/* Full message */}
                          <Typography variant="body2" sx={{ mb: 1 }}>
                            {n.body}
                          </Typography>

                          {/* Entity info */}
                          {n.entityType && (
                            <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
                              <Chip
                                size="small"
                                label={entityLabel[n.entityType] || n.entityType}
                                variant="outlined"
                                color="primary"
                                sx={{ height: 22 }}
                              />
                              {n.entityId && (
                                <Typography variant="caption" color="text.secondary" sx={{ lineHeight: '22px' }}>
                                  ID: {n.entityId.slice(0, 8)}...
                                </Typography>
                              )}
                            </Box>
                          )}

                          {/* Due date */}
                          {n.dueAt && (
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                              Due: {new Date(n.dueAt).toLocaleString()} ({formatDueDate(n.dueAt)})
                            </Typography>
                          )}

                          {/* Why you got this */}
                          <Box sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 0.5,
                            mb: 1,
                            px: 1,
                            py: 0.5,
                            bgcolor: 'primary.50',
                            borderRadius: 0.5,
                            border: '1px solid',
                            borderColor: 'primary.100',
                          }}>
                            <InfoIcon sx={{ fontSize: 14, color: 'primary.main' }} />
                            <Typography variant="caption" color="primary.main" fontWeight={500}>
                              Why you got this: {getReasonText(n)}
                            </Typography>
                          </Box>

                          {/* Action buttons (max 2 + "Open") */}
                          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                            {/* Always show Open button if entity exists */}
                            {(n.entityType || n.link) && (
                              <Button
                                size="small"
                                variant="outlined"
                                startIcon={<OpenIcon />}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (!n.readAt) handleMarkRead(n.id);
                                  handleOpenRecord(n);
                                }}
                                sx={{ textTransform: 'none', fontSize: '0.75rem' }}
                              >
                                Open
                              </Button>
                            )}
                            {/* Render up to 2 non-OPEN actions */}
                            {(n.actions || [])
                              .filter((a) => a.actionType !== 'OPEN_RECORD' && a.actionType !== 'OPEN_ENTITY')
                              .slice(0, 2)
                              .map((action, idx) => {
                                // Find original index in actions array
                                const origIdx = (n.actions || []).indexOf(action);
                                return (
                                  <Tooltip key={idx} title={action.label}>
                                    <Button
                                      size="small"
                                      variant="text"
                                      startIcon={getActionIcon(action.actionType)}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleAction(n, action, origIdx);
                                      }}
                                      sx={{ textTransform: 'none', fontSize: '0.75rem' }}
                                    >
                                      {action.label}
                                    </Button>
                                  </Tooltip>
                                );
                              })}
                            {/* Mark read button if unread */}
                            {!isRead(n) && (
                              <Button
                                size="small"
                                variant="text"
                                startIcon={<MarkReadIcon />}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (!isRead(n)) handleMarkRead(n.id);
                                }}
                                sx={{ textTransform: 'none', fontSize: '0.75rem', ml: 'auto' }}
                              >
                                Mark read
                              </Button>
                            )}
                          </Box>
                        </Box>
                      </Collapse>

                      <Divider />
                    </Box>
                  </Fade>
                ))}
              </List>
            )}
          </Box>

          {/* Footer */}
          <Box sx={{ p: 1.5, borderTop: 1, borderColor: 'divider', textAlign: 'center', bgcolor: 'background.paper' }}>
            <Typography variant="caption" color="text.disabled">
              Notification Center v1 — triggers + actions + smart preview
            </Typography>
          </Box>
        </Box>
      </Drawer>

      {/* Action Confirmation Dialog */}
      <Dialog
        open={!!confirmAction}
        onClose={() => setConfirmAction(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Confirm Action</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {confirmAction && (
              <>
                Are you sure you want to execute <strong>{confirmAction.action.label}</strong>
                {confirmAction.notification.title ? ` for "${confirmAction.notification.title}"` : ''}?
              </>
            )}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmAction(null)} disabled={actionLoading}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={() => {
              if (confirmAction) {
                executeAction(confirmAction.notification, confirmAction.action, confirmAction.actionIndex);
              }
            }}
            disabled={actionLoading}
          >
            {actionLoading ? <CircularProgress size={18} /> : 'Confirm'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default NotificationBell;
