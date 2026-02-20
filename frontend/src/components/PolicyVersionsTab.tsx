import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  CircularProgress,
} from '@mui/material';
import {
  Add as AddIcon,
  Visibility as ViewIcon,
  Publish as PublishIcon,
  RateReview as ReviewIcon,
  CheckCircle as ApproveIcon,
  Archive as RetireIcon,
} from '@mui/icons-material';
import { policyApi, unwrapPaginatedResponse } from '../services/grcClient';
import { useAuth } from '../contexts/AuthContext';

interface PolicyVersion {
  id: string;
  policyId: string;
  versionNumber: string;
  content: string;
  changeSummary: string;
  effectiveDate: string | null;
  status: 'draft' | 'in_review' | 'approved' | 'published' | 'retired';
  createdBy: string;
  createdAt: string;
}

interface PolicyVersionsTabProps {
  policyId: string;
  policyTitle: string;
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'published':
      return 'success';
    case 'approved':
      return 'info';
    case 'in_review':
      return 'warning';
    case 'draft':
      return 'default';
    case 'retired':
      return 'error';
    default:
      return 'default';
  }
};

const getStatusLabel = (status: string) => {
  switch (status) {
    case 'in_review':
      return 'In Review';
    default:
      return status.charAt(0).toUpperCase() + status.slice(1);
  }
};

