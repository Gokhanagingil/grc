import React from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Avatar,
  Chip,
  Divider,
} from '@mui/material';
import {
  Person as PersonIcon,
  Email as EmailIcon,
  Business as DepartmentIcon,
  Badge as RoleIcon,
  Domain as TenantIcon,
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';

export const Profile: React.FC = () => {
  const { user } = useAuth();

  const getRoleColor = (role: string): 'error' | 'warning' | 'default' => {
    switch (role) {
      case 'admin':
        return 'error';
      case 'manager':
        return 'warning';
      default:
        return 'default';
    }
  };

  if (!user) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <Typography color="textSecondary">Loading user information...</Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Profile Settings
      </Typography>

      <Card sx={{ maxWidth: 600, mt: 3 }}>
        <CardContent>
          <Box display="flex" alignItems="center" mb={3}>
            <Avatar
              sx={{
                width: 80,
                height: 80,
                fontSize: '2rem',
                bgcolor: 'primary.main',
                mr: 3,
              }}
            >
              {user.firstName?.[0]}{user.lastName?.[0]}
            </Avatar>
            <Box>
              <Typography variant="h5">
                {user.firstName} {user.lastName}
              </Typography>
              <Chip
                label={user.role?.toUpperCase()}
                color={getRoleColor(user.role)}
                size="small"
                sx={{ mt: 1, fontWeight: 'bold' }}
              />
            </Box>
          </Box>

          <Divider sx={{ my: 2 }} />

          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Box display="flex" alignItems="center" gap={2}>
                <PersonIcon color="action" />
                <Box>
                  <Typography variant="caption" color="textSecondary">
                    Username
                  </Typography>
                  <Typography variant="body1">
                    {user.username || '-'}
                  </Typography>
                </Box>
              </Box>
            </Grid>

            <Grid item xs={12}>
              <Box display="flex" alignItems="center" gap={2}>
                <EmailIcon color="action" />
                <Box>
                  <Typography variant="caption" color="textSecondary">
                    Email
                  </Typography>
                  <Typography variant="body1">
                    {user.email || '-'}
                  </Typography>
                </Box>
              </Box>
            </Grid>

            <Grid item xs={12}>
              <Box display="flex" alignItems="center" gap={2}>
                <RoleIcon color="action" />
                <Box>
                  <Typography variant="caption" color="textSecondary">
                    Role
                  </Typography>
                  <Typography variant="body1">
                    {user.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : '-'}
                  </Typography>
                </Box>
              </Box>
            </Grid>

            <Grid item xs={12}>
              <Box display="flex" alignItems="center" gap={2}>
                <DepartmentIcon color="action" />
                <Box>
                  <Typography variant="caption" color="textSecondary">
                    Department
                  </Typography>
                  <Typography variant="body1">
                    {user.department || '-'}
                  </Typography>
                </Box>
              </Box>
            </Grid>

            <Grid item xs={12}>
              <Box display="flex" alignItems="center" gap={2}>
                <TenantIcon color="action" />
                <Box>
                  <Typography variant="caption" color="textSecondary">
                    Tenant ID
                  </Typography>
                  <Typography variant="body1" sx={{ fontFamily: 'monospace', fontSize: '0.875rem' }}>
                    {user.tenantId || '-'}
                  </Typography>
                </Box>
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>
    </Box>
  );
};
