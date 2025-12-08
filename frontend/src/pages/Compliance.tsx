import React, { useState, useEffect } from 'react';
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
  TableContainer,
  TableHead,
  TableRow,
  Paper,
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
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon,
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { requirementApi, unwrapPaginatedResponse, unwrapResponse } from '../services/grcClient';
import { useAuth } from '../contexts/AuthContext';

// Risk interface for associated risks display
interface Risk {
  id: string;
  title: string;
  severity: string;
  status: string;
}

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
  const [requirements, setRequirements] = useState<ComplianceRequirement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [openDialog, setOpenDialog] = useState(false);
  const [openViewDialog, setOpenViewDialog] = useState(false);
  const [editingRequirement, setEditingRequirement] = useState<ComplianceRequirement | null>(null);
  const [viewingRequirement, setViewingRequirement] = useState<ComplianceRequirement | null>(null);
  const [associatedRisks, setAssociatedRisks] = useState<Risk[]>([]);
  const [risksLoading, setRisksLoading] = useState(false);
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

  useEffect(() => {
    fetchRequirements();
  }, [tenantId]);

  const fetchRequirements = async () => {
    try {
      setError('');
      const response = await requirementApi.list(tenantId);
      // Handle NestJS response format
      const result = unwrapPaginatedResponse<ComplianceRequirement>(response);
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
  };

  const handleCreateRequirement = () => {
    setEditingRequirement(null);
    setFormData({
      title: '',
      description: '',
      regulation: '',
      category: '',
      status: 'pending',
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

  const fetchAssociatedRisks = async (requirementId: string) => {
    if (!tenantId) return;
    setRisksLoading(true);
    try {
      const response = await requirementApi.getLinkedRisks(tenantId, requirementId);
      const risks = unwrapResponse<Risk[]>(response) || [];
      setAssociatedRisks(risks);
    } catch (err) {
      console.error('Failed to fetch associated risks:', err);
      setAssociatedRisks([]);
    } finally {
      setRisksLoading(false);
    }
  };

  const handleViewRequirement = (requirement: ComplianceRequirement) => {
    setViewingRequirement(requirement);
    setOpenViewDialog(true);
    fetchAssociatedRisks(String(requirement.id));
  };

  const handleSaveRequirement = async () => {
    try {
      const requirementData = {
        name: formData.title, // NestJS uses 'name' instead of 'title'
        summary: formData.description,
        framework: formData.regulation, // NestJS uses 'framework' instead of 'regulation'
        category: formData.category,
        status: formData.status,
        dueDate: formData.dueDate?.toISOString().split('T')[0],
        evidence: formData.evidence,
        assignedTo: formData.assignedTo,
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
      case 'completed': return 'success';
      case 'in_progress': return 'info';
      case 'pending': return 'warning';
      case 'overdue': return 'error';
      default: return 'default';
    }
  };

  const isOverdue = (dueDate: string) => {
    return new Date(dueDate) < new Date();
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">Compliance Management</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleCreateRequirement}
        >
          New Requirement
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Card>
        <CardContent>
          <TableContainer component={Paper}>
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
                    <TableCell colSpan={7} align="center">
                      <Typography color="textSecondary" sx={{ py: 4 }}>
                        No compliance requirements found. Click "New Requirement" to create one.
                      </Typography>
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
          </TableContainer>
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
              <TextField
                fullWidth
                label="Regulation"
                value={formData.regulation}
                onChange={(e) => setFormData({ ...formData, regulation: e.target.value })}
              />
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
                  <MenuItem value="pending">Pending</MenuItem>
                  <MenuItem value="in_progress">In Progress</MenuItem>
                  <MenuItem value="completed">Completed</MenuItem>
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

      {/* View Requirement Dialog */}
      <Dialog open={openViewDialog} onClose={() => setOpenViewDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>Requirement Details</DialogTitle>
        <DialogContent>
          {viewingRequirement && (
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12}>
                <Typography variant="h6">{viewingRequirement.title}</Typography>
              </Grid>
              {viewingRequirement.description && (
                <Grid item xs={12}>
                  <Typography variant="subtitle2" color="textSecondary">Description</Typography>
                  <Typography>{viewingRequirement.description}</Typography>
                </Grid>
              )}
              <Grid item xs={6}>
                <Typography variant="subtitle2" color="textSecondary">Regulation</Typography>
                <Typography>{viewingRequirement.regulation || '-'}</Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="subtitle2" color="textSecondary">Category</Typography>
                <Typography>{viewingRequirement.category || '-'}</Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="subtitle2" color="textSecondary">Status</Typography>
                <Chip
                  label={viewingRequirement.status}
                  color={getStatusColor(viewingRequirement.status) as 'success' | 'info' | 'warning' | 'error' | 'default'}
                  size="small"
                />
              </Grid>
              <Grid item xs={6}>
                <Typography variant="subtitle2" color="textSecondary">Due Date</Typography>
                <Typography>
                  {viewingRequirement.due_date ? new Date(viewingRequirement.due_date).toLocaleDateString() : '-'}
                </Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="subtitle2" color="textSecondary">Owner</Typography>
                <Typography>{viewingRequirement.owner_first_name} {viewingRequirement.owner_last_name}</Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="subtitle2" color="textSecondary">Assigned To</Typography>
                <Typography>{viewingRequirement.assigned_first_name} {viewingRequirement.assigned_last_name}</Typography>
              </Grid>
              {viewingRequirement.evidence && (
                <Grid item xs={12}>
                  <Typography variant="subtitle2" color="textSecondary">Evidence</Typography>
                  <Typography>{viewingRequirement.evidence}</Typography>
                </Grid>
              )}

              {/* Associated Risks Section */}
              <Grid item xs={12}>
                <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
                  <Typography variant="h6" gutterBottom>Associated Risks</Typography>
                  {risksLoading ? (
                    <Box display="flex" justifyContent="center" py={2}>
                      <CircularProgress size={24} />
                    </Box>
                  ) : associatedRisks.length === 0 ? (
                    <Typography color="textSecondary">No risks linked to this requirement.</Typography>
                  ) : (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                      {associatedRisks.map((risk) => (
                        <Chip
                          key={risk.id}
                          label={`${risk.title} (${risk.severity})`}
                          color={risk.severity === 'critical' ? 'error' : risk.severity === 'high' ? 'warning' : 'default'}
                          variant="outlined"
                          size="small"
                        />
                      ))}
                    </Box>
                  )}
                </Box>
              </Grid>
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenViewDialog(false)}>Close</Button>
          <Button
            onClick={() => {
              if (viewingRequirement) {
                handleEditRequirement(viewingRequirement);
                setOpenViewDialog(false);
              }
            }}
            variant="contained"
          >
            Edit
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
