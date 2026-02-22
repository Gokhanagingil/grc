import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Divider,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Save as SaveIcon,
  Delete as DeleteIcon,
  Link as LinkIcon,
} from '@mui/icons-material';
import {
  cmdbApi,
  CmdbCiData,
  CmdbCiClassData,
  CmdbCiRelData,
  CmdbServiceCiData,
  CmdbServiceData,
} from '../../services/grcClient';
import { useNotification } from '../../contexts/NotificationContext';
import { TopologyPanel } from '../../components/cmdb/TopologyPanel';
import { useItsmChoices, ChoiceOption } from '../../hooks/useItsmChoices';

const FALLBACK_CHOICES: Record<string, ChoiceOption[]> = {
  lifecycle: [
    { value: 'installed', label: 'Installed' },
    { value: 'active', label: 'Active' },
    { value: 'retired', label: 'Retired' },
  ],
  environment: [
    { value: 'production', label: 'Production' },
    { value: 'staging', label: 'Staging' },
    { value: 'development', label: 'Development' },
    { value: 'test', label: 'Test' },
  ],
};

export const CmdbCiDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showNotification } = useNotification();
  const isNew = !id || id === 'new';
  const { choices } = useItsmChoices('cmdb_ci', FALLBACK_CHOICES);

  const lifecycleOptions = choices['lifecycle'] || FALLBACK_CHOICES['lifecycle'];
  const environmentOptions = choices['environment'] || FALLBACK_CHOICES['environment'];

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [ci, setCi] = useState<Partial<CmdbCiData>>({
    name: '',
    description: '',
    classId: '',
    lifecycle: 'installed',
    environment: 'production',
    ipAddress: '',
    dnsName: '',
    assetTag: '',
    serialNumber: '',
  });
  const [classes, setClasses] = useState<CmdbCiClassData[]>([]);
  const [relationships, setRelationships] = useState<CmdbCiRelData[]>([]);
  const [relatedServices, setRelatedServices] = useState<CmdbServiceCiData[]>([]);
  const [allServices, setAllServices] = useState<CmdbServiceData[]>([]);
  const [linkServiceDialogOpen, setLinkServiceDialogOpen] = useState(false);
  const [selectedServiceId, setSelectedServiceId] = useState('');
  const [selectedRelType, setSelectedRelType] = useState('depends_on');

  const fetchClasses = useCallback(async () => {
    try {
      const response = await cmdbApi.classes.list({ pageSize: 100 });
      const data = response.data;
      if (data && 'data' in data) {
        const inner = data.data;
        if (inner && 'items' in inner) {
          setClasses(Array.isArray(inner.items) ? inner.items : []);
        } else {
          setClasses(Array.isArray(inner) ? inner : []);
        }
      }
    } catch (err) {
      console.error('Error fetching CI classes:', err);
    }
  }, []);

  const fetchCi = useCallback(async () => {
    if (isNew || !id) return;
    setLoading(true);
    try {
      const response = await cmdbApi.cis.get(id);
      const data = response.data;
      if (data && 'data' in data) {
        setCi(data.data);
      }
    } catch (error) {
      console.error('Error fetching CI:', error);
      showNotification('Failed to load configuration item', 'error');
      navigate('/cmdb/cis');
    } finally {
      setLoading(false);
    }
  }, [id, isNew, navigate, showNotification]);

  const fetchRelationships = useCallback(async () => {
    if (isNew || !id) return;
    try {
      const response = await cmdbApi.relationships.list({ pageSize: 50, ciId: id });
      const data = response.data;
      if (data && 'data' in data) {
        const inner = data.data;
        if (inner && 'items' in inner) {
          setRelationships(Array.isArray(inner.items) ? inner.items : []);
        } else {
          setRelationships(Array.isArray(inner) ? inner : []);
        }
      }
    } catch (err) {
      console.error('Error fetching relationships:', err);
    }
  }, [id, isNew]);

  const fetchRelatedServices = useCallback(async () => {
    if (isNew || !id) return;
    try {
      const response = await cmdbApi.serviceCi.servicesForCi(id, { pageSize: 50 });
      const data = response.data;
      let items: CmdbServiceCiData[] = [];
      if (data && 'data' in data) {
        const inner = data.data;
        if (inner && 'items' in inner) {
          items = Array.isArray(inner.items) ? inner.items : [];
        }
      } else if (data && 'items' in data) {
        items = Array.isArray(data.items) ? data.items : [];
      }
      setRelatedServices(items);
    } catch (err) {
      console.error('Error fetching related services:', err);
    }
  }, [id, isNew]);

  const fetchAllServices = useCallback(async () => {
    try {
      const response = await cmdbApi.services.list({ pageSize: 100 });
      const data = response.data;
      let items: CmdbServiceData[] = [];
      if (data && 'data' in data) {
        const inner = data.data;
        if (inner && 'items' in inner) {
          items = Array.isArray(inner.items) ? inner.items : [];
        }
      } else if (data && 'items' in data) {
        items = Array.isArray(data.items) ? data.items : [];
      }
      setAllServices(items);
    } catch (err) {
      console.error('Error fetching services:', err);
    }
  }, []);

  useEffect(() => {
    fetchClasses();
    fetchCi();
    fetchRelationships();
    fetchRelatedServices();
    fetchAllServices();
  }, [fetchClasses, fetchCi, fetchRelationships, fetchRelatedServices, fetchAllServices]);

  const handleLinkService = async () => {
    if (!id || !selectedServiceId) return;
    try {
      await cmdbApi.serviceCi.link(selectedServiceId, id, {
        relationshipType: selectedRelType,
      });
      showNotification('Service linked successfully', 'success');
      setLinkServiceDialogOpen(false);
      setSelectedServiceId('');
      setSelectedRelType('depends_on');
      fetchRelatedServices();
    } catch (err) {
      console.error('Error linking service:', err);
      showNotification('Failed to link service', 'error');
    }
  };

  const handleUnlinkService = async (serviceId: string, relationshipType: string) => {
    if (!id) return;
    try {
      await cmdbApi.serviceCi.unlink(serviceId, id, relationshipType);
      showNotification('Service unlinked successfully', 'success');
      fetchRelatedServices();
    } catch (err) {
      console.error('Error unlinking service:', err);
      showNotification('Failed to unlink service', 'error');
    }
  };

  const handleChange = (field: keyof CmdbCiData, value: string) => {
    setCi((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!ci.name?.trim()) {
      showNotification('CI name is required', 'error');
      return;
    }
    if (!ci.classId) {
      showNotification('CI class is required', 'error');
      return;
    }

    setSaving(true);
    try {
      if (isNew) {
        const response = await cmdbApi.cis.create({
          name: ci.name,
          description: ci.description,
          classId: ci.classId,
          lifecycle: ci.lifecycle,
          environment: ci.environment,
          ipAddress: ci.ipAddress,
          dnsName: ci.dnsName,
          assetTag: ci.assetTag,
          serialNumber: ci.serialNumber,
        });
        const data = response.data;
        if (data && 'data' in data && data.data?.id) {
          showNotification('Configuration item created successfully', 'success');
          navigate(`/cmdb/cis/${data.data.id}`);
        }
      } else if (id) {
        await cmdbApi.cis.update(id, {
          name: ci.name,
          description: ci.description,
          classId: ci.classId,
          lifecycle: ci.lifecycle,
          environment: ci.environment,
          ipAddress: ci.ipAddress,
          dnsName: ci.dnsName,
          assetTag: ci.assetTag,
          serialNumber: ci.serialNumber,
        });
        showNotification('Configuration item updated successfully', 'success');
        fetchCi();
      }
    } catch (error: unknown) {
      console.error('Error saving CI:', error);
      const axiosErr = error as { response?: { status?: number } };
      if (axiosErr?.response?.status === 403) {
        showNotification('You don\'t have permission to manage CIs.', 'error');
      } else {
        showNotification('Failed to save configuration item', 'error');
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate('/cmdb/cis')}
        >
          Back to CIs
        </Button>
      </Box>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" fontWeight={600}>
          {isNew ? 'New Configuration Item' : ci.name}
        </Typography>
        <Button
          variant="contained"
          startIcon={<SaveIcon />}
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? 'Saving...' : 'Save'}
        </Button>
      </Box>

      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            CI Details
          </Typography>
          <Divider sx={{ mb: 3 }} />

          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Name"
                value={ci.name || ''}
                onChange={(e) => handleChange('name', e.target.value)}
                required
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <FormControl fullWidth required>
                <InputLabel>CI Class</InputLabel>
                <Select
                  value={ci.classId || ''}
                  label="CI Class"
                  onChange={(e) => handleChange('classId', e.target.value)}
                >
                  {classes.map((cls) => (
                    <MenuItem key={cls.id} value={cls.id}>
                      {cls.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Lifecycle</InputLabel>
                <Select
                  value={ci.lifecycle || 'installed'}
                  label="Lifecycle"
                  onChange={(e) => handleChange('lifecycle', e.target.value)}
                >
                  {lifecycleOptions.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Environment</InputLabel>
                <Select
                  value={ci.environment || 'production'}
                  label="Environment"
                  onChange={(e) => handleChange('environment', e.target.value)}
                >
                  {environmentOptions.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="IP Address"
                value={ci.ipAddress || ''}
                onChange={(e) => handleChange('ipAddress', e.target.value)}
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="DNS Name"
                value={ci.dnsName || ''}
                onChange={(e) => handleChange('dnsName', e.target.value)}
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Asset Tag"
                value={ci.assetTag || ''}
                onChange={(e) => handleChange('assetTag', e.target.value)}
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Serial Number"
                value={ci.serialNumber || ''}
                onChange={(e) => handleChange('serialNumber', e.target.value)}
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Description"
                value={ci.description || ''}
                onChange={(e) => handleChange('description', e.target.value)}
                multiline
                rows={3}
              />
            </Grid>
          </Grid>

          {!isNew && (
            <Box sx={{ mt: 4 }}>
              <Typography variant="subtitle2" color="text.secondary">
                Created: {ci.createdAt ? new Date(ci.createdAt).toLocaleString() : '-'}
              </Typography>
              <Typography variant="subtitle2" color="text.secondary">
                Last Updated: {ci.updatedAt ? new Date(ci.updatedAt).toLocaleString() : '-'}
              </Typography>
            </Box>
          )}
        </CardContent>
      </Card>

      {!isNew && (
        <Card sx={{ mt: 3 }}>
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6" fontWeight={600}>
                Related Services
              </Typography>
              <Button
                variant="outlined"
                startIcon={<LinkIcon />}
                onClick={() => setLinkServiceDialogOpen(true)}
                data-testid="btn-link-service"
              >
                Link Service
              </Button>
            </Box>
            <Divider sx={{ mb: 2 }} />
            <TableContainer component={Paper} variant="outlined">
              <Table size="small" data-testid="related-services-table">
                <TableHead>
                  <TableRow>
                    <TableCell>Service</TableCell>
                    <TableCell>Relationship</TableCell>
                    <TableCell>Primary</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {relatedServices.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} align="center">
                        <Typography variant="body2" color="text.secondary">
                          No services linked yet
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    relatedServices.map((link) => (
                      <TableRow key={link.id} hover data-testid={`service-link-row-${link.id}`}>
                        <TableCell>
                          <Typography
                            variant="body2"
                            sx={{ cursor: 'pointer', color: 'primary.main' }}
                            onClick={() => navigate(`/cmdb/services/${link.serviceId}`)}
                          >
                            {link.service?.name || link.serviceId.substring(0, 8)}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip label={link.relationshipType} size="small" />
                        </TableCell>
                        <TableCell>{link.isPrimary ? 'Yes' : 'No'}</TableCell>
                        <TableCell>{link.service?.type || '-'}</TableCell>
                        <TableCell align="right">
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => handleUnlinkService(link.serviceId, link.relationshipType)}
                            data-testid={`btn-unlink-service-${link.id}`}
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

      {!isNew && relationships.length > 0 && (
        <Card sx={{ mt: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Relationships
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Type</TableCell>
                    <TableCell>Direction</TableCell>
                    <TableCell>Related CI</TableCell>
                    <TableCell>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {relationships.map((rel) => {
                    const isSource = rel.sourceCiId === id;
                    const relatedCi = isSource ? rel.targetCi : rel.sourceCi;
                    return (
                      <TableRow key={rel.id} hover>
                        <TableCell>
                          <Chip label={rel.type} size="small" />
                        </TableCell>
                        <TableCell>{isSource ? 'Outgoing' : 'Incoming'}</TableCell>
                        <TableCell>
                          <Typography
                            variant="body2"
                            sx={{ cursor: 'pointer', color: 'primary.main' }}
                            onClick={() => {
                              const targetId = isSource ? rel.targetCiId : rel.sourceCiId;
                              navigate(`/cmdb/cis/${targetId}`);
                            }}
                          >
                            {relatedCi?.name || (isSource ? rel.targetCiId : rel.sourceCiId).substring(0, 8)}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={rel.isActive ? 'Active' : 'Inactive'}
                            size="small"
                            color={rel.isActive ? 'success' : 'default'}
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      )}

      {!isNew && id && (
        <TopologyPanel
          entityId={id}
          entityType="ci"
          onNodeNavigate={(nodeId, nodeType) => {
            if (nodeType === 'ci') navigate(`/cmdb/cis/${nodeId}`);
            else if (nodeType === 'service') navigate(`/cmdb/services/${nodeId}`);
          }}
        />
      )}

      <Dialog
        open={linkServiceDialogOpen}
        onClose={() => setLinkServiceDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Link Service to CI</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <FormControl fullWidth required>
              <InputLabel>Service</InputLabel>
              <Select
                value={selectedServiceId}
                onChange={(e) => setSelectedServiceId(e.target.value)}
                label="Service"
                data-testid="select-link-service"
              >
                {allServices.map((svc) => (
                  <MenuItem key={svc.id} value={svc.id}>
                    {svc.name} ({svc.type})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth required>
              <InputLabel>Relationship Type</InputLabel>
              <Select
                value={selectedRelType}
                onChange={(e) => setSelectedRelType(e.target.value)}
                label="Relationship Type"
                data-testid="select-link-rel-type"
              >
                <MenuItem value="depends_on">Depends On</MenuItem>
                <MenuItem value="hosted_on">Hosted On</MenuItem>
                <MenuItem value="consumed_by">Consumed By</MenuItem>
                <MenuItem value="supports">Supports</MenuItem>
                <MenuItem value="managed_by">Managed By</MenuItem>
                <MenuItem value="monitored_by">Monitored By</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLinkServiceDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleLinkService}
            disabled={!selectedServiceId}
            data-testid="btn-confirm-link-service"
          >
            Link
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default CmdbCiDetail;
