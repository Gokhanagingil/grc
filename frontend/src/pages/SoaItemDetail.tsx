import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Chip,
  Alert,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
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
  Divider,
  Snackbar,
} from '@mui/material';
import {
  PlaylistAddCheck as SoaIcon,
  ArrowBack as BackIcon,
  Edit as EditIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
  Security as ControlIcon,
  Description as EvidenceIcon,
  Link as LinkIcon,
  BugReport as IssueIcon,
  Build as CapaIcon,
  OpenInNew as ViewIcon,
  CircularProgress,
} from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';
import {
  soaApi,
  SoaItemData,
  SoaApplicability,
  SoaImplementationStatus,
  UpdateSoaItemDto,
  controlApi,
  evidenceApi,
  unwrapPaginatedResponse,
  IssueData,
  CapaData,
} from '../services/grcClient';
import { useAuth } from '../contexts/AuthContext';
import { LoadingState, ErrorState } from '../components/common';

interface ControlOption {
  id: string;
  name: string;
  code: string | null;
}

interface EvidenceOption {
  id: string;
  name: string;
  code?: string | null;
  type?: string;
}

const getApplicabilityColor = (applicability: string): 'success' | 'error' | 'warning' | 'default' => {
  switch (applicability) {
    case 'APPLICABLE': return 'success';
    case 'NOT_APPLICABLE': return 'error';
    case 'UNDECIDED': return 'warning';
    default: return 'default';
  }
};

const getImplementationColor = (status: string): 'success' | 'warning' | 'info' | 'error' | 'default' => {
  switch (status) {
    case 'IMPLEMENTED': return 'success';
    case 'PARTIALLY_IMPLEMENTED': return 'warning';
    case 'PLANNED': return 'info';
    case 'NOT_IMPLEMENTED': return 'error';
    default: return 'default';
  }
};

const formatStatus = (status: string): string => {
  return status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
};

const formatDate = (dateString: string | null | undefined): string => {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleDateString();
};

