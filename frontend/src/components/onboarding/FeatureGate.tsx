import React, { ReactNode } from 'react';
import { Tooltip, Box } from '@mui/material';
import { useOnboardingSafe } from '../../contexts/OnboardingContext';
import { SuiteType } from '../../services/grcClient';

interface FeatureGateProps {
  feature: string;
  children: ReactNode;
  fallback?: ReactNode;
  disabledTooltip?: string;
  hideWhenDisabled?: boolean;
}

export const FeatureGate: React.FC<FeatureGateProps> = ({
  feature,
  children,
  fallback,
  disabledTooltip = 'This feature is not available for your current configuration',
  hideWhenDisabled = false,
}) => {
  const { isFeatureDisabled } = useOnboardingSafe();
  const disabled = isFeatureDisabled(feature);

  if (disabled) {
    if (hideWhenDisabled) {
      return null;
    }

    if (fallback) {
      return <>{fallback}</>;
    }

    return (
      <Tooltip title={disabledTooltip} arrow>
        <Box
          sx={{
            opacity: 0.5,
            pointerEvents: 'none',
            cursor: 'not-allowed',
          }}
        >
          {children}
        </Box>
      </Tooltip>
    );
  }

  return <>{children}</>;
};

interface SuiteGateProps {
  suite: SuiteType;
  children: ReactNode;
  fallback?: ReactNode;
  hideWhenDisabled?: boolean;
}

export const SuiteGate: React.FC<SuiteGateProps> = ({
  suite,
  children,
  fallback,
  hideWhenDisabled = false,
}) => {
  const { isSuiteEnabled } = useOnboardingSafe();
  const enabled = isSuiteEnabled(suite);

  if (!enabled) {
    if (hideWhenDisabled) {
      return null;
    }

    if (fallback) {
      return <>{fallback}</>;
    }

    return null;
  }

  return <>{children}</>;
};

export default FeatureGate;
