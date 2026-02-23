import React, { useState, useEffect, useCallback } from 'react';
import {
  Autocomplete,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Star as StarIcon,
} from '@mui/icons-material';
import {
  itsmApi,
  cmdbApi,
  CmdbCiData,
  ItsmIncidentCiLinkData,
  ItsmIncidentImpactSummary,
} from '../../services/grcClient';
import { useNotification } from '../../contexts/NotificationContext';
import { safeArray } from '../../utils/safeHelpers';

/**
 * Normalizes an ItsmIncidentImpactSummary payload at the boundary.
 * Ensures all array fields (including nested ones) are always arrays,
 * preventing `.length` / `.map` crashes when backend omits fields.
 */
function normalizeImpactSummary(raw: ItsmIncidentImpactSummary): ItsmIncidentImpactSummary {
  return {
    ...raw,
    impactedServices: safeArray(raw.impactedServices),
    impactedOfferings: safeArray(raw.impactedOfferings),
    affectedCis: {
      count: raw.affectedCis?.count ?? 0,
      criticalCount: raw.affectedCis?.criticalCount ?? 0,
      topClasses: safeArray(raw.affectedCis?.topClasses),
    },
  };
}

interface IncidentImpactTabProps {
  incidentId: string;
}

interface ChoiceOption {
  value: string;
  label: string;
}

const RELATIONSHIP_TYPE_OPTIONS: ChoiceOption[] = [
  { value: 'affected_by', label: 'Affected By' },
  { value: 'caused_by', label: 'Caused By' },
  { value: 'related_to', label: 'Related To' },
];

const IMPACT_SCOPE_OPTIONS: ChoiceOption[] = [
  { value: 'service_impacting', label: 'Service Impacting' },
  { value: 'informational', label: 'Informational' },
];

