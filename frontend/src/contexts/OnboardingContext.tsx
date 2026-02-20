import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
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
import { STORAGE_TENANT_ID_KEY } from '../services/api';
import { safeArray, safeIncludes, safeSome, safeFilter } from '../utils/safeHelpers';

/**
 * Rate limit state for 429 handling
 */
interface RateLimitState {
  isRateLimited: boolean;
  retryAfterMs: number;
  nextRetryAt: number | null;
  retryCount: number;
}

/**
 * Error state with detailed information
 */
export interface OnboardingError {
  message: string;
  code: 'RATE_LIMITED' | 'NETWORK_ERROR' | 'AUTH_ERROR' | 'UNKNOWN_ERROR';
  retryAfterMs?: number;
  canRetry: boolean;
}

export interface OnboardingContextValue {
  context: OnboardingContextType;
  policy: PolicyResult;
  loading: boolean;
  error: OnboardingError | null;
  refreshContext: (force?: boolean) => Promise<void>;
  isFeatureDisabled: (feature: string) => boolean;
  hasWarning: (code: PolicyCode) => boolean;
  getWarningsForTarget: (target: string) => PolicyResult['warnings'];
  isSuiteEnabled: (suiteType: SuiteType) => boolean;
  isFrameworkActive: (frameworkType: FrameworkType) => boolean;
  getAuditScopeStandards: () => string[];
  isRateLimited: boolean;
  retryCount: number;
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
      isRateLimited: false,
      retryCount: 0,
    };
  }
  return context;
};

// Module-level singleton for request deduplication
// This persists across component remounts but not page refreshes
let inFlightRequest: Promise<OnboardingContextWithPolicy> | null = null;
let inFlightTenantId: string | null = null;

// Rate limit cooldown storage key
const RATE_LIMIT_STORAGE_KEY = 'onboarding_rate_limit_until';

// Default backoff configuration
const DEFAULT_RETRY_AFTER_MS = 5000; // 5 seconds
const MAX_RETRY_AFTER_MS = 60000; // 1 minute max
const MAX_RETRY_COUNT = 3;

/**
 * Parse Retry-After header value
 * Supports both seconds (integer) and HTTP-date formats
 */
function parseRetryAfter(retryAfterHeader: string | null): number {
  if (!retryAfterHeader) {
    return DEFAULT_RETRY_AFTER_MS;
  }

  // Try parsing as integer (seconds)
  const seconds = parseInt(retryAfterHeader, 10);
  if (!isNaN(seconds) && seconds > 0) {
    return Math.min(seconds * 1000, MAX_RETRY_AFTER_MS);
  }

  // Try parsing as HTTP-date
  const date = new Date(retryAfterHeader);
  if (!isNaN(date.getTime())) {
    const delayMs = date.getTime() - Date.now();
    return Math.min(Math.max(delayMs, DEFAULT_RETRY_AFTER_MS), MAX_RETRY_AFTER_MS);
  }

  return DEFAULT_RETRY_AFTER_MS;
}

/**
 * Check if we're currently in a rate limit cooldown period
 */
function isInRateLimitCooldown(): boolean {
  try {
    const storedUntil = sessionStorage.getItem(RATE_LIMIT_STORAGE_KEY);
    if (!storedUntil) return false;
    
    const until = parseInt(storedUntil, 10);
    if (isNaN(until)) return false;
    
    return Date.now() < until;
  } catch {
    return false;
  }
}

/**
 * Set rate limit cooldown
 */
function setRateLimitCooldown(durationMs: number): void {
  try {
    const until = Date.now() + durationMs;
    sessionStorage.setItem(RATE_LIMIT_STORAGE_KEY, until.toString());
  } catch {
    // Ignore storage errors
  }
}

/**
 * Clear rate limit cooldown
 */
function clearRateLimitCooldown(): void {
  try {
    sessionStorage.removeItem(RATE_LIMIT_STORAGE_KEY);
  } catch {
    // Ignore storage errors
  }
}

/**
 * Normalize onboarding context to ensure all array fields are arrays
 */
