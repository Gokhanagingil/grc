import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Grid,
  IconButton,
  TextField,
  Typography,
  Alert,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select,
  Switch,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tooltip,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Save as SaveIcon,
  CheckCircle as CheckCircleIcon,
  Publish as PublishIcon,
  Archive as ArchiveIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { itsmApi, ItsmKnownErrorData, CreateItsmKnownErrorDto, UpdateItsmKnownErrorDto } from '../../services/grcClient';
import { useNotification } from '../../contexts/NotificationContext';

const STATE_OPTIONS = [
  { value: 'DRAFT', label: 'Draft' },
  { value: 'VALIDATED', label: 'Validated' },
  { value: 'PUBLISHED', label: 'Published' },
  { value: 'RETIRED', label: 'Retired' },
];

const FIX_STATUS_OPTIONS = [
  { value: 'NONE', label: 'None' },
  { value: 'WORKAROUND_AVAILABLE', label: 'Workaround Available' },
  { value: 'FIX_IN_PROGRESS', label: 'Fix In Progress' },
  { value: 'FIX_DEPLOYED', label: 'Fix Deployed' },
];

export const ItsmKnownErrorDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { showNotification } = useNotification();
  const isNew = !id || id === 'new';
  const prefillProblemId = searchParams.get('problemId') || '';

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [title, setTitle] = useState('');
  const [symptoms, setSymptoms] = useState('');
  const [rootCause, setRootCause] = useState('');
  const [workaround, setWorkaround] = useState('');
  const [permanentFixStatus, setPermanentFixStatus] = useState('NONE');
  const [articleRef, setArticleRef] = useState('');
  const [state, setState] = useState('DRAFT');
  const [problemId, setProblemId] = useState(prefillProblemId);

  // Phase 2: Knowledge candidate
  const [knowledgeCandidate, setKnowledgeCandidate] = useState(false);

  // Phase 2: Reopen dialog
  const [reopenDialogOpen, setReopenDialogOpen] = useState(false);
  const [reopenReason, setReopenReason] = useState('');
  const [reopening, setReopening] = useState(false);

  // Phase 2: Lifecycle transition loading
  const [transitioning, setTransitioning] = useState(false);

  const [knownErrorData, setKnownErrorData] = useState<ItsmKnownErrorData | null>(null);

  const fetchKnownError = useCallback(async () => {
    if (isNew || !id) return;
    setLoading(true);
    setError(null);
    try {
      const response = await itsmApi.knownErrors.get(id);
      const data = response.data;
      const ke = (data as { data?: ItsmKnownErrorData })?.data || data as ItsmKnownErrorData;
      setKnownErrorData(ke);
      setTitle(ke.title || '');
      setSymptoms(ke.symptoms || '');
      setRootCause(ke.rootCause || '');
      setWorkaround(ke.workaround || '');
      setPermanentFixStatus(ke.permanentFixStatus || 'NONE');
      setArticleRef(ke.articleRef || '');
      setState(ke.state || 'DRAFT');
      setProblemId(ke.problemId || '');
      setKnowledgeCandidate((ke as unknown as { knowledgeCandidate?: boolean }).knowledgeCandidate || false);
    } catch (err) {
      console.error('Error fetching known error:', err);
      setError('Failed to load known error details.');
    } finally {
      setLoading(false);
    }
  }, [id, isNew]);

  useEffect(() => {
    fetchKnownError();
  }, [fetchKnownError]);

  const handleSave = async () => {
    if (!title.trim()) {
      showNotification('Title is required', 'error');
      return;
    }
    setSaving(true);
    try {
      if (isNew) {
        const dto: CreateItsmKnownErrorDto = {
          title,
          symptoms: symptoms || undefined,
          rootCause: rootCause || undefined,
          workaround: workaround || undefined,
          permanentFixStatus: permanentFixStatus || undefined,
          articleRef: articleRef || undefined,
          state,
          problemId: problemId || undefined,
        };
        const response = await itsmApi.knownErrors.create(dto);
        const data = response.data;
        const created = (data as { data?: ItsmKnownErrorData })?.data || data as ItsmKnownErrorData;
        showNotification('Known Error created successfully', 'success');
        navigate(`/itsm/known-errors/${created.id}`, { replace: true });
      } else if (id) {
        const dto: UpdateItsmKnownErrorDto = {
          title,
          symptoms: symptoms || undefined,
          rootCause: rootCause || undefined,
          workaround: workaround || undefined,
          permanentFixStatus,
          articleRef: articleRef || undefined,
          state,
          problemId: problemId || undefined,
          knowledgeCandidate,
        };
        await itsmApi.knownErrors.update(id, dto);
        showNotification('Known Error updated successfully', 'success');
        fetchKnownError();
      }
    } catch (err) {
      console.error('Error saving known error:', err);
      showNotification('Failed to save known error', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Phase 2: Lifecycle transitions
  const handleValidate = async () => {
    if (!id) return;
    setTransitioning(true);
    try {
      await itsmApi.knownErrors.validate(id);
      showNotification('Known Error validated', 'success');
      fetchKnownError();
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Failed to validate';
      showNotification(errMsg, 'error');
    } finally { setTransitioning(false); }
  };

  const handlePublish = async () => {
    if (!id) return;
    setTransitioning(true);
    try {
      await itsmApi.knownErrors.publish(id);
      showNotification('Known Error published', 'success');
      fetchKnownError();
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Failed to publish';
      showNotification(errMsg, 'error');
    } finally { setTransitioning(false); }
  };

  const handleRetire = async () => {
    if (!id) return;
    setTransitioning(true);
    try {
      await itsmApi.knownErrors.retire(id);
      showNotification('Known Error retired', 'success');
      fetchKnownError();
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Failed to retire';
      showNotification(errMsg, 'error');
    } finally { setTransitioning(false); }
  };

  const handleReopen = async () => {
    if (!id || !reopenReason.trim()) return;
    setReopening(true);
    try {
      await itsmApi.knownErrors.reopen(id, reopenReason.trim());
      showNotification('Known Error reopened', 'success');
      setReopenDialogOpen(false);
      setReopenReason('');
      fetchKnownError();
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Failed to reopen';
      showNotification(errMsg, 'error');
    } finally { setReopening(false); }
  };

  const canValidate = knownErrorData?.state === 'DRAFT';
  const canPublish = knownErrorData?.state === 'VALIDATED';
  const canRetire = knownErrorData?.state === 'PUBLISHED';
  const canReopen = knownErrorData?.state === 'RETIRED';

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight={300}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/itsm/known-errors')}>
          Back to Known Errors
        </Button>
        <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>
      </Box>
    );
  }

  return (
    <Box data-testid="known-error-detail">
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <IconButton onClick={() => navigate('/itsm/known-errors')}>
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h4" fontWeight={600}>
            {isNew ? 'New Known Error' : `Known Error: ${knownErrorData?.title || ''}`}
          </Typography>
          {!isNew && knownErrorData?.state && (
            <Chip
              label={knownErrorData.state}
              color={
                knownErrorData.state === 'PUBLISHED' ? 'success' :
                knownErrorData.state === 'RETIRED' ? 'warning' : 'default'
              }
            />
          )}
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          {!isNew && canValidate && (
            <Tooltip title="Validate this Known Error (DRAFT → VALIDATED)">
              <Button
                variant="outlined"
                color="info"
                startIcon={<CheckCircleIcon />}
                onClick={handleValidate}
                disabled={transitioning}
                data-testid="validate-ke-btn"
              >
                Validate
              </Button>
            </Tooltip>
          )}
          {!isNew && canPublish && (
            <Tooltip title="Publish this Known Error (VALIDATED → PUBLISHED)">
              <Button
                variant="outlined"
                color="success"
                startIcon={<PublishIcon />}
                onClick={handlePublish}
                disabled={transitioning}
                data-testid="publish-ke-btn"
              >
                Publish
              </Button>
            </Tooltip>
          )}
          {!isNew && canRetire && (
            <Tooltip title="Retire this Known Error (PUBLISHED → RETIRED)">
              <Button
                variant="outlined"
                color="warning"
                startIcon={<ArchiveIcon />}
                onClick={handleRetire}
                disabled={transitioning}
                data-testid="retire-ke-btn"
              >
                Retire
              </Button>
            </Tooltip>
          )}
          {!isNew && canReopen && (
            <Button
              variant="outlined"
              color="warning"
              startIcon={<RefreshIcon />}
              onClick={() => setReopenDialogOpen(true)}
              disabled={transitioning}
              data-testid="reopen-ke-btn"
            >
              Reopen
            </Button>
          )}
          <Button
            variant="contained"
            startIcon={<SaveIcon />}
            onClick={handleSave}
            disabled={saving}
            data-testid="save-known-error-btn"
          >
            {saving ? 'Saving...' : isNew ? 'Create' : 'Save'}
          </Button>
        </Box>
      </Box>

      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Details</Typography>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                    data-testid="known-error-title-input"
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    multiline
                    rows={3}
                    label="Symptoms"
                    value={symptoms}
                    onChange={(e) => setSymptoms(e.target.value)}
                    helperText="Describe the symptoms users experience"
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    multiline
                    rows={3}
                    label="Root Cause"
                    value={rootCause}
                    onChange={(e) => setRootCause(e.target.value)}
                    helperText="Documented root cause of the error"
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    multiline
                    rows={3}
                    label="Workaround"
                    value={workaround}
                    onChange={(e) => setWorkaround(e.target.value)}
                    helperText="Steps to work around the issue"
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Article Reference"
                    value={articleRef}
                    onChange={(e) => setArticleRef(e.target.value)}
                    helperText="Reference to knowledge base article (future KB integration)"
                  />
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Classification</Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <FormControl fullWidth size="small">
                  <InputLabel>State</InputLabel>
                  <Select value={state} label="State" onChange={(e) => setState(e.target.value)}>
                    {STATE_OPTIONS.map(opt => (
                      <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <FormControl fullWidth size="small">
                  <InputLabel>Fix Status</InputLabel>
                  <Select value={permanentFixStatus} label="Fix Status" onChange={(e) => setPermanentFixStatus(e.target.value)}>
                    {FIX_STATUS_OPTIONS.map(opt => (
                      <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <TextField
                  fullWidth
                  size="small"
                  label="Problem ID"
                  value={problemId}
                  onChange={(e) => setProblemId(e.target.value)}
                  helperText="UUID of the related problem"
                />
                {!isNew && (
                  <FormControlLabel
                    control={
                      <Switch
                        checked={knowledgeCandidate}
                        onChange={(e) => setKnowledgeCandidate(e.target.checked)}
                        data-testid="knowledge-candidate-switch"
                      />
                    }
                    label="Knowledge Article Candidate"
                  />
                )}
              </Box>
            </CardContent>
          </Card>
          {!isNew && knownErrorData && (
            <Card sx={{ mt: 2 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>Metadata</Typography>
                <Typography variant="body2" color="text.secondary">
                  Created: {new Date(knownErrorData.createdAt).toLocaleString()}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Updated: {new Date(knownErrorData.updatedAt).toLocaleString()}
                </Typography>
                {knownErrorData.publishedAt && (
                  <Typography variant="body2" color="text.secondary">
                    Published: {new Date(knownErrorData.publishedAt).toLocaleString()}
                  </Typography>
                )}
                {knownErrorData.problemId && (
                  <Button
                    size="small"
                    sx={{ mt: 1 }}
                    onClick={() => navigate(`/itsm/problems/${knownErrorData.problemId}`)}
                  >
                    View Related Problem
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
        </Grid>
      </Grid>

      {/* Reopen Dialog */}
      <Dialog open={reopenDialogOpen} onClose={() => setReopenDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Reopen Known Error</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            Reopening will change the state back to DRAFT.
          </Alert>
          <TextField
            fullWidth
            multiline
            rows={3}
            label="Reason for Reopening"
            value={reopenReason}
            onChange={(e) => setReopenReason(e.target.value)}
            placeholder="Explain why this known error needs to be reopened..."
            required
            data-testid="reopen-ke-reason-input"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReopenDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            color="warning"
            onClick={handleReopen}
            disabled={reopening || !reopenReason.trim()}
            data-testid="confirm-reopen-ke-btn"
          >
            {reopening ? 'Reopening...' : 'Reopen'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ItsmKnownErrorDetail;
