import React from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardActions,
  Typography,
  Box,
  Skeleton,
  IconButton,
  Tooltip,
} from '@mui/material';
import { Refresh as RefreshIcon } from '@mui/icons-material';

interface AdminCardProps {
  title: string;
  subtitle?: string;
  value?: string | number;
  icon?: React.ReactNode;
  loading?: boolean;
  error?: string | null;
  actions?: React.ReactNode;
  onRefresh?: () => void;
  children?: React.ReactNode;
  sx?: object;
}

export const AdminCard: React.FC<AdminCardProps> = ({
  title,
  subtitle,
  value,
  icon,
  loading = false,
  error = null,
  actions,
  onRefresh,
  children,
  sx = {},
}) => {
  return (
    <Card sx={{ height: '100%', ...sx }}>
      <CardHeader
        title={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {icon && (
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  color: 'primary.main',
                }}
              >
                {icon}
              </Box>
            )}
            <Typography variant="h6" component="div">
              {title}
            </Typography>
          </Box>
        }
        subheader={subtitle}
        action={
          onRefresh && (
            <Tooltip title="Refresh">
              <IconButton onClick={onRefresh} disabled={loading}>
                <RefreshIcon />
              </IconButton>
            </Tooltip>
          )
        }
      />
      <CardContent>
        {loading ? (
          <Box>
            <Skeleton variant="text" width="60%" height={40} />
            <Skeleton variant="text" width="40%" />
          </Box>
        ) : error ? (
          <Typography color="error" variant="body2">
            {error}
          </Typography>
        ) : (
          <>
            {value !== undefined && (
              <Typography variant="h4" component="div" sx={{ mb: 1 }}>
                {value}
              </Typography>
            )}
            {children}
          </>
        )}
      </CardContent>
      {actions && <CardActions>{actions}</CardActions>}
    </Card>
  );
};

export default AdminCard;
