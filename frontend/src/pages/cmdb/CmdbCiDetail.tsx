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
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Save as SaveIcon,
} from '@mui/icons-material';
import { cmdbApi, CmdbCiData, CmdbCiClassData, CmdbCiRelData } from '../../services/grcClient';
import { useNotification } from '../../contexts/NotificationContext';
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

  useEffect(() => {
    fetchClasses();
    fetchCi();
    fetchRelationships();
  }, [fetchClasses, fetchCi, fetchRelationships]);

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
    </Box>
  );
};

export default CmdbCiDetail;
