import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Button,
  Grid,
  Typography,
  Chip,
  Alert,
  CircularProgress,
  Tab,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Switch,
  FormControlLabel,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  IconButton,
  Tooltip,
  Card,
  CardContent,
  TablePagination,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  PlayArrow as TestIcon,
  CheckCircle as SuccessIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Computer as LocalIcon,
  Cloud as CloudIcon,
  Save as SaveIcon,
  VpnKey as KeyIcon,
} from '@mui/icons-material';
import { AdminPageHeader } from '../../components/admin';
import { api } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

// ── Types ────────────────────────────────────────────────────────────────

interface AiProvider {
  id: string;
  tenantId: string | null;
  providerType: string;
  displayName: string;
  isEnabled: boolean;
  baseUrl: string | null;
  modelName: string | null;
  requestTimeoutMs: number;
  maxTokens: number | null;
  temperature: number | null;
  hasApiKey: boolean;
  hasCustomHeaders: boolean;
  createdAt: string;
  updatedAt: string;
}

interface AiPolicy {
  id?: string;
  tenantId?: string;
  isAiEnabled: boolean;
  defaultProviderConfigId?: string | null;
  humanApprovalRequiredDefault?: boolean;
  allowedFeatures: Record<string, boolean>;
  createdAt?: string;
  updatedAt?: string;
}

interface AiAuditEvent {
  id: string;
  tenantId: string;
  userId: string | null;
  featureKey: string;
  providerType: string;
  modelName: string | null;
  actionType: string;
  status: string;
  latencyMs: number | null;
  details: string | null;
  createdAt: string;
}

interface TestResult {
  success: boolean;
  latencyMs: number;
  message: string;
}

// ── Helper to unwrap envelope ────────────────────────────────────────────

function unwrapData<T>(responseData: unknown): T {
  const d = responseData as Record<string, unknown>;
  if (d && d.success === true && d.data !== undefined) {
    return d.data as T;
  }
  return responseData as T;
}

// ── Feature keys ─────────────────────────────────────────────────────────

const FEATURE_KEYS = [
  { key: 'RISK_ADVISORY', label: 'Risk Advisory', available: true },
  { key: 'INCIDENT_COPILOT', label: 'Incident Copilot', available: true },
  { key: 'CHANGE_ASSISTANT', label: 'Change Assistant', available: false },
  { key: 'KNOWLEDGE_DRAFTING', label: 'Knowledge Drafting', available: false },
  { key: 'EVIDENCE_SUMMARY', label: 'Evidence Summary', available: false },
];

const PROVIDER_TYPES = [
  { value: 'LOCAL', label: 'Local / Self-Hosted', recommended: true },
  { value: 'OPENAI', label: 'OpenAI', recommended: false },
  { value: 'AZURE_OPENAI', label: 'Azure OpenAI', recommended: false },
  { value: 'ANTHROPIC', label: 'Anthropic', recommended: false },
  { value: 'OTHER', label: 'Other', recommended: false },
];

// ── Tab Panel ────────────────────────────────────────────────────────────

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div role="tabpanel" hidden={value !== index} {...other}>
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────

