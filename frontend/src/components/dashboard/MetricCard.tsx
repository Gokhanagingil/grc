import React from 'react';
import { Card, CardContent, Box, Typography, SxProps, Theme } from '@mui/material';

interface MetricCardProps {
  title: string;
  value: number | string;
  subtitle?: string;
  icon?: React.ReactNode;
  color?: string;
  trend?: {
    value: number;
    direction: 'up' | 'down' | 'neutral';
  };
  onClick?: () => void;
  sx?: SxProps<Theme>;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  color = '#1976d2',
  trend,
  onClick,
  sx,
}) => {
  const getTrendColor = () => {
    if (!trend) return 'inherit';
    if (trend.direction === 'up') return '#4caf50';
    if (trend.direction === 'down') return '#f44336';
    return '#9e9e9e';
  };

  const getTrendIcon = () => {
    if (!trend) return null;
    if (trend.direction === 'up') return '\u2191';
    if (trend.direction === 'down') return '\u2193';
    return '\u2192';
  };

  return (
    <Card
      sx={{
        cursor: onClick ? 'pointer' : 'default',
        transition: 'transform 0.2s, box-shadow 0.2s',
        '&:hover': onClick ? {
          transform: 'translateY(-2px)',
          boxShadow: 4,
        } : {},
        ...sx,
      }}
      onClick={onClick}
    >
      <CardContent>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Box>
            <Typography color="textSecondary" variant="body2" gutterBottom>
              {title}
            </Typography>
            <Typography variant="h4" component="div" fontWeight="bold">
              {value}
            </Typography>
            {subtitle && (
              <Typography color="textSecondary" variant="body2">
                {subtitle}
              </Typography>
            )}
            {trend && (
              <Typography
                variant="body2"
                sx={{ color: getTrendColor(), mt: 0.5 }}
              >
                {getTrendIcon()} {Math.abs(trend.value)}%
              </Typography>
            )}
          </Box>
          {icon && (
            <Box
              sx={{
                backgroundColor: color,
                borderRadius: '50%',
                p: 1.5,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
              }}
            >
              {icon}
            </Box>
          )}
        </Box>
      </CardContent>
    </Card>
  );
};
