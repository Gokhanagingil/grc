import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Button,
  Typography,
  Alert,
  CircularProgress,
  FormGroup,
  FormControlLabel,
  Checkbox,
  Paper,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Save as SaveIcon,
  Security as SecurityIcon,
} from '@mui/icons-material';
import { AdminPageHeader, AdminCard } from '../../components/admin';
import {
  grcFrameworksApi,
  tenantFrameworksApi,
  GrcFrameworkData,
  unwrapResponse,
} from '../../services/grcClient';
import { useAuth } from '../../contexts/AuthContext';
import { useOnboarding } from '../../contexts/OnboardingContext';

export const AdminFrameworks: React.FC = () => {
  const { user } = useAuth();
  const { refreshContext } = useOnboarding();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [frameworks, setFrameworks] = useState<GrcFrameworkData[]>([]);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [initialKeys, setInitialKeys] = useState<Set<string>>(new Set());

  const fetchData = useCallback(async () => {
    if (!user?.tenantId) return;

    try {
      setLoading(true);
      setError(null);

      const [frameworksResponse, tenantFrameworksResponse] = await Promise.all([
        grcFrameworksApi.list(),
        tenantFrameworksApi.get(user.tenantId),
      ]);

      const frameworksData = unwrapResponse<{ frameworks: GrcFrameworkData[] }>(frameworksResponse);
      const tenantData = unwrapResponse<{ activeKeys: string[] }>(tenantFrameworksResponse);

      setFrameworks(frameworksData.frameworks || []);
      const activeKeys = new Set(tenantData.activeKeys || []);
      setSelectedKeys(activeKeys);
      setInitialKeys(activeKeys);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch frameworks';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [user?.tenantId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleToggle = (key: string) => {
    setSelectedKeys((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(key)) {
        newSet.delete(key);
      } else {
        newSet.add(key);
      }
      return newSet;
    });
    setSuccess(null);
  };

  const handleSave = async () => {
    if (!user?.tenantId) return;

    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      const activeKeys = Array.from(selectedKeys);
      const response = await tenantFrameworksApi.update(user.tenantId, activeKeys);
      const data = unwrapResponse<{ activeKeys: string[] }>(response);

      const newKeys = new Set(data.activeKeys || []);
      setSelectedKeys(newKeys);
      setInitialKeys(newKeys);

      await refreshContext(true);

      setSuccess('Frameworks updated successfully. Menu and gating have been refreshed.');
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update frameworks';
      setError(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const hasChanges = () => {
    if (selectedKeys.size !== initialKeys.size) return true;
    for (const key of selectedKeys) {
      if (!initialKeys.has(key)) return true;
    }
    return false;
  };

  return (
    <Box>
      <AdminPageHeader
        title="Framework Activation"
        subtitle="Manage compliance frameworks for your organization"
        breadcrumbs={[
          { label: 'Admin', href: '/admin' },
          { label: 'Frameworks' },
        ]}
        actions={
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button startIcon={<RefreshIcon />} onClick={fetchData} disabled={loading}>
              Refresh
            </Button>
            <Button
              variant="contained"
              startIcon={<SaveIcon />}
              onClick={handleSave}
              disabled={saving || !hasChanges()}
            >
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </Box>
        }
      />

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

      <Alert severity="info" sx={{ mb: 3 }}>
        Select the compliance frameworks your organization needs to follow. Activating a framework
        will enable related features in Risk Management, Audit, and Compliance modules.
      </Alert>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      ) : (
        <AdminCard title="Available Frameworks" icon={<SecurityIcon />}>
          {frameworks.length === 0 ? (
            <Typography color="text.secondary">
              No frameworks available. Please contact your administrator.
            </Typography>
          ) : (
            <Paper variant="outlined" sx={{ p: 2 }}>
              <FormGroup>
                {frameworks.map((framework) => (
                  <FormControlLabel
                    key={framework.key}
                    control={
                      <Checkbox
                        checked={selectedKeys.has(framework.key)}
                        onChange={() => handleToggle(framework.key)}
                        disabled={saving}
                      />
                    }
                    label={
                      <Box>
                        <Typography variant="body1" component="span" fontWeight="medium">
                          {framework.name}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" component="span" sx={{ ml: 1 }}>
                          ({framework.key})
                        </Typography>
                        {framework.description && (
                          <Typography variant="body2" color="text.secondary" display="block">
                            {framework.description}
                          </Typography>
                        )}
                      </Box>
                    }
                    sx={{ mb: 1, alignItems: 'flex-start' }}
                  />
                ))}
              </FormGroup>
            </Paper>
          )}

          <Box sx={{ mt: 3 }}>
            <Typography variant="body2" color="text.secondary">
              {selectedKeys.size} of {frameworks.length} frameworks selected
            </Typography>
          </Box>
        </AdminCard>
      )}
    </Box>
  );
};

export default AdminFrameworks;
