/**
 * RelationshipSemanticsTab
 *
 * Displays effective relationship rules for a CI class with inheritance awareness.
 * Shows origin badges (inherited vs local), quick filters, and admin actions.
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  CircularProgress,
  Alert,
  Button,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  ToggleButtonGroup,
  ToggleButton,
  IconButton,
  Tooltip,
  Switch,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  ArrowForward as ArrowForwardIcon,
  ArrowBack as ArrowBackIcon,
  SwapHoriz as SwapHorizIcon,
} from '@mui/icons-material';
import {
  cmdbApi,
  EffectiveRulesResult,
  EffectiveRuleEntry,
  unwrapResponse,
} from '../../services/grcClient';
import { classifyApiError } from '../../utils/apiErrorClassifier';
import { AddRuleModal } from './AddRuleModal';

type RuleFilter = 'all' | 'local' | 'inherited';

interface RelationshipSemanticsTabProps {
  classId: string;
  className?: string;
}

export const RelationshipSemanticsTab: React.FC<RelationshipSemanticsTabProps> = ({
  classId,
}) => {
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [result, setResult] = useState<EffectiveRulesResult | null>(null);
  const [filter, setFilter] = useState<RuleFilter>('all');
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [togglingRuleId, setTogglingRuleId] = useState<string | null>(null);
  const [deletingRuleId, setDeletingRuleId] = useState<string | null>(null);

  const fetchEffectiveRules = useCallback(async () => {
    if (!classId) return;
    setLoading(true);
    setFetchError(null);
    try {
      const response = await cmdbApi.classRelationshipRules.effectiveForClass(classId);
      const data = unwrapResponse<EffectiveRulesResult>(response);
      if (data && typeof data === 'object' && 'effectiveRules' in data) {
        setResult(data);
      } else {
        setResult(null);
      }
    } catch (err) {
      const classified = classifyApiError(err);
      if (classified.kind === 'forbidden') {
        setFetchError('You do not have permission to view relationship rules.');
      } else if (classified.kind === 'network') {
        setFetchError('Network error loading relationship rules. Please try again.');
      } else {
        setFetchError(classified.message || 'Failed to load effective relationship rules.');
      }
    } finally {
      setLoading(false);
    }
  }, [classId]);

  useEffect(() => {
    fetchEffectiveRules();
  }, [fetchEffectiveRules]);

  const handleToggleActive = useCallback(async (rule: EffectiveRuleEntry) => {
    if (rule.inherited) return; // Can't toggle inherited rules
    setActionError(null);
    setTogglingRuleId(rule.ruleId);
    try {
      await cmdbApi.classRelationshipRules.update(rule.ruleId, {
        isActive: !rule.isActive,
      });
      await fetchEffectiveRules();
    } catch (err) {
      const classified = classifyApiError(err);
      setActionError(classified.message || 'Failed to toggle rule status.');
    } finally {
      setTogglingRuleId(null);
    }
  }, [fetchEffectiveRules]);

  const handleDeleteRule = useCallback(async (rule: EffectiveRuleEntry) => {
    if (rule.inherited || rule.isSystem) return;
    setActionError(null);
    setDeletingRuleId(rule.ruleId);
    try {
      await cmdbApi.classRelationshipRules.delete(rule.ruleId);
      await fetchEffectiveRules();
    } catch (err) {
      const classified = classifyApiError(err);
      setActionError(classified.message || 'Failed to delete rule.');
    } finally {
      setDeletingRuleId(null);
    }
  }, [fetchEffectiveRules]);

  const handleRuleAdded = useCallback(() => {
    setAddModalOpen(false);
    fetchEffectiveRules();
  }, [fetchEffectiveRules]);

  const filteredRules: EffectiveRuleEntry[] = (() => {
    if (!result?.effectiveRules) return [];
    const rules = Array.isArray(result.effectiveRules) ? result.effectiveRules : [];
    switch (filter) {
      case 'local':
        return rules.filter((r) => !r.inherited);
      case 'inherited':
        return rules.filter((r) => r.inherited);
      default:
        return rules;
    }
  })();

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }} data-testid="rel-semantics-loading">
        <CircularProgress size={28} />
      </Box>
    );
  }

  if (fetchError) {
    return (
      <Alert
        severity="warning"
        data-testid="rel-semantics-error"
        action={
          <Button color="inherit" size="small" onClick={fetchEffectiveRules}>
            Retry
          </Button>
        }
      >
        {fetchError}
      </Alert>
    );
  }

  if (!result || !result.effectiveRules || result.effectiveRules.length === 0) {
    return (
      <Box data-testid="rel-semantics-empty">
        <Alert severity="info" sx={{ mb: 2 }}>
          No relationship rules defined for this class or its ancestors. Add rules to define allowed relationship patterns.
        </Alert>
        <Button
          variant="outlined"
          startIcon={<AddIcon />}
          onClick={() => setAddModalOpen(true)}
          data-testid="btn-add-rule-empty"
        >
          Add Relationship Rule
        </Button>
        <AddRuleModal
          open={addModalOpen}
          onClose={() => setAddModalOpen(false)}
          onRuleAdded={handleRuleAdded}
          sourceClassId={classId}
        />
      </Box>
    );
  }

  return (
    <Box data-testid="rel-semantics-panel">
      {/* Inline action error — does not hide the rules table */}
      {actionError && (
        <Alert
          severity="error"
          onClose={() => setActionError(null)}
          sx={{ mb: 2 }}
          data-testid="rel-semantics-action-error"
        >
          {actionError}
        </Alert>
      )}
      {/* Summary chips + actions */}
      <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap', alignItems: 'center' }}>
        <Chip
          label={`${result.totalRuleCount} total`}
          size="small"
          color="primary"
          variant="outlined"
          data-testid="rel-rules-total"
        />
        <Chip
          label={`${result.localRuleCount} local`}
          size="small"
          color="success"
          variant="outlined"
          data-testid="rel-rules-local-count"
        />
        <Chip
          label={`${result.inheritedRuleCount} inherited`}
          size="small"
          color="info"
          variant="outlined"
          data-testid="rel-rules-inherited-count"
        />
        <Box sx={{ flexGrow: 1 }} />
        <ToggleButtonGroup
          value={filter}
          exclusive
          onChange={(_, val) => val && setFilter(val as RuleFilter)}
          size="small"
          data-testid="rel-rules-filter"
        >
          <ToggleButton value="all">All</ToggleButton>
          <ToggleButton value="local">Local</ToggleButton>
          <ToggleButton value="inherited">Inherited</ToggleButton>
        </ToggleButtonGroup>
        <Button
          size="small"
          startIcon={<AddIcon />}
          variant="outlined"
          onClick={() => setAddModalOpen(true)}
          data-testid="btn-add-rule"
        >
          Add Rule
        </Button>
        <Button
          size="small"
          startIcon={<RefreshIcon />}
          onClick={fetchEffectiveRules}
          data-testid="rel-rules-refresh"
        >
          Refresh
        </Button>
      </Box>

      {/* Rules table */}
      {filteredRules.length === 0 ? (
        <Alert severity="info" data-testid="rel-rules-filter-empty">
          No {filter === 'local' ? 'local' : 'inherited'} rules found.
        </Alert>
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small" data-testid="rel-rules-table">
            <TableHead>
              <TableRow>
                <TableCell>Relationship Type</TableCell>
                <TableCell>Direction</TableCell>
                <TableCell>Target Class</TableCell>
                <TableCell>Propagation</TableCell>
                <TableCell>Origin</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredRules.map((rule) => (
                <TableRow
                  key={rule.ruleId}
                  data-testid={`rel-rule-row-${rule.ruleId}`}
                  sx={{
                    opacity: rule.isActive ? 1 : 0.5,
                  }}
                >
                  <TableCell>
                    <Typography variant="body2" fontWeight={500}>
                      {rule.relationshipTypeLabel || rule.relationshipTypeName}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" fontFamily="monospace">
                      {rule.relationshipTypeName}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <DirectionIcon direction={rule.direction} directionality={rule.directionality} />
                      <Typography variant="body2">
                        {rule.direction}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {rule.targetClassLabel || rule.targetClassName}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <PropagationDisplay rule={rule} />
                  </TableCell>
                  <TableCell>
                    <OriginBadge rule={rule} />
                  </TableCell>
                  <TableCell>
                    {rule.isSystem && (
                      <Chip label="System" size="small" color="default" variant="outlined" sx={{ mr: 0.5 }} />
                    )}
                    {!rule.inherited && (
                      <Tooltip title={rule.isActive ? 'Deactivate rule' : 'Activate rule'}>
                        <Switch
                          size="small"
                          checked={rule.isActive}
                          onChange={() => handleToggleActive(rule)}
                          disabled={togglingRuleId === rule.ruleId}
                          data-testid={`toggle-rule-${rule.ruleId}`}
                        />
                      </Tooltip>
                    )}
                    {rule.inherited && (
                      <Chip
                        label={rule.isActive ? 'Active' : 'Inactive'}
                        size="small"
                        color={rule.isActive ? 'success' : 'default'}
                        variant="outlined"
                      />
                    )}
                  </TableCell>
                  <TableCell align="right">
                    {!rule.inherited && !rule.isSystem && (
                      <Tooltip title="Remove rule">
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleDeleteRule(rule)}
                          disabled={deletingRuleId === rule.ruleId}
                          data-testid={`delete-rule-${rule.ruleId}`}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Add Rule Modal */}
      <AddRuleModal
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        onRuleAdded={handleRuleAdded}
        sourceClassId={classId}
      />
    </Box>
  );
};

// =============================================================================
// Helper sub-components
// =============================================================================

const DirectionIcon: React.FC<{ direction: string; directionality: string }> = ({
  direction,
  directionality,
}) => {
  if (directionality === 'bidirectional') {
    return <SwapHorizIcon fontSize="small" color="action" />;
  }
  if (direction === 'INBOUND') {
    return <ArrowBackIcon fontSize="small" color="action" />;
  }
  return <ArrowForwardIcon fontSize="small" color="action" />;
};

const PropagationDisplay: React.FC<{ rule: EffectiveRuleEntry }> = ({ rule }) => {
  const policy = rule.propagationOverride || rule.defaultPropagation || 'NONE';
  const isOverride = !!rule.propagationOverride;
  const weight = rule.propagationWeight;

  const colorMap: Record<string, 'default' | 'success' | 'warning' | 'error' | 'info'> = {
    NONE: 'default',
    none: 'default',
    UPSTREAM_ONLY: 'info',
    DOWNSTREAM_ONLY: 'warning',
    BOTH: 'error',
    forward: 'warning',
    reverse: 'info',
    both: 'error',
  };

  return (
    <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center', flexWrap: 'wrap' }}>
      <Chip
        label={policy}
        size="small"
        color={colorMap[policy] || 'default'}
        variant={isOverride ? 'filled' : 'outlined'}
        data-testid={`propagation-${rule.ruleId}`}
      />
      {isOverride && (
        <Typography variant="caption" color="text.secondary">(override)</Typography>
      )}
      {weight && (
        <Chip
          label={weight}
          size="small"
          variant="outlined"
          color={weight === 'HIGH' ? 'error' : weight === 'MEDIUM' ? 'warning' : 'default'}
        />
      )}
    </Box>
  );
};

const OriginBadge: React.FC<{ rule: EffectiveRuleEntry }> = ({ rule }) => {
  if (rule.inherited) {
    return (
      <Tooltip title={`Inherited from ${rule.originClassLabel || rule.originClassName} (depth ${rule.inheritanceDepth})`}>
        <Chip
          label={rule.originClassLabel || rule.originClassName}
          size="small"
          color="info"
          variant="outlined"
          data-testid={`origin-badge-${rule.ruleId}`}
        />
      </Tooltip>
    );
  }
  return (
    <Chip
      label="local"
      size="small"
      color="success"
      data-testid={`origin-badge-${rule.ruleId}`}
    />
  );
};

export default RelationshipSemanticsTab;
