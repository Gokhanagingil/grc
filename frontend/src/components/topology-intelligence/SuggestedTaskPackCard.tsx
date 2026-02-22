/**
 * SuggestedTaskPackCard
 *
 * Displays topology-driven operational task suggestions for a change.
 * Shows categorized tasks with one-click selection and priority chips.
 * Includes loading skeleton, empty state, and retry CTA.
 *
 * Phase-C, Phase 3: Topology-aware Operational Tasking.
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  CardHeader,
  Typography,
  Chip,
  Checkbox,
  Button,
  Alert,
  Skeleton,
  IconButton,
  Tooltip,
  Collapse,
  Divider,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import PlaylistAddCheckIcon from '@mui/icons-material/PlaylistAddCheck';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import {
  SuggestedTaskData,
  SuggestedTaskPackResponseData,
} from '../../services/grcClient';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SuggestedTaskPackCardProps {
  changeId: string;
  /** Callback to fetch the task pack data */
  onFetch: (changeId: string) => Promise<SuggestedTaskPackResponseData>;
  /** Callback when user wants to create selected tasks (optional, for future use) */
  onCreateTasks?: (tasks: SuggestedTaskData[]) => Promise<void>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CATEGORY_LABELS: Record<string, string> = {
  VALIDATION: 'Validation',
  ROLLBACK_READINESS: 'Rollback Readiness',
  DEPENDENCY_COMMUNICATION: 'Dependency Communication',
  MONITORING: 'Monitoring',
  DOCUMENTATION: 'Documentation',
};

const CATEGORY_COLORS: Record<string, 'primary' | 'error' | 'warning' | 'info' | 'success'> = {
  VALIDATION: 'primary',
  ROLLBACK_READINESS: 'error',
  DEPENDENCY_COMMUNICATION: 'warning',
  MONITORING: 'info',
  DOCUMENTATION: 'success',
};