export const IncidentImpactTab: React.FC<IncidentImpactTabProps> = ({ incidentId }) => {
  const { showNotification } = useNotification();

  const [affectedCis, setAffectedCis] = useState<ItsmIncidentCiLinkData[]>([]);
  const [totalCis, setTotalCis] = useState(0);
  const [loadingCis, setLoadingCis] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');

  const [impactSummary, setImpactSummary] = useState<ItsmIncidentImpactSummary | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(true);

  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [ciOptions, setCiOptions] = useState<CmdbCiData[]>([]);
  const [ciSearch, setCiSearch] = useState('');
  const [loadingCiOptions, setLoadingCiOptions] = useState(false);
  const [selectedCi, setSelectedCi] = useState<CmdbCiData | null>(null);
  const [relationshipType, setRelationshipType] = useState('affected_by');
  const [impactScope, setImpactScope] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchAffectedCis = useCallback(async () => {
    setLoadingCis(true);
    try {
      const response = await itsmApi.incidents.listAffectedCis(incidentId, {
        page,
        pageSize: 20,
        search: search || undefined,
      });
      const d = response.data as { data?: { items?: ItsmIncidentCiLinkData[]; total?: number } };
      if (d?.data) {
        setAffectedCis(d.data.items || []);
        setTotalCis(d.data.total || 0);
      }
    } catch (err) {
      const axiosErr = err as { response?: { status?: number } };
      if (axiosErr?.response?.status === 403) {
        showNotification('You do not have permission to view affected CIs', 'error');
      }
      setAffectedCis([]);
    } finally {
      setLoadingCis(false);
    }
  }, [incidentId, page, search, showNotification]);

  const fetchImpactSummary = useCallback(async () => {
    setLoadingSummary(true);
    try {
      const response = await itsmApi.incidents.getImpactSummary(incidentId);
      const d = response.data as { data?: ItsmIncidentImpactSummary } | ItsmIncidentImpactSummary;
      if (d && 'data' in d && d.data) {
        setImpactSummary(normalizeImpactSummary(d.data));
      } else if (d && 'affectedCis' in d) {
        setImpactSummary(normalizeImpactSummary(d as ItsmIncidentImpactSummary));
      }
    } catch {
      setImpactSummary(null);
    } finally {
      setLoadingSummary(false);
    }
  }, [incidentId]);

  useEffect(() => {
    fetchAffectedCis();
  }, [fetchAffectedCis]);

  useEffect(() => {
    fetchImpactSummary();
  }, [fetchImpactSummary]);

  const fetchCiOptions = useCallback(async (q: string) => {
    setLoadingCiOptions(true);
    try {
      const response = await cmdbApi.cis.list({ pageSize: 20, q: q || undefined });
      const d = response.data as { data?: { items?: CmdbCiData[] } };
      if (d?.data?.items) {
        setCiOptions(d.data.items);
      }
    } catch {
      setCiOptions([]);
    } finally {
      setLoadingCiOptions(false);
    }
  }, []);

  useEffect(() => {
    if (addDialogOpen) {
      fetchCiOptions(ciSearch);
    }
  }, [addDialogOpen, ciSearch, fetchCiOptions]);

  const handleAddCi = async () => {
    if (!selectedCi) return;
    setSubmitting(true);
    try {
      await itsmApi.incidents.addAffectedCi(incidentId, {
        ciId: selectedCi.id,
        relationshipType,
        impactScope: impactScope || undefined,
      });
      showNotification('Affected CI added successfully', 'success');
      setAddDialogOpen(false);
      setSelectedCi(null);
      setRelationshipType('affected_by');
      setImpactScope('');
      setCiSearch('');
      fetchAffectedCis();
      fetchImpactSummary();
    } catch (err) {
      const axiosErr = err as { response?: { status?: number; data?: { message?: string } } };
      if (axiosErr?.response?.status === 403) {
        showNotification('You do not have permission to add affected CIs', 'error');
      } else if (axiosErr?.response?.status === 400) {
        showNotification(axiosErr.response.data?.message || 'Invalid request', 'error');
      } else {
        showNotification('Failed to add affected CI', 'error');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemoveCi = async (linkId: string) => {
    try {
      await itsmApi.incidents.removeAffectedCi(incidentId, linkId);
      showNotification('Affected CI removed', 'success');
      fetchAffectedCis();
      fetchImpactSummary();
    } catch (err) {
      const axiosErr = err as { response?: { status?: number } };
      if (axiosErr?.response?.status === 403) {
        showNotification('You do not have permission to remove affected CIs', 'error');
      } else {
        showNotification('Failed to remove affected CI', 'error');
      }
    }
  };

  const getCriticalityColor = (criticality: string | null): 'error' | 'warning' | 'info' | 'default' => {
    switch ((criticality || '').toLowerCase()) {
      case 'critical': return 'error';
      case 'high': return 'warning';
      case 'medium': return 'info';
      default: return 'default';
    }
  };

  const totalPages = Math.ceil(totalCis / 20);

  return (
    <Box sx={{ mt: 3 }} data-testid="incident-impact-tab">
      <Typography variant="h5" fontWeight={600} gutterBottom>
        Impact & Blast Radius
      </Typography>

      {/* Affected CIs Section */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">
              Affected CIs ({totalCis})
            </Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              size="small"
              onClick={() => setAddDialogOpen(true)}
              data-testid="add-affected-ci-btn"
            >
              Add CI
            </Button>
          </Box>

          <TextField
            size="small"
            placeholder="Search affected CIs..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            sx={{ mb: 2, width: '100%', maxWidth: 400 }}
            data-testid="affected-ci-search"
          />

          {loadingCis ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
              <CircularProgress size={32} />
            </Box>
          ) : affectedCis.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ py: 2 }} data-testid="no-affected-cis">
              No affected CIs linked to this incident. Click &quot;Add CI&quot; to link configuration items.
            </Typography>
          ) : (
            <>
              <TableContainer>
                <Table size="small" data-testid="affected-cis-table">
                  <TableHead>
                    <TableRow>
                      <TableCell>CI Name</TableCell>
                      <TableCell>Class</TableCell>
                      <TableCell>Relationship</TableCell>
                      <TableCell>Impact Scope</TableCell>
                      <TableCell align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {affectedCis.map((link) => (
                      <TableRow key={link.id} data-testid="affected-ci-row">
                        <TableCell>{link.ci?.name || link.ciId}</TableCell>
                        <TableCell>{link.ci?.ciClass?.name || '-'}</TableCell>
                        <TableCell>
                          <Chip
                            label={RELATIONSHIP_TYPE_OPTIONS.find((o) => o.value === link.relationshipType)?.label || link.relationshipType}
                            size="small"
                            variant="outlined"
                          />
                        </TableCell>
                        <TableCell>
                          {link.impactScope ? (
                            <Chip
                              label={IMPACT_SCOPE_OPTIONS.find((o) => o.value === link.impactScope)?.label || link.impactScope}
                              size="small"
                              color={link.impactScope === 'service_impacting' ? 'error' : 'default'}
                            />
                          ) : '-'}
                        </TableCell>
                        <TableCell align="right">
                          <IconButton size="small" onClick={() => handleRemoveCi(link.id)} data-testid="remove-affected-ci-btn">
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
              {totalPages > 1 && (
                <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1, mt: 2 }}>
                  <Button size="small" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
                  <Typography variant="body2" sx={{ lineHeight: '30px' }}>Page {page} of {totalPages}</Typography>
                  <Button size="small" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
                </Box>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Impacted Services */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Impacted Services
          </Typography>
          {loadingSummary ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
              <CircularProgress size={32} />
            </Box>
          ) : !impactSummary || impactSummary.impactedServices.length === 0 ? (
            <Typography variant="body2" color="text.secondary" data-testid="no-impacted-services">
              No impacted services detected. Link affected CIs to see derived service impact.
            </Typography>
          ) : (
            <TableContainer>
              <Table size="small" data-testid="impacted-services-table">
                <TableHead>
                  <TableRow>
                    <TableCell>Service</TableCell>
                    <TableCell>Criticality</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Offerings</TableCell>
                    <TableCell>Bound</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {impactSummary.impactedServices.map((svc) => (
                    <TableRow key={svc.serviceId} data-testid="impacted-service-row">
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          {svc.isBoundToIncident && <StarIcon fontSize="small" color="warning" />}
                          {svc.name}
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={svc.criticality || 'N/A'}
                          size="small"
                          color={getCriticalityColor(svc.criticality)}
                        />
                      </TableCell>
                      <TableCell>{svc.status}</TableCell>
                      <TableCell>{svc.offeringsCount}</TableCell>
                      <TableCell>
                        {svc.isBoundToIncident && (
                          <Chip label="Bound" size="small" color="primary" variant="outlined" />
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      {/* Impacted Offerings */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Impacted Offerings
          </Typography>
          {loadingSummary ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
              <CircularProgress size={32} />
            </Box>
          ) : !impactSummary || impactSummary.impactedOfferings.length === 0 ? (
            <Typography variant="body2" color="text.secondary" data-testid="no-impacted-offerings">
              Offerings will appear when mapped or inferred from impacted services.
            </Typography>
          ) : (
            <TableContainer>
              <Table size="small" data-testid="impacted-offerings-table">
                <TableHead>
                  <TableRow>
                    <TableCell>Offering</TableCell>
                    <TableCell>Service</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Source</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {impactSummary.impactedOfferings.map((off) => (
                    <TableRow key={off.offeringId} data-testid="impacted-offering-row">
                      <TableCell>{off.name}</TableCell>
                      <TableCell>{off.serviceName}</TableCell>
                      <TableCell>{off.status}</TableCell>
                      <TableCell>
                        <Chip
                          label={off.isInferred ? 'Inferred' : 'Direct'}
                          size="small"
                          variant="outlined"
                          color={off.isInferred ? 'default' : 'primary'}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      {/* Summary Stats */}
      {impactSummary && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Blast Radius Summary
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <Box sx={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              <Box>
                <Typography variant="h4" fontWeight={700}>{impactSummary.affectedCis.count}</Typography>
                <Typography variant="body2" color="text.secondary">Affected CIs</Typography>
              </Box>
              <Box>
                <Typography variant="h4" fontWeight={700} color="error.main">{impactSummary.affectedCis.criticalCount}</Typography>
                <Typography variant="body2" color="text.secondary">Service Impacting</Typography>
              </Box>
              <Box>
                <Typography variant="h4" fontWeight={700}>{impactSummary.impactedServices.length}</Typography>
                <Typography variant="body2" color="text.secondary">Impacted Services</Typography>
              </Box>
              <Box>
                <Typography variant="h4" fontWeight={700}>{impactSummary.impactedOfferings.length}</Typography>
                <Typography variant="body2" color="text.secondary">Impacted Offerings</Typography>
              </Box>
            </Box>
            {impactSummary.affectedCis.topClasses.length > 0 && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="subtitle2" gutterBottom>Top CI Classes</Typography>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  {impactSummary.affectedCis.topClasses.map((cls) => (
                    <Chip key={cls.className} label={`${cls.className} (${cls.count})`} size="small" />
                  ))}
                </Box>
              </Box>
            )}
          </CardContent>
        </Card>
      )}

      {/* Add Affected CI Dialog */}
      <Dialog
        open={addDialogOpen}
        onClose={() => setAddDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        data-testid="add-affected-ci-dialog"
      >
        <DialogTitle>Add Affected CI</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <Autocomplete
              options={ciOptions}
              getOptionLabel={(option) => `${option.name}${option.ciClass ? ` (${option.ciClass.name})` : ''}`}
              value={selectedCi}
              onChange={(_, newVal) => setSelectedCi(newVal)}
              inputValue={ciSearch}
              onInputChange={(_, newInput) => setCiSearch(newInput)}
              loading={loadingCiOptions}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Search Configuration Items"
                  placeholder="Type to search CIs..."
                  data-testid="ci-autocomplete"
                />
              )}
              isOptionEqualToValue={(option, value) => option.id === value.id}
              noOptionsText="No CIs found"
            />

            <FormControl fullWidth>
              <InputLabel>Relationship Type</InputLabel>
              <Select
                value={relationshipType}
                label="Relationship Type"
                onChange={(e) => setRelationshipType(e.target.value)}
                data-testid="relationship-type-select"
              >
                {RELATIONSHIP_TYPE_OPTIONS.map((opt) => (
                  <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel>Impact Scope (Optional)</InputLabel>
              <Select
                value={impactScope}
                label="Impact Scope (Optional)"
                onChange={(e) => setImpactScope(e.target.value)}
                data-testid="impact-scope-select"
              >
                <MenuItem value=""><em>None</em></MenuItem>
                {IMPACT_SCOPE_OPTIONS.map((opt) => (
                  <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleAddCi}
            disabled={!selectedCi || submitting}
            data-testid="confirm-add-ci-btn"
          >
            {submitting ? 'Adding...' : 'Add'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default IncidentImpactTab;
