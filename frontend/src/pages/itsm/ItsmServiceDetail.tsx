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
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Save as SaveIcon,
} from '@mui/icons-material';
import { itsmApi } from '../../services/grcClient';
import { useNotification } from '../../contexts/NotificationContext';

interface ItsmService {
  id: string;
  name: string;
  description?: string;
  criticality: string;
  status: string;
  ownerUserId?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

const CRITICALITY_OPTIONS = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
const STATUS_OPTIONS = ['ACTIVE', 'INACTIVE', 'DEPRECATED', 'MAINTENANCE'];

export const ItsmServiceDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showNotification } = useNotification();
  const isNew = id === 'new';

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [service, setService] = useState<Partial<ItsmService>>({
    name: '',
    description: '',
    criticality: 'MEDIUM',
    status: 'ACTIVE',
  });

  const fetchService = useCallback(async () => {
    if (isNew || !id) return;
    
    setLoading(true);
    try {
      const response = await itsmApi.services.get(id);
      const data = response.data;
      if (data && 'data' in data) {
        setService(data.data);
      }
    } catch (error) {
      console.error('Error fetching ITSM service:', error);
      showNotification('Failed to load ITSM service', 'error');
      navigate('/itsm/services');
    } finally {
      setLoading(false);
    }
  }, [id, isNew, navigate, showNotification]);

  useEffect(() => {
    fetchService();
  }, [fetchService]);

  const handleChange = (field: keyof ItsmService, value: string) => {
    setService((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!service.name?.trim()) {
      showNotification('Service name is required', 'error');
      return;
    }

    setSaving(true);
    try {
      if (isNew) {
        const response = await itsmApi.services.create({
          name: service.name,
          description: service.description,
          criticality: service.criticality as 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW',
          status: service.status as 'ACTIVE' | 'INACTIVE' | 'DEPRECATED' | 'MAINTENANCE',
        });
        const data = response.data;
        if (data && 'data' in data && data.data?.id) {
          showNotification('ITSM service created successfully', 'success');
          navigate(`/itsm/services/${data.data.id}`);
        }
      } else if (id) {
        await itsmApi.services.update(id, {
          name: service.name,
          description: service.description,
          criticality: service.criticality as 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW',
          status: service.status as 'ACTIVE' | 'INACTIVE' | 'DEPRECATED' | 'MAINTENANCE',
        });
        showNotification('ITSM service updated successfully', 'success');
        fetchService();
      }
    } catch (error) {
      console.error('Error saving ITSM service:', error);
      showNotification('Failed to save ITSM service', 'error');
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
          onClick={() => navigate('/itsm/services')}
        >
          Back to Services
        </Button>
      </Box>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" fontWeight={600}>
          {isNew ? 'New ITSM Service' : service.name}
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
            Service Details
          </Typography>
          <Divider sx={{ mb: 3 }} />

          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Service Name"
                value={service.name || ''}
                onChange={(e) => handleChange('name', e.target.value)}
                required
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Criticality</InputLabel>
                <Select
                  value={service.criticality || 'MEDIUM'}
                  label="Criticality"
                  onChange={(e) => handleChange('criticality', e.target.value)}
                >
                  {CRITICALITY_OPTIONS.map((option) => (
                    <MenuItem key={option} value={option}>
                      {option}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  value={service.status || 'ACTIVE'}
                  label="Status"
                  onChange={(e) => handleChange('status', e.target.value)}
                >
                  {STATUS_OPTIONS.map((option) => (
                    <MenuItem key={option} value={option}>
                      {option}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Description"
                value={service.description || ''}
                onChange={(e) => handleChange('description', e.target.value)}
                multiline
                rows={4}
              />
            </Grid>
          </Grid>

          {!isNew && (
            <Box sx={{ mt: 4 }}>
              <Typography variant="subtitle2" color="text.secondary">
                Created: {service.createdAt ? new Date(service.createdAt).toLocaleString() : '-'}
              </Typography>
              <Typography variant="subtitle2" color="text.secondary">
                Last Updated: {service.updatedAt ? new Date(service.updatedAt).toLocaleString() : '-'}
              </Typography>
            </Box>
          )}
        </CardContent>
      </Card>
    </Box>
  );
};

export default ItsmServiceDetail;
