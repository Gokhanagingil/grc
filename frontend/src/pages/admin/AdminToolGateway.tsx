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
  Checkbox,
  FormGroup,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  PlayArrow as TestIcon,
  CheckCircle as SuccessIcon,
  Error as ErrorIcon,
  Save as SaveIcon,
  VpnKey as KeyIcon,
  Send as RunIcon,
} from '@mui/icons-material';
import { AdminPageHeader } from '../../components/admin';
import { api } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

// ── Types ────────────────────────────────────────────────────────────────

interface IntegrationProvider {
  id: string;
  tenantId: string;
  providerKey: string;
  displayName: string;
  isEnabled: boolean;
  baseUrl: string;
  authType: string;
  hasUsername: boolean;
  hasPassword: boolean;
  hasToken: boolean;
  hasCustomHeaders: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ToolPolicyData {
  id?: string;
  tenantId?: string;
  isToolsEnabled: boolean;
  allowedTools: string[];
  rateLimitPerMinute: number;
  maxToolCallsPerRun: number;
}

interface TestResult {
  success: boolean;
  latencyMs: number;
  message: string;
}

interface ToolRunResult {
  success: boolean;
  data: unknown;
  meta: {
    table?: string;
    totalCount?: number;
    limit?: number;
    offset?: number;
    recordCount?: number;
  };
  error?: string;
}

// ── Constants ────────────────────────────────────────────────────────────

const TOOL_KEYS = [
  { key: 'SERVICENOW_QUERY_TABLE', label: 'Query Table (Generic)', description: 'Generic read-only table query' },
  { key: 'SERVICENOW_GET_RECORD', label: 'Get Record', description: 'Fetch a single record by sys_id' },
  { key: 'SERVICENOW_QUERY_INCIDENTS', label: 'Query Incidents', description: 'Query incident table' },
  { key: 'SERVICENOW_QUERY_CHANGES', label: 'Query Changes', description: 'Query change_request table' },
];

const AUTH_TYPES = [
  { value: 'BASIC', label: 'Basic Authentication' },
  { value: 'API_TOKEN', label: 'API Token / Bearer' },
];

// ── Helpers ──────────────────────────────────────────────────────────────

function unwrapData<T>(responseData: unknown): T {
  const d = responseData as Record<string, unknown>;
  if (d && d.success === true && d.data !== undefined) {
    return d.data as T;
  }
  return responseData as T;
}

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

export const AdminToolGateway: React.FC = () => {
  const { user } = useAuth();
  const [tabIndex, setTabIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Data
  const [providers, setProviders] = useState<IntegrationProvider[]>([]);
  const [policy, setPolicy] = useState<ToolPolicyData>({
    isToolsEnabled: false,
    allowedTools: [],
    rateLimitPerMinute: 60,
    maxToolCallsPerRun: 10,
  });

  // Provider modal state
  const [providerModalOpen, setProviderModalOpen] = useState(false);
  const [editingProvider, setEditingProvider] = useState<IntegrationProvider | null>(null);
  const [providerForm, setProviderForm] = useState({
    providerKey: 'SERVICENOW',
    displayName: '',
    baseUrl: '',
    authType: 'BASIC',
    username: '',
    password: '',
    token: '',
    customHeaders: '',
    isEnabled: true,
  });

  // Test result
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);

  // Playground state
  const [playgroundTool, setPlaygroundTool] = useState('SERVICENOW_QUERY_INCIDENTS');
  const [playgroundInput, setPlaygroundInput] = useState('{\n  "query": "",\n  "limit": 10\n}');
  const [playgroundResult, setPlaygroundResult] = useState<ToolRunResult | null>(null);
  const [playgroundRunning, setPlaygroundRunning] = useState(false);

  // ── Data fetching ────────────────────────────────────────────────────

  const fetchProviders = useCallback(async () => {
    try {
      const res = await api.get('/grc/admin/tools/providers');
      const data = unwrapData<{ items: IntegrationProvider[] }>(res.data);
      setProviders(data.items || []);
    } catch (err) {
      console.error('Failed to fetch tool providers:', err);
    }
  }, []);

  const fetchPolicy = useCallback(async () => {
    try {
      const res = await api.get('/grc/admin/tools/policies');
      const data = unwrapData<ToolPolicyData>(res.data);
      setPolicy({
        isToolsEnabled: data.isToolsEnabled ?? false,
        allowedTools: Array.isArray(data.allowedTools) ? data.allowedTools : [],
        rateLimitPerMinute: data.rateLimitPerMinute ?? 60,
        maxToolCallsPerRun: data.maxToolCallsPerRun ?? 10,
        id: data.id,
        tenantId: data.tenantId,
      });
    } catch (err) {
      console.error('Failed to fetch tool policy:', err);
    }
  }, []);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await Promise.all([fetchProviders(), fetchPolicy()]);
    } catch {
      setError('Failed to load Tool Gateway data');
    } finally {
      setLoading(false);
    }
  }, [fetchProviders, fetchPolicy]);

  const [initialized, setInitialized] = useState(false);
  useEffect(() => {
    if (!initialized) {
      setInitialized(true);
      fetchAll();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Provider CRUD ────────────────────────────────────────────────────

  const openCreateProvider = () => {
    setEditingProvider(null);
    setProviderForm({
      providerKey: 'SERVICENOW',
      displayName: '',
      baseUrl: '',
      authType: 'BASIC',
      username: '',
      password: '',
      token: '',
      customHeaders: '',
      isEnabled: true,
    });
    setProviderModalOpen(true);
  };

  const openEditProvider = (provider: IntegrationProvider) => {
    setEditingProvider(provider);
    setProviderForm({
      providerKey: provider.providerKey,
      displayName: provider.displayName,
      baseUrl: provider.baseUrl,
      authType: provider.authType,
      username: '',
      password: '',
      token: '',
      customHeaders: '',
      isEnabled: provider.isEnabled,
    });
    setProviderModalOpen(true);
  };

  const handleSaveProvider = async () => {
    try {
      setError(null);
      const payload: Record<string, unknown> = {
        providerKey: providerForm.providerKey,
        displayName: providerForm.displayName,
        isEnabled: providerForm.isEnabled,
        baseUrl: providerForm.baseUrl,
        authType: providerForm.authType,
      };

      if (providerForm.username) payload.username = providerForm.username;
      if (providerForm.password) payload.password = providerForm.password;
      if (providerForm.token) payload.token = providerForm.token;
      if (providerForm.customHeaders) payload.customHeaders = providerForm.customHeaders;

      if (editingProvider) {
        await api.patch(`/grc/admin/tools/providers/${editingProvider.id}`, payload);
        setSuccessMsg('Integration provider updated successfully');
      } else {
        await api.post('/grc/admin/tools/providers', payload);
        setSuccessMsg('Integration provider created successfully');
      }

      setProviderModalOpen(false);
      await fetchProviders();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save provider';
      setError(msg);
    }
  };

  const handleDeleteProvider = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this integration provider?')) return;
    try {
      await api.delete(`/grc/admin/tools/providers/${id}`);
      setSuccessMsg('Provider deleted');
      await fetchProviders();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to delete provider';
      setError(msg);
    }
  };

  const handleToggleProvider = async (provider: IntegrationProvider) => {
    try {
      await api.patch(`/grc/admin/tools/providers/${provider.id}`, {
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
      const res = await api.post(`/grc/admin/tools/providers/${id}/test`);
      const data = unwrapData<TestResult>(res.data);
      setTestResult(data);
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

  // ── Policy Save ────────────────────────────────────────────────────

  const handleSavePolicy = async () => {
    try {
      setError(null);
      const tenantId = user?.tenantId;
      if (!tenantId) {
        setError('Tenant ID not available');
        return;
      }
      await api.put(`/grc/admin/tools/policies/${tenantId}`, {
        isToolsEnabled: policy.isToolsEnabled,
        allowedTools: policy.allowedTools,
        rateLimitPerMinute: policy.rateLimitPerMinute,
        maxToolCallsPerRun: policy.maxToolCallsPerRun,
      });
      setSuccessMsg('Tool policy saved successfully');
      await fetchPolicy();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save policy';
      setError(msg);
    }
  };

  const handleToggleTool = (toolKey: string) => {
    setPolicy((prev) => {
      const current = prev.allowedTools || [];
      const next = current.includes(toolKey)
        ? current.filter((k) => k !== toolKey)
        : [...current, toolKey];
      return { ...prev, allowedTools: next };
    });
  };

  // ── Playground ──────────────────────────────────────────────────────

  const handleRunTool = async () => {
    setPlaygroundRunning(true);
    setPlaygroundResult(null);
    try {
      let input: Record<string, unknown> = {};
      try {
        input = JSON.parse(playgroundInput) as Record<string, unknown>;
      } catch {
        setPlaygroundResult({
          success: false,
          data: null,
          meta: {},
          error: 'Invalid JSON input',
        });
        setPlaygroundRunning(false);
        return;
      }

      const res = await api.post('/grc/tools/run', {
        toolKey: playgroundTool,
        input,
      });
      const data = unwrapData<ToolRunResult>(res.data);
      setPlaygroundResult(data);
    } catch (err) {
      setPlaygroundResult({
        success: false,
        data: null,
        meta: {},
        error: err instanceof Error ? err.message : 'Tool execution failed',
      });
    } finally {
      setPlaygroundRunning(false);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────

  return (
    <Box>
      <AdminPageHeader
        title="Tool Gateway"
        subtitle="Manage external tool integrations and governance policies"
        breadcrumbs={[
          { label: 'Admin', href: '/admin' },
          { label: 'Tool Gateway' },
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
              <Tab label="Overview" data-testid="tab-tg-overview" />
              <Tab label="Integrations" data-testid="tab-tg-integrations" />
              <Tab label="Tool Policy" data-testid="tab-tg-policy" />
              <Tab label="Playground" data-testid="tab-tg-playground" />
            </Tabs>
          </Box>

          {/* ═══ Overview Tab ═══ */}
          <TabPanel value={tabIndex} index={0}>
            <Grid container spacing={3}>
              <Grid item xs={12} md={4}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>Tool Status</Typography>
                    <Chip
                      label={policy.isToolsEnabled ? 'Tools Enabled' : 'Tools Disabled'}
                      color={policy.isToolsEnabled ? 'success' : 'default'}
                      size="medium"
                      sx={{ mb: 2 }}
                    />
                    <Typography variant="body2" color="text.secondary">
                      {policy.isToolsEnabled
                        ? 'External tool integrations are active for this tenant.'
                        : 'External tools are disabled. Enable in the Tool Policy tab.'}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} md={4}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>Integrations</Typography>
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
                    <Typography variant="h6" gutterBottom>Allowed Tools</Typography>
                    <Typography variant="h3" color="primary">
                      {(policy.allowedTools || []).length}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      of {TOOL_KEYS.length} available tools enabled
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>Quick Actions</Typography>
                    <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                      <Button variant="outlined" startIcon={<AddIcon />} onClick={openCreateProvider}>
                        Add Integration
                      </Button>
                      {providers.length > 0 && (
                        <Button
                          variant="outlined"
                          startIcon={<TestIcon />}
                          onClick={() => handleTestConnection(providers[0].id)}
                          disabled={!!testingId}
                        >
                          Test Connection
                        </Button>
                      )}
                      <Button variant="outlined" startIcon={<SaveIcon />} onClick={handleSavePolicy}>
                        Save Policy
                      </Button>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>Tool Allowlist</Typography>
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                      {TOOL_KEYS.map((t) => (
                        <Chip
                          key={t.key}
                          label={t.label}
                          color={(policy.allowedTools || []).includes(t.key) ? 'success' : 'default'}
                          variant={(policy.allowedTools || []).includes(t.key) ? 'filled' : 'outlined'}
                          size="medium"
                        />
                      ))}
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </TabPanel>

          {/* ═══ Integrations Tab ═══ */}
          <TabPanel value={tabIndex} index={1}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
              <Typography variant="h6">Integration Providers</Typography>
              <Button variant="contained" startIcon={<AddIcon />} onClick={openCreateProvider}>
                Add Integration
              </Button>
            </Box>

            {providers.length === 0 ? (
              <Alert severity="info" sx={{ mb: 2 }}>
                No integration providers configured yet. Click &quot;Add Integration&quot; to connect ServiceNow.
              </Alert>
            ) : (
              <TableContainer component={Paper}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Name</TableCell>
                      <TableCell>Provider</TableCell>
                      <TableCell>Base URL</TableCell>
                      <TableCell>Auth</TableCell>
                      <TableCell>Enabled</TableCell>
                      <TableCell>Credentials</TableCell>
                      <TableCell>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {providers.map((provider) => (
                      <TableRow key={provider.id}>
                        <TableCell>{provider.displayName}</TableCell>
                        <TableCell>
                          <Chip label={provider.providerKey} size="small" />
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {provider.baseUrl}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip label={provider.authType} size="small" variant="outlined" />
                        </TableCell>
                        <TableCell>
                          <Switch
                            checked={provider.isEnabled}
                            onChange={() => handleToggleProvider(provider)}
                            size="small"
                          />
                        </TableCell>
                        <TableCell>
                          {(provider.hasUsername || provider.hasToken) ? (
                            <Chip label="Set" size="small" color="success" variant="outlined" icon={<KeyIcon />} />
                          ) : (
                            <Chip label="Not set" size="small" variant="outlined" />
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

          {/* ═══ Tool Policy Tab ═══ */}
          <TabPanel value={tabIndex} index={2}>
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>Global Tool Settings</Typography>

                    <FormControlLabel
                      control={
                        <Switch
                          checked={policy.isToolsEnabled}
                          onChange={(e) => setPolicy({ ...policy, isToolsEnabled: e.target.checked })}
                        />
                      }
                      label="Enable external tools for this tenant"
                      sx={{ mb: 2, display: 'block' }}
                    />

                    <TextField
                      label="Rate Limit (per minute)"
                      type="number"
                      value={policy.rateLimitPerMinute}
                      onChange={(e) => {
                        const parsed = parseInt(e.target.value, 10);
                        setPolicy({ ...policy, rateLimitPerMinute: Number.isNaN(parsed) ? policy.rateLimitPerMinute : parsed });
                      }}
                      fullWidth
                      sx={{ mb: 2 }}
                      inputProps={{ min: 1, max: 1000 }}
                    />

                    <TextField
                      label="Max Tool Calls Per Run"
                      type="number"
                      value={policy.maxToolCallsPerRun}
                      onChange={(e) => {
                        const parsed = parseInt(e.target.value, 10);
                        setPolicy({ ...policy, maxToolCallsPerRun: Number.isNaN(parsed) ? policy.maxToolCallsPerRun : parsed });
                      }}
                      fullWidth
                      sx={{ mb: 2 }}
                      inputProps={{ min: 1, max: 100 }}
                    />

                    <Button variant="contained" startIcon={<SaveIcon />} onClick={handleSavePolicy}>
                      Save Policy
                    </Button>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12} md={6}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>Tool Allowlist</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      Select which tools are allowed for this tenant. Only allowed tools can be executed.
                    </Typography>

                    <FormGroup>
                      {TOOL_KEYS.map((tool) => (
                        <FormControlLabel
                          key={tool.key}
                          control={
                            <Checkbox
                              checked={(policy.allowedTools || []).includes(tool.key)}
                              onChange={() => handleToggleTool(tool.key)}
                              disabled={!policy.isToolsEnabled}
                            />
                          }
                          label={
                            <Box>
                              <Typography variant="body2">{tool.label}</Typography>
                              <Typography variant="caption" color="text.secondary">
                                {tool.description}
                              </Typography>
                            </Box>
                          }
                          sx={{ mb: 1 }}
                        />
                      ))}
                    </FormGroup>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </TabPanel>

          {/* ═══ Playground Tab ═══ */}
          <TabPanel value={tabIndex} index={3}>
            <Grid container spacing={3}>
              <Grid item xs={12} md={5}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>Tool Playground</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      Test tools interactively. Select a tool, provide input, and run.
                    </Typography>

                    <FormControl fullWidth sx={{ mb: 2 }}>
                      <InputLabel>Tool</InputLabel>
                      <Select
                        value={playgroundTool}
                        onChange={(e) => setPlaygroundTool(e.target.value)}
                        label="Tool"
                      >
                        {TOOL_KEYS.map((t) => (
                          <MenuItem key={t.key} value={t.key}>
                            {t.label}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>

                    <TextField
                      label="Input (JSON)"
                      value={playgroundInput}
                      onChange={(e) => setPlaygroundInput(e.target.value)}
                      fullWidth
                      multiline
                      rows={8}
                      sx={{ mb: 2, fontFamily: 'monospace' }}
                      placeholder='{"query": "", "limit": 10}'
                    />

                    <Button
                      variant="contained"
                      startIcon={playgroundRunning ? <CircularProgress size={18} color="inherit" /> : <RunIcon />}
                      onClick={handleRunTool}
                      disabled={playgroundRunning}
                      fullWidth
                    >
                      {playgroundRunning ? 'Running...' : 'Run Tool'}
                    </Button>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12} md={7}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>Result</Typography>

                    {playgroundResult ? (
                      <>
                        <Alert
                          severity={playgroundResult.success ? 'success' : 'error'}
                          sx={{ mb: 2 }}
                        >
                          {playgroundResult.success
                            ? `Success — ${playgroundResult.meta.recordCount ?? 0} record(s) returned`
                            : playgroundResult.error || 'Tool execution failed'}
                        </Alert>

                        {playgroundResult.meta.table && (
                          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                            Table: {playgroundResult.meta.table}
                            {playgroundResult.meta.totalCount !== undefined &&
                              ` | Total: ${playgroundResult.meta.totalCount}`}
                            {playgroundResult.meta.limit !== undefined &&
                              ` | Limit: ${playgroundResult.meta.limit}`}
                            {playgroundResult.meta.offset !== undefined &&
                              ` | Offset: ${playgroundResult.meta.offset}`}
                          </Typography>
                        )}

                        <Box
                          sx={{
                            backgroundColor: 'grey.50',
                            borderRadius: 1,
                            p: 2,
                            maxHeight: 400,
                            overflow: 'auto',
                          }}
                        >
                          <pre style={{ margin: 0, fontSize: '0.8rem', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                            {JSON.stringify(playgroundResult.data, null, 2)}
                          </pre>
                        </Box>
                      </>
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        Run a tool to see results here.
                      </Typography>
                    )}
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
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
          {editingProvider ? 'Edit Integration Provider' : 'Add Integration Provider'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="Display Name"
              value={providerForm.displayName}
              onChange={(e) => setProviderForm({ ...providerForm, displayName: e.target.value })}
              fullWidth
              required
              placeholder="e.g., Production ServiceNow"
            />

            <TextField
              label="Base URL"
              value={providerForm.baseUrl}
              onChange={(e) => setProviderForm({ ...providerForm, baseUrl: e.target.value })}
              fullWidth
              required
              placeholder="https://your-instance.service-now.com"
              helperText="HTTPS required. Must pass SSRF validation."
            />

            <FormControl fullWidth>
              <InputLabel>Auth Type</InputLabel>
              <Select
                value={providerForm.authType}
                onChange={(e) => setProviderForm({ ...providerForm, authType: e.target.value })}
                label="Auth Type"
              >
                {AUTH_TYPES.map((at) => (
                  <MenuItem key={at.value} value={at.value}>
                    {at.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {providerForm.authType === 'BASIC' && (
              <>
                <TextField
                  label={editingProvider ? 'Set / Rotate Username' : 'Username'}
                  value={providerForm.username}
                  onChange={(e) => setProviderForm({ ...providerForm, username: e.target.value })}
                  fullWidth
                  placeholder={editingProvider ? 'Leave empty to keep current' : 'ServiceNow username'}
                  helperText={
                    editingProvider?.hasUsername
                      ? 'A username is currently set. Enter a new value to rotate.'
                      : undefined
                  }
                />
                <TextField
                  label={editingProvider ? 'Set / Rotate Password' : 'Password'}
                  type="password"
                  value={providerForm.password}
                  onChange={(e) => setProviderForm({ ...providerForm, password: e.target.value })}
                  fullWidth
                  placeholder={editingProvider ? 'Leave empty to keep current' : 'ServiceNow password'}
                  helperText={
                    editingProvider?.hasPassword
                      ? 'A password is currently set. Enter a new value to rotate.'
                      : undefined
                  }
                />
              </>
            )}

            {providerForm.authType === 'API_TOKEN' && (
              <TextField
                label={editingProvider ? 'Set / Rotate Token' : 'API Token'}
                type="password"
                value={providerForm.token}
                onChange={(e) => setProviderForm({ ...providerForm, token: e.target.value })}
                fullWidth
                placeholder={editingProvider ? 'Leave empty to keep current' : 'Bearer token'}
                helperText={
                  editingProvider?.hasToken
                    ? 'A token is currently set. Enter a new value to rotate.'
                    : undefined
                }
              />
            )}

            <TextField
              label="Custom Headers (JSON)"
              value={providerForm.customHeaders}
              onChange={(e) => setProviderForm({ ...providerForm, customHeaders: e.target.value })}
              fullWidth
              multiline
              rows={2}
              placeholder='{"X-Custom-Header": "value"}'
              helperText="Optional JSON object of extra headers (encrypted at rest)"
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
            disabled={!providerForm.displayName || !providerForm.baseUrl}
          >
            {editingProvider ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AdminToolGateway;
