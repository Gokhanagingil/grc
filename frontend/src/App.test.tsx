import React from 'react';
import { render } from '@testing-library/react';

// Mock all the heavy dependencies to avoid import issues
jest.mock('react-router-dom', () => ({
  BrowserRouter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Routes: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Route: () => null,
  Navigate: () => null,
  useNavigate: () => jest.fn(),
  useLocation: () => ({ pathname: '/' }),
  useParams: () => ({}),
  Outlet: () => null,
  Link: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

jest.mock('./contexts/AuthContext', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  useAuth: () => ({
    user: null,
    isAuthenticated: false,
    login: jest.fn(),
    logout: jest.fn(),
  }),
}));

jest.mock('./contexts/NotificationContext', () => ({
  NotificationProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  useNotification: () => ({
    showNotification: jest.fn(),
  }),
}));

jest.mock('./contexts/OnboardingContext', () => ({
  OnboardingProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  useOnboarding: () => ({
    refreshContext: jest.fn(),
  }),
}));

// Mock all page components to avoid deep dependency chains
jest.mock('./pages/Login', () => ({ Login: () => <div>Login</div> }));
jest.mock('./pages/Dashboard', () => ({ Dashboard: () => <div>Dashboard</div> }));
jest.mock('./components/Layout', () => ({ Layout: () => <div>Layout</div> }));
jest.mock('./components/admin', () => ({ AdminLayout: () => <div>AdminLayout</div> }));
jest.mock('./components/ProtectedRoute', () => ({ 
  ProtectedRoute: ({ children }: { children: React.ReactNode }) => <div>{children}</div> 
}));
jest.mock('./components/common/ErrorBoundary', () => ({ 
  ErrorBoundary: ({ children }: { children: React.ReactNode }) => <div>{children}</div> 
}));
jest.mock('./components/common/InitializationErrorBoundary', () => ({ 
  InitializationErrorBoundary: ({ children }: { children: React.ReactNode }) => <div>{children}</div> 
}));

// Import App after mocks are set up
// eslint-disable-next-line import/first
import App from './App';

describe('App', () => {
  it('renders without crashing', () => {
    // This is a smoke test to ensure the App component can mount
    expect(() => {
      render(<App />);
    }).not.toThrow();
  });
});
