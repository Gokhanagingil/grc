import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { Snackbar, Alert, AlertColor } from '@mui/material';

interface Notification {
  id: number;
  message: string;
  severity: AlertColor;
}

interface NotificationContextType {
  showNotification: (message: string, severity?: AlertColor) => void;
  showError: (message: string) => void;
  showSuccess: (message: string) => void;
  showWarning: (message: string) => void;
  showInfo: (message: string) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

let notificationId = 0;

export const NotificationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const showNotification = useCallback((message: string, severity: AlertColor = 'info') => {
    const id = ++notificationId;
    setNotifications((prev) => [...prev, { id, message, severity }]);
  }, []);

  const showError = useCallback((message: string) => showNotification(message, 'error'), [showNotification]);
  const showSuccess = useCallback((message: string) => showNotification(message, 'success'), [showNotification]);
  const showWarning = useCallback((message: string) => showNotification(message, 'warning'), [showNotification]);
  const showInfo = useCallback((message: string) => showNotification(message, 'info'), [showNotification]);

  const handleClose = useCallback((id: number) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  return (
    <NotificationContext.Provider value={{ showNotification, showError, showSuccess, showWarning, showInfo }}>
      {children}
      {notifications.map((notification, index) => (
        <Snackbar
          key={notification.id}
          open={true}
          autoHideDuration={6000}
          onClose={() => handleClose(notification.id)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          sx={{ bottom: { xs: 90 + index * 60, sm: 24 + index * 60 } }}
        >
          <Alert
            onClose={() => handleClose(notification.id)}
            severity={notification.severity}
            variant="filled"
            sx={{ width: '100%' }}
          >
            {notification.message}
          </Alert>
        </Snackbar>
      ))}
    </NotificationContext.Provider>
  );
};

export const useNotification = (): NotificationContextType => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
};
