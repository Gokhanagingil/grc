import React from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';

interface LoadingStateProps {
  message?: string;
  minHeight?: string | number;
  size?: number;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  message = 'Loading...',
  minHeight = '400px',
  size = 40,
}) => {
  return (
    <Box
      display="flex"
      flexDirection="column"
      justifyContent="center"
      alignItems="center"
      minHeight={minHeight}
      gap={2}
    >
      <CircularProgress size={size} />
      {message && (
        <Typography variant="body2" color="textSecondary">
          {message}
        </Typography>
      )}
    </Box>
  );
};

export default LoadingState;
