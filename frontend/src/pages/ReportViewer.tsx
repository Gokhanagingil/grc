import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Grid,
  Alert,
  Chip,
  Paper,
  CircularProgress,
  Divider,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  Refresh as RefreshIcon,
  CheckCircle as FinalizeIcon,
  Archive as ArchiveIcon,
  Send as SubmitIcon,
} from '@mui/icons-material';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { LoadingState, ErrorState } from '../components/common';
import { ModuleGuard } from '../components/ModuleGuard';
import { api } from '../services/api';
import DOMPurify from 'dompurify';

interface AuditReport {
  id: number;
  audit_id: number;
  version: number;
  status: 'draft' | 'under_review' | 'final' | 'archived';
  generated_html: string;
  generated_pdf_path: string | null;
  created_by: number;
  created_by_first_name?: string;
  created_by_last_name?: string;
  created_by_email?: string;
  created_at: string;
  updated_at: string;
}

interface ReportPermissions {
  read: boolean;
  write: boolean;
  generate: boolean;
  submitForReview: boolean;
  finalize: boolean;
  archive: boolean;
  regenerate: boolean;
  reportStatus: string;
}

interface Audit {
  id: number;
  name: string;
}

export const ReportViewer: React.FC = () => {
  const { auditId, reportId } = useParams<{ auditId: string; reportId: string }>();
  const navigate = useNavigate();
  useAuth();

  const [report, setReport] = useState<AuditReport | null>(null);
  const [audit, setAudit] = useState<Audit | null>(null);
  const [permissions, setPermissions] = useState<ReportPermissions | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fetchReport = useCallback(async () => {
    if (!auditId || !reportId) return;

    try {
      setLoading(true);
      setError('');
      
      const [reportRes, auditRes, permissionsRes] = await Promise.all([
        api.get(`/grc/audits/${auditId}/reports/${reportId}`),
        api.get(`/grc/audits/${auditId}`),
        api.get(`/grc/audits/${auditId}/reports/${reportId}/permissions`).catch(() => ({ data: null }))
      ]);
      
      setReport(reportRes.data);
      setAudit(auditRes.data);
      setPermissions(permissionsRes.data);
    } catch (err: unknown) {
      const error = err as { response?: { status?: number; data?: { message?: string } } };
      if (error.response?.status === 403) {
        setError('You do not have permission to view this report.');
      } else if (error.response?.status === 404) {
        setError('Report not found.');
      } else {
        setError(error.response?.data?.message || 'Failed to fetch report');
      }
    } finally {
      setLoading(false);
    }
  }, [auditId, reportId]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const handleStatusChange = async (newStatus: string) => {
    if (!auditId || !reportId) return;
    
    try {
      setActionLoading(true);
      setError('');
      await api.patch(`/grc/audits/${auditId}/reports/${reportId}/status`, { status: newStatus });
      setSuccess(`Report status updated to ${newStatus.replace(/_/g, ' ')}`);
      await fetchReport();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      setError(error.response?.data?.message || 'Failed to update report status');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRegenerate = async () => {
    if (!auditId || !reportId) return;
    
    try {
      setActionLoading(true);
      setError('');
      await api.post(`/grc/audits/${auditId}/reports/${reportId}/regenerate`);
      setSuccess('Report regenerated successfully');
      await fetchReport();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      setError(error.response?.data?.message || 'Failed to regenerate report');
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusColor = (status: string): 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning' => {
    switch (status) {
      case 'draft': return 'default';
      case 'under_review': return 'info';
      case 'final': return 'success';
      case 'archived': return 'secondary';
      default: return 'default';
    }
  };

  if (loading) {
    return (
      <ModuleGuard moduleKey="audit">
        <LoadingState message="Loading report..." />
      </ModuleGuard>
    );
  }

  if (error && !report) {
    return (
      <ModuleGuard moduleKey="audit">
        <ErrorState
          title="Failed to load report"
          message={error}
          onRetry={fetchReport}
        />
      </ModuleGuard>
    );
  }

  return (
    <ModuleGuard moduleKey="audit">
      <Box>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Box display="flex" alignItems="center" gap={2}>
            <Button startIcon={<BackIcon />} onClick={() => navigate(`/audits/${auditId}`)}>
              Back to Audit
            </Button>
            <Typography variant="h4">
              {audit?.name} - Report v{report?.version}
            </Typography>
            {report && (
              <Chip
                label={report.status.replace(/_/g, ' ')}
                color={getStatusColor(report.status)}
              />
            )}
          </Box>
        </Box>

        {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
        {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}

        <Grid container spacing={3}>
          <Grid item xs={12} md={9}>
            <Card>
              <CardContent>
                {report?.generated_html ? (
                  <Box
                    sx={{
                      '& img': { maxWidth: '100%' },
                      '& table': { width: '100%', borderCollapse: 'collapse' },
                      '& th, & td': { border: '1px solid #ddd', padding: '8px' },
                    }}
                    dangerouslySetInnerHTML={{
                      __html: DOMPurify.sanitize(report.generated_html)
                    }}
                  />
                ) : (
                  <Typography color="textSecondary">No report content available.</Typography>
                )}
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={3}>
            <Card sx={{ position: 'sticky', top: 20 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>Report Details</Typography>
                <Divider sx={{ mb: 2 }} />
                
                <Box mb={2}>
                  <Typography variant="body2" color="textSecondary">Status</Typography>
                  <Chip
                    label={report?.status.replace(/_/g, ' ')}
                    color={getStatusColor(report?.status || '')}
                    size="small"
                  />
                </Box>

                <Box mb={2}>
                  <Typography variant="body2" color="textSecondary">Version</Typography>
                  <Typography>v{report?.version}</Typography>
                </Box>

                <Box mb={2}>
                  <Typography variant="body2" color="textSecondary">Created By</Typography>
                  <Typography>
                    {report?.created_by_first_name && report?.created_by_last_name
                      ? `${report.created_by_first_name} ${report.created_by_last_name}`
                      : 'Unknown'}
                  </Typography>
                  {report?.created_by_email && (
                    <Typography variant="body2" color="textSecondary">
                      {report.created_by_email}
                    </Typography>
                  )}
                </Box>

                <Box mb={2}>
                  <Typography variant="body2" color="textSecondary">Created At</Typography>
                  <Typography>{report?.created_at ? new Date(report.created_at).toLocaleString() : '-'}</Typography>
                </Box>

                <Box mb={2}>
                  <Typography variant="body2" color="textSecondary">Last Updated</Typography>
                  <Typography>{report?.updated_at ? new Date(report.updated_at).toLocaleString() : '-'}</Typography>
                </Box>

                <Divider sx={{ my: 2 }} />
                <Typography variant="h6" gutterBottom>Actions</Typography>

                <Box display="flex" flexDirection="column" gap={1}>
                  {permissions?.regenerate && (report?.status === 'draft' || report?.status === 'under_review') && (
                    <Button
                      variant="outlined"
                      startIcon={actionLoading ? <CircularProgress size={20} /> : <RefreshIcon />}
                      onClick={handleRegenerate}
                      disabled={actionLoading}
                      fullWidth
                    >
                      Regenerate
                    </Button>
                  )}

                  {permissions?.submitForReview && report?.status === 'draft' && (
                    <Button
                      variant="contained"
                      color="primary"
                      startIcon={actionLoading ? <CircularProgress size={20} /> : <SubmitIcon />}
                      onClick={() => handleStatusChange('under_review')}
                      disabled={actionLoading}
                      fullWidth
                    >
                      Submit for Review
                    </Button>
                  )}

                  {permissions?.finalize && report?.status === 'under_review' && (
                    <Button
                      variant="contained"
                      color="success"
                      startIcon={actionLoading ? <CircularProgress size={20} /> : <FinalizeIcon />}
                      onClick={() => handleStatusChange('final')}
                      disabled={actionLoading}
                      fullWidth
                    >
                      Finalize Report
                    </Button>
                  )}

                  {permissions?.archive && report?.status === 'final' && (
                    <Button
                      variant="outlined"
                      color="secondary"
                      startIcon={actionLoading ? <CircularProgress size={20} /> : <ArchiveIcon />}
                      onClick={() => handleStatusChange('archived')}
                      disabled={actionLoading}
                      fullWidth
                    >
                      Archive Report
                    </Button>
                  )}
                </Box>

                {report?.status === 'final' && (
                  <Paper sx={{ mt: 2, p: 1, bgcolor: 'success.light' }}>
                    <Typography variant="body2" color="success.contrastText">
                      This report has been finalized and cannot be modified.
                    </Typography>
                  </Paper>
                )}

                {report?.status === 'archived' && (
                  <Paper sx={{ mt: 2, p: 1, bgcolor: 'grey.300' }}>
                    <Typography variant="body2">
                      This report has been archived.
                    </Typography>
                  </Paper>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Box>
    </ModuleGuard>
  );
};

export default ReportViewer;
