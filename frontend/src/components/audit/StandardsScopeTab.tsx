import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Button,
  Grid,
  Paper,
  Chip,
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  ListItemIcon,
  Checkbox,
  Divider,
  IconButton,
} from '@mui/material';
import {
  Add as AddIcon,
  Lock as LockIcon,
  LibraryBooks as StandardIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import {
  standardsLibraryApi,
  auditScopeApi,
  StandardData,
  ClauseTreeNode,
  AuditScope,
  AuditScopeStandard,
} from '../../services/grcClient';
import { ClauseTree } from './ClauseTree';

interface StandardsScopeTabProps {
  auditId: string;
  canEdit: boolean;
  auditStatus: string;
}

interface StandardWithClauses {
  standard: StandardData;
  clauseTree: ClauseTreeNode[];
}

export const StandardsScopeTab: React.FC<StandardsScopeTabProps> = ({
  auditId,
  canEdit,
  auditStatus,
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [scope, setScope] = useState<AuditScope | null>(null);
  const [availableStandards, setAvailableStandards] = useState<StandardData[]>([]);
  const [selectedStandard, setSelectedStandard] = useState<StandardWithClauses | null>(null);
  const [selectedClause, setSelectedClause] = useState<ClauseTreeNode | null>(null);
  const [addStandardsDialogOpen, setAddStandardsDialogOpen] = useState(false);
  const [selectedStandardIds, setSelectedStandardIds] = useState<string[]>([]);
  const [savingScope, setSavingScope] = useState(false);
  const [lockingScope, setLockingScope] = useState(false);
  const [loadingClauses, setLoadingClauses] = useState(false);
  const [creatingFinding, setCreatingFinding] = useState(false);
  const navigate = useNavigate();

  const isScopeLocked = scope?.isLocked || auditStatus === 'in_progress' || auditStatus === 'completed' || auditStatus === 'closed';

  const fetchScope = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const response = await auditScopeApi.getScope(auditId);
      const data = response.data?.data || response.data;
      setScope(data);
    } catch (err: unknown) {
      const error = err as { response?: { status?: number; data?: { message?: string } } };
      if (error.response?.status === 404) {
        setScope({ standards: [], clauses: [], isLocked: false });
      } else {
        setError(error.response?.data?.message || 'Failed to load audit scope');
      }
    } finally {
      setLoading(false);
    }
  }, [auditId]);

  const fetchAvailableStandards = useCallback(async () => {
    try {
      const response = await standardsLibraryApi.list();
      const data = response.data?.data || response.data || [];
      setAvailableStandards(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to fetch standards:', err);
      setAvailableStandards([]);
    }
  }, []);

  const fetchStandardClauses = useCallback(async (standardId: string) => {
    if (!standardId || standardId === 'undefined') {
      console.warn('Cannot fetch clauses: standardId is missing or invalid');
      setError('Unable to load clauses: standard ID is missing');
      return;
    }
    try {
      setLoadingClauses(true);
      setError('');
      const response = await standardsLibraryApi.getWithClauses(standardId);
      const data = response.data?.data || response.data;
      if (data) {
        setSelectedStandard({
          standard: data,
          clauseTree: data.clauseTree || [],
        });
      }
    } catch (err) {
      console.error('Failed to fetch standard clauses:', err);
      setError('Failed to load standard clauses. Please try again.');
    } finally {
      setLoadingClauses(false);
    }
  }, []);

  useEffect(() => {
    fetchScope();
    fetchAvailableStandards();
  }, [fetchScope, fetchAvailableStandards]);

  const handleOpenAddStandardsDialog = () => {
    const existingIds = scope?.standards.map(s => s.standardId) || [];
    setSelectedStandardIds(existingIds);
    setAddStandardsDialogOpen(true);
  };

  const handleToggleStandard = (standardId: string) => {
    setSelectedStandardIds(prev => {
      if (prev.includes(standardId)) {
        return prev.filter(id => id !== standardId);
      }
      return [...prev, standardId];
    });
  };

  const handleSaveScope = async () => {
    try {
      setSavingScope(true);
      setError('');
      await auditScopeApi.setScope(auditId, {
        standardIds: selectedStandardIds,
      });
      setSuccess('Audit scope updated successfully');
      setAddStandardsDialogOpen(false);
      
      // Reset selected standard and clause if the selected standard was removed from scope
      if (selectedStandard && !selectedStandardIds.includes(selectedStandard.standard.id)) {
        setSelectedStandard(null);
        setSelectedClause(null);
      }
      
      fetchScope();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      setError(error.response?.data?.message || 'Failed to update audit scope');
    } finally {
      setSavingScope(false);
    }
  };

  const handleLockScope = async () => {
    try {
      setLockingScope(true);
      setError('');
      await auditScopeApi.lockScope(auditId);
      setSuccess('Audit scope locked successfully');
      fetchScope();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      setError(error.response?.data?.message || 'Failed to lock audit scope');
    } finally {
      setLockingScope(false);
    }
  };

  const handleSelectStandard = (scopeStandard: AuditScopeStandard) => {
    if (!scopeStandard.standardId) {
      console.warn('Cannot select standard: standardId is missing');
      setError('Unable to load standard: ID is missing');
      return;
    }
    fetchStandardClauses(scopeStandard.standardId);
    setSelectedClause(null);
  };

  const handleSelectClause = (clause: ClauseTreeNode) => {
    setSelectedClause(clause);
  };

  const getStandardInfo = (standardId: string): StandardData | undefined => {
    return availableStandards.find(s => s.id === standardId);
  };

  const handleCreateFindingForClause = async () => {
    if (!selectedClause) return;

    try {
      setCreatingFinding(true);
      setError('');
      const response = await auditScopeApi.createFindingForClause(auditId, selectedClause.id);
      const data = response.data?.data || response.data;
      const issueId = data?.issue?.id;
      
      if (issueId) {
        setSuccess(`Finding created successfully for clause ${selectedClause.code}`);
        navigate(`/issues/${issueId}`);
      } else {
        setSuccess('Finding created successfully');
      }
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      console.error('Failed to create finding:', err);
      setError(error.response?.data?.message || 'Failed to create finding for clause');
    } finally {
      setCreatingFinding(false);
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" p={4}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box data-testid="audit-standards-tab">
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')} data-testid="standards-tab-error">
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>
          {success}
        </Alert>
      )}

      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Box display="flex" alignItems="center" gap={1}>
          <Typography variant="h6">Standards in Scope</Typography>
          {isScopeLocked && (
            <Chip
              icon={<LockIcon />}
              label="Scope Locked"
              size="small"
              color="warning"
            />
          )}
        </Box>
        <Box display="flex" gap={1}>
          <IconButton onClick={fetchScope} title="Refresh">
            <RefreshIcon />
          </IconButton>
          {canEdit && !isScopeLocked && (
            <>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={handleOpenAddStandardsDialog}
              >
                Manage Standards
              </Button>
              {scope && scope.standards.length > 0 && (
                <Button
                  variant="outlined"
                  startIcon={lockingScope ? <CircularProgress size={16} /> : <LockIcon />}
                  onClick={handleLockScope}
                  disabled={lockingScope}
                >
                  Lock Scope
                </Button>
              )}
            </>
          )}
        </Box>
      </Box>

      {(!scope || scope.standards.length === 0) ? (
        <Paper variant="outlined" sx={{ p: 4, textAlign: 'center' }}>
          <StandardIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
          <Typography color="textSecondary" gutterBottom>
            No standards in audit scope
          </Typography>
          <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
            Add standards to define the scope of this audit. Once added, you can navigate through clauses and create findings.
          </Typography>
          {canEdit && !isScopeLocked && (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleOpenAddStandardsDialog}
            >
              Add Standards
            </Button>
          )}
        </Paper>
      ) : (
        <Grid container spacing={2}>
          <Grid item xs={12} md={3}>
            <Paper variant="outlined" sx={{ height: '100%', minHeight: 400 }}>
              <Box sx={{ p: 1.5, borderBottom: 1, borderColor: 'divider' }}>
                <Typography variant="subtitle2">Standards ({scope.standards.length})</Typography>
              </Box>
              <List dense disablePadding>
                {scope.standards.map((scopeStandard) => {
                  const standardInfo = getStandardInfo(scopeStandard.standardId) || scopeStandard.standard;
                  const isSelected = selectedStandard?.standard.id === scopeStandard.standardId;
                  return (
                    <ListItem
                      key={scopeStandard.id}
                      disablePadding
                      data-testid={`standard-item-${scopeStandard.standardId}`}
                      secondaryAction={
                        scopeStandard.isLocked && (
                          <LockIcon fontSize="small" color="action" />
                        )
                      }
                    >
                      <ListItemButton
                        selected={isSelected}
                        onClick={() => handleSelectStandard(scopeStandard)}
                        data-testid={`standard-select-${scopeStandard.standardId}`}
                      >
                        <ListItemIcon sx={{ minWidth: 36 }}>
                          <StandardIcon fontSize="small" color={isSelected ? 'primary' : 'action'} />
                        </ListItemIcon>
                        <ListItemText
                          primary={standardInfo?.shortName || standardInfo?.code || 'Unknown'}
                          secondary={standardInfo?.name}
                          primaryTypographyProps={{ variant: 'body2', fontWeight: isSelected ? 'medium' : 'normal' }}
                          secondaryTypographyProps={{ variant: 'caption', noWrap: true }}
                        />
                      </ListItemButton>
                    </ListItem>
                  );
                })}
              </List>
            </Paper>
          </Grid>

          <Grid item xs={12} md={4}>
            <Paper variant="outlined" sx={{ height: '100%', minHeight: 400, overflow: 'auto' }}>
              <Box sx={{ p: 1.5, borderBottom: 1, borderColor: 'divider' }}>
                <Typography variant="subtitle2">
                  {selectedStandard ? `Clauses - ${selectedStandard.standard.shortName || selectedStandard.standard.code}` : 'Select a Standard'}
                </Typography>
              </Box>
              {loadingClauses ? (
                <Box display="flex" justifyContent="center" p={4}>
                  <CircularProgress size={24} />
                </Box>
              ) : selectedStandard ? (
                <Box data-testid="clause-tree">
                  <ClauseTree
                    clauses={selectedStandard.clauseTree}
                    selectedClauseId={selectedClause?.id}
                    onClauseSelect={handleSelectClause}
                  />
                </Box>
              ) : (
                <Box p={2}>
                  <Typography color="textSecondary" variant="body2">
                    Select a standard from the list to view its clauses.
                  </Typography>
                </Box>
              )}
            </Paper>
          </Grid>

          <Grid item xs={12} md={5}>
            <Paper variant="outlined" sx={{ height: '100%', minHeight: 400 }}>
              <Box sx={{ p: 1.5, borderBottom: 1, borderColor: 'divider' }}>
                <Typography variant="subtitle2">
                  {selectedClause ? 'Clause Details' : 'Select a Clause'}
                </Typography>
              </Box>
              {selectedClause ? (
                <Box p={2} data-testid="clause-details-panel">
                  <Box mb={2}>
                    <Typography variant="overline" color="textSecondary">Code</Typography>
                    <Typography variant="body1" fontWeight="medium" data-testid="clause-detail-code">{selectedClause.code}</Typography>
                  </Box>
                  <Box mb={2}>
                    <Typography variant="overline" color="textSecondary">Title</Typography>
                    <Typography variant="body1">{selectedClause.title}</Typography>
                  </Box>
                  {selectedClause.description && (
                    <Box mb={2}>
                      <Typography variant="overline" color="textSecondary">Description</Typography>
                      <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                        {selectedClause.description}
                      </Typography>
                    </Box>
                  )}
                  <Box mb={2}>
                    <Typography variant="overline" color="textSecondary">Properties</Typography>
                    <Box display="flex" gap={1} mt={0.5}>
                      <Chip
                        label={`Level ${selectedClause.level}`}
                        size="small"
                        variant="outlined"
                      />
                      {selectedClause.isAuditable && (
                        <Chip
                          label="Auditable"
                          size="small"
                          color="success"
                        />
                      )}
                    </Box>
                  </Box>
                  {canEdit && selectedClause.isAuditable && (
                    <Box mt={3}>
                      <Divider sx={{ mb: 2 }} />
                      <Button
                        variant="contained"
                        startIcon={creatingFinding ? <CircularProgress size={16} /> : <AddIcon />}
                        size="small"
                        onClick={handleCreateFindingForClause}
                        disabled={creatingFinding}
                        data-testid="create-finding-for-clause"
                      >
                        {creatingFinding ? 'Creating...' : 'Create Finding for this Clause'}
                      </Button>
                    </Box>
                  )}
                </Box>
              ) : (
                <Box p={2}>
                  <Typography color="textSecondary" variant="body2">
                    Select a clause from the tree to view its details and create findings.
                  </Typography>
                </Box>
              )}
            </Paper>
          </Grid>
        </Grid>
      )}

      <Dialog
        open={addStandardsDialogOpen}
        onClose={() => setAddStandardsDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Manage Standards in Scope</DialogTitle>
        <DialogContent>
          {isScopeLocked && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              The audit scope is locked and cannot be modified.
            </Alert>
          )}
          <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
            Select the standards to include in this audit's scope. You can add or remove standards until the scope is locked.
          </Typography>
          {availableStandards.length === 0 ? (
            <Typography color="textSecondary">
              No standards available. Please add standards to the library first.
            </Typography>
          ) : (
            <List>
              {availableStandards.map((standard) => (
                <ListItem key={standard.id} disablePadding>
                  <ListItemButton
                    onClick={() => handleToggleStandard(standard.id)}
                    disabled={isScopeLocked}
                  >
                    <ListItemIcon>
                      <Checkbox
                        checked={selectedStandardIds.includes(standard.id)}
                        disabled={isScopeLocked}
                      />
                    </ListItemIcon>
                    <ListItemText
                      primary={standard.name}
                      secondary={`${standard.code} - v${standard.version}`}
                    />
                  </ListItemButton>
                </ListItem>
              ))}
            </List>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddStandardsDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleSaveScope}
            disabled={savingScope || isScopeLocked}
            startIcon={savingScope ? <CircularProgress size={16} /> : null}
          >
            {savingScope ? 'Saving...' : 'Save Scope'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default StandardsScopeTab;
