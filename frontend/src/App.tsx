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
import { AdminUsers, AdminRoles, AdminSettings, AdminTenants, AdminAuditLogs, AdminSystem, AdminFrameworks, AdminPlatformBuilder, AdminEventLog, AdminNotificationStudio, AdminApiCatalog, AdminPlatformHealth } from './pages/admin';
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
import { ClauseDetail } from './pages/ClauseDetail';
import { AuditDashboard, ComplianceDashboard, GrcHealthDashboard } from './pages/dashboards';
import { ProcessManagement } from './pages/ProcessManagement';
import { ProcessDetail } from './pages/ProcessDetail';
import { ProcessViolations } from './pages/ProcessViolations';
import { ViolationDetail } from './pages/ViolationDetail';
import { RiskDetail } from './pages/RiskDetail';
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
import { SoaProfilesList } from './pages/SoaProfilesList';
import { SoaProfileDetail } from './pages/SoaProfileDetail';
import { SoaItemDetail } from './pages/SoaItemDetail';
import { BcmServiceList } from './pages/BcmServiceList';
import { BcmServiceDetail } from './pages/BcmServiceDetail';
import { BcmExerciseList } from './pages/BcmExerciseList';
import { CalendarPage } from './pages/CalendarPage';
import { ItsmServiceList, ItsmServiceDetail, ItsmIncidentList, ItsmIncidentDetail, ItsmChangeList, ItsmChangeDetail, ItsmChangeCalendar, ItsmChangeTemplateList, ItsmChangeTemplateDetail, ItsmChoiceAdmin, ItsmStudioTables, ItsmStudioBusinessRules, ItsmStudioUiPolicies, ItsmStudioUiActions, ItsmStudioWorkflows, ItsmStudioSla, ItsmStudioPriorityMatrix, ItsmDiagnostics, ItsmProblemList, ItsmProblemDetail, ItsmKnownErrorList, ItsmKnownErrorDetail, ItsmMajorIncidentList, ItsmMajorIncidentDetail, ItsmAnalyticsDashboard, ItsmCabMeetingList, ItsmCabMeetingDetail } from './pages/itsm';
import { CmdbCiList, CmdbCiDetail, CmdbCiClassList, CmdbCiClassDetail, CmdbCiClassTree, CmdbServiceList, CmdbServiceDetail, CmdbImportJobList, CmdbImportJobDetail, CmdbReconcileRules, CmdbRelationshipTypeList, CmdbRelationshipTypeDetail } from './pages/cmdb';
import { CopilotPage } from './pages/copilot/CopilotPage';
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
                  <Route path="risks/new" element={<RiskDetail />} />
                  <Route path="risks/:id" element={<RiskDetail />} />
                                    <Route path="compliance" element={<Compliance />} />
                                    <Route path="requirements/new" element={<RequirementDetail />} />
                                    <Route path="requirements/:id" element={<RequirementDetail />} />
                  <Route path="dotwalking" element={<DotWalkingBuilder />} />
                  <Route path="incidents" element={<IncidentManagement />} />
                  <Route path="processes" element={<ProcessManagement />} />
                  <Route path="processes/new" element={<ProcessDetail />} />
                  <Route path="processes/:id" element={<ProcessDetail />} />
                  <Route path="violations" element={<ProcessViolations />} />
                  <Route path="violations/:id" element={<ViolationDetail />} />
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
                  
                  {/* CMDB (Configuration Management Database) Routes */}
                  <Route path="cmdb/cis" element={
                    <ErrorBoundary>
                      <CmdbCiList />
                    </ErrorBoundary>
                  } />
                  <Route path="cmdb/cis/new" element={
                    <ErrorBoundary>
                      <CmdbCiDetail />
                    </ErrorBoundary>
                  } />
                  <Route path="cmdb/cis/:id" element={
                    <ErrorBoundary>
                      <CmdbCiDetail />
                    </ErrorBoundary>
                  } />
                  <Route path="cmdb/classes" element={
                    <ErrorBoundary>
                      <CmdbCiClassList />
                    </ErrorBoundary>
                  } />
                  <Route path="cmdb/classes/tree" element={
                    <ErrorBoundary>
                      <CmdbCiClassTree />
                    </ErrorBoundary>
                  } />
                  <Route path="cmdb/classes/:id" element={
                    <ErrorBoundary>
                      <CmdbCiClassDetail />
                    </ErrorBoundary>
                  } />
                  
                  {/* ITSM (IT Service Management) Routes - ITIL v5 aligned */}
                  <Route path="itsm/services" element={
                    <ErrorBoundary>
                      <ItsmServiceList />
                    </ErrorBoundary>
                  } />
                  <Route path="itsm/services/new" element={
                    <ErrorBoundary>
                      <ItsmServiceDetail />
                    </ErrorBoundary>
                  } />
                  <Route path="itsm/services/:id" element={
                    <ErrorBoundary>
                      <ItsmServiceDetail />
                    </ErrorBoundary>
                  } />
                  <Route path="itsm/incidents" element={
                    <ErrorBoundary>
                      <ItsmIncidentList />
                    </ErrorBoundary>
                  } />
                  <Route path="itsm/incidents/new" element={
                    <ErrorBoundary>
                      <ItsmIncidentDetail />
                    </ErrorBoundary>
                  } />
                  <Route path="itsm/incidents/:id" element={
                    <ErrorBoundary>
                      <ItsmIncidentDetail />
                    </ErrorBoundary>
                  } />
                  <Route path="itsm/changes" element={
                    <ErrorBoundary>
                      <ItsmChangeList />
                    </ErrorBoundary>
                  } />
                  <Route path="itsm/changes/new" element={
                    <ErrorBoundary>
                      <ItsmChangeDetail />
                    </ErrorBoundary>
                  } />
                  <Route path="itsm/changes/:id" element={
                    <ErrorBoundary>
                      <ItsmChangeDetail />
                    </ErrorBoundary>
                  } />
                  <Route path="itsm/change-calendar" element={
                    <ErrorBoundary>
                      <ItsmChangeCalendar />
                    </ErrorBoundary>
                  } />
                  {/* ITSM Change Template Management */}
                  <Route path="itsm/change-templates" element={
                    <ErrorBoundary>
                      <ItsmChangeTemplateList />
                    </ErrorBoundary>
                  } />
                  <Route path="itsm/change-templates/new" element={
                    <ErrorBoundary>
                      <ItsmChangeTemplateDetail />
                    </ErrorBoundary>
                  } />
                  <Route path="itsm/change-templates/:id" element={
                    <ErrorBoundary>
                      <ItsmChangeTemplateDetail />
                    </ErrorBoundary>
                  } />
                  
                  {/* ITSM CAB Meeting Management */}
                  <Route path="itsm/change-management/cab" element={
                    <ErrorBoundary>
                      <ItsmCabMeetingList />
                    </ErrorBoundary>
                  } />
                  <Route path="itsm/change-management/cab/new" element={
                    <ErrorBoundary>
                      <ItsmCabMeetingDetail />
                    </ErrorBoundary>
                  } />
                  <Route path="itsm/change-management/cab/:id" element={
                    <ErrorBoundary>
                      <ItsmCabMeetingDetail />
                    </ErrorBoundary>
                  } />
                  
                  {/* ITSM Studio (Admin configuration) */}
                  <Route path="itsm/studio/choices" element={
                    <ProtectedRoute allowedRoles={['admin']}>
                      <ErrorBoundary>
                        <ItsmChoiceAdmin />
                      </ErrorBoundary>
                    </ProtectedRoute>
                  } />
                  <Route path="itsm/studio/tables" element={
                    <ProtectedRoute allowedRoles={['admin']}>
                      <ErrorBoundary>
                        <ItsmStudioTables />
                      </ErrorBoundary>
                    </ProtectedRoute>
                  } />
                  <Route path="itsm/studio/business-rules" element={
                    <ProtectedRoute allowedRoles={['admin']}>
                      <ErrorBoundary>
                        <ItsmStudioBusinessRules />
                      </ErrorBoundary>
                    </ProtectedRoute>
                  } />
                  <Route path="itsm/studio/ui-policies" element={
                    <ProtectedRoute allowedRoles={['admin']}>
                      <ErrorBoundary>
                        <ItsmStudioUiPolicies />
                      </ErrorBoundary>
                    </ProtectedRoute>
                  } />
                  <Route path="itsm/studio/ui-actions" element={
                    <ProtectedRoute allowedRoles={['admin']}>
                      <ErrorBoundary>
                        <ItsmStudioUiActions />
                      </ErrorBoundary>
                    </ProtectedRoute>
                  } />
                  <Route path="itsm/studio/workflows" element={
                    <ProtectedRoute allowedRoles={['admin']}>
                      <ErrorBoundary>
                        <ItsmStudioWorkflows />
                      </ErrorBoundary>
                    </ProtectedRoute>
                  } />
                  <Route path="itsm/studio/sla" element={
                    <ProtectedRoute allowedRoles={['admin']}>
                      <ErrorBoundary>
                        <ItsmStudioSla />
                      </ErrorBoundary>
                    </ProtectedRoute>
                  } />
                  <Route path="itsm/studio/priority-matrix" element={
                    <ProtectedRoute allowedRoles={['admin']}>
                      <ErrorBoundary>
                        <ItsmStudioPriorityMatrix />
                      </ErrorBoundary>
                    </ProtectedRoute>
                  } />
                  <Route path="itsm/diagnostics" element={
                    <ProtectedRoute allowedRoles={['admin']}>
                      <ErrorBoundary>
                        <ItsmDiagnostics />
                      </ErrorBoundary>
                    </ProtectedRoute>
                  } />
                  
                  {/* CMDB Import & Reconciliation Routes */}
                  <Route path="cmdb/import-jobs" element={
                    <ErrorBoundary>
                      <CmdbImportJobList />
                    </ErrorBoundary>
                  } />
                  <Route path="cmdb/import-jobs/:id" element={
                    <ErrorBoundary>
                      <CmdbImportJobDetail />
                    </ErrorBoundary>
                  } />
                  <Route path="cmdb/reconcile-rules" element={
                    <ProtectedRoute allowedRoles={['admin']}>
                      <ErrorBoundary>
                        <CmdbReconcileRules />
                      </ErrorBoundary>
                    </ProtectedRoute>
                  } />
                  
                  {/* CMDB Service Portfolio Routes */}
                  <Route path="cmdb/services" element={<CmdbServiceList />} />
                  <Route path="cmdb/services/new" element={<CmdbServiceDetail />} />
                  <Route path="cmdb/services/:id" element={<CmdbServiceDetail />} />
                  
                  {/* CMDB Relationship Type Admin Routes */}
                  <Route path="cmdb/relationship-types" element={
                    <ErrorBoundary>
                      <CmdbRelationshipTypeList />
                    </ErrorBoundary>
                  } />
                  <Route path="cmdb/relationship-types/new" element={
                    <ErrorBoundary>
                      <CmdbRelationshipTypeDetail />
                    </ErrorBoundary>
                  } />
                  <Route path="cmdb/relationship-types/:id" element={
                    <ErrorBoundary>
                      <CmdbRelationshipTypeDetail />
                    </ErrorBoundary>
                  } />
                  
                  {/* Copilot (AI Decision & Action Layer) */}
                  <Route path="copilot" element={
                    <ErrorBoundary>
                      <CopilotPage />
                    </ErrorBoundary>
                  } />
                  
                  {/* Coming Soon Pages - ITSM Suite (Future features) */}
                  <Route path="sla-dashboard" element={
                    <ComingSoonPage 
                      title="SLA Dashboard" 
                      description="Monitor service level agreements with real-time metrics and alerts."
                      moduleName="ITSM"
                    />
                  } />
                  {/* ITSM Problem Management Routes */}
                  <Route path="itsm/problems" element={
                    <ErrorBoundary>
                      <ItsmProblemList />
                    </ErrorBoundary>
                  } />
                  <Route path="itsm/problems/new" element={
                    <ErrorBoundary>
                      <ItsmProblemDetail />
                    </ErrorBoundary>
                  } />
                  <Route path="itsm/problems/:id" element={
                    <ErrorBoundary>
                      <ItsmProblemDetail />
                    </ErrorBoundary>
                  } />
                  <Route path="itsm/known-errors" element={
                    <ErrorBoundary>
                      <ItsmKnownErrorList />
                    </ErrorBoundary>
                  } />
                  <Route path="itsm/known-errors/new" element={
                    <ErrorBoundary>
                      <ItsmKnownErrorDetail />
                    </ErrorBoundary>
                  } />
                  <Route path="itsm/known-errors/:id" element={
                    <ErrorBoundary>
                      <ItsmKnownErrorDetail />
                    </ErrorBoundary>
                  } />
                  {/* ITSM Major Incident Routes */}
                  <Route path="itsm/major-incidents" element={
                    <ErrorBoundary>
                      <ItsmMajorIncidentList />
                    </ErrorBoundary>
                  } />
                  <Route path="itsm/major-incidents/:id" element={
                    <ErrorBoundary>
                      <ItsmMajorIncidentDetail />
                    </ErrorBoundary>
                  } />
                  {/* ITSM Analytics Dashboard */}
                  <Route path="itsm/analytics" element={
                    <ErrorBoundary>
                      <ItsmAnalyticsDashboard />
                    </ErrorBoundary>
                  } />
                  {/* Legacy /problems redirect */}
                  <Route path="problems" element={<Navigate to="/itsm/problems" replace />} />
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
                                    <Route path="standards/clauses/:id" element={<ClauseDetail />} />
                  <Route path="soa" element={<SoaProfilesList />} />
                  <Route path="soa/:id" element={<SoaProfileDetail />} />
                  <Route path="soa/:profileId/items/:itemId" element={<SoaItemDetail />} />
                  
                  {/* BCM (Business Continuity Management) Routes */}
                  <Route path="bcm/services" element={<BcmServiceList />} />
                  <Route path="bcm/services/:id" element={<BcmServiceDetail />} />
                  <Route path="bcm/exercises" element={<BcmExerciseList />} />
                  
                  {/* GRC Calendar Route */}
                  <Route path="calendar" element={<CalendarPage />} />
                  
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
                                <Route path="event-log" element={<AdminEventLog />} />
                  <Route path="notification-studio" element={<AdminNotificationStudio />} />
                  <Route path="api-catalog" element={<AdminApiCatalog />} />
                  <Route path="platform-health" element={<AdminPlatformHealth />} />
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
