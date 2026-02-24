import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Divider,
  FormControlLabel,
  Grid,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
  Chip,
  Paper,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Save as SaveIcon,
} from '@mui/icons-material';
import { itsmApi, ChangeTemplateData, ChangeTemplateTaskData } from '../../services/grcClient';
import { useNotification } from '../../contexts/NotificationContext';
import { AxiosError } from 'axios';

interface ApiValidationErrorData {
  error?: {
    message?: string;
    fieldErrors?: { field: string; message: string }[];
  };
  message?: string | string[];
}

export const ItsmChangeTemplateDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showNotification } = useNotification();
  const isNew = !id || id === 'new';

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [template, setTemplate] = useState<Partial<ChangeTemplateData>>({
    name: '',
    code: '',
    description: '',
    isActive: true,
    isGlobal: false,
  });
  const [tasks, setTasks] = useState<ChangeTemplateTaskData[]>([]);

  const fetchTemplate = useCallback(async () => {
    if (isNew || !id) return;

    setLoading(true);
    try {
      const response = await itsmApi.changeTemplates.get(id);
      const data = response.data;
      if (data && typeof data === 'object') {
        const envelope = data as Record<string, unknown>;
        const inner = (envelope.data ?? data) as ChangeTemplateData;
        if (inner && typeof inner === 'object' && 'name' in inner) {
          setTemplate(inner);
          setTasks(Array.isArray(inner.tasks) ? inner.tasks : []);
        }
      }
    } catch (error) {
      console.error('Error fetching change template:', error);
      showNotification('Failed to load change template', 'error');
      navigate('/itsm/change-templates');
    } finally {
      setLoading(false);
    }
  }, [id, isNew, navigate, showNotification]);

  useEffect(() => {
    fetchTemplate();
  }, [fetchTemplate]);

  const handleChange = (field: string, value: string | boolean) => {
    setTemplate((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!template.name?.trim()) {
      showNotification('Template name is required', 'error');
      return;
    }
    if (!template.code?.trim()) {
      showNotification('Template code is required', 'error');
      return;
    }

    setSaving(true);
    try {
      if (isNew) {
        const response = await itsmApi.changeTemplates.create({
          name: template.name,
          code: template.code,
          description: template.description || null,
          isActive: template.isActive ?? true,
          isGlobal: template.isGlobal ?? false,
        });
        const data = response.data;
        const envelope = data as Record<string, unknown>;
        const inner = (envelope?.data ?? data) as ChangeTemplateData;
        if (inner && typeof inner === 'object' && 'id' in inner) {
          showNotification('Change template created successfully', 'success');
          navigate(`/itsm/change-templates/${inner.id}`);
        } else {
          showNotification('Change template created successfully', 'success');
          navigate('/itsm/change-templates');
        }
      } else if (id) {
        await itsmApi.changeTemplates.update(id, {
          name: template.name,
          code: template.code,
          description: template.description || null,
          isActive: template.isActive ?? true,
          isGlobal: template.isGlobal ?? false,
        });
        showNotification('Change template updated successfully', 'success');
        fetchTemplate();
      }
    } catch (error: unknown) {
      console.error('Error saving change template:', error);
      const axiosErr = error as AxiosError<ApiValidationErrorData>;
      if (axiosErr?.response?.status === 403) {
        showNotification('You don\'t have permission to manage change templates.', 'error');
      } else if (axiosErr?.response?.status === 409) {
        showNotification('A template with this code already exists.', 'error');
      } else {
        const fieldErrors = axiosErr?.response?.data?.error?.fieldErrors;
        const errMsg = axiosErr?.response?.data?.error?.message;
        const msgArr = axiosErr?.response?.data?.message;
        if (fieldErrors && fieldErrors.length > 0) {
          showNotification(fieldErrors.map(e => `${e.field}: ${e.message}`).join(', '), 'error');
        } else if (errMsg) {
          showNotification(errMsg, 'error');
        } else if (Array.isArray(msgArr)) {
          showNotification(msgArr.join(', '), 'error');
        } else {
          showNotification('Failed to save change template', 'error');
        }
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate('/itsm/change-templates')}
          data-testid="back-to-templates-btn"
        >
          Back to Templates
        </Button>
      </Box>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" fontWeight={600}>
          {isNew ? 'New Change Template' : template.name}
        </Typography>
        <Button
          variant="contained"
          startIcon={<SaveIcon />}
          onClick={handleSave}
          disabled={saving}
          data-testid="save-template-btn"
        >
          {saving ? 'Saving...' : 'Save'}
        </Button>
      </Box>

      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Template Details
          </Typography>
          <Divider sx={{ mb: 3 }} />

          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Template Name"
                value={template.name || ''}
                onChange={(e) => handleChange('name', e.target.value)}
                required
                data-testid="template-name-input"
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Code"
                value={template.code || ''}
                onChange={(e) => handleChange('code', e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ''))}
                required
                helperText="Unique identifier (e.g., STD-CHANGE-01)"
                disabled={!isNew}
                data-testid="template-code-input"
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Description"
                value={template.description || ''}
                onChange={(e) => handleChange('description', e.target.value)}
                multiline
                rows={3}
                data-testid="template-description-input"
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <FormControlLabel
                control={
                  <Switch
                    checked={template.isActive ?? true}
                    onChange={(e) => handleChange('isActive', e.target.checked)}
                    data-testid="template-active-switch"
                  />
                }
                label="Active"
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <FormControlLabel
                control={
                  <Switch
                    checked={template.isGlobal ?? false}
                    onChange={(e) => handleChange('isGlobal', e.target.checked)}
                    data-testid="template-global-switch"
                  />
                }
                label="Global (available to all tenants)"
              />
            </Grid>
          </Grid>

          {!isNew && (
            <Box sx={{ mt: 3 }}>
              <Typography variant="subtitle2" color="text.secondary">
                Version: {template.version ?? 1}
              </Typography>
              <Typography variant="subtitle2" color="text.secondary">
                Created: {template.createdAt ? new Date(template.createdAt).toLocaleString() : '-'}
              </Typography>
              <Typography variant="subtitle2" color="text.secondary">
                Last Updated: {template.updatedAt ? new Date(template.updatedAt).toLocaleString() : '-'}
              </Typography>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Template Tasks Section */}
      {!isNew && (
        <Card sx={{ mt: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Template Tasks ({tasks.length})
            </Typography>
            <Divider sx={{ mb: 2 }} />

            {tasks.length === 0 ? (
              <Typography variant="body2" color="text.secondary" data-testid="no-template-tasks">
                No tasks defined for this template. Tasks can be added via the API.
              </Typography>
            ) : (
              <TableContainer component={Paper} variant="outlined">
                <Table size="small" data-testid="template-tasks-table">
                  <TableHead>
                    <TableRow>
                      <TableCell>Order</TableCell>
                      <TableCell>Key</TableCell>
                      <TableCell>Title</TableCell>
                      <TableCell>Type</TableCell>
                      <TableCell>Priority</TableCell>
                      <TableCell>Blocking</TableCell>
                      <TableCell>Stage</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {tasks
                      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
                      .map((task) => (
                        <TableRow key={task.id}>
                          <TableCell>{task.sequenceOrder ?? task.sortOrder}</TableCell>
                          <TableCell>
                            <Typography variant="body2" fontFamily="monospace" fontSize="0.8rem">
                              {task.taskKey}
                            </Typography>
                          </TableCell>
                          <TableCell>{task.title}</TableCell>
                          <TableCell>
                            <Chip label={task.taskType} size="small" variant="outlined" />
                          </TableCell>
                          <TableCell>
                            <Chip label={task.defaultPriority} size="small" variant="outlined" />
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={task.isBlocking ? 'Yes' : 'No'}
                              size="small"
                              color={task.isBlocking ? 'warning' : 'default'}
                              variant="outlined"
                            />
                          </TableCell>
                          <TableCell>{task.stageLabel || '-'}</TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </CardContent>
        </Card>
      )}
    </Box>
  );
};

export default ItsmChangeTemplateDetail;
