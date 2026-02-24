import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  Grid,
  IconButton,
  Switch,
  FormControlLabel,
  Tab,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
  Paper,
  Alert,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Save as SaveIcon,
  AccountTree as TreeIcon,
} from '@mui/icons-material';
import { cmdbApi, CmdbCiClassData, CmdbCiClassFieldDefinition, ValidateInheritanceResponse } from '../../services/grcClient';
import { useNotification } from '../../contexts/NotificationContext';
import { classifyApiError } from '../../utils/apiErrorClassifier';
import { EffectiveSchemaPanel } from './EffectiveSchemaPanel';
import { ParentClassSelector } from './ParentClassSelector';

export const CmdbCiClassDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showNotification } = useNotification();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [ciClass, setCiClass] = useState<Partial<CmdbCiClassData>>({});
  const [fieldsSchema, setFieldsSchema] = useState<CmdbCiClassFieldDefinition[]>([]);
  const [parentClass, setParentClass] = useState<CmdbCiClassData | null>(null);
  const [schemaTab, setSchemaTab] = useState(0);
  const [pendingParentId, setPendingParentId] = useState<string | null | undefined>(undefined);
  const [parentValidation, setParentValidation] = useState<ValidateInheritanceResponse | null>(null);

  const fetchClass = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const response = await cmdbApi.classes.get(id);
      const data = response.data;
      let classData: CmdbCiClassData | null = null;
      if (data && 'data' in data && data.data && typeof data.data === 'object') {
        classData = data.data as CmdbCiClassData;
      } else if (data && typeof data === 'object' && 'id' in data) {
        classData = data as CmdbCiClassData;
      }
      if (classData) {
        setCiClass(classData);
        setFieldsSchema(Array.isArray(classData.fieldsSchema) ? classData.fieldsSchema : []);
        setPendingParentId(undefined);
        setParentValidation(null);
        // Fetch parent class if exists
        if (classData.parentClassId) {
          try {
            const parentRes = await cmdbApi.classes.get(classData.parentClassId);
            const pData = parentRes.data;
            if (pData && 'data' in pData && pData.data) {
              setParentClass(pData.data as CmdbCiClassData);
            } else if (pData && typeof pData === 'object' && 'id' in pData) {
              setParentClass(pData as CmdbCiClassData);
            }
          } catch {
            // Parent class fetch is non-critical
          }
        }
      } else {
        showNotification('CI class not found', 'error');
        navigate('/cmdb/classes');
      }
    } catch (err) {
      console.error('Error fetching CI class:', err);
      const classified = classifyApiError(err);
      showNotification(classified.message || 'Failed to load CI class', 'error');
      navigate('/cmdb/classes');
    } finally {
      setLoading(false);
    }
  }, [id, navigate, showNotification]);

  useEffect(() => {
    fetchClass();
  }, [fetchClass]);

  const handleParentChange = useCallback(
    (newParentId: string | null, validation: ValidateInheritanceResponse | null) => {
      setPendingParentId(newParentId);
      setParentValidation(validation);
    },
    []
  );

  const handleSave = async () => {
    if (!id || !ciClass.name?.trim() || !ciClass.label?.trim()) {
      showNotification('Name and label are required', 'error');
      return;
    }
    // Block save if parent validation explicitly failed
    if (parentValidation && !parentValidation.valid && parentValidation.errors && parentValidation.errors.length > 0) {
      showNotification('Cannot save: parent class assignment has validation errors.', 'error');
      return;
    }
    setSaving(true);
    try {
      const updatePayload: Record<string, unknown> = {
        name: ciClass.name,
        label: ciClass.label,
        description: ciClass.description || undefined,
        isActive: ciClass.isActive,
      };
      // Include parent class change if user modified it
      if (pendingParentId !== undefined) {
        updatePayload.parentClassId = pendingParentId;
      }
      await cmdbApi.classes.update(id, updatePayload);
      showNotification('CI class updated successfully', 'success');
      fetchClass();
    } catch (err) {
      console.error('Error updating CI class:', err);
      const classified = classifyApiError(err);
      showNotification(classified.message || 'Failed to update CI class', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <IconButton onClick={() => navigate('/cmdb/classes')} data-testid="btn-back-to-classes">
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h4" fontWeight={600}>
          {ciClass.label || ciClass.name || 'CI Class Detail'}
        </Typography>
        {ciClass.isSystem && (
          <Chip label="System" size="small" color="primary" data-testid="detail-system-badge" />
        )}
        {!ciClass.isSystem && (
          <Chip label="Custom" size="small" variant="outlined" color="secondary" data-testid="detail-custom-badge" />
        )}
        {ciClass.isAbstract && (
          <Chip label="Abstract" size="small" variant="outlined" color="warning" />
        )}
        <Chip
          label={ciClass.isActive ? 'Active' : 'Inactive'}
          size="small"
          color={ciClass.isActive ? 'success' : 'default'}
        />
        <Box sx={{ flexGrow: 1 }} />
        <Button
          variant="outlined"
          startIcon={<TreeIcon />}
          onClick={() => navigate('/cmdb/classes/tree')}
          data-testid="btn-view-tree"
        >
          Class Tree
        </Button>
        <Button
          variant="contained"
          startIcon={<SaveIcon />}
          onClick={handleSave}
          disabled={saving}
          data-testid="btn-save-class"
        >
          {saving ? 'Saving...' : 'Save'}
        </Button>
      </Box>

      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>Basic Information</Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Name (identifier)"
                    value={ciClass.name || ''}
                    onChange={(e) => setCiClass(prev => ({ ...prev, name: e.target.value }))}
                    data-testid="input-class-name"
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Label (display name)"
                    value={ciClass.label || ''}
                    onChange={(e) => setCiClass(prev => ({ ...prev, label: e.target.value }))}
                    data-testid="input-class-label"
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    multiline
                    rows={3}
                    label="Description"
                    value={ciClass.description || ''}
                    onChange={(e) => setCiClass(prev => ({ ...prev, description: e.target.value }))}
                    data-testid="input-class-description"
                  />
                </Grid>
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={ciClass.isActive ?? true}
                        onChange={(e) => setCiClass(prev => ({ ...prev, isActive: e.target.checked }))}
                        data-testid="switch-class-active"
                      />
                    }
                    label="Active"
                  />
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          {/* Parent Class Selector */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>Parent Class</Typography>
              <ParentClassSelector
                classId={id || null}
                parentClassId={ciClass.parentClassId}
                onParentChange={handleParentChange}
                disabled={saving}
              />
            </CardContent>
          </Card>

          {/* Schema Tabs: Local Fields & Effective Schema */}
          <Card>
            <CardContent>
              <Tabs
                value={schemaTab}
                onChange={(_, val) => setSchemaTab(val)}
                sx={{ mb: 2 }}
                data-testid="schema-tabs"
              >
                <Tab
                  label={`Local Fields (${fieldsSchema.length})`}
                  data-testid="tab-local-fields"
                />
                <Tab
                  label="Effective Schema"
                  data-testid="tab-effective-schema"
                />
              </Tabs>

              {schemaTab === 0 && (
                <>
                  <Typography variant="h6" gutterBottom>
                    Fields Schema ({fieldsSchema.length} field{fieldsSchema.length !== 1 ? 's' : ''})
                  </Typography>
                  {fieldsSchema.length === 0 ? (
                    <Alert severity="info" data-testid="fields-empty-state">
                      No local fields defined for this class.{' '}
                      {ciClass.parentClassId
                        ? 'This class may inherit fields from parent classes. Switch to the Effective Schema tab to see all inherited and local fields.'
                        : 'Add fields above or assign a parent class to inherit fields.'}
                    </Alert>
                  ) : (
                    <TableContainer component={Paper} variant="outlined">
                      <Table size="small" data-testid="fields-schema-table">
                        <TableHead>
                          <TableRow>
                            <TableCell>Key</TableCell>
                            <TableCell>Label</TableCell>
                            <TableCell>Data Type</TableCell>
                            <TableCell>Required</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {fieldsSchema.map((field) => (
                            <TableRow key={field.key}>
                              <TableCell>
                                <Typography variant="body2" fontFamily="monospace">{field.key}</Typography>
                              </TableCell>
                              <TableCell>{field.label}</TableCell>
                              <TableCell>
                                <Chip label={field.dataType} size="small" variant="outlined" />
                              </TableCell>
                              <TableCell>
                                {field.required ? (
                                  <Chip label="Required" size="small" color="error" variant="outlined" />
                                ) : (
                                  <Typography variant="body2" color="text.secondary">Optional</Typography>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  )}
                </>
              )}

              {schemaTab === 1 && id && (
                <EffectiveSchemaPanel classId={id} />
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          {/* Metadata sidebar */}
          <Card sx={{ mb: 2 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>Metadata</Typography>
              {parentClass && (
                <>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Parent Class
                  </Typography>
                  <Chip
                    label={parentClass.label || parentClass.name}
                    size="small"
                    color="info"
                    variant="outlined"
                    onClick={() => navigate(`/cmdb/classes/${parentClass.id}`)}
                    sx={{ mb: 1, cursor: 'pointer' }}
                  />
                  <Divider sx={{ my: 1 }} />
                </>
              )}
              <Typography variant="body2" color="text.secondary">
                Created: {ciClass.createdAt ? new Date(ciClass.createdAt).toLocaleString() : '-'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Updated: {ciClass.updatedAt ? new Date(ciClass.updatedAt).toLocaleString() : '-'}
              </Typography>
            </CardContent>
          </Card>

          {/* Quick link to CIs */}
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Quick Actions</Typography>
              <Button
                fullWidth
                variant="outlined"
                onClick={() => navigate(`/cmdb/cis?classId=${id}`)}
                data-testid="btn-view-class-cis"
                sx={{ mb: 1 }}
              >
                View CIs of this Class
              </Button>
              <Button
                fullWidth
                variant="outlined"
                startIcon={<TreeIcon />}
                onClick={() => navigate('/cmdb/classes/tree')}
                data-testid="btn-view-hierarchy"
              >
                View Class Hierarchy
              </Button>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default CmdbCiClassDetail;
