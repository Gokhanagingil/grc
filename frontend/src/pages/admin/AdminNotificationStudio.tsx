import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Tabs,
  Tab,
  Paper,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  Button,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  CircularProgress,
  Alert,
  Tooltip,
  FormGroup,
  Checkbox,
  FormLabel,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  Replay as RetryIcon,
  VpnKey as SecretIcon,
  Preview as PreviewIcon,
} from '@mui/icons-material';
import { api } from '../../services/api';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div role="tabpanel" hidden={value !== index} {...other}>
      {value === index && <Box sx={{ pt: 2 }}>{children}</Box>}
    </div>
  );
}

const KNOWN_EVENTS = [
  'incident.created',
  'incident.updated',
  'incident.resolved',
  'change.created',
  'change.approved',
  'risk.created',
  'risk.updated',
  'policy.created',
  'policy.published',
  'audit.created',
  'control.failed',
  'sla.breached',
];

const CHANNELS = ['IN_APP', 'EMAIL', 'WEBHOOK'];

export const AdminNotificationStudio: React.FC = () => {
  const [tabValue, setTabValue] = useState(0);

  return (
    <Box>
      <Typography variant="h5" gutterBottom sx={{ fontWeight: 'bold' }}>
        Notification Studio
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Manage notification rules, templates, webhook endpoints, and view delivery logs.
      </Typography>

      <Paper sx={{ p: 2 }}>
        <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)}>
          <Tab label="Rules" data-testid="tab-rules" />
          <Tab label="Templates" data-testid="tab-templates" />
          <Tab label="Webhooks" data-testid="tab-webhooks" />
          <Tab label="Delivery Log" data-testid="tab-delivery-log" />
        </Tabs>

        <TabPanel value={tabValue} index={0}>
          <RulesPanel />
        </TabPanel>
        <TabPanel value={tabValue} index={1}>
          <TemplatesPanel />
        </TabPanel>
        <TabPanel value={tabValue} index={2}>
          <WebhooksPanel />
        </TabPanel>
        <TabPanel value={tabValue} index={3}>
          <DeliveryLogPanel />
        </TabPanel>
      </Paper>
    </Box>
  );
};

