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
  Switch,
  FormControlLabel,
  CircularProgress,
  Alert,
  Tooltip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  VpnKey as KeyIcon,
  ContentCopy as CopyIcon,
  PlayArrow as PlayIcon,
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

export const AdminApiCatalog: React.FC = () => {
  const [tabValue, setTabValue] = useState(0);

  return (
    <Box>
      <Typography variant="h5" gutterBottom sx={{ fontWeight: 'bold' }}>
        API Catalog
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Publish APIs, manage API keys, and explore the OpenAPI specification.
      </Typography>

      <Paper sx={{ p: 2 }}>
        <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)}>
          <Tab label="Published APIs" data-testid="tab-published-apis" />
          <Tab label="API Keys" data-testid="tab-api-keys" />
          <Tab label="OpenAPI" data-testid="tab-openapi" />
          <Tab label="Try It" data-testid="tab-try-it" />
        </Tabs>

        <TabPanel value={tabValue} index={0}>
          <PublishedApisPanel />
        </TabPanel>
        <TabPanel value={tabValue} index={1}>
          <ApiKeysPanel />
        </TabPanel>
        <TabPanel value={tabValue} index={2}>
          <OpenApiPanel />
        </TabPanel>
        <TabPanel value={tabValue} index={3}>
          <TryItPanel />
        </TabPanel>
      </Paper>
    </Box>
  );
};

