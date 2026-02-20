import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  CircularProgress,
  Paper,
} from '@mui/material';
import {
  Description as ReportIcon,
  Print as PrintIcon,
} from '@mui/icons-material';
import { auditReportTemplateApi, unwrapResponse, unwrapPaginatedResponse } from '../services/grcClient';
import { useAuth } from '../contexts/AuthContext';

interface AuditReportTemplate {
  id: string;
  name: string;
  standard: string;
  language: string;
  description?: string;
}

interface AuditReportDialogProps {
  open: boolean;
  onClose: () => void;
  auditContext?: Record<string, unknown>;
  title?: string;
}

export const AuditReportDialog: React.FC<AuditReportDialogProps> = ({
  open,
  onClose,
  auditContext = {},
  title = 'Generate Audit Report',
}) => {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<AuditReportTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [error, setError] = useState('');
  const [renderedReport, setRenderedReport] = useState<string>('');

  const tenantId = user?.tenantId || '';

  const fetchTemplates = useCallback(async () => {
    try {
      setTemplatesLoading(true);
      setError('');
      const response = await auditReportTemplateApi.list(tenantId);
      const result = unwrapPaginatedResponse<AuditReportTemplate>(response);
      setTemplates(result.items || []);
      if (result.items && result.items.length > 0) {
        setSelectedTemplateId(result.items[0].id);
      }
    } catch (err: unknown) {
      console.warn('Failed to fetch report templates:', err);
      setTemplates([]);
    } finally {
      setTemplatesLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    if (open && tenantId) {
      fetchTemplates();
    }
  }, [open, tenantId, fetchTemplates]);

  const handleGenerateReport = async () => {
    if (!selectedTemplateId) {
      setError('Please select a template');
      return;
    }

    try {
      setLoading(true);
      setError('');
      const response = await auditReportTemplateApi.render(tenantId, selectedTemplateId, auditContext);
      const result = unwrapResponse<{ html: string }>(response);
      setRenderedReport(result.html || '');
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      setError(error.response?.data?.message || 'Failed to generate report');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Audit Report</title>
            <style>
              body { font-family: Arial, sans-serif; padding: 20px; }
              h1, h2, h3 { color: #333; }
              table { border-collapse: collapse; width: 100%; }
              th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
              th { background-color: #f4f4f4; }
            </style>
          </head>
          <body>
            ${renderedReport}
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    }
  };

  const handleClose = () => {
    setRenderedReport('');
    setError('');
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="lg" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
            {error}
          </Alert>
        )}

        {!renderedReport ? (
          <Box sx={{ mt: 2 }}>
            {templatesLoading ? (
              <Box display="flex" justifyContent="center" py={4}>
                <CircularProgress />
              </Box>
            ) : templates.length === 0 ? (
              <Box textAlign="center" py={4}>
                <ReportIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
                <Typography variant="h6" color="textSecondary" gutterBottom>
                  Coming Soon
                </Typography>
                <Typography color="textSecondary">
                  Report generation will be available once templates are configured by your administrator.
                </Typography>
              </Box>
            ) : (
              <Box>
                <FormControl fullWidth sx={{ mb: 3 }}>
                  <InputLabel>Select Template</InputLabel>
                  <Select
                    value={selectedTemplateId}
                    label="Select Template"
                    onChange={(e) => setSelectedTemplateId(e.target.value)}
                  >
                    {templates.map((template) => (
                      <MenuItem key={template.id} value={template.id}>
                        {template.name} ({template.standard} - {template.language.toUpperCase()})
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                {selectedTemplateId && (
                  <Box>
                    <Typography variant="subtitle2" color="textSecondary" gutterBottom>
                      Template Details
                    </Typography>
                    {templates
                      .filter((t) => t.id === selectedTemplateId)
                      .map((template) => (
                        <Box key={template.id}>
                          <Typography variant="body2">
                            <strong>Standard:</strong> {template.standard}
                          </Typography>
                          <Typography variant="body2">
                            <strong>Language:</strong> {template.language.toUpperCase()}
                          </Typography>
                          {template.description && (
                            <Typography variant="body2">
                              <strong>Description:</strong> {template.description}
                            </Typography>
                          )}
                        </Box>
                      ))}
                  </Box>
                )}
              </Box>
            )}
          </Box>
        ) : (
          <Box sx={{ mt: 2 }}>
            <Box display="flex" justifyContent="flex-end" mb={2}>
              <Button
                variant="outlined"
                startIcon={<PrintIcon />}
                onClick={handlePrint}
              >
                Print Report
              </Button>
            </Box>
            <Paper
              variant="outlined"
              sx={{
                p: 3,
                maxHeight: '60vh',
                overflow: 'auto',
                bgcolor: 'grey.50',
              }}
            >
              <div dangerouslySetInnerHTML={{ __html: renderedReport }} />
            </Paper>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>
          {renderedReport ? 'Close' : 'Cancel'}
        </Button>
        {!renderedReport && templates.length > 0 && (
          <Button
            onClick={handleGenerateReport}
            variant="contained"
            disabled={loading || !selectedTemplateId}
            startIcon={loading ? <CircularProgress size={20} /> : <ReportIcon />}
          >
            {loading ? 'Generating...' : 'Generate Report'}
          </Button>
        )}
        {renderedReport && (
          <Button
            onClick={() => setRenderedReport('')}
            variant="outlined"
          >
            Back to Templates
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default AuditReportDialog;
