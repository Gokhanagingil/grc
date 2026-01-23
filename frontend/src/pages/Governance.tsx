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
  AccountBalance as PolicyIcon,
  History as HistoryIcon,
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFnsV3';
import { useNavigate } from 'react-router-dom';
import { policyApi, unwrapPaginatedPolicyResponse } from '../services/grcClient';
import { useAuth } from '../contexts/AuthContext';
import { LoadingState, ErrorState, EmptyState, ResponsiveTable, TableToolbar, FilterOption } from '../components/common';
import { PolicyVersionsTab } from '../components/PolicyVersionsTab';

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
  const { user } = useAuth();
  const navigate = useNavigate();
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [openDialog, setOpenDialog] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<Policy | null>(null);
  const [openVersionsDialog, setOpenVersionsDialog] = useState(false);
  const [selectedPolicyForVersions, setSelectedPolicyForVersions] = useState<Policy | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
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

  // Get tenant ID from user context
  const tenantId = user?.tenantId || '';

  const fetchPolicies = useCallback(async () => {
    try {
      setError('');
      const response = await policyApi.list(tenantId);
      // Handle NestJS response format with field transformation (name -> title)
      const result = unwrapPaginatedPolicyResponse<Policy>(response);
      setPolicies(result.items || []);
    } catch (err: unknown) {
      const error = err as { response?: { status?: number; data?: { message?: string; error?: { message?: string } } } };
      const status = error.response?.status;
      const message = error.response?.data?.error?.message || error.response?.data?.message;
      
      if (status === 401) {
        setError('Session expired. Please login again.');
      } else if (status === 403) {
        setError('You do not have permission to view policies.');
      } else if (status === 404 || status === 502) {
        setPolicies([]);
        console.warn('Governance backend not available');
      } else {
        setError(message || 'Failed to fetch policies. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    fetchPolicies();
  }, [fetchPolicies]);

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

  const handleViewPolicy = (policy: Policy) => {
    navigate(`/policies/${policy.id}`);
  };

  const handleSavePolicy = async () => {
    try {
      const policyData = {
        name: formData.title, // NestJS uses 'name' instead of 'title'
        summary: formData.description,
        category: formData.category,
        version: formData.version,
        status: formData.status,
        effectiveDate: formData.effectiveDate?.toISOString().split('T')[0],
        reviewDate: formData.reviewDate?.toISOString().split('T')[0],
        content: formData.content,
      };

      if (editingPolicy) {
        await policyApi.update(tenantId, String(editingPolicy.id), policyData);
      } else {
        await policyApi.create(tenantId, policyData);
      }

      setOpenDialog(false);
      fetchPolicies();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      setError(error.response?.data?.message || 'Failed to save policy');
    }
  };

  const handleDeletePolicy = async (id: number) => {
    if (window.confirm('Are you sure you want to delete this policy?')) {
      try {
        await policyApi.delete(tenantId, String(id));
        fetchPolicies();
      } catch (err: unknown) {
        const error = err as { response?: { data?: { message?: string } } };
        setError(error.response?.data?.message || 'Failed to delete policy');
      }
    }
  };

  const handleViewVersions = (policy: Policy) => {
    setSelectedPolicyForVersions(policy);
    setOpenVersionsDialog(true);
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
    return <LoadingState message="Loading policies..." />;
  }

  if (error && policies.length === 0) {
    return (
      <ErrorState
        title="Failed to load policies"
        message={error}
        onRetry={fetchPolicies}
      />
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

      {/* Toolbar with Search and Filters */}
      <TableToolbar
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search policies..."
        filters={[
          ...(statusFilter ? [{ key: 'status', label: 'Status', value: statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1) }] : []),
        ] as FilterOption[]}
        onFilterRemove={(key) => {
          if (key === 'status') setStatusFilter('');
        }}
        onClearFilters={() => {
          setStatusFilter('');
          setSearchQuery('');
        }}
        onRefresh={fetchPolicies}
        loading={loading}
        actions={
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Status</InputLabel>
            <Select
              value={statusFilter}
              label="Status"
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <MenuItem value="">All</MenuItem>
              <MenuItem value="draft">Draft</MenuItem>
              <MenuItem value="active">Active</MenuItem>
              <MenuItem value="archived">Archived</MenuItem>
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
                  <TableCell>Category</TableCell>
                  <TableCell>Version</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Owner</TableCell>
                  <TableCell>Effective Date</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {policies.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center" sx={{ py: 0, border: 'none' }}>
                      <EmptyState
                        icon={<PolicyIcon sx={{ fontSize: 64, color: 'text.disabled' }} />}
                        title="No policies found"
                        message="Get started by creating your first policy document."
                        actionLabel="Create Policy"
                        onAction={handleCreatePolicy}
                        minHeight="200px"
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  policies.map((policy) => (
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
                        <IconButton size="small" onClick={() => handleViewPolicy(policy)} title="View Details">
                          <ViewIcon />
                        </IconButton>
                        <IconButton size="small" onClick={() => handleViewVersions(policy)} title="Version History">
                          <HistoryIcon />
                        </IconButton>
                        <IconButton size="small" onClick={() => handleEditPolicy(policy)} title="Edit">
                          <EditIcon />
                        </IconButton>
                        <IconButton size="small" onClick={() => handleDeletePolicy(policy.id)} title="Delete">
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

      {/* Version History Dialog */}
      <Dialog
        open={openVersionsDialog}
        onClose={() => setOpenVersionsDialog(false)}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>Policy Version History</DialogTitle>
        <DialogContent>
          {selectedPolicyForVersions && (
            <PolicyVersionsTab
              policyId={String(selectedPolicyForVersions.id)}
              policyTitle={selectedPolicyForVersions.title}
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenVersionsDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
