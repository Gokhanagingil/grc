import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Grid,
  IconButton,
  Switch,
  FormControlLabel,
  MenuItem,
  TextField,
  Typography,
  Alert,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Save as SaveIcon,
} from '@mui/icons-material';
import {
  cmdbApi,
  CmdbRelationshipTypeData,
  CreateCmdbRelationshipTypeDto,
  UpdateCmdbRelationshipTypeDto,
  RelationshipDirectionality,
  RiskPropagationHint,
} from '../../services/grcClient';
import { useNotification } from '../../contexts/NotificationContext';
import { classifyApiError } from '../../utils/apiErrorClassifier';

const DIRECTIONALITY_OPTIONS: { value: RelationshipDirectionality; label: string }[] = [
  { value: 'unidirectional', label: 'Unidirectional' },
  { value: 'bidirectional', label: 'Bidirectional' },
];

const RISK_PROPAGATION_OPTIONS: { value: RiskPropagationHint; label: string; description: string }[] = [
  { value: 'forward', label: 'Forward', description: 'Risk flows from source to target' },
  { value: 'reverse', label: 'Reverse', description: 'Risk flows from target to source' },
  { value: 'both', label: 'Both', description: 'Risk flows in both directions' },
  { value: 'none', label: 'None', description: 'No risk propagation' },
];

interface FormState {
  name: string;
  label: string;
  description: string;
  directionality: RelationshipDirectionality;
  inverseLabel: string;
  riskPropagation: RiskPropagationHint;
  allowedSourceClasses: string;
  allowedTargetClasses: string;
  allowSelfLoop: boolean;
  allowCycles: boolean;
  sortOrder: number;
  isActive: boolean;
  isSystem: boolean;
}

const defaultForm: FormState = {
  name: '',
  label: '',
  description: '',
  directionality: 'unidirectional',
  inverseLabel: '',
  riskPropagation: 'forward',
  allowedSourceClasses: '',
  allowedTargetClasses: '',
  allowSelfLoop: false,
  allowCycles: true,
  sortOrder: 0,
  isActive: true,
  isSystem: false,
};

function parseClassList(raw: string): string[] | undefined {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  return trimmed.split(',').map((s) => s.trim()).filter(Boolean);
}

function formatClassList(arr: string[] | null | undefined): string {
  if (!arr || arr.length === 0) return '';
  return arr.join(', ');
}

export const CmdbRelationshipTypeDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showNotification } = useNotification();
  const isNew = !id || id === 'new';

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormState>(defaultForm);
  const [serverError, setServerError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const fetchItem = useCallback(async () => {
    if (isNew) return;
    setLoading(true);
    try {
      const response = await cmdbApi.relationshipTypes.get(id!);
      const data = response.data;
      // Defensive: handle envelope { data: entity } or direct entity
      let entity: CmdbRelationshipTypeData | null = null;
      if (data && typeof data === 'object') {
        if ('data' in data && data.data && typeof data.data === 'object' && 'id' in (data.data as Record<string, unknown>)) {
          entity = data.data as CmdbRelationshipTypeData;
        } else if ('id' in data) {
          entity = data as CmdbRelationshipTypeData;
        }
      }
      if (entity) {
        setForm({
          name: entity.name || '',
          label: entity.label || '',
          description: entity.description || '',
          directionality: entity.directionality || 'unidirectional',
          inverseLabel: entity.inverseLabel || '',
          riskPropagation: entity.riskPropagation || 'forward',
          allowedSourceClasses: formatClassList(entity.allowedSourceClasses),
          allowedTargetClasses: formatClassList(entity.allowedTargetClasses),
          allowSelfLoop: entity.allowSelfLoop ?? false,
          allowCycles: entity.allowCycles ?? true,
          sortOrder: entity.sortOrder ?? 0,
          isActive: entity.isActive ?? true,
          isSystem: entity.isSystem ?? false,
        });
      } else {
        showNotification('Relationship type not found', 'error');
        navigate('/cmdb/relationship-types');
      }
    } catch (err) {
      console.error('Error fetching relationship type:', err);
      const classified = classifyApiError(err);
      showNotification(classified.message || 'Failed to load relationship type', 'error');
      navigate('/cmdb/relationship-types');
    } finally {
      setLoading(false);
    }
  }, [id, isNew, navigate, showNotification]);

  useEffect(() => {
    fetchItem();
  }, [fetchItem]);

  const validate = (): boolean => {
    const errors: Record<string, string> = {};
    if (!form.name.trim()) errors.name = 'Name is required';
    if (form.name.length > 50) errors.name = 'Name must be 50 characters or less';
    if (!form.label.trim()) errors.label = 'Label is required';
    if (form.label.length > 100) errors.label = 'Label must be 100 characters or less';
    if (form.inverseLabel && form.inverseLabel.length > 100) errors.inverseLabel = 'Inverse label must be 100 characters or less';
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setServerError(null);
    setSaving(true);
    try {
      if (isNew) {
        const dto: CreateCmdbRelationshipTypeDto = {
          name: form.name.trim(),
          label: form.label.trim(),
          description: form.description.trim() || undefined,
          directionality: form.directionality,
          inverseLabel: form.inverseLabel.trim() || undefined,
          riskPropagation: form.riskPropagation,
          allowedSourceClasses: parseClassList(form.allowedSourceClasses),
          allowedTargetClasses: parseClassList(form.allowedTargetClasses),
          allowSelfLoop: form.allowSelfLoop,
          allowCycles: form.allowCycles,
          sortOrder: form.sortOrder,
          isActive: form.isActive,
        };
        const response = await cmdbApi.relationshipTypes.create(dto);
        showNotification('Relationship type created successfully', 'success');
        // Navigate to the new item
        const created = response.data;
        const newId = (created && typeof created === 'object' && 'id' in created)
          ? (created as Record<string, unknown>).id
          : (created && typeof created === 'object' && 'data' in created && created.data && typeof created.data === 'object' && 'id' in (created.data as Record<string, unknown>))
            ? ((created.data as Record<string, unknown>).id)
            : null;
        if (newId) {
          navigate(`/cmdb/relationship-types/${newId}`, { replace: true });
        } else {
          navigate('/cmdb/relationship-types');
        }
      } else {
        const dto: UpdateCmdbRelationshipTypeDto = {
          label: form.label.trim(),
          description: form.description.trim() || undefined,
          directionality: form.directionality,
          inverseLabel: form.inverseLabel.trim() || undefined,
          riskPropagation: form.riskPropagation,
          allowedSourceClasses: parseClassList(form.allowedSourceClasses),
          allowedTargetClasses: parseClassList(form.allowedTargetClasses),
          allowSelfLoop: form.allowSelfLoop,
          allowCycles: form.allowCycles,
          sortOrder: form.sortOrder,
          isActive: form.isActive,
        };
        await cmdbApi.relationshipTypes.update(id!, dto);
        showNotification('Relationship type updated successfully', 'success');
        fetchItem();
      }
    } catch (err: unknown) {
      console.error('Error saving relationship type:', err);
      const classified = classifyApiError(err);
      setServerError(classified.message || 'Failed to save relationship type');
      showNotification(classified.message || 'Failed to save relationship type', 'error');
    } finally {
      setSaving(false);
    }
  };

  const updateField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (validationErrors[key]) {
      setValidationErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <IconButton onClick={() => navigate('/cmdb/relationship-types')} data-testid="btn-back-to-list">
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h4" fontWeight={600}>
          {isNew ? 'New Relationship Type' : (form.label || form.name || 'Relationship Type Detail')}
        </Typography>
        {!isNew && form.isSystem && (
          <Chip label="System" size="small" variant="outlined" color="info" />
        )}
        {!isNew && (
          <Chip
            label={form.isActive ? 'Active' : 'Inactive'}
            size="small"
            color={form.isActive ? 'success' : 'default'}
          />
        )}
        <Box sx={{ flexGrow: 1 }} />
        <Button
          variant="contained"
          startIcon={<SaveIcon />}
          onClick={handleSave}
          disabled={saving}
          data-testid="btn-save"
        >
          {saving ? 'Saving...' : (isNew ? 'Create' : 'Save')}
        </Button>
      </Box>

      {serverError && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setServerError(null)} data-testid="server-error">
          {serverError}
        </Alert>
      )}

      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          {/* Basic Information */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>Basic Information</Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Name (identifier)"
                    value={form.name}
                    onChange={(e) => updateField('name', e.target.value)}
                    disabled={!isNew && form.isSystem}
                    required
                    error={!!validationErrors.name}
                    helperText={validationErrors.name || 'Machine-readable name (e.g. depends_on)'}
                    data-testid="input-name"
                    inputProps={{ maxLength: 50 }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Label (display name)"
                    value={form.label}
                    onChange={(e) => updateField('label', e.target.value)}
                    required
                    error={!!validationErrors.label}
                    helperText={validationErrors.label || 'Human-readable label (e.g. Depends On)'}
                    data-testid="input-label"
                    inputProps={{ maxLength: 100 }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Inverse Label"
                    value={form.inverseLabel}
                    onChange={(e) => updateField('inverseLabel', e.target.value)}
                    error={!!validationErrors.inverseLabel}
                    helperText={validationErrors.inverseLabel || 'Label for the reverse direction (e.g. Depended On By)'}
                    data-testid="input-inverse-label"
                    inputProps={{ maxLength: 100 }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Sort Order"
                    type="number"
                    value={form.sortOrder}
                    onChange={(e) => updateField('sortOrder', parseInt(e.target.value, 10) || 0)}
                    data-testid="input-sort-order"
                    inputProps={{ min: 0 }}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    multiline
                    rows={3}
                    label="Description"
                    value={form.description}
                    onChange={(e) => updateField('description', e.target.value)}
                    data-testid="input-description"
                  />
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          {/* Semantics */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>Semantics</Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    select
                    label="Directionality"
                    value={form.directionality}
                    onChange={(e) => updateField('directionality', e.target.value as RelationshipDirectionality)}
                    data-testid="select-directionality"
                  >
                    {DIRECTIONALITY_OPTIONS.map((opt) => (
                      <MenuItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </MenuItem>
                    ))}
                  </TextField>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    select
                    label="Risk Propagation"
                    value={form.riskPropagation}
                    onChange={(e) => updateField('riskPropagation', e.target.value as RiskPropagationHint)}
                    data-testid="select-risk-propagation"
                    helperText={RISK_PROPAGATION_OPTIONS.find((o) => o.value === form.riskPropagation)?.description}
                  >
                    {RISK_PROPAGATION_OPTIONS.map((opt) => (
                      <MenuItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </MenuItem>
                    ))}
                  </TextField>
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          {/* Class Compatibility */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>Class Compatibility</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Comma-separated class names. Leave empty to allow any class.
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Allowed Source Classes"
                    value={form.allowedSourceClasses}
                    onChange={(e) => updateField('allowedSourceClasses', e.target.value)}
                    placeholder="e.g. cmdb_ci_application, cmdb_ci_service"
                    helperText="Classes allowed as source CI (empty = any)"
                    data-testid="input-allowed-source-classes"
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Allowed Target Classes"
                    value={form.allowedTargetClasses}
                    onChange={(e) => updateField('allowedTargetClasses', e.target.value)}
                    placeholder="e.g. cmdb_ci_hardware, cmdb_ci_server"
                    helperText="Classes allowed as target CI (empty = any)"
                    data-testid="input-allowed-target-classes"
                  />
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          {/* Constraints */}
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Constraints</Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={form.allowSelfLoop}
                        onChange={(e) => updateField('allowSelfLoop', e.target.checked)}
                        data-testid="switch-allow-self-loop"
                      />
                    }
                    label="Allow Self-Loop (source = target)"
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={form.allowCycles}
                        onChange={(e) => updateField('allowCycles', e.target.checked)}
                        data-testid="switch-allow-cycles"
                      />
                    }
                    label="Allow Cycles"
                  />
                </Grid>
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={form.isActive}
                        onChange={(e) => updateField('isActive', e.target.checked)}
                        data-testid="switch-is-active"
                      />
                    }
                    label="Active"
                  />
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* Sidebar */}
        <Grid item xs={12} md={4}>
          <Card sx={{ mb: 2 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>Metadata</Typography>
              {form.isSystem && (
                <Alert severity="info" sx={{ mb: 2 }} data-testid="system-info">
                  This is a system-defined relationship type. The name cannot be changed.
                </Alert>
              )}
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Directionality: {form.directionality}
              </Typography>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Risk Propagation: {form.riskPropagation}
              </Typography>
              {form.inverseLabel && (
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Inverse: {form.inverseLabel}
                </Typography>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Quick Actions</Typography>
              <Button
                fullWidth
                variant="outlined"
                onClick={() => navigate('/cmdb/relationship-types')}
                data-testid="btn-back-to-list-sidebar"
                sx={{ mb: 1 }}
              >
                Back to List
              </Button>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default CmdbRelationshipTypeDetail;
