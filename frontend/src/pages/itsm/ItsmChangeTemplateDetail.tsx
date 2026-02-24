import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Divider,
  FormControl,
  FormControlLabel,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
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
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
} from '@mui/icons-material';
import { itsmApi, ChangeTemplateData, ChangeTemplateTaskData, ChangeTemplateDependencyData } from '../../services/grcClient';
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
  const [dependencies, setDependencies] = useState<ChangeTemplateDependencyData[]>([]);
  const [tasksDirty, setTasksDirty] = useState(false);

  // Inline task editing state
  const [editingTaskIdx, setEditingTaskIdx] = useState<number | null>(null);
  const [editingTask, setEditingTask] = useState<Partial<ChangeTemplateTaskData>>({});

  // Dependency editor state
  const [newDepPredecessor, setNewDepPredecessor] = useState('');
  const [newDepSuccessor, setNewDepSuccessor] = useState('');
  const [depError, setDepError] = useState<string | null>(null);

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
          setDependencies(Array.isArray(inner.dependencies) ? inner.dependencies : []);
          setTasksDirty(false);
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
        const updatePayload: Record<string, unknown> = {
          name: template.name,
          code: template.code,
          description: template.description || null,
          isActive: template.isActive ?? true,
          isGlobal: template.isGlobal ?? false,
        };
        // Include tasks and dependencies if they were edited
        if (tasksDirty) {
          updatePayload.tasks = tasks.map((t, idx) => ({
            taskKey: t.taskKey,
            title: t.title,
            description: t.description || null,
            taskType: t.taskType || 'OTHER',
            defaultStatus: t.defaultStatus || 'OPEN',
            defaultPriority: t.defaultPriority || 'MEDIUM',
            estimatedDurationMinutes: t.estimatedDurationMinutes ?? null,
            sequenceOrder: t.sequenceOrder ?? idx,
            isBlocking: t.isBlocking ?? true,
            sortOrder: t.sortOrder ?? idx,
            stageLabel: t.stageLabel || null,
          }));
          updatePayload.dependencies = dependencies.map((d) => ({
            predecessorTaskKey: d.predecessorTaskKey,
            successorTaskKey: d.successorTaskKey,
          }));
        }
        await itsmApi.changeTemplates.update(id, updatePayload);
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
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Typography variant="h6">
                Template Tasks ({tasks.length})
              </Typography>
              <Button
                size="small"
                startIcon={<AddIcon />}
                onClick={() => {
                  const nextOrder = tasks.length;
                  const newTask: ChangeTemplateTaskData = {
                    id: `new-${Date.now()}`,
                    taskKey: `TASK-${String(nextOrder + 1).padStart(2, '0')}`,
                    title: '',
                    description: null,
                    taskType: 'OTHER',
                    defaultStatus: 'OPEN',
                    defaultPriority: 'MEDIUM',
                    estimatedDurationMinutes: null,
                    sequenceOrder: nextOrder,
                    isBlocking: true,
                    sortOrder: nextOrder,
                    stageLabel: null,
                  };
                  setTasks((prev) => [...prev, newTask]);
                  setEditingTaskIdx(tasks.length);
                  setEditingTask(newTask);
                  setTasksDirty(true);
                }}
                data-testid="add-template-task-btn"
              >
                Add Task
              </Button>
            </Box>
            <Divider sx={{ mb: 2 }} />

            {tasksDirty && (
              <Alert severity="info" sx={{ mb: 2 }}>
                Task changes are unsaved. Click &quot;Save&quot; above to persist.
              </Alert>
            )}

            {tasks.length === 0 ? (
              <Typography variant="body2" color="text.secondary" data-testid="no-template-tasks">
                No tasks defined for this template. Click &quot;Add Task&quot; to create one.
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
                      <TableCell align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {tasks
                      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
                      .map((task, idx) => (
                        <React.Fragment key={task.id || idx}>
                          <TableRow>
                            <TableCell>{task.sequenceOrder ?? task.sortOrder}</TableCell>
                            <TableCell>
                              <Typography variant="body2" fontFamily="monospace" fontSize="0.8rem">
                                {task.taskKey}
                              </Typography>
                            </TableCell>
                            <TableCell>{task.title || <em>untitled</em>}</TableCell>
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
                            <TableCell align="right">
                              <IconButton
                                size="small"
                                onClick={() => {
                                  setEditingTaskIdx(idx);
                                  setEditingTask({ ...task });
                                }}
                                data-testid={`edit-task-${idx}`}
                              >
                                <EditIcon fontSize="small" />
                              </IconButton>
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() => {
                                  const taskKey = tasks[idx].taskKey;
                                  setTasks((prev) => prev.filter((_, i) => i !== idx));
                                  setDependencies((prev) => prev.filter(
                                    (d) => d.predecessorTaskKey !== taskKey && d.successorTaskKey !== taskKey
                                  ));
                                  setTasksDirty(true);
                                  if (editingTaskIdx === idx) {
                                    setEditingTaskIdx(null);
                                    setEditingTask({});
                                  }
                                }}
                                data-testid={`delete-task-${idx}`}
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </TableCell>
                          </TableRow>
                          {editingTaskIdx === idx && (
                            <TableRow>
                              <TableCell colSpan={8}>
                                <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                                  <Grid container spacing={2}>
                                    <Grid item xs={12} sm={4}>
                                      <TextField
                                        fullWidth
                                        size="small"
                                        label="Task Key"
                                        value={editingTask.taskKey || ''}
                                        onChange={(e) => setEditingTask((prev) => ({ ...prev, taskKey: e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, '') }))}
                                      />
                                    </Grid>
                                    <Grid item xs={12} sm={8}>
                                      <TextField
                                        fullWidth
                                        size="small"
                                        label="Title"
                                        value={editingTask.title || ''}
                                        onChange={(e) => setEditingTask((prev) => ({ ...prev, title: e.target.value }))}
                                      />
                                    </Grid>
                                    <Grid item xs={12}>
                                      <TextField
                                        fullWidth
                                        size="small"
                                        label="Description"
                                        value={editingTask.description || ''}
                                        onChange={(e) => setEditingTask((prev) => ({ ...prev, description: e.target.value }))}
                                        multiline
                                        rows={2}
                                      />
                                    </Grid>
                                    <Grid item xs={6} sm={3}>
                                      <FormControl fullWidth size="small">
                                        <InputLabel>Type</InputLabel>
                                        <Select
                                          value={editingTask.taskType || 'OTHER'}
                                          onChange={(e) => setEditingTask((prev) => ({ ...prev, taskType: e.target.value }))}
                                          label="Type"
                                        >
                                          {['PRE_CHECK', 'IMPLEMENTATION', 'VERIFICATION', 'BACKOUT', 'POST_CHECK', 'REVIEW', 'COMMUNICATION', 'OTHER'].map((t) => (
                                            <MenuItem key={t} value={t}>{t}</MenuItem>
                                          ))}
                                        </Select>
                                      </FormControl>
                                    </Grid>
                                    <Grid item xs={6} sm={3}>
                                      <FormControl fullWidth size="small">
                                        <InputLabel>Priority</InputLabel>
                                        <Select
                                          value={editingTask.defaultPriority || 'MEDIUM'}
                                          onChange={(e) => setEditingTask((prev) => ({ ...prev, defaultPriority: e.target.value }))}
                                          label="Priority"
                                        >
                                          {['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map((p) => (
                                            <MenuItem key={p} value={p}>{p}</MenuItem>
                                          ))}
                                        </Select>
                                      </FormControl>
                                    </Grid>
                                    <Grid item xs={6} sm={3}>
                                      <TextField
                                        fullWidth
                                        size="small"
                                        label="Stage Label"
                                        value={editingTask.stageLabel || ''}
                                        onChange={(e) => setEditingTask((prev) => ({ ...prev, stageLabel: e.target.value }))}
                                      />
                                    </Grid>
                                    <Grid item xs={6} sm={3}>
                                      <FormControlLabel
                                        control={
                                          <Switch
                                            checked={editingTask.isBlocking ?? true}
                                            onChange={(e) => setEditingTask((prev) => ({ ...prev, isBlocking: e.target.checked }))}
                                            size="small"
                                          />
                                        }
                                        label="Blocking"
                                      />
                                    </Grid>
                                  </Grid>
                                  <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
                                    <Button
                                      size="small"
                                      variant="contained"
                                      onClick={() => {
                                        if (!editingTask.taskKey?.trim() || !editingTask.title?.trim()) {
                                          showNotification('Task key and title are required', 'error');
                                          return;
                                        }
                                        setTasks((prev) => prev.map((t, i) =>
                                          i === idx ? { ...t, ...editingTask } as ChangeTemplateTaskData : t
                                        ));
                                        setEditingTaskIdx(null);
                                        setEditingTask({});
                                        setTasksDirty(true);
                                      }}
                                      data-testid="save-task-edit-btn"
                                    >
                                      Apply
                                    </Button>
                                    <Button
                                      size="small"
                                      onClick={() => {
                                        setEditingTaskIdx(null);
                                        setEditingTask({});
                                      }}
                                    >
                                      Cancel
                                    </Button>
                                  </Box>
                                </Box>
                              </TableCell>
                            </TableRow>
                          )}
                        </React.Fragment>
                      ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}

            {/* Dependencies Section */}
            {tasks.length >= 2 && (
              <Box sx={{ mt: 3 }}>
                <Typography variant="subtitle1" gutterBottom>
                  Task Dependencies ({dependencies.length})
                </Typography>
                <Divider sx={{ mb: 1 }} />

                {dependencies.length > 0 && (
                  <TableContainer component={Paper} variant="outlined" sx={{ mb: 2 }}>
                    <Table size="small" data-testid="template-deps-table">
                      <TableHead>
                        <TableRow>
                          <TableCell>Predecessor</TableCell>
                          <TableCell>Successor</TableCell>
                          <TableCell align="right">Actions</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {dependencies.map((dep, idx) => (
                          <TableRow key={`${dep.predecessorTaskKey}-${dep.successorTaskKey}`}>
                            <TableCell>
                              <Chip label={dep.predecessorTaskKey} size="small" variant="outlined" />
                            </TableCell>
                            <TableCell>
                              <Chip label={dep.successorTaskKey} size="small" variant="outlined" />
                            </TableCell>
                            <TableCell align="right">
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() => {
                                  setDependencies((prev) => prev.filter((_, i) => i !== idx));
                                  setTasksDirty(true);
                                }}
                                data-testid={`delete-dep-${idx}`}
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}

                {depError && (
                  <Alert severity="error" sx={{ mb: 1 }} onClose={() => setDepError(null)}>
                    {depError}
                  </Alert>
                )}

                <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-end' }}>
                  <FormControl size="small" sx={{ minWidth: 160 }}>
                    <InputLabel>Predecessor</InputLabel>
                    <Select
                      value={newDepPredecessor}
                      onChange={(e) => setNewDepPredecessor(e.target.value)}
                      label="Predecessor"
                      data-testid="dep-predecessor-select"
                    >
                      {tasks.map((t) => (
                        <MenuItem key={t.taskKey} value={t.taskKey}>{t.taskKey}: {t.title || 'untitled'}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <Typography variant="body2" sx={{ mx: 1 }}>&rarr;</Typography>
                  <FormControl size="small" sx={{ minWidth: 160 }}>
                    <InputLabel>Successor</InputLabel>
                    <Select
                      value={newDepSuccessor}
                      onChange={(e) => setNewDepSuccessor(e.target.value)}
                      label="Successor"
                      data-testid="dep-successor-select"
                    >
                      {tasks.map((t) => (
                        <MenuItem key={t.taskKey} value={t.taskKey}>{t.taskKey}: {t.title || 'untitled'}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => {
                      setDepError(null);
                      if (!newDepPredecessor || !newDepSuccessor) {
                        setDepError('Select both predecessor and successor tasks');
                        return;
                      }
                      if (newDepPredecessor === newDepSuccessor) {
                        setDepError('A task cannot depend on itself (self-loop)');
                        return;
                      }
                      const exists = dependencies.some(
                        (d) => d.predecessorTaskKey === newDepPredecessor && d.successorTaskKey === newDepSuccessor
                      );
                      if (exists) {
                        setDepError('This dependency already exists');
                        return;
                      }
                      // Simple cycle detection: check if adding this edge creates a cycle
                      const adj = new Map<string, string[]>();
                      for (const d of dependencies) {
                        if (!adj.has(d.predecessorTaskKey)) adj.set(d.predecessorTaskKey, []);
                        adj.get(d.predecessorTaskKey)!.push(d.successorTaskKey);
                      }
                      if (!adj.has(newDepPredecessor)) adj.set(newDepPredecessor, []);
                      adj.get(newDepPredecessor)!.push(newDepSuccessor);
                      // BFS from successor to see if we can reach predecessor
                      const visited = new Set<string>();
                      const queue = [newDepSuccessor];
                      let hasCycle = false;
                      while (queue.length > 0) {
                        const node = queue.shift()!;
                        if (node === newDepPredecessor) { hasCycle = true; break; }
                        if (visited.has(node)) continue;
                        visited.add(node);
                        for (const next of (adj.get(node) || [])) {
                          queue.push(next);
                        }
                      }
                      if (hasCycle) {
                        setDepError('Adding this dependency would create a cycle');
                        return;
                      }
                      setDependencies((prev) => [...prev, {
                        id: `new-dep-${Date.now()}`,
                        predecessorTaskKey: newDepPredecessor,
                        successorTaskKey: newDepSuccessor,
                      }]);
                      setNewDepPredecessor('');
                      setNewDepSuccessor('');
                      setTasksDirty(true);
                    }}
                    data-testid="add-dep-btn"
                  >
                    Add
                  </Button>
                </Box>
              </Box>
            )}
          </CardContent>
        </Card>
      )}
    </Box>
  );
};

export default ItsmChangeTemplateDetail;
