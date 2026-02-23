import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  Chip,
  Card,
  CardContent,
  Grid,
  Tab,
  Tabs,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  CircularProgress,
  Divider,
  IconButton,
  Tooltip,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Timeline as TimelineIcon,
  Link as LinkIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
} from '@mui/icons-material';
import {
  itsmApi,
  pirApi,
  pirActionApi,
  knowledgeCandidateApi,
  ItsmMajorIncidentData,
  ItsmMajorIncidentUpdateData,
  ItsmMajorIncidentLinkData,
  UpdateItsmMajorIncidentDto,
  CreateItsmMajorIncidentUpdateDto,
  CreateItsmMajorIncidentLinkDto,
  ItsmPirData,
  ItsmPirActionData,
  ItsmKnowledgeCandidateData,
  CreateItsmPirDto,
  UpdateItsmPirDto,
  CreateItsmPirActionDto,
  UpdateItsmPirActionDto,
  RcaTopologyHypothesesResponseData,
  RcaHypothesisData,
  CreateProblemFromHypothesisRequest,
  CreateKnownErrorFromHypothesisRequest,
  CreatePirActionFromHypothesisRequest,
  TraceabilitySummaryResponseData,
  RcaDecisionsSummaryData,
  HypothesisDecisionStatus,
  normalizeRcaDecisionsSummary,
} from '../../services/grcClient';
import { useNotification } from '../../contexts/NotificationContext';
import {
  TopologyRcaHypothesesTable,
  TopologyRcaCompareDialog,
  TopologyInsightBanner,
  TraceabilityChainWidget,
  classifyTopologyApiError,
  unwrapTopologyResponse,
  normalizeRcaResponse,
  normalizeTraceabilitySummaryResponse,
  type ClassifiedTopologyError,
} from '../../components/topology-intelligence';

const statusColors: Record<string, 'default' | 'info' | 'warning' | 'success' | 'error'> = {
  DECLARED: 'error',
  INVESTIGATING: 'warning',
  MITIGATING: 'warning',
  MONITORING: 'info',
  RESOLVED: 'success',
  PIR_PENDING: 'info',
  CLOSED: 'default',
};

const VALID_TRANSITIONS: Record<string, string[]> = {
  DECLARED: ['INVESTIGATING'],
  INVESTIGATING: ['MITIGATING', 'MONITORING', 'RESOLVED'],
  MITIGATING: ['MONITORING', 'INVESTIGATING', 'RESOLVED'],
  MONITORING: ['RESOLVED', 'INVESTIGATING', 'MITIGATING'],
  RESOLVED: ['PIR_PENDING', 'CLOSED', 'INVESTIGATING'],
  PIR_PENDING: ['CLOSED'],
  CLOSED: [],
};

const UPDATE_TYPE_OPTIONS = [
  { value: 'TECHNICAL_UPDATE', label: 'Technical Update' },
  { value: 'STAKEHOLDER_UPDATE', label: 'Stakeholder Update' },
  { value: 'DECISION', label: 'Decision' },
  { value: 'ESCALATION', label: 'Escalation' },
  { value: 'COMMUNICATION', label: 'Communication' },
  { value: 'ACTION_TAKEN', label: 'Action Taken' },
  { value: 'BRIDGE_NOTE', label: 'Bridge Note' },
];

const LINK_TYPE_OPTIONS = [
  { value: 'INCIDENT', label: 'Incident' },
  { value: 'CHANGE', label: 'Change' },
  { value: 'PROBLEM', label: 'Problem' },
  { value: 'CMDB_SERVICE', label: 'CMDB Service' },
  { value: 'CMDB_OFFERING', label: 'CMDB Offering' },
  { value: 'CMDB_CI', label: 'CMDB CI' },
];

