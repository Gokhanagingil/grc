import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  FormControl,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Save as SaveIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
} from '@mui/icons-material';
import {
  cmdbApi,
  CmdbServiceData,
  CmdbServiceOfferingData,
  CreateCmdbServiceDto,
  UpdateCmdbServiceDto,
  CreateCmdbServiceOfferingDto,
} from '../../services/grcClient';
import { useNotification } from '../../contexts/NotificationContext';
import { useItsmChoices } from '../../hooks/useItsmChoices';

const statusColors: Record<string, 'success' | 'warning' | 'error' | 'default' | 'info'> = {
  planned: 'info',
  design: 'warning',
  live: 'success',
  retired: 'error',
};

export const CmdbServiceDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showNotification } = useNotification();
  const isNew = !id || id === 'new';

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState('business_service');
  const [status, setStatus] = useState('planned');
  const [tier, setTier] = useState('');
  const [criticality, setCriticality] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');

  const [offerings, setOfferings] = useState<CmdbServiceOfferingData[]>([]);
  const [offeringDialogOpen, setOfferingDialogOpen] = useState(false);
  const [newOfferingName, setNewOfferingName] = useState('');
  const [newOfferingStatus, setNewOfferingStatus] = useState('planned');
  const [newOfferingSupportHours, setNewOfferingSupportHours] = useState('');

  const { choices: serviceChoices } = useItsmChoices('cmdb_service');
  const { choices: offeringChoices } = useItsmChoices('cmdb_service_offering');

  const typeOptions = serviceChoices?.type || [];
  const statusOptions = serviceChoices?.status || [];
  const tierOptions = serviceChoices?.tier || [];
  const criticalityOptions = serviceChoices?.criticality || [];
  const offeringStatusOptions = offeringChoices?.status || [];

  const fetchService = useCallback(async () => {
    if (isNew || !id) return;
    setLoading(true);
    try {
      const response = await cmdbApi.services.get(id);
      const raw = response.data;
      const svc: CmdbServiceData = raw && 'data' in raw ? raw.data : raw;
      setName(svc.name || '');
      setDescription(svc.description || '');
      setType(svc.type || 'business_service');
      setStatus(svc.status || 'planned');
      setTier(svc.tier || '');
      setCriticality(svc.criticality || '');
      setOwnerEmail(svc.ownerEmail || '');
      setOfferings(svc.offerings || []);
    } catch (err) {
      console.error('Error fetching service:', err);
      showNotification('Failed to load service.', 'error');
    } finally {
      setLoading(false);
    }
  }, [id, isNew, showNotification]);

  const fetchOfferings = useCallback(async () => {
    if (isNew || !id) return;
    try {
      const response = await cmdbApi.serviceOfferings.list({ serviceId: id, pageSize: 100 });
      const raw = response.data;
      let items: CmdbServiceOfferingData[] = [];
      if (raw && 'data' in raw) {
        const inner = raw.data;
        if (inner && 'items' in inner) {
          items = Array.isArray(inner.items) ? inner.items : [];
        }
      } else if (raw && 'items' in raw) {
        items = Array.isArray(raw.items) ? raw.items : [];
      }
      setOfferings(items);
    } catch (err) {
      console.error('Error fetching offerings:', err);
    }
  }, [id, isNew]);

  useEffect(() => {
    fetchService();
  }, [fetchService]);

  useEffect(() => {
    if (!isNew && id) {
      fetchOfferings();
    }
  }, [fetchOfferings, isNew, id]);

  const handleSave = async () => {
    if (!name.trim()) {
      showNotification('Name is required.', 'error');
      return;
    }
    if (!type) {
      showNotification('Type is required.', 'error');
      return;
    }
    setSaving(true);
    try {
      if (isNew) {
        const dto: CreateCmdbServiceDto = {
          name: name.trim(),
          type,
          status: status || undefined,
          description: description || undefined,
          tier: tier || undefined,
          criticality: criticality || undefined,
          ownerEmail: ownerEmail || undefined,
        };
        const response = await cmdbApi.services.create(dto);
        const raw = response.data;
        const created = raw && 'data' in raw ? raw.data : raw;
        showNotification('Service created successfully.', 'success');
        navigate(`/cmdb/services/${created.id}`);
      } else if (id) {
        const dto: UpdateCmdbServiceDto = {
          name: name.trim(),
          type,
          status,
          description: description || undefined,
          tier: tier || undefined,
          criticality: criticality || undefined,
          ownerEmail: ownerEmail || undefined,
        };
        await cmdbApi.services.update(id, dto);
        showNotification('Service updated successfully.', 'success');
        fetchService();
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Failed to save service.';
      console.error('Error saving service:', err);
      showNotification(errMsg, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!id || isNew) return;
    if (!window.confirm('Are you sure you want to delete this service?')) return;
    try {
      await cmdbApi.services.delete(id);
      showNotification('Service deleted.', 'success');
      navigate('/cmdb/services');
    } catch (err) {
      console.error('Error deleting service:', err);
      showNotification('Failed to delete service.', 'error');
    }
  };

  const handleAddOffering = async () => {
    if (!newOfferingName.trim() || !id) return;
    try {
      const dto: CreateCmdbServiceOfferingDto = {
        serviceId: id,
        name: newOfferingName.trim(),
        status: newOfferingStatus || undefined,
        supportHours: newOfferingSupportHours || undefined,
      };
      await cmdbApi.serviceOfferings.create(dto);
      showNotification('Offering added.', 'success');
      setOfferingDialogOpen(false);
      setNewOfferingName('');
      setNewOfferingStatus('planned');
      setNewOfferingSupportHours('');
      fetchOfferings();
    } catch (err) {
      console.error('Error adding offering:', err);
      showNotification('Failed to add offering.', 'error');
    }
  };

  const handleDeleteOffering = async (offeringId: string) => {
    if (!window.confirm('Delete this offering?')) return;
    try {
      await cmdbApi.serviceOfferings.delete(offeringId);
      showNotification('Offering deleted.', 'success');
      fetchOfferings();
    } catch (err) {
      console.error('Error deleting offering:', err);
      showNotification('Failed to delete offering.', 'error');
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <IconButton onClick={() => navigate('/cmdb/services')} data-testid="btn-back">
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h4" fontWeight={600}>
          {isNew ? 'New Service' : name}
        </Typography>
        <Box sx={{ flexGrow: 1 }} />
        {!isNew && (
          <Button
            variant="outlined"
            color="error"
            startIcon={<DeleteIcon />}
            onClick={handleDelete}
            data-testid="btn-delete-service"
          >
            Delete
          </Button>
        )}
        <Button
          variant="contained"
          startIcon={<SaveIcon />}
          onClick={handleSave}
          disabled={saving}
          data-testid="btn-save-service"
        >
          {saving ? 'Saving...' : 'Save'}
        </Button>
      </Box>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <TextField
                label="Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                fullWidth
                required
                data-testid="input-service-name"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Type</InputLabel>
                <Select
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  label="Type"
                  data-testid="select-service-type"
                >
                  {typeOptions.length > 0 ? (
                    typeOptions.map((opt: { value: string; label: string }) => (
                      <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                    ))
                  ) : (
                    <>
                      <MenuItem value="business_service">Business Service</MenuItem>
                      <MenuItem value="technical_service">Technical Service</MenuItem>
                    </>
                  )}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                fullWidth
                multiline
                rows={3}
                data-testid="input-service-description"
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  label="Status"
                  data-testid="select-service-status"
                >
                  {statusOptions.length > 0 ? (
                    statusOptions.map((opt: { value: string; label: string }) => (
                      <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                    ))
                  ) : (
                    <>
                      <MenuItem value="planned">Planned</MenuItem>
                      <MenuItem value="design">Design</MenuItem>
                      <MenuItem value="live">Live</MenuItem>
                      <MenuItem value="retired">Retired</MenuItem>
                    </>
                  )}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={4}>
              <FormControl fullWidth>
                <InputLabel>Tier</InputLabel>
                <Select
                  value={tier}
                  onChange={(e) => setTier(e.target.value)}
                  label="Tier"
                  data-testid="select-service-tier"
                >
                  <MenuItem value="">None</MenuItem>
                  {tierOptions.length > 0 ? (
                    tierOptions.map((opt: { value: string; label: string }) => (
                      <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                    ))
                  ) : (
                    <>
                      <MenuItem value="tier_0">Tier 0 - Mission Critical</MenuItem>
                      <MenuItem value="tier_1">Tier 1 - Business Critical</MenuItem>
                      <MenuItem value="tier_2">Tier 2 - Business Operational</MenuItem>
                      <MenuItem value="tier_3">Tier 3 - Administrative</MenuItem>
                    </>
                  )}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={4}>
              <FormControl fullWidth>
                <InputLabel>Criticality</InputLabel>
                <Select
                  value={criticality}
                  onChange={(e) => setCriticality(e.target.value)}
                  label="Criticality"
                  data-testid="select-service-criticality"
                >
                  <MenuItem value="">None</MenuItem>
                  {criticalityOptions.length > 0 ? (
                    criticalityOptions.map((opt: { value: string; label: string }) => (
                      <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                    ))
                  ) : (
                    <>
                      <MenuItem value="critical">Critical</MenuItem>
                      <MenuItem value="high">High</MenuItem>
                      <MenuItem value="medium">Medium</MenuItem>
                      <MenuItem value="low">Low</MenuItem>
                    </>
                  )}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                label="Owner Email"
                value={ownerEmail}
                onChange={(e) => setOwnerEmail(e.target.value)}
                fullWidth
                type="email"
                data-testid="input-service-owner-email"
              />
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {!isNew && (
        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6" fontWeight={600}>
                Service Offerings
              </Typography>
              <Button
                variant="outlined"
                startIcon={<AddIcon />}
                onClick={() => setOfferingDialogOpen(true)}
                data-testid="btn-add-offering"
              >
                Add Offering
              </Button>
            </Box>
            <TableContainer component={Paper} variant="outlined">
              <Table size="small" data-testid="offerings-table">
                <TableHead>
                  <TableRow>
                    <TableCell>Name</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Support Hours</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {offerings.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} align="center">
                        <Typography variant="body2" color="text.secondary">
                          No offerings yet
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    offerings.map((off) => (
                      <TableRow key={off.id} data-testid={`offering-row-${off.id}`}>
                        <TableCell>{off.name}</TableCell>
                        <TableCell>
                          <Chip
                            label={off.status || '-'}
                            size="small"
                            color={statusColors[off.status] || 'default'}
                          />
                        </TableCell>
                        <TableCell>{off.supportHours || '-'}</TableCell>
                        <TableCell align="right">
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => handleDeleteOffering(off.id)}
                          >
                            <DeleteIcon fontSize="small" />
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
      )}

      <Dialog open={offeringDialogOpen} onClose={() => setOfferingDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add Service Offering</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <TextField
              label="Offering Name"
              value={newOfferingName}
              onChange={(e) => setNewOfferingName(e.target.value)}
              fullWidth
              required
              data-testid="input-offering-name"
            />
            <FormControl fullWidth>
              <InputLabel>Status</InputLabel>
              <Select
                value={newOfferingStatus}
                onChange={(e) => setNewOfferingStatus(e.target.value)}
                label="Status"
                data-testid="select-offering-status"
              >
                {offeringStatusOptions.length > 0 ? (
                  offeringStatusOptions.map((opt: { value: string; label: string }) => (
                    <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                  ))
                ) : (
                  <>
                    <MenuItem value="planned">Planned</MenuItem>
                    <MenuItem value="live">Live</MenuItem>
                    <MenuItem value="retired">Retired</MenuItem>
                  </>
                )}
              </Select>
            </FormControl>
            <TextField
              label="Support Hours"
              value={newOfferingSupportHours}
              onChange={(e) => setNewOfferingSupportHours(e.target.value)}
              fullWidth
              placeholder="e.g. 8x5, 24x7"
              data-testid="input-offering-support-hours"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOfferingDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleAddOffering}
            disabled={!newOfferingName.trim()}
            data-testid="btn-save-offering"
          >
            Add
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default CmdbServiceDetail;
