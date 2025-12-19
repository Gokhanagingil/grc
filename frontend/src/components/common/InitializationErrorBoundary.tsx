import React, { Component, ReactNode } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Collapse,
  Alert,
} from '@mui/material';
import {
  ErrorOutline as ErrorIcon,
  Refresh as RefreshIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Settings as SettingsIcon,
  Home as HomeIcon,
} from '@mui/icons-material';

// Safe home routes in order of preference
const SAFE_HOME_ROUTES = ['/profile', '/admin/system', '/login'];

// Storage key for last known good route
const LAST_GOOD_ROUTE_KEY = 'lastKnownGoodRoute';

// Debounce tracking for reload
const RELOAD_DEBOUNCE_KEY = 'lastReloadAttempt';
const RELOAD_DEBOUNCE_MS = 2000; // 2 seconds minimum between reloads

interface InitializationErrorBoundaryProps {
  children: ReactNode;
}

interface InitializationErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
  showDetails: boolean;
}

/**
 * InitializationErrorBoundary
 * 
 * A specialized error boundary for catching errors during application initialization,
 * particularly in the Layout component. This ensures that initialization failures
 * (such as API errors, undefined state access, etc.) never result in a blank white screen.
 * 
 * This boundary provides:
 * - Clear error messaging: "Application initialization failed"
 * - Navigation to admin/system diagnostics
 * - Page reload functionality
 * - Development-mode error details
 * 
 * Created to fix: Layout crash on onboarding context failure (429-safe)
 */
class InitializationErrorBoundaryClass extends Component<
  InitializationErrorBoundaryProps,
  InitializationErrorBoundaryState
> {
  constructor(props: InitializationErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<InitializationErrorBoundaryState> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log full error details with stack trace to console
    console.error('[InitializationErrorBoundary] Application initialization failed:', error);
    console.error('[InitializationErrorBoundary] Error stack:', error.stack);
    console.error('[InitializationErrorBoundary] Component stack:', errorInfo.componentStack);
    
    this.setState({
      error,
      errorInfo,
    });
  }

  handleReload = () => {
    // Debounce reload to prevent request storms
    try {
      const lastReload = sessionStorage.getItem(RELOAD_DEBOUNCE_KEY);
      const now = Date.now();
      
      if (lastReload) {
        const lastReloadTime = parseInt(lastReload, 10);
        if (!isNaN(lastReloadTime) && now - lastReloadTime < RELOAD_DEBOUNCE_MS) {
          console.warn('[InitializationErrorBoundary] Reload debounced - too soon since last attempt');
          return;
        }
      }
      
      // Record this reload attempt
      sessionStorage.setItem(RELOAD_DEBOUNCE_KEY, now.toString());
      
      // Clear any cached state that might be causing issues
      sessionStorage.removeItem('onboarding_rate_limit_until');
    } catch {
      // Ignore storage errors
    }
    window.location.reload();
  };

  handleGoToSystemDiagnostics = () => {
    window.location.href = '/admin/system';
  };

  /**
   * Safe Home Strategy:
   * 1. Try last known good route from sessionStorage
   * 2. Fall back to safe routes in order: /profile, /admin/system, /login
   * 3. Avoid routes that previously crashed
   */
  handleGoHome = () => {
    const currentPath = window.location.pathname;
    
    try {
      // Try last known good route first
      const lastGoodRoute = sessionStorage.getItem(LAST_GOOD_ROUTE_KEY);
      if (lastGoodRoute && lastGoodRoute !== currentPath && !lastGoodRoute.includes(currentPath)) {
        console.log('[InitializationErrorBoundary] Navigating to last known good route:', lastGoodRoute);
        window.location.href = lastGoodRoute;
        return;
      }
    } catch {
      // Ignore storage errors
    }
    
    // Find a safe route that isn't the current crashing path
    for (const safeRoute of SAFE_HOME_ROUTES) {
      if (safeRoute !== currentPath && !currentPath.startsWith(safeRoute)) {
        console.log('[InitializationErrorBoundary] Navigating to safe route:', safeRoute);
        window.location.href = safeRoute;
        return;
      }
    }
    
    // Last resort: go to login
    console.log('[InitializationErrorBoundary] Navigating to login as last resort');
    window.location.href = '/login';
  };

  toggleDetails = () => {
    this.setState((prev) => ({ showDetails: !prev.showDetails }));
  };

  render() {
    if (this.state.hasError) {
      const isDevelopment = process.env.NODE_ENV === 'development';

      return (
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: '100vh',
            p: 3,
            backgroundColor: '#f5f5f5',
          }}
        >
          <Card sx={{ maxWidth: 600, width: '100%' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                <ErrorIcon color="error" sx={{ fontSize: 48 }} />
                <Box>
                  <Typography variant="h5" component="h1" gutterBottom>
                    Application initialization failed
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    The application encountered an error during startup.
                  </Typography>
                </Box>
              </Box>

              <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                {this.state.error?.message || 
                  'An unexpected error occurred while loading the application. This may be due to a network issue or a temporary service disruption.'}
              </Typography>

              <Box sx={{ display: 'flex', gap: 2, mb: isDevelopment ? 2 : 0, flexWrap: 'wrap' }}>
                <Button
                  variant="contained"
                  startIcon={<RefreshIcon />}
                  onClick={this.handleReload}
                  color="primary"
                >
                  Retry / Reload
                </Button>
                <Button
                  variant="contained"
                  startIcon={<HomeIcon />}
                  onClick={this.handleGoHome}
                  color="success"
                >
                  Go Home
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<SettingsIcon />}
                  onClick={this.handleGoToSystemDiagnostics}
                >
                  System Diagnostics
                </Button>
              </Box>

              {isDevelopment && this.state.error && (
                <Box sx={{ mt: 3 }}>
                  <Button
                    size="small"
                    onClick={this.toggleDetails}
                    endIcon={this.state.showDetails ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                  >
                    {this.state.showDetails ? 'Hide' : 'Show'} Technical Details
                  </Button>
                  <Collapse in={this.state.showDetails}>
                    <Alert severity="error" sx={{ mt: 2 }}>
                      <Typography 
                        variant="body2" 
                        component="pre" 
                        sx={{ 
                          whiteSpace: 'pre-wrap', 
                          fontFamily: 'monospace',
                          fontSize: '0.75rem',
                          maxHeight: '300px',
                          overflow: 'auto',
                        }}
                      >
                        {this.state.error.toString()}
                        {this.state.errorInfo && (
                          <>
                            {'\n\nComponent Stack:'}
                            {this.state.errorInfo.componentStack}
                          </>
                        )}
                      </Typography>
                    </Alert>
                  </Collapse>
                </Box>
              )}

              <Box sx={{ mt: 3, pt: 2, borderTop: '1px solid #e0e0e0' }}>
                <Typography variant="caption" color="text.secondary">
                  If this problem persists, please contact your system administrator or check the browser console for more details.
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Box>
      );
    }

    return this.props.children;
  }
}

export const InitializationErrorBoundary: React.FC<InitializationErrorBoundaryProps> = (props) => {
  return <InitializationErrorBoundaryClass {...props} />;
};

export default InitializationErrorBoundaryClass;
