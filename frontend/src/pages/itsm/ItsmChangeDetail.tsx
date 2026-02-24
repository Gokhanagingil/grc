import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Badge,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  Grid,
  IconButton,
  InputLabel,
  List,
  ListItem,
  ListItemText,
  MenuItem,
  Select,
  TextField,
  Typography,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Save as SaveIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Delete as DeleteIcon,
  Warning as WarningIcon,
  Refresh as RefreshIcon,
  Gavel as GavelIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  PlayArrow as PlayArrowIcon,
} from '@mui/icons-material';
import { itsmApi, cmdbApi, CmdbServiceData, CmdbServiceOfferingData, ItsmCalendarConflictData, ItsmApprovalData, RiskAssessmentData, RiskFactorData, unwrapResponse, TopologyImpactResponseData, TopologyGovernanceEvaluationData, TopologyGuardrailEvaluationData, SuggestedTaskPackResponseData, TraceabilitySummaryResponseData, CabChangeSummaryData } from '../../services/grcClient';
import { CustomerRiskIntelligence } from '../../components/itsm/CustomerRiskIntelligence';
import { ChangeTasksSection } from '../../components/itsm/ChangeTasksSection';
import { ChangeAffectedCisSection } from '../../components/itsm/ChangeAffectedCisSection';
import { GovernanceBanner } from '../../components/itsm/GovernanceBanner';
import { useNotification } from '../../contexts/NotificationContext';
import { useItsmChoices, ChoiceOption } from '../../hooks/useItsmChoices';
import { ActivityStream } from '../../components/itsm/ActivityStream';
import { classifyApiError } from '../../utils/apiErrorClassifier';
import { AxiosError } from 'axios';
import {
  TopologyImpactSummaryCard,
  TopologyExplainabilityPanel,
  TopologyInsightBanner,
  TopologyGovernanceDecisionPanel,
  TopologyGuardrailsPanel,
  SuggestedTaskPackCard,
  TraceabilityChainWidget,
  classifyTopologyApiError,
  unwrapTopologyResponse,
  normalizeTopologyImpactResponse,
  normalizeTraceabilitySummaryResponse,
  normalizeSuggestedTaskPackResponse,
  normalizeGovernanceEvaluationResponse,
  normalizeGuardrailEvaluationResponse,
  getTopologyRiskLevel,
  type ClassifiedTopologyError,
} from '../../components/topology-intelligence';

interface ItsmChange {
  id: string;
  number: string;
  title: string;
  description?: string;
  type: string;
  state: string;
  risk: string;
  approvalStatus: string;
  implementationPlan?: string;
  backoutPlan?: string;
  plannedStartAt?: string;
  plannedEndAt?: string;
  actualStartAt?: string;
  actualEndAt?: string;
  serviceId?: string;
  offeringId?: string;
  service?: { id: string; name: string };
  createdAt: string;
  updatedAt: string;
}

interface LinkedRisk {
  id: string;
  code: string;
  name: string;
  status: string;
}

interface LinkedControl {
  id: string;
  code: string;
  name: string;
  status: string;
}

const FALLBACK_CHOICES: Record<string, ChoiceOption[]> = {
  type: [
    { value: 'STANDARD', label: 'Standard' },
    { value: 'NORMAL', label: 'Normal' },
    { value: 'EMERGENCY', label: 'Emergency' },
  ],
  state: [
    { value: 'DRAFT', label: 'Draft' },
    { value: 'ASSESS', label: 'Assess' },
    { value: 'AUTHORIZE', label: 'Authorize' },
    { value: 'IMPLEMENT', label: 'Implement' },
    { value: 'REVIEW', label: 'Review' },
    { value: 'CLOSED', label: 'Closed' },
  ],
  risk: [
    { value: 'LOW', label: 'Low' },
    { value: 'MEDIUM', label: 'Medium' },
    { value: 'HIGH', label: 'High' },
  ],
};

const APPROVAL_OPTIONS = [
  { value: 'NOT_REQUESTED', label: 'Not Requested' },
  { value: 'REQUESTED', label: 'Requested' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
];

/** Maximum time (ms) to wait for page initialization before forcing ready state */
const INIT_TIMEOUT_MS = 15_000;

/**
 * Robustly extract an array from various API response envelope shapes.
 * Handles:
 * - { data: [...] }           (standard envelope)
 * - { success: true, data: [...] } (NestJS ResponseTransformInterceptor)
 * - [...]                     (flat array, no envelope)
 * - { data: { items: [...] } } (paginated envelope)
 * - null / undefined / non-object
 */
function extractLinkedArray<T = unknown>(raw: unknown): T[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw !== 'object') return [];

  const obj = raw as Record<string, unknown>;

  // { data: [...] } or { success: true, data: [...] }
  if ('data' in obj) {
    if (Array.isArray(obj.data)) return obj.data;
    // { data: { items: [...] } }
    if (obj.data && typeof obj.data === 'object' && 'items' in (obj.data as Record<string, unknown>)) {
      const items = (obj.data as Record<string, unknown>).items;
      if (Array.isArray(items)) return items;
    }
  }

  // { items: [...] }
  if ('items' in obj && Array.isArray(obj.items)) return obj.items;

  return [];
}

/**
 * Classify a linked-data load error into an actionable user-facing message.
 * Distinguishes permission (401/403), not found (404), server error (5xx),
 * and contract/network issues.
 */
function classifyLinkedLoadError(reason: unknown, entityLabel: string): string {
  if (reason && typeof reason === 'object') {
    const err = reason as { response?: { status?: number; data?: { message?: string } }; message?: string };
    const status = err.response?.status;
    const serverMsg = err.response?.data?.message;

    if (status === 401) {
      return `Linked ${entityLabel} could not be loaded: session expired. Please log in again.`;
    }
    if (status === 403) {
      return `Linked ${entityLabel} could not be loaded: insufficient permissions.`;
    }
    if (status === 404) {
      return `Linked ${entityLabel} endpoint not found. The integration may not be configured.`;
    }
    if (status && status >= 500) {
      return `Linked ${entityLabel} could not be loaded: server error (${status}).${serverMsg ? ` ${serverMsg}` : ''}`;
    }
    if (err.message === 'Network Error' || err.message?.includes('timeout')) {
      return `Linked ${entityLabel} could not be loaded: network error. Check your connection.`;
    }
  }
  return `Linked ${entityLabel} could not be loaded.`;
}

/**
 * Centralized helper to extract the created record ID from various response envelope shapes.
 * Supports:
 * - { success: true, data: { id } } (NestJS ResponseTransformInterceptor)
 * - { data: { id } } (legacy envelope)
 * - { id } (flat)
 */
function extractCreatedRecordId(response: { data: unknown }): string | undefined {
  const raw = response.data;
  if (!raw || typeof raw !== 'object') return undefined;

  // Try unwrapResponse first (handles { success: true, data: ... })
  try {
    const unwrapped = unwrapResponse<{ id?: string }>(response);
    if (unwrapped && typeof unwrapped === 'object' && 'id' in unwrapped) {
      return (unwrapped as { id: string }).id;
    }
  } catch { /* fallback below */ }

  // Manual envelope check
  const d = raw as Record<string, unknown>;
  if ('data' in d && d.data && typeof d.data === 'object' && 'id' in (d.data as Record<string, unknown>)) {
    return (d.data as { id: string }).id;
  }
  if ('id' in d && typeof d.id === 'string') {
    return d.id;
  }

  return undefined;
}

