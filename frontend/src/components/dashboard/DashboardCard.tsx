import React from 'react';
import { Card, CardContent, CardHeader, Box, Typography } from '@mui/material';

interface DashboardCardProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  minHeight?: number | string;
}

export const DashboardCard: React.FC<DashboardCardProps> = ({
  title,
  subtitle,
  children,
  action,
  minHeight = 300,
}) => {
  return (
    <Card sx={{ height: '100%', minHeight }}>
      <CardHeader
        title={
          <Typography variant="h6" component="h2">
            {title}
          </Typography>
        }
        subheader={subtitle}
        action={action}
        sx={{ pb: 0 }}
      />
      <CardContent sx={{ pt: 1, height: 'calc(100% - 64px)' }}>
        <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          {children}
        </Box>
      </CardContent>
    </Card>
  );
};