const PRIORITY_COLORS: Record<string, 'error' | 'warning' | 'info' | 'default'> = {
  CRITICAL: 'error',
  HIGH: 'warning',
  MEDIUM: 'info',
  LOW: 'default',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const SuggestedTaskPackCard: React.FC<SuggestedTaskPackCardProps> = ({
  changeId,
  onFetch,
  onCreateTasks,
}) => {
  const [pack, setPack] = useState<SuggestedTaskPackResponseData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState(true);
  const [creating, setCreating] = useState(false);

  const fetchPack = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await onFetch(changeId);
      setPack(data);
      // Auto-select recommended tasks
      const recommended = new Set(
        data.tasks.filter((t) => t.recommended).map((t) => t.templateKey),
      );
      setSelectedKeys(recommended);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load suggested tasks';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [changeId, onFetch]);

  useEffect(() => {
    fetchPack();
  }, [fetchPack]);

  const toggleTask = (key: string) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const selectAll = () => {
    if (pack) {
      setSelectedKeys(new Set(pack.tasks.map((t) => t.templateKey)));
    }
  };

  const deselectAll = () => {
    setSelectedKeys(new Set());
  };

  const handleCreate = async () => {
    if (!pack || !onCreateTasks) return;
    const selected = pack.tasks.filter((t) => selectedKeys.has(t.templateKey));
    if (selected.length === 0) return;
    setCreating(true);
    try {
      await onCreateTasks(selected);
    } finally {
      setCreating(false);
    }
  };

  // Group tasks by category
  const groupedTasks = pack
    ? pack.tasks.reduce(
        (acc, task) => {
          if (!acc[task.category]) acc[task.category] = [];
          acc[task.category].push(task);
          return acc;
        },
        {} as Record<string, SuggestedTaskData[]>,
      )
    : {};

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <Card
      variant="outlined"
      data-testid="suggested-task-pack-card"
      sx={{ mb: 2 }}
    >
      <CardHeader
        avatar={<PlaylistAddCheckIcon color="primary" />}
        title={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="subtitle1" fontWeight={600}>
              Suggested Task Pack
            </Typography>
            {pack && (
              <Chip
                size="small"
                label={`${pack.totalTasks} tasks`}
                color="primary"
                variant="outlined"
              />
            )}
            {pack && pack.recommendedCount > 0 && (
              <Chip
                size="small"
                label={`${pack.recommendedCount} recommended`}
                color="warning"
                variant="filled"
              />
            )}
          </Box>
        }
        subheader={
          pack
            ? `Risk: ${pack.riskLevel} | Topology Score: ${pack.topologyRiskScore}/100`
            : 'Topology-driven operational tasks'
        }
        action={
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            <Tooltip title="Refresh">
              <IconButton
                size="small"
                onClick={fetchPack}
                disabled={loading}
                data-testid="task-pack-refresh"
              >
                <RefreshIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <IconButton
              size="small"
              onClick={() => setExpanded(!expanded)}
              data-testid="task-pack-toggle"
            >
              {expanded ? (
                <ExpandLessIcon fontSize="small" />
              ) : (
                <ExpandMoreIcon fontSize="small" />
              )}
            </IconButton>
          </Box>
        }
      />

      <Collapse in={expanded}>
        <CardContent sx={{ pt: 0 }}>
          {/* Loading skeleton */}
          {loading && (
            <Box data-testid="task-pack-loading">
              {[1, 2, 3].map((i) => (
                <Box key={i} sx={{ mb: 1.5 }}>
                  <Skeleton variant="text" width="30%" height={24} />
                  <Skeleton variant="rectangular" height={60} sx={{ borderRadius: 1 }} />
                </Box>
              ))}
            </Box>
          )}

          {/* Error state */}
          {!loading && error && (
            <Alert
              severity="warning"
              data-testid="task-pack-error"
              action={
                <Button size="small" onClick={fetchPack}>
                  Retry
                </Button>
              }
            >
              {error}
            </Alert>
          )}

          {/* Empty state */}
          {!loading && !error && pack && pack.tasks.length === 0 && (
            <Alert
              severity="info"
              icon={<CheckCircleOutlineIcon />}
              data-testid="task-pack-empty"
            >
              No topology-driven tasks suggested for this change. The topology
              risk is minimal.
            </Alert>
          )}

          {/* Warnings */}
          {!loading && pack && pack.warnings.length > 0 && (
            <Alert
              severity="info"
              icon={<WarningAmberIcon />}
              sx={{ mb: 1.5 }}
              data-testid="task-pack-warnings"
            >
              {pack.warnings.join(' ')}
            </Alert>
          )}

          {/* Task list grouped by category */}
          {!loading && !error && pack && pack.tasks.length > 0 && (
            <>
              {/* Selection controls */}
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  mb: 1,
                }}
              >
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button size="small" variant="text" onClick={selectAll}>
                    Select All
                  </Button>
                  <Button size="small" variant="text" onClick={deselectAll}>
                    Clear
                  </Button>
                </Box>
                <Typography variant="caption" color="text.secondary">
                  {selectedKeys.size} of {pack.tasks.length} selected
                </Typography>
              </Box>

              {Object.entries(groupedTasks).map(([category, tasks]) => (
                <Box key={category} sx={{ mb: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                    <Chip
                      size="small"
                      label={CATEGORY_LABELS[category] || category}
                      color={CATEGORY_COLORS[category] || 'default'}
                      variant="outlined"
                    />
                    <Typography variant="caption" color="text.secondary">
                      {tasks.length} task{tasks.length !== 1 ? 's' : ''}
                    </Typography>
                  </Box>

                  {tasks.map((task) => (
                    <Box
                      key={task.templateKey}
                      data-testid={`task-item-${task.templateKey}`}
                      sx={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        p: 1,
                        borderRadius: 1,
                        bgcolor: selectedKeys.has(task.templateKey)
                          ? 'action.selected'
                          : 'transparent',
                        '&:hover': { bgcolor: 'action.hover' },
                        cursor: 'pointer',
                      }}
                      onClick={() => toggleTask(task.templateKey)}
                    >
                      <Checkbox
                        checked={selectedKeys.has(task.templateKey)}
                        size="small"
                        sx={{ mt: -0.5, mr: 1 }}
                        tabIndex={-1}
                      />
                      <Box sx={{ flex: 1 }}>
                        <Box
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1,
                            mb: 0.25,
                          }}
                        >
                          <Typography variant="body2" fontWeight={500}>
                            {task.title}
                          </Typography>
                          <Chip
                            size="small"
                            label={task.priority}
                            color={PRIORITY_COLORS[task.priority] || 'default'}
                            variant="filled"
                            sx={{ height: 20, fontSize: '0.7rem' }}
                          />
                          {task.recommended && (
                            <Chip
                              size="small"
                              label="Recommended"
                              color="warning"
                              variant="outlined"
                              sx={{ height: 20, fontSize: '0.7rem' }}
                            />
                          )}
                        </Box>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{ display: 'block', mb: 0.25 }}
                        >
                          {task.description}
                        </Typography>
                        <Typography
                          variant="caption"
                          color="text.disabled"
                          sx={{ fontStyle: 'italic' }}
                        >
                          Why: {task.reason}
                        </Typography>
                      </Box>
                    </Box>
                  ))}

                  <Divider sx={{ mt: 1 }} />
                </Box>
              ))}

              {/* Create tasks button (future: wire to task creation) */}
              {onCreateTasks && (
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1 }}>
                  <Button
                    variant="contained"
                    size="small"
                    disabled={selectedKeys.size === 0 || creating}
                    onClick={handleCreate}
                    startIcon={<PlaylistAddCheckIcon />}
                    data-testid="task-pack-create-btn"
                  >
                    {creating
                      ? 'Creating...'
                      : `Create ${selectedKeys.size} Task${selectedKeys.size !== 1 ? 's' : ''}`}
                  </Button>
                </Box>
              )}
            </>
          )}
        </CardContent>
      </Collapse>
    </Card>
  );
};

export default SuggestedTaskPackCard;
