import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  Select,
  MenuItem,
  Alert,
  CircularProgress,
  Chip,
} from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import RestoreIcon from '@mui/icons-material/Restore';
import { useAuth } from '../../../contexts/AuthContext';
import { api } from '../../../services/api';
import { API_PATHS } from '../../../services/grcClient';

const IMPACTS = ['high', 'medium', 'low'] as const;
const URGENCIES = ['high', 'medium', 'low'] as const;
const PRIORITIES = ['p1', 'p2', 'p3', 'p4', 'p5'] as const;

const PRIORITY_COLORS: Record<string, 'error' | 'warning' | 'info' | 'default' | 'success'> = {
  p1: 'error',
  p2: 'warning',
  p3: 'info',
  p4: 'default',
  p5: 'success',
};

interface MatrixEntry {
  impact: string;
  urgency: string;
  priority: string;
  label: string | null;
}

/**
 * ITSM Studio — Priority Matrix Configuration
 *
 * Admin UI for configuring the incident impact × urgency → priority matrix.
 * The matrix is tenant-specific and persisted via the backend API.
 * Changes here affect how incident priority is auto-computed.
 */
export const ItsmStudioPriorityMatrix: React.FC = () => {
  const { user } = useAuth();
  const [matrix, setMatrix] = useState<MatrixEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  const loadMatrix = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get(API_PATHS.ITSM.PRIORITY_MATRIX.GET);
      const rows = response?.data?.data || response?.data || [];
      setMatrix(Array.isArray(rows) ? rows : []);
    } catch (err) {
      setError('Failed to load priority matrix');
      console.error('Failed to load priority matrix:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) loadMatrix();
  }, [user, loadMatrix]);

  const getEntry = (impact: string, urgency: string): string => {
    const entry = matrix.find((e) => e.impact === impact && e.urgency === urgency);
    return entry?.priority || 'p3';
  };

  const updateEntry = (impact: string, urgency: string, priority: string) => {
    setMatrix((prev) => {
      const existing = prev.find((e) => e.impact === impact && e.urgency === urgency);
      if (existing) {
        return prev.map((e) =>
          e.impact === impact && e.urgency === urgency
            ? { ...e, priority }
            : e,
        );
      }
      return [
        ...prev,
        { impact, urgency, priority, label: `${impact} impact × ${urgency} urgency` },
      ];
    });
    setDirty(true);
    setSuccess(null);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      const entries = IMPACTS.flatMap((impact) =>
        URGENCIES.map((urgency) => ({
          impact,
          urgency,
          priority: getEntry(impact, urgency),
          label: `${impact} impact × ${urgency} urgency`,
        })),
      );

      await api.put(API_PATHS.ITSM.PRIORITY_MATRIX.UPSERT, { entries });

      setSuccess('Priority matrix saved successfully');
      setDirty(false);
    } catch (err) {
      setError('Failed to save priority matrix');
      console.error('Failed to save priority matrix:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleSeedDefault = async () => {
    try {
      setSaving(true);
      setError(null);
      await api.post(API_PATHS.ITSM.PRIORITY_MATRIX.SEED, {});
      await loadMatrix();
      setSuccess('Default ITIL matrix seeded');
      setDirty(false);
    } catch (err) {
      setError('Failed to seed default matrix');
      console.error('Failed to seed default matrix:', err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h5" gutterBottom>
            Priority Matrix Configuration
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Configure how incident priority is auto-computed from Impact × Urgency.
            Changes apply to all new and edited incidents for this tenant.
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            startIcon={<RestoreIcon />}
            onClick={handleSeedDefault}
            disabled={saving}
          >
            Reset to ITIL Default
          </Button>
          <Button
            variant="contained"
            startIcon={<SaveIcon />}
            onClick={handleSave}
            disabled={saving || !dirty}
          >
            {saving ? 'Saving...' : 'Save Matrix'}
          </Button>
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 'bold', bgcolor: 'grey.100' }}>
                Impact ↓ / Urgency →
              </TableCell>
              {URGENCIES.map((urgency) => (
                <TableCell key={urgency} align="center" sx={{ fontWeight: 'bold', bgcolor: 'grey.100', textTransform: 'capitalize' }}>
                  {urgency}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {IMPACTS.map((impact) => (
              <TableRow key={impact}>
                <TableCell sx={{ fontWeight: 'bold', textTransform: 'capitalize', bgcolor: 'grey.50' }}>
                  {impact}
                </TableCell>
                {URGENCIES.map((urgency) => {
                  const currentPriority = getEntry(impact, urgency);
                  return (
                    <TableCell key={urgency} align="center">
                      <Select
                        value={currentPriority}
                        onChange={(e) => updateEntry(impact, urgency, e.target.value)}
                        size="small"
                        sx={{ minWidth: 90 }}
                        data-testid={`matrix-${impact}-${urgency}`}
                      >
                        {PRIORITIES.map((p) => (
                          <MenuItem key={p} value={p}>
                            <Chip
                              label={p.toUpperCase()}
                              size="small"
                              color={PRIORITY_COLORS[p]}
                              variant="filled"
                            />
                          </MenuItem>
                        ))}
                      </Select>
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Box sx={{ mt: 3 }}>
        <Typography variant="subtitle2" gutterBottom>
          Priority Legend
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          {PRIORITIES.map((p) => (
            <Chip key={p} label={p.toUpperCase()} color={PRIORITY_COLORS[p]} size="small" />
          ))}
        </Box>
        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
          P1 = Critical (highest) → P5 = Planning (lowest). Priority is auto-computed by the backend
          when incidents are created or when impact/urgency is changed.
        </Typography>
      </Box>
    </Box>
  );
};
