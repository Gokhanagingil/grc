import React, { useState, useEffect, useCallback } from 'react';
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
} from '@mui/material';
import {
  Notifications as BellIcon,
  MarkEmailRead as MarkReadIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { api } from '../services/api';

interface UserNotification {
  id: string;
  title: string;
  body: string;
  isRead: boolean;
  recordType?: string;
  recordId?: string;
  createdAt: string;
}

export const NotificationBell: React.FC = () => {
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
      const items = (data.items || []) as UserNotification[];
      setNotifications(items);
      setUnreadCount(items.filter((n: UserNotification) => !n.isRead).length);
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
      await api.put(`/grc/user-notifications/${id}/read`);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {
      /* ignore */
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await api.put('/grc/user-notifications/read-all');
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch {
      /* ignore */
    }
  };

  const handleOpen = () => {
    setOpen(true);
    loadNotifications();
  };

  const formatTime = (dateStr: string) => {
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
  };

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
        PaperProps={{ sx: { width: 380, maxWidth: '100%' } }}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: 1, borderColor: 'divider' }}>
            <Typography variant="h6">Notifications</Typography>
            <Box>
              {unreadCount > 0 && (
                <Button size="small" startIcon={<MarkReadIcon />} onClick={handleMarkAllRead} sx={{ mr: 1 }}>
                  Mark all read
                </Button>
              )}
              <IconButton size="small" onClick={() => setOpen(false)}>
                <CloseIcon />
              </IconButton>
            </Box>
          </Box>

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
                        onClick={() => !n.isRead && handleMarkRead(n.id)}
                        sx={{
                          bgcolor: n.isRead ? 'transparent' : 'action.hover',
                          py: 1.5,
                          px: 2,
                        }}
                      >
                        <ListItemText
                          primary={
                            <Box display="flex" justifyContent="space-between" alignItems="center">
                              <Typography variant="subtitle2" sx={{ fontWeight: n.isRead ? 'normal' : 'bold' }}>
                                {n.title}
                              </Typography>
                              <Typography variant="caption" color="text.secondary" sx={{ ml: 1, whiteSpace: 'nowrap' }}>
                                {formatTime(n.createdAt)}
                              </Typography>
                            </Box>
                          }
                          secondary={
                            <Box>
                              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                {n.body}
                              </Typography>
                              {n.recordType && (
                                <Chip size="small" label={n.recordType} variant="outlined" sx={{ mt: 0.5 }} />
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
        </Box>
      </Drawer>
    </>
  );
};

export default NotificationBell;