export const AdminAiControlCenter: React.FC = () => {
  const { user } = useAuth();
  const [tabIndex, setTabIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Data
  const [providers, setProviders] = useState<AiProvider[]>([]);
  const [policy, setPolicy] = useState<AiPolicy>({ isAiEnabled: false, allowedFeatures: {} });
  const [auditEvents, setAuditEvents] = useState<AiAuditEvent[]>([]);
  const [auditTotal, setAuditTotal] = useState(0);
  const [auditPage, setAuditPage] = useState(0);
  const [auditPageSize, setAuditPageSize] = useState(10);

  // Provider modal state
  const [providerModalOpen, setProviderModalOpen] = useState(false);
  const [editingProvider, setEditingProvider] = useState<AiProvider | null>(null);
  const [providerForm, setProviderForm] = useState({
    providerType: 'LOCAL',
    displayName: '',
    baseUrl: '',
    modelName: '',
    requestTimeoutMs: 30000,
    maxTokens: '',
    temperature: '',
    apiKey: '',
    customHeaders: '',
    isEnabled: true,
  });

  // Test result
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);

  // ── Data fetching ────────────────────────────────────────────────────

  const fetchProviders = useCallback(async () => {
    try {
      const res = await api.get('/grc/admin/ai/providers');
      const data = unwrapData<{ items: AiProvider[] }>(res.data);
      setProviders(data.items || []);
    } catch (err) {
      console.error('Failed to fetch providers:', err);
    }
  }, []);

  const fetchPolicy = useCallback(async () => {
    try {
      const res = await api.get('/grc/admin/ai/policies');
      const data = unwrapData<AiPolicy>(res.data);
      setPolicy(data);
    } catch (err) {
      console.error('Failed to fetch policy:', err);
    }
  }, []);

  const fetchAudit = useCallback(async () => {
    try {
      const res = await api.get('/grc/admin/ai/audit', {
        params: { page: auditPage + 1, pageSize: auditPageSize },
      });
      const data = unwrapData<{ items: AiAuditEvent[]; total: number }>(res.data);
      setAuditEvents(data.items || []);
      setAuditTotal(data.total || 0);
    } catch (err) {
      console.error('Failed to fetch audit events:', err);
    }
  }, [auditPage, auditPageSize]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await Promise.all([fetchProviders(), fetchPolicy(), fetchAudit()]);
    } catch (err) {
      setError('Failed to load AI Control Center data');
    } finally {
      setLoading(false);
    }
  }, [fetchProviders, fetchPolicy, fetchAudit]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // ── Provider CRUD ────────────────────────────────────────────────────

  const openCreateProvider = () => {
    setEditingProvider(null);
    setProviderForm({
      providerType: 'LOCAL',
      displayName: '',
      baseUrl: '',
      modelName: '',
      requestTimeoutMs: 30000,
      maxTokens: '',
      temperature: '',
      apiKey: '',
      customHeaders: '',
      isEnabled: true,
    });
    setProviderModalOpen(true);
  };

  const openEditProvider = (provider: AiProvider) => {
    setEditingProvider(provider);
    setProviderForm({
      providerType: provider.providerType,
      displayName: provider.displayName,
      baseUrl: provider.baseUrl || '',
      modelName: provider.modelName || '',
      requestTimeoutMs: provider.requestTimeoutMs,
      maxTokens: provider.maxTokens?.toString() || '',
      temperature: provider.temperature?.toString() || '',
      apiKey: '',
      customHeaders: '',
      isEnabled: provider.isEnabled,
    });
    setProviderModalOpen(true);
  };

  const handleSaveProvider = async () => {
    try {
      setError(null);
      const payload: Record<string, unknown> = {
        providerType: providerForm.providerType,
        displayName: providerForm.displayName,
        isEnabled: providerForm.isEnabled,
        baseUrl: providerForm.baseUrl || null,
        modelName: providerForm.modelName || null,
        requestTimeoutMs: providerForm.requestTimeoutMs,
      };

      if (providerForm.maxTokens) {
        payload.maxTokens = parseInt(providerForm.maxTokens, 10);
      }
      if (providerForm.temperature) {
        payload.temperature = parseFloat(providerForm.temperature);
      }
      if (providerForm.apiKey) {
        payload.apiKey = providerForm.apiKey;
      }
      if (providerForm.customHeaders) {
        payload.customHeaders = providerForm.customHeaders;
      }

      if (editingProvider) {
        await api.patch(`/grc/admin/ai/providers/${editingProvider.id}`, payload);
        setSuccessMsg('Provider updated successfully');
      } else {
        await api.post('/grc/admin/ai/providers', payload);
        setSuccessMsg('Provider created successfully');
      }

      setProviderModalOpen(false);
      await fetchProviders();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save provider';
      setError(msg);
    }
  };

  const handleDeleteProvider = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this provider?')) return;
    try {
      await api.delete(`/grc/admin/ai/providers/${id}`);
      setSuccessMsg('Provider deleted');
      await fetchProviders();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to delete provider';
      setError(msg);
    }
  };

  const handleToggleProvider = async (provider: AiProvider) => {
    try {
      await api.patch(`/grc/admin/ai/providers/${provider.id}`, {
        isEnabled: !provider.isEnabled,
      });
      await fetchProviders();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to toggle provider';
      setError(msg);
    }
  };

  // ── Test Connection ──────────────────────────────────────────────────

  const handleTestConnection = async (id: string) => {
    setTestingId(id);
    setTestResult(null);
    try {
      const res = await api.post(`/grc/admin/ai/providers/${id}/test`);
      const data = unwrapData<TestResult>(res.data);
      setTestResult(data);
      // Refresh audit log after test
      await fetchAudit();
    } catch (err) {
      setTestResult({
        success: false,
        latencyMs: 0,
        message: err instanceof Error ? err.message : 'Test failed',
      });
    } finally {
      setTestingId(null);
    }
  };

  // ── Policy Update ────────────────────────────────────────────────────

  const handleSavePolicy = async () => {
    try {
      setError(null);
      const tenantId = user?.tenantId;
      if (!tenantId) {
        setError('Tenant ID not available');
        return;
      }
      await api.put(`/grc/admin/ai/policies/${tenantId}`, {
        isAiEnabled: policy.isAiEnabled,
        defaultProviderConfigId: policy.defaultProviderConfigId || null,
        humanApprovalRequiredDefault: policy.humanApprovalRequiredDefault ?? true,
        allowedFeatures: policy.allowedFeatures,
      });
      setSuccessMsg('AI policy saved successfully');
      await fetchPolicy();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save policy';
      setError(msg);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────

  return (
    <Box>
      <AdminPageHeader
        title="AI Control Center"
        subtitle="Configure and govern AI usage across the platform"
        breadcrumbs={[
          { label: 'Admin', href: '/admin' },
          { label: 'AI Control Center' },
        ]}
        actions={
          <Button startIcon={<RefreshIcon />} onClick={fetchAll} disabled={loading}>
            Refresh
          </Button>
        }
      />

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      {successMsg && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccessMsg(null)}>
          {successMsg}
        </Alert>
      )}

      {/* Test Result Banner */}
      {testResult && (
        <Alert
          severity={testResult.success ? 'success' : 'error'}
          sx={{ mb: 2 }}
          onClose={() => setTestResult(null)}
          icon={testResult.success ? <SuccessIcon /> : <ErrorIcon />}
        >
          <strong>Connection Test:</strong> {testResult.message}
          {testResult.latencyMs > 0 && ` (${testResult.latencyMs}ms)`}
        </Alert>
      )}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Tabs value={tabIndex} onChange={(_, v) => setTabIndex(v)}>
              <Tab label="Overview" data-testid="tab-overview" />
              <Tab label="Providers" data-testid="tab-providers" />
              <Tab label="Policies" data-testid="tab-policies" />
              <Tab label="Audit Log" data-testid="tab-audit" />
            </Tabs>
          </Box>

          {/* ═══ Overview Tab ═══ */}
          <TabPanel value={tabIndex} index={0}>
            <Grid container spacing={3}>
              <Grid item xs={12} md={4}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>AI Status</Typography>
                    <Chip
                      label={policy.isAiEnabled ? 'AI Enabled' : 'AI Disabled'}
                      color={policy.isAiEnabled ? 'success' : 'default'}
                      size="medium"
                      sx={{ mb: 2 }}
                    />
                    <Typography variant="body2" color="text.secondary">
                      {policy.isAiEnabled
                        ? 'AI features are active for this tenant.'
                        : 'AI features are disabled. Enable in the Policies tab.'}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} md={4}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>Providers</Typography>
                    <Typography variant="h3" color="primary">
                      {providers.filter((p) => p.isEnabled).length}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {providers.length} total / {providers.filter((p) => p.isEnabled).length} enabled
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} md={4}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>Human Approval</Typography>
                    <Chip
                      label={policy.humanApprovalRequiredDefault ? 'Required' : 'Not Required'}
                      color={policy.humanApprovalRequiredDefault ? 'warning' : 'info'}
                      size="medium"
                      sx={{ mb: 2 }}
                    />
                    <Typography variant="body2" color="text.secondary">
                      Default requirement for human approval on AI actions.
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>

              {/* Quick Actions */}
              <Grid item xs={12}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>Quick Actions</Typography>
                    <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                      <Button
                        variant="outlined"
                        startIcon={<AddIcon />}
                        onClick={openCreateProvider}
                      >
                        Add Provider
                      </Button>
                      {providers.length > 0 && (
                        <Button
                          variant="outlined"
                          startIcon={<TestIcon />}
                          onClick={() => handleTestConnection(providers[0].id)}
                          disabled={!!testingId}
                        >
                          Test Default Provider
                        </Button>
                      )}
                      <Button
                        variant="outlined"
                        startIcon={<SaveIcon />}
                        onClick={handleSavePolicy}
                      >
                        Save Policy
                      </Button>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>

              {/* Enabled Features */}
              <Grid item xs={12}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>Enabled Features</Typography>
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                      {FEATURE_KEYS.map((f) => (
                        <Chip
                          key={f.key}
                          label={f.label}
                          color={
                            !f.available
                              ? 'default'
                              : policy.allowedFeatures[f.key]
                              ? 'success'
                              : 'default'
                          }
                          variant={f.available ? 'filled' : 'outlined'}
                          icon={!f.available ? <WarningIcon /> : undefined}
                          size="medium"
                        />
                      ))}
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </TabPanel>

          {/* ═══ Providers Tab ═══ */}
          <TabPanel value={tabIndex} index={1}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
              <Typography variant="h6">AI Providers</Typography>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={openCreateProvider}
              >
                Add Provider
              </Button>
            </Box>

            {providers.length === 0 ? (
              <Alert severity="info" sx={{ mb: 2 }}>
                No AI providers configured yet. Click "Add Provider" to get started.
                <br />
                <strong>Tip:</strong> Start with a Local/Self-Hosted provider for maximum control.
              </Alert>
            ) : (
              <TableContainer component={Paper}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Name</TableCell>
                      <TableCell>Type</TableCell>
                      <TableCell>Base URL</TableCell>
                      <TableCell>Model</TableCell>
                      <TableCell>Enabled</TableCell>
                      <TableCell>Secret</TableCell>
                      <TableCell>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {providers.map((provider) => (
                      <TableRow key={provider.id}>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            {provider.providerType === 'LOCAL' ? (
                              <LocalIcon color="primary" fontSize="small" />
                            ) : (
                              <CloudIcon color="action" fontSize="small" />
                            )}
                            {provider.displayName}
                            {provider.providerType === 'LOCAL' && (
                              <Chip label="Recommended" size="small" color="primary" variant="outlined" />
                            )}
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Chip label={provider.providerType} size="small" />
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {provider.baseUrl || '-'}
                          </Typography>
                        </TableCell>
                        <TableCell>{provider.modelName || '-'}</TableCell>
                        <TableCell>
                          <Switch
                            checked={provider.isEnabled}
                            onChange={() => handleToggleProvider(provider)}
                            size="small"
                          />
                        </TableCell>
                        <TableCell>
                          {provider.hasApiKey ? (
                            <Chip label="Key set" size="small" color="success" variant="outlined" icon={<KeyIcon />} />
                          ) : (
                            <Chip label="No key" size="small" variant="outlined" />
                          )}
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', gap: 0.5 }}>
                            <Tooltip title="Test Connection">
                              <IconButton
                                size="small"
                                onClick={() => handleTestConnection(provider.id)}
                                disabled={testingId === provider.id}
                              >
                                {testingId === provider.id ? (
                                  <CircularProgress size={18} />
                                ) : (
                                  <TestIcon fontSize="small" />
                                )}
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Edit">
                              <IconButton size="small" onClick={() => openEditProvider(provider)}>
                                <EditIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Delete">
                              <IconButton size="small" onClick={() => handleDeleteProvider(provider.id)} color="error">
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </Box>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </TabPanel>

          {/* ═══ Policies Tab ═══ */}
          <TabPanel value={tabIndex} index={2}>
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>Global AI Settings</Typography>

                    <FormControlLabel
                      control={
                        <Switch
                          checked={policy.isAiEnabled}
                          onChange={(e) => setPolicy({ ...policy, isAiEnabled: e.target.checked })}
                        />
                      }
                      label="Enable AI for this tenant"
                      sx={{ mb: 2, display: 'block' }}
                    />

                    <FormControl fullWidth sx={{ mb: 2 }}>
                      <InputLabel>Default Provider</InputLabel>
                      <Select
                        value={policy.defaultProviderConfigId || ''}
                        onChange={(e) =>
                          setPolicy({ ...policy, defaultProviderConfigId: e.target.value || null })
                        }
                        label="Default Provider"
                      >
                        <MenuItem value="">
                          <em>None (use global default)</em>
                        </MenuItem>
                        {providers
                          .filter((p) => p.isEnabled)
                          .map((p) => (
                            <MenuItem key={p.id} value={p.id}>
                              {p.displayName} ({p.providerType})
                            </MenuItem>
                          ))}
                      </Select>
                    </FormControl>

                    <FormControlLabel
                      control={
                        <Switch
                          checked={policy.humanApprovalRequiredDefault ?? true}
                          onChange={(e) =>
                            setPolicy({ ...policy, humanApprovalRequiredDefault: e.target.checked })
                          }
                        />
                      }
                      label="Require human approval by default"
                      sx={{ mb: 2, display: 'block' }}
                    />

                    <Button
                      variant="contained"
                      startIcon={<SaveIcon />}
                      onClick={handleSavePolicy}
                    >
                      Save Policy
                    </Button>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12} md={6}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>Feature Toggles</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      Enable or disable individual AI-powered features.
                    </Typography>

                    {FEATURE_KEYS.map((feature) => (
                      <Box key={feature.key} sx={{ mb: 1 }}>
                        <FormControlLabel
                          control={
                            <Switch
                              checked={policy.allowedFeatures[feature.key] === true}
                              onChange={(e) => {
                                setPolicy({
                                  ...policy,
                                  allowedFeatures: {
                                    ...policy.allowedFeatures,
                                    [feature.key]: e.target.checked,
                                  },
                                });
                              }}
                              disabled={!feature.available || !policy.isAiEnabled}
                            />
                          }
                          label={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              {feature.label}
                              {!feature.available && (
                                <Chip label="v1.1" size="small" variant="outlined" />
                              )}
                            </Box>
                          }
                        />
                      </Box>
                    ))}
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </TabPanel>

          {/* ═══ Audit Tab ═══ */}
          <TabPanel value={tabIndex} index={3}>
            <Typography variant="h6" gutterBottom>AI Audit Events</Typography>

            {auditEvents.length === 0 ? (
              <Alert severity="info">
                No AI audit events yet. Test a provider connection to generate the first event.
              </Alert>
            ) : (
              <TableContainer component={Paper}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Time</TableCell>
                      <TableCell>Action</TableCell>
                      <TableCell>Feature</TableCell>
                      <TableCell>Provider</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Latency</TableCell>
                      <TableCell>Details</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {auditEvents.map((event) => (
                      <TableRow key={event.id}>
                        <TableCell>
                          <Typography variant="body2">
                            {new Date(event.createdAt).toLocaleString()}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip label={event.actionType} size="small" />
                        </TableCell>
                        <TableCell>{event.featureKey}</TableCell>
                        <TableCell>{event.providerType}</TableCell>
                        <TableCell>
                          <Chip
                            label={event.status}
                            size="small"
                            color={
                              event.status === 'SUCCESS'
                                ? 'success'
                                : event.status === 'FAIL'
                                ? 'error'
                                : 'default'
                            }
                          />
                        </TableCell>
                        <TableCell>
                          {event.latencyMs !== null ? `${event.latencyMs}ms` : '-'}
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {event.details || '-'}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <TablePagination
                  component="div"
                  count={auditTotal}
                  page={auditPage}
                  onPageChange={(_, p) => setAuditPage(p)}
                  rowsPerPage={auditPageSize}
                  onRowsPerPageChange={(e) => {
                    setAuditPageSize(parseInt(e.target.value, 10));
                    setAuditPage(0);
                  }}
                  rowsPerPageOptions={[5, 10, 25]}
                />
              </TableContainer>
            )}
          </TabPanel>
        </>
      )}

      {/* ═══ Provider Create/Edit Dialog ═══ */}
      <Dialog
        open={providerModalOpen}
        onClose={() => setProviderModalOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {editingProvider ? 'Edit Provider' : 'Add AI Provider'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <FormControl fullWidth>
              <InputLabel>Provider Type</InputLabel>
              <Select
                value={providerForm.providerType}
                onChange={(e) => setProviderForm({ ...providerForm, providerType: e.target.value })}
                label="Provider Type"
              >
                {PROVIDER_TYPES.map((pt) => (
                  <MenuItem key={pt.value} value={pt.value}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {pt.value === 'LOCAL' ? <LocalIcon fontSize="small" /> : <CloudIcon fontSize="small" />}
                      {pt.label}
                      {pt.recommended && (
                        <Chip label="Recommended" size="small" color="primary" variant="outlined" />
                      )}
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              label="Display Name"
              value={providerForm.displayName}
              onChange={(e) => setProviderForm({ ...providerForm, displayName: e.target.value })}
              fullWidth
              required
              placeholder="e.g., Local Ollama Server"
            />

            <TextField
              label="Base URL"
              value={providerForm.baseUrl}
              onChange={(e) => setProviderForm({ ...providerForm, baseUrl: e.target.value })}
              fullWidth
              placeholder="e.g., http://localhost:11434"
              helperText={providerForm.providerType === 'LOCAL' ? 'URL of your local AI server' : 'API endpoint URL'}
            />

            <TextField
              label="Model Name"
              value={providerForm.modelName}
              onChange={(e) => setProviderForm({ ...providerForm, modelName: e.target.value })}
              fullWidth
              placeholder="e.g., llama2, gpt-4"
            />

            <TextField
              label="Request Timeout (ms)"
              type="number"
              value={providerForm.requestTimeoutMs}
              onChange={(e) =>
                setProviderForm({ ...providerForm, requestTimeoutMs: parseInt(e.target.value, 10) || 30000 })
              }
              fullWidth
            />

            <Grid container spacing={2}>
              <Grid item xs={6}>
                <TextField
                  label="Max Tokens"
                  type="number"
                  value={providerForm.maxTokens}
                  onChange={(e) => setProviderForm({ ...providerForm, maxTokens: e.target.value })}
                  fullWidth
                  placeholder="Optional"
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  label="Temperature"
                  type="number"
                  value={providerForm.temperature}
                  onChange={(e) => setProviderForm({ ...providerForm, temperature: e.target.value })}
                  fullWidth
                  placeholder="0.0 - 2.0"
                  inputProps={{ step: 0.1, min: 0, max: 2 }}
                />
              </Grid>
            </Grid>

            <TextField
              label={editingProvider ? 'Set / Rotate API Key' : 'API Key / Token'}
              type="password"
              value={providerForm.apiKey}
              onChange={(e) => setProviderForm({ ...providerForm, apiKey: e.target.value })}
              fullWidth
              placeholder={editingProvider ? 'Leave empty to keep current key' : 'Optional for LOCAL'}
              helperText={
                editingProvider?.hasApiKey
                  ? 'A key is currently set. Enter a new value to rotate.'
                  : 'Optional — needed for authenticated endpoints'
              }
            />

            <TextField
              label="Custom Headers (JSON)"
              value={providerForm.customHeaders}
              onChange={(e) => setProviderForm({ ...providerForm, customHeaders: e.target.value })}
              fullWidth
              multiline
              rows={2}
              placeholder='{"X-Custom-Header": "value"}'
              helperText="Optional JSON object of extra headers"
            />

            <FormControlLabel
              control={
                <Switch
                  checked={providerForm.isEnabled}
                  onChange={(e) => setProviderForm({ ...providerForm, isEnabled: e.target.checked })}
                />
              }
              label="Enabled"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setProviderModalOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleSaveProvider}
            disabled={!providerForm.displayName}
          >
            {editingProvider ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AdminAiControlCenter;
