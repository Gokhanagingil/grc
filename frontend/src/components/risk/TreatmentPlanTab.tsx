import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  IconButton,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  LinearProgress,
  Alert,
  Tooltip,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  CheckCircle as CompleteIcon,
  PlayArrow as StartIcon,
} from '@mui/icons-material';
import { riskApi, unwrapResponse } from '../../services/grcClient';

interface TreatmentAction {
  id: string;
  title: string;
  description: string | null;
  status: 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  ownerUserId: string | null;
  ownerDisplayName: string | null;
  dueDate: string | null;
  completedAt: string | null;
  progressPct: number;
  evidenceLink: string | null;
  sortOrder: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

interface TreatmentSummary {
  total: number;
  completed: number;
  inProgress: number;
  planned: number;
}

interface TreatmentPlanTabProps {
  riskId: string;
  tenantId: string;
}

const STATUS_OPTIONS = [
  { value: 'PLANNED', label: 'Planned', color: 'default' as const },
  { value: 'IN_PROGRESS', label: 'In Progress', color: 'info' as const },
  { value: 'COMPLETED', label: 'Completed', color: 'success' as const },
  { value: 'CANCELLED', label: 'Cancelled', color: 'error' as const },
];

const getStatusColor = (status: string): 'default' | 'info' | 'success' | 'error' => {
  const option = STATUS_OPTIONS.find((opt) => opt.value === status);
  return option?.color || 'default';
};

const formatDate = (dateString: string | null | undefined): string => {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleDateString();
};

export const TreatmentPlanTab: React.FC<TreatmentPlanTabProps> = ({ riskId, tenantId }) => {
  const [actions, setActions] = useState<TreatmentAction[]>([]);
  const [summary, setSummary] = useState<TreatmentSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAction, setEditingAction] = useState<TreatmentAction | null>(null);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    status: 'PLANNED',
    ownerDisplayName: '',
    dueDate: '',
    progressPct: 0,
    evidenceLink: '',
    notes: '',
  });

  const fetchActions = useCallback(async () => {
    if (!riskId || !tenantId) return;

    setLoading(true);
    setError(null);

    try {
      const [actionsRes, summaryRes] = await Promise.all([
        riskApi.getTreatmentActions(tenantId, riskId),
        riskApi.getTreatmentSummary(tenantId, riskId),
      ]);

      const actionsData = unwrapResponse<TreatmentAction[]>(actionsRes);
      const summaryData = unwrapResponse<TreatmentSummary>(summaryRes);

      setActions(actionsData || []);
      setSummary(summaryData);
    } catch (err) {
      console.error('Error fetching treatment actions:', err);
      setError('Failed to load treatment actions.');
    } finally {
      setLoading(false);
    }
  }, [riskId, tenantId]);

  useEffect(() => {
    fetchActions();
  }, [fetchActions]);

  const handleOpenDialog = (action?: TreatmentAction) => {
    if (action) {
      setEditingAction(action);
      setFormData({
        title: action.title,
        description: action.description || '',
        status: action.status,
        ownerDisplayName: action.ownerDisplayName || '',
        dueDate: action.dueDate ? action.dueDate.split('T')[0] : '',
        progressPct: action.progressPct,
        evidenceLink: action.evidenceLink || '',
        notes: action.notes || '',
      });
    } else {
      setEditingAction(null);
      setFormData({
        title: '',
        description: '',
        status: 'PLANNED',
        ownerDisplayName: '',
        dueDate: '',
        progressPct: 0,
        evidenceLink: '',
        notes: '',
      });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingAction(null);
  };

  const handleSave = async () => {
    if (!formData.title.trim()) {
      setError('Title is required');
      return;
    }

    setSaving(true);
    try {
      const data = {
        title: formData.title,
        description: formData.description || undefined,
        status: formData.status,
        ownerDisplayName: formData.ownerDisplayName || undefined,
        dueDate: formData.dueDate || undefined,
        progressPct: formData.progressPct,
        evidenceLink: formData.evidenceLink || undefined,
        notes: formData.notes || undefined,
      };

      if (editingAction) {
        await riskApi.updateTreatmentAction(tenantId, riskId, editingAction.id, data);
        setSuccess('Action updated successfully');
      } else {
        await riskApi.createTreatmentAction(tenantId, riskId, data);
        setSuccess('Action created successfully');
      }

      handleCloseDialog();
      fetchActions();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error('Error saving action:', err);
      setError('Failed to save action');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (actionId: string) => {
    if (!window.confirm('Are you sure you want to delete this action?')) {
      return;
    }

    try {
      await riskApi.deleteTreatmentAction(tenantId, riskId, actionId);
      setSuccess('Action deleted successfully');
      fetchActions();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error('Error deleting action:', err);
      setError('Failed to delete action');
    }
  };

  const handleQuickStatusUpdate = async (action: TreatmentAction, newStatus: string) => {
    try {
      await riskApi.updateTreatmentAction(tenantId, riskId, action.id, { status: newStatus });
      setSuccess('Status updated');
      fetchActions();
      setTimeout(() => setSuccess(null), 2000);
    } catch (err) {
      console.error('Error updating status:', err);
      setError('Failed to update status');
    }
  };

  if (loading) {
    return (
      <Box sx={{ p: 3 }}>
        <LinearProgress />
        <Typography sx={{ mt: 2 }}>Loading treatment plan...</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 2 }}>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      {summary && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Box display="flex" justifyContent="space-between" alignItems="center">
              <Box>
                <Typography variant="h6">Treatment Plan Progress</Typography>
                <Typography variant="body2" color="text.secondary">
                  {summary.completed} of {summary.total} actions completed
                </Typography>
              </Box>
              <Box display="flex" gap={1}>
                <Chip label={`${summary.planned} Planned`} size="small" />
                <Chip label={`${summary.inProgress} In Progress`} size="small" color="info" />
                <Chip label={`${summary.completed} Completed`} size="small" color="success" />
              </Box>
            </Box>
            {summary.total > 0 && (
              <LinearProgress
                variant="determinate"
                value={(summary.completed / summary.total) * 100}
                sx={{ mt: 2, height: 8, borderRadius: 4 }}
                color="success"
              />
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h6">Treatment Actions</Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => handleOpenDialog()}
              size="small"
            >
              Add Action
            </Button>
          </Box>

          {actions.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography color="text.secondary">
                No treatment actions defined yet.
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Add actions to track the steps needed to mitigate this risk.
              </Typography>
            </Box>
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Title</TableCell>
                  <TableCell>Owner</TableCell>
                  <TableCell>Due Date</TableCell>
                  <TableCell>Progress</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {actions.map((action) => (
                  <TableRow key={action.id} hover>
                    <TableCell>
                      <Typography variant="body2" fontWeight="medium">
                        {action.title}
                      </Typography>
                      {action.description && (
                        <Typography variant="caption" color="text.secondary" display="block">
                          {action.description.length > 50
                            ? `${action.description.substring(0, 50)}...`
                            : action.description}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>{action.ownerDisplayName || '-'}</TableCell>
                    <TableCell>{formatDate(action.dueDate)}</TableCell>
                    <TableCell>
                      <Box display="flex" alignItems="center" gap={1}>
                        <LinearProgress
                          variant="determinate"
                          value={action.progressPct}
                          sx={{ flex: 1, height: 6, borderRadius: 3, minWidth: 60 }}
                          color={action.progressPct === 100 ? 'success' : 'primary'}
                        />
                        <Typography variant="caption">{action.progressPct}%</Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={STATUS_OPTIONS.find((s) => s.value === action.status)?.label || action.status}
                        size="small"
                        color={getStatusColor(action.status)}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Box display="flex" justifyContent="flex-end" gap={0.5}>
                        {action.status === 'PLANNED' && (
                          <Tooltip title="Start">
                            <IconButton
                              size="small"
                              onClick={() => handleQuickStatusUpdate(action, 'IN_PROGRESS')}
                            >
                              <StartIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                        {action.status === 'IN_PROGRESS' && (
                          <Tooltip title="Complete">
                            <IconButton
                              size="small"
                              color="success"
                              onClick={() => handleQuickStatusUpdate(action, 'COMPLETED')}
                            >
                              <CompleteIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                        <Tooltip title="Edit">
                          <IconButton size="small" onClick={() => handleOpenDialog(action)}>
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete">
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => handleDelete(action.id)}
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
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>{editingAction ? 'Edit Action' : 'Add Action'}</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              fullWidth
              label="Title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              required
            />
            <TextField
              fullWidth
              label="Description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              multiline
              rows={2}
            />
            <Box display="flex" gap={2}>
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  value={formData.status}
                  label="Status"
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                >
                  {STATUS_OPTIONS.map((opt) => (
                    <MenuItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField
                fullWidth
                label="Owner"
                value={formData.ownerDisplayName}
                onChange={(e) => setFormData({ ...formData, ownerDisplayName: e.target.value })}
              />
            </Box>
            <Box display="flex" gap={2}>
              <TextField
                fullWidth
                label="Due Date"
                type="date"
                value={formData.dueDate}
                onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                InputLabelProps={{ shrink: true }}
              />
              <TextField
                fullWidth
                label="Progress %"
                type="number"
                value={formData.progressPct}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    progressPct: Math.min(100, Math.max(0, parseInt(e.target.value) || 0)),
                  })
                }
                inputProps={{ min: 0, max: 100 }}
              />
            </Box>
            <TextField
              fullWidth
              label="Evidence Link"
              value={formData.evidenceLink}
              onChange={(e) => setFormData({ ...formData, evidenceLink: e.target.value })}
              placeholder="https://..."
            />
            <TextField
              fullWidth
              label="Notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              multiline
              rows={2}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={saving || !formData.title.trim()}
          >
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default TreatmentPlanTab;
