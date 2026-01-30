import React, { useCallback, useEffect, useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Tabs,
  Tab,
  Chip,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Grid,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  Edit as EditIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon,
  Business as BcmIcon,
} from '@mui/icons-material';
import { useNavigate, useParams } from 'react-router-dom';
import {
  bcmApi,
  BcmServiceData,
  BcmServiceStatus,
  BcmCriticalityTier,
  BcmBiaData,
  BcmPlanData,
  BcmExerciseData,
  CreateBcmBiaDto,
  CreateBcmPlanDto,
  CreateBcmExerciseDto,
  BcmPlanType,
  BcmExerciseType,
  BcmBiaStatus,
  BcmPlanStatus,
  BcmExerciseStatus,
} from '../services/grcClient';
import { useAuth } from '../contexts/AuthContext';

const BCM_SERVICE_STATUS_VALUES: BcmServiceStatus[] = ['DRAFT', 'ACTIVE', 'ARCHIVED'];
const BCM_CRITICALITY_TIER_VALUES: BcmCriticalityTier[] = ['TIER_0', 'TIER_1', 'TIER_2', 'TIER_3'];
const BCM_BIA_STATUS_VALUES: BcmBiaStatus[] = ['DRAFT', 'REVIEWED', 'APPROVED'];
const BCM_PLAN_TYPE_VALUES: BcmPlanType[] = ['BCP', 'DRP', 'IT_CONTINUITY'];
const BCM_PLAN_STATUS_VALUES: BcmPlanStatus[] = ['DRAFT', 'APPROVED', 'ACTIVE', 'RETIRED'];
const BCM_EXERCISE_TYPE_VALUES: BcmExerciseType[] = ['TABLETOP', 'FAILOVER', 'RESTORE', 'COMMS'];
const BCM_EXERCISE_STATUS_VALUES: BcmExerciseStatus[] = ['PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];

const getStatusColor = (status: string): 'error' | 'warning' | 'info' | 'success' | 'default' => {
  switch (status) {
    case 'DRAFT': return 'info';
    case 'ACTIVE': return 'success';
    case 'ARCHIVED': return 'default';
    case 'REVIEWED': return 'warning';
    case 'APPROVED': return 'success';
    case 'RETIRED': return 'default';
    case 'PLANNED': return 'info';
    case 'IN_PROGRESS': return 'warning';
    case 'COMPLETED': return 'success';
    case 'CANCELLED': return 'error';
    case 'READY': return 'success';
    case 'DEPRECATED': return 'default';
    default: return 'default';
  }
};

const getTierColor = (tier: string | null): 'error' | 'warning' | 'info' | 'success' | 'default' => {
  switch (tier) {
    case 'TIER_0': return 'error';
    case 'TIER_1': return 'warning';
    case 'TIER_2': return 'info';
    case 'TIER_3': return 'success';
    default: return 'default';
  }
};

const formatStatus = (status: string): string => {
  return status.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
};

const formatTier = (tier: string | null): string => {
  if (!tier) return '-';
  switch (tier) {
    case 'TIER_0': return 'Critical (Tier 0)';
    case 'TIER_1': return 'High (Tier 1)';
    case 'TIER_2': return 'Medium (Tier 2)';
    case 'TIER_3': return 'Low (Tier 3)';
    default: return tier;
  }
};

const formatDate = (dateString: string | null | undefined): string => {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleDateString();
};

const formatPlanType = (type: string): string => {
  switch (type) {
    case 'BCP': return 'Business Continuity Plan';
    case 'DRP': return 'Disaster Recovery Plan';
    case 'IT_CONTINUITY': return 'IT Continuity Plan';
    default: return type;
  }
};

const formatExerciseType = (type: string): string => {
  switch (type) {
    case 'TABLETOP': return 'Tabletop Exercise';
    case 'FAILOVER': return 'Failover Test';
    case 'RESTORE': return 'Restore Test';
    case 'COMMS': return 'Communications Test';
    default: return type;
  }
};

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`bcm-tabpanel-${index}`}
      aria-labelledby={`bcm-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
}

export const BcmServiceDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const tenantId = user?.tenantId || '';

  const [service, setService] = useState<BcmServiceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tabValue, setTabValue] = useState(0);
  const [isEditing, setIsEditing] = useState(false);
  const [editedService, setEditedService] = useState<Partial<BcmServiceData>>({});

  const [bias, setBias] = useState<BcmBiaData[]>([]);
  const [plans, setPlans] = useState<BcmPlanData[]>([]);
  const [exercises, setExercises] = useState<BcmExerciseData[]>([]);
  const [loadingRelated, setLoadingRelated] = useState(false);

  const [createBiaDialogOpen, setCreateBiaDialogOpen] = useState(false);
  const [createPlanDialogOpen, setCreatePlanDialogOpen] = useState(false);
  const [createExerciseDialogOpen, setCreateExerciseDialogOpen] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [newBia, setNewBia] = useState<CreateBcmBiaDto>({
    serviceId: id || '',
    rtoMinutes: 60,
    rpoMinutes: 60,
    impactOperational: 3,
    impactFinancial: 3,
    impactRegulatory: 3,
    impactReputational: 3,
    status: 'DRAFT',
  });

  const [newPlan, setNewPlan] = useState<CreateBcmPlanDto>({
    serviceId: id || '',
    name: '',
    planType: 'BCP',
    status: 'DRAFT',
  });

  const [newExercise, setNewExercise] = useState<CreateBcmExerciseDto>({
    serviceId: id || '',
    name: '',
    exerciseType: 'TABLETOP',
    status: 'PLANNED',
  });

  const fetchService = useCallback(async () => {
    if (!id || !tenantId) return;
    setLoading(true);
    try {
      const data = await bcmApi.getService(tenantId, id);
      setService(data);
      setEditedService(data);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch BCM Service:', err);
      setError('Failed to load BCM Service');
    } finally {
      setLoading(false);
    }
  }, [id, tenantId]);

  const fetchRelatedData = useCallback(async () => {
    if (!id || !tenantId) return;
    setLoadingRelated(true);
    try {
      const [biasRes, plansRes, exercisesRes] = await Promise.all([
        bcmApi.getServiceBias(tenantId, id),
        bcmApi.getServicePlans(tenantId, id),
        bcmApi.getServiceExercises(tenantId, id),
      ]);
      setBias(biasRes.items || []);
      setPlans(plansRes.items || []);
      setExercises(exercisesRes.items || []);
    } catch (err) {
      console.error('Failed to fetch related data:', err);
    } finally {
      setLoadingRelated(false);
    }
  }, [id, tenantId]);

  useEffect(() => {
    fetchService();
  }, [fetchService]);

  useEffect(() => {
    if (tabValue > 0) {
      fetchRelatedData();
    }
  }, [tabValue, fetchRelatedData]);

  const handleSave = async () => {
    if (!id || !tenantId) return;
    try {
      const updated = await bcmApi.updateService(tenantId, id, {
        name: editedService.name,
        description: editedService.description ?? undefined,
        status: editedService.status as BcmServiceStatus,
        criticalityTier: editedService.criticalityTier as BcmCriticalityTier,
        tags: editedService.tags,
      });
      setService(updated);
      setIsEditing(false);
      setError(null);
    } catch (err) {
      console.error('Failed to update BCM Service:', err);
      setError('Failed to update BCM Service');
    }
  };

  const handleCancelEdit = () => {
    setEditedService(service || {});
    setIsEditing(false);
  };

  const handleCreateBia = async () => {
    if (!tenantId) return;
    setCreateError(null);
    try {
      await bcmApi.createBia(tenantId, { ...newBia, serviceId: id || '' });
      setCreateBiaDialogOpen(false);
      setNewBia({
        serviceId: id || '',
        rtoMinutes: 60,
        rpoMinutes: 60,
        impactOperational: 3,
        impactFinancial: 3,
        impactRegulatory: 3,
        impactReputational: 3,
        status: 'DRAFT',
      });
      fetchRelatedData();
    } catch (err: unknown) {
      console.error('Failed to create BIA:', err);
      const error = err as { response?: { data?: { message?: string } } };
      setCreateError(error.response?.data?.message || 'Failed to create BIA');
    }
  };

  const handleCreatePlan = async () => {
    if (!tenantId || !newPlan.name) {
      setCreateError('Name is required');
      return;
    }
    setCreateError(null);
    try {
      await bcmApi.createPlan(tenantId, { ...newPlan, serviceId: id || '' });
      setCreatePlanDialogOpen(false);
      setNewPlan({
        serviceId: id || '',
        name: '',
        planType: 'BCP',
        status: 'DRAFT',
      });
      fetchRelatedData();
    } catch (err: unknown) {
      console.error('Failed to create Plan:', err);
      const error = err as { response?: { data?: { message?: string } } };
      setCreateError(error.response?.data?.message || 'Failed to create Plan');
    }
  };

  const handleCreateExercise = async () => {
    if (!tenantId || !newExercise.name) {
      setCreateError('Name is required');
      return;
    }
    setCreateError(null);
    try {
      await bcmApi.createExercise(tenantId, { ...newExercise, serviceId: id || '' });
      setCreateExerciseDialogOpen(false);
      setNewExercise({
        serviceId: id || '',
        name: '',
        exerciseType: 'TABLETOP',
        status: 'PLANNED',
      });
      fetchRelatedData();
    } catch (err: unknown) {
      console.error('Failed to create Exercise:', err);
      const error = err as { response?: { data?: { message?: string } } };
      setCreateError(error.response?.data?.message || 'Failed to create Exercise');
    }
  };

  const handleDeleteBia = async (biaId: string) => {
    if (!tenantId || !window.confirm('Are you sure you want to delete this BIA?')) return;
    try {
      await bcmApi.deleteBia(tenantId, biaId);
      fetchRelatedData();
    } catch (err) {
      console.error('Failed to delete BIA:', err);
    }
  };

  const handleDeletePlan = async (planId: string) => {
    if (!tenantId || !window.confirm('Are you sure you want to delete this Plan?')) return;
    try {
      await bcmApi.deletePlan(tenantId, planId);
      fetchRelatedData();
    } catch (err) {
      console.error('Failed to delete Plan:', err);
    }
  };

  const handleDeleteExercise = async (exerciseId: string) => {
    if (!tenantId || !window.confirm('Are you sure you want to delete this Exercise?')) return;
    try {
      await bcmApi.deleteExercise(tenantId, exerciseId);
      fetchRelatedData();
    } catch (err) {
      console.error('Failed to delete Exercise:', err);
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (error || !service) {
    return (
      <Box p={3}>
        <Alert severity="error">{error || 'Service not found'}</Alert>
        <Button startIcon={<BackIcon />} onClick={() => navigate('/bcm/services')} sx={{ mt: 2 }}>
          Back to Services
        </Button>
      </Box>
    );
  }

  return (
    <Box p={3} data-testid="bcm-service-detail">
      <Box display="flex" alignItems="center" gap={2} mb={3}>
        <IconButton onClick={() => navigate('/bcm/services')} data-testid="back-button">
          <BackIcon />
        </IconButton>
        <BcmIcon color="primary" sx={{ fontSize: 32 }} />
        <Box flex={1}>
          <Typography variant="h5" component="h1">
            {service.name}
          </Typography>
          <Box display="flex" gap={1} mt={0.5}>
            <Chip label={formatStatus(service.status)} size="small" color={getStatusColor(service.status)} />
            {service.criticalityTier && (
              <Chip label={formatTier(service.criticalityTier)} size="small" color={getTierColor(service.criticalityTier)} />
            )}
          </Box>
        </Box>
        {!isEditing ? (
          <Button startIcon={<EditIcon />} variant="outlined" onClick={() => setIsEditing(true)} data-testid="edit-button">
            Edit
          </Button>
        ) : (
          <Box display="flex" gap={1}>
            <Button startIcon={<CancelIcon />} onClick={handleCancelEdit} data-testid="cancel-edit-button">
              Cancel
            </Button>
            <Button startIcon={<SaveIcon />} variant="contained" onClick={handleSave} data-testid="save-button">
              Save
            </Button>
          </Box>
        )}
      </Box>

      <Paper sx={{ mb: 3 }}>
        <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)} aria-label="BCM Service tabs">
          <Tab label="Summary" id="bcm-tab-0" aria-controls="bcm-tabpanel-0" data-testid="tab-summary" />
          <Tab label={`BIA (${bias.length})`} id="bcm-tab-1" aria-controls="bcm-tabpanel-1" data-testid="tab-bia" />
          <Tab label={`Plans (${plans.length})`} id="bcm-tab-2" aria-controls="bcm-tabpanel-2" data-testid="tab-plans" />
          <Tab label={`Exercises (${exercises.length})`} id="bcm-tab-3" aria-controls="bcm-tabpanel-3" data-testid="tab-exercises" />
        </Tabs>
      </Paper>

      <TabPanel value={tabValue} index={0}>
        <Paper sx={{ p: 3 }}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              {isEditing ? (
                <TextField
                  label="Name"
                  value={editedService.name || ''}
                  onChange={(e) => setEditedService({ ...editedService, name: e.target.value })}
                  fullWidth
                  required
                  data-testid="edit-name-input"
                />
              ) : (
                <Box>
                  <Typography variant="subtitle2" color="text.secondary">Name</Typography>
                  <Typography variant="body1">{service.name}</Typography>
                </Box>
              )}
            </Grid>
            <Grid item xs={12} md={6}>
              {isEditing ? (
                <FormControl fullWidth>
                  <InputLabel>Status</InputLabel>
                  <Select
                    value={editedService.status || ''}
                    label="Status"
                    onChange={(e) => setEditedService({ ...editedService, status: e.target.value as BcmServiceStatus })}
                    data-testid="edit-status-select"
                  >
                    {BCM_SERVICE_STATUS_VALUES.map((status) => (
                      <MenuItem key={status} value={status}>{formatStatus(status)}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              ) : (
                <Box>
                  <Typography variant="subtitle2" color="text.secondary">Status</Typography>
                  <Chip label={formatStatus(service.status)} size="small" color={getStatusColor(service.status)} />
                </Box>
              )}
            </Grid>
            <Grid item xs={12} md={6}>
              {isEditing ? (
                <FormControl fullWidth>
                  <InputLabel>Criticality Tier</InputLabel>
                  <Select
                    value={editedService.criticalityTier || ''}
                    label="Criticality Tier"
                    onChange={(e) => setEditedService({ ...editedService, criticalityTier: e.target.value as BcmCriticalityTier })}
                    data-testid="edit-criticality-select"
                  >
                    <MenuItem value="">Not Set</MenuItem>
                    {BCM_CRITICALITY_TIER_VALUES.map((tier) => (
                      <MenuItem key={tier} value={tier}>{formatTier(tier)}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              ) : (
                <Box>
                  <Typography variant="subtitle2" color="text.secondary">Criticality Tier</Typography>
                  {service.criticalityTier ? (
                    <Chip label={formatTier(service.criticalityTier)} size="small" color={getTierColor(service.criticalityTier)} />
                  ) : (
                    <Typography variant="body1" color="text.secondary">Not Set</Typography>
                  )}
                </Box>
              )}
            </Grid>
            <Grid item xs={12} md={6}>
              <Box>
                <Typography variant="subtitle2" color="text.secondary">Created</Typography>
                <Typography variant="body1">{formatDate(service.createdAt)}</Typography>
              </Box>
            </Grid>
            <Grid item xs={12}>
              {isEditing ? (
                <TextField
                  label="Description"
                  value={editedService.description || ''}
                  onChange={(e) => setEditedService({ ...editedService, description: e.target.value })}
                  fullWidth
                  multiline
                  rows={4}
                  data-testid="edit-description-input"
                />
              ) : (
                <Box>
                  <Typography variant="subtitle2" color="text.secondary">Description</Typography>
                  <Typography variant="body1">{service.description || '-'}</Typography>
                </Box>
              )}
            </Grid>
            <Grid item xs={12}>
              <Box>
                <Typography variant="subtitle2" color="text.secondary">Tags</Typography>
                <Box display="flex" gap={0.5} flexWrap="wrap" mt={0.5}>
                  {service.tags && service.tags.length > 0 ? (
                    service.tags.map((tag, index) => (
                      <Chip key={index} label={tag} size="small" variant="outlined" />
                    ))
                  ) : (
                    <Typography variant="body1" color="text.secondary">No tags</Typography>
                  )}
                </Box>
              </Box>
            </Grid>
          </Grid>
        </Paper>
      </TabPanel>

      <TabPanel value={tabValue} index={1}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6">Business Impact Analyses</Typography>
          <Button startIcon={<AddIcon />} variant="contained" onClick={() => setCreateBiaDialogOpen(true)} data-testid="add-bia-button">
            Add BIA
          </Button>
        </Box>
        {loadingRelated ? (
          <Box display="flex" justifyContent="center" p={3}><CircularProgress /></Box>
        ) : bias.length === 0 ? (
          <Paper sx={{ p: 3, textAlign: 'center' }}>
            <Typography color="text.secondary">No BIAs found for this service</Typography>
          </Paper>
        ) : (
          <TableContainer component={Paper}>
            <Table data-testid="bia-table">
              <TableHead>
                <TableRow>
                  <TableCell>RTO</TableCell>
                  <TableCell>RPO</TableCell>
                  <TableCell>Impact Score</TableCell>
                  <TableCell>Criticality</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {bias.map((bia) => (
                  <TableRow key={bia.id} data-testid={`bia-row-${bia.id}`}>
                    <TableCell>{bia.rtoMinutes} min</TableCell>
                    <TableCell>{bia.rpoMinutes} min</TableCell>
                    <TableCell>{bia.overallImpactScore}</TableCell>
                    <TableCell>
                      <Chip label={formatTier(bia.criticalityTier)} size="small" color={getTierColor(bia.criticalityTier)} />
                    </TableCell>
                    <TableCell>
                      <Chip label={formatStatus(bia.status)} size="small" color={getStatusColor(bia.status)} />
                    </TableCell>
                    <TableCell>
                      <Tooltip title="Delete">
                        <IconButton size="small" color="error" onClick={() => handleDeleteBia(bia.id)} data-testid={`delete-bia-${bia.id}`}>
                          <DeleteIcon />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </TabPanel>

      <TabPanel value={tabValue} index={2}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6">Recovery Plans</Typography>
          <Button startIcon={<AddIcon />} variant="contained" onClick={() => setCreatePlanDialogOpen(true)} data-testid="add-plan-button">
            Add Plan
          </Button>
        </Box>
        {loadingRelated ? (
          <Box display="flex" justifyContent="center" p={3}><CircularProgress /></Box>
        ) : plans.length === 0 ? (
          <Paper sx={{ p: 3, textAlign: 'center' }}>
            <Typography color="text.secondary">No plans found for this service</Typography>
          </Paper>
        ) : (
          <TableContainer component={Paper}>
            <Table data-testid="plans-table">
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Approved</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {plans.map((plan) => (
                  <TableRow key={plan.id} data-testid={`plan-row-${plan.id}`}>
                    <TableCell>
                      <Typography
                        variant="body2"
                        sx={{ color: 'primary.main', cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}
                        onClick={() => navigate(`/bcm/plans/${plan.id}`)}
                      >
                        {plan.name}
                      </Typography>
                    </TableCell>
                    <TableCell>{formatPlanType(plan.planType)}</TableCell>
                    <TableCell>
                      <Chip label={formatStatus(plan.status)} size="small" color={getStatusColor(plan.status)} />
                    </TableCell>
                    <TableCell>{formatDate(plan.approvedAt)}</TableCell>
                    <TableCell>
                      <Box display="flex" gap={0.5}>
                        <Tooltip title="View">
                          <IconButton size="small" onClick={() => navigate(`/bcm/plans/${plan.id}`)} data-testid={`view-plan-${plan.id}`}>
                            <ViewIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete">
                          <IconButton size="small" color="error" onClick={() => handleDeletePlan(plan.id)} data-testid={`delete-plan-${plan.id}`}>
                            <DeleteIcon />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </TabPanel>

      <TabPanel value={tabValue} index={3}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6">Exercises & Tests</Typography>
          <Button startIcon={<AddIcon />} variant="contained" onClick={() => setCreateExerciseDialogOpen(true)} data-testid="add-exercise-button">
            Add Exercise
          </Button>
        </Box>
        {loadingRelated ? (
          <Box display="flex" justifyContent="center" p={3}><CircularProgress /></Box>
        ) : exercises.length === 0 ? (
          <Paper sx={{ p: 3, textAlign: 'center' }}>
            <Typography color="text.secondary">No exercises found for this service</Typography>
          </Paper>
        ) : (
          <TableContainer component={Paper}>
            <Table data-testid="exercises-table">
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Scheduled</TableCell>
                  <TableCell>Outcome</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {exercises.map((exercise) => (
                  <TableRow key={exercise.id} data-testid={`exercise-row-${exercise.id}`}>
                    <TableCell>{exercise.name}</TableCell>
                    <TableCell>{formatExerciseType(exercise.exerciseType)}</TableCell>
                    <TableCell>
                      <Chip label={formatStatus(exercise.status)} size="small" color={getStatusColor(exercise.status)} />
                    </TableCell>
                    <TableCell>{formatDate(exercise.scheduledAt)}</TableCell>
                    <TableCell>
                      {exercise.outcome ? (
                        <Chip
                          label={exercise.outcome}
                          size="small"
                          color={exercise.outcome === 'PASS' ? 'success' : exercise.outcome === 'PARTIAL' ? 'warning' : 'error'}
                        />
                      ) : '-'}
                    </TableCell>
                    <TableCell>
                      <Tooltip title="Delete">
                        <IconButton size="small" color="error" onClick={() => handleDeleteExercise(exercise.id)} data-testid={`delete-exercise-${exercise.id}`}>
                          <DeleteIcon />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </TabPanel>

      <Dialog open={createBiaDialogOpen} onClose={() => setCreateBiaDialogOpen(false)} maxWidth="sm" fullWidth data-testid="create-bia-dialog">
        <DialogTitle>Add Business Impact Analysis</DialogTitle>
        <DialogContent>
          <Box display="flex" flexDirection="column" gap={2} mt={1}>
            {createError && <Alert severity="error" onClose={() => setCreateError(null)}>{createError}</Alert>}
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <TextField
                  label="RTO (minutes)"
                  type="number"
                  value={newBia.rtoMinutes}
                  onChange={(e) => setNewBia({ ...newBia, rtoMinutes: parseInt(e.target.value) || 0 })}
                  fullWidth
                  required
                  data-testid="bia-rto-input"
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  label="RPO (minutes)"
                  type="number"
                  value={newBia.rpoMinutes}
                  onChange={(e) => setNewBia({ ...newBia, rpoMinutes: parseInt(e.target.value) || 0 })}
                  fullWidth
                  required
                  data-testid="bia-rpo-input"
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  label="Operational Impact (0-5)"
                  type="number"
                  inputProps={{ min: 0, max: 5 }}
                  value={newBia.impactOperational}
                  onChange={(e) => setNewBia({ ...newBia, impactOperational: parseInt(e.target.value) || 0 })}
                  fullWidth
                  data-testid="bia-impact-operational-input"
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  label="Financial Impact (0-5)"
                  type="number"
                  inputProps={{ min: 0, max: 5 }}
                  value={newBia.impactFinancial}
                  onChange={(e) => setNewBia({ ...newBia, impactFinancial: parseInt(e.target.value) || 0 })}
                  fullWidth
                  data-testid="bia-impact-financial-input"
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  label="Regulatory Impact (0-5)"
                  type="number"
                  inputProps={{ min: 0, max: 5 }}
                  value={newBia.impactRegulatory}
                  onChange={(e) => setNewBia({ ...newBia, impactRegulatory: parseInt(e.target.value) || 0 })}
                  fullWidth
                  data-testid="bia-impact-regulatory-input"
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  label="Reputational Impact (0-5)"
                  type="number"
                  inputProps={{ min: 0, max: 5 }}
                  value={newBia.impactReputational}
                  onChange={(e) => setNewBia({ ...newBia, impactReputational: parseInt(e.target.value) || 0 })}
                  fullWidth
                  data-testid="bia-impact-reputational-input"
                />
              </Grid>
              <Grid item xs={12}>
                <FormControl fullWidth>
                  <InputLabel>Status</InputLabel>
                  <Select
                    value={newBia.status}
                    label="Status"
                    onChange={(e) => setNewBia({ ...newBia, status: e.target.value as BcmBiaStatus })}
                    data-testid="bia-status-select"
                  >
                    {BCM_BIA_STATUS_VALUES.map((status) => (
                      <MenuItem key={status} value={status}>{formatStatus(status)}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateBiaDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleCreateBia} variant="contained" data-testid="create-bia-button">Create</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={createPlanDialogOpen} onClose={() => setCreatePlanDialogOpen(false)} maxWidth="sm" fullWidth data-testid="create-plan-dialog">
        <DialogTitle>Add Recovery Plan</DialogTitle>
        <DialogContent>
          <Box display="flex" flexDirection="column" gap={2} mt={1}>
            {createError && <Alert severity="error" onClose={() => setCreateError(null)}>{createError}</Alert>}
            <TextField
              label="Name"
              value={newPlan.name}
              onChange={(e) => setNewPlan({ ...newPlan, name: e.target.value })}
              fullWidth
              required
              data-testid="plan-name-input"
            />
            <FormControl fullWidth>
              <InputLabel>Plan Type</InputLabel>
              <Select
                value={newPlan.planType}
                label="Plan Type"
                onChange={(e) => setNewPlan({ ...newPlan, planType: e.target.value as BcmPlanType })}
                data-testid="plan-type-select"
              >
                {BCM_PLAN_TYPE_VALUES.map((type) => (
                  <MenuItem key={type} value={type}>{formatPlanType(type)}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel>Status</InputLabel>
              <Select
                value={newPlan.status}
                label="Status"
                onChange={(e) => setNewPlan({ ...newPlan, status: e.target.value as BcmPlanStatus })}
                data-testid="plan-status-select"
              >
                {BCM_PLAN_STATUS_VALUES.map((status) => (
                  <MenuItem key={status} value={status}>{formatStatus(status)}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="Summary"
              value={newPlan.summary || ''}
              onChange={(e) => setNewPlan({ ...newPlan, summary: e.target.value })}
              fullWidth
              multiline
              rows={3}
              data-testid="plan-summary-input"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreatePlanDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleCreatePlan} variant="contained" disabled={!newPlan.name} data-testid="create-plan-button">Create</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={createExerciseDialogOpen} onClose={() => setCreateExerciseDialogOpen(false)} maxWidth="sm" fullWidth data-testid="create-exercise-dialog">
        <DialogTitle>Add Exercise</DialogTitle>
        <DialogContent>
          <Box display="flex" flexDirection="column" gap={2} mt={1}>
            {createError && <Alert severity="error" onClose={() => setCreateError(null)}>{createError}</Alert>}
            <TextField
              label="Name"
              value={newExercise.name}
              onChange={(e) => setNewExercise({ ...newExercise, name: e.target.value })}
              fullWidth
              required
              data-testid="exercise-name-input"
            />
            <FormControl fullWidth>
              <InputLabel>Exercise Type</InputLabel>
              <Select
                value={newExercise.exerciseType}
                label="Exercise Type"
                onChange={(e) => setNewExercise({ ...newExercise, exerciseType: e.target.value as BcmExerciseType })}
                data-testid="exercise-type-select"
              >
                {BCM_EXERCISE_TYPE_VALUES.map((type) => (
                  <MenuItem key={type} value={type}>{formatExerciseType(type)}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel>Status</InputLabel>
              <Select
                value={newExercise.status}
                label="Status"
                onChange={(e) => setNewExercise({ ...newExercise, status: e.target.value as BcmExerciseStatus })}
                data-testid="exercise-status-select"
              >
                {BCM_EXERCISE_STATUS_VALUES.map((status) => (
                  <MenuItem key={status} value={status}>{formatStatus(status)}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="Scheduled Date"
              type="datetime-local"
              value={newExercise.scheduledAt || ''}
              onChange={(e) => setNewExercise({ ...newExercise, scheduledAt: e.target.value })}
              fullWidth
              InputLabelProps={{ shrink: true }}
              data-testid="exercise-scheduled-input"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateExerciseDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleCreateExercise} variant="contained" disabled={!newExercise.name} data-testid="create-exercise-button">Create</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default BcmServiceDetail;
