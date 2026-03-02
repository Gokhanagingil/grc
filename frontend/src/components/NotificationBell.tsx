import React, { useState, useEffect, useCallback } from 'react';
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
} from '@mui/material';
import {
  Notifications as BellIcon,
  MarkEmailRead as MarkReadIcon,
  Close as CloseIcon,
  OpenInNew as OpenIcon,
  FiberManualRecord as DotIcon,
} from '@mui/icons-material';
import { api } from '../services/api';

/* ------------------------------------------------------------------ */
/* Types                                                                */
/* ------------------------------------------------------------------ */

interface NotificationAction {
  label: string;
  actionType: string;
  payload: Record<string, unknown>;
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

/** Map entity types to frontend routes for deep-linking. */
const entityRouteMap: Record<string, string> = {
  todo_task: '/todo',
  grc_risk: '/risk-management',
  grc_control: '/controls',
  grc_issue: '/issues',
  grc_capa: '/capas',
  grc_audit: '/audits',
  itsm_incident: '/itsm/incidents',
  itsm_change: '/itsm/changes',
};

function resolveEntityRoute(entityType: string | null, entityId: string | null): string | null {
  if (!entityType || !entityId) return null;
  const base = entityRouteMap[entityType];
  if (base) return `${base}/${entityId}`;
  // Fallback: use link-style path
  return `/${entityType}/${entityId}`;
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
  return `${diffDays}d ago`;
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
/* Component                                                            */
/* ------------------------------------------------------------------ */

export const NotificationBell: React.FC = () => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<UserNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadNotifications = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const res = await api.get('/grc/user-notifications', { params: { pageSize: 20 } });
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
  }, []);

  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 30000);
    return () => clearInterval(interval);
  }, [loadNotifications]);

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
    loadNotifications();
  };

  /** Navigate to the related entity record. Mark-as-read is handled by the caller. */
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

  /** Handle action button clicks. */
  const handleAction = (n: UserNotification, action: NotificationAction) => {
    switch (action.actionType) {
      case 'OPEN_RECORD': {
        const aEntityType = action.payload.entityType as string | undefined;
        const aEntityId = action.payload.entityId as string | undefined;
        const route = resolveEntityRoute(aEntityType || n.entityType, aEntityId || n.entityId);
        if (route) {
          setOpen(false);
          if (!n.readAt) handleMarkRead(n.id);
          navigate(route);
        }
        break;
      }
      default:
        // Future action types: TAKE_OWNERSHIP, CREATE_CHANGE, START_CAPA_STEP
        break;
    }
  };

  const isRead = (n: UserNotification) => !!n.readAt;

  return (
    <>
      <IconButton
        color="inherit"
        onClick={handleOpen}
        data-testid="notification-bell"
        aria-label="notifications"
      >
        <Badge badgeContent={unreadCount} color="error" max={99}>
          <BellIcon />
        </Badge>
      </IconButton>

      <Drawer
        anchor="right"
        open={open}
        onClose={() => setOpen(false)}
        PaperProps={{ sx: { width: 400, maxWidth: '100%' } }}
        data-testid="notification-drawer"
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          {/* Header */}
          <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: 1, borderColor: 'divider' }}>
            <Typography variant="h6">Notifications</Typography>
            <Box>
              {unreadCount > 0 && (
                <Button size="small" startIcon={<MarkReadIcon />} onClick={handleMarkAllRead} sx={{ mr: 1 }}>
                  Mark all read
                </Button>
              )}
              <IconButton size="small" onClick={() => setOpen(false)} aria-label="close notifications">
                <CloseIcon />
              </IconButton>
            </Box>
          </Box>

          {/* Body */}
          <Box sx={{ flex: 1, overflow: 'auto' }}>
            {error && <Alert severity="error" sx={{ m: 1 }}>{error}</Alert>}

            {loading && notifications.length === 0 ? (
              <Box display="flex" justifyContent="center" py={4}>
                <CircularProgress size={24} />
              </Box>
            ) : notifications.length === 0 ? (
              <Box py={6} textAlign="center">
                <BellIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
                <Typography color="text.secondary">No notifications</Typography>
              </Box>
            ) : (
              <List disablePadding>
                {notifications.map((n) => (
                  <React.Fragment key={n.id}>
                    <ListItem disablePadding>
                      <ListItemButton
                        onClick={() => {
                          if (!isRead(n)) handleMarkRead(n.id);
                          handleOpenRecord(n);
                        }}
                        sx={{
                          bgcolor: isRead(n) ? 'transparent' : 'action.hover',
                          py: 1.5,
                          px: 2,
                        }}
                      >
                        {/* Unread indicator dot */}
                        {!isRead(n) && (
                          <DotIcon
                            sx={{
                              fontSize: 10,
                              color: severityColor[n.severity] === 'error'
                                ? 'error.main'
                                : severityColor[n.severity] === 'warning'
                                  ? 'warning.main'
                                  : 'primary.main',
                              mr: 1,
                              flexShrink: 0,
                            }}
                          />
                        )}
                        <ListItemText
                          primary={
                            <Box display="flex" justifyContent="space-between" alignItems="center">
                              <Typography
                                variant="subtitle2"
                                sx={{ fontWeight: isRead(n) ? 'normal' : 'bold' }}
                              >
                                {n.title}
                              </Typography>
                              <Typography
                                variant="caption"
                                color="text.secondary"
                                sx={{ ml: 1, whiteSpace: 'nowrap' }}
                              >
                                {formatTime(n.createdAt)}
                              </Typography>
                            </Box>
                          }
                          secondary={
                            <Box component="span" sx={{ display: 'block' }}>
                              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                {n.body}
                              </Typography>
                              {/* Source & severity chips */}
                              <Box sx={{ mt: 0.5, display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                                {n.source && n.source !== 'SYSTEM' && (
                                  <Chip
                                    size="small"
                                    label={sourceLabel[n.source] || n.source}
                                    variant="outlined"
                                  />
                                )}
                                {n.severity && n.severity !== 'INFO' && (
                                  <Chip
                                    size="small"
                                    label={n.severity}
                                    color={severityColor[n.severity] || 'default'}
                                  />
                                )}
                              </Box>
                              {/* Action buttons */}
                              {n.actions && n.actions.length > 0 && (
                                <Box sx={{ mt: 0.5, display: 'flex', gap: 0.5 }}>
                                  {n.actions.map((action, idx) => (
                                    <Tooltip key={idx} title={action.label}>
                                      <Button
                                        size="small"
                                        variant="text"
                                        startIcon={action.actionType === 'OPEN_RECORD' ? <OpenIcon /> : undefined}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleAction(n, action);
                                        }}
                                        sx={{ textTransform: 'none', minWidth: 'auto', p: '2px 8px' }}
                                      >
                                        {action.label}
                                      </Button>
                                    </Tooltip>
                                  ))}
                                </Box>
                              )}
                            </Box>
                          }
                        />
                      </ListItemButton>
                    </ListItem>
                    <Divider />
                  </React.Fragment>
                ))}
              </List>
            )}
          </Box>

          {/* Footer / Roadmap placeholder */}
          <Box sx={{ p: 1.5, borderTop: 1, borderColor: 'divider', textAlign: 'center' }}>
            <Typography variant="caption" color="text.disabled">
              Notification Center v0 — read-only + triggers
            </Typography>
          </Box>
        </Box>
      </Drawer>
    </>
  );
};

export default NotificationBell;