export const ItsmChangeDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showNotification } = useNotification();
  // The /itsm/changes/new route has no :id param, so id is undefined.
  // The /itsm/changes/:id route with id='new' also means create mode.
  const isNew = !id || id === 'new';
  const { choices } = useItsmChoices('itsm_changes', FALLBACK_CHOICES);
  const mountedRef = useRef(true);

  const typeOptions = choices['type'] || FALLBACK_CHOICES['type'];
  const stateOptions = choices['state'] || FALLBACK_CHOICES['state'];
  const riskOptions = choices['risk'] || FALLBACK_CHOICES['risk'];

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [initWarnings, setInitWarnings] = useState<string[]>([]);
  const [change, setChange] = useState<Partial<ItsmChange>>({
    title: '',
    description: '',
    type: 'NORMAL',
    state: 'DRAFT',
    risk: 'LOW',
    approvalStatus: 'NOT_REQUESTED',
  });

  // Cleanup ref on unmount
  useEffect(() => {
    return () => { mountedRef.current = false; };
  }, []);

  // Safety timeout: if loading persists beyond INIT_TIMEOUT_MS, force-exit loading state
  useEffect(() => {
    if (!loading) return;
    const timer = setTimeout(() => {
      if (mountedRef.current && loading) {
        console.warn('[ItsmChangeDetail] Init timeout reached — forcing ready state');
        setLoading(false);
        setInitWarnings(prev => [...prev, 'Page initialization timed out. Some data may be unavailable.']);
      }
    }, INIT_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [loading]);

  // CMDB Service/Offering picker state
  const [cmdbServices, setCmdbServices] = useState<CmdbServiceData[]>([]);
  const [cmdbOfferings, setCmdbOfferings] = useState<CmdbServiceOfferingData[]>([]);

  // Conflicts state
  const [conflicts, setConflicts] = useState<ItsmCalendarConflictData[]>([]);
  const [showConflictsSection, setShowConflictsSection] = useState(true);
  const [refreshingConflicts, setRefreshingConflicts] = useState(false);

  // Risk Assessment state
  const [riskAssessment, setRiskAssessment] = useState<RiskAssessmentData | null>(null);
  const [recalculating, setRecalculating] = useState(false);
  const [showRiskTab, setShowRiskTab] = useState(true);

  // GRC Bridge state
  const [linkedRisks, setLinkedRisks] = useState<LinkedRisk[]>([]);
  const [linkedControls, setLinkedControls] = useState<LinkedControl[]>([]);
  const [linkedRisksError, setLinkedRisksError] = useState<string | null>(null);
  const [linkedControlsError, setLinkedControlsError] = useState<string | null>(null);
  const [showRisksSection, setShowRisksSection] = useState(false);
  const [showControlsSection, setShowControlsSection] = useState(false);

  // Approval state
  const [approvals, setApprovals] = useState<ItsmApprovalData[]>([]);
  const [showApprovals, setShowApprovals] = useState(true);
  const [approvalDialogOpen, setApprovalDialogOpen] = useState(false);
  const [approvalDialogMode, setApprovalDialogMode] = useState<'approve' | 'reject'>('approve');
  const [approvalDialogTarget, setApprovalDialogTarget] = useState<string>('');
  const [approvalComment, setApprovalComment] = useState('');
  const [approvalBusy, setApprovalBusy] = useState(false);
  const [governanceError, setGovernanceError] = useState<string | null>(null);

  // Topology Intelligence state
  const [topologyImpact, setTopologyImpact] = useState<TopologyImpactResponseData | null>(null);
  const [topologyLoading, setTopologyLoading] = useState(false);
  const [topologyError, setTopologyError] = useState<ClassifiedTopologyError | null>(null);
  const [topologyRecalculating, setTopologyRecalculating] = useState(false);
  const [showTopologySection, setShowTopologySection] = useState(true);

  // Topology Governance Decision Support state
  const [governanceData, setGovernanceData] = useState<TopologyGovernanceEvaluationData | null>(null);
  const [governanceLoading, setGovernanceLoading] = useState(false);
  const [governanceEvalError, setGovernanceEvalError] = useState<ClassifiedTopologyError | null>(null);
  const [governanceReEvaluating, setGovernanceReEvaluating] = useState(false);

  // CAB Summary state
  const [cabSummary, setCabSummary] = useState<CabChangeSummaryData | null>(null);
  const [showCabSection, setShowCabSection] = useState(true);

  const fetchChange = useCallback(async () => {
    if (isNew || !id) return;
    
    setLoading(true);
    const initStart = Date.now();
    if (process.env.NODE_ENV === 'development') {
      console.debug('[ItsmChangeDetail] init:start', { mode: 'edit', id });
    }
    try {
      // CRITICAL: Fetch the change record itself — must succeed
      const response = await itsmApi.changes.get(id);
      const data = response.data;
      if (data && 'data' in data && data.data && typeof data.data === 'object') {
        setChange(data.data);
      } else if (data && typeof data === 'object' && 'id' in data) {
        // Flat response shape (no envelope)
        setChange(data as Partial<ItsmChange>);
      }
      if (process.env.NODE_ENV === 'development') {
        console.debug('[ItsmChangeDetail] init:change:success', { elapsed: Date.now() - initStart });
      }

      // OPTIONAL: Fetch enrichment data in parallel using Promise.allSettled
      // These MUST NOT block form render — failures show warnings, not errors
      const optionalResults = await Promise.allSettled([
        // [0] Linked risks
        itsmApi.changes.getLinkedRisks(id),
        // [1] Linked controls
        itsmApi.changes.getLinkedControls(id),
        // [2] Conflicts
        itsmApi.changes.conflicts(id),
        // [3] Risk assessment
        itsmApi.changes.getRiskAssessment(id),
        // [4] Approvals
        itsmApi.changes.listApprovals(id),
        // [5] CAB Summary
        itsmApi.changes.getCabSummary(id),
      ]);

      if (!mountedRef.current) return;

      const optionalWarnings: string[] = [];

      // [0] Linked risks — robust envelope parsing + classified error messages
      if (optionalResults[0].status === 'fulfilled') {
        const risksRaw = optionalResults[0].value.data;
        const parsed = extractLinkedArray<LinkedRisk>(risksRaw);
        setLinkedRisks(parsed);
        setLinkedRisksError(null);
      } else {
        const reason = optionalResults[0].reason;
        const errMsg = classifyLinkedLoadError(reason, 'risks');
        if (process.env.NODE_ENV === 'development') {
          console.warn('[ItsmChangeDetail] init:linkedRisks:error', reason);
        }
        setLinkedRisksError(errMsg);
        optionalWarnings.push(errMsg);
      }

      // [1] Linked controls — robust envelope parsing + classified error messages
      if (optionalResults[1].status === 'fulfilled') {
        const controlsRaw = optionalResults[1].value.data;
        const parsed = extractLinkedArray<LinkedControl>(controlsRaw);
        setLinkedControls(parsed);
        setLinkedControlsError(null);
      } else {
        const reason = optionalResults[1].reason;
        const errMsg = classifyLinkedLoadError(reason, 'controls');
        if (process.env.NODE_ENV === 'development') {
          console.warn('[ItsmChangeDetail] init:linkedControls:error', reason);
        }
        setLinkedControlsError(errMsg);
        optionalWarnings.push(errMsg);
      }

      // [2] Conflicts
      if (optionalResults[2].status === 'fulfilled') {
        const cData = optionalResults[2].value.data as { data?: ItsmCalendarConflictData[] };
        if (cData?.data) {
          setConflicts(Array.isArray(cData.data) ? cData.data : []);
        }
      } else {
        if (process.env.NODE_ENV === 'development') {
          console.warn('[ItsmChangeDetail] init:conflicts:error', optionalResults[2].reason);
        }
        optionalWarnings.push('Calendar conflicts could not be loaded.');
      }

      // [3] Risk assessment
      if (optionalResults[3].status === 'fulfilled') {
        const rData = optionalResults[3].value.data as { data?: { assessment?: RiskAssessmentData } | RiskAssessmentData };
        if (rData?.data) {
          const payload = rData.data;
          if ('assessment' in payload && payload.assessment) {
            setRiskAssessment(payload.assessment);
          } else if ('riskScore' in payload) {
            setRiskAssessment(payload as RiskAssessmentData);
          }
        }
      } else {
        // Risk assessment may not exist yet — only warn in dev
        if (process.env.NODE_ENV === 'development') {
          console.warn('[ItsmChangeDetail] init:riskAssessment:error', optionalResults[3].reason);
        }
      }

      // [4] Approvals
      if (optionalResults[4].status === 'fulfilled') {
        const aData = optionalResults[4].value.data as { data?: ItsmApprovalData[] };
        if (aData?.data) {
          setApprovals(Array.isArray(aData.data) ? aData.data : []);
        }
      } else {
        if (process.env.NODE_ENV === 'development') {
          console.warn('[ItsmChangeDetail] init:approvals:error', optionalResults[4].reason);
        }
      }

      // [5] CAB Summary
      if (optionalResults[5]?.status === 'fulfilled') {
        const cabRaw = optionalResults[5].value.data;
        if (cabRaw && typeof cabRaw === 'object') {
          const payload = 'data' in cabRaw ? (cabRaw as Record<string, unknown>).data : cabRaw;
          if (payload && typeof payload === 'object') {
            setCabSummary(payload as CabChangeSummaryData);
          }
        }
      } else {
        if (process.env.NODE_ENV === 'development') {
          console.warn('[ItsmChangeDetail] init:cabSummary:error', optionalResults[5]?.reason);
        }
      }

      // Show aggregated warningsfor optional dependency failures
      if (optionalWarnings.length > 0 && mountedRef.current) {
        setInitWarnings(prev => {
          const newWarnings = optionalWarnings.filter(w => !prev.includes(w));
          return newWarnings.length > 0 ? [...prev, ...newWarnings] : prev;
        });
      }

      if (process.env.NODE_ENV === 'development') {
        console.debug('[ItsmChangeDetail] init:ready', { elapsed: Date.now() - initStart });
      }
    } catch (error) {
      console.error('Error fetching ITSM change:', error);
      const classified = classifyApiError(error);
      if (classified.kind === 'not_found') {
        showNotification('Change not found', 'error');
      } else {
        showNotification(classified.message || 'Failed to load ITSM change', 'error');
      }
      navigate('/itsm/changes');
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [id, isNew, navigate, showNotification]);

  useEffect(() => {
    fetchChange();
  }, [fetchChange]);

  useEffect(() => {
    const loadServices = async () => {
      try {
        const res = await cmdbApi.services.list({ pageSize: 100 });
        const d = res.data as { data?: { items?: CmdbServiceData[] } };
        if (d?.data?.items) {
          if (mountedRef.current) setCmdbServices(d.data.items);
        }
      } catch (err) {
        if (process.env.NODE_ENV === 'development') {
          console.warn('[ItsmChangeDetail] CMDB services load failed (non-critical):', err);
        }
        if (mountedRef.current) {
          setInitWarnings(prev => {
            const msg = 'CMDB services unavailable — service binding disabled.';
            return prev.includes(msg) ? prev : [...prev, msg];
          });
        }
      }
    };
    loadServices();
  }, []);

  useEffect(() => {
    const loadOfferings = async () => {
      if (!change.serviceId) {
        setCmdbOfferings([]);
        return;
      }
      try {
        const res = await cmdbApi.serviceOfferings.list({ serviceId: change.serviceId, pageSize: 100 });
        const d = res.data as { data?: { items?: CmdbServiceOfferingData[] } };
        if (d?.data?.items) {
          if (mountedRef.current) setCmdbOfferings(d.data.items);
        } else {
          if (mountedRef.current) setCmdbOfferings([]);
        }
      } catch {
        if (mountedRef.current) setCmdbOfferings([]);
      }
    };
    loadOfferings();
  }, [change.serviceId]);

  const handleChange= (field: keyof ItsmChange, value: string) => {
    setChange((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!change.title?.trim()) {
      showNotification('Title is required', 'error');
      setSaveError('Title is required');
      return;
    }

    setSaving(true);
    setSaveError(null);
    if (process.env.NODE_ENV === 'development') {
      console.debug('[ItsmChangeDetail] save:click', { mode: isNew ? 'create' : 'edit', id });
    }
    try {
      if (isNew) {
        // CREATE: Only send fields accepted by backend CreateChangeDto
        // Do NOT send state, approvalStatus (server-managed)
        const createPayload = {
          title: change.title,
          description: change.description,
          type: change.type as 'STANDARD' | 'NORMAL' | 'EMERGENCY',
          risk: change.risk as 'LOW' | 'MEDIUM' | 'HIGH',
          implementationPlan: change.implementationPlan,
          backoutPlan: change.backoutPlan,
          plannedStartAt: change.plannedStartAt,
          plannedEndAt: change.plannedEndAt,
          serviceId: change.serviceId,
          offeringId: change.offeringId,
        };
        if (process.env.NODE_ENV === 'development') {
          console.debug('[ItsmChangeDetail] save:payload', createPayload);
        }
        const response = await itsmApi.changes.create(createPayload);
        if (process.env.NODE_ENV === 'development') {
          console.debug('[ItsmChangeDetail] save:response', response.data);
        }
        // Robustly extract the created change ID
        const createdId = extractCreatedRecordId(response);
        if (createdId) {
          showNotification('Change created successfully', 'success');
          navigate(`/itsm/changes/${createdId}`);
        } else {
          // Response succeeded (2xx) but we couldn't extract an ID — still success
          console.warn('[ItsmChangeDetail] Create succeeded but response shape unexpected:', response.data);
          showNotification('Change created. Redirecting to list.', 'success');
          navigate('/itsm/changes');
        }
      } else if (id) {
        // UPDATE: Do NOT send approvalStatus (server-managed, backend rejects it)
        const updatePayload = {
          title: change.title,
          description: change.description,
          type: change.type as 'STANDARD' | 'NORMAL' | 'EMERGENCY',
          state: change.state as 'DRAFT' | 'ASSESS' | 'AUTHORIZE' | 'IMPLEMENT' | 'REVIEW' | 'CLOSED',
          risk: change.risk as 'LOW' | 'MEDIUM' | 'HIGH',
          // approvalStatus intentionally omitted — managed by backend
          implementationPlan: change.implementationPlan,
          backoutPlan: change.backoutPlan,
          plannedStartAt: change.plannedStartAt,
          plannedEndAt: change.plannedEndAt,
          serviceId: change.serviceId,
          offeringId: change.offeringId,
        };
        if (process.env.NODE_ENV === 'development') {
          console.debug('[ItsmChangeDetail] save:payload', updatePayload);
        }
        await itsmApi.changes.update(id, updatePayload);
        showNotification('Change updated successfully', 'success');
        fetchChange();
      }
    } catch (error: unknown) {
      console.error('Error saving change:', error);
      const classified = classifyApiError(error);
      const displayMsg = classified.message || 'Failed to save change';
      showNotification(displayMsg, 'error');
      if (mountedRef.current) setSaveError(displayMsg);
      if (process.env.NODE_ENV === 'development') {
        console.debug('[ItsmChangeDetail] save:error', { kind: classified.kind, status: classified.status, message: displayMsg });
      }
    } finally {
      if (mountedRef.current) setSaving(false);
      if (process.env.NODE_ENV === 'development') {
        console.debug('[ItsmChangeDetail] save:finally');
      }
    }
  };

  const handleRequestApproval = async () => {
    if (!id) return;
    setApprovalBusy(true);
    setGovernanceError(null);
    try {
      await itsmApi.changes.requestApproval(id);
      showNotification('CAB approval requested', 'success');
      fetchChange();
    } catch (error) {
      const axiosErr = error as AxiosError<{ message?: string; reason?: string }>;
      if (axiosErr.response?.status === 409) {
        const msg = axiosErr.response.data?.message || axiosErr.response.data?.reason || 'Conflict detected';
        setGovernanceError(msg);
      } else {
        showNotification('Failed to request approval', 'error');
      }
    } finally {
      setApprovalBusy(false);
    }
  };

  const openApprovalDialog = (mode: 'approve' | 'reject', approvalId: string) => {
    setApprovalDialogMode(mode);
    setApprovalDialogTarget(approvalId);
    setApprovalComment('');
    setApprovalDialogOpen(true);
  };

  const handleApprovalDecision = async () => {
    if (!approvalDialogTarget) return;
    setApprovalBusy(true);
    setGovernanceError(null);
    try {
      if (approvalDialogMode === 'approve') {
        await itsmApi.changes.approveApproval(approvalDialogTarget, approvalComment || undefined);
        showNotification('Approval granted', 'success');
      } else {
        await itsmApi.changes.rejectApproval(approvalDialogTarget, approvalComment || undefined);
        showNotification('Approval rejected', 'success');
      }
      setApprovalDialogOpen(false);
      fetchChange();
    } catch (error) {
      const axiosErr = error as AxiosError<{ message?: string }>;
      showNotification(axiosErr.response?.data?.message || 'Failed to process approval', 'error');
    } finally {
      setApprovalBusy(false);
    }
  };

  const handleTransitionToImplement = async () => {
    if (!id) return;
    setApprovalBusy(true);
    setGovernanceError(null);
    try {
      await itsmApi.changes.update(id, {
        state: 'IMPLEMENT' as 'DRAFT' | 'ASSESS' | 'AUTHORIZE' | 'IMPLEMENT' | 'REVIEW' | 'CLOSED',
      });
      showNotification('Change moved to Implement', 'success');
      fetchChange();
    } catch (error) {
      const axiosErr = error as AxiosError<{ message?: string; reason?: string }>;
      if (axiosErr.response?.status === 409 || axiosErr.response?.status === 403) {
        const msg = axiosErr.response.data?.message || 'Transition blocked - approvals may be required';
        setGovernanceError(msg);
      } else {
        showNotification('Failed to transition change', 'error');
      }
    } finally {
      setApprovalBusy(false);
    }
  };

  const approvalStatusLabel = change.approvalStatus || 'NOT_REQUESTED';
  const hasRequestedApprovals = approvals.some(a => a.state === 'REQUESTED');
  const allApproved = approvals.length > 0 && approvals.every(a => a.state === 'APPROVED');
  const anyRejected = approvals.some(a => a.state === 'REJECTED');

  const handleUnlinkRisk = async (riskId: string) => {
    if (!id) return;
    try {
      await itsmApi.changes.unlinkRisk(id, riskId);
      showNotification('Risk unlinked successfully', 'success');
      setLinkedRisks((prev) => prev.filter((r) => r.id !== riskId));
    } catch (error) {
      console.error('Error unlinking risk:', error);
      showNotification('Failed to unlink risk', 'error');
    }
  };

  const handleUnlinkControl = async (controlId: string) => {
    if (!id) return;
    try {
      await itsmApi.changes.unlinkControl(id, controlId);
      showNotification('Control unlinked successfully', 'success');
      setLinkedControls((prev) => prev.filter((c) => c.id !== controlId));
    } catch (error) {
      console.error('Error unlinking control:', error);
      showNotification('Failed to unlink control', 'error');
    }
  };

  // --- Topology Intelligence: Non-blocking fetch ---
  const fetchTopologyImpact = useCallback(async () => {
    if (isNew || !id) return;
    setTopologyLoading(true);
    setTopologyError(null);
    try {
      const resp = await itsmApi.changes.getTopologyImpact(id);
      const rawData = unwrapTopologyResponse<Record<string, unknown>>(resp);
      // Normalize response to safe shape with defaults for missing fields
      const normalizedData = normalizeTopologyImpactResponse(rawData);
      if (mountedRef.current) {
        setTopologyImpact(normalizedData);
      }
    } catch (err) {
      if (mountedRef.current) {
        const classified = classifyTopologyApiError(err);
        setTopologyError(classified);
        // Do NOT trigger logout on 403
        if (process.env.NODE_ENV === 'development') {
          console.warn('[ItsmChangeDetail] topology:fetch:error', classified);
        }
      }
    } finally {
      if (mountedRef.current) setTopologyLoading(false);
    }
  }, [id, isNew]);

  const handleRecalculateTopology = useCallback(async () => {
    if (isNew || !id) return;
    setTopologyRecalculating(true);
    setTopologyError(null);
    try {
      const resp = await itsmApi.changes.recalculateTopologyImpact(id);
      const rawData = unwrapTopologyResponse<Record<string, unknown>>(resp);
      // Normalize response to safe shape with defaults for missing fields
      const normalizedData = normalizeTopologyImpactResponse(rawData);
      if (mountedRef.current) {
        setTopologyImpact(normalizedData);
        showNotification('Topology impact recalculated', 'success');
      }
    } catch (err) {
      if (mountedRef.current) {
        const classified = classifyTopologyApiError(err);
        setTopologyError(classified);
        showNotification(classified.message, 'error');
      }
    } finally {
      if (mountedRef.current) setTopologyRecalculating(false);
    }
  }, [id, isNew, showNotification]);

  // --- Topology Governance: Evaluate governance ---
  const handleEvaluateGovernance = useCallback(async () => {
    if (isNew || !id) return;
    const isReEval = !!governanceData;
    if (isReEval) {
      setGovernanceReEvaluating(true);
    } else {
      setGovernanceLoading(true);
    }
    setGovernanceEvalError(null);
    try {
      const resp = await itsmApi.changes.evaluateTopologyGovernance(id);
      const rawData = unwrapTopologyResponse<TopologyGovernanceEvaluationData>(resp);
      // Normalize at boundary to guarantee safe arrays/objects for widget rendering
      const data = normalizeGovernanceEvaluationResponse(rawData as Record<string, unknown> | null);
      if (mountedRef.current) {
        setGovernanceData(data);
        if (isReEval) {
          showNotification('Governance re-evaluated successfully', 'success');
        }
      }
    } catch (err) {
      if (mountedRef.current) {
        const classified = classifyTopologyApiError(err);
        setGovernanceEvalError(classified);
        if (isReEval) {
          showNotification(classified.message, 'error');
        }
      }
    } finally {
      if (mountedRef.current) {
        setGovernanceLoading(false);
        setGovernanceReEvaluating(false);
      }
    }
  }, [id, isNew, governanceData, showNotification]);

  // Non-blocking topology fetch after main data loads
  useEffect(() => {
    if (!isNew && id && !loading) {
      fetchTopologyImpact();
    }
  }, [isNew, id, loading, fetchTopologyImpact]);

  if (loading) {
    return (
      <Box
        data-testid="change-form-loading"
        sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minHeight: 400, gap: 2 }}
      >
        <CircularProgress />
        <Typography variant="body2" color="text.secondary">
          Loading change details...
        </Typography>
      </Box>
    );
  }

  return (
    <Box data-testid="change-form-ready">
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate('/itsm/changes')}
        >
          Back to Changes
        </Button>
      </Box>

      {/* Init Warnings Banner — non-critical dependency failures */}
      {initWarnings.length > 0 && (
        <Alert
          severity="warning"
          data-testid="change-form-warning-init"
          onClose={() => setInitWarnings([])}
          sx={{ mb: 2 }}
        >
          {initWarnings.map((w, i) => (
            <Typography key={i} variant="body2">{w}</Typography>
          ))}
        </Alert>
      )}

      {/* Save Error Banner — submit failure with inline detail */}
      {saveError && (
        <Alert
          severity="error"
          data-testid="change-form-error"
          onClose={() => setSaveError(null)}
          sx={{ mb: 2 }}
        >
          {saveError}
        </Alert>
      )}

      {/* Topology Insight Banner (high risk / fragility warning) */}
      {!isNew && (
        <TopologyInsightBanner
          context="change"
          changeImpact={topologyImpact}
          onViewDetails={() => setShowTopologySection(true)}
          onRecalculate={handleRecalculateTopology}
          recalculating={topologyRecalculating}
        />
      )}

      {/* Governance Error Banner */}
      {governanceError && (
        <Alert
          severity="error"
          onClose={() => setGovernanceError(null)}
          sx={{ mb: 2 }}
          action={
            <Button color="inherit" size="small" onClick={() => navigate('/itsm/calendar')}>
              View Calendar
            </Button>
          }
        >
          {governanceError}
        </Alert>
      )}

      {/* Decision Support + Governance Strip */}
      {!isNew && riskAssessment && (
        <Card
          sx={{
            mb: 2,
            background: riskAssessment.riskLevel === 'CRITICAL'
              ? 'linear-gradient(135deg, #d32f2f 0%, #b71c1c 100%)'
              : riskAssessment.riskLevel === 'HIGH'
              ? 'linear-gradient(135deg, #ed6c02 0%, #e65100 100%)'
              : riskAssessment.riskLevel === 'MEDIUM'
              ? 'linear-gradient(135deg, #2196f3 0%, #1565c0 100%)'
              : 'linear-gradient(135deg, #2e7d32 0%, #1b5e20 100%)',
            color: 'white',
          }}
        >
          <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Box sx={{ textAlign: 'center', minWidth: 60 }}>
                  <Typography variant="h4" fontWeight={700} lineHeight={1}>
                    {riskAssessment.riskScore}
                  </Typography>
                  <Typography variant="caption" sx={{ opacity: 0.9 }}>
                    Risk Score
                  </Typography>
                </Box>
                <Divider orientation="vertical" flexItem sx={{ borderColor: 'rgba(255,255,255,0.3)' }} />
                <Box>
                  <Chip
                    label={riskAssessment.riskLevel}
                    size="small"
                    sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white', fontWeight: 600 }}
                  />
                </Box>
                <Divider orientation="vertical" flexItem sx={{ borderColor: 'rgba(255,255,255,0.3)' }} />
                <Box sx={{ display: 'flex', gap: 2 }}>
                  <Typography variant="body2" sx={{ opacity: 0.9 }}>
                    {riskAssessment.impactedCiCount} CIs impacted
                  </Typography>
                  <Typography variant="body2" sx={{ opacity: 0.9 }}>
                    {riskAssessment.impactedServiceCount} services
                  </Typography>
                </Box>
                <Divider orientation="vertical" flexItem sx={{ borderColor: 'rgba(255,255,255,0.3)' }} />
                <Chip
                  label={approvalStatusLabel.replace('_', ' ')}
                  size="small"
                  data-testid="approval-status-badge"
                  sx={{
                    bgcolor: approvalStatusLabel === 'APPROVED' ? 'rgba(76,175,80,0.3)'
                      : approvalStatusLabel === 'REJECTED' ? 'rgba(244,67,54,0.3)'
                      : approvalStatusLabel === 'REQUESTED' ? 'rgba(255,193,7,0.3)'
                      : 'rgba(255,255,255,0.2)',
                    color: 'white',
                    fontWeight: 600,
                  }}
                />
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {riskAssessment.hasFreezeConflict && (
                  <Chip
                    icon={<WarningIcon sx={{ color: 'white !important' }} />}
                    label="Freeze Window"
                    size="small"
                    sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white' }}
                  />
                )}
                {riskAssessment.hasSlaRisk && (
                  <Chip
                    icon={<WarningIcon sx={{ color: 'white !important' }} />}
                    label="SLA At Risk"
                    size="small"
                    sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white' }}
                  />
                )}
                {conflicts.length > 0 && (
                  <Chip
                    label={`${conflicts.length} conflict${conflicts.length !== 1 ? 's' : ''}`}
                    size="small"
                    sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white' }}
                  />
                )}
                {/* Governance CTA Button */}
                {approvalStatusLabel === 'NOT_REQUESTED' && (change.state === 'ASSESS' || change.state === 'AUTHORIZE') && (
                  <Button
                    variant="contained"
                    size="small"
                    startIcon={<GavelIcon />}
                    onClick={handleRequestApproval}
                    disabled={approvalBusy}
                    data-testid="request-cab-btn"
                    sx={{ bgcolor: 'rgba(255,255,255,0.25)', color: 'white', '&:hover': { bgcolor: 'rgba(255,255,255,0.4)' } }}
                  >
                    {approvalBusy ? 'Requesting...' : 'Request CAB Approval'}
                  </Button>
                )}
                {allApproved && change.state !== 'IMPLEMENT' && change.state !== 'REVIEW' && change.state !== 'CLOSED' && (
                  <Button
                    variant="contained"
                    size="small"
                    startIcon={<PlayArrowIcon />}
                    onClick={handleTransitionToImplement}
                    disabled={approvalBusy}
                    data-testid="implement-btn"
                    sx={{ bgcolor: 'rgba(76,175,80,0.5)', color: 'white', '&:hover': { bgcolor: 'rgba(76,175,80,0.7)' } }}
                  >
                    {approvalBusy ? 'Processing...' : 'Implement'}
                  </Button>
                )}
              </Box>
            </Box>
          </CardContent>
        </Card>
      )}

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" fontWeight={600}>
          {isNew ? 'New Change' : change.number}
        </Typography>
        <Button
          variant="contained"
          startIcon={saving ? <CircularProgress size={18} color="inherit" /> : <SaveIcon />}
          onClick={handleSave}
          disabled={saving}
          data-testid="change-form-submit"
        >
          {saving ? 'Saving...' : 'Save'}
        </Button>
      </Box>

      <Grid container spacing={3}>
        <Grid item xs={12} lg={8}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Change Details
              </Typography>
              <Divider sx={{ mb: 3 }} />

              <Grid container spacing={3}>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Title"
                    value={change.title || ''}
                    onChange={(e) => handleChange('title', e.target.value)}
                    required
                    data-testid="change-title-input"
                  />
                </Grid>

                <Grid item xs={12} md={6}>
                  <FormControl fullWidth>
                    <InputLabel>Type</InputLabel>
                    <Select
                      value={change.type || 'NORMAL'}
                      label="Type"
                      onChange={(e) => handleChange('type', e.target.value)}
                    >
                      {typeOptions.map((option) => (
                        <MenuItem key={option.value} value={option.value}>
                          {option.label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>

                <Grid item xs={12} md={6}>
                  <FormControl fullWidth>
                    <InputLabel>State</InputLabel>
                    <Select
                      value={change.state || 'DRAFT'}
                      label="State"
                      onChange={(e) => handleChange('state', e.target.value)}
                    >
                      {stateOptions.map((option) => (
                        <MenuItem key={option.value} value={option.value}>
                          {option.label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>

                <Grid item xs={12} md={6}>
                  <FormControl fullWidth>
                    <InputLabel>Risk</InputLabel>
                    <Select
                      value={change.risk || 'LOW'}
                      label="Risk"
                      onChange={(e) => handleChange('risk', e.target.value)}
                    >
                      {riskOptions.map((option) => (
                        <MenuItem key={option.value} value={option.value}>
                          {option.label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>

                <Grid item xs={12} md={6}>
                  <FormControl fullWidth>
                    <InputLabel>Approval Status</InputLabel>
                    <Select
                      value={change.approvalStatus || 'NOT_REQUESTED'}
                      label="Approval Status"
                      onChange={(e) => handleChange('approvalStatus', e.target.value)}
                    >
                      {APPROVAL_OPTIONS.map((option) => (
                        <MenuItem key={option.value} value={option.value}>
                          {option.label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>

                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Description"
                    value={change.description || ''}
                    onChange={(e) => handleChange('description', e.target.value)}
                    multiline
                    rows={4}
                  />
                </Grid>

                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Implementation Plan"
                    value={change.implementationPlan || ''}
                    onChange={(e) => handleChange('implementationPlan', e.target.value)}
                    multiline
                    rows={3}
                  />
                </Grid>

                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Backout Plan"
                    value={change.backoutPlan || ''}
                    onChange={(e) => handleChange('backoutPlan', e.target.value)}
                    multiline
                    rows={3}
                  />
                </Grid>

                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Planned Start"
                    type="datetime-local"
                    value={change.plannedStartAt ? change.plannedStartAt.slice(0, 16) : ''}
                    onChange={(e) => handleChange('plannedStartAt', e.target.value)}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>

                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Planned End"
                    type="datetime-local"
                    value={change.plannedEndAt ? change.plannedEndAt.slice(0, 16) : ''}
                    onChange={(e) => handleChange('plannedEndAt', e.target.value)}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} lg={4}>
          {/* CMDB Service / Offering Picker */}
          <Card sx={{ mb: 2 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Service Binding
              </Typography>
              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel>CMDB Service</InputLabel>
                <Select
                  value={change.serviceId || ''}
                  label="CMDB Service"
                  data-testid="change-service-select"
                  onChange={(e) => {
                    const val = e.target.value || undefined;
                    setChange((prev) => ({ ...prev, serviceId: val, offeringId: undefined }));
                  }}
                >
                  <MenuItem value=""><em>None</em></MenuItem>
                  {cmdbServices.map((s) => (
                    <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl fullWidth disabled={!change.serviceId}>
                <InputLabel>Offering</InputLabel>
                <Select
                  value={change.offeringId || ''}
                  label="Offering"
                  data-testid="change-offering-select"
                  onChange={(e) => {
                    const val = e.target.value || undefined;
                    setChange((prev) => ({ ...prev, offeringId: val }));
                  }}
                >
                  <MenuItem value=""><em>None</em></MenuItem>
                  {cmdbOfferings.map((o) => (
                    <MenuItem key={o.id} value={o.id}>{o.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </CardContent>
          </Card>

          {/* Scheduling & Conflicts */}
          {!isNew && (change.plannedStartAt || change.plannedEndAt || conflicts.length > 0) && (
            <Card sx={{ mb: 2 }}>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }} onClick={() => setShowConflictsSection(!showConflictsSection)}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="h6">Scheduling</Typography>
                    {conflicts.length > 0 && (
                      <Badge badgeContent={conflicts.length} color="error">
                        <WarningIcon color="error" fontSize="small" />
                      </Badge>
                    )}
                  </Box>
                  <IconButton size="small">
                    {showConflictsSection ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                  </IconButton>
                </Box>
                <Collapse in={showConflictsSection}>
                  {change.plannedStartAt && (
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      Planned Start: {new Date(change.plannedStartAt).toLocaleString()}
                    </Typography>
                  )}
                  {change.plannedEndAt && (
                    <Typography variant="body2" color="text.secondary">
                      Planned End: {new Date(change.plannedEndAt).toLocaleString()}
                    </Typography>
                  )}
                  {conflicts.length > 0 && (
                    <Box sx={{ mt: 1.5 }}>
                      <Divider sx={{ mb: 1 }} />
                      <Typography variant="subtitle2" color="error.main" gutterBottom>
                        {conflicts.length} Conflict{conflicts.length !== 1 ? 's' : ''} Detected
                      </Typography>
                      <List dense disablePadding>
                        {conflicts.map(c => (
                          <ListItem key={c.id} disableGutters sx={{ py: 0.25 }}>
                            <ListItemText
                              primary={
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                  <Chip label={c.conflictType} size="small" color={c.conflictType === 'FREEZE_WINDOW' ? 'error' : c.conflictType === 'OVERLAP' ? 'warning' : 'default'} variant="outlined" />
                                  <Chip label={c.severity} size="small" color={c.severity === 'CRITICAL' ? 'error' : c.severity === 'HIGH' ? 'warning' : 'default'} variant="outlined" />
                                </Box>
                              }
                              secondary={
                                c.conflictingEvent?.title || c.conflictingFreeze?.name || (c.details as Record<string, string>)?.reason || 'Scheduling conflict'
                              }
                            />
                          </ListItem>
                        ))}
                      </List>
                    </Box>
                  )}
                  {conflicts.length === 0 && change.plannedStartAt && change.plannedEndAt && (
                    <Typography variant="body2" color="success.main" sx={{ mt: 1 }}>
                      No scheduling conflicts detected
                    </Typography>
                  )}
                  {change.id && (
                    <Button
                      size="small"
                      startIcon={<RefreshIcon />}
                      onClick={async () => {
                        setRefreshingConflicts(true);
                        try {
                          await itsmApi.changes.refreshConflicts(change.id!);
                          const resp = await itsmApi.changes.conflicts(change.id!);
                          const d = resp.data as { data?: ItsmCalendarConflictData[] };
                          if (d?.data) setConflicts(Array.isArray(d.data) ? d.data : []);
                          showNotification('Conflicts refreshed', 'success');
                        } catch {
                          showNotification('Failed to refresh conflicts', 'error');
                        } finally {
                          setRefreshingConflicts(false);
                        }
                      }}
                      disabled={refreshingConflicts}
                      sx={{ mt: 1 }}
                    >
                      {refreshingConflicts ? 'Refreshing...' : 'Refresh Conflicts'}
                    </Button>
                  )}
                </Collapse>
              </CardContent>
            </Card>
          )}

          {/* Risk Assessment Tab */}
          {!isNew && (
            <Card sx={{ mb: 2 }}>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }} onClick={() => setShowRiskTab(!showRiskTab)}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="h6">Risk Assessment</Typography>
                    {riskAssessment && (
                      <Chip
                        label={`${riskAssessment.riskScore} - ${riskAssessment.riskLevel}`}
                        size="small"
                        color={
                          riskAssessment.riskLevel === 'CRITICAL' ? 'error'
                          : riskAssessment.riskLevel === 'HIGH' ? 'warning'
                          : riskAssessment.riskLevel === 'MEDIUM' ? 'info'
                          : 'success'
                        }
                      />
                    )}
                  </Box>
                  <IconButton size="small">
                    {showRiskTab ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                  </IconButton>
                </Box>
                <Collapse in={showRiskTab}>
                  {riskAssessment ? (
                    <Box sx={{ mt: 1.5 }}>
                      {/* Score gauge */}
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                        <Box sx={{ position: 'relative', display: 'inline-flex' }}>
                          <CircularProgress
                            variant="determinate"
                            value={riskAssessment.riskScore}
                            size={80}
                            thickness={6}
                            color={
                              riskAssessment.riskLevel === 'CRITICAL' ? 'error'
                              : riskAssessment.riskLevel === 'HIGH' ? 'warning'
                              : riskAssessment.riskLevel === 'MEDIUM' ? 'info'
                              : 'success'
                            }
                          />
                          <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Typography variant="h6" fontWeight={700}>
                              {riskAssessment.riskScore}
                            </Typography>
                          </Box>
                        </Box>
                        <Box>
                          <Typography variant="body2" color="text.secondary">
                            Computed: {new Date(riskAssessment.computedAt).toLocaleString()}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {riskAssessment.impactedCiCount} CIs, {riskAssessment.impactedServiceCount} services impacted
                          </Typography>
                        </Box>
                      </Box>

                      {/* Breakdown list */}
                      <Divider sx={{ mb: 1.5 }} />
                      <Typography variant="subtitle2" gutterBottom>Factor Breakdown</Typography>
                      <List dense disablePadding>
                        {(riskAssessment.breakdown || []).map((factor: RiskFactorData) => (
                          <ListItem key={factor.name} disableGutters sx={{ py: 0.25 }}>
                            <ListItemText
                              primary={
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <Typography variant="body2" fontWeight={500}>
                                    {factor.name}
                                  </Typography>
                                  <Typography variant="body2" color="text.secondary">
                                    {factor.weightedScore.toFixed(1)} pts ({factor.weight}% x {factor.score})
                                  </Typography>
                                </Box>
                              }
                              secondary={
                                <Box sx={{ mt: 0.25 }}>
                                  <Box sx={{ width: '100%', height: 4, bgcolor: 'grey.200', borderRadius: 2 }}>
                                    <Box sx={{
                                      width: `${Math.min(factor.score, 100)}%`,
                                      height: '100%',
                                      bgcolor: factor.score >= 75 ? 'error.main' : factor.score >= 50 ? 'warning.main' : factor.score >= 25 ? 'info.main' : 'success.main',
                                      borderRadius: 2,
                                    }} />
                                  </Box>
                                  <Typography variant="caption" color="text.secondary">
                                    {factor.evidence}
                                  </Typography>
                                </Box>
                              }
                            />
                          </ListItem>
                        ))}
                      </List>

                      {/* Warnings */}
                      {(riskAssessment.hasFreezeConflict || riskAssessment.hasSlaRisk) && (
                        <Box sx={{ mt: 1.5 }}>
                          <Divider sx={{ mb: 1 }} />
                          {riskAssessment.hasFreezeConflict && (
                            <Chip
                              icon={<WarningIcon />}
                              label="Change overlaps with a freeze window"
                              color="error"
                              variant="outlined"
                              size="small"
                              sx={{ mr: 0.5, mb: 0.5 }}
                            />
                          )}
                          {riskAssessment.hasSlaRisk && (
                            <Chip
                              icon={<WarningIcon />}
                              label="SLA breach risk during change window"
                              color="warning"
                              variant="outlined"
                              size="small"
                              sx={{ mb: 0.5 }}
                            />
                          )}
                        </Box>
                      )}
                    </Box>
                  ) : (
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      No risk assessment computed yet. Click Recalculate to generate one.
                    </Typography>
                  )}
                  <Button
                    size="small"
                    startIcon={<RefreshIcon />}
                    onClick={async () => {
                      if (!change.id) return;
                      setRecalculating(true);
                      try {
                        const resp = await itsmApi.changes.recalculateRisk(change.id);
                        const d = resp.data as { data?: { assessment?: RiskAssessmentData } };
                        if (d?.data?.assessment) {
                          setRiskAssessment(d.data.assessment);
                        }
                        showNotification('Risk recalculated', 'success');
                      } catch {
                        showNotification('Failed to recalculate risk', 'error');
                      } finally {
                        setRecalculating(false);
                      }
                    }}
                    disabled={recalculating}
                    sx={{ mt: 1.5 }}
                  >
                    {recalculating ? 'Recalculating...' : 'Recalculate Risk'}
                  </Button>
                </Collapse>
              </CardContent>
            </Card>
          )}

          {/* Topology Impact Intelligence Panel */}
          {!isNew && (
            <Card sx={{ mb: 2 }} data-testid="topology-impact-section">
              <CardContent>
                <Box
                  sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                  onClick={() => setShowTopologySection(!showTopologySection)}
                >
                  <Typography variant="h6">Topology Impact Intelligence</Typography>
                  <IconButton size="small">
                    {showTopologySection ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                  </IconButton>
                </Box>
                <Collapse in={showTopologySection}>
                  <Box sx={{ mt: 1 }}>
                    <TopologyImpactSummaryCard
                      impact={topologyImpact}
                      loading={topologyLoading}
                      error={topologyError}
                      onRecalculate={handleRecalculateTopology}
                      recalculating={topologyRecalculating}
                      onRetry={fetchTopologyImpact}
                    />
                    {topologyImpact && (
                      <Box sx={{ mt: 2 }}>
                        <TopologyExplainabilityPanel
                          impact={topologyImpact}
                          loading={topologyLoading}
                        />
                      </Box>
                    )}
                  </Box>
                </Collapse>
              </CardContent>
            </Card>
          )}

          {/* Topology Governance Decision Support Panel */}
          {!isNew && (
            <Box sx={{ mb: 2 }} data-testid="topology-governance-section">
              <TopologyGovernanceDecisionPanel
                governance={governanceData}
                loading={governanceLoading}
                error={governanceEvalError}
                onReEvaluate={handleEvaluateGovernance}
                reEvaluating={governanceReEvaluating}
              />
            </Box>
          )}

          {/* Topology Guardrails Panel (Phase B: Actionable UX) */}
          {!isNew && change.id && (
            <TopologyGuardrailsPanel
              changeId={change.id}
              onFetch={async (cId: string) => {
                const resp = await itsmApi.changes.getTopologyGuardrails(cId);
                const d = resp?.data as { data?: TopologyGuardrailEvaluationData } | TopologyGuardrailEvaluationData;
                const raw = (d && 'data' in d && d.data) ? d.data : (d && 'guardrailStatus' in d) ? d : null;
                // Normalize at boundary — null means "not yet evaluated" (panel handles this state)
                const normalized = normalizeGuardrailEvaluationResponse(raw as Record<string, unknown> | null);
                if (!normalized) throw new Error('Guardrails have not been evaluated for this change yet.');
                return normalized;
              }}
              onRecalculate={async (cId: string) => {
                const resp = await itsmApi.changes.recalculateTopologyGuardrails(cId);
                const d = resp?.data as { data?: TopologyGuardrailEvaluationData } | TopologyGuardrailEvaluationData;
                const raw = (d && 'data' in d && d.data) ? d.data : (d && 'guardrailStatus' in d) ? d : null;
                // Normalize at boundary — null means "not yet evaluated" (panel handles this state)
                const normalized = normalizeGuardrailEvaluationResponse(raw as Record<string, unknown> | null);
                if (!normalized) throw new Error('Guardrail recalculation returned no data. Please try again.');
                return normalized;
              }}
            />
          )}

          {/* Topology Governance Warning */}
          {!isNew && topologyImpact && (() => {
            const topoLevel = getTopologyRiskLevel(topologyImpact.topologyRiskScore);
            if (topoLevel !== 'CRITICAL' && topoLevel !== 'HIGH') return null;
            const missingImpl = !change.implementationPlan?.trim();
            const missingBackout = !change.backoutPlan?.trim();
            return (
              <Alert
                severity="warning"
                sx={{ mb: 2 }}
                data-testid="topology-governance-warning"
              >
                <Typography variant="body2" fontWeight={500}>
                  Topology analysis indicates {topoLevel} risk. CAB review is strongly recommended.
                </Typography>
                {(missingImpl || missingBackout) && (
                  <Typography variant="caption" color="text.secondary">
                    {missingImpl && 'Implementation plan is missing. '}
                    {missingBackout && 'Backout plan is missing. '}
                    Complete these before requesting approval.
                  </Typography>
                )}
              </Alert>
            );
          })()}

          {/* Change Governance Banner */}
          {!isNew && change.id && (
            <GovernanceBanner changeId={change.id} />
          )}

          {/* Customer Risk Intelligence Panel */}
          {!isNew && change.id && (
            <CustomerRiskIntelligence changeId={change.id} />
          )}

          {/* Suggested Task Pack (Phase 3) */}
          {!isNew && change.id && (
            <SuggestedTaskPackCard
              changeId={change.id}
              onFetch={async (cId: string) => {
                const resp = await itsmApi.changes.getSuggestedTaskPack(cId);
                const d = resp?.data as { data?: SuggestedTaskPackResponseData } | SuggestedTaskPackResponseData;
                const raw = (d && 'data' in d && d.data) ? d.data : (d && 'changeId' in d) ? d : null;
                // Normalize at boundary to guarantee safe tasks[], warnings[], etc.
                return normalizeSuggestedTaskPackResponse(raw as Record<string, unknown> | null);
              }}
            />
          )}

          {/* Traceability Chain (Phase 3) */}
          {!isNew && change.id && (
            <TraceabilityChainWidget
              recordId={change.id}
              recordType="CHANGE"
              onFetch={async (cId: string) => {
                const resp = await itsmApi.changes.getTraceabilitySummary(cId);
                const d = resp?.data as { data?: TraceabilitySummaryResponseData } | TraceabilitySummaryResponseData;
                const raw = (d && 'data' in d && d.data) ? d.data : (d && 'rootId' in d) ? d : null;
                // Normalize at boundary to guarantee safe metrics/nodes/edges
                const normalized = normalizeTraceabilitySummaryResponse(raw as Record<string, unknown> | null);
                if (!normalized) throw new Error('Traceability data is not available for this change.');
                return normalized;
              }}
            />
          )}

          {/* Timestamps */}
          {!isNew && (
            <Card sx={{ mb: 2 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Timeline
                </Typography>
                {change.actualStartAt && (
                  <Typography variant="body2" color="text.secondary">
                    Actual Start: {new Date(change.actualStartAt).toLocaleString()}
                  </Typography>
                )}
                {change.actualEndAt && (
                  <Typography variant="body2" color="text.secondary">
                    Actual End: {new Date(change.actualEndAt).toLocaleString()}
                  </Typography>
                )}
                <Divider sx={{ my: 1 }} />
                <Typography variant="body2" color="text.secondary">
                  Created: {new Date(change.createdAt || '').toLocaleString()}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Updated: {new Date(change.updatedAt || '').toLocaleString()}
                </Typography>
              </CardContent>
            </Card>
          )}

          {/* CAB Approvals */}
          {!isNew && approvals.length > 0 && (
            <Card sx={{ mb: 2 }}>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }} onClick={() => setShowApprovals(!showApprovals)}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="h6">CAB Approvals</Typography>
                    <Chip
                      label={approvals.length}
                      size="small"
                      color={anyRejected ? 'error' : allApproved ? 'success' : hasRequestedApprovals ? 'warning' : 'default'}
                    />
                  </Box>
                  <IconButton size="small">
                    {showApprovals ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                  </IconButton>
                </Box>
                <Collapse in={showApprovals}>
                  <List dense disablePadding>
                    {approvals.map((a) => (
                      <ListItem key={a.id} disableGutters sx={{ py: 0.5 }}>
                        <ListItemText
                          primary={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <Chip
                                label={a.state}
                                size="small"
                                color={a.state === 'APPROVED' ? 'success' : a.state === 'REJECTED' ? 'error' : a.state === 'REQUESTED' ? 'warning' : 'default'}
                                variant="outlined"
                              />
                              <Typography variant="body2" fontWeight={500}>
                                {a.approverRole}
                              </Typography>
                            </Box>
                          }
                          secondary={
                            <Box component="span">
                              {a.decidedAt && (
                                <Typography variant="caption" color="text.secondary" component="span">
                                  {new Date(a.decidedAt).toLocaleString()}
                                </Typography>
                              )}
                              {a.comment && (
                                <Typography variant="caption" color="text.secondary" component="span" sx={{ ml: 0.5 }}>
                                  - {a.comment}
                                </Typography>
                              )}
                            </Box>
                          }
                        />
                        {a.state === 'REQUESTED' && (
                          <Box sx={{ display: 'flex', gap: 0.5 }}>
                            <IconButton
                              size="small"
                              color="success"
                              onClick={() => openApprovalDialog('approve', a.id)}
                              data-testid={`approve-btn-${a.id}`}
                            >
                              <CheckCircleIcon fontSize="small" />
                            </IconButton>
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => openApprovalDialog('reject', a.id)}
                              data-testid={`reject-btn-${a.id}`}
                            >
                              <CancelIcon fontSize="small" />
                            </IconButton>
                          </Box>
                        )}
                      </ListItem>
                    ))}
                  </List>
                </Collapse>
              </CardContent>
            </Card>
          )}

          {/* GRC Bridge - Linked Risks */}
          {!isNew && (
            <Card sx={{ mb: 2 }} data-testid="linked-risks-section">
              <CardContent>
                <Box
                  sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                  onClick={() => setShowRisksSection(!showRisksSection)}
                >
                  <Typography variant="h6">
                    Linked Risks ({linkedRisks.length})
                  </Typography>
                  <IconButton size="small">
                    {showRisksSection ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                  </IconButton>
                </Box>
                <Collapse in={showRisksSection}>
                  {linkedRisksError ? (
                    <Alert severity="warning" sx={{ mt: 1 }} data-testid="linked-risks-error">
                      {linkedRisksError}
                    </Alert>
                  ) : linkedRisks.length === 0 ? (
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      No linked risks
                    </Typography>
                  ) : (
                    <List dense>
                      {linkedRisks.map((risk) => (
                        <ListItem
                          key={risk.id}
                          secondaryAction={
                            <IconButton edge="end" size="small" onClick={() => handleUnlinkRisk(risk.id)}>
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          }
                        >
                          <ListItemText
                            primary={risk.code}
                            secondary={risk.name}
                          />
                        </ListItem>
                      ))}
                    </List>
                  )}
                </Collapse>
              </CardContent>
            </Card>
          )}

          {/* GRC Bridge - Linked Controls */}
          {!isNew && (
            <Card data-testid="linked-controls-section">
              <CardContent>
                <Box
                  sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                  onClick={() => setShowControlsSection(!showControlsSection)}
                >
                  <Typography variant="h6">
                    Linked Controls ({linkedControls.length})
                  </Typography>
                  <IconButton size="small">
                    {showControlsSection ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                  </IconButton>
                </Box>
                <Collapse in={showControlsSection}>
                  {linkedControlsError ? (
                    <Alert severity="warning" sx={{ mt: 1 }} data-testid="linked-controls-error">
                      {linkedControlsError}
                    </Alert>
                  ) : linkedControls.length === 0 ? (
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      No linked controls
                    </Typography>
                  ) : (
                    <List dense>
                      {linkedControls.map((control) => (
                        <ListItem
                          key={control.id}
                          secondaryAction={
                            <IconButton edge="end" size="small" onClick={() => handleUnlinkControl(control.id)}>
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          }
                        >
                          <ListItemText
                            primary={control.code}
                            secondary={control.name}
                          />
                        </ListItem>
                      ))}
                    </List>
                  )}
                </Collapse>
              </CardContent>
            </Card>
          )}
        </Grid>
      </Grid>

      {/* CAB Summary Section */}
      {!isNew && change.id && (
        <Card sx={{ mt: 2 }} data-testid="cab-summary-section">
          <CardContent>
            <Box
              sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
              onClick={() => setShowCabSection(!showCabSection)}
            >
              <Typography variant="h6">
                CAB Decisions
              </Typography>
              <IconButton size="small">
                {showCabSection ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              </IconButton>
            </Box>
            <Collapse in={showCabSection}>
              {cabSummary && cabSummary.latestDecision ? (
                <Box sx={{ mt: 1 }}>
                  <Chip
                    label={cabSummary.latestDecision.decisionStatus}
                    size="small"
                    color={
                      cabSummary.latestDecision.decisionStatus === 'APPROVED' ? 'success' :
                      cabSummary.latestDecision.decisionStatus === 'REJECTED' ? 'error' :
                      cabSummary.latestDecision.decisionStatus === 'DEFERRED' ? 'warning' :
                      cabSummary.latestDecision.decisionStatus === 'CONDITIONAL' ? 'info' : 'default'
                    }
                    sx={{ mr: 1 }}
                  />
                  <Typography variant="body2" sx={{ mt: 1 }}>
                    Meeting: {cabSummary.latestDecision.meetingCode} — {cabSummary.latestDecision.meetingTitle}
                  </Typography>
                  {cabSummary.latestDecision.decisionNote && (
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                      Note: {cabSummary.latestDecision.decisionNote}
                    </Typography>
                  )}
                </Box>
              ) : (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  No CAB decisions recorded for this change
                </Typography>
              )}
              {cabSummary && cabSummary.meetings && cabSummary.meetings.length > 0 && (
                <Box sx={{ mt: 1 }}>
                  <Typography variant="subtitle2" sx={{ mt: 1 }}>Linked Meetings ({cabSummary.meetings.length})</Typography>
                  <List dense>
                    {cabSummary.meetings.map((m) => (
                      <ListItem key={m.id} sx={{ py: 0 }}>
                        <ListItemText
                          primary={`${m.code} — ${m.title}`}
                          secondary={`${m.status} · ${m.meetingAt ? new Date(m.meetingAt).toLocaleString() : '-'}`}
                        />
                      </ListItem>
                    ))}
                  </List>
                </Box>
              )}
            </Collapse>
          </CardContent>
        </Card>
      )}

      {/* Affected CIs Section */}
      {!isNew && change.id && (
        <ChangeAffectedCisSection changeId={change.id} showNotification={showNotification} />
      )}

      {/* Change Tasks Section */}
      {!isNew && change.id && (
        <Box sx={{ mt: 2 }}>
          <ChangeTasksSection changeId={change.id} showNotification={showNotification} />
        </Box>
      )}

      {!isNew && change.id && (
        <Box sx={{ mt: 3 }}>
          <ActivityStream table="changes" recordId={change.id} />
        </Box>
      )}

      {/* Approve/Reject Dialog */}
      <Dialog open={approvalDialogOpen} onClose={() => setApprovalDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {approvalDialogMode === 'approve' ? 'Approve Change' : 'Reject Change'}
        </DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            multiline
            rows={3}
            label="Comment (optional)"
            value={approvalComment}
            onChange={(e) => setApprovalComment(e.target.value)}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setApprovalDialogOpen(false)} disabled={approvalBusy}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color={approvalDialogMode === 'approve' ? 'success' : 'error'}
            onClick={handleApprovalDecision}
            disabled={approvalBusy}
            data-testid="confirm-approval-btn"
          >
            {approvalBusy ? 'Processing...' : approvalDialogMode === 'approve' ? 'Approve' : 'Reject'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ItsmChangeDetail;