function normalizeOnboardingContext(data: unknown): OnboardingContextType {
  if (!data || typeof data !== 'object') {
    console.warn('[OnboardingContext] Received invalid context data, using defaults');
    return DEFAULT_ONBOARDING_CONTEXT;
  }

  const ctx = data as Partial<OnboardingContextType>;
  
  return {
    status: ctx.status || 'active',
    schemaVersion: ctx.schemaVersion || 1,
    policySetVersion: ctx.policySetVersion || null,
    activeSuites: safeArray(ctx.activeSuites),
    enabledModules: ctx.enabledModules || {
      [SuiteType.GRC_SUITE]: [],
      [SuiteType.ITSM_SUITE]: [],
    },
    activeFrameworks: safeArray(ctx.activeFrameworks),
    maturity: ctx.maturity || DEFAULT_ONBOARDING_CONTEXT.maturity,
    metadata: ctx.metadata || { initializedAt: null, lastUpdatedAt: null },
  };
}

/**
 * Normalize policy result to ensure all array fields are arrays
 */
function normalizePolicyResult(data: unknown): PolicyResult {
  if (!data || typeof data !== 'object') {
    console.warn('[OnboardingContext] Received invalid policy data, using defaults');
    return DEFAULT_POLICY_RESULT;
  }

  const policy = data as Partial<PolicyResult>;
  
  return {
    disabledFeatures: safeArray(policy.disabledFeatures),
    warnings: safeArray(policy.warnings),
    metadata: policy.metadata || {},
  };
}

interface OnboardingProviderProps {
  children: ReactNode;
}

