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
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { api } from '../services/api';

interface Policy {
  id: number;
  title: string;
  description: string;
  category: string;
  version: string;
  status: string;
  effective_date: string;
  review_date: string;
  owner_first_name: string;
  owner_last_name: string;
  created_at: string;
}

export const Governance: React.FC = () => {
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [openDialog, setOpenDialog] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<Policy | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: '',
    version: '1.0',
    status: 'draft',
    effectiveDate: null as Date | null,
    reviewDate: null as Date | null,
    content: '',
  });

  useEffect(() => {
    fetchPolicies();
  }, []);

  const fetchPolicies = async () => {
    try {
      const response = await api.get('/governance/policies');
      setPolicies(response.data.policies);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to fetch policies');
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePolicy = () => {
    setEditingPolicy(null);
    setFormData({
      title: '',
      description: '',
      category: '',
      version: '1.0',
      status: 'draft',
      effectiveDate: null,
      reviewDate: null,
      content: '',
    });
    setOpenDialog(true);
  };

  const handleEditPolicy = (policy: Policy) => {
    setEditingPolicy(policy);
    setFormData({
      title: policy.title,
      description: policy.description || '',
      category: policy.category || '',
      version: policy.version,
      status: policy.status,
      effectiveDate: policy.effective_date ? new Date(policy.effective_date) : null,
      reviewDate: policy.review_date ? new Date(policy.review_date) : null,
      content: '',
    });
    setOpenDialog(true);
  };

  const handleSavePolicy = async () => {
    try {
      const policyData = {
        ...formData,
        effectiveDate: formData.effectiveDate?.toISOString().split('T')[0],
        reviewDate: formData.reviewDate?.toISOString().split('T')[0],
      };

      if (editingPolicy) {
        await api.put(`/governance/policies/${editingPolicy.id}`, policyData);
      } else {
        await api.post('/governance/policies', policyData);
      }

      setOpenDialog(false);
      fetchPolicies();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save policy');
    }
  };

  const handleDeletePolicy = async (id: number) => {
    if (window.confirm('Are you sure you want to delete this policy?')) {
      try {
        await api.delete(`/governance/policies/${id}`);
        fetchPolicies();
      } catch (err: any) {
        setError(err.response?.data?.message || 'Failed to delete policy');
      }
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'success';
      case 'draft': return 'warning';
      case 'archived': return 'default';
      default: return 'default';
    }
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
        <Typography variant="h4">Governance Management</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleCreatePolicy}
        >
          New Policy
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
                  <TableCell>Category</TableCell>
                  <TableCell>Version</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Owner</TableCell>
                  <TableCell>Effective Date</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {policies.map((policy) => (
                  <TableRow key={policy.id}>
                    <TableCell>
                      <Typography variant="subtitle2">{policy.title}</Typography>
                      <Typography variant="body2" color="textSecondary">
                        {policy.description}
                      </Typography>
                    </TableCell>
                    <TableCell>{policy.category}</TableCell>
                    <TableCell>{policy.version}</TableCell>
                    <TableCell>
                      <Chip
                        label={policy.status}
                        color={getStatusColor(policy.status) as any}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      {policy.owner_first_name} {policy.owner_last_name}
                    </TableCell>
                    <TableCell>
                      {policy.effective_date ? new Date(policy.effective_date).toLocaleDateString() : '-'}
                    </TableCell>
                    <TableCell>
                      <IconButton size="small" onClick={() => handleEditPolicy(policy)}>
                        <EditIcon />
                      </IconButton>
                      <IconButton size="small" onClick={() => handleDeletePolicy(policy.id)}>
                        <DeleteIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* Policy Dialog */}
      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          {editingPolicy ? 'Edit Policy' : 'Create New Policy'}
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
                label="Category"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Version"
                value={formData.version}
                onChange={(e) => setFormData({ ...formData, version: e.target.value })}
              />
            </Grid>
            <Grid item xs={6}>
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                >
                  <MenuItem value="draft">Draft</MenuItem>
                  <MenuItem value="active">Active</MenuItem>
                  <MenuItem value="archived">Archived</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Content"
                multiline
                rows={4}
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              />
            </Grid>
                        <Grid item xs={6}>
                          <LocalizationProvider dateAdapter={AdapterDateFns}>
                            <DatePicker
                              label="Effective Date"
                              value={formData.effectiveDate}
                              onChange={(newValue: Date | null) =>
                                setFormData({ ...formData, effectiveDate: newValue })
                              }
                              slotProps={{
                                textField: { fullWidth: true },
                              }}
                            />
                          </LocalizationProvider>
                        </Grid>
                        <Grid item xs={6}>
                          <LocalizationProvider dateAdapter={AdapterDateFns}>
                            <DatePicker
                              label="Review Date"
                              value={formData.reviewDate}
                              onChange={(newValue: Date | null) =>
                                setFormData({ ...formData, reviewDate: newValue })
                              }
                              slotProps={{
                                textField: { fullWidth: true },
                              }}
                            />
                          </LocalizationProvider>
                        </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>Cancel</Button>
          <Button onClick={handleSavePolicy} variant="contained">
            {editingPolicy ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
