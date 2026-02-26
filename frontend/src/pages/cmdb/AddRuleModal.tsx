/**
 * AddRuleModal
 *
 * Modal dialog for adding a new class relationship rule.
 * Allows selecting relationship type, target class, direction, and propagation settings.
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  CircularProgress,
  Box,
  Typography,
} from '@mui/material';
import {
  cmdbApi,
  CmdbRelationshipTypeData,
  CmdbCiClassData,
  CreateClassRelationshipRuleDto,
  PropagationPolicy,
  PropagationWeight,
  RuleDirection,
  ensureArray,
} from '../../services/grcClient';
import { classifyApiError } from '../../utils/apiErrorClassifier';

interface AddRuleModalProps {
  open: boolean;
  onClose: () => void;
  onRuleAdded: () => void;
  sourceClassId: string;
}

export const AddRuleModal: React.FC<AddRuleModalProps> = ({
  open,
  onClose,
  onRuleAdded,
  sourceClassId,
}) => {
  // Form state
  const [relationshipTypeId, setRelationshipTypeId] = useState('');
  const [targetClassId, setTargetClassId] = useState('');
  const [direction, setDirection] = useState<RuleDirection>('OUTBOUND');
  const [propagationOverride, setPropagationOverride] = useState<PropagationPolicy | ''>('');
  const [propagationWeight, setPropagationWeight] = useState<PropagationWeight | ''>('');

  // Loading/reference data
  const [relationshipTypes, setRelationshipTypes] = useState<CmdbRelationshipTypeData[]>([]);
  const [classes, setClasses] = useState<CmdbCiClassData[]>([]);
  const [loadingRefs, setLoadingRefs] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch reference data when modal opens
  const fetchReferenceData = useCallback(async () => {
    setLoadingRefs(true);
    setError(null);
    try {
      const [relTypesRes, classesRes] = await Promise.all([
        cmdbApi.relationshipTypes.list({ pageSize: 200 }),
        cmdbApi.classes.list({ pageSize: 500 }),
      ]);

      // Handle relationship types - may be paginated or direct array
      const relTypesData = relTypesRes?.data;
      if (relTypesData) {
        if (relTypesData.data?.items) {
          setRelationshipTypes(ensureArray(relTypesData.data.items));
        } else if (Array.isArray(relTypesData.data)) {
          setRelationshipTypes(relTypesData.data);
        } else if (Array.isArray(relTypesData)) {
          setRelationshipTypes(relTypesData);
        } else {
          setRelationshipTypes([]);
        }
      }

      // Handle classes - may be paginated or direct array
      const classesData = classesRes?.data;
      if (classesData) {
        if (classesData.data?.items) {
          setClasses(ensureArray(classesData.data.items));
        } else if (Array.isArray(classesData.data)) {
          setClasses(classesData.data);
        } else if (Array.isArray(classesData)) {
          setClasses(classesData);
        } else {
          setClasses([]);
        }
      }
    } catch (err) {
      const classified = classifyApiError(err);
      setError(classified.message || 'Failed to load reference data.');
    } finally {
      setLoadingRefs(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      fetchReferenceData();
      // Reset form
      setRelationshipTypeId('');
      setTargetClassId('');
      setDirection('OUTBOUND');
      setPropagationOverride('');
      setPropagationWeight('');
      setError(null);
    }
  }, [open, fetchReferenceData]);

  const handleSubmit = useCallback(async () => {
    if (!relationshipTypeId || !targetClassId) {
      setError('Please select a relationship type and target class.');
      return;
    }

    setSubmitting(true);
    setError(null);

    const dto: CreateClassRelationshipRuleDto = {
      sourceClassId,
      relationshipTypeId,
      targetClassId,
      direction,
    };

    if (propagationOverride) {
      dto.propagationOverride = propagationOverride;
    }
    if (propagationWeight) {
      dto.propagationWeight = propagationWeight;
    }

    try {
      await cmdbApi.classRelationshipRules.create(dto);
      onRuleAdded();
    } catch (err) {
      const classified = classifyApiError(err);
      setError(classified.message || 'Failed to create relationship rule.');
    } finally {
      setSubmitting(false);
    }
  }, [sourceClassId, relationshipTypeId, targetClassId, direction, propagationOverride, propagationWeight, onRuleAdded]);

  const activeRelTypes = relationshipTypes.filter((rt) => rt.isActive);
  const activeClasses = classes.filter((c) => c.isActive && c.id !== sourceClassId);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      data-testid="add-rule-modal"
    >
      <DialogTitle>Add Relationship Rule</DialogTitle>
      <DialogContent>
        {loadingRefs ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress size={28} />
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            {error && (
              <Alert severity="error" data-testid="add-rule-error">
                {error}
              </Alert>
            )}

            <Typography variant="body2" color="text.secondary">
              Define a relationship rule for this class. The rule specifies which relationship type
              can be used with which target class.
            </Typography>

            {/* Relationship Type */}
            <FormControl fullWidth required>
              <InputLabel id="rel-type-label">Relationship Type</InputLabel>
              <Select
                labelId="rel-type-label"
                value={relationshipTypeId}
                onChange={(e) => setRelationshipTypeId(e.target.value)}
                label="Relationship Type"
                data-testid="select-relationship-type"
              >
                {activeRelTypes.map((rt) => (
                  <MenuItem key={rt.id} value={rt.id}>
                    {rt.label || rt.name}
                    <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                      ({rt.name})
                    </Typography>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Target Class */}
            <FormControl fullWidth required>
              <InputLabel id="target-class-label">Target Class</InputLabel>
              <Select
                labelId="target-class-label"
                value={targetClassId}
                onChange={(e) => setTargetClassId(e.target.value)}
                label="Target Class"
                data-testid="select-target-class"
              >
                {activeClasses.map((c) => (
                  <MenuItem key={c.id} value={c.id}>
                    {c.label || c.name}
                    <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                      ({c.name})
                    </Typography>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Direction */}
            <FormControl fullWidth>
              <InputLabel id="direction-label">Direction</InputLabel>
              <Select
                labelId="direction-label"
                value={direction}
                onChange={(e) => setDirection(e.target.value as RuleDirection)}
                label="Direction"
                data-testid="select-direction"
              >
                <MenuItem value="OUTBOUND">Outbound (this class initiates)</MenuItem>
                <MenuItem value="INBOUND">Inbound (this class receives)</MenuItem>
              </Select>
            </FormControl>

            {/* Propagation Override (optional) */}
            <FormControl fullWidth>
              <InputLabel id="propagation-label">Propagation Override (optional)</InputLabel>
              <Select
                labelId="propagation-label"
                value={propagationOverride}
                onChange={(e) => setPropagationOverride(e.target.value as PropagationPolicy | '')}
                label="Propagation Override (optional)"
                data-testid="select-propagation"
              >
                <MenuItem value="">Use default from relationship type</MenuItem>
                <MenuItem value="NONE">None</MenuItem>
                <MenuItem value="UPSTREAM_ONLY">Upstream Only</MenuItem>
                <MenuItem value="DOWNSTREAM_ONLY">Downstream Only</MenuItem>
                <MenuItem value="BOTH">Both</MenuItem>
              </Select>
            </FormControl>

            {/* Propagation Weight (optional) */}
            <FormControl fullWidth>
              <InputLabel id="weight-label">Propagation Weight (optional)</InputLabel>
              <Select
                labelId="weight-label"
                value={propagationWeight}
                onChange={(e) => setPropagationWeight(e.target.value as PropagationWeight | '')}
                label="Propagation Weight (optional)"
                data-testid="select-weight"
              >
                <MenuItem value="">No weight</MenuItem>
                <MenuItem value="LOW">Low</MenuItem>
                <MenuItem value="MEDIUM">Medium</MenuItem>
                <MenuItem value="HIGH">High</MenuItem>
              </Select>
            </FormControl>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={submitting} data-testid="btn-cancel-rule">
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={submitting || loadingRefs || !relationshipTypeId || !targetClassId}
          data-testid="btn-submit-rule"
        >
          {submitting ? <CircularProgress size={20} /> : 'Add Rule'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AddRuleModal;
