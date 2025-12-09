import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { AuthProvider } from './contexts/AuthContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { Layout } from './components/Layout';
import { AdminLayout } from './components/admin';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Governance } from './pages/Governance';
import { RiskManagement } from './pages/RiskManagement';
import { Compliance } from './pages/Compliance';
import { UserManagement } from './pages/UserManagement';
import { TodoList } from './pages/TodoList';
import { AdminPanel } from './pages/AdminPanel';
import { AdminUsers, AdminRoles, AdminSettings } from './pages/admin';
import { DotWalkingBuilder } from './pages/DotWalkingBuilder';
import { IncidentManagement } from './pages/IncidentManagement';
import { AuditList } from './pages/AuditList';
import { AuditDetail } from './pages/AuditDetail';
import { FindingDetail } from './pages/FindingDetail';
import { ReportViewer } from './pages/ReportViewer';
import { StandardsLibrary } from './pages/StandardsLibrary';
import { StandardDetail } from './pages/StandardDetail';
import { AuditDashboard, ComplianceDashboard, GrcHealthDashboard } from './pages/dashboards';
import { ProtectedRoute } from './components/ProtectedRoute';

const theme = createTheme({
  palette: {
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
    background: {
      default: '#f5f5f5',
    },
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
  },
});

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <NotificationProvider>
        <AuthProvider>
          <Router>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/" element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }>
                <Route index element={<Navigate to="/dashboard" replace />} />
                <Route path="dashboard" element={<Dashboard />} />
                <Route path="todos" element={<TodoList />} />
                <Route path="governance" element={<Governance />} />
                <Route path="risk" element={<RiskManagement />} />
                <Route path="compliance" element={<Compliance />} />
                <Route path="dotwalking" element={<DotWalkingBuilder />} />
                <Route path="incidents" element={<IncidentManagement />} />
                                <Route path="audits" element={<AuditList />} />
                                <Route path="audits/new" element={<AuditDetail />} />
                                <Route path="audits/:id" element={<AuditDetail />} />
                                <Route path="audits/:id/edit" element={<AuditDetail />} />
                                <Route path="audits/:auditId/reports/:reportId" element={<ReportViewer />} />
                                                <Route path="findings/:id" element={<FindingDetail />} />
                                                <Route path="findings/:id/edit" element={<FindingDetail />} />
                                                                                <Route path="standards" element={<StandardsLibrary />} />
                                                                                <Route path="standards/:id" element={<StandardDetail />} />
                                                                                <Route path="dashboards/audit" element={
                                                  <ProtectedRoute allowedRoles={['admin', 'auditor', 'audit_manager', 'governance']}>
                                                    <AuditDashboard />
                                                  </ProtectedRoute>
                                                } />
                                                <Route path="dashboards/compliance" element={
                                                  <ProtectedRoute allowedRoles={['admin', 'governance', 'compliance', 'audit_manager']}>
                                                    <ComplianceDashboard />
                                                  </ProtectedRoute>
                                                } />
                                                <Route path="dashboards/grc-health" element={
                                                  <ProtectedRoute allowedRoles={['admin', 'governance', 'executive', 'director']}>
                                                    <GrcHealthDashboard />
                                                  </ProtectedRoute>
                                                } />
                                                                <Route path="users" element={
                  <ProtectedRoute allowedRoles={['admin', 'manager']}>
                    <UserManagement />
                  </ProtectedRoute>
                } />
                <Route path="admin-legacy" element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <AdminPanel />
                  </ProtectedRoute>
                } />
              </Route>
              <Route path="/admin" element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminLayout />
                </ProtectedRoute>
              }>
                <Route index element={<Navigate to="/admin/users" replace />} />
                <Route path="users" element={<AdminUsers />} />
                <Route path="roles" element={<AdminRoles />} />
                <Route path="settings" element={<AdminSettings />} />
                <Route path="permissions" element={<AdminRoles />} />
                <Route path="tenants" element={<AdminSettings />} />
              </Route>
            </Routes>
          </Router>
        </AuthProvider>
      </NotificationProvider>
    </ThemeProvider>
  );
}

export default App;
