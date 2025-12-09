/**
 * ModuleGuard Component
 * 
 * Provides module visibility protection for routes and components.
 * Renders children only if the specified module is enabled.
 */

import React from 'react';
import { Navigate } from 'react-router-dom';
import { Box, Typography, Paper, Button } from '@mui/material';
import { Block as BlockIcon } from '@mui/icons-material';
import { useModules } from '../hooks/useModules';

export interface ModuleGuardProps {
  moduleKey: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  redirectTo?: string;
}

export const ModuleGuard: React.FC<ModuleGuardProps> = ({
  moduleKey,
  children,
  fallback,
  redirectTo,
}) => {
  const { isModuleEnabled, isLoading } = useModules();

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 200 }}>
        <Typography>Loading...</Typography>
      </Box>
    );
  }

  if (!isModuleEnabled(moduleKey)) {
    if (redirectTo) {
      return <Navigate to={redirectTo} replace />;
    }

    if (fallback) {
      return <>{fallback}</>;
    }

    return <ModuleDisabledMessage moduleKey={moduleKey} />;
  }

  return <>{children}</>;
};

interface ModuleDisabledMessageProps {
  moduleKey: string;
}

const ModuleDisabledMessage: React.FC<ModuleDisabledMessageProps> = ({ moduleKey }) => {
  const moduleNames: Record<string, string> = {
    risk: 'Risk Management',
    policy: 'Policy Management',
    compliance: 'Compliance Management',
    audit: 'Audit Management',
    'itsm.incident': 'Incident Management',
    'itsm.cmdb': 'CMDB',
    'itsm.change': 'Change Management',
    'itsm.problem': 'Problem Management',
    'itsm.request': 'Service Request',
    'platform.admin': 'Platform Administration',
    'platform.reporting': 'Reporting & Analytics',
    'platform.integration': 'Integrations',
  };

  const moduleName = moduleNames[moduleKey] || moduleKey;

  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '60vh',
      }}
    >
      <Paper
        elevation={3}
        sx={{
          p: 4,
          textAlign: 'center',
          maxWidth: 500,
        }}
      >
        <BlockIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
        <Typography variant="h5" gutterBottom>
          Module Not Available
        </Typography>
        <Typography variant="body1" color="text.secondary" paragraph>
          The <strong>{moduleName}</strong> module is not enabled for your organization.
        </Typography>
        <Typography variant="body2" color="text.secondary" paragraph>
          Please contact your administrator to enable this module or upgrade your subscription.
        </Typography>
        <Button variant="contained" href="/dashboard">
          Return to Dashboard
        </Button>
      </Paper>
    </Box>
  );
};

export interface RequireModulesProps {
  modules: string[];
  requireAll?: boolean;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export const RequireModules: React.FC<RequireModulesProps> = ({
  modules,
  requireAll = false,
  children,
  fallback,
}) => {
  const { isModuleEnabled, isLoading } = useModules();

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 200 }}>
        <Typography>Loading...</Typography>
      </Box>
    );
  }

  const hasAccess = requireAll
    ? modules.every((m) => isModuleEnabled(m))
    : modules.some((m) => isModuleEnabled(m));

  if (!hasAccess) {
    if (fallback) {
      return <>{fallback}</>;
    }
    return <ModuleDisabledMessage moduleKey={modules[0]} />;
  }

  return <>{children}</>;
};

export default ModuleGuard;