export const PolicyVersionsTab: React.FC<PolicyVersionsTabProps> = ({
  policyId,
  policyTitle,
}) => {
  const { user } = useAuth();
  const [versions, setVersions] = useState<PolicyVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [openCreateDialog, setOpenCreateDialog] = useState(false);
  const [openViewDialog, setOpenViewDialog] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<PolicyVersion | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [formData, setFormData] = useState({
    content: '',
    changeSummary: '',
    versionType: 'minor' as 'major' | 'minor',
  });

  const tenantId = user?.tenantId || '';

  const fetchVersions = useCallback(async () => {
    try {
      setError('');
      setLoading(true);
      const response = await policyApi.versions.list(tenantId, policyId);
      const result = unwrapPaginatedResponse<PolicyVersion>(response);
      setVersions(result.items || []);
    } catch (err: unknown) {
      const error = err as { response?: { status?: number; data?: { message?: string } } };
      if (error.response?.status === 404) {
        setVersions([]);
      } else {
        setError(error.response?.data?.message || 'Failed to fetch versions');
      }
    } finally {
      setLoading(false);
    }
  }, [tenantId, policyId]);

  useEffect(() => {
    if (policyId && tenantId) {
      fetchVersions();
    }
  }, [policyId, tenantId, fetchVersions]);

  const handleCreateDraft = async () => {
    try {
      setActionLoading(true);
      setError('');
      await policyApi.versions.create(tenantId, policyId, {
        content: formData.content,
        changeSummary: formData.changeSummary,
        versionType: formData.versionType,
      });
      setOpenCreateDialog(false);
      setFormData({ content: '', changeSummary: '', versionType: 'minor' });
      fetchVersions();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      setError(error.response?.data?.message || 'Failed to create draft version');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSubmitForReview = async (versionId: string) => {
    try {
      setActionLoading(true);
      setError('');
      await policyApi.versions.submitForReview(tenantId, policyId, versionId);
      fetchVersions();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      setError(error.response?.data?.message || 'Failed to submit for review');
    } finally {
      setActionLoading(false);
    }
  };

  const handleApprove = async (versionId: string) => {
    try {
      setActionLoading(true);
      setError('');
      await policyApi.versions.approve(tenantId, policyId, versionId);
      fetchVersions();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      setError(error.response?.data?.message || 'Failed to approve version');
    } finally {
      setActionLoading(false);
    }
  };

  const handlePublish = async (versionId: string) => {
    try {
      setActionLoading(true);
      setError('');
      await policyApi.versions.publish(tenantId, policyId, versionId);
      fetchVersions();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      setError(error.response?.data?.message || 'Failed to publish version');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRetire = async (versionId: string) => {
    try {
      setActionLoading(true);
      setError('');
      await policyApi.versions.retire(tenantId, policyId, versionId);
      fetchVersions();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      setError(error.response?.data?.message || 'Failed to retire version');
    } finally {
      setActionLoading(false);
    }
  };

  const handleViewVersion = (version: PolicyVersion) => {
    setSelectedVersion(version);
    setOpenViewDialog(true);
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" py={4}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h6">Version History - {policyTitle}</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setOpenCreateDialog(true)}
          disabled={actionLoading}
        >
          Create Draft Version
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {versions.length === 0 ? (
        <Box textAlign="center" py={4}>
          <Typography color="textSecondary">
            No versions found. Create the first draft version to get started.
          </Typography>
        </Box>
      ) : (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Version</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Change Summary</TableCell>
              <TableCell>Effective Date</TableCell>
              <TableCell>Created</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {versions.map((version) => (
              <TableRow key={version.id}>
                <TableCell>
                  <Typography variant="body2" fontWeight="medium">
                    v{version.versionNumber}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Chip
                    label={getStatusLabel(version.status)}
                    color={getStatusColor(version.status) as 'success' | 'info' | 'warning' | 'default' | 'error'}
                    size="small"
                  />
                </TableCell>
                <TableCell>
                  <Typography variant="body2" noWrap sx={{ maxWidth: 200 }}>
                    {version.changeSummary || '-'}
                  </Typography>
                </TableCell>
                <TableCell>
                  {version.effectiveDate
                    ? new Date(version.effectiveDate).toLocaleDateString()
                    : '-'}
                </TableCell>
                <TableCell>
                  {new Date(version.createdAt).toLocaleDateString()}
                </TableCell>
                <TableCell>
                  <IconButton
                    size="small"
                    onClick={() => handleViewVersion(version)}
                    title="View"
                  >
                    <ViewIcon fontSize="small" />
                  </IconButton>
                  {version.status === 'draft' && (
                    <IconButton
                      size="small"
                      onClick={() => handleSubmitForReview(version.id)}
                      disabled={actionLoading}
                      title="Submit for Review"
                    >
                      <ReviewIcon fontSize="small" />
                    </IconButton>
                  )}
                  {version.status === 'in_review' && (
                    <IconButton
                      size="small"
                      onClick={() => handleApprove(version.id)}
                      disabled={actionLoading}
                      title="Approve"
                    >
                      <ApproveIcon fontSize="small" />
                    </IconButton>
                  )}
                  {version.status === 'approved' && (
                    <IconButton
                      size="small"
                      onClick={() => handlePublish(version.id)}
                      disabled={actionLoading}
                      title="Publish"
                    >
                      <PublishIcon fontSize="small" />
                    </IconButton>
                  )}
                  {version.status === 'published' && (
                    <IconButton
                      size="small"
                      onClick={() => handleRetire(version.id)}
                      disabled={actionLoading}
                      title="Retire"
                    >
                      <RetireIcon fontSize="small" />
                    </IconButton>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog
        open={openCreateDialog}
        onClose={() => setOpenCreateDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Create Draft Version</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <FormControl fullWidth>
              <InputLabel>Version Type</InputLabel>
              <Select
                value={formData.versionType}
                label="Version Type"
                onChange={(e) =>
                  setFormData({ ...formData, versionType: e.target.value as 'major' | 'minor' })
                }
              >
                <MenuItem value="minor">Minor (e.g., 1.0 → 1.1)</MenuItem>
                <MenuItem value="major">Major (e.g., 1.1 → 2.0)</MenuItem>
              </Select>
            </FormControl>
            <TextField
              fullWidth
              label="Change Summary"
              multiline
              rows={2}
              value={formData.changeSummary}
              onChange={(e) => setFormData({ ...formData, changeSummary: e.target.value })}
              placeholder="Describe the changes in this version..."
            />
            <TextField
              fullWidth
              label="Content"
              multiline
              rows={6}
              value={formData.content}
              onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              placeholder="Policy content (Markdown or HTML)..."
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenCreateDialog(false)}>Cancel</Button>
          <Button
            onClick={handleCreateDraft}
            variant="contained"
            disabled={actionLoading}
          >
            {actionLoading ? <CircularProgress size={24} /> : 'Create Draft'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={openViewDialog}
        onClose={() => setOpenViewDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Version {selectedVersion?.versionNumber} Details
        </DialogTitle>
        <DialogContent>
          {selectedVersion && (
            <Box sx={{ mt: 2 }}>
              <Box display="flex" gap={2} mb={2}>
                <Chip
                  label={getStatusLabel(selectedVersion.status)}
                  color={getStatusColor(selectedVersion.status) as 'success' | 'info' | 'warning' | 'default' | 'error'}
                />
                {selectedVersion.effectiveDate && (
                  <Typography variant="body2" color="textSecondary">
                    Effective: {new Date(selectedVersion.effectiveDate).toLocaleDateString()}
                  </Typography>
                )}
              </Box>
              {selectedVersion.changeSummary && (
                <Box mb={2}>
                  <Typography variant="subtitle2" color="textSecondary">
                    Change Summary
                  </Typography>
                  <Typography variant="body2">{selectedVersion.changeSummary}</Typography>
                </Box>
              )}
              <Box>
                <Typography variant="subtitle2" color="textSecondary">
                  Content
                </Typography>
                <Box
                  sx={{
                    mt: 1,
                    p: 2,
                    bgcolor: 'grey.100',
                    borderRadius: 1,
                    maxHeight: 400,
                    overflow: 'auto',
                  }}
                >
                  <Typography
                    variant="body2"
                    component="pre"
                    sx={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}
                  >
                    {selectedVersion.content || 'No content'}
                  </Typography>
                </Box>
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenViewDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default PolicyVersionsTab;
