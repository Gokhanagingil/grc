import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Grid,
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
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon,
  Gavel as ComplianceIcon,
  Description as ReportIcon,
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFnsV3';
import { useNavigate } from 'react-router-dom';
import { requirementApi, unwrapPaginatedRequirementResponse } from '../services/grcClient';
import { useAuth } from '../contexts/AuthContext';
import { LoadingState, ErrorState, EmptyState, ResponsiveTable, TableToolbar, FilterOption } from '../components/common';
import { AuditReportDialog } from '../components/AuditReportDialog';

interface ComplianceRequirement {
  id: number;
  title: string;
  description: string;
  regulation: string;
  category: string;
  status: string;
  due_date: string;
  evidence: string;
  owner_first_name: string;
  owner_last_name: string;
  assigned_first_name: string;
  assigned_last_name: string;
  created_at: string;
}

export const Compliance: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [requirements, setRequirements] = useState<ComplianceRequirement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [openDialog, setOpenDialog] = useState(false);
  const [editingRequirement, setEditingRequirement] = useState<ComplianceRequirement | null>(null);
  const [openReportDialog, setOpenReportDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    regulation: '',
    category: '',
    status: 'pending',
    dueDate: null as Date | null,
    evidence: '',
    assignedTo: '',
  });

  // Get tenant ID from user context
  const tenantId = user?.tenantId || '';

  const fetchRequirements = useCallback(async () => {
    try {
      setError('');
      const response = await requirementApi.list(tenantId);
      // Handle NestJS response format with field transformation (framework -> regulation)
      const result = unwrapPaginatedRequirementResponse<ComplianceRequirement>(response);
      setRequirements(result.items || []);
    } catch (err: unknown) {
      const error = err as { response?: { status?: number; data?: { message?: string; error?: { message?: string } } } };
      const status = error.response?.status;
      const message = error.response?.data?.error?.message || error.response?.data?.message;
      
      if (status === 401) {
        setError('Session expired. Please login again.');
      } else if (status === 403) {
        setError('You do not have permission to view compliance requirements.');
      } else if (status === 404 || status === 502) {
        setRequirements([]);
        console.warn('Compliance backend not available');
      } else {
        setError(message || 'Failed to fetch compliance requirements. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    fetchRequirements();
  }, [fetchRequirements]);

    const handleCreateRequirement = () => {
      setEditingRequirement(null);
      setFormData({
        title: '',
        description: '',
        regulation: 'iso27001',
        category: '',
        status: 'not_started',
        dueDate: null,
        evidence: '',
        assignedTo: '',
      });
      setOpenDialog(true);
    };

  const handleEditRequirement = (requirement: ComplianceRequirement) => {
    setEditingRequirement(requirement);
    setFormData({
      title: requirement.title,
      description: requirement.description || '',
      regulation: requirement.regulation || '',
      category: requirement.category || '',
      status: requirement.status,
      dueDate: requirement.due_date ? new Date(requirement.due_date) : null,
      evidence: requirement.evidence || '',
      assignedTo: '',
    });
    setOpenDialog(true);
  };

  const handleViewRequirement = (requirement: ComplianceRequirement) => {
    navigate(`/requirements/${requirement.id}`);
  };

  const handleSaveRequirement = async () => {
    try {
      const requirementData = {
        title: formData.title, // NestJS requirement uses 'title'
        description: formData.description,
        framework: formData.regulation, // NestJS uses 'framework' instead of 'regulation'
        referenceCode: `REQ-${Date.now()}`, // Generate a unique reference code (required by backend)
        category: formData.category,
        status: formData.status,
        dueDate: formData.dueDate?.toISOString().split('T')[0],
      };

      if (editingRequirement) {
        await requirementApi.update(tenantId, String(editingRequirement.id), requirementData);
      } else {
        await requirementApi.create(tenantId, requirementData);
      }

      setOpenDialog(false);
      fetchRequirements();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      setError(error.response?.data?.message || 'Failed to save compliance requirement');
    }
  };

  const handleDeleteRequirement = async (id: number) => {
    if (window.confirm('Are you sure you want to delete this compliance requirement?')) {
      try {
        await requirementApi.delete(tenantId, String(id));
        fetchRequirements();
      } catch (err: unknown) {
        const error = err as { response?: { data?: { message?: string } } };
        setError(error.response?.data?.message || 'Failed to delete compliance requirement');
      }
    }
  };

    const getStatusColor = (status: string) => {
      switch (status) {
        case 'verified': return 'success';
        case 'implemented': return 'info';
        case 'in_progress': return 'warning';
        case 'not_started': return 'default';
        case 'non_compliant': return 'error';
        default: return 'default';
      }
    };

  const isOverdue = (dueDate: string) => {
    return new Date(dueDate) < new Date();
  };

  if (loading) {
    return <LoadingState message="Loading compliance requirements..." />;
  }

  if (error && requirements.length === 0) {
    return (
      <ErrorState
        title="Failed to load requirements"
        message={error}
        onRetry={fetchRequirements}
      />
    );
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">Compliance Management</Typography>
        <Box display="flex" gap={2}>
          <Button
            variant="outlined"
            startIcon={<ReportIcon />}
            onClick={() => setOpenReportDialog(true)}
          >
            Generate Report
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleCreateRequirement}
          >
            New Requirement
          </Button>
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* Toolbar with Search and Filters */}
      <TableToolbar
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search requirements..."
        filters={[
          ...(statusFilter ? [{ key: 'status', label: 'Status', value: statusFilter.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()) }] : []),
        ] as FilterOption[]}
        onFilterRemove={(key) => {
          if (key === 'status') setStatusFilter('');
        }}
        onClearFilters={() => {
          setStatusFilter('');
          setSearchQuery('');
        }}
        onRefresh={fetchRequirements}
        loading={loading}
        actions={
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel>Status</InputLabel>
            <Select
              value={statusFilter}
              label="Status"
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <MenuItem value="">All</MenuItem>
              <MenuItem value="not_started">Not Started</MenuItem>
              <MenuItem value="in_progress">In Progress</MenuItem>
              <MenuItem value="implemented">Implemented</MenuItem>
              <MenuItem value="verified">Verified</MenuItem>
              <MenuItem value="non_compliant">Non-Compliant</MenuItem>
            </Select>
          </FormControl>
        }
      />

      <Card>
        <CardContent>
          <ResponsiveTable minWidth={800}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Title</TableCell>
                  <TableCell>Regulation</TableCell>
                  <TableCell>Category</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Owner</TableCell>
                  <TableCell>Due Date</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {requirements.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center" sx={{ py: 0, border: 'none' }}>
                      <EmptyState
                        icon={<ComplianceIcon sx={{ fontSize: 64, color: 'text.disabled' }} />}
                        title="No compliance requirements found"
                        message="Get started by creating your first compliance requirement."
                        actionLabel="Create Requirement"
                        onAction={handleCreateRequirement}
                        minHeight="200px"
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  requirements.map((requirement) => (
                    <TableRow key={requirement.id}>
                      <TableCell>
                        <Typography variant="subtitle2">{requirement.title}</Typography>
                        <Typography variant="body2" color="textSecondary">
                          {requirement.description}
                        </Typography>
                      </TableCell>
                      <TableCell>{requirement.regulation}</TableCell>
                      <TableCell>{requirement.category}</TableCell>
                      <TableCell>
                        <Chip
                          label={requirement.status}
                          color={getStatusColor(requirement.status) as any}
                          size="small"
                        />
                        {isOverdue(requirement.due_date) && requirement.status !== 'completed' && (
                          <Chip
                            label="Overdue"
                            color="error"
                            size="small"
                            sx={{ ml: 1 }}
                          />
                        )}
                      </TableCell>
                      <TableCell>
                        {requirement.owner_first_name} {requirement.owner_last_name}
                      </TableCell>
                      <TableCell>
                        {requirement.due_date ? new Date(requirement.due_date).toLocaleDateString() : '-'}
                      </TableCell>
                      <TableCell>
                        <IconButton size="small" onClick={() => handleViewRequirement(requirement)}>
                          <ViewIcon />
                        </IconButton>
                        <IconButton size="small" onClick={() => handleEditRequirement(requirement)}>
                          <EditIcon />
                        </IconButton>
                        <IconButton size="small" onClick={() => handleDeleteRequirement(requirement.id)}>
                          <DeleteIcon />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </ResponsiveTable>
        </CardContent>
      </Card>

      {/* Compliance Requirement Dialog */}
      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          {editingRequirement ? 'Edit Compliance Requirement' : 'Create New Compliance Requirement'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                required
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Description"
                multiline
                rows={3}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </Grid>
            <Grid item xs={6}>
              <FormControl fullWidth required>
                <InputLabel>Framework</InputLabel>
                <Select
                  value={formData.regulation}
                  label="Framework"
                  onChange={(e) => setFormData({ ...formData, regulation: e.target.value })}
                >
                  <MenuItem value="iso27001">ISO 27001</MenuItem>
                  <MenuItem value="soc2">SOC 2</MenuItem>
                  <MenuItem value="gdpr">GDPR</MenuItem>
                  <MenuItem value="hipaa">HIPAA</MenuItem>
                  <MenuItem value="pci_dss">PCI DSS</MenuItem>
                  <MenuItem value="nist">NIST</MenuItem>
                  <MenuItem value="other">Other</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Category"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              />
            </Grid>
            <Grid item xs={6}>
                            <FormControl fullWidth>
                              <InputLabel>Status</InputLabel>
                              <Select
                                value={formData.status}
                                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                              >
                                <MenuItem value="not_started">Not Started</MenuItem>
                                <MenuItem value="in_progress">In Progress</MenuItem>
                                <MenuItem value="implemented">Implemented</MenuItem>
                                <MenuItem value="verified">Verified</MenuItem>
                                <MenuItem value="non_compliant">Non-Compliant</MenuItem>
                              </Select>
                            </FormControl>
            </Grid>
            <Grid item xs={6}>
                            <LocalizationProvider dateAdapter={AdapterDateFns}>
                              <DatePicker
                                label="Due Date"
                                value={formData.dueDate}
                                onChange={(newValue: Date | null) =>
                                  setFormData({ ...formData, dueDate: newValue })
                                }
                                slotProps={{
                                  textField: { fullWidth: true },
                                }}
                              />
                            </LocalizationProvider>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Evidence"
                multiline
                rows={4}
                value={formData.evidence}
                onChange={(e) => setFormData({ ...formData, evidence: e.target.value })}
                placeholder="Describe the evidence or documentation required for compliance..."
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>Cancel</Button>
          <Button onClick={handleSaveRequirement} variant="contained">
            {editingRequirement ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Audit Report Dialog */}
      <AuditReportDialog
        open={openReportDialog}
        onClose={() => setOpenReportDialog(false)}
        auditContext={{
          requirements: requirements.map((r) => ({
            id: r.id,
            title: r.title,
            regulation: r.regulation,
            status: r.status,
            dueDate: r.due_date,
          })),
          totalRequirements: requirements.length,
          completedRequirements: requirements.filter((r) => r.status === 'completed').length,
          pendingRequirements: requirements.filter((r) => r.status === 'pending').length,
          generatedAt: new Date().toISOString(),
        }}
        title="Generate Compliance Report"
      />
    </Box>
  );
};
