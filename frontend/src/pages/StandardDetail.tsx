import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Grid,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  CircularProgress,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Paper,
  Tabs,
  Tab,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  Add as AddIcon,
  Policy as PolicyIcon,
  Warning as RiskIcon,
  BugReport as FindingIcon,
  Assignment as AuditIcon,
  Label as TagIcon,
  ListAlt as RequirementsIcon,
} from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';
import { standardsLibraryApi, standardsApi, platformMetadataApi, unwrapResponse } from '../services/grcClient';
import { LoadingState, ErrorState } from '../components/common';
import { RecordPicker, RecordPickerOption, RecordPickerEntityType } from '../components/RecordPicker';

interface StandardRequirement {
  id: string;
  code: string;
  title: string;
  description: string;
  description_long: string;
  family: string;
  version: string;
  hierarchy_level: string;
  domain: string;
  category: string;
  regulation: string;
  status: string;
}

interface MappedPolicy {
  id: string;
  title: string;
  status: string;
  justification?: string;
}

interface MappedRisk {
  id: string;
  title: string;
  severity: string;
  status: string;
}

interface MappedFinding {
  id: string;
  title: string;
  severity: string;
  status: string;
  evidence_strength?: string;
}

interface MappedAudit {
  id: string;
  title: string;
  status: string;
}

interface StandardClause {
  id: string;
  code: string;
  title: string;
  description: string | null;
  level: number;
  sortOrder: number;
  isAuditable: boolean;
}

interface MetadataValue {
  id: string;
  value: string;
  color: string;
  type_name: string;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div role="tabpanel" hidden={value !== index} {...other}>
      {value === index && <Box sx={{ p: 2 }}>{children}</Box>}
    </div>
  );
}

const FAMILY_LABELS: Record<string, string> = {
  iso27001: 'ISO 27001',
  iso27002: 'ISO 27002',
  iso20000: 'ISO 20000',
  iso9001: 'ISO 9001',
  cobit2019: 'COBIT 2019',
  nistcsf: 'NIST CSF',
  kvkk: 'KVKK',
  gdpr: 'GDPR',
};