function RulesPanel() {
  const [rules, setRules] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null);
  const [form, setForm] = useState({
    name: '',
    eventName: '',
    channels: ['IN_APP'] as string[],
    isActive: true,
    description: '',
    templateId: '',
  });
  const [templates, setTemplates] = useState<Record<string, unknown>[]>([]);

  const loadRules = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const res = await api.get('/grc/notification-rules');
      const data = res.data?.data || res.data;
      setRules(data.items || []);
    } catch (err: unknown) {
      const e = err as { response?: { status?: number }; message?: string };
      setError(e.response?.status === 403 ? 'Access denied' : e.message || 'Failed to load rules');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadTemplates = useCallback(async () => {
    try {
      const res = await api.get('/grc/notification-templates');
      const data = res.data?.data || res.data;
      setTemplates(data.items || []);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { loadRules(); loadTemplates(); }, [loadRules, loadTemplates]);

  const handleOpen = (rule?: Record<string, unknown>) => {
    if (rule) {
      setEditing(rule);
      setForm({
        name: (rule.name as string) || '',
        eventName: (rule.eventName as string) || '',
        channels: (rule.channels as string[]) || ['IN_APP'],
        isActive: rule.isActive !== false,
        description: (rule.description as string) || '',
        templateId: (rule.templateId as string) || '',
      });
    } else {
      setEditing(null);
      setForm({ name: '', eventName: '', channels: ['IN_APP'], isActive: true, description: '', templateId: '' });
    }
    setDialogOpen(true);
  };

  const handleSave = async () => {
    try {
      const payload = {
        name: form.name,
        eventName: form.eventName,
        channels: form.channels,
        isActive: form.isActive,
        description: form.description || null,
        templateId: form.templateId || null,
        recipients: [{ type: 'ROLE', value: 'admin' }],
        condition: {},
      };
      if (editing) {
        await api.put(`/grc/notification-rules/${(editing as Record<string, unknown>).id}`, payload);
      } else {
        await api.post('/grc/notification-rules', payload);
      }
      setDialogOpen(false);
      loadRules();
    } catch (err: unknown) {
      const e = err as { message?: string };
      setError(e.message || 'Failed to save rule');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this rule?')) return;
    try {
      await api.delete(`/grc/notification-rules/${id}`);
      loadRules();
    } catch (err: unknown) {
      const e = err as { message?: string };
      setError(e.message || 'Failed to delete');
    }
  };

  if (loading) return <Box display="flex" justifyContent="center" py={4}><CircularProgress /></Box>;

  return (
    <Box>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      <Box display="flex" justifyContent="space-between" mb={2}>
        <Typography variant="subtitle1">Notification Rules ({rules.length})</Typography>
        <Box>
          <Button startIcon={<RefreshIcon />} onClick={loadRules} sx={{ mr: 1 }}>Refresh</Button>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpen()} data-testid="btn-create-rule">
            Create Rule
          </Button>
        </Box>
      </Box>

      {rules.length === 0 ? (
        <Typography color="text.secondary" textAlign="center" py={4}>No notification rules configured.</Typography>
      ) : (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Event</TableCell>
              <TableCell>Channels</TableCell>
              <TableCell>Active</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rules.map((rule) => (
              <TableRow key={rule.id as string}>
                <TableCell>{rule.name as string}</TableCell>
                <TableCell><Chip size="small" label={rule.eventName as string} /></TableCell>
                <TableCell>
                  {((rule.channels as string[]) || []).map((ch) => (
                    <Chip key={ch} size="small" label={ch} variant="outlined" sx={{ mr: 0.5 }} />
                  ))}
                </TableCell>
                <TableCell>
                  <Chip size="small" label={rule.isActive ? 'Active' : 'Inactive'} color={rule.isActive ? 'success' : 'default'} />
                </TableCell>
                <TableCell>
                  <IconButton size="small" onClick={() => handleOpen(rule)}><EditIcon fontSize="small" /></IconButton>
                  <IconButton size="small" onClick={() => handleDelete(rule.id as string)}><DeleteIcon fontSize="small" /></IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editing ? 'Edit Rule' : 'Create Rule'}</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField fullWidth label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            <FormControl fullWidth>
              <InputLabel>Event Name</InputLabel>
              <Select value={form.eventName} label="Event Name" onChange={(e) => setForm({ ...form, eventName: e.target.value })}>
                {KNOWN_EVENTS.map((ev) => <MenuItem key={ev} value={ev}>{ev}</MenuItem>)}
              </Select>
            </FormControl>
            <FormControl component="fieldset">
              <FormLabel>Channels</FormLabel>
              <FormGroup row>
                {CHANNELS.map((ch) => (
                  <FormControlLabel
                    key={ch}
                    control={
                      <Checkbox
                        checked={form.channels.includes(ch)}
                        onChange={(e) => {
                          const newCh = e.target.checked
                            ? [...form.channels, ch]
                            : form.channels.filter((c) => c !== ch);
                          setForm({ ...form, channels: newCh });
                        }}
                      />
                    }
                    label={ch}
                  />
                ))}
              </FormGroup>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel>Template</InputLabel>
              <Select value={form.templateId} label="Template" onChange={(e) => setForm({ ...form, templateId: e.target.value })}>
                <MenuItem value="">None</MenuItem>
                {templates.map((t) => <MenuItem key={t.id as string} value={t.id as string}>{t.name as string}</MenuItem>)}
              </Select>
            </FormControl>
            <TextField fullWidth label="Description" multiline rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            <FormControlLabel
              control={<Switch checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />}
              label="Active"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={!form.name || !form.eventName}>{editing ? 'Update' : 'Create'}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

function TemplatesPanel() {
  const [templates, setTemplates] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null);
  const [form, setForm] = useState({ name: '', subject: '', body: '', allowedVariables: '' });
  const [preview, setPreview] = useState('');

  const loadTemplates = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const res = await api.get('/grc/notification-templates');
      const data = res.data?.data || res.data;
      setTemplates(data.items || []);
    } catch (err: unknown) {
      const e = err as { response?: { status?: number }; message?: string };
      setError(e.response?.status === 403 ? 'Access denied' : e.message || 'Failed to load templates');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadTemplates(); }, [loadTemplates]);

  const handleOpen = (tpl?: Record<string, unknown>) => {
    if (tpl) {
      setEditing(tpl);
      setForm({
        name: (tpl.name as string) || '',
        subject: (tpl.subject as string) || '',
        body: (tpl.body as string) || '',
        allowedVariables: ((tpl.allowedVariables as string[]) || []).join(', '),
      });
    } else {
      setEditing(null);
      setForm({ name: '', subject: '', body: '', allowedVariables: '' });
    }
    setPreview('');
    setDialogOpen(true);
  };

  const handlePreview = async () => {
    try {
      const sampleData = {
        number: 'INC0001',
        short_description: 'Server down',
        priority: 'high',
        assigned_to: 'admin',
        event_name: 'incident.created',
        table_name: 'itsm_incidents',
      };
      const res = await api.post('/grc/notification-templates/preview', {
        template: form.body,
        sampleData,
      });
      const data = res.data?.data || res.data;
      setPreview(data.rendered || data.body || JSON.stringify(data));
    } catch {
      setPreview('Preview failed - check template syntax');
    }
  };

  const handleSave = async () => {
    try {
      const payload = {
        name: form.name,
        subject: form.subject || null,
        body: form.body,
        allowedVariables: form.allowedVariables ? form.allowedVariables.split(',').map((v) => v.trim()) : [],
      };
      if (editing) {
        await api.put(`/grc/notification-templates/${(editing as Record<string, unknown>).id}`, payload);
      } else {
        await api.post('/grc/notification-templates', payload);
      }
      setDialogOpen(false);
      loadTemplates();
    } catch (err: unknown) {
      const e = err as { message?: string };
      setError(e.message || 'Failed to save template');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this template?')) return;
    try {
      await api.delete(`/grc/notification-templates/${id}`);
      loadTemplates();
    } catch (err: unknown) {
      const e = err as { message?: string };
      setError(e.message || 'Failed to delete');
    }
  };

  if (loading) return <Box display="flex" justifyContent="center" py={4}><CircularProgress /></Box>;

  return (
    <Box>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      <Box display="flex" justifyContent="space-between" mb={2}>
        <Typography variant="subtitle1">Templates ({templates.length})</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpen()} data-testid="btn-create-template">
          Create Template
        </Button>
      </Box>

      {templates.length === 0 ? (
        <Typography color="text.secondary" textAlign="center" py={4}>No templates configured.</Typography>
      ) : (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Subject</TableCell>
              <TableCell>Variables</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {templates.map((tpl) => (
              <TableRow key={tpl.id as string}>
                <TableCell>{tpl.name as string}</TableCell>
                <TableCell>{(tpl.subject as string) || '-'}</TableCell>
                <TableCell>{((tpl.allowedVariables as string[]) || []).length}</TableCell>
                <TableCell>
                  <IconButton size="small" onClick={() => handleOpen(tpl)}><EditIcon fontSize="small" /></IconButton>
                  <IconButton size="small" onClick={() => handleDelete(tpl.id as string)}><DeleteIcon fontSize="small" /></IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>{editing ? 'Edit Template' : 'Create Template'}</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField fullWidth label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            <TextField fullWidth label="Subject" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
            <TextField
              fullWidth
              label="Body Template"
              multiline
              rows={6}
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
              helperText="Use {{variable}} for template variables. e.g. Incident {{number}}: {{short_description}}"
            />
            <TextField
              fullWidth
              label="Allowed Variables"
              value={form.allowedVariables}
              onChange={(e) => setForm({ ...form, allowedVariables: e.target.value })}
              helperText="Comma-separated list, e.g.: number, short_description, priority"
            />
            <Box display="flex" gap={1}>
              <Button startIcon={<PreviewIcon />} onClick={handlePreview}>Preview</Button>
            </Box>
            {preview && (
              <Paper variant="outlined" sx={{ p: 2, bgcolor: 'grey.50' }}>
                <Typography variant="caption" color="text.secondary" display="block" gutterBottom>Preview:</Typography>
                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{preview}</Typography>
              </Paper>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={!form.name || !form.body}>{editing ? 'Update' : 'Create'}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

function WebhooksPanel() {
  const [endpoints, setEndpoints] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null);
  const [form, setForm] = useState({ name: '', url: '', isActive: false, description: '', headersJson: '{}' });

  const loadEndpoints = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const res = await api.get('/grc/webhook-endpoints');
      const data = res.data?.data || res.data;
      setEndpoints(data.items || []);
    } catch (err: unknown) {
      const e = err as { response?: { status?: number }; message?: string };
      setError(e.response?.status === 403 ? 'Access denied' : e.message || 'Failed to load webhook endpoints');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadEndpoints(); }, [loadEndpoints]);

  const handleOpen = (ep?: Record<string, unknown>) => {
    if (ep) {
      setEditing(ep);
      setForm({
        name: (ep.name as string) || '',
        url: (ep.url as string) || '',
        isActive: ep.isActive === true,
        description: (ep.description as string) || '',
        headersJson: JSON.stringify(ep.headers || {}, null, 2),
      });
    } else {
      setEditing(null);
      setForm({ name: '', url: '', isActive: false, description: '', headersJson: '{}' });
    }
    setDialogOpen(true);
  };

  const handleSave = async () => {
    try {
      let headers = {};
      try { headers = JSON.parse(form.headersJson); } catch { /* ignore */ }
      const payload = {
        name: form.name,
        url: form.url,
        isActive: form.isActive,
        description: form.description || null,
        headers,
      };
      if (editing) {
        await api.put(`/grc/webhook-endpoints/${(editing as Record<string, unknown>).id}`, payload);
      } else {
        await api.post('/grc/webhook-endpoints', payload);
      }
      setDialogOpen(false);
      loadEndpoints();
    } catch (err: unknown) {
      const e = err as { message?: string };
      setError(e.message || 'Failed to save webhook endpoint');
    }
  };

  const handleRotateSecret = async (id: string) => {
    if (!window.confirm('Rotate the webhook secret? The old secret will be invalidated.')) return;
    try {
      const res = await api.post(`/grc/webhook-endpoints/${id}/rotate-secret`);
      const data = res.data?.data || res.data;
      alert(`New secret: ${data.secret}\n\nCopy this now - it won't be shown again.`);
      loadEndpoints();
    } catch (err: unknown) {
      const e = err as { message?: string };
      setError(e.message || 'Failed to rotate secret');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this webhook endpoint?')) return;
    try {
      await api.delete(`/grc/webhook-endpoints/${id}`);
      loadEndpoints();
    } catch (err: unknown) {
      const e = err as { message?: string };
      setError(e.message || 'Failed to delete');
    }
  };

  const handleToggleActive = async (ep: Record<string, unknown>) => {
    try {
      await api.put(`/grc/webhook-endpoints/${ep.id}`, { isActive: !ep.isActive });
      loadEndpoints();
    } catch (err: unknown) {
      const e = err as { message?: string };
      setError(e.message || 'Failed to toggle');
    }
  };

  if (loading) return <Box display="flex" justifyContent="center" py={4}><CircularProgress /></Box>;

  return (
    <Box>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      <Box display="flex" justifyContent="space-between" mb={2}>
        <Typography variant="subtitle1">Webhook Endpoints ({endpoints.length})</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpen()} data-testid="btn-create-webhook">
          Add Endpoint
        </Button>
      </Box>

      {endpoints.length === 0 ? (
        <Typography color="text.secondary" textAlign="center" py={4}>No webhook endpoints configured.</Typography>
      ) : (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>URL</TableCell>
              <TableCell>Active</TableCell>
              <TableCell>Last Triggered</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {endpoints.map((ep) => (
              <TableRow key={ep.id as string}>
                <TableCell>{ep.name as string}</TableCell>
                <TableCell>
                  <Tooltip title={ep.url as string}>
                    <Typography variant="body2" noWrap sx={{ maxWidth: 300 }}>
                      {ep.url as string}
                    </Typography>
                  </Tooltip>
                </TableCell>
                <TableCell>
                  <Switch size="small" checked={ep.isActive === true} onChange={() => handleToggleActive(ep)} />
                </TableCell>
                <TableCell>
                  {(ep.lastTriggeredAt as string) ? new Date(ep.lastTriggeredAt as string).toLocaleString() : 'Never'}
                </TableCell>
                <TableCell>
                  <IconButton size="small" onClick={() => handleOpen(ep)}><EditIcon fontSize="small" /></IconButton>
                  <Tooltip title="Rotate Secret">
                    <IconButton size="small" onClick={() => handleRotateSecret(ep.id as string)}><SecretIcon fontSize="small" /></IconButton>
                  </Tooltip>
                  <IconButton size="small" onClick={() => handleDelete(ep.id as string)}><DeleteIcon fontSize="small" /></IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editing ? 'Edit Webhook Endpoint' : 'Add Webhook Endpoint'}</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField fullWidth label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            <TextField fullWidth label="URL" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} required placeholder="https://example.com/webhooks/grc" />
            <TextField fullWidth label="Description" multiline rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            <TextField
              fullWidth
              label="Custom Headers (JSON)"
              multiline
              rows={3}
              value={form.headersJson}
              onChange={(e) => setForm({ ...form, headersJson: e.target.value })}
              helperText='e.g. {"X-Custom-Header": "value"}'
            />
            <FormControlLabel
              control={<Switch checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />}
              label="Active"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={!form.name || !form.url}>{editing ? 'Update' : 'Create'}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

function DeliveryLogPanel() {
  const [deliveries, setDeliveries] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [channelFilter, setChannelFilter] = useState('');

  const loadDeliveries = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const params: Record<string, string> = {};
      if (statusFilter) params.status = statusFilter;
      if (channelFilter) params.channel = channelFilter;
      const res = await api.get('/grc/notification-deliveries', { params });
      const data = res.data?.data || res.data;
      setDeliveries(data.items || []);
    } catch (err: unknown) {
      const e = err as { response?: { status?: number }; message?: string };
      setError(e.response?.status === 403 ? 'Access denied' : e.message || 'Failed to load delivery log');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, channelFilter]);

  useEffect(() => { loadDeliveries(); }, [loadDeliveries]);

  const handleRetry = async (id: string) => {
    try {
      await api.post(`/grc/notification-deliveries/${id}/retry`);
      loadDeliveries();
    } catch (err: unknown) {
      const e = err as { message?: string };
      setError(e.message || 'Retry failed');
    }
  };

  const statusColor = (status: string) => {
    switch (status) {
      case 'SENT': return 'success';
      case 'FAILED': return 'error';
      case 'PENDING': return 'warning';
      case 'RATE_LIMITED': return 'info';
      default: return 'default';
    }
  };

  if (loading) return <Box display="flex" justifyContent="center" py={4}><CircularProgress /></Box>;

  return (
    <Box>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      <Box display="flex" gap={2} mb={2} alignItems="center">
        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel>Status</InputLabel>
          <Select value={statusFilter} label="Status" onChange={(e) => setStatusFilter(e.target.value)}>
            <MenuItem value="">All</MenuItem>
            <MenuItem value="SENT">Sent</MenuItem>
            <MenuItem value="FAILED">Failed</MenuItem>
            <MenuItem value="PENDING">Pending</MenuItem>
            <MenuItem value="RATE_LIMITED">Rate Limited</MenuItem>
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel>Channel</InputLabel>
          <Select value={channelFilter} label="Channel" onChange={(e) => setChannelFilter(e.target.value)}>
            <MenuItem value="">All</MenuItem>
            {CHANNELS.map((ch) => <MenuItem key={ch} value={ch}>{ch}</MenuItem>)}
          </Select>
        </FormControl>
        <Button startIcon={<RefreshIcon />} onClick={loadDeliveries}>Refresh</Button>
      </Box>

      {deliveries.length === 0 ? (
        <Typography color="text.secondary" textAlign="center" py={4}>No delivery records found.</Typography>
      ) : (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Time</TableCell>
              <TableCell>Channel</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Recipient</TableCell>
              <TableCell>Event</TableCell>
              <TableCell>Error</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {deliveries.map((d) => {
              const snapshot = (d.payloadSnapshot || {}) as Record<string, unknown>;
              return (
                <TableRow key={d.id as string}>
                  <TableCell>{d.createdAt ? new Date(d.createdAt as string).toLocaleString() : '-'}</TableCell>
                  <TableCell><Chip size="small" label={d.channel as string} variant="outlined" /></TableCell>
                  <TableCell>
                    <Chip size="small" label={d.status as string} color={statusColor(d.status as string) as 'success' | 'error' | 'warning' | 'info' | 'default'} />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" noWrap sx={{ maxWidth: 200 }}>
                      {(d.recipient as string) || '-'}
                    </Typography>
                  </TableCell>
                  <TableCell>{(snapshot.eventName as string) || '-'}</TableCell>
                  <TableCell>
                    <Typography variant="body2" noWrap sx={{ maxWidth: 200 }} color="error">
                      {(d.lastError as string) || '-'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {d.status === 'FAILED' && (
                      <Tooltip title="Retry">
                        <IconButton size="small" onClick={() => handleRetry(d.id as string)}>
                          <RetryIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </Box>
  );
}

export default AdminNotificationStudio;
