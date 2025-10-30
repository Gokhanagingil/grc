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
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFnsV3';
import { fetchRequirements } from '../services/grc';

interface ComplianceRequirement {
  id: string;           // number -> string
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
  const [requirements, setRequirements] = useState<ComplianceRequirement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [limit, setLimit] = useState(20);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingRequirement, setEditingRequirement] = useState<ComplianceRequirement | null>(null);
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

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetchRequirements({ page: String(page), limit: String(limit) });
        setRequirements(res.items as any);
        setTotal(res.total);
      } catch (err: any) {
        setError(err.response?.data?.message || 'Failed to fetch compliance requirements');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [page, limit]);

  const reload = async () => {
    const res = await fetchRequirements({ page: String(page), limit: String(limit) });
    setRequirements(res.items as any);
    setTotal(res.total);
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

  const handleSaveRequirement = async () => {
    try {
      const requirementData = {
        ...formData,
        dueDate: formData.dueDate?.toISOString().split('T')[0],
      };

      if (editingRequirement) {
        // TODO: wire update endpoint
      } else {
        // TODO: wire create endpoint
      }

      setOpenDialog(false);
      reload();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save compliance requirement');
    }
  };

  const handleDeleteRequirement = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this compliance requirement?')) {
      try {
        // TODO: wire delete endpoint
        reload();
      } catch (err: any) {
        setError(err.response?.data?.message || 'Failed to delete compliance requirement');
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
                {requirements.map((requirement) => (
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
                      <IconButton size="small" onClick={() => handleEditRequirement(requirement)}>
                        <EditIcon />
                      </IconButton>
                      <IconButton size="small" onClick={() => handleDeleteRequirement(requirement.id)}>
                        <DeleteIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <Box mt={2} display="flex" justifyContent="space-between" alignItems="center">
            <Typography variant="body2">Total: {total}</Typography>
            <Box display="flex" gap={1}>
              <Button disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Prev</Button>
              <Button disabled={requirements.length < limit} onClick={() => setPage((p) => p + 1)}>Next</Button>
            </Box>
          </Box>
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
                  onChange={(date) => setFormData({ ...formData, dueDate: date })}
                  slotProps={{ textField: { fullWidth: true } }}
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
    </Box>
  );
};


