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
  Home as HomeIcon,
  Refresh as RefreshIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Settings as SettingsIcon,
} from '@mui/icons-material';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
  showDetails: boolean;
}

class ErrorBoundaryClass extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log full error details with stack trace to console
    console.error('ErrorBoundary caught an error:', error);
    console.error('Error stack:', error.stack);
    console.error('Component stack:', errorInfo.componentStack);
    console.error('Error info:', errorInfo);
    
    this.setState({
      error,
      errorInfo,
    });
  }

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  handleGoToDiagnostics = () => {
    window.location.href = '/admin/system';
  };

  toggleDetails = () => {
    this.setState((prev) => ({ showDetails: !prev.showDetails }));
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const isDevelopment = process.env.NODE_ENV === 'development';

      return (
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: '400px',
            p: 3,
          }}
        >
          <Card sx={{ maxWidth: 600, width: '100%' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                <ErrorIcon color="error" sx={{ fontSize: 48 }} />
                <Typography variant="h5" component="h1">
                  Something went wrong
                </Typography>
              </Box>

              <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
                {this.state.error?.message || 'An unexpected error occurred. Please try reloading the page or returning to the home page.'}
              </Typography>

              <Box sx={{ display: 'flex', gap: 2, mb: isDevelopment ? 2 : 0, flexWrap: 'wrap' }}>
                <Button
                  variant="contained"
                  startIcon={<RefreshIcon />}
                  onClick={this.handleReload}
                >
                  Reload
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<SettingsIcon />}
                  onClick={this.handleGoToDiagnostics}
                >
                  Go to Admin/System Diagnostics
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<HomeIcon />}
                  onClick={this.handleGoHome}
                >
                  Go Home
                </Button>
              </Box>

              {isDevelopment && this.state.error && (
                <Box sx={{ mt: 3 }}>
                  <Button
                    size="small"
                    onClick={this.toggleDetails}
                    endIcon={this.state.showDetails ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                  >
                    {this.state.showDetails ? 'Hide' : 'Show'} Details
                  </Button>
                  <Collapse in={this.state.showDetails}>
                    <Alert severity="error" sx={{ mt: 2 }}>
                      <Typography variant="body2" component="pre" sx={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>
                        {this.state.error.toString()}
                        {this.state.errorInfo && (
                          <>
                            {'\n\n'}
                            {this.state.errorInfo.componentStack}
                          </>
                        )}
                      </Typography>
                    </Alert>
                  </Collapse>
                </Box>
              )}
            </CardContent>
          </Card>
        </Box>
      );
    }

    return this.props.children;
  }
}

// Export as functional component wrapper (class component can't be exported directly as default with hooks)
export const ErrorBoundary: React.FC<ErrorBoundaryProps> = (props) => {
  return <ErrorBoundaryClass {...props} />;
};

export default ErrorBoundaryClass;