/**
 * ModuleGuard Component
 * 
 * Provides module visibility protection for routes and components.
 * Renders children only if the specified module is enabled.
 * Supports coming-soon pages and actionable gating messages.
 */

import React from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Box, Typography, Paper, Button, Alert, AlertTitle } from '@mui/material';
import { 
  Block as BlockIcon,
  Settings as SettingsIcon,
  ArrowBack as ArrowBackIcon,
} from '@mui/icons-material';
import { useModules } from '../hooks/useModules';
import { useOnboarding } from '../contexts/OnboardingContext';
import { FrameworkType } from '../services/grcClient';

export interface ModuleGuardProps {
  moduleKey: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  redirectTo?: string;
  showActionableMessage?: boolean;
}

export const ModuleGuard: React.FC<ModuleGuardProps> = ({
  moduleKey,
  children,
  fallback,
  redirectTo,
  showActionableMessage = true,
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

    return <ModuleDisabledMessage moduleKey={moduleKey} showActionableMessage={showActionableMessage} />;
  }

  return <>{children}</>;
};

interface ModuleDisabledMessageProps {
  moduleKey: string;
  showActionableMessage?: boolean;
}

interface ActionableMessage {
  title: string;
  description: string;
  actionLabel?: string;
  actionPath?: string;
}

const ModuleDisabledMessage: React.FC<ModuleDisabledMessageProps> = ({ 
  moduleKey,
  showActionableMessage = true,
}) => {
  const navigate = useNavigate();
  const { getWarningsForTarget, isFrameworkActive } = useOnboarding();
  
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

  const handleReturnToDashboard = () => {
    navigate('/dashboard');
  };

  const getActionableMessages = (): ActionableMessage[] => {
    const messages: ActionableMessage[] = [];
    
    if (!showActionableMessage) {
      return messages;
    }
    
    const warnings = getWarningsForTarget(moduleKey);
    
    if (moduleKey === 'audit') {
      const hasActiveFramework = isFrameworkActive(FrameworkType.ISO27001) || 
                                  isFrameworkActive(FrameworkType.SOC2) || 
                                  isFrameworkActive(FrameworkType.NIST) ||
                                  isFrameworkActive(FrameworkType.GDPR);
      
      if (!hasActiveFramework) {
        messages.push({
          title: 'Framework Required',
          description: 'Enable at least one compliance framework to use the Audit module.',
          actionLabel: 'Go to Frameworks',
          actionPath: '/admin/settings',
        });
      }
      
      if (warnings.some(w => w.code === 'FRAMEWORK_REQUIRED')) {
        messages.push({
          title: 'Framework Configuration Needed',
          description: 'Configure your compliance frameworks to enable audit functionality.',
          actionLabel: 'Configure Frameworks',
          actionPath: '/admin/settings',
        });
      }
      
    }
    
    if (moduleKey === 'policy' && warnings.some(w => w.code === 'FRAMEWORK_REQUIRED')) {
      messages.push({
        title: 'Framework Required',
        description: 'Enable at least one compliance framework to create policies.',
        actionLabel: 'Go to Frameworks',
        actionPath: '/admin/settings',
      });
    }
    
    if (moduleKey === 'compliance' && warnings.some(w => w.code === 'FRAMEWORK_REQUIRED')) {
      messages.push({
        title: 'Framework Required',
        description: 'Enable at least one compliance framework to manage requirements.',
        actionLabel: 'Go to Frameworks',
        actionPath: '/admin/settings',
      });
    }
    
    return messages;
  };

  const actionableMessages = getActionableMessages();

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
          maxWidth: 550,
        }}
      >
        <BlockIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
        <Typography variant="h5" gutterBottom>
          Module Not Available
        </Typography>
        <Typography variant="body1" color="text.secondary" paragraph>
          The <strong>{moduleName}</strong> module is not enabled for your organization.
        </Typography>
        
        {actionableMessages.length > 0 && (
          <Box sx={{ mb: 3, textAlign: 'left' }}>
            {actionableMessages.map((msg, index) => (
              <Alert 
                key={index} 
                severity="info" 
                sx={{ mb: 1 }}
                action={
                  msg.actionPath && msg.actionLabel ? (
                    <Button 
                      color="inherit" 
                      size="small"
                      startIcon={<SettingsIcon />}
                      onClick={() => navigate(msg.actionPath!)}
                    >
                      {msg.actionLabel}
                    </Button>
                  ) : undefined
                }
              >
                <AlertTitle>{msg.title}</AlertTitle>
                {msg.description}
              </Alert>
            ))}
          </Box>
        )}
        
        {actionableMessages.length === 0 && (
          <Typography variant="body2" color="text.secondary" paragraph>
            Please contact your administrator to enable this module or upgrade your subscription.
          </Typography>
        )}
        
        <Button 
          variant="contained" 
          startIcon={<ArrowBackIcon />}
          onClick={handleReturnToDashboard}
        >
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
