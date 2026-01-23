import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { AuthProvider } from './contexts/AuthContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { OnboardingProvider } from './contexts/OnboardingContext';
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
import { AdminUsers, AdminRoles, AdminSettings, AdminTenants, AdminAuditLogs, AdminSystem, AdminFrameworks, AdminPlatformBuilder } from './pages/admin';
import AdminDataModel from './pages/admin/AdminDataModel';
import DynamicDataList from './pages/DynamicDataList';
import { DotWalkingBuilder } from './pages/DotWalkingBuilder';
import { IncidentManagement } from './pages/IncidentManagement';
import { AuditList } from './pages/AuditList';
import { AuditDetail } from './pages/AuditDetail';
import { FindingDetail } from './pages/FindingDetail';
import { ReportViewer } from './pages/ReportViewer';
import { StandardsLibrary } from './pages/StandardsLibrary';
import { StandardDetail } from './pages/StandardDetail';
import { AuditDashboard, ComplianceDashboard, GrcHealthDashboard } from './pages/dashboards';
import { ProcessManagement } from './pages/ProcessManagement';
import { ProcessViolations } from './pages/ProcessViolations';
import { Profile } from './pages/Profile';
import { Coverage } from './pages/Coverage';
import { ControlList } from './pages/ControlList';
import { ControlDetail } from './pages/ControlDetail';
import { EvidenceList } from './pages/EvidenceList';
import { EvidenceDetail } from './pages/EvidenceDetail';
import { TestResultList } from './pages/TestResultList';
import { TestResultDetail } from './pages/TestResultDetail';
import { ControlTestList } from './pages/ControlTestList';
import { ControlTestDetail } from './pages/ControlTestDetail';
import { IssueList } from './pages/IssueList';
import { IssueDetail } from './pages/IssueDetail';
import { CapaList } from './pages/CapaList';
import { CapaDetail } from './pages/CapaDetail';
import { PolicyDetail } from './pages/PolicyDetail';
import { RequirementDetail } from './pages/RequirementDetail';
import GrcInsights from './pages/GrcInsights';
import { ProtectedRoute } from './components/ProtectedRoute';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { InitializationErrorBoundary } from './components/common/InitializationErrorBoundary';
import { ComingSoonPage } from './components/common/ComingSoonPage';
import { enterpriseTheme } from './theme';

// Legacy route redirect components
const LegacyStandardRedirect: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  return <Navigate to={`/standards/${id}`} replace />;
};

const LegacyRequirementRedirect: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  return <Navigate to={`/requirements/${id}`} replace />;
};

