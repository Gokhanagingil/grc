import React from 'react';
import { Box, Typography, Button } from '@mui/material';
import { Inbox as InboxIcon, Add as AddIcon } from '@mui/icons-material';

interface EmptyStateProps {
  message?: string;
  title?: string;
  icon?: React.ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  minHeight?: string | number;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  message = 'No items found.',
  title,
  icon,
  actionLabel,
  onAction,
  minHeight = '300px',
}) => {
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
      {icon || <InboxIcon sx={{ fontSize: 64, color: 'text.disabled' }} />}
      {title && (
        <Typography variant="h6" color="textSecondary">
          {title}
        </Typography>
      )}
      <Typography variant="body1" color="textSecondary" maxWidth={400}>
        {message}
      </Typography>
      {onAction && actionLabel && (
        <Button
          variant="contained"
          color="primary"
          onClick={onAction}
          startIcon={<AddIcon />}
        >
          {actionLabel}
        </Button>
      )}
    </Box>
  );
};

export default EmptyState;