export const StandardDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const [standard, setStandard] = useState<StandardRequirement | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tabValue, setTabValue] = useState(0);
  
  const [policies, setPolicies] = useState<MappedPolicy[]>([]);
  const [risks, setRisks] = useState<MappedRisk[]>([]);
  const [findings, setFindings] = useState<MappedFinding[]>([]);
  const [audits, setAudits] = useState<MappedAudit[]>([]);
  const [metadata, setMetadata] = useState<MetadataValue[]>([]);
  
  const [clauses, setClauses] = useState<StandardClause[]>([]);
  const [clausesLoading, setClausesLoading] = useState(false);
  
  const [mappingsLoading, setMappingsLoading] = useState(false);
  const [openMapDialog, setOpenMapDialog] = useState(false);
  const [mapType, setMapType] = useState<'policy' | 'risk' | 'finding' | 'audit'>('policy');
  const [mapTargetId, setMapTargetId] = useState('');
  const [selectedRecord, setSelectedRecord] = useState<RecordPickerOption | null>(null);
  const [mapJustification, setMapJustification] = useState('');
  const [mapEvidenceStrength, setMapEvidenceStrength] = useState('medium');
  const [mapError, setMapError] = useState('');

  const fetchStandard = useCallback(async () => {
    if (!id) return;
    
    try {
      setLoading(true);
      setError('');
      
      const response = await standardsLibraryApi.get(id);
      const data = response.data;
      
      if (data && data.success) {
        setStandard(data.data);
      } else {
        setStandard(data);
      }
    } catch (err: unknown) {
      const error = err as { response?: { status?: number; data?: { message?: string } } };
      setError(error.response?.data?.message || 'Failed to fetch standard details');
    } finally {
      setLoading(false);
    }
  }, [id]);

  const fetchMappings = useCallback(async () => {
    if (!id) return;
    
    setMappingsLoading(true);
    
    try {
      const [policiesRes, risksRes, findingsRes, auditsRes, metadataRes] = await Promise.all([
        standardsApi.getPolicies(id).catch(() => ({ data: { data: [] } })),
        standardsApi.getRisks(id).catch(() => ({ data: { data: [] } })),
        standardsApi.getFindings(id).catch(() => ({ data: { data: [] } })),
        standardsApi.getAudits(id).catch(() => ({ data: { data: [] } })),
        platformMetadataApi.getAssignedMetadata('requirement', id).catch(() => ({ data: { data: [] } })),
      ]);
      
      setPolicies(policiesRes.data?.data || policiesRes.data || []);
      setRisks(risksRes.data?.data || risksRes.data || []);
      setFindings(findingsRes.data?.data || findingsRes.data || []);
      setAudits(auditsRes.data?.data || auditsRes.data || []);
      setMetadata(metadataRes.data?.data || metadataRes.data || []);
    } catch (err) {
      console.error('Failed to fetch mappings:', err);
    } finally {
      setMappingsLoading(false);
    }
  }, [id]);

  const fetchClauses = useCallback(async () => {
    if (!id) return;
    
    setClausesLoading(true);
    
    try {
      const response = await standardsLibraryApi.getClauses(id);
      const data = unwrapResponse<StandardClause[]>(response);
      setClauses(data || []);
    } catch (err) {
      console.error('Failed to fetch clauses:', err);
      setClauses([]);
    } finally {
      setClausesLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchStandard();
    fetchMappings();
    fetchClauses();
  }, [fetchStandard, fetchMappings, fetchClauses]);

  const handleOpenMapDialog = (type: 'policy' | 'risk' | 'finding' | 'audit') => {
    setMapType(type);
    setMapTargetId('');
    setSelectedRecord(null);
    setMapJustification('');
    setMapEvidenceStrength('medium');
    setMapError('');
    setOpenMapDialog(true);
  };

  const handleRecordSelect = (recordId: string | null, record: RecordPickerOption | null) => {
    setMapTargetId(recordId || '');
    setSelectedRecord(record);
  };

  const getPickerEntityType = (): RecordPickerEntityType => {
    if (mapType === 'finding') return 'issue';
    return mapType;
  };

  const handleCreateMapping = async () => {
    if (!id || !mapTargetId) {
      setMapError('Please enter a target ID');
      return;
    }
    
    try {
      setMapError('');
      
      switch (mapType) {
        case 'policy':
          await standardsApi.mapPolicy(id, mapTargetId, mapJustification || undefined);
          break;
        case 'risk':
          await standardsApi.mapRisk(id, mapTargetId);
          break;
        case 'finding':
          await standardsApi.mapFinding(id, mapTargetId, mapEvidenceStrength);
          break;
        case 'audit':
          await standardsApi.mapAudit(id, mapTargetId);
          break;
      }
      
      setOpenMapDialog(false);
      fetchMappings();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      setMapError(error.response?.data?.message || 'Failed to create mapping');
    }
  };

  if (loading) {
    return <LoadingState message="Loading standard details..." />;
  }

  if (error || !standard) {
    return (
      <ErrorState
        title="Failed to load standard"
        message={error || 'Standard not found'}
        onRetry={fetchStandard}
      />
    );
  }

  return (
    <Box>
      <Box display="flex" alignItems="center" mb={3}>
        <IconButton onClick={() => navigate('/standards')} sx={{ mr: 2 }}>
          <BackIcon />
        </IconButton>
        <Box flex={1}>
          <Typography variant="h4">{standard.code}</Typography>
          <Typography variant="subtitle1" color="textSecondary">
            {standard.title}
          </Typography>
        </Box>
        <Chip
          label={FAMILY_LABELS[standard.family] || standard.family}
          color="primary"
          sx={{ mr: 1 }}
        />
        <Chip label={`v${standard.version}`} variant="outlined" />
      </Box>

      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>Description</Typography>
              <Typography variant="body1" paragraph>
                {standard.description}
              </Typography>
              
              {standard.description_long && (
                <>
                  <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
                    Detailed Description
                  </Typography>
                  <Typography variant="body2" color="textSecondary" sx={{ whiteSpace: 'pre-wrap' }}>
                    {standard.description_long}
                  </Typography>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Mappings</Typography>
              
              <Paper variant="outlined">
                <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)}>
                  <Tab label={`Requirements (${clauses.length})`} icon={<RequirementsIcon />} iconPosition="start" />
                  <Tab label={`Policies (${policies.length})`} icon={<PolicyIcon />} iconPosition="start" />
                  <Tab label={`Risks (${risks.length})`} icon={<RiskIcon />} iconPosition="start" />
                  <Tab label={`Findings (${findings.length})`} icon={<FindingIcon />} iconPosition="start" />
                  <Tab label={`Audits (${audits.length})`} icon={<AuditIcon />} iconPosition="start" />
                </Tabs>

                {(mappingsLoading || clausesLoading) ? (
                  <Box display="flex" justifyContent="center" py={4}>
                    <CircularProgress />
                  </Box>
                ) : (
                  <>
                    <TabPanel value={tabValue} index={0}>
                      {clauses.length === 0 ? (
                        <Typography color="textSecondary" align="center" py={2}>
                          No requirements/clauses found for this standard
                        </Typography>
                      ) : (
                        <List dense>
                          {clauses.map((clause) => (
                            <ListItem 
                              key={clause.id}
                              sx={{ 
                                pl: clause.level * 2,
                                cursor: 'pointer',
                                '&:hover': { backgroundColor: 'action.hover' },
                              }}
                              onClick={() => navigate(`/standards/clauses/${clause.id}`)}
                            >
                              <ListItemText
                                primary={
                                  <Box display="flex" alignItems="center" gap={1}>
                                    <Chip label={clause.code} size="small" variant="outlined" />
                                    <Typography variant="body2">{clause.title}</Typography>
                                  </Box>
                                }
                                secondary={clause.description}
                              />
                              <ListItemSecondaryAction>
                                {clause.isAuditable && (
                                  <Chip label="Auditable" size="small" color="primary" variant="outlined" />
                                )}
                              </ListItemSecondaryAction>
                            </ListItem>
                          ))}
                        </List>
                      )}
                    </TabPanel>

                    <TabPanel value={tabValue} index={1}>
                      <Box display="flex" justifyContent="flex-end" mb={2}>
                        <Button
                          size="small"
                          startIcon={<AddIcon />}
                          onClick={() => handleOpenMapDialog('policy')}
                        >
                          Map Policy
                        </Button>
                      </Box>
                      {policies.length === 0 ? (
                        <Typography color="textSecondary" align="center" py={2}>
                          No policies mapped to this standard
                        </Typography>
                      ) : (
                        <List dense>
                          {policies.map((policy) => (
                            <ListItem key={policy.id}>
                              <ListItemText
                                primary={policy.title}
                                secondary={policy.justification || `Status: ${policy.status}`}
                              />
                              <ListItemSecondaryAction>
                                <Chip label={policy.status} size="small" />
                              </ListItemSecondaryAction>
                            </ListItem>
                          ))}
                        </List>
                      )}
                    </TabPanel>

                    <TabPanel value={tabValue} index={2}>
                      <Box display="flex" justifyContent="flex-end" mb={2}>
                        <Button
                          size="small"
                          startIcon={<AddIcon />}
                          onClick={() => handleOpenMapDialog('risk')}
                        >
                          Map Risk
                        </Button>
                      </Box>
                      {risks.length === 0 ? (
                        <Typography color="textSecondary" align="center" py={2}>
                          No risks mapped to this standard
                        </Typography>
                      ) : (
                        <List dense>
                          {risks.map((risk) => (
                            <ListItem key={risk.id}>
                              <ListItemText
                                primary={risk.title}
                                secondary={`Severity: ${risk.severity}`}
                              />
                              <ListItemSecondaryAction>
                                <Chip
                                  label={risk.severity}
                                  size="small"
                                  color={risk.severity === 'critical' ? 'error' : risk.severity === 'high' ? 'warning' : 'default'}
                                />
                              </ListItemSecondaryAction>
                            </ListItem>
                          ))}
                        </List>
                      )}
                    </TabPanel>

                    <TabPanel value={tabValue} index={3}>
                      <Box display="flex" justifyContent="flex-end" mb={2}>
                        <Button
                          size="small"
                          startIcon={<AddIcon />}
                          onClick={() => handleOpenMapDialog('finding')}
                        >
                          Map Finding
                        </Button>
                      </Box>
                      {findings.length === 0 ? (
                        <Typography color="textSecondary" align="center" py={2}>
                          No findings mapped to this standard
                        </Typography>
                      ) : (
                        <List dense>
                          {findings.map((finding) => (
                            <ListItem key={finding.id}>
                              <ListItemText
                                primary={finding.title}
                                secondary={`Evidence: ${finding.evidence_strength || 'N/A'}`}
                              />
                              <ListItemSecondaryAction>
                                <Chip
                                  label={finding.severity}
                                  size="small"
                                  color={finding.severity === 'critical' ? 'error' : finding.severity === 'high' ? 'warning' : 'default'}
                                />
                              </ListItemSecondaryAction>
                            </ListItem>
                          ))}
                        </List>
                      )}
                    </TabPanel>

                    <TabPanel value={tabValue} index={4}>
                      <Box display="flex" justifyContent="flex-end" mb={2}>
                        <Button
                          size="small"
                          startIcon={<AddIcon />}
                          onClick={() => handleOpenMapDialog('audit')}
                        >
                          Map Audit
                        </Button>
                      </Box>
                      {audits.length === 0 ? (
                        <Typography color="textSecondary" align="center" py={2}>
                          No audits mapped to this standard
                        </Typography>
                      ) : (
                        <List dense>
                          {audits.map((audit) => (
                            <ListItem key={audit.id}>
                              <ListItemText
                                primary={audit.title}
                                secondary={`Status: ${audit.status}`}
                              />
                              <ListItemSecondaryAction>
                                <Chip label={audit.status} size="small" />
                              </ListItemSecondaryAction>
                            </ListItem>
                          ))}
                        </List>
                      )}
                    </TabPanel>
                  </>
                )}
              </Paper>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>Details</Typography>
              <Divider sx={{ mb: 2 }} />
              
              <Box mb={2}>
                <Typography variant="subtitle2" color="textSecondary">Family</Typography>
                <Typography>{FAMILY_LABELS[standard.family] || standard.family}</Typography>
              </Box>
              
              <Box mb={2}>
                <Typography variant="subtitle2" color="textSecondary">Version</Typography>
                <Typography>{standard.version}</Typography>
              </Box>
              
              <Box mb={2}>
                <Typography variant="subtitle2" color="textSecondary">Hierarchy Level</Typography>
                <Typography sx={{ textTransform: 'capitalize' }}>
                  {standard.hierarchy_level || '-'}
                </Typography>
              </Box>
              
              <Box mb={2}>
                <Typography variant="subtitle2" color="textSecondary">Domain</Typography>
                <Typography sx={{ textTransform: 'capitalize' }}>
                  {standard.domain || '-'}
                </Typography>
              </Box>
              
              <Box mb={2}>
                <Typography variant="subtitle2" color="textSecondary">Category</Typography>
                <Typography>{standard.category || '-'}</Typography>
              </Box>
              
              <Box mb={2}>
                <Typography variant="subtitle2" color="textSecondary">Regulation</Typography>
                <Typography>{standard.regulation || '-'}</Typography>
              </Box>
              
              <Box>
                <Typography variant="subtitle2" color="textSecondary">Status</Typography>
                <Chip
                  label={standard.status}
                  size="small"
                  color={standard.status === 'completed' ? 'success' : standard.status === 'in_progress' ? 'info' : 'default'}
                />
              </Box>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6">Metadata Tags</Typography>
                <IconButton size="small" title="Manage Tags">
                  <TagIcon />
                </IconButton>
              </Box>
              <Divider sx={{ mb: 2 }} />
              
              {metadata.length === 0 ? (
                <Typography color="textSecondary" variant="body2">
                  No metadata tags assigned
                </Typography>
              ) : (
                <Box display="flex" flexWrap="wrap" gap={1}>
                  {metadata.map((tag) => (
                    <Chip
                      key={tag.id}
                      label={tag.value}
                      size="small"
                      sx={{
                        backgroundColor: tag.color || undefined,
                        color: tag.color ? '#fff' : undefined,
                      }}
                    />
                  ))}
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Dialog open={openMapDialog} onClose={() => setOpenMapDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          Map {mapType.charAt(0).toUpperCase() + mapType.slice(1)} to Standard
        </DialogTitle>
        <DialogContent>
          {mapError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {mapError}
            </Alert>
          )}
          
          <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <RecordPicker
              entityType={getPickerEntityType()}
              value={mapTargetId}
              onChange={handleRecordSelect}
              label={`Select ${mapType.charAt(0).toUpperCase() + mapType.slice(1)}`}
              placeholder={`Search ${mapType}s by code or name...`}
              required
            />
            
            {selectedRecord && (
              <Alert severity="info" sx={{ py: 0.5 }}>
                Selected: <strong>{selectedRecord.code ? `${selectedRecord.code} - ` : ''}{selectedRecord.title}</strong>
              </Alert>
            )}
            
            {mapType === 'policy' && (
              <TextField
                fullWidth
                label="Justification"
                value={mapJustification}
                onChange={(e) => setMapJustification(e.target.value)}
                multiline
                rows={3}
                placeholder="Optional: Explain why this policy is mapped to this standard"
              />
            )}
            
            {mapType === 'finding' && (
              <FormControl fullWidth>
                <InputLabel>Evidence Strength</InputLabel>
                <Select
                  value={mapEvidenceStrength}
                  label="Evidence Strength"
                  onChange={(e) => setMapEvidenceStrength(e.target.value)}
                >
                  <MenuItem value="strong">Strong</MenuItem>
                  <MenuItem value="medium">Medium</MenuItem>
                  <MenuItem value="weak">Weak</MenuItem>
                </Select>
              </FormControl>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenMapDialog(false)}>Cancel</Button>
          <Button onClick={handleCreateMapping} variant="contained" disabled={!mapTargetId}>
            Create Mapping
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default StandardDetail;
