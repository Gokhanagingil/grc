import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  IconButton,
  Switch,
  FormControlLabel,
  Alert,
  CircularProgress,
  Tabs,
  Tab,
  Divider,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Tooltip,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ScienceIcon from '@mui/icons-material/Science';
import { itsmApi, unwrapArrayResponse } from '../../../services/grcClient';
import {
  SlaConditionBuilder,
  ConditionNode,
  FieldRegistryEntry,
} from '../../../components/itsm/SlaConditionBuilder';

// ── Types ──────────────────────────────────────────────────────────────

interface SlaDefinition {
  id: string;
  name: string;
  description: string | null;
  metric: string;
  targetSeconds: number;
  schedule: string;
  businessStartHour: number;
  businessEndHour: number;
  businessDays: number[];
  priorityFilter: string[] | null;
  serviceIdFilter: string | null;
  stopOnStates: string[];
  pauseOnStates: string[] | null;
  isActive: boolean;
  order: number;
  createdAt: string;
  updatedAt: string;
  // SLA Engine 2.0 fields
  appliesToRecordType?: string | null;
  conditionTree?: ConditionNode | null;
  responseTimeSeconds?: number | null;
  resolutionTimeSeconds?: number | null;
  priorityWeight?: number | null;
  stopProcessing?: boolean;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
  version?: number;
}

// ── Constants ──────────────────────────────────────────────────────────

const METRIC_OPTIONS = [
  { value: 'RESPONSE_TIME', label: 'Response Time' },
  { value: 'RESOLUTION_TIME', label: 'Resolution Time' },
];

const SCHEDULE_OPTIONS = [
  { value: '24X7', label: '24x7' },
  { value: 'BUSINESS_HOURS', label: 'Business Hours' },
];

const RECORD_TYPE_OPTIONS = [
  { value: 'INCIDENT', label: 'Incident' },
  { value: 'CHANGE', label: 'Change' },
  { value: 'PROBLEM', label: 'Problem' },
  { value: 'REQUEST', label: 'Request' },
];

/** Known enum options for SLA condition fields (backend registry does not expose these). */
const SLA_FIELD_OPTIONS: Record<string, string[]> = {
  priority: ['P1', 'P2', 'P3', 'P4'],
  impact: ['HIGH', 'MEDIUM', 'LOW'],
  urgency: ['HIGH', 'MEDIUM', 'LOW'],
  category: ['HARDWARE', 'SOFTWARE', 'NETWORK', 'DATABASE', 'SECURITY', 'ACCESS', 'OTHER'],
  source: ['EMAIL', 'PHONE', 'WEB', 'CHAT', 'API', 'MONITORING', 'SELF_SERVICE'],
  status: ['NEW', 'IN_PROGRESS', 'ON_HOLD', 'RESOLVED', 'CLOSED', 'CANCELLED'],
};

const PRIORITY_OPTIONS = ['p1', 'p2', 'p3', 'p4'];
const STATE_OPTIONS = ['open', 'in_progress', 'assigned', 'resolved', 'closed', 'on_hold', 'pending'];

const emptySla = {
  name: '',
  description: '',
  metric: 'RESOLUTION_TIME',
  targetSeconds: 14400,
  schedule: '24X7',
  businessStartHour: 9,
  businessEndHour: 17,
  businessDays: [1, 2, 3, 4, 5],
  priorityFilter: [] as string[],
  stopOnStates: ['resolved', 'closed'],
  pauseOnStates: [] as string[],
  isActive: true,
  order: 0,
  // v2
  appliesToRecordType: 'INCIDENT',
  conditionTree: null as ConditionNode | null,
  responseTimeSeconds: null as number | null,
  resolutionTimeSeconds: null as number | null,
  priorityWeight: 0,
  stopProcessing: false,
  effectiveFrom: '',
  effectiveTo: '',
};

// ── Helpers ────────────────────────────────────────────────────────────

function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null || seconds === 0) return '\u2014';
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (hours > 0 && mins > 0) return `${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h`;
  return `${mins}m`;
}

function isV2Policy(def: SlaDefinition): boolean {
  return (def.version ?? 0) >= 2 || def.conditionTree != null || def.responseTimeSeconds != null;
}

