import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import {
  onboardingApi,
  unwrapResponse,
  OnboardingContext as OnboardingContextType,
  OnboardingContextWithPolicy,
  PolicyResult,
  PolicyCode,
  SuiteType,
  FrameworkType,
  DEFAULT_ONBOARDING_CONTEXT,
  DEFAULT_POLICY_RESULT,
} from '../services/grcClient';
import { useAuth } from './AuthContext';

export interface OnboardingContextValue {
  context: OnboardingContextType;
  policy: PolicyResult;
  loading: boolean;
  error: string | null;
  refreshContext: () => Promise<void>;
  isFeatureDisabled: (feature: string) => boolean;
  hasWarning: (code: PolicyCode) => boolean;
  getWarningsForTarget: (target: string) => PolicyResult['warnings'];
  isSuiteEnabled: (suiteType: SuiteType) => boolean;
  isFrameworkActive: (frameworkType: FrameworkType) => boolean;
  getAuditScopeStandards: () => string[];
}

const OnboardingContextReact = createContext<OnboardingContextValue | undefined>(undefined);

export const useOnboarding = () => {
  const context = useContext(OnboardingContextReact);
  if (context === undefined) {
    throw new Error('useOnboarding must be used within an OnboardingProvider');
  }
  return context;
};

export const useOnboardingSafe = (): OnboardingContextValue => {
  const context = useContext(OnboardingContextReact);
  if (context === undefined) {
    return {
      context: DEFAULT_ONBOARDING_CONTEXT,
      policy: DEFAULT_POLICY_RESULT,
      loading: false,
      error: null,
      refreshContext: async () => {},
      isFeatureDisabled: () => false,
      hasWarning: () => false,
      getWarningsForTarget: () => [],
      isSuiteEnabled: () => false,
      isFrameworkActive: () => false,
      getAuditScopeStandards: () => [],
    };
  }
  return context;
};

interface OnboardingProviderProps {
  children: ReactNode;
}

export const OnboardingProvider: React.FC<OnboardingProviderProps> = ({ children }) => {
  const { user, token } = useAuth();
  const [context, setContext] = useState<OnboardingContextType>(DEFAULT_ONBOARDING_CONTEXT);
  const [policy, setPolicy] = useState<PolicyResult>(DEFAULT_POLICY_RESULT);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchOnboardingContext = useCallback(async () => {
    if (!user?.tenantId || !token) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await onboardingApi.getContext(user.tenantId);
      const data = unwrapResponse<OnboardingContextWithPolicy>(response);
      setContext(data.context);
      setPolicy(data.policy);
    } catch (err) {
      console.error('Failed to fetch onboarding context:', err);
      setError('Failed to load onboarding context');
      setContext(DEFAULT_ONBOARDING_CONTEXT);
      setPolicy(DEFAULT_POLICY_RESULT);
    } finally {
      setLoading(false);
    }
  }, [user?.tenantId, token]);

  useEffect(() => {
    if (user?.tenantId && token) {
      fetchOnboardingContext();
    }
  }, [user?.tenantId, token, fetchOnboardingContext]);

  const isFeatureDisabled = useCallback(
    (feature: string): boolean => {
      return policy.disabledFeatures.includes(feature);
    },
    [policy.disabledFeatures],
  );

  const hasWarning = useCallback(
    (code: PolicyCode): boolean => {
      return policy.warnings.some((w) => w.code === code);
    },
    [policy.warnings],
  );

  const getWarningsForTarget = useCallback(
    (target: string): PolicyResult['warnings'] => {
      return policy.warnings.filter((w) => w.targets.includes(target));
    },
    [policy.warnings],
  );

  const isSuiteEnabled = useCallback(
    (suiteType: SuiteType): boolean => {
      return context.activeSuites.includes(suiteType);
    },
    [context.activeSuites],
  );

  const isFrameworkActive = useCallback(
    (frameworkType: FrameworkType): boolean => {
      return context.activeFrameworks.includes(frameworkType);
    },
    [context.activeFrameworks],
  );

  const getAuditScopeStandards = useCallback((): string[] => {
    const standards = policy.metadata['audit_scope_standards'];
    if (Array.isArray(standards)) {
      return standards as string[];
    }
    return [];
  }, [policy.metadata]);

  const value: OnboardingContextValue = {
    context,
    policy,
    loading,
    error,
    refreshContext: fetchOnboardingContext,
    isFeatureDisabled,
    hasWarning,
    getWarningsForTarget,
    isSuiteEnabled,
    isFrameworkActive,
    getAuditScopeStandards,
  };

  return (
    <OnboardingContextReact.Provider value={value}>
      {children}
    </OnboardingContextReact.Provider>
  );
};
