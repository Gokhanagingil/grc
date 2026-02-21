import React, { useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
  CircularProgress,
  Alert,
  Chip,
} from '@mui/material';
import {
  Shield as ShieldIcon,
} from '@mui/icons-material';
import {
  itsmApi,
  MitigationActionType,
  ResolvedCustomerRiskData,
} from '../../services/grcClient';
import { useNotification } from '../../contexts/NotificationContext';

// ---------- constants ----------

const ACTION_TYPE_OPTIONS: { value: MitigationActionType; label: string; description: string }[] = [
  { value: 'CHANGE_TASK', label: 'Change Task', description: 'Create a linked ITSM change task' },
  { value: 'RISK_OBSERVATION', label: 'Risk Observation', description: 'Log a risk observation with due date and owner' },
  { value: 'RISK_ACCEPTANCE', label: 'Risk Acceptance', description: 'Accept the risk with justification' },
  { value: 'WAIVER_REQUEST', label: 'Waiver Request', description: 'Request a policy waiver for this risk' },
  { value: 'REMEDIATION', label: 'Remediation', description: 'Plan remediation for the underlying risk' },
];

// ---------- component ----------

interface CreateMitigationModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  changeId: string;
  selectedRisk?: ResolvedCustomerRiskData | null;
}

export const CreateMitigationModal: React.FC<CreateMitigationModalProps> = ({
  open,
  onClose,
  onSuccess,
  changeId,
  selectedRisk,
}) => {
  const { showNotification } = useNotification();

  const [actionType, setActionType] = useState<MitigationActionType>('CHANGE_TASK');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [ownerId, setOwnerId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-populate title when risk is selected
  React.useEffect(() => {
    if (selectedRisk && open) {
      setTitle(`Mitigate: ${selectedRisk.title}`);
      setDescription(
        `Customer risk "${selectedRisk.title}" (${selectedRisk.severity}) detected via ${selectedRisk.relevancePaths.join(', ')}. Contribution score: ${selectedRisk.contributionScore.toFixed(1)}.`
      );
    }
  }, [selectedRisk, open]);

  const resetForm = () => {
    setActionType('CHANGE_TASK');
    setTitle('');
    setDescription('');
    setOwnerId('');
    setDueDate('');
    setComment('');
    setError(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      setError('Title is required.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await itsmApi.changes.createMitigationAction(changeId, {
        actionType,
        title: title.trim(),
        description: description.trim() || undefined,
        catalogRiskId: selectedRisk?.catalogRiskId || undefined,
        bindingId: undefined,
        ownerId: ownerId.trim() || undefined,
        dueDate: dueDate || undefined,
        comment: comment.trim() || undefined,
      });

      showNotification('Mitigation action created successfully', 'success');
      resetForm();
      onSuccess();
    } catch (err) {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to create mitigation action';
      setError(typeof message === 'string' ? message : 'Failed to create mitigation action');
      showNotification('Failed to create mitigation action', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const selectedActionInfo = ACTION_TYPE_OPTIONS.find(o => o.value === actionType);

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      data-testid="create-mitigation-modal"
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <ShieldIcon color="primary" />
          <Typography variant="h6">Create Mitigation Action</Typography>
        </Box>
      </DialogTitle>

      <DialogContent>
        {/* Selected risk info */}
        {selectedRisk && (
          <Alert severity="info" sx={{ mb: 2 }} icon={false}>
            <Typography variant="caption" color="text.secondary" display="block">
              Linked Customer Risk
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
              <Chip
                label={selectedRisk.severity}
                size="small"
                color={
                  selectedRisk.severity === 'CRITICAL' ? 'error'
                    : selectedRisk.severity === 'HIGH' ? 'warning'
                    : selectedRisk.severity === 'MEDIUM' ? 'info'
                    : 'success'
                }
                variant="outlined"
              />
              <Typography variant="body2" fontWeight={500}>
                {selectedRisk.title}
              </Typography>
            </Box>
            {selectedRisk.code && (
              <Typography variant="caption" color="text.secondary">
                {selectedRisk.code}
              </Typography>
            )}
          </Alert>
        )}

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} data-testid="mitigation-modal-error">
            {error}
          </Alert>
        )}

        {/* Action type */}
        <FormControl fullWidth sx={{ mb: 2 }}>
          <InputLabel id="action-type-label">Action Type</InputLabel>
          <Select
            labelId="action-type-label"
            value={actionType}
            label="Action Type"
            onChange={(e) => setActionType(e.target.value as MitigationActionType)}
            data-testid="mitigation-action-type"
          >
            {ACTION_TYPE_OPTIONS.map((opt) => (
              <MenuItem key={opt.value} value={opt.value}>
                <Box>
                  <Typography variant="body2">{opt.label}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {opt.description}
                  </Typography>
                </Box>
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {selectedActionInfo && (
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 2, mt: -1 }}>
            {selectedActionInfo.description}
          </Typography>
        )}

        {/* Title */}
        <TextField
          fullWidth
          label="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          sx={{ mb: 2 }}
          data-testid="mitigation-title"
          inputProps={{ maxLength: 500 }}
        />

        {/* Description */}
        <TextField
          fullWidth
          label="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          multiline
          rows={3}
          sx={{ mb: 2 }}
          data-testid="mitigation-description"
        />

        {/* Owner ID */}
        <TextField
          fullWidth
          label="Owner (User ID)"
          value={ownerId}
          onChange={(e) => setOwnerId(e.target.value)}
          placeholder="UUID of the owner"
          sx={{ mb: 2 }}
          data-testid="mitigation-owner"
          helperText="Assign an owner for this mitigation action"
        />

        {/* Due date */}
        <TextField
          fullWidth
          label="Due Date"
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          sx={{ mb: 2 }}
          data-testid="mitigation-due-date"
          InputLabelProps={{ shrink: true }}
        />

        {/* Comment */}
        <TextField
          fullWidth
          label="Comment"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          multiline
          rows={2}
          data-testid="mitigation-comment"
          placeholder="Additional notes or justification"
        />
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleClose} disabled={submitting}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={submitting || !title.trim()}
          data-testid="mitigation-submit-btn"
          startIcon={submitting ? <CircularProgress size={16} /> : undefined}
        >
          {submitting ? 'Creating...' : 'Create Action'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default CreateMitigationModal;