function targetsSummary(def: SlaDefinition): string {
  if (isV2Policy(def)) {
    const parts: string[] = [];
    if (def.responseTimeSeconds) parts.push(`Resp: ${formatDuration(def.responseTimeSeconds)}`);
    if (def.resolutionTimeSeconds) parts.push(`Res: ${formatDuration(def.resolutionTimeSeconds)}`);
    return parts.length > 0 ? parts.join(' / ') : formatDuration(def.targetSeconds);
  }
  return formatDuration(def.targetSeconds);
}

// ── Tab Panel ──────────────────────────────────────────────────────────

interface TabPanelProps { children?: React.ReactNode; index: number; value: number; }
const TabPanel: React.FC<TabPanelProps> = ({ children, value, index }) => (
  <div role="tabpanel" hidden={value !== index} style={{ paddingTop: 16 }}>
    {value === index && children}
  </div>
);

// ── Evaluate Panel ─────────────────────────────────────────────────────

interface EvaluateResult {
  matched: boolean;
  selectedPolicyId?: string | null;
  selectedPolicyName?: string | null;
  matchReason?: string;
  responseTimeSeconds?: number | null;
  resolutionTimeSeconds?: number | null;
  evaluatedCount?: number;
  evaluationDetails?: Array<{ policyId: string; policyName: string; matched: boolean; reason?: string }>;
}

const EvaluatePanel: React.FC = () => {
  const [context, setContext] = useState('{\n  "priority": "P1",\n  "impact": "HIGH",\n  "serviceId": ""\n}');
  const [recordType, setRecordType] = useState('INCIDENT');
  const [result, setResult] = useState<EvaluateResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleEvaluate = async () => {
    try {
      setLoading(true);
      setError(null);
      const parsed = JSON.parse(context);
      const response = await itsmApi.sla.evaluate({
        recordType,
        context: parsed,
      });
      const data = (response as { data?: EvaluateResult }).data;
      setResult(data ?? null);
    } catch (err) {
      if (err instanceof SyntaxError) {
        setError('Invalid JSON in context field');
      } else {
        setError('Evaluation failed. Check console for details.');
        console.error(err);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box>
      <Typography variant="subtitle1" gutterBottom>
        Test SLA Policy Matching
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Paste a record context (JSON) and see which SLA policy would match.
      </Typography>

      <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel>Record Type</InputLabel>
          <Select value={recordType} label="Record Type" onChange={(e) => setRecordType(e.target.value)}>
            {RECORD_TYPE_OPTIONS.map((rt) => (<MenuItem key={rt.value} value={rt.value}>{rt.label}</MenuItem>))}
          </Select>
        </FormControl>
        <Button variant="contained" startIcon={<ScienceIcon />} onClick={handleEvaluate} disabled={loading}>
          {loading ? 'Evaluating...' : 'Evaluate'}
        </Button>
      </Box>

      <TextField
        multiline
        rows={6}
        fullWidth
        label="Record Context (JSON)"
        value={context}
        onChange={(e) => setContext(e.target.value)}
        sx={{ mb: 2, fontFamily: 'monospace' }}
        inputProps={{ style: { fontFamily: 'monospace', fontSize: 13 } }}
      />

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {result && (
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <Chip
              label={result.matched ? 'MATCHED' : 'NO MATCH'}
              color={result.matched ? 'success' : 'default'}
              size="small"
            />
            {result.evaluatedCount != null && (
              <Typography variant="caption" color="text.secondary">
                Evaluated {result.evaluatedCount} policies
              </Typography>
            )}
          </Box>

          {result.matched && (
            <Box sx={{ mb: 1 }}>
              <Typography variant="body2">
                <strong>Matched Policy:</strong> {result.selectedPolicyName ?? result.selectedPolicyId ?? '\u2014'}
              </Typography>
              {result.responseTimeSeconds != null && (
                <Typography variant="body2">Response: {formatDuration(result.responseTimeSeconds)}</Typography>
              )}
              {result.resolutionTimeSeconds != null && (
                <Typography variant="body2">Resolution: {formatDuration(result.resolutionTimeSeconds)}</Typography>
              )}
            </Box>
          )}

          {result.matchReason && (
            <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: 12, mt: 1 }}>
              {result.matchReason}
            </Typography>
          )}

          {result.evaluationDetails && result.evaluationDetails.length > 0 && (
            <Accordion sx={{ mt: 1 }}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="body2">Evaluation Details ({result.evaluationDetails.length})</Typography>
              </AccordionSummary>
              <AccordionDetails>
                {result.evaluationDetails.map((d, i) => (
                  <Box key={i} sx={{ display: 'flex', gap: 1, mb: 0.5, alignItems: 'center' }}>
                    <Chip label={d.matched ? 'Match' : 'Skip'} size="small" color={d.matched ? 'success' : 'default'} variant="outlined" />
                    <Typography variant="body2">{d.policyName}</Typography>
                    {d.reason && <Typography variant="caption" color="text.secondary">{d.reason}</Typography>}
                  </Box>
                ))}
              </AccordionDetails>
            </Accordion>
          )}
        </Paper>
      )}
    </Box>
  );
};