export const SoaItemDetail: React.FC = () => {
  const { itemId, profileId } = useParams<{ itemId: string; profileId?: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const tenantId = user?.tenantId || '';

  const [item, setItem] = useState<SoaItemData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState<UpdateSoaItemDto>({});
  const [saving, setSaving] = useState(false);

  const [availableControls, setAvailableControls] = useState<ControlOption[]>([]);
  const [availableEvidence, setAvailableEvidence] = useState<EvidenceOption[]>([]);

  const [linkControlDialogOpen, setLinkControlDialogOpen] = useState(false);
  const [linkEvidenceDialogOpen, setLinkEvidenceDialogOpen] = useState(false);
  const [selectedControlId, setSelectedControlId] = useState('');
  const [selectedEvidenceId, setSelectedEvidenceId] = useState('');
  const [linking, setLinking] = useState(false);

  const [linkedIssues, setLinkedIssues] = useState<IssueData[]>([]);
  const [linkedIssuesTotal, setLinkedIssuesTotal] = useState(0);
  const [linkedIssuesLoading, setLinkedIssuesLoading] = useState(false);

  const [linkedCapas, setLinkedCapas] = useState<CapaData[]>([]);
  const [linkedCapasTotal, setLinkedCapasTotal] = useState(0);
  const [linkedCapasLoading, setLinkedCapasLoading] = useState(false);

  const [creatingIssue, setCreatingIssue] = useState(false);
  const [creatingCapa, setCreatingCapa] = useState(false);

  const fetchItem = useCallback(async () => {
    if (!itemId || !tenantId) return;

    setLoading(true);
    setError(null);

    try {
      const data = await soaApi.getItem(tenantId, itemId);
      setItem(data);
      setFormData({
        applicability: data.applicability,
        implementationStatus: data.implementationStatus,
        justification: data.justification || '',
        targetDate: data.targetDate || '',
        notes: data.notes || '',
      });
    } catch (err) {
      console.error('Error fetching SOA item:', err);
      setError('Failed to load SOA item. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [itemId, tenantId]);

  const fetchControls = useCallback(async () => {
    if (!tenantId) return;

    try {
      const response = await controlApi.list(tenantId, { pageSize: 100 });
      const { items } = unwrapPaginatedResponse<{ id: string; name: string; code: string }>(response);
      setAvailableControls((items || []).map(c => ({ id: c.id, name: c.name, code: c.code })));
    } catch (err) {
      console.error('Error fetching controls:', err);
    }
  }, [tenantId]);

  const fetchEvidence = useCallback(async () => {
    if (!tenantId) return;

    try {
      const response = await evidenceApi.list(tenantId, { pageSize: 100 });
      const { items } = unwrapPaginatedResponse<{ id: string; name: string; code?: string; type?: string }>(response);
      setAvailableEvidence((items || []).map(e => ({ 
        id: e.id, 
        name: e.name || e.id,
        code: e.code,
        type: e.type
      })));
    } catch (err) {
      console.error('Error fetching evidence:', err);
    }
  }, [tenantId]);

  const fetchLinkedIssues = useCallback(async () => {
    if (!itemId || !tenantId) return;

    setLinkedIssuesLoading(true);
    try {
      const result = await soaApi.listLinkedIssues(tenantId, itemId, 1, 5);
      setLinkedIssues(result.items || []);
      setLinkedIssuesTotal(result.total || 0);
    } catch (err) {
      console.error('Error fetching linked issues:', err);
    } finally {
      setLinkedIssuesLoading(false);
    }
  }, [itemId, tenantId]);

  const fetchLinkedCapas = useCallback(async () => {
    if (!itemId || !tenantId) return;

    setLinkedCapasLoading(true);
    try {
      const result = await soaApi.listLinkedCapas(tenantId, itemId, 1, 5);
      setLinkedCapas(result.items || []);
      setLinkedCapasTotal(result.total || 0);
    } catch (err) {
      console.error('Error fetching linked CAPAs:', err);
    } finally {
      setLinkedCapasLoading(false);
    }
  }, [itemId, tenantId]);

  useEffect(() => {
    fetchItem();
    fetchControls();
    fetchEvidence();
    fetchLinkedIssues();
    fetchLinkedCapas();
  }, [fetchItem, fetchControls, fetchEvidence, fetchLinkedIssues, fetchLinkedCapas]);

  const handleSave = async () => {
    if (!itemId || !tenantId) return;

    setSaving(true);
    setError(null);

    try {
      const updated = await soaApi.updateItem(tenantId, itemId, formData);
      setItem(updated);
      setEditMode(false);
      setSuccess('SOA item updated successfully');
    } catch (err) {
      console.error('Error saving SOA item:', err);
      setError('Failed to save SOA item. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleLinkControl = async () => {
    if (!itemId || !selectedControlId || !tenantId) return;

    setLinking(true);
    try {
      await soaApi.linkControl(tenantId, itemId, selectedControlId);
      setSuccess('Control linked successfully');
      setLinkControlDialogOpen(false);
      setSelectedControlId('');
      fetchItem();
    } catch (err) {
      console.error('Error linking control:', err);
      setError('Failed to link control. Please try again.');
    } finally {
      setLinking(false);
    }
  };

  const handleLinkEvidence = async () => {
    if (!itemId || !selectedEvidenceId || !tenantId) return;

    setLinking(true);
    try {
      await soaApi.linkEvidence(tenantId, itemId, selectedEvidenceId);
      setSuccess('Evidence linked successfully');
      setLinkEvidenceDialogOpen(false);
      setSelectedEvidenceId('');
      fetchItem();
    } catch (err) {
      console.error('Error linking evidence:', err);
      setError('Failed to link evidence. Please try again.');
    } finally {
      setLinking(false);
    }
  };

  const handleBack = () => {
    if (profileId) {
      navigate(`/soa/${profileId}`);
    } else if (item?.profileId) {
      navigate(`/soa/${item.profileId}`);
    } else {
      navigate('/soa');
    }
  };

  const handleCreateIssue = async () => {
    if (!itemId || !tenantId) return;

    setCreatingIssue(true);
    try {
      const issue = await soaApi.createIssueFromItem(tenantId, itemId, {});
      setSuccess('Issue created successfully');
      fetchLinkedIssues();
      navigate(`/issues/${issue.id}`);
    } catch (err) {
      console.error('Error creating issue:', err);
      setError('Failed to create issue. Please try again.');
    } finally {
      setCreatingIssue(false);
    }
  };

  const handleCreateCapa = async () => {
    if (!itemId || !tenantId) return;

    setCreatingCapa(true);
    try {
      const clauseCode = item?.clause?.code || 'Unknown';
      const clauseName = item?.clause?.title || 'Unknown Clause';
      const capa = await soaApi.createCapaFromItem(tenantId, itemId, {
        title: `CAPA for SOA Gap: ${clauseCode} - ${clauseName}`,
      });
      setSuccess('CAPA created successfully');
      fetchLinkedCapas();
      navigate(`/capas/${capa.id}`);
    } catch (err) {
      console.error('Error creating CAPA:', err);
      setError('Failed to create CAPA. Please try again.');
    } finally {
      setCreatingCapa(false);
    }
  };

  const getIssueStatusColor = (status: string): 'success' | 'warning' | 'error' | 'info' | 'default' => {
    switch (status?.toUpperCase()) {
      case 'CLOSED': return 'success';
      case 'RESOLVED': return 'info';
      case 'IN_PROGRESS': return 'warning';
      case 'OPEN': return 'error';
      default: return 'default';
    }
  };

  const getCapaStatusColor = (status: string): 'success' | 'warning' | 'error' | 'info' | 'default' => {
    switch (status?.toUpperCase()) {
      case 'COMPLETED': return 'success';
      case 'VERIFIED': return 'success';
      case 'IN_PROGRESS': return 'warning';
      case 'PLANNED': return 'info';
      case 'CANCELLED': return 'error';
      default: return 'default';
    }
  };

  if (loading) {
    return <LoadingState message="Loading SOA item..." />;
  }

  if (error && !item) {
    return <ErrorState message={error} onRetry={fetchItem} />;
  }

  return (
    <Box sx={{ p: 3 }}>
      <Snackbar
        open={!!success}
        autoHideDuration={3000}
        onClose={() => setSuccess(null)}
        message={success}
      />

      <Box display="flex" alignItems="center" mb={3}>
        <IconButton onClick={handleBack} sx={{ mr: 2 }}>
          <BackIcon />
        </IconButton>
        <SoaIcon sx={{ fontSize: 32, mr: 2, color: 'primary.main' }} />
        <Box flex={1}>
          <Typography variant="h4" component="h1">
            {item?.clause?.code || 'SOA Item'}
          </Typography>
          <Typography variant="body1" color="text.secondary">
            {item?.clause?.title || '-'}
          </Typography>
        </Box>
        {!editMode ? (
          <Button
            variant="outlined"
            startIcon={<EditIcon />}
            onClick={() => setEditMode(true)}
          >
            Edit
          </Button>
        ) : (
          <Box display="flex" gap={1}>
            <Button
              variant="outlined"
              startIcon={<CancelIcon />}
              onClick={() => {
                setEditMode(false);
                if (item) {
                  setFormData({
                    applicability: item.applicability,
                    implementationStatus: item.implementationStatus,
                    justification: item.justification || '',
                    targetDate: item.targetDate || '',
                    notes: item.notes || '',
                  });
                }
              }}
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              startIcon={<SaveIcon />}
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </Box>
        )}
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Item Details
              </Typography>
              <Divider sx={{ mb: 2 }} />

              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Clause Code
                  </Typography>
                  <Typography variant="body1">
                    {item?.clause?.code || '-'}
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Clause Title
                  </Typography>
                  <Typography variant="body1">
                    {item?.clause?.title || '-'}
                  </Typography>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Description
                  </Typography>
                  <Typography variant="body1">
                    {item?.clause?.description || '-'}
                  </Typography>
                </Grid>

                <Grid item xs={12}>
                  <Divider sx={{ my: 1 }} />
                </Grid>

                <Grid item xs={12} sm={6}>
                  {editMode ? (
                    <FormControl fullWidth size="small">
                      <InputLabel>Applicability</InputLabel>
                      <Select
                        value={formData.applicability || ''}
                        label="Applicability"
                        onChange={(e) => setFormData({ ...formData, applicability: e.target.value as SoaApplicability })}
                      >
                        <MenuItem value="APPLICABLE">Applicable</MenuItem>
                        <MenuItem value="NOT_APPLICABLE">Not Applicable</MenuItem>
                        <MenuItem value="UNDECIDED">Undecided</MenuItem>
                      </Select>
                    </FormControl>
                  ) : (
                    <>
                      <Typography variant="subtitle2" color="text.secondary">
                        Applicability
                      </Typography>
                      <Chip
                        label={formatStatus(item?.applicability || '')}
                        size="small"
                        color={getApplicabilityColor(item?.applicability || '')}
                      />
                    </>
                  )}
                </Grid>
                <Grid item xs={12} sm={6}>
                  {editMode ? (
                    <FormControl fullWidth size="small">
                      <InputLabel>Implementation Status</InputLabel>
                      <Select
                        value={formData.implementationStatus || ''}
                        label="Implementation Status"
                        onChange={(e) => setFormData({ ...formData, implementationStatus: e.target.value as SoaImplementationStatus })}
                      >
                        <MenuItem value="IMPLEMENTED">Implemented</MenuItem>
                        <MenuItem value="PARTIALLY_IMPLEMENTED">Partially Implemented</MenuItem>
                        <MenuItem value="PLANNED">Planned</MenuItem>
                        <MenuItem value="NOT_IMPLEMENTED">Not Implemented</MenuItem>
                      </Select>
                    </FormControl>
                  ) : (
                    <>
                      <Typography variant="subtitle2" color="text.secondary">
                        Implementation Status
                      </Typography>
                      <Chip
                        label={formatStatus(item?.implementationStatus || '')}
                        size="small"
                        color={getImplementationColor(item?.implementationStatus || '')}
                      />
                    </>
                  )}
                </Grid>

                <Grid item xs={12}>
                  {editMode ? (
                    <TextField
                      fullWidth
                      size="small"
                      label="Justification"
                      value={formData.justification || ''}
                      onChange={(e) => setFormData({ ...formData, justification: e.target.value })}
                      multiline
                      rows={3}
                      helperText="Explain why this clause is applicable/not applicable"
                    />
                  ) : (
                    <>
                      <Typography variant="subtitle2" color="text.secondary">
                        Justification
                      </Typography>
                      <Typography variant="body1">
                        {item?.justification || '-'}
                      </Typography>
                    </>
                  )}
                </Grid>

                <Grid item xs={12} sm={6}>
                  {editMode ? (
                    <TextField
                      fullWidth
                      size="small"
                      label="Target Date"
                      type="date"
                      value={formData.targetDate || ''}
                      onChange={(e) => setFormData({ ...formData, targetDate: e.target.value })}
                      InputLabelProps={{ shrink: true }}
                    />
                  ) : (
                    <>
                      <Typography variant="subtitle2" color="text.secondary">
                        Target Date
                      </Typography>
                      <Typography variant="body1">
                        {formatDate(item?.targetDate)}
                      </Typography>
                    </>
                  )}
                </Grid>

                <Grid item xs={12}>
                  {editMode ? (
                    <TextField
                      fullWidth
                      size="small"
                      label="Notes"
                      value={formData.notes || ''}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      multiline
                      rows={2}
                    />
                  ) : (
                    <>
                      <Typography variant="subtitle2" color="text.secondary">
                        Notes
                      </Typography>
                      <Typography variant="body1">
                        {item?.notes || '-'}
                      </Typography>
                    </>
                  )}
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="subtitle2" color="text.secondary">
                Created
              </Typography>
              <Typography variant="body2" gutterBottom>
                {formatDate(item?.createdAt)}
              </Typography>
              <Typography variant="subtitle2" color="text.secondary">
                Last Updated
              </Typography>
              <Typography variant="body2">
                {formatDate(item?.updatedAt)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6">
                  <ControlIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                  Linked Controls
                </Typography>
                <Button
                  size="small"
                  startIcon={<LinkIcon />}
                  onClick={() => setLinkControlDialogOpen(true)}
                >
                  Link Control
                </Button>
              </Box>
              {item?.controlsCount === 0 ? (
                <Alert severity="info">No controls linked to this item.</Alert>
              ) : (
                <Paper variant="outlined">
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Code</TableCell>
                        <TableCell>Name</TableCell>
                        <TableCell align="right">Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      <TableRow>
                        <TableCell colSpan={3}>
                          <Typography variant="body2" color="text.secondary" align="center">
                            {item?.controlsCount || 0} control(s) linked
                          </Typography>
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </Paper>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6">
                  <EvidenceIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                  Linked Evidence
                </Typography>
                <Button
                  size="small"
                  startIcon={<LinkIcon />}
                  onClick={() => setLinkEvidenceDialogOpen(true)}
                >
                  Link Evidence
                </Button>
              </Box>
              {item?.evidenceCount === 0 ? (
                <Alert severity="info">No evidence linked to this item.</Alert>
              ) : (
                <Paper variant="outlined">
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Code</TableCell>
                        <TableCell>Name</TableCell>
                        <TableCell align="right">Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      <TableRow>
                        <TableCell colSpan={3}>
                          <Typography variant="body2" color="text.secondary" align="center">
                            {item?.evidenceCount || 0} evidence item(s) linked
                          </Typography>
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </Paper>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Linked Issues Section */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6">
                  <IssueIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                  Linked Issues ({linkedIssuesTotal})
                </Typography>
                <Button
                  size="small"
                  variant="contained"
                  color="primary"
                  onClick={handleCreateIssue}
                  disabled={creatingIssue}
                  startIcon={creatingIssue ? <CircularProgress size={16} /> : undefined}
                >
                  {creatingIssue ? 'Creating...' : 'Create Issue'}
                </Button>
              </Box>
              {linkedIssuesLoading ? (
                <Box display="flex" justifyContent="center" p={2}>
                  <CircularProgress size={24} />
                </Box>
              ) : linkedIssues.length === 0 ? (
                <Alert severity="info">No issues created from this SOA item yet.</Alert>
              ) : (
                <>
                  <Paper variant="outlined">
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Code</TableCell>
                          <TableCell>Title</TableCell>
                          <TableCell>Status</TableCell>
                          <TableCell align="right">Actions</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {linkedIssues.map((issue) => (
                          <TableRow key={issue.id}>
                            <TableCell>{issue.code || '-'}</TableCell>
                            <TableCell sx={{ maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {issue.title || '-'}
                            </TableCell>
                            <TableCell>
                              <Chip
                                label={formatStatus(issue.status || '')}
                                size="small"
                                color={getIssueStatusColor(issue.status || '')}
                              />
                            </TableCell>
                            <TableCell align="right">
                              <IconButton
                                size="small"
                                onClick={() => navigate(`/issues/${issue.id}`)}
                                title="View Issue"
                              >
                                <ViewIcon fontSize="small" />
                              </IconButton>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </Paper>
                  {linkedIssuesTotal > 5 && (
                    <Box display="flex" justifyContent="center" mt={1}>
                      <Button size="small" onClick={() => navigate(`/issues?sourceType=SOA_ITEM&sourceId=${itemId}`)}>
                        View all {linkedIssuesTotal} issues
                      </Button>
                    </Box>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Linked CAPAs Section */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6">
                  <CapaIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                  Linked CAPAs ({linkedCapasTotal})
                </Typography>
                <Button
                  size="small"
                  variant="contained"
                  color="secondary"
                  onClick={handleCreateCapa}
                  disabled={creatingCapa}
                  startIcon={creatingCapa ? <CircularProgress size={16} /> : undefined}
                >
                  {creatingCapa ? 'Creating...' : 'Create CAPA'}
                </Button>
              </Box>
              {linkedCapasLoading ? (
                <Box display="flex" justifyContent="center" p={2}>
                  <CircularProgress size={24} />
                </Box>
              ) : linkedCapas.length === 0 ? (
                <Alert severity="info">No CAPAs created from this SOA item yet.</Alert>
              ) : (
                <>
                  <Paper variant="outlined">
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Code</TableCell>
                          <TableCell>Title</TableCell>
                          <TableCell>Status</TableCell>
                          <TableCell align="right">Actions</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {linkedCapas.map((capa) => (
                          <TableRow key={capa.id}>
                            <TableCell>{capa.code || '-'}</TableCell>
                            <TableCell sx={{ maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {capa.title || '-'}
                            </TableCell>
                            <TableCell>
                              <Chip
                                label={formatStatus(capa.status || '')}
                                size="small"
                                color={getCapaStatusColor(capa.status || '')}
                              />
                            </TableCell>
                            <TableCell align="right">
                              <IconButton
                                size="small"
                                onClick={() => navigate(`/capas/${capa.id}`)}
                                title="View CAPA"
                              >
                                <ViewIcon fontSize="small" />
                              </IconButton>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </Paper>
                  {linkedCapasTotal > 5 && (
                    <Box display="flex" justifyContent="center" mt={1}>
                      <Button size="small" onClick={() => navigate(`/capas?sourceType=SOA_ITEM&sourceId=${itemId}`)}>
                        View all {linkedCapasTotal} CAPAs
                      </Button>
                    </Box>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Next Actions Section */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Next Actions
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <Box display="flex" gap={2} flexWrap="wrap">
                <Button
                  variant="outlined"
                  color="primary"
                  onClick={handleCreateIssue}
                  disabled={creatingIssue}
                >
                  {creatingIssue ? 'Creating Issue...' : 'Create Issue'}
                </Button>
                <Button
                  variant="outlined"
                  color="secondary"
                  onClick={handleCreateCapa}
                  disabled={creatingCapa}
                >
                  {creatingCapa ? 'Creating CAPA...' : 'Create CAPA'}
                </Button>
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                Create an Issue to track problems or non-conformities related to this SOA item. 
                Create a CAPA (Corrective and Preventive Action) to document remediation steps.
                Issues and CAPAs created here will automatically track their origin from this SOA item.
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

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
                  {evidence.code ? `${evidence.code} - ` : ''}{evidence.name}{evidence.type ? ` (${evidence.type})` : ''}
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

export default SoaItemDetail;