export const OnboardingProvider: React.FC<OnboardingProviderProps> = ({ children }) => {
  const { user, token } = useAuth();
  const [context, setContext] = useState<OnboardingContextType>(DEFAULT_ONBOARDING_CONTEXT);
  const [policy, setPolicy] = useState<PolicyResult>(DEFAULT_POLICY_RESULT);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<OnboardingError | null>(null);
  const [rateLimitState, setRateLimitState] = useState<RateLimitState>({
    isRateLimited: isInRateLimitCooldown(),
    retryAfterMs: 0,
    nextRetryAt: null,
    retryCount: 0,
  });

  // Track if component is mounted to prevent state updates after unmount
  const isMountedRef = useRef(true);
  
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const fetchOnboardingContext = useCallback(async (force: boolean = false) => {
    // Get tenantId from user object or localStorage fallback
    const tenantId = user?.tenantId || localStorage.getItem(STORAGE_TENANT_ID_KEY);
    
    if (!tenantId || !token) {
      console.log('[OnboardingContext] Skipping fetch: missing tenantId or token');
      return;
    }

    // Check rate limit cooldown (unless force refresh)
    if (!force && isInRateLimitCooldown()) {
      console.log('[OnboardingContext] Skipping fetch: in rate limit cooldown');
      return;
    }

    // Request deduplication: if there's already an in-flight request for this tenant, reuse it
    if (inFlightRequest && inFlightTenantId === tenantId) {
      console.log('[OnboardingContext] Reusing in-flight request for tenant:', tenantId);
      try {
        const data = await inFlightRequest;
        if (isMountedRef.current) {
          setContext(normalizeOnboardingContext(data.context));
          setPolicy(normalizePolicyResult(data.policy));
          setError(null);
          clearRateLimitCooldown();
        }
      } catch {
        // Error already handled by the original request
      }
      return;
    }

    console.log('[OnboardingContext] Fetching context for tenant:', tenantId, 'attempt:', rateLimitState.retryCount + 1);
    
    if (isMountedRef.current) {
      setLoading(true);
      setError(null);
    }

    // Create the request promise and store it for deduplication
    const requestPromise = (async (): Promise<OnboardingContextWithPolicy> => {
      const response = await onboardingApi.getContext(tenantId);
      return unwrapResponse<OnboardingContextWithPolicy>(response);
    })();

    inFlightRequest = requestPromise;
    inFlightTenantId = tenantId;

    try {
      const data = await requestPromise;
      
      console.log('[OnboardingContext] Successfully fetched context');
      
      if (isMountedRef.current) {
        // Normalize data to ensure arrays are always arrays
        setContext(normalizeOnboardingContext(data.context));
        setPolicy(normalizePolicyResult(data.policy));
        setError(null);
        setRateLimitState({
          isRateLimited: false,
          retryAfterMs: 0,
          nextRetryAt: null,
          retryCount: 0,
        });
        clearRateLimitCooldown();
      }
    } catch (err: unknown) {
      console.error('[OnboardingContext] Failed to fetch context:', err);
      
      // Determine error type and handle accordingly
      const axiosError = err as { response?: { status?: number; headers?: Record<string, string> }; message?: string };
      const status = axiosError.response?.status;
      
      let errorInfo: OnboardingError;
      
      if (status === 429) {
        // Rate limited - extract Retry-After header
        const retryAfterHeader = axiosError.response?.headers?.['retry-after'] || null;
        const retryAfterMs = parseRetryAfter(retryAfterHeader);
        
        console.warn('[OnboardingContext] Rate limited (429). Retry after:', retryAfterMs, 'ms');
        
        // Set cooldown in sessionStorage to persist across fast refreshes
        setRateLimitCooldown(retryAfterMs);
        
        const newRetryCount = rateLimitState.retryCount + 1;
        
        errorInfo = {
          message: `Rate limited. Please wait ${Math.ceil(retryAfterMs / 1000)} seconds before retrying.`,
          code: 'RATE_LIMITED',
          retryAfterMs,
          canRetry: newRetryCount < MAX_RETRY_COUNT,
        };
        
        if (isMountedRef.current) {
          setRateLimitState({
            isRateLimited: true,
            retryAfterMs,
            nextRetryAt: Date.now() + retryAfterMs,
            retryCount: newRetryCount,
          });
        }
      } else if (status === 401 || status === 403) {
        console.error('[OnboardingContext] Auth error:', status);
        errorInfo = {
          message: 'Authentication error. Please log in again.',
          code: 'AUTH_ERROR',
          canRetry: false,
        };
      } else if (!status) {
        console.error('[OnboardingContext] Network error');
        errorInfo = {
          message: 'Network error. Please check your connection.',
          code: 'NETWORK_ERROR',
          canRetry: true,
        };
      } else {
        console.error('[OnboardingContext] Unknown error:', status);
        errorInfo = {
          message: axiosError.message || 'Failed to load onboarding context',
          code: 'UNKNOWN_ERROR',
          canRetry: true,
        };
      }
      
      if (isMountedRef.current) {
        setError(errorInfo);
        // Keep existing context/policy on error (don't reset to defaults if we have data)
      }
    } finally {
      // Clear in-flight request
      if (inFlightTenantId === tenantId) {
        inFlightRequest = null;
        inFlightTenantId = null;
      }
      
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [user?.tenantId, token, rateLimitState.retryCount]);

  useEffect(() => {
    // Check both user.tenantId and localStorage to ensure we have tenantId
    const tenantId = user?.tenantId || localStorage.getItem(STORAGE_TENANT_ID_KEY);
    if (tenantId && token) {
      fetchOnboardingContext();
    }
  }, [user?.tenantId, token, fetchOnboardingContext]);

  // Use safe helpers for all array operations
  const isFeatureDisabled = useCallback(
    (feature: string): boolean => {
      return safeIncludes(policy.disabledFeatures, feature);
    },
    [policy.disabledFeatures],
  );

  const hasWarning = useCallback(
    (code: PolicyCode): boolean => {
      return safeSome(policy.warnings, (w) => w.code === code);
    },
    [policy.warnings],
  );

  const getWarningsForTarget = useCallback(
    (target: string): PolicyResult['warnings'] => {
      return safeFilter(policy.warnings, (w) => safeIncludes(w.targets, target));
    },
    [policy.warnings],
  );

  const isSuiteEnabled = useCallback(
    (suiteType: SuiteType): boolean => {
      return safeIncludes(context.activeSuites, suiteType);
    },
    [context.activeSuites],
  );

  const isFrameworkActive = useCallback(
    (frameworkType: FrameworkType): boolean => {
      return safeIncludes(context.activeFrameworks, frameworkType);
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
    isRateLimited: rateLimitState.isRateLimited,
    retryCount: rateLimitState.retryCount,
  };

  return (
    <OnboardingContextReact.Provider value={value}>
      {children}
    </OnboardingContextReact.Provider>
  );
};