// ── Main Component ─────────────────────────────────────────────────────

export const ItsmStudioSla: React.FC = () => {
  const [definitions, setDefinitions] = useState<SlaDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptySla);
  const [saving, setSaving] = useState(false);
  const [targetHours, setTargetHours] = useState(4);
  const [targetMins, setTargetMins] = useState(0);
  const [tab, setTab] = useState(0);
  const [dialogTab, setDialogTab] = useState(0);
  const [fieldRegistry, setFieldRegistry] = useState<FieldRegistryEntry[]>([]);
  // v2 target input helpers
  const [responseH, setResponseH] = useState(0);
  const [responseM, setResponseM] = useState(0);
  const [resolutionH, setResolutionH] = useState(0);
  const [resolutionM, setResolutionM] = useState(0);

  const loadDefinitions = useCallback(async () => {
    try {
      setLoading(true);
      const response = await itsmApi.sla.listDefinitions();
      const items = unwrapArrayResponse<SlaDefinition>(response);
      setDefinitions(items);
      setError(null);
    } catch (err) {
      setError('Failed to load SLA definitions');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadFieldRegistry = useCallback(async () => {
    try {
      const response = await itsmApi.sla.fieldRegistry();
      const body = (response as { data?: { recordType?: string; fields?: unknown[] } }).data;
      const rawFields = body?.fields;
      if (Array.isArray(rawFields)) {
        const uuidKeys = new Set(['customerCompanyId', 'serviceId', 'offeringId', 'assignedTo', 'relatedService']);
        const normalized: FieldRegistryEntry[] = rawFields.map((f: Record<string, unknown>) => {
          const key = String(f.key ?? '');
          const valueType = (f.valueType as string) ?? 'string';
          const type: FieldRegistryEntry['type'] = uuidKeys.has(key)
            ? 'uuid'
            : valueType === 'number'
              ? 'number'
              : valueType === 'boolean'
                ? 'boolean'
                : valueType === 'date'
                  ? 'date'
                  : valueType === 'string' || valueType === 'array'
                    ? 'string'
                    : 'string';
          const operators = Array.isArray(f.allowedOperators) ? (f.allowedOperators as string[]) : [];
          const optionsFromApi = Array.isArray(f.options) ? (f.options as string[]) : undefined;
          const optionsFromKnown = SLA_FIELD_OPTIONS[key];
          const options = optionsFromApi?.length ? optionsFromApi : optionsFromKnown;
          const finalType: FieldRegistryEntry['type'] =
            type === 'uuid' ? 'uuid' : (options?.length ? 'enum' : type);
          return {
            key,
            label: String(f.label ?? key),
            type: finalType,
            operators: operators.length ? operators : ['is', 'is_not', 'in', 'not_in', 'is_empty', 'is_not_empty'],
            options,
          };
        });
        setFieldRegistry(normalized);
      }
    } catch {
      // Use SlaConditionBuilder defaults (includes Customer Company)
    }
  }, []);

  useEffect(() => { loadDefinitions(); loadFieldRegistry(); }, [loadDefinitions, loadFieldRegistry]);

  const handleOpen = (def?: SlaDefinition) => {
    if (def) {
      setEditingId(def.id);
      const h = Math.floor(def.targetSeconds / 3600);
      const m = Math.floor((def.targetSeconds % 3600) / 60);
      setTargetHours(h);
      setTargetMins(m);

      const rH = Math.floor((def.responseTimeSeconds ?? 0) / 3600);
      const rM = Math.floor(((def.responseTimeSeconds ?? 0) % 3600) / 60);
      const resHr = Math.floor((def.resolutionTimeSeconds ?? 0) / 3600);
      const resMn = Math.floor(((def.resolutionTimeSeconds ?? 0) % 3600) / 60);
      setResponseH(rH);
      setResponseM(rM);
      setResolutionH(resHr);
      setResolutionM(resMn);

      setForm({
        name: def.name,
        description: def.description || '',
        metric: def.metric,
        targetSeconds: def.targetSeconds,
        schedule: def.schedule,
        businessStartHour: def.businessStartHour,
        businessEndHour: def.businessEndHour,
        businessDays: def.businessDays || [1, 2, 3, 4, 5],
        priorityFilter: def.priorityFilter || [],
        stopOnStates: def.stopOnStates || ['resolved', 'closed'],
        pauseOnStates: def.pauseOnStates || [],
        isActive: def.isActive,
        order: def.order,
        appliesToRecordType: def.appliesToRecordType || 'INCIDENT',
        conditionTree: def.conditionTree ?? null,
        responseTimeSeconds: def.responseTimeSeconds ?? null,
        resolutionTimeSeconds: def.resolutionTimeSeconds ?? null,
        priorityWeight: def.priorityWeight ?? 0,
        stopProcessing: def.stopProcessing ?? false,
        effectiveFrom: def.effectiveFrom ?? '',
        effectiveTo: def.effectiveTo ?? '',
      });
    } else {
      setEditingId(null);
      setTargetHours(4);
      setTargetMins(0);
      setResponseH(1);
      setResponseM(0);
      setResolutionH(4);
      setResolutionM(0);
      setForm({
        ...emptySla,
        priorityFilter: [],
        stopOnStates: ['resolved', 'closed'],
        pauseOnStates: [],
        responseTimeSeconds: 3600,
        resolutionTimeSeconds: 14400,
      });
    }
    setDialogTab(0);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const payload = {
        ...form,
        targetSeconds: targetHours * 3600 + targetMins * 60,
        priorityFilter: form.priorityFilter.length > 0 ? form.priorityFilter : null,
        pauseOnStates: form.pauseOnStates.length > 0 ? form.pauseOnStates : null,
        responseTimeSeconds: responseH * 3600 + responseM * 60 || null,
        resolutionTimeSeconds: resolutionH * 3600 + resolutionM * 60 || null,
        effectiveFrom: form.effectiveFrom || null,
        effectiveTo: form.effectiveTo || null,
      };
      if (editingId) {
        await itsmApi.sla.updateDefinition(editingId, payload);
      } else {
        await itsmApi.sla.createDefinition(payload);
      }
      setDialogOpen(false);
      loadDefinitions();
    } catch (err) {
      console.error('Save failed:', err);
      setError('Failed to save SLA definition');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this SLA definition?')) return;
    try {
      await itsmApi.sla.deleteDefinition(id);
      loadDefinitions();
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  if (loading) {
    return <Box sx={{ p: 3, textAlign: 'center' }}><CircularProgress /></Box>;
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box>
          <Typography variant="h5">SLA Policies</Typography>
          <Typography variant="body2" color="text.secondary">
            Define service level agreements with flexible matching conditions and multi-dimensional targets.
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpen()}>
          New SLA Policy
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label="SLA Policies" />
        <Tab label="Test / Evaluate" icon={<ScienceIcon />} iconPosition="start" />
      </Tabs>

      <TabPanel value={tab} index={0}>
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 'bold' }}>Name</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Applies To</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Targets</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Priority / Weight</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Schedule</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Version</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Active</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }} align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {definitions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} align="center">
                    <Typography color="text.secondary">No SLA policies configured</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                definitions.map((def) => (
                  <TableRow key={def.id} hover>
                    <TableCell>
                      <Typography fontWeight="bold">{def.name}</Typography>
                      {def.description && <Typography variant="body2" color="text.secondary">{def.description}</Typography>}
                    </TableCell>
                    <TableCell>
                      <Chip label={def.appliesToRecordType || 'INCIDENT'} size="small" variant="outlined" />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{targetsSummary(def)}</Typography>
                    </TableCell>
                    <TableCell>
                      {isV2Policy(def) ? (
                        <Chip label={`W: ${def.priorityWeight ?? 0}`} size="small" color="info" variant="outlined" />
                      ) : (
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                          {def.priorityFilter?.map((p) => (<Chip key={p} label={p.toUpperCase()} size="small" />)) || <Typography variant="body2" color="text.secondary">All</Typography>}
                        </Box>
                      )}
                    </TableCell>
                    <TableCell>
                      <Chip label={SCHEDULE_OPTIONS.find(s => s.value === def.schedule)?.label || def.schedule} size="small" variant="outlined" />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={isV2Policy(def) ? 'v2' : 'v1'}
                        size="small"
                        color={isV2Policy(def) ? 'primary' : 'default'}
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>
                      <Chip label={def.isActive ? 'Active' : 'Inactive'} size="small" color={def.isActive ? 'success' : 'default'} />
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title="Edit">
                        <IconButton size="small" onClick={() => handleOpen(def)}><EditIcon fontSize="small" /></IconButton>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <IconButton size="small" onClick={() => handleDelete(def.id)} color="error"><DeleteIcon fontSize="small" /></IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </TabPanel>

      <TabPanel value={tab} index={1}>
        <EvaluatePanel />
      </TabPanel>

      {/* ── Create/Edit Dialog ─────────────────────────────────────── */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>{editingId ? 'Edit SLA Policy' : 'New SLA Policy'}</DialogTitle>
        <DialogContent>
          <Tabs value={dialogTab} onChange={(_, v) => setDialogTab(v)} sx={{ mb: 2 }}>
            <Tab label="General" />
            <Tab label="Conditions" />
            <Tab label="v1 Compat" />
          </Tabs>

          {/* Tab 0: General */}
          <TabPanel value={dialogTab} index={0}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <TextField label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required fullWidth />
              <TextField label="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} multiline rows={2} fullWidth />

              <Box sx={{ display: 'flex', gap: 2 }}>
                <FormControl fullWidth>
                  <InputLabel>Applies To</InputLabel>
                  <Select value={form.appliesToRecordType || 'INCIDENT'} label="Applies To" onChange={(e) => setForm({ ...form, appliesToRecordType: e.target.value })}>
                    {RECORD_TYPE_OPTIONS.map((rt) => (<MenuItem key={rt.value} value={rt.value}>{rt.label}</MenuItem>))}
                  </Select>
                </FormControl>
                <FormControl fullWidth>
                  <InputLabel>Schedule</InputLabel>
                  <Select value={form.schedule} label="Schedule" onChange={(e) => setForm({ ...form, schedule: e.target.value })}>
                    {SCHEDULE_OPTIONS.map((s) => (<MenuItem key={s.value} value={s.value}>{s.label}</MenuItem>))}
                  </Select>
                </FormControl>
              </Box>

              <Divider><Chip label="Target Times (SLA 2.0)" size="small" /></Divider>

              <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                <TextField label="Response Hours" type="number" value={responseH} onChange={(e) => setResponseH(parseInt(e.target.value) || 0)} sx={{ width: 140 }} />
                <TextField label="Response Mins" type="number" value={responseM} onChange={(e) => setResponseM(parseInt(e.target.value) || 0)} sx={{ width: 140 }} />
                <Typography variant="body2" color="text.secondary">= {formatDuration(responseH * 3600 + responseM * 60)}</Typography>
              </Box>

              <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                <TextField label="Resolution Hours" type="number" value={resolutionH} onChange={(e) => setResolutionH(parseInt(e.target.value) || 0)} sx={{ width: 140 }} />
                <TextField label="Resolution Mins" type="number" value={resolutionM} onChange={(e) => setResolutionM(parseInt(e.target.value) || 0)} sx={{ width: 140 }} />
                <Typography variant="body2" color="text.secondary">= {formatDuration(resolutionH * 3600 + resolutionM * 60)}</Typography>
              </Box>

              <Box sx={{ display: 'flex', gap: 2 }}>
                <TextField label="Priority Weight" type="number" value={form.priorityWeight} onChange={(e) => setForm({ ...form, priorityWeight: parseInt(e.target.value) || 0 })} sx={{ width: 160 }} helperText="Higher weight = higher precedence" />
                <FormControlLabel control={<Switch checked={form.stopProcessing} onChange={(e) => setForm({ ...form, stopProcessing: e.target.checked })} />} label="Stop Processing" />
                <FormControlLabel control={<Switch checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />} label="Active" />
              </Box>

              <Box sx={{ display: 'flex', gap: 2 }}>
                <TextField
                  label="Effective From"
                  type="datetime-local"
                  value={form.effectiveFrom ? form.effectiveFrom.substring(0, 16) : ''}
                  onChange={(e) => setForm({ ...form, effectiveFrom: e.target.value ? new Date(e.target.value).toISOString() : '' })}
                  InputLabelProps={{ shrink: true }}
                  fullWidth
                />
                <TextField
                  label="Effective To"
                  type="datetime-local"
                  value={form.effectiveTo ? form.effectiveTo.substring(0, 16) : ''}
                  onChange={(e) => setForm({ ...form, effectiveTo: e.target.value ? new Date(e.target.value).toISOString() : '' })}
                  InputLabelProps={{ shrink: true }}
                  fullWidth
                />
              </Box>

              {form.schedule === 'BUSINESS_HOURS' && (
                <Box sx={{ display: 'flex', gap: 2 }}>
                  <TextField label="Business Start Hour" type="number" value={form.businessStartHour} onChange={(e) => setForm({ ...form, businessStartHour: parseInt(e.target.value) || 0 })} sx={{ width: 180 }} />
                  <TextField label="Business End Hour" type="number" value={form.businessEndHour} onChange={(e) => setForm({ ...form, businessEndHour: parseInt(e.target.value) || 0 })} sx={{ width: 180 }} />
                </Box>
              )}
            </Box>
          </TabPanel>

          {/* Tab 1: Conditions */}
          <TabPanel value={dialogTab} index={1}>
            <SlaConditionBuilder
              value={form.conditionTree}
              onChange={(tree) => setForm({ ...form, conditionTree: tree })}
              fields={fieldRegistry.length > 0 ? fieldRegistry : undefined}
            />
          </TabPanel>

          {/* Tab 2: v1 Compat (legacy fields) */}
          <TabPanel value={dialogTab} index={2}>
            <Alert severity="info" sx={{ mb: 2 }}>
              These are legacy v1 fields. For new policies, use the Conditions tab and Target Times above instead.
            </Alert>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <FormControl fullWidth>
                <InputLabel>Metric (v1)</InputLabel>
                <Select value={form.metric} label="Metric (v1)" onChange={(e) => setForm({ ...form, metric: e.target.value })}>
                  {METRIC_OPTIONS.map((m) => (<MenuItem key={m.value} value={m.value}>{m.label}</MenuItem>))}
                </Select>
              </FormControl>

              <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                <TextField label="Target Hours (v1)" type="number" value={targetHours} onChange={(e) => setTargetHours(parseInt(e.target.value) || 0)} sx={{ width: 140 }} />
                <TextField label="Target Minutes (v1)" type="number" value={targetMins} onChange={(e) => setTargetMins(parseInt(e.target.value) || 0)} sx={{ width: 140 }} />
                <Typography variant="body2" color="text.secondary">= {formatDuration(targetHours * 3600 + targetMins * 60)}</Typography>
              </Box>

              <FormControl fullWidth>
                <InputLabel>Priority Filter (v1)</InputLabel>
                <Select
                  multiple
                  value={form.priorityFilter}
                  label="Priority Filter (v1)"
                  onChange={(e) => setForm({ ...form, priorityFilter: e.target.value as string[] })}
                  renderValue={(selected) => (<Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>{selected.map((v) => (<Chip key={v} label={v.toUpperCase()} size="small" />))}</Box>)}
                >
                  {PRIORITY_OPTIONS.map((p) => (<MenuItem key={p} value={p}>{p.toUpperCase()}</MenuItem>))}
                </Select>
              </FormControl>

              <Box sx={{ display: 'flex', gap: 2 }}>
                <FormControl fullWidth>
                  <InputLabel>Stop on States</InputLabel>
                  <Select
                    multiple
                    value={form.stopOnStates}
                    label="Stop on States"
                    onChange={(e) => setForm({ ...form, stopOnStates: e.target.value as string[] })}
                    renderValue={(selected) => selected.join(', ')}
                  >
                    {STATE_OPTIONS.map((s) => (<MenuItem key={s} value={s}>{s}</MenuItem>))}
                  </Select>
                </FormControl>
                <FormControl fullWidth>
                  <InputLabel>Pause on States</InputLabel>
                  <Select
                    multiple
                    value={form.pauseOnStates}
                    label="Pause on States"
                    onChange={(e) => setForm({ ...form, pauseOnStates: e.target.value as string[] })}
                    renderValue={(selected) => selected.join(', ')}
                  >
                    {STATE_OPTIONS.map((s) => (<MenuItem key={s} value={s}>{s}</MenuItem>))}
                  </Select>
                </FormControl>
              </Box>

              <TextField label="Order (v1)" type="number" value={form.order} onChange={(e) => setForm({ ...form, order: parseInt(e.target.value) || 0 })} sx={{ width: 120 }} />
            </Box>
          </TabPanel>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving || !form.name}>{saving ? 'Saving...' : 'Save'}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ItsmStudioSla;
