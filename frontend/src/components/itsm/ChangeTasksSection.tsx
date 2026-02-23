import React, { useState, useEffect, useCallback } from 'react';
import {
  Alert,
  Box,
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
  FormControl,
  Grid,
  IconButton,
  InputLabel,
  LinearProgress,
  MenuItem,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  Add as AddIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  PlayArrow as PlayArrowIcon,
  CheckCircle as CheckCircleIcon,
  Block as BlockIcon,
  ContentCopy as ContentCopyIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import {
  itsmApi,
  type ChangeTaskData,
  type ChangeTaskSummary,
  type ChangeTemplateData,
  type CreateChangeTaskDto,
  type UpdateChangeTaskDto,
  type ChangeTaskStatus,
  type ChangeTaskType,
  type ChangeTaskPriority,
  type TemplateApplyResult,
} from '../../services/grcClient';

// ---------- Constants ----------

const TASK_STATUS_OPTIONS: { value: ChangeTaskStatus; label: string; color: string }[] = [
  { value: 'DRAFT', label: 'Draft', color: '#9e9e9e' },
  { value: 'OPEN', label: 'Open', color: '#2196f3' },
  { value: 'IN_PROGRESS', label: 'In Progress', color: '#ff9800' },
  { value: 'PENDING', label: 'Pending', color: '#9c27b0' },
  { value: 'COMPLETED', label: 'Completed', color: '#4caf50' },
  { value: 'FAILED', label: 'Failed', color: '#f44336' },
  { value: 'SKIPPED', label: 'Skipped', color: '#607d8b' },
  { value: 'CANCELLED', label: 'Cancelled', color: '#795548' },
];

const TASK_TYPE_OPTIONS: { value: ChangeTaskType; label: string }[] = [
  { value: 'PRE_CHECK', label: 'Pre-Check' },
  { value: 'IMPLEMENTATION', label: 'Implementation' },
  { value: 'VALIDATION', label: 'Validation' },
  { value: 'BACKOUT', label: 'Backout' },
  { value: 'REVIEW', label: 'Review' },
  { value: 'APPROVAL_GATE', label: 'Approval Gate' },
  { value: 'OTHER', label: 'Other' },
];

const TASK_PRIORITY_OPTIONS: { value: ChangeTaskPriority; label: string }[] = [
  { value: 'LOW', label: 'Low' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HIGH', label: 'High' },
  { value: 'CRITICAL', label: 'Critical' },
];

// ---------- Helper functions ----------

function extractTasksFromResponse(raw: unknown): ChangeTaskData[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw !== 'object') return [];
  const obj = raw as Record<string, unknown>;
  if ('data' in obj) {
    if (Array.isArray(obj.data)) return obj.data;
    if (obj.data && typeof obj.data === 'object') {
      const inner = obj.data as Record<string, unknown>;
      if ('items' in inner && Array.isArray(inner.items)) return inner.items;
    }
  }
  if ('items' in obj && Array.isArray(obj.items)) return obj.items;
  return [];
}

function extractSummaryFromResponse(raw: unknown): ChangeTaskSummary | null {
  if (!raw) return null;
  if (typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  if ('data' in obj && obj.data && typeof obj.data === 'object') {
    return obj.data as ChangeTaskSummary;
  }
  if ('total' in obj) return obj as unknown as ChangeTaskSummary;
  return null;
}

function extractTemplatesFromResponse(raw: unknown): ChangeTemplateData[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw !== 'object') return [];
  const obj = raw as Record<string, unknown>;
  if ('data' in obj) {
    if (Array.isArray(obj.data)) return obj.data;
    if (obj.data && typeof obj.data === 'object') {
      const inner = obj.data as Record<string, unknown>;
      if ('items' in inner && Array.isArray(inner.items)) return inner.items;
    }
  }
  if ('items' in obj && Array.isArray(obj.items)) return obj.items;
  return [];
}

function getStatusChipColor(status: string): 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning' {
  switch (status) {
    case 'COMPLETED': return 'success';
    case 'IN_PROGRESS': return 'warning';
    case 'FAILED': return 'error';
    case 'OPEN': case 'READY': return 'info';
    case 'PENDING': case 'BLOCKED': return 'secondary';
    case 'CANCELLED': case 'SKIPPED': return 'default';
    default: return 'default';
  }
}

