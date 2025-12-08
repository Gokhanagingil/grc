import React from 'react';
import { Box, TableContainer, Paper } from '@mui/material';

interface ResponsiveTableProps {
  children: React.ReactNode;
  minWidth?: number | string;
  maxHeight?: number | string;
}

export const ResponsiveTable: React.FC<ResponsiveTableProps> = ({
  children,
  minWidth = 650,
  maxHeight,
}) => {
  return (
    <Box sx={{ width: '100%', overflowX: 'auto' }}>
      <TableContainer
        component={Paper}
        sx={{
          maxHeight: maxHeight,
          '& table': {
            minWidth: minWidth,
          },
        }}
      >
        {children}
      </TableContainer>
    </Box>
  );
};
