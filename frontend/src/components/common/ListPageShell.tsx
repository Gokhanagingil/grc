import React, { ReactNode } from 'react';
import { Box, Typography, Alert, Button, SvgIconProps } from '@mui/material';
import { Login as LoginIcon } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { LoadingState, ErrorState, EmptyState } from './index';
import { useAuth } from '../../contexts/AuthContext';

/**
 * List data state for the auth-safe state machine
 * 
 * States:
 * - authLoading: Token not yet loaded, show loading (not empty list)
 * - unauthenticated: No token/user, show sign-in prompt
 * - loading: Authorized and fetching data, show spinner/skeleton
 * - error: Authorized but fetch failed, show error panel with status code
 * - empty: Authorized and data is empty, show real empty state
 * - success: Authorized and data loaded, render children
 */
export type ListDataState = 
  | 'authLoading'
  | 'unauthenticated'
  | 'loading'
  | 'error'
  | 'empty'
  | 'success';

export interface ListPageShellProps {
  /** Page title */
  title: string;
  /** Optional icon for the page */
  icon?: React.ReactElement<SvgIconProps>;
  /** Current data state */
  state: ListDataState;
  /** Error message (when state is 'error') */
  errorMessage?: string;
  /** HTTP status code (when state is 'error') */
  errorStatusCode?: number;
  /** Callback to retry fetching data */
  onRetry?: () => void;
  /** Empty state message */
  emptyMessage?: string;
  /** Empty state title */
  emptyTitle?: string;
  /** Whether filters/search are active (affects empty state message) */
  hasActiveFilters?: boolean;
  /** Header actions (buttons, etc.) */
  headerActions?: ReactNode;
  /** Banner content (alerts, warnings) */
  banner?: ReactNode;
  /** Main content (rendered when state is 'success') */
  children: ReactNode;
  /** data-testid for e2e testing */
  testId?: string;
}

/**
 * ListPageShell - Auth-safe wrapper for list pages
 * 
 * This component implements a state machine that properly handles:
 * 1. Auth loading state (token not yet loaded) - shows loading, not empty
 * 2. Unauthenticated state - shows sign-in prompt
 * 3. Loading state - shows spinner/skeleton
 * 4. Error state - shows error panel with status code
 * 5. Empty state - shows real empty state (only when authorized + no data)
 * 6. Success state - renders children
 * 
 * This prevents the "No data" illusion where 401 errors are misclassified as empty results.
 */
export const ListPageShell: React.FC<ListPageShellProps> = ({
  title,
  icon,
  state,
  errorMessage,
  errorStatusCode,
  onRetry,
  emptyMessage = 'No items found',
  emptyTitle,
  hasActiveFilters = false,
  headerActions,
  banner,
  children,
  testId,
}) => {
  const navigate = useNavigate();
  const { loading: authLoading } = useAuth();

  // Determine effective state - if auth is still loading, override to authLoading
  const effectiveState = authLoading ? 'authLoading' : state;

  const renderContent = () => {
    switch (effectiveState) {
      case 'authLoading':
        return (
          <LoadingState 
            message="Initializing..." 
            minHeight="400px"
          />
        );

      case 'unauthenticated':
        return (
          <Box
            display="flex"
            flexDirection="column"
            justifyContent="center"
            alignItems="center"
            minHeight="400px"
            gap={2}
            textAlign="center"
            p={3}
          >
            <LoginIcon sx={{ fontSize: 64, color: 'text.disabled' }} />
            <Typography variant="h6" color="textSecondary">
              Please sign in
            </Typography>
            <Typography variant="body1" color="textSecondary" maxWidth={400}>
              You need to be signed in to view this content.
            </Typography>
            <Button
              variant="contained"
              color="primary"
              onClick={() => navigate('/login')}
              startIcon={<LoginIcon />}
            >
              Sign In
            </Button>
          </Box>
        );

      case 'loading':
        return (
          <LoadingState 
            message={`Loading ${title.toLowerCase()}...`} 
            minHeight="400px"
          />
        );

      case 'error':
        return (
          <ErrorState
            title={`Failed to load ${title.toLowerCase()}`}
            message={errorMessage || 'An error occurred while loading data.'}
            statusCode={errorStatusCode}
            onRetry={onRetry}
            diagnosticHint={
              errorStatusCode === 401 
                ? 'Your session may have expired. Try signing in again.' 
                : errorStatusCode === 403
                ? 'You may not have permission to view this content.'
                : undefined
            }
          />
        );

      case 'empty':
        return (
          <EmptyState
            icon={icon ? React.cloneElement(icon, { sx: { fontSize: 64, color: 'text.disabled' } }) : undefined}
            title={emptyTitle || emptyMessage}
            message={hasActiveFilters ? 'Try adjusting your filters or search query' : undefined}
          />
        );

      case 'success':
        return children;

      default:
        return children;
    }
  };

  return (
    <Box sx={{ p: 3 }} data-testid={testId}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {icon} {title}
        </Typography>
        {headerActions}
      </Box>

      {banner}

      {effectiveState === 'error' && errorStatusCode !== 401 && errorStatusCode !== 403 && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={onRetry}>
          {errorMessage}
        </Alert>
      )}

      {renderContent()}
    </Box>
  );
};

/**
 * Helper function to determine ListDataState from common list hook values
 * 
 * @param options - Object with isLoading, error, items, and optional user
 * @returns The appropriate ListDataState
 */
export function getListDataState(options: {
  isLoading: boolean;
  error: string | null | undefined;
  errorStatusCode?: number;
  items: unknown[] | null | undefined;
  user: unknown | null | undefined;
  authLoading?: boolean;
}): ListDataState {
  const { isLoading, error, errorStatusCode, items, user, authLoading } = options;

  // Auth loading takes precedence
  if (authLoading) {
    return 'authLoading';
  }

  // Check for unauthenticated state
  if (!user) {
    return 'unauthenticated';
  }

  // Check for 401/403 errors - these should show as unauthenticated/error, not empty
  if (error) {
    if (errorStatusCode === 401) {
      return 'unauthenticated';
    }
    return 'error';
  }

  // Loading state
  if (isLoading) {
    return 'loading';
  }

  // Empty state (only when authorized and no data)
  if (!items || items.length === 0) {
    return 'empty';
  }

  // Success state
  return 'success';
}

export default ListPageShell;