// ---------- Props ----------

interface ChangeTasksSectionProps {
  changeId: string;
  showNotification: (message: string, severity: 'success' | 'error' | 'warning' | 'info') => void;
}

// ---------- Component ----------

export const ChangeTasksSection: React.FC<ChangeTasksSectionProps> = ({
  changeId,
  showNotification,
}) => {
  const [expanded, setExpanded] = useState(true);
  const [tasks, setTasks] = useState<ChangeTaskData[]>([]);
  const [summary, setSummary] = useState<ChangeTaskSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Task form state
  const [formOpen, setFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<ChangeTaskData | null>(null);
  const [formSaving, setFormSaving] = useState(false);
  const [formData, setFormData] = useState<CreateChangeTaskDto>({
    title: '',
    description: '',
    taskType: 'OTHER',
    priority: 'MEDIUM',
    status: 'OPEN',
    isBlocking: true,
  });

  // Template apply state
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [templates, setTemplates] = useState<ChangeTemplateData[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [templateApplying, setTemplateApplying] = useState(false);
  const [templateResult, setTemplateResult] = useState<TemplateApplyResult | null>(null);

  // ---------- Data Fetching ----------

  const fetchTasks = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [tasksResp, summaryResp] = await Promise.allSettled([
        itsmApi.changes.listTasks(changeId, { pageSize: 100 }),
        itsmApi.changes.getTaskSummary(changeId),
      ]);

      if (tasksResp.status === 'fulfilled') {
        const parsed = extractTasksFromResponse(tasksResp.value.data);
        setTasks(parsed);
      } else {
        setError('Failed to load change tasks');
      }

      if (summaryResp.status === 'fulfilled') {
        const parsed = extractSummaryFromResponse(summaryResp.value.data);
        setSummary(parsed);
      }
    } catch (err) {
      console.error('[ChangeTasksSection] fetch error:', err);
      setError('Failed to load change tasks');
    } finally {
      setLoading(false);
    }
  }, [changeId]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  // ---------- Task CRUD ----------

  const openCreateForm = () => {
    setEditingTask(null);
    setFormData({
      title: '',
      description: '',
      taskType: 'OTHER',
      priority: 'MEDIUM',
      status: 'OPEN',
      isBlocking: true,
    });
    setFormOpen(true);
  };

  const openEditForm = (task: ChangeTaskData) => {
    setEditingTask(task);
    setFormData({
      title: task.title,
      description: task.description || '',
      taskType: task.taskType,
      priority: task.priority,
      status: task.status,
      isBlocking: task.isBlocking,
      sequenceOrder: task.sequenceOrder,
      sortOrder: task.sortOrder,
      stageLabel: task.stageLabel || '',
      notes: task.notes || '',
      estimatedDurationMinutes: task.estimatedDurationMinutes || undefined,
      plannedStartAt: task.plannedStartAt || undefined,
      plannedEndAt: task.plannedEndAt || undefined,
    });
    setFormOpen(true);
  };

  const handleSaveTask = async () => {
    if (!formData.title?.trim()) {
      showNotification('Task title is required', 'error');
      return;
    }
    setFormSaving(true);
    try {
      if (editingTask) {
        const updateDto: UpdateChangeTaskDto = { ...formData };
        await itsmApi.changes.updateTask(changeId, editingTask.id, updateDto);
        showNotification('Task updated', 'success');
      } else {
        await itsmApi.changes.createTask(changeId, formData);
        showNotification('Task created', 'success');
      }
      setFormOpen(false);
      fetchTasks();
    } catch (err) {
      console.error('[ChangeTasksSection] save error:', err);
      const axiosErr = err as { response?: { data?: { message?: string } } };
      showNotification(axiosErr.response?.data?.message || 'Failed to save task', 'error');
    } finally {
      setFormSaving(false);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      await itsmApi.changes.deleteTask(changeId, taskId);
      showNotification('Task deleted', 'success');
      fetchTasks();
    } catch (err) {
      console.error('[ChangeTasksSection] delete error:', err);
      showNotification('Failed to delete task', 'error');
    }
  };

  const handleStatusTransition = async (task: ChangeTaskData, newStatus: ChangeTaskStatus) => {
    try {
      await itsmApi.changes.updateTask(changeId, task.id, { status: newStatus });
      showNotification(`Task status updated to ${newStatus}`, 'success');
      fetchTasks();
    } catch (err) {
      console.error('[ChangeTasksSection] status transition error:', err);
      const axiosErr = err as { response?: { data?: { message?: string } } };
      showNotification(axiosErr.response?.data?.message || 'Failed to update task status', 'error');
    }
  };

  // ---------- Template Apply ----------

  const openTemplateDialog = async () => {
    setTemplateDialogOpen(true);
    setSelectedTemplateId('');
    setTemplateResult(null);
    try {
      const resp = await itsmApi.changeTemplates.list({ isActive: true, pageSize: 50 });
      const parsed = extractTemplatesFromResponse(resp.data);
      setTemplates(parsed);
    } catch (err) {
      console.error('[ChangeTasksSection] template list error:', err);
      setTemplates([]);
    }
  };

  const handleApplyTemplate = async () => {
    if (!selectedTemplateId) return;
    setTemplateApplying(true);
    setTemplateResult(null);
    try {
      const resp = await itsmApi.changeTemplates.apply({
        templateId: selectedTemplateId,
        changeId,
      });
      const result = resp.data as { data?: TemplateApplyResult } | TemplateApplyResult;
      const parsed = ('data' in result && result.data) ? result.data : result as TemplateApplyResult;
      setTemplateResult(parsed);
      showNotification(`Template applied: ${parsed.tasksCreated} tasks created`, 'success');
      fetchTasks();
    } catch (err) {
      console.error('[ChangeTasksSection] template apply error:', err);
      const axiosErr = err as { response?: { data?: { message?: string } } };
      showNotification(axiosErr.response?.data?.message || 'Failed to apply template', 'error');
    } finally {
      setTemplateApplying(false);
    }
  };

  // ---------- Render ----------

  const completedCount = summary?.byStatus?.COMPLETED || 0;
  const totalCount = summary?.total || tasks.length;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <Card sx={{ mt: 2 }} data-testid="change-tasks-section">
      <CardContent>
        {/* Header */}
        <Box
          sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
          onClick={() => setExpanded(!expanded)}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="h6">Change Tasks</Typography>
            {totalCount > 0 && (
              <Chip
                label={`${completedCount}/${totalCount}`}
                size="small"
                color={completedCount === totalCount && totalCount > 0 ? 'success' : 'default'}
              />
            )}
            {summary && summary.readyCount > 0 && (
              <Chip label={`${summary.readyCount} ready`} size="small" color="info" variant="outlined" />
            )}
            {summary && summary.blockedCount > 0 && (
              <Chip label={`${summary.blockedCount} blocked`} size="small" color="warning" variant="outlined" />
            )}
          </Box>
          <IconButton size="small">
            {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </IconButton>
        </Box>

        {/* Progress bar */}
        {totalCount > 0 && (
          <Box sx={{ mt: 1, mb: 1 }}>
            <LinearProgress
              variant="determinate"
              value={progressPercent}
              sx={{ height: 6, borderRadius: 3 }}
              color={progressPercent === 100 ? 'success' : 'primary'}
            />
            <Typography variant="caption" color="text.secondary">
              {progressPercent}% complete
            </Typography>
          </Box>
        )}

        <Collapse in={expanded}>
          {/* Toolbar */}
          <Box sx={{ display: 'flex', gap: 1, mt: 1, mb: 1, flexWrap: 'wrap' }}>
            <Button
              size="small"
              variant="contained"
              startIcon={<AddIcon />}
              onClick={openCreateForm}
              data-testid="create-task-btn"
            >
              Add Task
            </Button>
            <Button
              size="small"
              variant="outlined"
              startIcon={<ContentCopyIcon />}
              onClick={openTemplateDialog}
              data-testid="apply-template-btn"
            >
              Apply Template
            </Button>
            <Button
              size="small"
              variant="text"
              startIcon={<RefreshIcon />}
              onClick={fetchTasks}
              data-testid="refresh-tasks-btn"
            >
              Refresh
            </Button>
          </Box>

          {/* Error state */}
          {error && (
            <Alert severity="error" sx={{ mb: 1 }} data-testid="tasks-error">
              {error}
            </Alert>
          )}

          {/* Loading state */}
          {loading && (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
              <CircularProgress size={32} />
            </Box>
          )}

          {/* Empty state */}
          {!loading && !error && tasks.length === 0 && (
            <Box sx={{ textAlign: 'center', py: 3 }} data-testid="tasks-empty">
              <Typography variant="body2" color="text.secondary">
                No tasks yet. Add tasks manually or apply a template.
              </Typography>
            </Box>
          )}

          {/* Task table */}
          {!loading && tasks.length > 0 && (
            <TableContainer data-testid="tasks-table">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>#</TableCell>
                    <TableCell>Title</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>Priority</TableCell>
                    <TableCell>Stage</TableCell>
                    <TableCell>Readiness</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {tasks.map((task) => (
                    <TableRow key={task.id} hover data-testid={`task-row-${task.id}`}>
                      <TableCell>
                        <Typography variant="caption" color="text.secondary">
                          {task.number || task.sequenceOrder}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Box>
                          <Typography variant="body2" fontWeight={500}>
                            {task.title}
                          </Typography>
                          {task.isBlocking && (
                            <Chip label="Blocking" size="small" variant="outlined" color="warning" sx={{ mt: 0.25, height: 18, fontSize: '0.65rem' }} />
                          )}
                          {task.autoGenerated && (
                            <Chip label="Auto" size="small" variant="outlined" sx={{ mt: 0.25, ml: 0.5, height: 18, fontSize: '0.65rem' }} />
                          )}
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={task.status}
                          size="small"
                          color={getStatusChipColor(task.status)}
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption">
                          {TASK_TYPE_OPTIONS.find(t => t.value === task.taskType)?.label || task.taskType}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption">
                          {task.priority}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption" color="text.secondary">
                          {task.stageLabel || '-'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        {task.readiness ? (
                          task.readiness.isReady ? (
                            <Tooltip title="All predecessors completed">
                              <Chip
                                icon={<CheckCircleIcon sx={{ fontSize: 14 }} />}
                                label="Ready"
                                size="small"
                                color="success"
                                variant="outlined"
                              />
                            </Tooltip>
                          ) : (
                            <Tooltip title={`Waiting on ${task.readiness.blockingPredecessors.length} predecessor(s)`}>
                              <Chip
                                icon={<BlockIcon sx={{ fontSize: 14 }} />}
                                label={`Blocked (${task.readiness.blockingPredecessors.length})`}
                                size="small"
                                color="warning"
                                variant="outlined"
                              />
                            </Tooltip>
                          )
                        ) : (
                          <Typography variant="caption" color="text.secondary">-</Typography>
                        )}
                      </TableCell>
                      <TableCell align="right">
                        <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'flex-end' }}>
                          {/* Quick status transitions */}
                          {(task.status === 'OPEN' || task.status === 'DRAFT') && (
                            <Tooltip title="Start task">
                              <IconButton
                                size="small"
                                color="primary"
                                onClick={() => handleStatusTransition(task, 'IN_PROGRESS')}
                                disabled={task.readiness ? !task.readiness.isReady : false}
                              >
                                <PlayArrowIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                          {task.status === 'IN_PROGRESS' && (
                            <Tooltip title="Complete task">
                              <IconButton
                                size="small"
                                color="success"
                                onClick={() => handleStatusTransition(task, 'COMPLETED')}
                              >
                                <CheckCircleIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                          <Tooltip title="Edit">
                            <IconButton size="small" onClick={() => openEditForm(task)}>
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Delete">
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => handleDeleteTask(task.id)}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Collapse>
      </CardContent>

      {/* ===== Create/Edit Task Dialog ===== */}
      <Dialog open={formOpen} onClose={() => setFormOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingTask ? 'Edit Change Task' : 'Create Change Task'}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                required
                data-testid="task-title-input"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Description"
                value={formData.description || ''}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                multiline
                rows={2}
              />
            </Grid>
            <Grid item xs={6}>
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  value={formData.status || 'OPEN'}
                  label="Status"
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as ChangeTaskStatus })}
                >
                  {TASK_STATUS_OPTIONS.map((opt) => (
                    <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6}>
              <FormControl fullWidth>
                <InputLabel>Type</InputLabel>
                <Select
                  value={formData.taskType || 'OTHER'}
                  label="Type"
                  onChange={(e) => setFormData({ ...formData, taskType: e.target.value as ChangeTaskType })}
                >
                  {TASK_TYPE_OPTIONS.map((opt) => (
                    <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6}>
              <FormControl fullWidth>
                <InputLabel>Priority</InputLabel>
                <Select
                  value={formData.priority || 'MEDIUM'}
                  label="Priority"
                  onChange={(e) => setFormData({ ...formData, priority: e.target.value as ChangeTaskPriority })}
                >
                  {TASK_PRIORITY_OPTIONS.map((opt) => (
                    <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Stage Label"
                value={formData.stageLabel || ''}
                onChange={(e) => setFormData({ ...formData, stageLabel: e.target.value })}
                placeholder="e.g. Pre-Check, Implementation"
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                type="number"
                label="Sequence Order"
                value={formData.sequenceOrder ?? ''}
                onChange={(e) => setFormData({ ...formData, sequenceOrder: e.target.value ? Number(e.target.value) : undefined })}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                type="number"
                label="Est. Duration (min)"
                value={formData.estimatedDurationMinutes ?? ''}
                onChange={(e) => setFormData({ ...formData, estimatedDurationMinutes: e.target.value ? Number(e.target.value) : undefined })}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Planned Start"
                type="datetime-local"
                value={formData.plannedStartAt ? String(formData.plannedStartAt).slice(0, 16) : ''}
                onChange={(e) => setFormData({ ...formData, plannedStartAt: e.target.value || undefined })}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Planned End"
                type="datetime-local"
                value={formData.plannedEndAt ? String(formData.plannedEndAt).slice(0, 16) : ''}
                onChange={(e) => setFormData({ ...formData, plannedEndAt: e.target.value || undefined })}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Notes"
                value={formData.notes || ''}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                multiline
                rows={2}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setFormOpen(false)} disabled={formSaving}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleSaveTask}
            disabled={formSaving || !formData.title?.trim()}
            data-testid="save-task-btn"
          >
            {formSaving ? 'Saving...' : editingTask ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ===== Apply Template Dialog ===== */}
      <Dialog open={templateDialogOpen} onClose={() => setTemplateDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Apply Change Template</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Select a template to auto-generate tasks for this change.
          </Typography>
          <FormControl fullWidth>
            <InputLabel>Template</InputLabel>
            <Select
              value={selectedTemplateId}
              label="Template"
              onChange={(e) => setSelectedTemplateId(e.target.value)}
              data-testid="template-select"
            >
              {templates.length === 0 && (
                <MenuItem disabled value="">No templates available</MenuItem>
              )}
              {templates.map((t) => (
                <MenuItem key={t.id} value={t.id}>
                  {t.name} ({t.code})
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          {templateResult && (
            <Alert severity="success" sx={{ mt: 2 }} data-testid="template-result">
              <Typography variant="body2">
                <strong>{templateResult.tasksCreated}</strong> tasks created,{' '}
                <strong>{templateResult.dependenciesCreated}</strong> dependencies created.
                {templateResult.skipped.length > 0 && (
                  <> Skipped: {templateResult.skipped.join(', ')}.</>
                )}
                {templateResult.conflicts.length > 0 && (
                  <> Conflicts: {templateResult.conflicts.join(', ')}.</>
                )}
              </Typography>
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTemplateDialogOpen(false)}>
            {templateResult ? 'Close' : 'Cancel'}
          </Button>
          {!templateResult && (
            <Button
              variant="contained"
              onClick={handleApplyTemplate}
              disabled={templateApplying || !selectedTemplateId}
              data-testid="apply-template-confirm-btn"
            >
              {templateApplying ? 'Applying...' : 'Apply Template'}
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Card>
  );
};

export default ChangeTasksSection;
