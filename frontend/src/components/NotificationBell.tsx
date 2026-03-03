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
  Checkbox,
  Menu,
  TextField,
  Skeleton,
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
  Snooze as SnoozeIcon,
  NotificationsActive as ReminderIcon,
  Add as AddIcon,
  LightbulbOutlined as SuggestIcon,
  AlarmOn as AlarmIcon,
} from '@mui/icons-material';
import { api } from '../services/api';

/* ------------------------------------------------------------------ */
/* Types                                                                */
/* ------------------------------------------------------------------ */

interface NotificationAction {
  id?: string;
  label: string;
  actionType: string;
  payload: Record<string, unknown>;
  requiresConfirm?: boolean;
  dangerLevel?: 'SAFE' | 'GUARDED';
}

interface EntitySnapshot {
  primaryLabel: string;
  secondaryLabel?: string;
  keyFields: Array<{ label: string; value: string }>;
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
  status: string;
  snoozeUntil: string | null;
  remindAt: string | null;
  actions: NotificationAction[];
  metadata: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
}

type TabValue = 'all' | 'assignments' | 'due_soon' | 'snoozed';

interface TimeBucket {
  label: string;
  items: UserNotification[];
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

const typeIcon: Record<string, React.ReactNode> = {
  ASSIGNMENT: <AssignIcon fontSize="small" />,
  DUE_DATE: <DueIcon fontSize="small" />,
  STATUS_CHANGE: <WarningIcon fontSize="small" />,
  PERSONAL_REMINDER: <AlarmIcon fontSize="small" />,
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

/**
 * Build a deep-link route for an entity.
 * For todo_task: appends ?taskId=<id> so the Task Drawer opens directly.
 */
function buildDeepLink(entityType: string | null, entityId: string | null): string | null {
  if (!entityType) return null;
  const base = entityRouteMap[entityType];
  if (!base) return entityId ? `/${entityType}/${entityId}` : null;
  // Deep link for To-Do tasks: open drawer via query param
  if (entityType === 'todo_task' && entityId) {
    return `${base}?taskId=${entityId}`;
  }
  return entityId ? `${base}/${entityId}` : base;
}

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
  PERSONAL_REMINDER: 'Personal reminder you created',
  GENERAL: 'Policy rule / system trigger',
};

/** Suggested next steps by notification type (rules-based, v1.2 action-mapped). */
interface SuggestedStep {
  label: string;
  actionType: string;
  requiresConfirm: boolean;
}
const suggestedStepsByType: Record<string, SuggestedStep[]> = {
  ASSIGNMENT: [
    { label: 'Assign to Me', actionType: 'ASSIGN_TO_ME', requiresConfirm: true },
    { label: 'Set Due Date', actionType: 'SET_DUE_DATE', requiresConfirm: true },
    { label: 'Create Follow-up', actionType: 'CREATE_FOLLOWUP_TODO', requiresConfirm: true },
  ],
  DUE_DATE: [
    { label: 'Snooze', actionType: 'SNOOZE', requiresConfirm: false },
    { label: 'Set Due Date', actionType: 'SET_DUE_DATE', requiresConfirm: true },
    { label: 'Create Follow-up', actionType: 'CREATE_FOLLOWUP_TODO', requiresConfirm: true },
  ],
  STATUS_CHANGE: [
    { label: 'Open Record', actionType: 'OPEN_RECORD', requiresConfirm: false },
  ],
  PERSONAL_REMINDER: [
    { label: 'Snooze', actionType: 'SNOOZE', requiresConfirm: false },
  ],
};

/** Legacy text suggestions for fallback display. */
const suggestedActionsMap: Record<string, string> = {
  ASSIGNMENT: 'Review due date, confirm priority, and add details if needed.',
  DUE_DATE: 'Consider snoozing, updating the due date, or completing the task.',
  STATUS_CHANGE: 'Review the status change and take any necessary follow-up action.',
  MENTION: 'Check the context and respond or acknowledge as needed.',
  PERSONAL_REMINDER: 'Complete the reminder action or snooze for later.',
};


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

/** Group notifications into time buckets: Today, Yesterday, This Week, Older. */
function groupByTimeBuckets(items: UserNotification[]): TimeBucket[] {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterdayStart = new Date(todayStart.getTime() - 86400000);
  const weekStart = new Date(todayStart.getTime() - 6 * 86400000);

  const buckets: Record<string, UserNotification[]> = {
    Today: [],
    Yesterday: [],
    'This Week': [],
    Older: [],
  };

  for (const n of items) {
    const created = new Date(n.createdAt);
    if (created >= todayStart) {
      buckets['Today'].push(n);
    } else if (created >= yesterdayStart) {
      buckets['Yesterday'].push(n);
    } else if (created >= weekStart) {
      buckets['This Week'].push(n);
    } else {
      buckets['Older'].push(n);
    }
  }

  return Object.entries(buckets)
    .filter(([, items]) => items.length > 0)
    .map(([label, items]) => ({ label, items }));
}

/** Compute snooze target time. */
function getSnoozeTime(option: string): Date {
  const now = new Date();
  switch (option) {
    case '1h':
      return new Date(now.getTime() + 60 * 60 * 1000);
    case '4h':
      return new Date(now.getTime() + 4 * 60 * 60 * 1000);
    case 'tomorrow': {
      const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 9, 0, 0);
      return tomorrow;
    }
    case 'next_week': {
      const nextWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7, 9, 0, 0);
      return nextWeek;
    }
    default:
      return new Date(now.getTime() + 60 * 60 * 1000);
  }
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
    status: (raw.status as string) || 'ACTIVE',
    snoozeUntil: (raw.snoozeUntil as string) || (raw.snooze_until as string) || null,
    remindAt: (raw.remindAt as string) || (raw.remind_at as string) || null,
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
/* Loading Skeleton                                                     */
/* ------------------------------------------------------------------ */