function PublishedApisPanel() {
  const [apis, setApis] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null);
  const [form, setForm] = useState({
    name: '',
    tableName: '',
    readFields: '',
    writeFields: '',
    allowList: true,
    allowCreate: false,
    allowUpdate: false,
    filterPolicy: '{}',
    rateLimitPerMinute: 60,
    description: '',
  });

  const loadApis = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const res = await api.get('/grc/published-apis');
      const data = res.data?.data || res.data;
      setApis(data.items || []);
    } catch (err: unknown) {
      const e = err as { response?: { status?: number }; message?: string };
      setError(e.response?.status === 403 ? 'Access denied' : e.message || 'Failed to load APIs');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadApis(); }, [loadApis]);

  const handleOpen = (item?: Record<string, unknown>) => {
    if (item) {
      setEditing(item);
      const af = (item.allowedFields || { read: [], write: [] }) as { read: string[]; write: string[] };
      setForm({
        name: (item.name as string) || '',
        tableName: (item.tableName as string) || '',
        readFields: (af.read || []).join(', '),
        writeFields: (af.write || []).join(', '),
        allowList: item.allowList !== false,
        allowCreate: item.allowCreate === true,
        allowUpdate: item.allowUpdate === true,
        filterPolicy: JSON.stringify(item.filterPolicy || {}, null, 2),
        rateLimitPerMinute: (item.rateLimitPerMinute as number) || 60,
        description: (item.description as string) || '',
      });
    } else {
      setEditing(null);
      setForm({
        name: '', tableName: '', readFields: '', writeFields: '',
        allowList: true, allowCreate: false, allowUpdate: false,
        filterPolicy: '{}', rateLimitPerMinute: 60, description: '',
      });
    }
    setDialogOpen(true);
  };

  const handleSave = async () => {
    try {
      let filterPolicy = {};
      try { filterPolicy = JSON.parse(form.filterPolicy); } catch { /* ignore */ }
      const payload = {
        name: form.name,
        tableName: form.tableName,
        allowedFields: {
          read: form.readFields ? form.readFields.split(',').map((f) => f.trim()) : [],
          write: form.writeFields ? form.writeFields.split(',').map((f) => f.trim()) : [],
        },
        allowList: form.allowList,
        allowCreate: form.allowCreate,
        allowUpdate: form.allowUpdate,
        filterPolicy,
        rateLimitPerMinute: form.rateLimitPerMinute,
        description: form.description || null,
      };
      if (editing) {
        await api.put(`/grc/published-apis/${(editing as Record<string, unknown>).id}`, payload);
      } else {
        await api.post('/grc/published-apis', payload);
      }
      setDialogOpen(false);
      loadApis();
    } catch (err: unknown) {
      const e = err as { message?: string };
      setError(e.message || 'Failed to save');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this published API?')) return;
    try {
      await api.delete(`/grc/published-apis/${id}`);
      loadApis();
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
        <Typography variant="subtitle1">Published APIs ({apis.length})</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpen()} data-testid="btn-create-api">
          Publish API
        </Button>
      </Box>

      {apis.length === 0 ? (
        <Typography color="text.secondary" textAlign="center" py={4}>No published APIs yet.</Typography>
      ) : (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Table</TableCell>
              <TableCell>Operations</TableCell>
              <TableCell>Rate Limit</TableCell>
              <TableCell>Active</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {apis.map((item) => (
              <TableRow key={item.id as string}>
                <TableCell>{item.name as string}</TableCell>
                <TableCell><Chip size="small" label={item.tableName as string} variant="outlined" /></TableCell>
                <TableCell>
                  {item.allowList as boolean && <Chip size="small" label="List" color="primary" sx={{ mr: 0.5 }} />}
                  {item.allowCreate as boolean && <Chip size="small" label="Create" color="success" sx={{ mr: 0.5 }} />}
                  {item.allowUpdate as boolean && <Chip size="small" label="Update" color="warning" sx={{ mr: 0.5 }} />}
                </TableCell>
                <TableCell>{(item.rateLimitPerMinute as number) || 60}/min</TableCell>
                <TableCell>
                  <Chip size="small" label={item.isActive !== false ? 'Active' : 'Inactive'} color={item.isActive !== false ? 'success' : 'default'} />
                </TableCell>
                <TableCell>
                  <IconButton size="small" onClick={() => handleOpen(item)}><EditIcon fontSize="small" /></IconButton>
                  <IconButton size="small" onClick={() => handleDelete(item.id as string)}><DeleteIcon fontSize="small" /></IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>{editing ? 'Edit Published API' : 'Publish API'}</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField fullWidth label="API Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required helperText="URL-friendly name, e.g. incidents" />
            <TextField fullWidth label="Table Name" value={form.tableName} onChange={(e) => setForm({ ...form, tableName: e.target.value })} required helperText="Database table to expose, e.g. itsm_incidents" />
            <TextField fullWidth label="Read Fields" value={form.readFields} onChange={(e) => setForm({ ...form, readFields: e.target.value })} helperText="Comma-separated fields to return, e.g. id, number, short_description, state" />
            <TextField fullWidth label="Write Fields" value={form.writeFields} onChange={(e) => setForm({ ...form, writeFields: e.target.value })} helperText="Comma-separated fields allowed for create/update" />
            <Box display="flex" gap={2} flexWrap="wrap">
              <FormControlLabel control={<Switch checked={form.allowList} onChange={(e) => setForm({ ...form, allowList: e.target.checked })} />} label="Allow List (GET)" />
              <FormControlLabel control={<Switch checked={form.allowCreate} onChange={(e) => setForm({ ...form, allowCreate: e.target.checked })} />} label="Allow Create (POST)" />
              <FormControlLabel control={<Switch checked={form.allowUpdate} onChange={(e) => setForm({ ...form, allowUpdate: e.target.checked })} />} label="Allow Update (PUT)" />
            </Box>
            <TextField fullWidth label="Filter Policy (JSON)" multiline rows={3} value={form.filterPolicy} onChange={(e) => setForm({ ...form, filterPolicy: e.target.value })} helperText='Fixed filters, e.g. {"state": {"eq": "active"}}' />
            <TextField fullWidth label="Rate Limit (per minute)" type="number" value={form.rateLimitPerMinute} onChange={(e) => setForm({ ...form, rateLimitPerMinute: parseInt(e.target.value, 10) || 60 })} />
            <TextField fullWidth label="Description" multiline rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={!form.name || !form.tableName}>{editing ? 'Update' : 'Publish'}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

function ApiKeysPanel() {
  const [keys, setKeys] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ name: '', scopes: '', expiresAt: '' });
  const [newKey, setNewKey] = useState('');

  const loadKeys = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const res = await api.get('/grc/api-keys');
      const data = res.data?.data || res.data;
      setKeys(data.items || []);
    } catch (err: unknown) {
      const e = err as { response?: { status?: number }; message?: string };
      setError(e.response?.status === 403 ? 'Access denied' : e.message || 'Failed to load API keys');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadKeys(); }, [loadKeys]);

  const handleCreate = async () => {
    try {
      const payload = {
        name: form.name,
        scopes: form.scopes ? form.scopes.split(',').map((s) => s.trim()) : [],
        expiresAt: form.expiresAt || undefined,
      };
      const res = await api.post('/grc/api-keys', payload);
      const data = res.data?.data || res.data;
      setNewKey(data.rawKey || data.key || '');
      setDialogOpen(false);
      loadKeys();
    } catch (err: unknown) {
      const e = err as { message?: string };
      setError(e.message || 'Failed to create key');
    }
  };

  const handleRevoke = async (id: string) => {
    if (!window.confirm('Revoke this API key?')) return;
    try {
      await api.put(`/grc/api-keys/${id}`, { isActive: false });
      loadKeys();
    } catch (err: unknown) {
      const e = err as { message?: string };
      setError(e.message || 'Failed to revoke key');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Permanently delete this API key?')) return;
    try {
      await api.delete(`/grc/api-keys/${id}`);
      loadKeys();
    } catch (err: unknown) {
      const e = err as { message?: string };
      setError(e.message || 'Failed to delete key');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
  };

  if (loading) return <Box display="flex" justifyContent="center" py={4}><CircularProgress /></Box>;

  return (
    <Box>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {newKey && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setNewKey('')}>
          <Typography variant="subtitle2">API Key Created (copy now - shown only once):</Typography>
          <Box display="flex" alignItems="center" gap={1} mt={1}>
            <Typography variant="body2" fontFamily="monospace" sx={{ wordBreak: 'break-all' }}>{newKey}</Typography>
            <IconButton size="small" onClick={() => copyToClipboard(newKey)}><CopyIcon fontSize="small" /></IconButton>
          </Box>
        </Alert>
      )}

      <Box display="flex" justifyContent="space-between" mb={2}>
        <Typography variant="subtitle1">API Keys ({keys.length})</Typography>
        <Button variant="contained" startIcon={<KeyIcon />} onClick={() => { setForm({ name: '', scopes: '', expiresAt: '' }); setDialogOpen(true); }} data-testid="btn-create-key">
          Create Key
        </Button>
      </Box>

      {keys.length === 0 ? (
        <Typography color="text.secondary" textAlign="center" py={4}>No API keys created.</Typography>
      ) : (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Key Prefix</TableCell>
              <TableCell>Scopes</TableCell>
              <TableCell>Active</TableCell>
              <TableCell>Last Used</TableCell>
              <TableCell>Expires</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {keys.map((k) => (
              <TableRow key={k.id as string}>
                <TableCell>{k.name as string}</TableCell>
                <TableCell><Typography variant="body2" fontFamily="monospace">{(k.keyPrefix as string) || '****'}...</Typography></TableCell>
                <TableCell>
                  {((k.scopes as string[]) || []).map((s) => (
                    <Chip key={s} size="small" label={s} variant="outlined" sx={{ mr: 0.5 }} />
                  ))}
                </TableCell>
                <TableCell>
                  <Chip size="small" label={k.isActive ? 'Active' : 'Revoked'} color={k.isActive ? 'success' : 'error'} />
                </TableCell>
                <TableCell>{k.lastUsedAt ? new Date(k.lastUsedAt as string).toLocaleString() : 'Never'}</TableCell>
                <TableCell>{k.expiresAt ? new Date(k.expiresAt as string).toLocaleDateString() : 'No expiry'}</TableCell>
                <TableCell>
                  {k.isActive as boolean && (
                    <Tooltip title="Revoke">
                      <IconButton size="small" onClick={() => handleRevoke(k.id as string)}><KeyIcon fontSize="small" color="error" /></IconButton>
                    </Tooltip>
                  )}
                  <IconButton size="small" onClick={() => handleDelete(k.id as string)}><DeleteIcon fontSize="small" /></IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create API Key</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField fullWidth label="Key Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            <TextField fullWidth label="Scopes" value={form.scopes} onChange={(e) => setForm({ ...form, scopes: e.target.value })} helperText="Comma-separated, e.g. incidents:read, incidents:write" />
            <TextField fullWidth label="Expires At" type="date" value={form.expiresAt} onChange={(e) => setForm({ ...form, expiresAt: e.target.value })} InputLabelProps={{ shrink: true }} helperText="Leave empty for no expiry" />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleCreate} disabled={!form.name}>Create</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

function OpenApiPanel() {
  const [apis, setApis] = useState<Record<string, unknown>[]>([]);
  const [selectedApi, setSelectedApi] = useState('');
  const [spec, setSpec] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get('/grc/published-apis');
        const data = res.data?.data || res.data;
        setApis(data.items || []);
      } catch { /* ignore */ }
    })();
  }, []);

  const loadSpec = async (apiName: string) => {
    setSelectedApi(apiName);
    try {
      setLoading(true);
      setError('');
      const res = await api.get(`/grc/public/v1/${apiName}/openapi.json`);
      const data = res.data?.data || res.data;
      setSpec(JSON.stringify(data, null, 2));
    } catch (err: unknown) {
      const e = err as { message?: string };
      setError(e.message || 'Failed to load spec');
      setSpec('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      <Box display="flex" gap={2} mb={2} alignItems="center">
        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel>Select API</InputLabel>
          <Select value={selectedApi} label="Select API" onChange={(e) => loadSpec(e.target.value)}>
            {apis.map((a) => <MenuItem key={a.id as string} value={a.name as string}>{a.name as string}</MenuItem>)}
          </Select>
        </FormControl>
        {selectedApi && (
          <Typography variant="body2" color="text.secondary">
            Endpoint: /api/grc/public/v1/{selectedApi}/records
          </Typography>
        )}
      </Box>

      {loading ? (
        <Box display="flex" justifyContent="center" py={4}><CircularProgress /></Box>
      ) : spec ? (
        <Paper variant="outlined" sx={{ p: 2, bgcolor: 'grey.900', color: 'grey.100', fontFamily: 'monospace', fontSize: '0.8rem', whiteSpace: 'pre-wrap', maxHeight: 500, overflow: 'auto' }}>
          {spec}
        </Paper>
      ) : (
        <Typography color="text.secondary" textAlign="center" py={4}>Select a published API to view its OpenAPI specification.</Typography>
      )}
    </Box>
  );
}

function TryItPanel() {
  const [apiKey, setApiKey] = useState('');
  const [apiName, setApiName] = useState('');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);
  const [apis, setApis] = useState<Record<string, unknown>[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get('/grc/published-apis');
        const data = res.data?.data || res.data;
        setApis(data.items || []);
      } catch { /* ignore */ }
    })();
  }, []);

  const curlSnippet = apiName && apiKey
    ? `curl -X GET "${window.location.origin}/api/grc/public/v1/${apiName}/records" \\\n  -H "X-API-Key: ${apiKey}"`
    : '';

  const handleTryIt = async () => {
    if (!apiName || !apiKey) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/grc/public/v1/${apiName}/records`, {
        headers: { 'X-API-Key': apiKey },
      });
      const data = await res.json();
      setResult(JSON.stringify(data, null, 2));
    } catch (err: unknown) {
      const e = err as { message?: string };
      setResult(`Error: ${e.message || 'Request failed'}`);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
  };

  return (
    <Box>
      <Box display="flex" flexDirection="column" gap={2}>
        <FormControl fullWidth size="small">
          <InputLabel>API Name</InputLabel>
          <Select value={apiName} label="API Name" onChange={(e) => setApiName(e.target.value)}>
            {apis.map((a) => <MenuItem key={a.id as string} value={a.name as string}>{a.name as string}</MenuItem>)}
          </Select>
        </FormControl>
        <TextField fullWidth size="small" label="X-API-Key" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="grc_..." type="password" />

        {curlSnippet && (
          <Box>
            <Box display="flex" justifyContent="space-between" alignItems="center">
              <Typography variant="caption" color="text.secondary">curl snippet:</Typography>
              <IconButton size="small" onClick={() => copyToClipboard(curlSnippet)}><CopyIcon fontSize="small" /></IconButton>
            </Box>
            <Paper variant="outlined" sx={{ p: 1.5, bgcolor: 'grey.900', color: 'grey.100', fontFamily: 'monospace', fontSize: '0.75rem', whiteSpace: 'pre-wrap' }}>
              {curlSnippet}
            </Paper>
          </Box>
        )}

        <Button variant="contained" startIcon={loading ? <CircularProgress size={16} /> : <PlayIcon />} onClick={handleTryIt} disabled={!apiName || !apiKey || loading}>
          Send Request
        </Button>

        {result && (
          <Paper variant="outlined" sx={{ p: 2, bgcolor: 'grey.50', fontFamily: 'monospace', fontSize: '0.8rem', whiteSpace: 'pre-wrap', maxHeight: 400, overflow: 'auto' }}>
            {result}
          </Paper>
        )}
      </Box>
    </Box>
  );
}

export default AdminApiCatalog;
