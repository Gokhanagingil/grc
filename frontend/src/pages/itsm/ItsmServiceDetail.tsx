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
import { useItsmChoices, ChoiceOption } from '../../hooks/useItsmChoices';
import { useCompanyLookup } from '../../hooks/useCompanyLookup';
import { ActivityStream } from '../../components/itsm/ActivityStream';
import { AxiosError } from 'axios';

interface ApiValidationErrorData {
  error?: {
    message?: string;
    fieldErrors?: { field: string; message: string }[];
  };
  message?: string | string[];
}

interface ItsmService {
  id: string;
  name: string;
  description?: string;
  criticality: string;
  status: string;
  ownerUserId?: string;
  customerCompanyId?: string;
  customerCompany?: { id: string; name: string; type: string } | null;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

const FALLBACK_CHOICES: Record<string, ChoiceOption[]> = {
  criticality: [
    { value: 'CRITICAL', label: 'Critical' },
    { value: 'HIGH', label: 'High' },
    { value: 'MEDIUM', label: 'Medium' },
    { value: 'LOW', label: 'Low' },
  ],
  status: [
    { value: 'ACTIVE', label: 'Active' },
    { value: 'INACTIVE', label: 'Inactive' },
    { value: 'DEPRECATED', label: 'Deprecated' },
  ],
};

export const ItsmServiceDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showNotification } = useNotification();
  const isNew = !id || id === 'new';
  const { choices } = useItsmChoices('itsm_services', FALLBACK_CHOICES);

  const criticalityOptions = choices['criticality'] || FALLBACK_CHOICES['criticality'];
  const statusOptions = choices['status'] || FALLBACK_CHOICES['status'];
  const { companies } = useCompanyLookup();

  const [loading, setLoading]= useState(!isNew);
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
          customerCompanyId: service.customerCompanyId || null,
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
          customerCompanyId: service.customerCompanyId || null,
        });
        showNotification('ITSM service updated successfully', 'success');
        fetchService();
      }
    } catch (error: unknown) {
      console.error('Error saving ITSM service:', error);
      const axiosErr = error as AxiosError<ApiValidationErrorData>;
      if (axiosErr?.response?.status === 403) {
        showNotification('You don\'t have permission to create services.', 'error');
      } else {
        const fieldErrors = axiosErr?.response?.data?.error?.fieldErrors;
        const errMsg = axiosErr?.response?.data?.error?.message;
        const msgArr = axiosErr?.response?.data?.message;
        if (fieldErrors && fieldErrors.length > 0) {
          showNotification(fieldErrors.map(e => `${e.field}: ${e.message}`).join(', '), 'error');
        } else if (errMsg) {
          showNotification(errMsg, 'error');
        } else if (Array.isArray(msgArr)) {
          showNotification(msgArr.join(', '), 'error');
        } else {
          showNotification('Failed to save ITSM service', 'error');
        }
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
                  {criticalityOptions.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
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
                  {statusOptions.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Customer Company</InputLabel>
                <Select
                  value={service.customerCompanyId || ''}
                  label="Customer Company"
                  data-testid="service-company-select"
                  onChange={(e) => {
                    const val = e.target.value || undefined;
                    setService((prev) => ({ ...prev, customerCompanyId: val }));
                  }}
                >
                  <MenuItem value=""><em>None</em></MenuItem>
                  {companies.map((c) => (
                    <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
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

      {!isNew && service.id && (
        <Box sx={{ mt: 3 }}>
          <ActivityStream table="services" recordId={service.id} />
        </Box>
      )}
    </Box>
  );
};

export default ItsmServiceDetail;
