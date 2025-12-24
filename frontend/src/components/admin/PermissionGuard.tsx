import React from 'react';
import { Box, Typography, Paper } from '@mui/material';
import { usePermission, Permission } from '../../hooks/usePermission';

interface PermissionGuardProps {
  children: React.ReactNode;
  permission?: Permission;
  permissions?: Permission[];
  requireAll?: boolean;
  fallback?: React.ReactNode;
  showAccessDenied?: boolean;
}

export const PermissionGuard: React.FC<PermissionGuardProps> = ({
  children,
  permission,
  permissions = [],
  requireAll = true,
  fallback,
  showAccessDenied = true,
}) => {
  const { hasAllPermissions, hasAnyPermission } = usePermission();

  const allPermissions = permission ? [permission, ...permissions] : permissions;

  if (allPermissions.length === 0) {
    return <>{children}</>;
  }

  const hasAccess = requireAll
    ? hasAllPermissions(allPermissions)
    : hasAnyPermission(allPermissions);

  if (hasAccess) {
    return <>{children}</>;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  if (showAccessDenied) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: 200,
        }}
      >
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="h6" color="error" gutterBottom>
            Access Denied
          </Typography>
          <Typography color="text.secondary">
            You do not have permission to view this content.
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
            Required: {allPermissions.join(', ')}
          </Typography>
        </Paper>
      </Box>
    );
  }

  return null;
};

interface WithPermissionProps {
  permission?: Permission;
  permissions?: Permission[];
  requireAll?: boolean;
}

export function withPermission<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  { permission, permissions = [], requireAll = true }: WithPermissionProps
): React.FC<P> {
  const WithPermissionComponent: React.FC<P> = (props) => {
    return (
      <PermissionGuard
        permission={permission}
        permissions={permissions}
        requireAll={requireAll}
      >
        <WrappedComponent {...props} />
      </PermissionGuard>
    );
  };

  WithPermissionComponent.displayName = `WithPermission(${
    WrappedComponent.displayName || WrappedComponent.name || 'Component'
  })`;

  return WithPermissionComponent;
}

export default PermissionGuard;
