import React from 'react';
import { Alert, AlertTitle, Box } from '@mui/material';
import { useOnboardingSafe } from '../../contexts/OnboardingContext';
import { PolicyCode, WarningSeverity } from '../../services/grcClient';

interface FrameworkWarningBannerProps {
  target?: string;
  showAllWarnings?: boolean;
}

export const FrameworkWarningBanner: React.FC<FrameworkWarningBannerProps> = ({
  target,
  showAllWarnings = false,
}) => {
  const { policy, getWarningsForTarget } = useOnboardingSafe();

  const warnings = target
    ? getWarningsForTarget(target)
    : showAllWarnings
      ? policy.warnings
      : policy.warnings.filter((w) => w.code === PolicyCode.FRAMEWORK_REQUIRED);

  if (warnings.length === 0) {
    return null;
  }

  const getSeverityColor = (severity: WarningSeverity): 'info' | 'warning' | 'error' => {
    switch (severity) {
      case WarningSeverity.ERROR:
        return 'error';
      case WarningSeverity.WARNING:
        return 'warning';
      case WarningSeverity.INFO:
      default:
        return 'info';
    }
  };

  return (
    <Box sx={{ mb: 2 }}>
      {warnings.map((warning, index) => (
        <Alert
          key={`${warning.code}-${index}`}
          severity={getSeverityColor(warning.severity)}
          sx={{ mb: index < warnings.length - 1 ? 1 : 0 }}
        >
          <AlertTitle>{warning.code.replace(/_/g, ' ')}</AlertTitle>
          {warning.message}
        </Alert>
      ))}
    </Box>
  );
};

export const GrcFrameworkWarningBanner: React.FC = () => {
  const { hasWarning } = useOnboardingSafe();

  if (!hasWarning(PolicyCode.FRAMEWORK_REQUIRED)) {
    return null;
  }

  return (
    <Alert severity="warning" sx={{ mb: 2 }}>
      <AlertTitle>Framework Configuration Required</AlertTitle>
      No compliance frameworks are currently active. Please configure at least one framework
      (e.g., ISO 27001, SOC 2) to enable full GRC functionality including audit scope standards.
    </Alert>
  );
};

export default FrameworkWarningBanner;