function App() {
  return (
    <ThemeProvider theme={enterpriseTheme}>
      <CssBaseline />
      <NotificationProvider>
        <AuthProvider>
          <OnboardingProvider>
            <Router>
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/" element={
                  <ProtectedRoute>
                    <InitializationErrorBoundary>
                      <Layout />
                    </InitializationErrorBoundary>
                  </ProtectedRoute>
                }>
                  <Route index element={<Navigate to="/dashboard" replace />} />
                  <Route 
                    path="dashboard" 
                    element={
                      <ErrorBoundary>
                        <Dashboard />
                      </ErrorBoundary>
                    } 
                  />
                  <Route path="todos" element={
                    <ErrorBoundary>
                      <TodoList />
                    </ErrorBoundary>
                  } />
                                    <Route path="governance" element={<Governance />} />
                                    <Route path="policies/new" element={<PolicyDetail />} />
                                    <Route path="policies/:id" element={<PolicyDetail />} />
                                    <Route path="risk" element={<RiskManagement />} />
                                    <Route path="compliance" element={<Compliance />} />
                                    <Route path="requirements/new" element={<RequirementDetail />} />
                                    <Route path="requirements/:id" element={<RequirementDetail />} />
                  <Route path="dotwalking" element={<DotWalkingBuilder />} />
                  <Route path="incidents" element={<IncidentManagement />} />
                  <Route path="processes" element={<ProcessManagement />} />
                                    <Route path="violations" element={<ProcessViolations />} />
                                    <Route path="profile" element={<Profile />} />
                                    <Route path="coverage" element={<Coverage />} />
                  
                  {/* Coming Soon Pages - GRC Suite */}
                  <Route path="risk-assessments" element={
                    <ComingSoonPage 
                      title="Risk Assessments" 
                      description="Comprehensive risk assessment tools with automated scoring and reporting."
                      moduleName="Risk Management"
                    />
                  } />
                  <Route path="risk-treatments" element={
                    <ComingSoonPage 
                      title="Risk Treatments" 
                      description="Track and manage risk treatment plans with progress monitoring."
                      moduleName="Risk Management"
                    />
                  } />
                  <Route path="policy-templates" element={
                    <ComingSoonPage 
                      title="Policy Templates" 
                      description="Pre-built policy templates for common compliance frameworks."
                      moduleName="Policy Management"
                    />
                  } />
                  <Route path="policy-reviews" element={
                    <ComingSoonPage 
                      title="Policy Reviews" 
                      description="Scheduled policy review workflows with approval tracking."
                      moduleName="Policy Management"
                    />
                  } />
                  <Route path="controls" element={<ControlList />} />
                  <Route path="controls/:id" element={<ControlDetail />} />
                  <Route path="evidence" element={<EvidenceList />} />
                  <Route path="evidence/:id" element={<EvidenceDetail />} />
                                    <Route path="test-results" element={<TestResultList />} />
                                    <Route path="test-results/:id" element={<TestResultDetail />} />
                                    <Route path="control-tests" element={<ControlTestList />} />
                                    <Route path="control-tests/:id" element={<ControlTestDetail />} />
                                    <Route path="issues" element={<IssueList />} />
                  <Route path="issues/:id" element={<IssueDetail />} />
                                    <Route path="capa" element={<CapaList />} />
                                    <Route path="capa/:id" element={<CapaDetail />} />
                                    <Route path="insights" element={<GrcInsights />} />
                                    <Route path="control-testing" element={
                    <ComingSoonPage 
                      title="Control Testing" 
                      description="Automated and manual control testing with evidence collection."
                      moduleName="Control Management"
                    />
                  } />
                  <Route path="audit-reports" element={
                    <ComingSoonPage 
                      title="Audit Reports" 
                      description="Generate comprehensive audit reports with findings and recommendations."
                      moduleName="Audit Management"
                    />
                  } />
                  
                  {/* Coming Soon Pages - ITSM Suite */}
                  <Route path="sla-dashboard" element={
                    <ComingSoonPage 
                      title="SLA Dashboard" 
                      description="Monitor service level agreements with real-time metrics and alerts."
                      moduleName="ITSM"
                    />
                  } />
                  <Route path="problems" element={
                    <ComingSoonPage 
                      title="Problem Management" 
                      description="Root cause analysis and problem resolution tracking."
                      moduleName="ITSM"
                    />
                  } />
                  <Route path="changes" element={
                    <ComingSoonPage 
                      title="Change Management" 
                      description="Change request workflow with approval and implementation tracking."
                      moduleName="ITSM"
                    />
                  } />
                  {/* Redirect /audit to /audits to prevent white screen */}
                  <Route path="audit" element={<Navigate to="/audits" replace />} />
                  <Route path="audits" element={<AuditList />} />
                  <Route path="audits/new" element={<AuditDetail />} />
                  <Route path="audits/:id" element={<AuditDetail />} />
                  <Route path="audits/:id/edit" element={<AuditDetail />} />
                  <Route path="audits/:auditId/reports/:reportId" element={<ReportViewer />} />
                  <Route path="findings/:id" element={<FindingDetail />} />
                  <Route path="findings/:id/edit" element={<FindingDetail />} />
                  <Route path="standards" element={
                    <ErrorBoundary>
                      <StandardsLibrary />
                    </ErrorBoundary>
                  } />
                  <Route path="standards/:id" element={<StandardDetail />} />
                  
                  {/* Legacy /library/* route redirects */}
                  <Route path="library/standards" element={<Navigate to="/standards" replace />} />
                  <Route path="library/standards/:id" element={<LegacyStandardRedirect />} />
                  <Route path="library/requirements" element={<Navigate to="/compliance" replace />} />
                  <Route path="library/requirements/:id" element={<LegacyRequirementRedirect />} />
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
                  <Route path="tenants" element={<AdminTenants />} />
                  <Route path="audit-logs" element={<AdminAuditLogs />} />
                                  <Route path="system" element={<AdminSystem />} />
                                  <Route path="data-model" element={<AdminDataModel />} />
                                  <Route path="frameworks" element={<AdminFrameworks />} />
                                  <Route path="platform-builder" element={<AdminPlatformBuilder />} />
                                </Route>
                {/* Dynamic Data Routes */}
                <Route path="/data/:tableName" element={
                  <ProtectedRoute>
                    <InitializationErrorBoundary>
                      <Layout />
                    </InitializationErrorBoundary>
                  </ProtectedRoute>
                }>
                  <Route index element={<DynamicDataList />} />
                </Route>
              </Routes>
            </Router>
          </OnboardingProvider>
        </AuthProvider>
      </NotificationProvider>
    </ThemeProvider>
  );
}

export default App;