function toDisplayLabel(val: string): string {
  return val.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

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

export const ItsmMajorIncidentDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showNotification } = useNotification();

  const [mi, setMi] = useState<ItsmMajorIncidentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tabIndex, setTabIndex] = useState(0);

  // Edit mode
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<UpdateItsmMajorIncidentDto>({});
  const [saving, setSaving] = useState(false);

  // Timeline
  const [timeline, setTimeline] = useState<ItsmMajorIncidentUpdateData[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(false);

  // Links
  const [links, setLinks] = useState<ItsmMajorIncidentLinkData[]>([]);
  const [linksLoading, setLinksLoading] = useState(false);

  // Timeline post dialog
  const [timelineDialogOpen, setTimelineDialogOpen] = useState(false);
  const [timelineMessage, setTimelineMessage] = useState('');
  const [timelineType, setTimelineType] = useState('TECHNICAL_UPDATE');
  const [timelineVisibility, setTimelineVisibility] = useState('INTERNAL');
  const [postingUpdate, setPostingUpdate] = useState(false);

  // Link dialog
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkType, setLinkType] = useState('INCIDENT');
  const [linkRecordId, setLinkRecordId] = useState('');
  const [linkLabel, setLinkLabel] = useState('');
  const [linkNotes, setLinkNotes] = useState('');
  const [linkingRecord, setLinkingRecord] = useState(false);

  // Status change dialog
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [newStatus, setNewStatus] = useState('');
  const [resolutionSummary, setResolutionSummary] = useState('');
  const [changingStatus, setChangingStatus] = useState(false);

  // PIR state
  const [pir, setPir] = useState<ItsmPirData | null>(null);
  const [pirLoading, setPirLoading] = useState(false);
  const [pirError, setPirError] = useState<string | null>(null);
  const [pirEditing, setPirEditing] = useState(false);
  const [pirForm, setPirForm] = useState<UpdateItsmPirDto>({});
  const [pirSaving, setPirSaving] = useState(false);
  const [creatingPir, setCreatingPir] = useState(false);

  // PIR Actions state
  const [pirActions, setPirActions] = useState<ItsmPirActionData[]>([]);
  const [pirActionsLoading, setPirActionsLoading] = useState(false);
  const [actionDialogOpen, setActionDialogOpen] = useState(false);
  const [actionForm, setActionForm] = useState<CreateItsmPirActionDto>({ pirId: '', title: '' });
  const [actionSaving, setActionSaving] = useState(false);
  const [actionFilter, setActionFilter] = useState<string>('');

  // Knowledge Candidate state
  const [knowledgeCandidates, setKnowledgeCandidates] = useState<ItsmKnowledgeCandidateData[]>([]);
  const [kcLoading, setKcLoading] = useState(false);
  const [generatingKc, setGeneratingKc] = useState(false);
  const [selectedKc, setSelectedKc] = useState<ItsmKnowledgeCandidateData | null>(null);

  // RCA Topology Intelligence state
  const [rcaData, setRcaData] = useState<RcaTopologyHypothesesResponseData | null>(null);
  const [rcaLoading, setRcaLoading] = useState(false);
  const [rcaError, setRcaError] = useState<ClassifiedTopologyError | null>(null);
  const [rcaRecalculating, setRcaRecalculating] = useState(false);
  const [rcaCompareOpen, setRcaCompareOpen] = useState(false);
  const [rcaCompareHypotheses, setRcaCompareHypotheses] = useState<[RcaHypothesisData, RcaHypothesisData] | null>(null);
  const rcaMountedRef = useRef(true);

  // RCA Hypothesis Decisions state (Phase C)
  const [rcaDecisionsSummary, setRcaDecisionsSummary] = useState<RcaDecisionsSummaryData | null>(null);
  const [rcaDecisionLoading, setRcaDecisionLoading] = useState(false);

  const fetchMi = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const response = await itsmApi.majorIncidents.get(id);
      const data = (response.data as { data?: ItsmMajorIncidentData })?.data;
      if (data) {
        setMi(data);
      } else {
        setError('Major Incident not found');
      }
    } catch (err) {
      console.error('Error fetching major incident:', err);
      setError('Failed to load major incident');
    } finally {
      setLoading(false);
    }
  }, [id]);

  const fetchTimeline = useCallback(async () => {
    if (!id) return;
    setTimelineLoading(true);
    try {
      const response = await itsmApi.majorIncidents.getTimeline(id);
      const data = response.data as Record<string, unknown>;
      if (data && 'items' in data && Array.isArray(data.items)) {
        setTimeline(data.items as ItsmMajorIncidentUpdateData[]);
      }
    } catch (err) {
      console.error('Error fetching timeline:', err);
    } finally {
      setTimelineLoading(false);
    }
  }, [id]);

  const fetchLinks = useCallback(async () => {
    if (!id) return;
    setLinksLoading(true);
    try {
      const response = await itsmApi.majorIncidents.getLinks(id);
      const data = (response.data as { data?: ItsmMajorIncidentLinkData[] })?.data;
      if (Array.isArray(data)) {
        setLinks(data);
      }
    } catch (err) {
      console.error('Error fetching links:', err);
    } finally {
      setLinksLoading(false);
    }
  }, [id]);

  const fetchPir = useCallback(async () => {
    if (!id) return;
    setPirLoading(true);
    setPirError(null);
    try {
      const response = await pirApi.getByMajorIncident(id);
      const data = response.data as Record<string, unknown>;
      if (data && 'items' in data && Array.isArray(data.items) && data.items.length > 0) {
        setPir(data.items[0] as ItsmPirData);
      } else if (data && 'data' in data) {
        const inner = data.data;
        if (Array.isArray(inner) && inner.length > 0) {
          setPir(inner[0] as ItsmPirData);
        }
      }
    } catch (err) {
      console.error('Error fetching PIR:', err);
      setPirError('Failed to load PIR');
    } finally {
      setPirLoading(false);
    }
  }, [id]);

  const fetchPirActions = useCallback(async (pirId: string) => {
    setPirActionsLoading(true);
    try {
      const response = await pirActionApi.list({ pirId, pageSize: 100 });
      const data = response.data as Record<string, unknown>;
      if (data && 'items' in data && Array.isArray(data.items)) {
        setPirActions(data.items as ItsmPirActionData[]);
      }
    } catch (err) {
      console.error('Error fetching PIR actions:', err);
    } finally {
      setPirActionsLoading(false);
    }
  }, []);

  const fetchKnowledgeCandidates = useCallback(async (pirId: string) => {
    setKcLoading(true);
    try {
      const response = await knowledgeCandidateApi.list({ sourceType: 'PIR' });
      const data = response.data as Record<string, unknown>;
      if (data && 'items' in data && Array.isArray(data.items)) {
        setKnowledgeCandidates(
          (data.items as ItsmKnowledgeCandidateData[]).filter(kc => kc.sourceId === pirId)
        );
      }
    } catch (err) {
      console.error('Error fetching knowledge candidates:', err);
    } finally {
      setKcLoading(false);
    }
  }, []);

  const handleCreatePir = async () => {
    if (!id || !mi) return;
    setCreatingPir(true);
    try {
      const dto: CreateItsmPirDto = {
        majorIncidentId: id,
        title: `PIR: ${mi.title}`,
        summary: mi.resolutionSummary || '',
      };
      const response = await pirApi.create(dto);
      const created = (response.data as { data?: ItsmPirData })?.data;
      if (created) {
        setPir(created);
        showNotification('PIR created successfully', 'success');
      }
    } catch (err) {
      const axErr = err as { response?: { data?: { message?: string } } };
      showNotification(axErr.response?.data?.message || 'Failed to create PIR', 'error');
    } finally {
      setCreatingPir(false);
    }
  };

  const handlePirSave = async () => {
    if (!pir) return;
    setPirSaving(true);
    try {
      await pirApi.update(pir.id, pirForm);
      showNotification('PIR updated', 'success');
      setPirEditing(false);
      fetchPir();
    } catch (err) {
      const axErr = err as { response?: { data?: { message?: string } } };
      showNotification(axErr.response?.data?.message || 'Failed to update PIR', 'error');
    } finally {
      setPirSaving(false);
    }
  };

  const handlePirStatusChange = async (newPirStatus: string) => {
    if (!pir) return;
    try {
      if (newPirStatus === 'APPROVED') {
        await pirApi.approve(pir.id);
      } else {
        await pirApi.update(pir.id, { status: newPirStatus as UpdateItsmPirDto['status'] });
      }
      showNotification(`PIR status changed to ${newPirStatus}`, 'success');
      fetchPir();
    } catch (err) {
      const axErr = err as { response?: { data?: { message?: string } } };
      showNotification(axErr.response?.data?.message || 'Failed to change PIR status', 'error');
    }
  };

  const handleCreateAction = async () => {
    if (!pir) return;
    setActionSaving(true);
    try {
      await pirActionApi.create({ ...actionForm, pirId: pir.id });
      showNotification('Action created', 'success');
      setActionDialogOpen(false);
      setActionForm({ pirId: '', title: '' });
      fetchPirActions(pir.id);
    } catch (err) {
      const axErr = err as { response?: { data?: { message?: string } } };
      showNotification(axErr.response?.data?.message || 'Failed to create action', 'error');
    } finally {
      setActionSaving(false);
    }
  };

  const handleUpdateActionStatus = async (actionId: string, newActionStatus: string) => {
    try {
      await pirActionApi.update(actionId, { status: newActionStatus as UpdateItsmPirActionDto['status'] });
      showNotification('Action updated', 'success');
      if (pir) fetchPirActions(pir.id);
    } catch (err) {
      const axErr = err as { response?: { data?: { message?: string } } };
      showNotification(axErr.response?.data?.message || 'Failed to update action', 'error');
    }
  };

  const handleGenerateKc = async () => {
    if (!pir) return;
    setGeneratingKc(true);
    try {
      const response = await knowledgeCandidateApi.generateFromPir(pir.id);
      const created = (response.data as { data?: ItsmKnowledgeCandidateData })?.data;
      if (created) {
        showNotification('Knowledge Candidate generated', 'success');
        fetchKnowledgeCandidates(pir.id);
      }
    } catch (err) {
      const axErr = err as { response?: { data?: { message?: string } } };
      showNotification(axErr.response?.data?.message || 'Failed to generate knowledge candidate', 'error');
    } finally {
      setGeneratingKc(false);
    }
  };

  const handleKcAction = async (kcId: string, action: 'review' | 'publish' | 'reject') => {
    try {
      if (action === 'review') await knowledgeCandidateApi.review(kcId);
      else if (action === 'publish') await knowledgeCandidateApi.publish(kcId);
      else await knowledgeCandidateApi.reject(kcId);
      showNotification(`Knowledge Candidate ${action}ed`, 'success');
      if (pir) fetchKnowledgeCandidates(pir.id);
    } catch (err) {
      const axErr = err as { response?: { data?: { message?: string } } };
      showNotification(axErr.response?.data?.message || `Failed to ${action} KC`, 'error');
    }
  };

  // RCA Topology Intelligence callbacks
  const fetchRcaHypotheses = useCallback(async () => {
    if (!id) return;
    setRcaLoading(true);
    setRcaError(null);
    try {
      const response = await itsmApi.majorIncidents.getRcaTopologyHypotheses(id);
      if (!rcaMountedRef.current) return;
      const rawData = unwrapTopologyResponse<RcaTopologyHypothesesResponseData>(response);
      const normalized = normalizeRcaResponse(rawData);
      if (normalized) {
        setRcaData(normalized);
      } else {
        // Try direct response shape
        const directData = (response?.data as { data?: RcaTopologyHypothesesResponseData })?.data;
        const normalizedDirect = normalizeRcaResponse(directData);
        if (normalizedDirect) {
          setRcaData(normalizedDirect);
        }
      }
    } catch (err) {
      if (!rcaMountedRef.current) return;
      const classified = classifyTopologyApiError(err);
      setRcaError(classified);
      // Don't trigger logout on 403
      if (classified.type !== 'unauthorized') {
        console.warn('[RCA Topology] Error:', classified.message);
      }
    } finally {
      if (rcaMountedRef.current) {
        setRcaLoading(false);
      }
    }
  }, [id]);

  const handleRecalculateRca = useCallback(async () => {
    if (!id) return;
    setRcaRecalculating(true);
    try {
      const response = await itsmApi.majorIncidents.recalculateRcaTopologyHypotheses(id);
      if (!rcaMountedRef.current) return;
      const rawData = unwrapTopologyResponse<RcaTopologyHypothesesResponseData>(response);
      const normalized = normalizeRcaResponse(rawData);
      if (normalized) {
        setRcaData(normalized);
        showNotification('RCA topology hypotheses recalculated', 'success');
      } else {
        const directData = (response?.data as { data?: RcaTopologyHypothesesResponseData })?.data;
        const normalizedDirect = normalizeRcaResponse(directData);
        if (normalizedDirect) {
          setRcaData(normalizedDirect);
          showNotification('RCA topology hypotheses recalculated', 'success');
        }
      }
    } catch (err) {
      if (!rcaMountedRef.current) return;
      const classified = classifyTopologyApiError(err);
      setRcaError(classified);
      showNotification(classified.message, 'error');
    } finally {
      if (rcaMountedRef.current) {
        setRcaRecalculating(false);
      }
    }
  }, [id, showNotification]);

  const handleCopyHypothesis = useCallback((hypothesis: RcaHypothesisData) => {
    const text = [
      `RCA Hypothesis: ${hypothesis.suspectNodeLabel}`,
      `Type: ${hypothesis.type}`,
      `Confidence: ${(hypothesis.score * 100).toFixed(0)}%`,
      `Explanation: ${hypothesis.explanation}`,
      hypothesis.evidence?.length
        ? `Evidence:\n${hypothesis.evidence.map(e => `  - ${e.description}`).join('\n')}`
        : '',
      hypothesis.recommendedActions?.length
        ? `Actions: ${hypothesis.recommendedActions.map(a => a.label).join('; ')}`
        : '',
    ].filter(Boolean).join('\n');

    navigator.clipboard.writeText(text).then(() => {
      showNotification('Hypothesis copied to clipboard', 'success');
    }).catch(() => {
      showNotification('Failed to copy to clipboard', 'error');
    });
  }, [showNotification]);

  const handleCompareHypotheses = useCallback((h1: RcaHypothesisData, h2: RcaHypothesisData) => {
    setRcaCompareHypotheses([h1, h2]);
    setRcaCompareOpen(true);
  }, []);

  // ---------------------------------------------------------------------------
  // RCA Orchestration handlers (Phase-C, Phase 2)
  // ---------------------------------------------------------------------------
  const handleCreateProblemFromHypothesis = useCallback(
    async (_hypothesis: RcaHypothesisData, data: CreateProblemFromHypothesisRequest) => {
      if (!id) return { error: 'Missing major incident ID' };
      try {
        const response = await itsmApi.majorIncidents.createProblemFromHypothesis(id, data);
        const result = (response.data as { data?: { record?: { id?: string }; summary?: string } })?.data;
        if (result?.record?.id) {
          showNotification(result.summary || 'Problem created from hypothesis', 'success');
          return { recordId: result.record.id };
        }
        return { error: 'Unexpected response from server' };
      } catch (err) {
        const axErr = err as { response?: { data?: { message?: string } } };
        const message = axErr.response?.data?.message || 'Failed to create problem';
        return { error: message };
      }
    },
    [id, showNotification],
  );

  const handleCreateKnownErrorFromHypothesis = useCallback(
    async (_hypothesis: RcaHypothesisData, data: CreateKnownErrorFromHypothesisRequest) => {
      if (!id) return { error: 'Missing major incident ID' };
      try {
        const response = await itsmApi.majorIncidents.createKnownErrorFromHypothesis(id, data);
        const result = (response.data as { data?: { record?: { id?: string }; summary?: string } })?.data;
        if (result?.record?.id) {
          showNotification(result.summary || 'Known Error created from hypothesis', 'success');
          return { recordId: result.record.id };
        }
        return { error: 'Unexpected response from server' };
      } catch (err) {
        const axErr = err as { response?: { data?: { message?: string } } };
        const message = axErr.response?.data?.message || 'Failed to create known error';
        return { error: message };
      }
    },
    [id, showNotification],
  );

  const handleCreatePirActionFromHypothesis = useCallback(
    async (_hypothesis: RcaHypothesisData, data: CreatePirActionFromHypothesisRequest) => {
      if (!id) return { error: 'Missing major incident ID' };
      try {
        const response = await itsmApi.majorIncidents.createPirActionFromHypothesis(id, data);
        const result = (response.data as { data?: { record?: { id?: string }; summary?: string } })?.data;
        if (result?.record?.id) {
          showNotification(result.summary || 'PIR Action created from hypothesis', 'success');
          // Refresh PIR actions if PIR is loaded
          if (pir) fetchPirActions(pir.id);
          return { recordId: result.record.id };
        }
        return { error: 'Unexpected response from server' };
      } catch (err) {
        const axErr = err as { response?: { data?: { message?: string } } };
        const message = axErr.response?.data?.message || 'Failed to create PIR action';
        return { error: message };
      }
    },
    [id, showNotification, pir, fetchPirActions],
  );

  // Phase C: RCA Decision callbacks
  const fetchRcaDecisions = useCallback(async () => {
    if (!id) return;
    try {
      const response = await itsmApi.majorIncidents.getRcaDecisions(id);
      if (!rcaMountedRef.current) return;
      const raw = (response?.data as { data?: Record<string, unknown> })?.data;
      const normalized = normalizeRcaDecisionsSummary(raw);
      if (normalized) {
        setRcaDecisionsSummary(normalized);
      }
    } catch {
      // Non-blocking: decisions fetch failure doesn't block RCA view
      console.warn('[RCA Decisions] Failed to fetch decisions summary');
    }
  }, [id]);

  const handleUpdateHypothesisDecision = useCallback(
    async (hypothesisId: string, status: HypothesisDecisionStatus, reason?: string) => {
      if (!id) return;
      setRcaDecisionLoading(true);
      try {
        await itsmApi.majorIncidents.updateHypothesisDecision(id, hypothesisId, { status, reason });
        showNotification(`Hypothesis ${status.toLowerCase().replace(/_/g, ' ')}`, 'success');
        await fetchRcaDecisions();
      } catch (err) {
        const axErr = err as { response?: { data?: { message?: string } } };
        showNotification(axErr.response?.data?.message || 'Failed to update hypothesis decision', 'error');
      } finally {
        setRcaDecisionLoading(false);
      }
    },
    [id, showNotification, fetchRcaDecisions],
  );

  const handleAddHypothesisNote = useCallback(
    async (hypothesisId: string, content: string, noteType?: string) => {
      if (!id) return;
      setRcaDecisionLoading(true);
      try {
        await itsmApi.majorIncidents.addHypothesisNote(id, hypothesisId, { content, noteType });
        showNotification('Note added', 'success');
        await fetchRcaDecisions();
      } catch (err) {
        const axErr = err as { response?: { data?: { message?: string } } };
        showNotification(axErr.response?.data?.message || 'Failed to add note', 'error');
      } finally {
        setRcaDecisionLoading(false);
      }
    },
    [id, showNotification, fetchRcaDecisions],
  );

  const handleSetSelectedHypothesis = useCallback(
    async (hypothesisId: string, reason?: string) => {
      if (!id) return;
      setRcaDecisionLoading(true);
      try {
        await itsmApi.majorIncidents.setSelectedHypothesis(id, { hypothesisId, reason });
        showNotification('Root cause hypothesis selected', 'success');
        await fetchRcaDecisions();
      } catch (err) {
        const axErr = err as { response?: { data?: { message?: string } } };
        showNotification(axErr.response?.data?.message || 'Failed to set selected hypothesis', 'error');
      } finally {
        setRcaDecisionLoading(false);
      }
    },
    [id, showNotification, fetchRcaDecisions],
  );

  useEffect(() => {
    rcaMountedRef.current = true;
    return () => { rcaMountedRef.current = false; };
  }, []);

  useEffect(() => {
    fetchMi();
  }, [fetchMi]);

  // Non-blocking: fetch RCA data + decisions after main data loads
  useEffect(() => {
    if (mi?.id) {
      fetchRcaHypotheses();
      fetchRcaDecisions();
    }
  }, [mi?.id, fetchRcaHypotheses, fetchRcaDecisions]);

  useEffect(() => {
    if (tabIndex === 1) fetchTimeline();
    if (tabIndex === 2) fetchLinks();
    if (tabIndex === 5) {
      fetchPir();
    }
    if (tabIndex === 6) {
      // Refetch RCA data + decisions when tab is selected (lazy refresh)
      fetchRcaHypotheses();
      fetchRcaDecisions();
    }
  }, [tabIndex, fetchTimeline, fetchLinks, fetchPir, fetchRcaHypotheses, fetchRcaDecisions]);

  useEffect(() => {
    if (pir) {
      fetchPirActions(pir.id);
      fetchKnowledgeCandidates(pir.id);
    }
  }, [pir?.id, fetchPirActions, fetchKnowledgeCandidates]); // eslint-disable-line react-hooks/exhaustive-deps

  const startEditing = () => {
    if (!mi) return;
    setEditForm({
      title: mi.title,
      description: mi.description || '',
      severity: mi.severity,
      commanderId: mi.commanderId || undefined,
      communicationsLeadId: mi.communicationsLeadId || undefined,
      techLeadId: mi.techLeadId || undefined,
      bridgeUrl: mi.bridgeUrl || '',
      bridgeChannel: mi.bridgeChannel || '',
      customerImpactSummary: mi.customerImpactSummary || '',
      businessImpactSummary: mi.businessImpactSummary || '',
    });
    setEditing(true);
  };

  const handleSave = async () => {
    if (!id) return;
    setSaving(true);
    try {
      await itsmApi.majorIncidents.update(id, editForm);
      showNotification('Major Incident updated', 'success');
      setEditing(false);
      fetchMi();
    } catch (err) {
      console.error('Error updating MI:', err);
      showNotification('Failed to update major incident', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async () => {
    if (!id || !newStatus) return;
    setChangingStatus(true);
    try {
      const dto: UpdateItsmMajorIncidentDto = { status: newStatus };
      if (newStatus === 'RESOLVED' && resolutionSummary) {
        dto.resolutionSummary = resolutionSummary;
      }
      await itsmApi.majorIncidents.update(id, dto);
      showNotification(`Status changed to ${toDisplayLabel(newStatus)}`, 'success');
      setStatusDialogOpen(false);
      setNewStatus('');
      setResolutionSummary('');
      fetchMi();
      if (tabIndex === 1) fetchTimeline();
    } catch (err) {
      const axErr = err as { response?: { data?: { message?: string } } };
      const msg = axErr.response?.data?.message || 'Failed to change status';
      showNotification(msg, 'error');
    } finally {
      setChangingStatus(false);
    }
  };

  const handlePostTimelineUpdate = async () => {
    if (!id || !timelineMessage.trim()) return;
    setPostingUpdate(true);
    try {
      const dto: CreateItsmMajorIncidentUpdateDto = {
        message: timelineMessage.trim(),
        updateType: timelineType,
        visibility: timelineVisibility,
      };
      await itsmApi.majorIncidents.postTimelineUpdate(id, dto);
      showNotification('Timeline update posted', 'success');
      setTimelineDialogOpen(false);
      setTimelineMessage('');
      fetchTimeline();
    } catch (err) {
      console.error('Error posting timeline update:', err);
      showNotification('Failed to post timeline update', 'error');
    } finally {
      setPostingUpdate(false);
    }
  };

  const handleLinkRecord = async () => {
    if (!id || !linkRecordId.trim()) return;
    setLinkingRecord(true);
    try {
      const dto: CreateItsmMajorIncidentLinkDto = {
        linkType,
        linkedRecordId: linkRecordId.trim(),
        linkedRecordLabel: linkLabel.trim() || undefined,
        notes: linkNotes.trim() || undefined,
      };
      await itsmApi.majorIncidents.linkRecord(id, dto);
      showNotification('Record linked successfully', 'success');
      setLinkDialogOpen(false);
      setLinkRecordId('');
      setLinkLabel('');
      setLinkNotes('');
      fetchLinks();
    } catch (err) {
      const axErr = err as { response?: { data?: { message?: string } } };
      const msg = axErr.response?.data?.message || 'Failed to link record';
      showNotification(msg, 'error');
    } finally {
      setLinkingRecord(false);
    }
  };

  const handleUnlink = async (linkId: string) => {
    if (!id) return;
    try {
      await itsmApi.majorIncidents.unlinkRecord(id, linkId);
      showNotification('Record unlinked', 'success');
      fetchLinks();
    } catch (err) {
      console.error('Error unlinking record:', err);
      showNotification('Failed to unlink record', 'error');
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error || !mi) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{error || 'Major Incident not found'}</Alert>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/itsm/major-incidents')} sx={{ mt: 2 }}>
          Back to List
        </Button>
      </Box>
    );
  }

  const availableTransitions = VALID_TRANSITIONS[mi.status] || [];

  return (
    <Box data-testid="mi-detail-page">
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
        <Box>
          <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/itsm/major-incidents')} sx={{ mb: 1 }}>
            Back to Major Incidents
          </Button>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography variant="h4" fontWeight={600} data-testid="mi-detail-title">
              {mi.number}: {mi.title}
            </Typography>
            <Chip
              label={toDisplayLabel(mi.status)}
              color={statusColors[mi.status] || 'default'}
              data-testid="mi-detail-status"
            />
            <Chip
              label={mi.severity}
              color={
                mi.severity === 'SEV1' ? 'error' : mi.severity === 'SEV2' ? 'warning' : 'info'
              }
              variant="outlined"
            />
          </Box>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          {availableTransitions.length > 0 && (
            <Button
              variant="outlined"
              color="primary"
              onClick={() => setStatusDialogOpen(true)}
              data-testid="change-status-btn"
            >
              Change Status
            </Button>
          )}
          {!editing ? (
            <Button
              variant="outlined"
              startIcon={<EditIcon />}
              onClick={startEditing}
              data-testid="edit-mi-btn"
            >
              Edit
            </Button>
          ) : (
            <>
              <Button
                variant="contained"
                startIcon={<SaveIcon />}
                onClick={handleSave}
                disabled={saving}
              >
                Save
              </Button>
              <Button
                variant="outlined"
                startIcon={<CancelIcon />}
                onClick={() => setEditing(false)}
              >
                Cancel
              </Button>
            </>
          )}
        </Box>
      </Box>

      {/* RCA Topology Insight Banner */}
      <TopologyInsightBanner
        context="major_incident"
        rcaData={rcaData}
        onViewDetails={() => setTabIndex(6)}
        onRecalculate={handleRecalculateRca}
        recalculating={rcaRecalculating}
      />

      {/* Traceability Chain (Phase 3) */}
      {id && (
        <TraceabilityChainWidget
          recordId={id}
          recordType="MAJOR_INCIDENT"
          onFetch={async (miId: string) => {
            const resp = await itsmApi.majorIncidents.getTraceabilitySummary(miId);
            const d = resp?.data as { data?: TraceabilitySummaryResponseData } | TraceabilitySummaryResponseData;
            const raw = (d && 'data' in d && d.data) ? d.data : (d && 'rootId' in d) ? d : null;
            // Normalize at boundary to guarantee safe metrics/nodes/edges
            const normalized = normalizeTraceabilitySummaryResponse(raw as Record<string, unknown> | null);
            if (!normalized) throw new Error('Unexpected response shape');
            return normalized;
          }}
        />
      )}

      {/* Tabs */}
      <Tabs value={tabIndex} onChange={(_, v) => setTabIndex(v)} sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tab label="Overview" data-testid="mi-tab-overview" />
        <Tab label="Timeline" data-testid="mi-tab-timeline" />
        <Tab label="Linked Records" data-testid="mi-tab-links" />
        <Tab label="Impact" data-testid="mi-tab-impact" />
        <Tab label="Communications" data-testid="mi-tab-comms" />
        <Tab label="PIR" data-testid="mi-tab-pir" />
        <Tab label="RCA Topology" data-testid="mi-tab-rca-topology" />
      </Tabs>

      {/* Overview Tab */}
      <TabPanel value={tabIndex} index={0}>
        <Grid container spacing={3}>
          <Grid item xs={12} md={8}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>Details</Typography>
                {editing ? (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <TextField
                      label="Title"
                      value={editForm.title || ''}
                      onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                      fullWidth
                    />
                    <TextField
                      label="Description"
                      value={editForm.description || ''}
                      onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                      fullWidth
                      multiline
                      rows={4}
                    />
                    <TextField
                      label="Customer Impact Summary"
                      value={editForm.customerImpactSummary || ''}
                      onChange={(e) => setEditForm({ ...editForm, customerImpactSummary: e.target.value })}
                      fullWidth
                      multiline
                      rows={2}
                    />
                    <TextField
                      label="Business Impact Summary"
                      value={editForm.businessImpactSummary || ''}
                      onChange={(e) => setEditForm({ ...editForm, businessImpactSummary: e.target.value })}
                      fullWidth
                      multiline
                      rows={2}
                    />
                  </Box>
                ) : (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                    <Box>
                      <Typography variant="subtitle2" color="text.secondary">Description</Typography>
                      <Typography>{mi.description || 'No description provided'}</Typography>
                    </Box>
                    {mi.customerImpactSummary && (
                      <Box>
                        <Typography variant="subtitle2" color="text.secondary">Customer Impact</Typography>
                        <Typography>{mi.customerImpactSummary}</Typography>
                      </Box>
                    )}
                    {mi.businessImpactSummary && (
                      <Box>
                        <Typography variant="subtitle2" color="text.secondary">Business Impact</Typography>
                        <Typography>{mi.businessImpactSummary}</Typography>
                      </Box>
                    )}
                    {mi.resolutionSummary && (
                      <Box>
                        <Typography variant="subtitle2" color="text.secondary">Resolution Summary</Typography>
                        <Typography>{mi.resolutionSummary}</Typography>
                      </Box>
                    )}
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>Metadata</Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary">Number</Typography>
                    <Typography>{mi.number}</Typography>
                  </Box>
                  <Divider />
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary">Declared At</Typography>
                    <Typography>{mi.declaredAt ? new Date(mi.declaredAt).toLocaleString() : '-'}</Typography>
                  </Box>
                  {mi.resolvedAt && (
                    <>
                      <Divider />
                      <Box>
                        <Typography variant="subtitle2" color="text.secondary">Resolved At</Typography>
                        <Typography>{new Date(mi.resolvedAt).toLocaleString()}</Typography>
                      </Box>
                    </>
                  )}
                  {mi.closedAt && (
                    <>
                      <Divider />
                      <Box>
                        <Typography variant="subtitle2" color="text.secondary">Closed At</Typography>
                        <Typography>{new Date(mi.closedAt).toLocaleString()}</Typography>
                      </Box>
                    </>
                  )}
                </Box>
              </CardContent>
            </Card>

            <Card sx={{ mt: 2 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>Bridge / War Room</Typography>
                {editing ? (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <TextField
                      label="Bridge URL"
                      value={editForm.bridgeUrl || ''}
                      onChange={(e) => setEditForm({ ...editForm, bridgeUrl: e.target.value })}
                      fullWidth
                      size="small"
                    />
                    <TextField
                      label="Bridge Channel"
                      value={editForm.bridgeChannel || ''}
                      onChange={(e) => setEditForm({ ...editForm, bridgeChannel: e.target.value })}
                      fullWidth
                      size="small"
                    />
                  </Box>
                ) : (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <Box>
                      <Typography variant="subtitle2" color="text.secondary">URL</Typography>
                      <Typography>
                        {mi.bridgeUrl ? (
                          <a href={mi.bridgeUrl} target="_blank" rel="noopener noreferrer">{mi.bridgeUrl}</a>
                        ) : 'Not set'}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="subtitle2" color="text.secondary">Channel</Typography>
                      <Typography>{mi.bridgeChannel || 'Not set'}</Typography>
                    </Box>
                  </Box>
                )}
              </CardContent>
            </Card>

            <Card sx={{ mt: 2 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>Role Assignments</Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary">Commander</Typography>
                    <Typography>{mi.commanderId || 'Unassigned'}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary">Communications Lead</Typography>
                    <Typography>{mi.communicationsLeadId || 'Unassigned'}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary">Tech Lead</Typography>
                    <Typography>{mi.techLeadId || 'Unassigned'}</Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </TabPanel>

      {/* Timeline Tab */}
      <TabPanel value={tabIndex} index={1}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">Timeline</Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setTimelineDialogOpen(true)}
            data-testid="post-timeline-update-btn"
          >
            Post Update
          </Button>
        </Box>
        {timelineLoading ? (
          <CircularProgress />
        ) : timeline.length === 0 ? (
          <Paper sx={{ p: 3, textAlign: 'center' }}>
            <TimelineIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
            <Typography color="text.secondary">No timeline updates yet</Typography>
          </Paper>
        ) : (
          <List>
            {timeline.map((update) => (
              <ListItem key={update.id} sx={{ alignItems: 'flex-start', borderBottom: '1px solid', borderColor: 'divider' }}>
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Chip label={toDisplayLabel(update.updateType)} size="small" variant="outlined" />
                      <Chip
                        label={update.visibility}
                        size="small"
                        color={update.visibility === 'EXTERNAL' ? 'warning' : 'default'}
                      />
                      <Typography variant="caption" color="text.secondary">
                        {new Date(update.createdAt).toLocaleString()}
                      </Typography>
                    </Box>
                  }
                  secondary={
                    <Typography sx={{ mt: 0.5 }}>{update.message}</Typography>
                  }
                />
              </ListItem>
            ))}
          </List>
        )}
      </TabPanel>

      {/* Linked Records Tab */}
      <TabPanel value={tabIndex} index={2}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">Linked Records</Typography>
          <Button
            variant="contained"
            startIcon={<LinkIcon />}
            onClick={() => setLinkDialogOpen(true)}
            data-testid="link-record-btn"
          >
            Link Record
          </Button>
        </Box>
        {linksLoading ? (
          <CircularProgress />
        ) : links.length === 0 ? (
          <Paper sx={{ p: 3, textAlign: 'center' }}>
            <LinkIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
            <Typography color="text.secondary">No linked records yet</Typography>
          </Paper>
        ) : (
          <List>
            {links.map((link) => (
              <ListItem key={link.id} sx={{ borderBottom: '1px solid', borderColor: 'divider' }}>
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Chip label={toDisplayLabel(link.linkType)} size="small" variant="outlined" />
                      <Typography fontWeight={500}>
                        {link.linkedRecordLabel || link.linkedRecordId}
                      </Typography>
                    </Box>
                  }
                  secondary={link.notes || undefined}
                />
                <ListItemSecondaryAction>
                  <Tooltip title="Unlink">
                    <IconButton
                      edge="end"
                      onClick={() => handleUnlink(link.id)}
                      data-testid={`unlink-${link.id}`}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </Tooltip>
                </ListItemSecondaryAction>
              </ListItem>
            ))}
          </List>
        )}
      </TabPanel>

      {/* Impact Tab */}
      <TabPanel value={tabIndex} index={3}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>Impact Assessment</Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" color="text.secondary">Customer Impact</Typography>
                <Typography>{mi.customerImpactSummary || 'Not assessed'}</Typography>
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" color="text.secondary">Business Impact</Typography>
                <Typography>{mi.businessImpactSummary || 'Not assessed'}</Typography>
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" color="text.secondary">Primary Service</Typography>
                <Typography>{mi.primaryServiceId || 'Not specified'}</Typography>
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" color="text.secondary">Primary Offering</Typography>
                <Typography>{mi.primaryOfferingId || 'Not specified'}</Typography>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
        <Card sx={{ mt: 2 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>Impacted Services & CIs</Typography>
            {links.filter(l => ['CMDB_SERVICE', 'CMDB_OFFERING', 'CMDB_CI'].includes(l.linkType)).length === 0 ? (
              <Typography color="text.secondary">No CMDB records linked yet. Use the Linked Records tab to add impacted services and CIs.</Typography>
            ) : (
              <List>
                {links.filter(l => ['CMDB_SERVICE', 'CMDB_OFFERING', 'CMDB_CI'].includes(l.linkType)).map((link) => (
                  <ListItem key={link.id}>
                    <ListItemText
                      primary={link.linkedRecordLabel || link.linkedRecordId}
                      secondary={toDisplayLabel(link.linkType)}
                    />
                  </ListItem>
                ))}
              </List>
            )}
          </CardContent>
        </Card>
      </TabPanel>

      {/* Communications Tab */}
      <TabPanel value={tabIndex} index={4}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>Stakeholder Communications</Typography>
            {timeline.filter(u => u.visibility === 'EXTERNAL' || u.updateType === 'STAKEHOLDER_UPDATE' || u.updateType === 'COMMUNICATION').length === 0 ? (
              <Paper sx={{ p: 3, textAlign: 'center' }}>
                <Typography color="text.secondary">No stakeholder communications yet. Post an external update from the Timeline tab.</Typography>
              </Paper>
            ) : (
              <List>
                {timeline.filter(u => u.visibility === 'EXTERNAL' || u.updateType === 'STAKEHOLDER_UPDATE' || u.updateType === 'COMMUNICATION').map((update) => (
                  <ListItem key={update.id} sx={{ borderBottom: '1px solid', borderColor: 'divider' }}>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Chip label={toDisplayLabel(update.updateType)} size="small" />
                          <Typography variant="caption" color="text.secondary">
                            {new Date(update.createdAt).toLocaleString()}
                          </Typography>
                        </Box>
                      }
                      secondary={update.message}
                    />
                  </ListItem>
                ))}
              </List>
            )}
          </CardContent>
        </Card>
      </TabPanel>

      {/* PIR Tab */}
      <TabPanel value={tabIndex} index={5}>
        {pirLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>
        ) : pirError ? (
          <Alert severity="warning" sx={{ mb: 2 }}>{pirError}</Alert>
        ) : !pir ? (
          <Paper sx={{ p: 4, textAlign: 'center' }} data-testid="pir-empty-state">
            <Typography variant="h6" gutterBottom>Post-Incident Review</Typography>
            {['RESOLVED', 'PIR_PENDING', 'CLOSED'].includes(mi.status) ? (
              <>
                <Typography color="text.secondary" gutterBottom>
                  No PIR exists yet for this major incident.
                </Typography>
                <Button
                  variant="contained"
                  onClick={handleCreatePir}
                  disabled={creatingPir}
                  startIcon={<AddIcon />}
                  sx={{ mt: 2 }}
                  data-testid="create-pir-btn"
                >
                  {creatingPir ? 'Creating...' : 'Create PIR'}
                </Button>
              </>
            ) : (
              <Typography color="text.secondary">
                PIR can be created after the major incident is resolved (current status: {toDisplayLabel(mi.status)}).
              </Typography>
            )}
          </Paper>
        ) : (
          <Box data-testid="pir-content">
            {/* PIR Header */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Typography variant="h6">{pir.title}</Typography>
                <Chip
                  label={pir.status}
                  color={
                    pir.status === 'APPROVED' ? 'success' :
                    pir.status === 'IN_REVIEW' ? 'warning' :
                    pir.status === 'CLOSED' ? 'default' : 'info'
                  }
                  size="small"
                  data-testid="pir-status-chip"
                />
              </Box>
              <Box sx={{ display: 'flex', gap: 1 }}>
                {pir.status === 'DRAFT' && (
                  <>
                    {!pirEditing ? (
                      <Button size="small" startIcon={<EditIcon />} onClick={() => {
                        setPirForm({
                          title: pir.title,
                          summary: pir.summary || '',
                          whatHappened: pir.whatHappened || '',
                          timelineHighlights: pir.timelineHighlights || '',
                          rootCauses: pir.rootCauses || '',
                          whatWorkedWell: pir.whatWorkedWell || '',
                          whatDidNotWork: pir.whatDidNotWork || '',
                          customerImpact: pir.customerImpact || '',
                          detectionEffectiveness: pir.detectionEffectiveness || '',
                          responseEffectiveness: pir.responseEffectiveness || '',
                          preventiveActions: pir.preventiveActions || '',
                          correctiveActions: pir.correctiveActions || '',
                        });
                        setPirEditing(true);
                      }} data-testid="edit-pir-btn">Edit</Button>
                    ) : (
                      <>
                        <Button size="small" variant="contained" startIcon={<SaveIcon />} onClick={handlePirSave} disabled={pirSaving}>
                          {pirSaving ? 'Saving...' : 'Save'}
                        </Button>
                        <Button size="small" startIcon={<CancelIcon />} onClick={() => setPirEditing(false)}>Cancel</Button>
                      </>
                    )}
                    <Button size="small" variant="outlined" color="warning" onClick={() => handlePirStatusChange('IN_REVIEW')} data-testid="submit-pir-btn">
                      Submit for Review
                    </Button>
                  </>
                )}
                {pir.status === 'IN_REVIEW' && (
                  <>
                    <Button size="small" variant="contained" color="success" onClick={() => handlePirStatusChange('APPROVED')} data-testid="approve-pir-btn">
                      Approve
                    </Button>
                    <Button size="small" variant="outlined" onClick={() => handlePirStatusChange('DRAFT')}>
                      Return to Draft
                    </Button>
                  </>
                )}
                {pir.status === 'APPROVED' && (
                  <Button size="small" variant="outlined" onClick={() => handlePirStatusChange('CLOSED')} data-testid="close-pir-btn">
                    Close PIR
                  </Button>
                )}
              </Box>
            </Box>

            {/* PIR Sections */}
            <Grid container spacing={2}>
              {[
                { key: 'summary', label: 'Summary' },
                { key: 'whatHappened', label: 'What Happened' },
                { key: 'timelineHighlights', label: 'Timeline Highlights' },
                { key: 'rootCauses', label: 'Root Causes' },
                { key: 'whatWorkedWell', label: 'What Worked Well' },
                { key: 'whatDidNotWork', label: 'What Did Not Work' },
                { key: 'customerImpact', label: 'Customer Impact' },
                { key: 'detectionEffectiveness', label: 'Detection Effectiveness' },
                { key: 'responseEffectiveness', label: 'Response Effectiveness' },
                { key: 'preventiveActions', label: 'Preventive Actions' },
                { key: 'correctiveActions', label: 'Corrective Actions' },
              ].map(({ key, label }) => (
                <Grid item xs={12} md={6} key={key}>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="subtitle2" color="text.secondary" gutterBottom>{label}</Typography>
                      {pirEditing ? (
                        <TextField
                          fullWidth
                          multiline
                          rows={3}
                          value={(pirForm as Record<string, string>)[key] || ''}
                          onChange={(e) => setPirForm({ ...pirForm, [key]: e.target.value })}
                          size="small"
                          data-testid={`pir-field-${key}`}
                        />
                      ) : (
                        <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                          {(pir as unknown as Record<string, string | null>)[key] || <em>Not filled</em>}
                        </Typography>
                      )}
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>

            {/* PIR Metadata */}
            {pir.approvedAt && (
              <Alert severity="success" sx={{ mt: 2 }}>
                Approved on {new Date(pir.approvedAt).toLocaleString()}
              </Alert>
            )}

            <Divider sx={{ my: 3 }} />

            {/* Action Tracker */}
            <Box sx={{ mb: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">Action Items</Typography>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <FormControl size="small" sx={{ minWidth: 120 }}>
                    <InputLabel>Filter</InputLabel>
                    <Select value={actionFilter} label="Filter" onChange={(e) => setActionFilter(e.target.value)} data-testid="action-filter-select">
                      <MenuItem value="">All</MenuItem>
                      <MenuItem value="OPEN">Open</MenuItem>
                      <MenuItem value="IN_PROGRESS">In Progress</MenuItem>
                      <MenuItem value="COMPLETED">Completed</MenuItem>
                      <MenuItem value="OVERDUE">Overdue</MenuItem>
                      <MenuItem value="CANCELLED">Cancelled</MenuItem>
                    </Select>
                  </FormControl>
                  <Button size="small" variant="contained" startIcon={<AddIcon />} onClick={() => setActionDialogOpen(true)} data-testid="add-action-btn">
                    Add Action
                  </Button>
                </Box>
              </Box>

              {pirActionsLoading ? (
                <CircularProgress size={24} />
              ) : (
                <List data-testid="pir-actions-list">
                  {(actionFilter ? pirActions.filter(a => a.status === actionFilter) : pirActions).length === 0 ? (
                    <Paper sx={{ p: 2, textAlign: 'center' }}>
                      <Typography color="text.secondary">No action items{actionFilter ? ` with status "${actionFilter}"` : ''}.</Typography>
                    </Paper>
                  ) : (
                    (actionFilter ? pirActions.filter(a => a.status === actionFilter) : pirActions).map((action) => {
                      const isOverdue = action.dueDate && new Date(action.dueDate) < new Date() && !['COMPLETED', 'CANCELLED'].includes(action.status);
                      return (
                        <ListItem
                          key={action.id}
                          sx={{
                            border: 1,
                            borderColor: isOverdue ? 'error.main' : 'divider',
                            borderRadius: 1,
                            mb: 1,
                            bgcolor: isOverdue ? 'error.lighter' : undefined,
                          }}
                          data-testid={`action-item-${action.id}`}
                        >
                          <ListItemText
                            primary={
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Typography fontWeight={500}>{action.title}</Typography>
                                <Chip
                                  label={action.status}
                                  size="small"
                                  color={
                                    action.status === 'COMPLETED' ? 'success' :
                                    action.status === 'IN_PROGRESS' ? 'info' :
                                    action.status === 'OVERDUE' || isOverdue ? 'error' :
                                    action.status === 'CANCELLED' ? 'default' : 'warning'
                                  }
                                />
                                <Chip label={action.priority} size="small" variant="outlined" />
                                {isOverdue && <Chip label="OVERDUE" size="small" color="error" />}
                              </Box>
                            }
                            secondary={
                              <Box sx={{ mt: 0.5 }}>
                                {action.description && <Typography variant="body2">{action.description}</Typography>}
                                {action.dueDate && (
                                  <Typography variant="caption" color={isOverdue ? 'error' : 'text.secondary'}>
                                    Due: {new Date(action.dueDate).toLocaleDateString()}
                                  </Typography>
                                )}
                              </Box>
                            }
                          />
                          <ListItemSecondaryAction>
                            {action.status === 'OPEN' && (
                              <Tooltip title="Start">
                                <Button size="small" onClick={() => handleUpdateActionStatus(action.id, 'IN_PROGRESS')}>Start</Button>
                              </Tooltip>
                            )}
                            {action.status === 'IN_PROGRESS' && (
                              <Tooltip title="Complete">
                                <Button size="small" color="success" onClick={() => handleUpdateActionStatus(action.id, 'COMPLETED')}>Complete</Button>
                              </Tooltip>
                            )}
                          </ListItemSecondaryAction>
                        </ListItem>
                      );
                    })
                  )}
                </List>
              )}
            </Box>

            <Divider sx={{ my: 3 }} />

            {/* Knowledge Candidates */}
            <Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">Knowledge Candidates</Typography>
                <Button
                  size="small"
                  variant="contained"
                  onClick={handleGenerateKc}
                  disabled={generatingKc}
                  data-testid="generate-kc-btn"
                >
                  {generatingKc ? 'Generating...' : 'Generate Knowledge Candidate'}
                </Button>
              </Box>

              {kcLoading ? (
                <CircularProgress size={24} />
              ) : knowledgeCandidates.length === 0 ? (
                <Paper sx={{ p: 2, textAlign: 'center' }}>
                  <Typography color="text.secondary">No knowledge candidates generated yet.</Typography>
                </Paper>
              ) : (
                <Grid container spacing={2} data-testid="kc-list">
                  {knowledgeCandidates.map((kc) => (
                    <Grid item xs={12} md={6} key={kc.id}>
                      <Card variant="outlined">
                        <CardContent>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                            <Typography variant="subtitle1" fontWeight={500}>{kc.title}</Typography>
                            <Chip
                              label={kc.status}
                              size="small"
                              color={
                                kc.status === 'PUBLISHED' ? 'success' :
                                kc.status === 'REVIEWED' ? 'info' :
                                kc.status === 'REJECTED' ? 'error' : 'default'
                              }
                            />
                          </Box>
                          {kc.synopsis && <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>{kc.synopsis}</Typography>}
                          <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                            <Button size="small" onClick={() => setSelectedKc(selectedKc?.id === kc.id ? null : kc)}>
                              {selectedKc?.id === kc.id ? 'Hide Preview' : 'Preview'}
                            </Button>
                            {kc.status === 'DRAFT' && (
                              <>
                                <Button size="small" color="info" onClick={() => handleKcAction(kc.id, 'review')}>Review</Button>
                                <Button size="small" color="error" onClick={() => handleKcAction(kc.id, 'reject')}>Reject</Button>
                              </>
                            )}
                            {kc.status === 'REVIEWED' && (
                              <>
                                <Button size="small" color="success" onClick={() => handleKcAction(kc.id, 'publish')}>Publish</Button>
                                <Button size="small" color="error" onClick={() => handleKcAction(kc.id, 'reject')}>Reject</Button>
                              </>
                            )}
                          </Box>
                          {selectedKc?.id === kc.id && kc.content && (
                            <Paper sx={{ mt: 2, p: 2, bgcolor: 'grey.50' }} data-testid="kc-preview">
                              <Typography variant="subtitle2" gutterBottom>Content Preview</Typography>
                              {Object.entries(kc.content).map(([key, value]) => (
                                <Box key={key} sx={{ mb: 1 }}>
                                  <Typography variant="caption" color="text.secondary">{toDisplayLabel(key)}</Typography>
                                  <Typography variant="body2">{String(value || '-')}</Typography>
                                </Box>
                              ))}
                            </Paper>
                          )}
                        </CardContent>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              )}
            </Box>
          </Box>
        )}
      </TabPanel>

      {/* RCA Topology Tab */}
      <TabPanel value={tabIndex} index={6}>
        <TopologyRcaHypothesesTable
          data={rcaData}
          loading={rcaLoading}
          error={rcaError}
          majorIncidentId={id}
          pirIds={pir ? [{ id: pir.id, title: pir.title }] : []}
          onRecalculate={handleRecalculateRca}
          recalculating={rcaRecalculating}
          onRetry={fetchRcaHypotheses}
          onCopyHypothesis={handleCopyHypothesis}
          onCompare={handleCompareHypotheses}
          orchestration={{
            onCreateProblem: handleCreateProblemFromHypothesis,
            onCreateKnownError: handleCreateKnownErrorFromHypothesis,
            onCreatePirAction: handleCreatePirActionFromHypothesis,
          }}
          decisions={{
            onUpdateDecision: handleUpdateHypothesisDecision,
            onAddNote: handleAddHypothesisNote,
            onSetSelected: handleSetSelectedHypothesis,
          }}
          decisionsSummary={rcaDecisionsSummary}
          decisionLoading={rcaDecisionLoading}
        />
      </TabPanel>

      {/* RCA Compare Dialog */}
      <TopologyRcaCompareDialog
        open={rcaCompareOpen}
        onClose={() => setRcaCompareOpen(false)}
        hypothesis1={rcaCompareHypotheses?.[0] ?? null}
        hypothesis2={rcaCompareHypotheses?.[1] ?? null}
      />

      {/* Add Action Dialog */}
      <Dialog
        open={actionDialogOpen}
        onClose={() => setActionDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        data-testid="add-action-dialog"
      >
        <DialogTitle>Add PIR Action</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <TextField
              label="Title"
              value={actionForm.title}
              onChange={(e) => setActionForm({ ...actionForm, title: e.target.value })}
              fullWidth
              required
              data-testid="action-title-input"
            />
            <TextField
              label="Description"
              value={actionForm.description || ''}
              onChange={(e) => setActionForm({ ...actionForm, description: e.target.value })}
              fullWidth
              multiline
              rows={2}
            />
            <TextField
              label="Owner ID"
              value={actionForm.ownerId || ''}
              onChange={(e) => setActionForm({ ...actionForm, ownerId: e.target.value })}
              fullWidth
              helperText="UUID of the assignee"
            />
            <TextField
              label="Due Date"
              type="date"
              value={actionForm.dueDate || ''}
              onChange={(e) => setActionForm({ ...actionForm, dueDate: e.target.value })}
              fullWidth
              InputLabelProps={{ shrink: true }}
              data-testid="action-due-date-input"
            />
            <FormControl fullWidth>
              <InputLabel>Priority</InputLabel>
              <Select
                value={actionForm.priority || 'MEDIUM'}
                label="Priority"
                onChange={(e) => setActionForm({ ...actionForm, priority: e.target.value as CreateItsmPirActionDto['priority'] })}
              >
                <MenuItem value="CRITICAL">Critical</MenuItem>
                <MenuItem value="HIGH">High</MenuItem>
                <MenuItem value="MEDIUM">Medium</MenuItem>
                <MenuItem value="LOW">Low</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setActionDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleCreateAction}
            variant="contained"
            disabled={!actionForm.title.trim() || actionSaving}
            data-testid="confirm-add-action-btn"
          >
            {actionSaving ? 'Adding...' : 'Add Action'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Status Change Dialog */}
      <Dialog
        open={statusDialogOpen}
        onClose={() => setStatusDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        data-testid="status-change-dialog"
      >
        <DialogTitle>Change Status</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <Typography>
              Current status: <Chip label={toDisplayLabel(mi.status)} color={statusColors[mi.status]} size="small" />
            </Typography>
            <FormControl fullWidth>
              <InputLabel>New Status</InputLabel>
              <Select
                value={newStatus}
                label="New Status"
                onChange={(e) => setNewStatus(e.target.value)}
                data-testid="new-status-select"
              >
                {availableTransitions.map((s) => (
                  <MenuItem key={s} value={s}>{toDisplayLabel(s)}</MenuItem>
                ))}
              </Select>
            </FormControl>
            {newStatus === 'RESOLVED' && (
              <TextField
                label="Resolution Summary"
                value={resolutionSummary}
                onChange={(e) => setResolutionSummary(e.target.value)}
                fullWidth
                multiline
                rows={3}
                required
                helperText="Required when resolving a major incident"
                data-testid="resolution-summary-input"
              />
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setStatusDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleStatusChange}
            variant="contained"
            disabled={!newStatus || changingStatus || (newStatus === 'RESOLVED' && !resolutionSummary.trim())}
            data-testid="confirm-status-change-btn"
          >
            {changingStatus ? 'Changing...' : 'Confirm'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Timeline Update Dialog */}
      <Dialog
        open={timelineDialogOpen}
        onClose={() => setTimelineDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        data-testid="timeline-update-dialog"
      >
        <DialogTitle>Post Timeline Update</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <TextField
              label="Message"
              value={timelineMessage}
              onChange={(e) => setTimelineMessage(e.target.value)}
              fullWidth
              multiline
              rows={3}
              required
              autoFocus
              data-testid="timeline-message-input"
            />
            <FormControl fullWidth>
              <InputLabel>Update Type</InputLabel>
              <Select
                value={timelineType}
                label="Update Type"
                onChange={(e) => setTimelineType(e.target.value)}
              >
                {UPDATE_TYPE_OPTIONS.map((opt) => (
                  <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel>Visibility</InputLabel>
              <Select
                value={timelineVisibility}
                label="Visibility"
                onChange={(e) => setTimelineVisibility(e.target.value)}
              >
                <MenuItem value="INTERNAL">Internal</MenuItem>
                <MenuItem value="EXTERNAL">External (Stakeholders)</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTimelineDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handlePostTimelineUpdate}
            variant="contained"
            disabled={!timelineMessage.trim() || postingUpdate}
            data-testid="confirm-post-update-btn"
          >
            {postingUpdate ? 'Posting...' : 'Post Update'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Link Record Dialog */}
      <Dialog
        open={linkDialogOpen}
        onClose={() => setLinkDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        data-testid="link-record-dialog"
      >
        <DialogTitle>Link Record</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <FormControl fullWidth>
              <InputLabel>Record Type</InputLabel>
              <Select
                value={linkType}
                label="Record Type"
                onChange={(e) => setLinkType(e.target.value)}
              >
                {LINK_TYPE_OPTIONS.map((opt) => (
                  <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="Record ID"
              value={linkRecordId}
              onChange={(e) => setLinkRecordId(e.target.value)}
              fullWidth
              required
              helperText="Enter the UUID of the record to link"
              data-testid="link-record-id-input"
            />
            <TextField
              label="Label (optional)"
              value={linkLabel}
              onChange={(e) => setLinkLabel(e.target.value)}
              fullWidth
              helperText="Display name for this linked record"
            />
            <TextField
              label="Notes (optional)"
              value={linkNotes}
              onChange={(e) => setLinkNotes(e.target.value)}
              fullWidth
              multiline
              rows={2}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLinkDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleLinkRecord}
            variant="contained"
            disabled={!linkRecordId.trim() || linkingRecord}
            data-testid="confirm-link-record-btn"
          >
            {linkingRecord ? 'Linking...' : 'Link Record'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ItsmMajorIncidentDetail;
