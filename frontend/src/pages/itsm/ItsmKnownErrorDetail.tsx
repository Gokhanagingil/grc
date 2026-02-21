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
  InputLabel,
  MenuItem,
  Select,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Save as SaveIcon,
} from '@mui/icons-material';
import { itsmApi, ItsmKnownErrorData, CreateItsmKnownErrorDto, UpdateItsmKnownErrorDto } from '../../services/grcClient';
import { useNotification } from '../../contexts/NotificationContext';

const STATE_OPTIONS = [
  { value: 'DRAFT', label: 'Draft' },
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
    </Box>
  );
};

export default ItsmKnownErrorDetail;
