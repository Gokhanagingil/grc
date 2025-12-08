import React from 'react';
import { Box, Typography, Button, Alert } from '@mui/material';
import { Refresh as RefreshIcon, Error as ErrorIcon } from '@mui/icons-material';

interface ErrorStateProps {
  message?: string;
  title?: string;
  onRetry?: () => void;
  retryLabel?: string;
  minHeight?: string | number;
  variant?: 'alert' | 'centered';
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  message = 'Something went wrong. Please try again.',
  title,
  onRetry,
  retryLabel = 'Try Again',
  minHeight = '400px',
  variant = 'centered',
}) => {
  if (variant === 'alert') {
    return (
      <Alert
        severity="error"
        action={
          onRetry && (
            <Button color="inherit" size="small" onClick={onRetry} startIcon={<RefreshIcon />}>
              {retryLabel}
            </Button>
          )
        }
        sx={{ mb: 2 }}
      >
        {title && <strong>{title}: </strong>}
        {message}
      </Alert>
    );
  }

  return (
    <Box
      display="flex"
      flexDirection="column"
      justifyContent="center"
      alignItems="center"
      minHeight={minHeight}
      gap={2}
      textAlign="center"
      p={3}
    >
      <ErrorIcon color="error" sx={{ fontSize: 48 }} />
      {title && (
        <Typography variant="h6" color="error">
          {title}
        </Typography>
      )}
      <Typography variant="body1" color="textSecondary" maxWidth={400}>
        {message}
      </Typography>
      {onRetry && (
        <Button
          variant="outlined"
          color="primary"
          onClick={onRetry}
          startIcon={<RefreshIcon />}
        >
          {retryLabel}
        </Button>
      )}
    </Box>
  );
};

export default ErrorState;