const NotificationSkeleton: React.FC = () => (
  <Box sx={{ px: 2, py: 1.5 }}>
    {[1, 2, 3, 4, 5].map((i) => (
      <Box key={i} sx={{ display: 'flex', gap: 1.5, mb: 2 }}>
        <Skeleton variant="circular" width={28} height={28} />
        <Box sx={{ flex: 1 }}>
          <Skeleton variant="text" width="70%" height={20} />
          <Skeleton variant="text" width="90%" height={16} />
          <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5 }}>
            <Skeleton variant="rounded" width={50} height={20} />
            <Skeleton variant="rounded" width={60} height={20} />
          </Box>
        </Box>
      </Box>
    ))}
  </Box>
);

/* ------------------------------------------------------------------ */
/* Component                                                            */
/* ------------------------------------------------------------------ */

export const NotificationBell: React.FC = () => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<UserNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [snoozedCount, setSnoozedCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Tabs + Filters
  const [activeTab, setActiveTab] = useState<TabValue>('all');
  const [severityFilter, setSeverityFilter] = useState<string>('');
  const [moduleFilter, setModuleFilter] = useState<string>('');
  const [showFilters, setShowFilters] = useState(false);

  // Smart preview card
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Snooze menu
  const [snoozeAnchorEl, setSnoozeAnchorEl] = useState<null | HTMLElement>(null);
  const [snoozeTargetId, setSnoozeTargetId] = useState<string | null>(null);

  // Personal reminder dialog
  const [reminderDialogOpen, setReminderDialogOpen] = useState(false);
  const [reminderTitle, setReminderTitle] = useState('');
  const [reminderNote, setReminderNote] = useState('');
  const [reminderDate, setReminderDate] = useState('');
  const [reminderLoading, setReminderLoading] = useState(false);

  // Action confirmation dialog
  const [confirmAction, setConfirmAction] = useState<{
    notification: UserNotification;
    action: NotificationAction;
    actionIndex: number;
  } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Due date picker dialog (for SET_DUE_DATE action)
  const [dueDateDialogOpen, setDueDateDialogOpen] = useState(false);
  const [dueDateValue, setDueDateValue] = useState('');
  const [dueDateTarget, setDueDateTarget] = useState<{
    notification: UserNotification;
    action: NotificationAction;
    actionIndex: number;
  } | null>(null);

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
      setSnoozedCount(data.snoozedCount ?? 0);
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
        prev.map((n) => (n.id === id && !n.readAt ? { ...n, readAt: new Date().toISOString() } : n)),
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

  /** Navigate to the related entity record with deep linking (v1.2). */
  const handleOpenRecord = (n: UserNotification) => {
    const route = buildDeepLink(n.entityType, n.entityId);
    if (route) {
      setOpen(false);
      navigate(route);
    } else if (n.link) {
      setOpen(false);
      navigate(n.link);
    }
  };

  /* ---- Snooze handlers ---- */

  const handleSnooze = async (notificationId: string, option: string) => {
    try {
      const until = getSnoozeTime(option);
      await api.post(`/grc/user-notifications/${notificationId}/snooze`, {
        until: until.toISOString(),
      });
      setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
      setUnreadCount((prev) => {
        const wasUnread = notifications.find((n) => n.id === notificationId && !n.readAt);
        return wasUnread ? Math.max(0, prev - 1) : prev;
      });
      setSnoozedCount((prev) => prev + 1);
    } catch {
      /* silent */
    } finally {
      setSnoozeAnchorEl(null);
      setSnoozeTargetId(null);
    }
  };

  const handleUnsnooze = async (notificationId: string) => {
    try {
      await api.post(`/grc/user-notifications/${notificationId}/unsnooze`);
      setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
      setSnoozedCount((prev) => Math.max(0, prev - 1));
      setUnreadCount((prev) => prev + 1);
    } catch {
      /* silent */
    }
  };

  /* ---- Bulk action handlers ---- */

  const handleBulkMarkRead = async () => {
    const ids = Array.from(selectedIds);
    for (const id of ids) {
      await handleMarkRead(id);
    }
    setSelectedIds(new Set());
  };

  const handleBulkSnooze = async (option: string) => {
    const ids = Array.from(selectedIds);
    for (const id of ids) {
      await handleSnooze(id, option);
    }
    setSelectedIds(new Set());
  };

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  /* ---- Personal Reminder handlers ---- */

  const handleCreateReminder = async () => {
    if (!reminderTitle.trim() || !reminderDate) return;
    try {
      setReminderLoading(true);
      await api.post('/grc/user-notifications/reminders', {
        title: reminderTitle.trim(),
        note: reminderNote.trim() || undefined,
        remindAt: new Date(reminderDate).toISOString(),
      });
      setReminderDialogOpen(false);
      setReminderTitle('');
      setReminderNote('');
      setReminderDate('');
      // Reload to show new reminder
      loadNotifications();
    } catch {
      /* silent */
    } finally {
      setReminderLoading(false);
    }
  };

  /** Execute action via backend endpoint with optional confirmation (v1.2). */
  const executeAction = async (n: UserNotification, action: NotificationAction, actionIndex: number, extraPayload?: Record<string, unknown>) => {
    // OPEN_RECORD / OPEN_ENTITY: deep-link navigate, no server call needed
    if (action.actionType === 'OPEN_RECORD' || action.actionType === 'OPEN_ENTITY') {
      const aEntityType = action.payload.entityType as string | undefined;
      const aEntityId = action.payload.entityId as string | undefined;
      const route = buildDeepLink(aEntityType || n.entityType, aEntityId || n.entityId);
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

    // SET_DUE_DATE: if no dueDate in payload, open date picker dialog
    if (action.actionType === 'SET_DUE_DATE' && !extraPayload?.dueDate) {
      setDueDateTarget({ notification: n, action, actionIndex });
      setDueDateValue('');
      setDueDateDialogOpen(true);
      setConfirmAction(null);
      return;
    }

    // For ASSIGN_TO_ME, SET_DUE_DATE, CREATE_FOLLOWUP_TODO: call server-side execute endpoint
    try {
      setActionLoading(true);
      const mergedPayload = { ...action.payload, ...(extraPayload || {}) };
      const res = await api.post(`/grc/user-notifications/${n.id}/actions/${actionIndex}/execute`, {
        payload: mergedPayload,
      });
      // Update notification snapshot in local state if server returned one
      const resData = res.data?.data || res.data;
      if (resData?.updatedSnapshot) {
        setNotifications((prev) => prev.map((notif) => {
          if (notif.id !== n.id) return notif;
          return {
            ...notif,
            metadata: { ...notif.metadata, snapshot: resData.updatedSnapshot },
          };
        }));
      }
      // Auto mark-read after executing
      if (!n.readAt) {
        handleMarkRead(n.id);
      }
    } catch {
      /* silent -- action may not be implemented yet */
    } finally {
      setActionLoading(false);
      setConfirmAction(null);
    }
  };

  /** Submit the due date from the date picker dialog. */
  const handleDueDateSubmit = () => {
    if (!dueDateTarget || !dueDateValue) return;
    const isoDate = new Date(dueDateValue).toISOString();
    executeAction(
      dueDateTarget.notification,
      dueDateTarget.action,
      dueDateTarget.actionIndex,
      { dueDate: isoDate },
    );
    setDueDateDialogOpen(false);
    setDueDateTarget(null);
    setDueDateValue('');
  };

  /** Handle action button clicks (with confirmation gate, v1.2). */
  const handleAction = (n: UserNotification, action: NotificationAction, actionIndex: number) => {
    // SET_DUE_DATE always opens date picker first
    if (action.actionType === 'SET_DUE_DATE') {
      setDueDateTarget({ notification: n, action, actionIndex });
      setDueDateValue('');
      setDueDateDialogOpen(true);
      return;
    }
    // CREATE_FOLLOWUP_TODO and ASSIGN_TO_ME require confirmation
    if (action.requiresConfirm || action.actionType === 'ASSIGN_TO_ME' || action.actionType === 'CREATE_FOLLOWUP_TODO') {
      setConfirmAction({ notification: n, action, actionIndex });
    } else {
      executeAction(n, action, actionIndex);
    }
  };

  /** Handle suggested step button clicks (synthetic actions). */
  const handleSuggestedStep = (n: UserNotification, step: SuggestedStep) => {
    // Build a synthetic action from the step
    const syntheticAction: NotificationAction = {
      id: `suggested_${step.actionType}`,
      label: step.label,
      actionType: step.actionType,
      payload: { entityType: n.entityType, entityId: n.entityId },
      requiresConfirm: step.requiresConfirm,
      dangerLevel: 'SAFE',
    };
    // Find matching action index in notification's actions array (for server-side dispatch)
    const matchIdx = (n.actions || []).findIndex((a) => a.actionType === step.actionType);
    const actionIndex = matchIdx >= 0 ? matchIdx : 0;
    // Snooze is handled client-side
    if (step.actionType === 'SNOOZE') {
      setSnoozeTargetId(n.id);
      // We can't get anchorEl here easily, so just snooze for 1h directly
      handleSnooze(n.id, '1h');
      return;
    }
    handleAction(n, syntheticAction, actionIndex);
  };

  const isRead = (n: UserNotification) => !!n.readAt;

  /** Build "Why you got this" text. */
  const getReasonText = (n: UserNotification): string => {
    const metaReason = n.metadata?.reason as string | undefined;
    if (metaReason) return metaReason;
    return reasonMap[n.type] || 'Notification';
  };

  /** Get entity snapshot from metadata. */
  const getSnapshot = (n: UserNotification): EntitySnapshot | null => {
    const snap = n.metadata?.snapshot as EntitySnapshot | undefined;
    if (snap && snap.primaryLabel) return snap;
    return null;
  };

  /** Get suggested next steps for a notification (v1.2: action-mapped). */
  const getSuggestedSteps = (n: UserNotification): SuggestedStep[] => {
    return suggestedStepsByType[n.type] || [];
  };

  /** Get suggested text fallback for a notification. */
  const getSuggestedActions = (n: UserNotification): string | null => {
    return suggestedActionsMap[n.type] || null;
  };

  /** Action icon helper (v1.2: includes CREATE_FOLLOWUP_TODO). */
  const getActionIcon = (actionType: string) => {
    switch (actionType) {
      case 'OPEN_RECORD':
      case 'OPEN_ENTITY':
        return <OpenIcon fontSize="small" />;
      case 'ASSIGN_TO_ME':
        return <AssignToMeIcon fontSize="small" />;
      case 'SET_DUE_DATE':
        return <CalendarIcon fontSize="small" />;
      case 'CREATE_FOLLOWUP_TODO':
        return <AddIcon fontSize="small" />;
      case 'SNOOZE':
        return <SnoozeIcon fontSize="small" />;
      default:
        return undefined;
    }
  };

  // Group notifications into time buckets
  const timeBuckets = useMemo(() => groupByTimeBuckets(notifications), [notifications]);

  const isSnoozedTab = activeTab === 'snoozed';
  const hasBulkSelection = selectedIds.size > 0;

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
            width: 460,
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
            <Box sx={{ display: 'flex', gap: 0.25 }}>
              <Tooltip title="Add Reminder">
                <IconButton size="small" onClick={() => setReminderDialogOpen(true)} aria-label="Add reminder" sx={{ mr: 0.25 }}>
                  <AddIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              {unreadCount > 0 && (
                  <Tooltip title="Mark all as read">
                    <IconButton size="small" onClick={handleMarkAllRead} aria-label="Mark all read" sx={{ mr: 0.25 }}>
                      <MarkReadIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
              )}
              <Tooltip title="Filters">
                <IconButton
                  size="small"
                  onClick={() => setShowFilters(!showFilters)}
                  color={showFilters ? 'primary' : 'default'}
                  sx={{ mr: 0.25 }}
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
            onChange={(_e, v: TabValue) => { setActiveTab(v); setSelectedIds(new Set()); }}
            variant="scrollable"
            scrollButtons="auto"
            sx={{
              minHeight: 40,
              borderBottom: 1,
              borderColor: 'divider',
              '& .MuiTab-root': { minHeight: 40, textTransform: 'none', fontSize: '0.82rem', minWidth: 'auto', px: 2 },
            }}
          >
            <Tab label="All" value="all" />
            <Tab label="Assignments" value="assignments" />
            <Tab label="Due Soon" value="due_soon" />
            <Tab
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <SnoozeIcon sx={{ fontSize: 16 }} />
                  Snoozed
                  {snoozedCount > 0 && (
                    <Chip size="small" label={snoozedCount} sx={{ height: 18, fontSize: '0.7rem', ml: 0.5 }} />
                  )}
                </Box>
              }
              value="snoozed"
            />
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

          {/* Bulk Actions Bar */}
          <Collapse in={hasBulkSelection}>
            <Box sx={{
              p: 1, display: 'flex', gap: 1, alignItems: 'center',
              bgcolor: 'primary.50', borderBottom: 1, borderColor: 'divider',
            }}>
              <Typography variant="caption" fontWeight={600} sx={{ mr: 1 }}>
                {selectedIds.size} selected
              </Typography>
              <Button size="small" variant="outlined" startIcon={<MarkReadIcon />}
                onClick={handleBulkMarkRead} sx={{ textTransform: 'none', fontSize: '0.75rem' }}>
                Mark Read
              </Button>
              <Button size="small" variant="outlined" startIcon={<SnoozeIcon />}
                onClick={() => handleBulkSnooze('1h')} sx={{ textTransform: 'none', fontSize: '0.75rem' }}>
                Snooze 1h
              </Button>
              <Button size="small" variant="text"
                onClick={() => setSelectedIds(new Set())} sx={{ textTransform: 'none', fontSize: '0.75rem', ml: 'auto' }}>
                Clear
              </Button>
            </Box>
          </Collapse>

          {/* Body */}
          <Box sx={{ flex: 1, overflow: 'auto' }}>
            {error && <Alert severity="error" sx={{ m: 1 }}>{error}</Alert>}

            {loading && notifications.length === 0 ? (
              <NotificationSkeleton />
            ) : notifications.length === 0 ? (
              <Fade in timeout={300}>
                <Box py={6} textAlign="center">
                  {isSnoozedTab ? (
                    <>
                      <SnoozeIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
                      <Typography color="text.secondary">No snoozed notifications</Typography>
                      <Typography variant="caption" color="text.disabled">
                        Snoozed items will appear here
                      </Typography>
                    </>
                  ) : (
                    <>
                      <BellIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
                      <Typography color="text.secondary">No notifications</Typography>
                      <Typography variant="caption" color="text.disabled">
                        {activeTab !== 'all' ? 'Try switching to the "All" tab' : 'You\'re all caught up!'}
                      </Typography>
                    </>
                  )}
                </Box>
              </Fade>
            ) : (
              <List disablePadding>
                {timeBuckets.map((bucket) => (
                  <Box key={bucket.label}>
                    {/* Time bucket header */}
                    <Box sx={{
                      px: 2, py: 0.75, bgcolor: 'grey.50',
                      borderBottom: 1, borderColor: 'divider',
                      position: 'sticky', top: 0, zIndex: 1,
                    }}>
                      <Typography variant="caption" fontWeight={600} color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
                        {bucket.label}
                      </Typography>
                    </Box>

                    {bucket.items.map((n) => (
                      <Fade in timeout={200} key={n.id}>
                        <Box>
                          <ListItem disablePadding>
                            <ListItemButton
                              onClick={() => {
                                if (!isRead(n) && !isSnoozedTab) handleMarkRead(n.id);
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
                              {/* Checkbox for bulk selection */}
                              {!isSnoozedTab && (
                                <Checkbox
                                  size="small"
                                  checked={selectedIds.has(n.id)}
                                  onClick={(e) => { e.stopPropagation(); toggleSelected(n.id); }}
                                  sx={{ p: 0.25, mr: 0.5 }}
                                />
                              )}
                              {/* Type icon + unread indicator */}
                              <Box sx={{ mr: 1.5, display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 28 }}>
                                {typeIcon[n.type] || severityIcon[n.severity] || <BellIcon fontSize="small" />}
                                {!isRead(n) && !isSnoozedTab && (
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
                                      {n.type === 'PERSONAL_REMINDER' && (
                                        <Chip size="small" label="Reminder" icon={<ReminderIcon style={{ fontSize: 14 }} />} color="info" variant="outlined" sx={{ height: 20, fontSize: '0.7rem' }} />
                                      )}
                                      {isSnoozedTab && n.snoozeUntil && (
                                        <Chip size="small" label={`Until ${new Date(n.snoozeUntil).toLocaleString()}`} icon={<SnoozeIcon style={{ fontSize: 14 }} />} color="default" variant="outlined" sx={{ height: 20, fontSize: '0.7rem' }} />
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

                          {/* Smart Preview Card (WOW v1.1) */}
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

                              {/* Entity Snapshot (v1.1) */}
                              {(() => {
                                const snapshot = getSnapshot(n);
                                if (snapshot) {
                                  return (
                                    <Box sx={{
                                      mb: 1, p: 1, bgcolor: 'background.paper',
                                      borderRadius: 0.5, border: '1px solid', borderColor: 'divider',
                                    }}>
                                      <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 0.25 }}>
                                        {snapshot.primaryLabel}
                                      </Typography>
                                      {snapshot.secondaryLabel && (
                                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                                          {snapshot.secondaryLabel}
                                        </Typography>
                                      )}
                                      {snapshot.keyFields.length > 0 && (
                                        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                                          {snapshot.keyFields.map((field, i) => (
                                            <Chip
                                              key={i}
                                              size="small"
                                              label={`${field.label}: ${field.value}`}
                                              variant="outlined"
                                              sx={{ height: 22, fontSize: '0.7rem' }}
                                            />
                                          ))}
                                        </Box>
                                      )}
                                    </Box>
                                  );
                                }
                                // Fallback: show entity info if no snapshot
                                if (n.entityType) {
                                  return (
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
                                  );
                                }
                                return null;
                              })()}

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

                              {/* Suggested Next Steps (v1.2 — action-mapped buttons) */}
                              {(() => {
                                const steps = getSuggestedSteps(n);
                                const fallback = getSuggestedActions(n);
                                if (steps.length === 0 && !fallback) return null;
                                return (
                                  <Box sx={{
                                    mb: 1,
                                    px: 1,
                                    py: 0.75,
                                    bgcolor: 'warning.50',
                                    borderRadius: 0.5,
                                    border: '1px solid',
                                    borderColor: 'warning.100',
                                  }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: steps.length > 0 ? 0.75 : 0 }}>
                                      <SuggestIcon sx={{ fontSize: 14, color: 'warning.main' }} />
                                      <Typography variant="caption" color="warning.main" fontWeight={600}>
                                        Suggested next steps
                                      </Typography>
                                    </Box>
                                    {steps.length > 0 ? (
                                      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                                        {steps.map((step, idx) => (
                                          <Button
                                            key={idx}
                                            size="small"
                                            variant="outlined"
                                            startIcon={getActionIcon(step.actionType)}
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleSuggestedStep(n, step);
                                            }}
                                            sx={{
                                              textTransform: 'none',
                                              fontSize: '0.72rem',
                                              borderColor: 'warning.200',
                                              color: 'warning.dark',
                                              '&:hover': { borderColor: 'warning.main', bgcolor: 'warning.100' },
                                            }}
                                          >
                                            {step.label}
                                          </Button>
                                        ))}
                                      </Box>
                                    ) : fallback ? (
                                      <Typography variant="caption" color="warning.main">
                                        {fallback}
                                      </Typography>
                                    ) : null}
                                  </Box>
                                );
                              })()}

                              {/* Action buttons */}
                              <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                                {/* Open button */}
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
                                {/* Snooze button (only for non-snoozed items) */}
                                {!isSnoozedTab && (
                                  <Button
                                    size="small"
                                    variant="text"
                                    startIcon={<SnoozeIcon />}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSnoozeTargetId(n.id);
                                      setSnoozeAnchorEl(e.currentTarget);
                                    }}
                                    sx={{ textTransform: 'none', fontSize: '0.75rem' }}
                                  >
                                    Snooze
                                  </Button>
                                )}
                                {/* Unsnooze button */}
                                {isSnoozedTab && (
                                  <Button
                                    size="small"
                                    variant="outlined"
                                    color="primary"
                                    startIcon={<AlarmIcon />}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleUnsnooze(n.id);
                                    }}
                                    sx={{ textTransform: 'none', fontSize: '0.75rem' }}
                                  >
                                    Unsnooze
                                  </Button>
                                )}
                                {/* Render up to 3 non-OPEN actions (v1.2) */}
                                {(n.actions || [])
                                  .filter((a) => a.actionType !== 'OPEN_RECORD' && a.actionType !== 'OPEN_ENTITY')
                                  .slice(0, 3)
                                  .map((action, idx) => {
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
                                {!isRead(n) && !isSnoozedTab && (
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
                  </Box>
                ))}
              </List>
            )}
          </Box>

          {/* Footer */}
          <Box sx={{ p: 1.5, borderTop: 1, borderColor: 'divider', textAlign: 'center', bgcolor: 'background.paper' }}>
            <Typography variant="caption" color="text.disabled">
              Notification Center v1.2 -- actions + suggestions + deep links
            </Typography>
          </Box>
        </Box>
      </Drawer>

      {/* Snooze Menu */}
      <Menu
        anchorEl={snoozeAnchorEl}
        open={!!snoozeAnchorEl}
        onClose={() => { setSnoozeAnchorEl(null); setSnoozeTargetId(null); }}
      >
        <MenuItem onClick={() => snoozeTargetId && handleSnooze(snoozeTargetId, '1h')}>
          <SnoozeIcon fontSize="small" sx={{ mr: 1 }} /> 1 hour
        </MenuItem>
        <MenuItem onClick={() => snoozeTargetId && handleSnooze(snoozeTargetId, '4h')}>
          <SnoozeIcon fontSize="small" sx={{ mr: 1 }} /> 4 hours
        </MenuItem>
        <MenuItem onClick={() => snoozeTargetId && handleSnooze(snoozeTargetId, 'tomorrow')}>
          <CalendarIcon fontSize="small" sx={{ mr: 1 }} /> Tomorrow 9:00 AM
        </MenuItem>
        <MenuItem onClick={() => snoozeTargetId && handleSnooze(snoozeTargetId, 'next_week')}>
          <CalendarIcon fontSize="small" sx={{ mr: 1 }} /> Next week
        </MenuItem>
      </Menu>

      {/* Personal Reminder Dialog */}
      <Dialog
        open={reminderDialogOpen}
        onClose={() => setReminderDialogOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <ReminderIcon color="primary" /> New Reminder
        </DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Title"
            fullWidth
            variant="outlined"
            value={reminderTitle}
            onChange={(e) => setReminderTitle(e.target.value)}
            placeholder="e.g., Follow up on audit finding"
            size="small"
            sx={{ mb: 2 }}
          />
          <TextField
            margin="dense"
            label="Note (optional)"
            fullWidth
            variant="outlined"
            value={reminderNote}
            onChange={(e) => setReminderNote(e.target.value)}
            placeholder="Additional details..."
            multiline
            rows={2}
            size="small"
            sx={{ mb: 2 }}
          />
          <TextField
            margin="dense"
            label="Remind At"
            type="datetime-local"
            fullWidth
            variant="outlined"
            value={reminderDate}
            onChange={(e) => setReminderDate(e.target.value)}
            size="small"
            InputLabelProps={{ shrink: true }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReminderDialogOpen(false)} disabled={reminderLoading}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleCreateReminder}
            disabled={reminderLoading || !reminderTitle.trim() || !reminderDate}
            startIcon={reminderLoading ? <CircularProgress size={16} /> : <AddIcon />}
          >
            Create Reminder
          </Button>
        </DialogActions>
      </Dialog>

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

      {/* Due Date Picker Dialog (v1.2) */}
      <Dialog
        open={dueDateDialogOpen}
        onClose={() => { setDueDateDialogOpen(false); setDueDateTarget(null); }}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <CalendarIcon color="primary" /> Set Due Date
        </DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            {dueDateTarget && (
              <>Choose a new due date for <strong>{dueDateTarget.notification.title}</strong>.</>
            )}
          </DialogContentText>
          <TextField
            autoFocus
            type="date"
            fullWidth
            variant="outlined"
            value={dueDateValue}
            onChange={(e) => setDueDateValue(e.target.value)}
            size="small"
            InputLabelProps={{ shrink: true }}
            label="Due Date"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setDueDateDialogOpen(false); setDueDateTarget(null); }} disabled={actionLoading}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleDueDateSubmit}
            disabled={actionLoading || !dueDateValue}
            startIcon={actionLoading ? <CircularProgress size={16} /> : <CalendarIcon />}
          >
            Set Date
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default NotificationBell;
