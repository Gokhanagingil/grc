import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Chip,
  Alert,
  Tabs,
  Tab,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TablePagination,
  Button,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  CircularProgress,
  Tooltip,
  Divider,
  Snackbar,
} from '@mui/material';
import {
  PlaylistAddCheck as SoaIcon,
  ArrowBack as BackIcon,
  Publish as PublishIcon,
  Download as DownloadIcon,
  PlayArrow as InitializeIcon,
  Edit as EditIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
  Security as ControlIcon,
  Description as EvidenceIcon,
} from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';
import {
  soaApi,
  SoaProfileData,
  SoaItemData,
  SoaProfileStatus,
  SoaApplicability,
  SoaImplementationStatus,
  CreateSoaProfileDto,
  UpdateSoaProfileDto,
  UpdateSoaItemDto,
  standardsLibraryApi,
  controlApi,
  evidenceApi,
  StandardData,
} from '../services/grcClient';
import { useAuth } from '../contexts/AuthContext';
import { LoadingState, ErrorState } from '../components/common';

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
      id={`soa-tabpanel-${index}`}
      aria-labelledby={`soa-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  );
}

const getStatusColor = (status: SoaProfileStatus): 'error' | 'warning' | 'info' | 'success' | 'default' => {
  switch (status) {
    case 'PUBLISHED': return 'success';
    case 'DRAFT': return 'info';
    case 'ARCHIVED': return 'default';
    default: return 'default';
  }
};

const getApplicabilityColor = (applicability: SoaApplicability): 'error' | 'warning' | 'info' | 'success' | 'default' => {
  switch (applicability) {
    case 'APPLICABLE': return 'success';
    case 'NOT_APPLICABLE': return 'default';
    case 'UNDECIDED': return 'warning';
    default: return 'default';
  }
};

const getImplementationColor = (status: SoaImplementationStatus): 'error' | 'warning' | 'info' | 'success' | 'default' => {
  switch (status) {
    case 'IMPLEMENTED': return 'success';
    case 'PARTIALLY_IMPLEMENTED': return 'info';
    case 'PLANNED': return 'warning';
    case 'NOT_IMPLEMENTED': return 'default';
    default: return 'default';
  }
};

const formatStatus = (status: string): string => {
  return status.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
};

const formatDate = (dateString: string | null): string => {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleDateString();
};

interface ControlOption {
  id: string;
  name: string;
  code: string | null;
}

interface EvidenceOption {
  id: string;
  title: string;
}

export const SoaProfileDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const tenantId = user?.tenantId || '';
  const isNew = id === 'new';

  const [profile, setProfile] = useState<SoaProfileData | null>(null);
  const [loading, setLoading] = useState(!isNew);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [tabValue, setTabValue] = useState(0);

  // Profile form state
  const [editMode, setEditMode] = useState(isNew);
  const [formData, setFormData] = useState<CreateSoaProfileDto | UpdateSoaProfileDto>({
    name: '',
    description: '',
    scopeText: '',
    standardId: '',
  });
  const [saving, setSaving] = useState(false);

  // Standards for dropdown
  const [standards, setStandards] = useState<StandardData[]>([]);

  // Items state
  const [items, setItems] = useState<SoaItemData[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [itemsTotal, setItemsTotal] = useState(0);
  const [itemsPage, setItemsPage] = useState(0);
  const [itemsPageSize, setItemsPageSize] = useState(20);
  const [itemsSearch, setItemsSearch] = useState('');
  const [applicabilityFilter, setApplicabilityFilter] = useState<SoaApplicability | ''>('');
  const [implementationFilter, setImplementationFilter] = useState<SoaImplementationStatus | ''>('');

  // Item edit dialog
  const [editingItem, setEditingItem] = useState<SoaItemData | null>(null);
  const [itemFormData, setItemFormData] = useState<UpdateSoaItemDto>({});
  const [savingItem, setSavingItem] = useState(false);

  // Link dialogs
  const [linkControlDialogOpen, setLinkControlDialogOpen] = useState(false);
  const [linkEvidenceDialogOpen, setLinkEvidenceDialogOpen] = useState(false);
  const [selectedItemForLink, setSelectedItemForLink] = useState<SoaItemData | null>(null);
  const [availableControls, setAvailableControls] = useState<ControlOption[]>([]);
  const [availableEvidence, setAvailableEvidence] = useState<EvidenceOption[]>([]);
  const [selectedControlId, setSelectedControlId] = useState('');
  const [selectedEvidenceId, setSelectedEvidenceId] = useState('');
  const [linking, setLinking] = useState(false);

  // Initialize items state
  const [initializing, setInitializing] = useState(false);

  // Publish state
  const [publishing, setPublishing] = useState(false);

  // Fetch profile
  const fetchProfile = useCallback(async () => {
    if (!id || !tenantId || isNew) return;

    setLoading(true);
    setError(null);

    try {
      const data = await soaApi.getProfile(tenantId, id);
      setProfile(data);
      setFormData({
        name: data.name,
        description: data.description || '',
        scopeText: data.scopeText || '',
      });
    } catch (err) {
      console.error('Error fetching profile:', err);
      setError('Failed to load SOA profile. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [id, tenantId, isNew]);

  // Fetch standards
  const fetchStandards = useCallback(async () => {
    try {
      const response = await standardsLibraryApi.list();
      setStandards(response.items || []);
    } catch (err) {
      console.error('Error fetching standards:', err);
    }
  }, []);

  // Fetch items
  const fetchItems = useCallback(async () => {
    if (!id || !tenantId || isNew) return;

    setItemsLoading(true);
    try {
      const response = await soaApi.listItems(tenantId, {
        profileId: id,
        page: itemsPage + 1,
        pageSize: itemsPageSize,
        search: itemsSearch || undefined,
        applicability: applicabilityFilter || undefined,
        implementationStatus: implementationFilter || undefined,
      });
      setItems(response.items);
      setItemsTotal(response.total);
    } catch (err) {
      console.error('Error fetching items:', err);
    } finally {
      setItemsLoading(false);
    }
  }, [id, tenantId, isNew, itemsPage, itemsPageSize, itemsSearch, applicabilityFilter, implementationFilter]);

  // Fetch available controls
  const fetchControls = useCallback(async () => {
    if (!tenantId) return;

    try {
      const response = await controlApi.list(tenantId, { pageSize: 100 });
      setAvailableControls(response.items.map(c => ({ id: c.id, name: c.name, code: c.code })));
    } catch (err) {
      console.error('Error fetching controls:', err);
    }
  }, [tenantId]);

  // Fetch available evidence
  const fetchEvidence = useCallback(async () => {
    if (!tenantId) return;

    try {
      const response = await evidenceApi.list(tenantId, { pageSize: 100 });
      setAvailableEvidence(response.items.map(e => ({ id: e.id, title: e.title })));
    } catch (err) {
      console.error('Error fetching evidence:', err);
    }
  }, [tenantId]);

  useEffect(() => {
    fetchProfile();
    fetchStandards();
  }, [fetchProfile, fetchStandards]);

  useEffect(() => {
    if (tabValue === 0 && !isNew) {
      fetchItems();
    }
  }, [tabValue, fetchItems, isNew]);

  useEffect(() => {
    fetchControls();
    fetchEvidence();
  }, [fetchControls, fetchEvidence]);

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  // Profile CRUD
  const handleSaveProfile = async () => {
    if (!tenantId) return;

    setSaving(true);
    setError(null);

    try {
      if (isNew) {
        const createData = formData as CreateSoaProfileDto;
        if (!createData.standardId || !createData.name) {
          setError('Name and Standard are required');
          setSaving(false);
          return;
        }
        const created = await soaApi.createProfile(tenantId, createData);
        setSuccess('SOA profile created successfully');
        navigate(`/soa/${created.id}`);
      } else if (id) {
        const updateData: UpdateSoaProfileDto = {
          name: formData.name,
          description: formData.description,
          scopeText: formData.scopeText,
        };
        const updated = await soaApi.updateProfile(tenantId, id, updateData);
        setProfile(updated);
        setEditMode(false);
        setSuccess('SOA profile updated successfully');
      }
    } catch (err) {
      console.error('Error saving profile:', err);
      setError('Failed to save SOA profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleInitializeItems = async () => {
    if (!id || !tenantId) return;

    setInitializing(true);
    setError(null);

    try {
      const result = await soaApi.initializeItems(tenantId, id);
      setSuccess(`Initialized ${result.created} items (${result.existing} already existed)`);
      fetchItems();
    } catch (err) {
      console.error('Error initializing items:', err);
      setError('Failed to initialize items. Please try again.');
    } finally {
      setInitializing(false);
    }
  };

  const handlePublish = async () => {
    if (!id || !tenantId) return;

    if (!window.confirm('Are you sure you want to publish this SOA profile? This will increment the version.')) {
      return;
    }

    setPublishing(true);
    setError(null);

    try {
      const updated = await soaApi.publishProfile(tenantId, id);
      setProfile(updated);
      setSuccess('SOA profile published successfully');
    } catch (err) {
      console.error('Error publishing profile:', err);
      setError('Failed to publish SOA profile. Please try again.');
    } finally {
      setPublishing(false);
    }
  };

  const handleExportCsv = async () => {
    if (!id || !tenantId) return;

    try {
      const blob = await soaApi.exportCsv(tenantId, id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `soa-${profile?.name || id}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      setSuccess('CSV exported successfully');
    } catch (err) {
      console.error('Error exporting CSV:', err);
      setError('Failed to export CSV. Please try again.');
    }
  };

  // Item editing
  const handleEditItem = (item: SoaItemData) => {
    setEditingItem(item);
    setItemFormData({
      applicability: item.applicability,
      justification: item.justification || '',
      implementationStatus: item.implementationStatus,
      targetDate: item.targetDate || '',
      notes: item.notes || '',
    });
  };

  const handleSaveItem = async () => {
    if (!editingItem || !tenantId) return;

    setSavingItem(true);
    setError(null);

    try {
      await soaApi.updateItem(tenantId, editingItem.id, itemFormData);
      setSuccess('Item updated successfully');
      setEditingItem(null);
      fetchItems();
    } catch (err) {
      console.error('Error saving item:', err);
      setError('Failed to save item. Please try again.');
    } finally {
      setSavingItem(false);
    }
  };

  // Control linking
  const handleOpenLinkControl = (item: SoaItemData) => {
    setSelectedItemForLink(item);
    setSelectedControlId('');
    setLinkControlDialogOpen(true);
  };

  const handleLinkControl = async () => {
    if (!selectedItemForLink || !selectedControlId || !tenantId) return;

    setLinking(true);
    try {
      await soaApi.linkControl(tenantId, selectedItemForLink.id, selectedControlId);
      setSuccess('Control linked successfully');
      setLinkControlDialogOpen(false);
      fetchItems();
    } catch (err) {
      console.error('Error linking control:', err);
      setError('Failed to link control. Please try again.');
    } finally {
      setLinking(false);
    }
  };

  // Evidence linking
  const handleOpenLinkEvidence = (item: SoaItemData) => {
    setSelectedItemForLink(item);
    setSelectedEvidenceId('');
    setLinkEvidenceDialogOpen(true);
  };

  const handleLinkEvidence = async () => {
    if (!selectedItemForLink || !selectedEvidenceId || !tenantId) return;

    setLinking(true);
    try {
      await soaApi.linkEvidence(tenantId, selectedItemForLink.id, selectedEvidenceId);
      setSuccess('Evidence linked successfully');
      setLinkEvidenceDialogOpen(false);
      fetchItems();
    } catch (err) {
      console.error('Error linking evidence:', err);
      setError('Failed to link evidence. Please try again.');
    } finally {
      setLinking(false);
    }
  };

  const handleItemsPageChange = (_event: unknown, newPage: number) => {
    setItemsPage(newPage);
  };

  const handleItemsPageSizeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setItemsPageSize(parseInt(event.target.value, 10));
    setItemsPage(0);
  };

  // Computed values
  const standardName = useMemo(() => {
    if (profile?.standard?.name) return profile.standard.name;
    if (isNew && (formData as CreateSoaProfileDto).standardId) {
      const standard = standards.find(s => s.id === (formData as CreateSoaProfileDto).standardId);
      return standard?.name || '';
    }
    return '';
  }, [profile, isNew, formData, standards]);

  if (loading) {
    return <LoadingState message="Loading SOA profile..." />;
  }

  if (error && !profile && !isNew) {
    return <ErrorState message={error} onRetry={fetchProfile} />;
  }

  return (
    <Box sx={{ p: 3 }}>
      <Snackbar
        open={!!success}
        autoHideDuration={3000}
        onClose={() => setSuccess(null)}
        message={success}
      />

      {/* Header */}
      <Box display="flex" alignItems="center" mb={3}>
        <IconButton onClick={() => navigate('/soa')} sx={{ mr: 2 }}>
          <BackIcon />
        </IconButton>
        <SoaIcon sx={{ fontSize: 32, mr: 2, color: 'primary.main' }} />
        <Box flex={1}>
          <Typography variant="h4" component="h1">
            {isNew ? 'New SOA Profile' : profile?.name || 'SOA Profile'}
          </Typography>
          {!isNew && profile && (
            <Box display="flex" alignItems="center" gap={1} mt={0.5}>
              <Chip
                label={formatStatus(profile.status)}
                size="small"
                color={getStatusColor(profile.status)}
              />
              <Typography variant="body2" color="text.secondary">
                v{profile.version} | {standardName}
              </Typography>
            </Box>
          )}
        </Box>
        {!isNew && profile && (
          <Box display="flex" gap={1}>
            <Button
              variant="outlined"
              startIcon={<InitializeIcon />}
              onClick={handleInitializeItems}
              disabled={initializing || profile.status === 'ARCHIVED'}
            >
              {initializing ? 'Initializing...' : 'Initialize Items'}
            </Button>
            <Button
              variant="outlined"
              startIcon={<PublishIcon />}
              onClick={handlePublish}
              disabled={publishing || profile.status === 'ARCHIVED'}
            >
              {publishing ? 'Publishing...' : 'Publish'}
            </Button>
            <Button
              variant="outlined"
              startIcon={<DownloadIcon />}
              onClick={handleExportCsv}
            >
              Export CSV
            </Button>
          </Box>
        )}
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Tabs */}
      <Paper sx={{ mb: 3 }}>
        <Tabs value={tabValue} onChange={handleTabChange}>
          <Tab label="Items" disabled={isNew} />
          <Tab label="Profile Info" />
        </Tabs>
      </Paper>

      {/* Items Tab */}
      <TabPanel value={tabValue} index={0}>
        <Card>
          <CardContent>
            {/* Filters */}
            <Box display="flex" gap={2} mb={2} flexWrap="wrap">
              <TextField
                size="small"
                placeholder="Search clauses..."
                value={itemsSearch}
                onChange={(e) => {
                  setItemsSearch(e.target.value);
                  setItemsPage(0);
                }}
                sx={{ minWidth: 200 }}
              />
              <FormControl size="small" sx={{ minWidth: 150 }}>
                <InputLabel>Applicability</InputLabel>
                <Select
                  value={applicabilityFilter}
                  label="Applicability"
                  onChange={(e) => {
                    setApplicabilityFilter(e.target.value as SoaApplicability | '');
                    setItemsPage(0);
                  }}
                >
                  <MenuItem value="">All</MenuItem>
                  <MenuItem value="APPLICABLE">Applicable</MenuItem>
                  <MenuItem value="NOT_APPLICABLE">Not Applicable</MenuItem>
                  <MenuItem value="UNDECIDED">Undecided</MenuItem>
                </Select>
              </FormControl>
              <FormControl size="small" sx={{ minWidth: 180 }}>
                <InputLabel>Implementation</InputLabel>
                <Select
                  value={implementationFilter}
                  label="Implementation"
                  onChange={(e) => {
                    setImplementationFilter(e.target.value as SoaImplementationStatus | '');
                    setItemsPage(0);
                  }}
                >
                  <MenuItem value="">All</MenuItem>
                  <MenuItem value="IMPLEMENTED">Implemented</MenuItem>
                  <MenuItem value="PARTIALLY_IMPLEMENTED">Partially Implemented</MenuItem>
                  <MenuItem value="PLANNED">Planned</MenuItem>
                  <MenuItem value="NOT_IMPLEMENTED">Not Implemented</MenuItem>
                </Select>
              </FormControl>
            </Box>

            {/* Items Table */}
            {itemsLoading ? (
              <Box display="flex" justifyContent="center" p={4}>
                <CircularProgress />
              </Box>
            ) : items.length === 0 ? (
              <Alert severity="info">
                No items found. {profile?.status === 'DRAFT' && 'Click "Initialize Items" to create items from the standard clauses.'}
              </Alert>
            ) : (
              <>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Clause</TableCell>
                      <TableCell>Title</TableCell>
                      <TableCell>Applicability</TableCell>
                      <TableCell>Implementation</TableCell>
                      <TableCell>Controls</TableCell>
                      <TableCell>Evidence</TableCell>
                      <TableCell>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {items.map((item) => (
                      <TableRow key={item.id} hover>
                        <TableCell>
                          <Typography variant="body2" fontWeight="medium">
                            {item.clause?.code || '-'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Tooltip title={item.clause?.description || ''}>
                            <Typography
                              variant="body2"
                              sx={{ maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                            >
                              {item.clause?.title || '-'}
                            </Typography>
                          </Tooltip>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={formatStatus(item.applicability)}
                            size="small"
                            color={getApplicabilityColor(item.applicability)}
                          />
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={formatStatus(item.implementationStatus)}
                            size="small"
                            color={getImplementationColor(item.implementationStatus)}
                          />
                        </TableCell>
                        <TableCell>
                          <Chip label={item.controlsCount || 0} size="small" variant="outlined" />
                        </TableCell>
                        <TableCell>
                          <Chip label={item.evidenceCount || 0} size="small" variant="outlined" />
                        </TableCell>
                        <TableCell>
                          <Box display="flex" gap={0.5}>
                            <Tooltip title="Edit Item">
                              <IconButton size="small" onClick={() => handleEditItem(item)}>
                                <EditIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Link Control">
                              <IconButton size="small" onClick={() => handleOpenLinkControl(item)}>
                                <ControlIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Link Evidence">
                              <IconButton size="small" onClick={() => handleOpenLinkEvidence(item)}>
                                <EvidenceIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </Box>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <TablePagination
                  component="div"
                  count={itemsTotal}
                  page={itemsPage}
                  onPageChange={handleItemsPageChange}
                  rowsPerPage={itemsPageSize}
                  onRowsPerPageChange={handleItemsPageSizeChange}
                  rowsPerPageOptions={[10, 20, 50, 100]}
                />
              </>
            )}
          </CardContent>
        </Card>
      </TabPanel>

      {/* Profile Info Tab */}
      <TabPanel value={tabValue} index={1}>
        <Card>
          <CardContent>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography variant="h6">Profile Information</Typography>
              {!isNew && !editMode && (
                <Button
                  startIcon={<EditIcon />}
                  onClick={() => setEditMode(true)}
                  disabled={profile?.status === 'ARCHIVED'}
                >
                  Edit
                </Button>
              )}
            </Box>
            <Divider sx={{ mb: 3 }} />

            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  disabled={!editMode}
                  required
                />
              </Grid>
              {isNew && (
                <Grid item xs={12} md={6}>
                  <FormControl fullWidth required>
                    <InputLabel>Standard</InputLabel>
                    <Select
                      value={(formData as CreateSoaProfileDto).standardId || ''}
                      label="Standard"
                      onChange={(e) => setFormData({ ...formData, standardId: e.target.value })}
                      disabled={!editMode}
                    >
                      {standards.map((standard) => (
                        <MenuItem key={standard.id} value={standard.id}>
                          {standard.name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
              )}
              {!isNew && (
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Standard"
                    value={standardName}
                    disabled
                  />
                </Grid>
              )}
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  disabled={!editMode}
                  multiline
                  rows={3}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Scope Statement"
                  value={formData.scopeText}
                  onChange={(e) => setFormData({ ...formData, scopeText: e.target.value })}
                  disabled={!editMode}
                  multiline
                  rows={4}
                  helperText="Define the scope of applicability for auditors"
                />
              </Grid>
              {!isNew && profile && (
                <>
                  <Grid item xs={12} md={4}>
                    <TextField
                      fullWidth
                      label="Status"
                      value={formatStatus(profile.status)}
                      disabled
                    />
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <TextField
                      fullWidth
                      label="Version"
                      value={profile.version}
                      disabled
                    />
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <TextField
                      fullWidth
                      label="Published At"
                      value={formatDate(profile.publishedAt)}
                      disabled
                    />
                  </Grid>
                </>
              )}
            </Grid>

            {editMode && (
              <Box display="flex" gap={2} mt={3} justifyContent="flex-end">
                {!isNew && (
                  <Button
                    startIcon={<CancelIcon />}
                    onClick={() => {
                      setEditMode(false);
                      if (profile) {
                        setFormData({
                          name: profile.name,
                          description: profile.description || '',
                          scopeText: profile.scopeText || '',
                        });
                      }
                    }}
                  >
                    Cancel
                  </Button>
                )}
                <Button
                  variant="contained"
                  startIcon={<SaveIcon />}
                  onClick={handleSaveProfile}
                  disabled={saving}
                >
                  {saving ? 'Saving...' : isNew ? 'Create Profile' : 'Save Changes'}
                </Button>
              </Box>
            )}
          </CardContent>
        </Card>
      </TabPanel>

      {/* Edit Item Dialog */}
      <Dialog open={!!editingItem} onClose={() => setEditingItem(null)} maxWidth="sm" fullWidth>
        <DialogTitle>
          Edit SOA Item
          {editingItem?.clause && (
            <Typography variant="body2" color="text.secondary">
              {editingItem.clause.code} - {editingItem.clause.title}
            </Typography>
          )}
        </DialogTitle>
        <DialogContent>
          <Box display="flex" flexDirection="column" gap={2} mt={1}>
            <FormControl fullWidth>
              <InputLabel>Applicability</InputLabel>
              <Select
                value={itemFormData.applicability || ''}
                label="Applicability"
                onChange={(e) => setItemFormData({ ...itemFormData, applicability: e.target.value as SoaApplicability })}
              >
                <MenuItem value="APPLICABLE">Applicable</MenuItem>
                <MenuItem value="NOT_APPLICABLE">Not Applicable</MenuItem>
                <MenuItem value="UNDECIDED">Undecided</MenuItem>
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel>Implementation Status</InputLabel>
              <Select
                value={itemFormData.implementationStatus || ''}
                label="Implementation Status"
                onChange={(e) => setItemFormData({ ...itemFormData, implementationStatus: e.target.value as SoaImplementationStatus })}
              >
                <MenuItem value="IMPLEMENTED">Implemented</MenuItem>
                <MenuItem value="PARTIALLY_IMPLEMENTED">Partially Implemented</MenuItem>
                <MenuItem value="PLANNED">Planned</MenuItem>
                <MenuItem value="NOT_IMPLEMENTED">Not Implemented</MenuItem>
              </Select>
            </FormControl>
            <TextField
              fullWidth
              label="Justification"
              value={itemFormData.justification || ''}
              onChange={(e) => setItemFormData({ ...itemFormData, justification: e.target.value })}
              multiline
              rows={3}
              helperText="Explain why this clause is applicable/not applicable"
            />
            <TextField
              fullWidth
              label="Target Date"
              type="date"
              value={itemFormData.targetDate || ''}
              onChange={(e) => setItemFormData({ ...itemFormData, targetDate: e.target.value })}
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              fullWidth
              label="Notes"
              value={itemFormData.notes || ''}
              onChange={(e) => setItemFormData({ ...itemFormData, notes: e.target.value })}
              multiline
              rows={2}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditingItem(null)}>Cancel</Button>
          <Button variant="contained" onClick={handleSaveItem} disabled={savingItem}>
            {savingItem ? 'Saving...' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Link Control Dialog */}
      <Dialog open={linkControlDialogOpen} onClose={() => setLinkControlDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Link Control</DialogTitle>
        <DialogContent>
          <FormControl fullWidth sx={{ mt: 1 }}>
            <InputLabel>Select Control</InputLabel>
            <Select
              value={selectedControlId}
              label="Select Control"
              onChange={(e) => setSelectedControlId(e.target.value)}
            >
              {availableControls.map((control) => (
                <MenuItem key={control.id} value={control.id}>
                  {control.code ? `${control.code} - ` : ''}{control.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLinkControlDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleLinkControl} disabled={linking || !selectedControlId}>
            {linking ? 'Linking...' : 'Link'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Link Evidence Dialog */}
      <Dialog open={linkEvidenceDialogOpen} onClose={() => setLinkEvidenceDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Link Evidence</DialogTitle>
        <DialogContent>
          <FormControl fullWidth sx={{ mt: 1 }}>
            <InputLabel>Select Evidence</InputLabel>
            <Select
              value={selectedEvidenceId}
              label="Select Evidence"
              onChange={(e) => setSelectedEvidenceId(e.target.value)}
            >
              {availableEvidence.map((evidence) => (
                <MenuItem key={evidence.id} value={evidence.id}>
                  {evidence.title}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLinkEvidenceDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleLinkEvidence} disabled={linking || !selectedEvidenceId}>
            {linking ? 'Linking...' : 'Link'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default SoaProfileDetail;
