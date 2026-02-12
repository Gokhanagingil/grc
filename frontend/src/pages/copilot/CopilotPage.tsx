import React, { useState, useCallback, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  TextField,
  CircularProgress,
  Alert,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Skeleton,
  IconButton,
  Tooltip,
  Divider,
  Card,
  CardContent,
  CardActions,
  List,
  ListItem,
  ListItemText,
  Select,
  MenuItem,
  InputLabel,
  FormControl,
  Snackbar,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Pagination,
} from '@mui/material';
import {
  AutoAwesome as CopilotIcon,
  ContentCopy as CopyIcon,
  Send as ApplyIcon,
  Refresh as RefreshIcon,
  Search as SearchIcon,
  Lightbulb as SuggestionIcon,
  Article as KbIcon,
  History as SimilarIcon,
  Info as InfoIcon,
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import {
  copilotApi,
  CopilotSnIncident,
  CopilotSuggestResponse,
  CopilotActionCard,
  CopilotApplyRequest,
} from '../../services/grcClient';

type CopilotStep = 'select' | 'loaded' | 'suggesting' | 'suggested';

export const CopilotPage: React.FC = () => {
  const { tenantId } = useAuth();
  const tid = tenantId || '';

  const [step, setStep] = useState<CopilotStep>('select');
  const [incidents, setIncidents] = useState<CopilotSnIncident[]>([]);
  const [incidentsLoading, setIncidentsLoading] = useState(false);
  const [incidentsError, setIncidentsError] = useState<string | null>(null);
  const [incidentsPage, setIncidentsPage] = useState(1);
  const [incidentsTotal, setIncidentsTotal] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');

  const [selectedIncident, setSelectedIncident] = useState<CopilotSnIncident | null>(null);
  const [suggestions, setSuggestions] = useState<CopilotSuggestResponse | null>(null);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [suggestError, setSuggestError] = useState<string | null>(null);

  const [applyDialog, setApplyDialog] = useState<{
    open: boolean;
    card: CopilotActionCard | null;
    text: string;
    targetField: 'work_notes' | 'additional_comments';
  }>({ open: false, card: null, text: '', targetField: 'work_notes' });
  const [applyLoading, setApplyLoading] = useState(false);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  });

  const loadIncidents = useCallback(async (page = 1, query?: string) => {
    if (!tid) return;
    setIncidentsLoading(true);
    setIncidentsError(null);
    try {
      const result = await copilotApi.listIncidents(tid, {
        page,
        pageSize: 10,
        query: query || undefined,
      });
      setIncidents(Array.isArray(result.items) ? result.items : []);
      setIncidentsTotal(result.total || 0);
      setIncidentsPage(page);
    } catch (err) {
      setIncidentsError(err instanceof Error ? err.message : 'Failed to load incidents');
      setIncidents([]);
    } finally {
      setIncidentsLoading(false);
    }
  }, [tid]);

  useEffect(() => {
    if (tid) {
      loadIncidents(1);
    }
  }, [tid, loadIncidents]);

  const handleSearch = useCallback(() => {
    loadIncidents(1, searchQuery);
  }, [loadIncidents, searchQuery]);

  const handleSelectIncident = useCallback(async (incident: CopilotSnIncident) => {
    setSelectedIncident(incident);
    setSuggestions(null);
    setSuggestError(null);
    setStep('loaded');
  }, []);

  const handleGenerateSuggestions = useCallback(async () => {
    if (!tid || !selectedIncident) return;
    setSuggestLoading(true);
    setSuggestError(null);
    setStep('suggesting');
    try {
      const result = await copilotApi.suggest(tid, selectedIncident.sys_id);
      setSuggestions(result);
      setStep('suggested');
      try {
        await copilotApi.recordLearningEvent(tid, {
          incidentSysId: selectedIncident.sys_id,
          eventType: 'SUGGESTION_SHOWN',
          actionType: 'all',
        });
      } catch {
        // Learning event recording is best-effort
      }
    } catch (err) {
      setSuggestError(err instanceof Error ? err.message : 'Failed to generate suggestions');
      setStep('loaded');
    } finally {
      setSuggestLoading(false);
    }
  }, [tid, selectedIncident]);

  const handleCopy = useCallback((text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setSnackbar({ open: true, message: 'Copied to clipboard', severity: 'success' });
    }).catch(() => {
      setSnackbar({ open: true, message: 'Failed to copy', severity: 'error' });
    });
  }, []);

  const handleOpenApplyDialog = useCallback((card: CopilotActionCard) => {
    setApplyDialog({
      open: true,
      card,
      text: card.content,
      targetField: card.targetField || 'work_notes',
    });
  }, []);

  const handleApply = useCallback(async () => {
    if (!tid || !selectedIncident || !applyDialog.card) return;
    setApplyLoading(true);
    try {
      const payload: CopilotApplyRequest = {
        actionType: applyDialog.card.type,
        targetField: applyDialog.targetField,
        text: applyDialog.text,
      };
      await copilotApi.apply(tid, selectedIncident.sys_id, payload);
      setSnackbar({ open: true, message: 'Comment applied to ServiceNow successfully!', severity: 'success' });
      setApplyDialog({ open: false, card: null, text: '', targetField: 'work_notes' });
    } catch (err) {
      setSnackbar({
        open: true,
        message: err instanceof Error ? err.message : 'Failed to apply comment',
        severity: 'error',
      });
    } finally {
      setApplyLoading(false);
    }
  }, [tid, selectedIncident, applyDialog]);

  const handleReject = useCallback(async (card: CopilotActionCard) => {
    if (!tid || !selectedIncident) return;
    try {
      await copilotApi.recordLearningEvent(tid, {
        incidentSysId: selectedIncident.sys_id,
        eventType: 'SUGGESTION_REJECTED',
        actionType: card.type,
      });
      setSnackbar({ open: true, message: 'Feedback recorded', severity: 'success' });
    } catch {
      // Best effort
    }
  }, [tid, selectedIncident]);

  const renderIncidentList = () => (
    <Paper sx={{ p: 2, height: '100%', overflow: 'auto' }}>
      <Box sx={{ display: 'flex', gap: 1, mb: 2, alignItems: 'center' }}>
        <TextField
          size="small"
          placeholder="Search incidents..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          sx={{ flex: 1 }}
        />
        <IconButton onClick={handleSearch} size="small">
          <SearchIcon />
        </IconButton>
        <IconButton onClick={() => loadIncidents(incidentsPage, searchQuery)} size="small">
          <RefreshIcon />
        </IconButton>
      </Box>

      {incidentsLoading ? (
        <Box>
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} height={60} sx={{ mb: 1 }} />
          ))}
        </Box>
      ) : incidentsError ? (
        <Alert severity="error" action={
          <Button size="small" onClick={() => loadIncidents(1)}>Retry</Button>
        }>
          {incidentsError}
        </Alert>
      ) : incidents.length === 0 ? (
        <Alert severity="info">
          No incidents found. ServiceNow may not be configured for this tenant.
        </Alert>
      ) : (
        <>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Number</TableCell>
                  <TableCell>Description</TableCell>
                  <TableCell>State</TableCell>
                  <TableCell>Priority</TableCell>
                  <TableCell />
                </TableRow>
              </TableHead>
              <TableBody>
                {incidents.map((inc) => (
                  <TableRow
                    key={inc.sys_id}
                    hover
                    selected={selectedIncident?.sys_id === inc.sys_id}
                    sx={{ cursor: 'pointer' }}
                    onClick={() => handleSelectIncident(inc)}
                  >
                    <TableCell>
                      <Typography variant="body2" fontWeight={600}>{inc.number}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" noWrap sx={{ maxWidth: 200 }}>
                        {inc.short_description || 'No description'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip label={inc.state || 'Unknown'} size="small" variant="outlined" />
                    </TableCell>
                    <TableCell>
                      <Chip label={inc.priority || '-'} size="small" color={
                        (inc.priority || '').includes('1') ? 'error' :
                        (inc.priority || '').includes('2') ? 'warning' : 'default'
                      } />
                    </TableCell>
                    <TableCell>
                      <Button size="small" variant="outlined" onClick={(e) => {
                        e.stopPropagation();
                        handleSelectIncident(inc);
                      }}>
                        Select
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          {incidentsTotal > 10 && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
              <Pagination
                count={Math.ceil(incidentsTotal / 10)}
                page={incidentsPage}
                onChange={(_, page) => loadIncidents(page, searchQuery)}
                size="small"
              />
            </Box>
          )}
        </>
      )}
    </Paper>
  );

  const renderIncidentContext = () => {
    if (!selectedIncident) {
      return (
        <Paper sx={{ p: 3, textAlign: 'center', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Box>
            <CopilotIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
            <Typography color="text.secondary">Select an incident to start</Typography>
          </Box>
        </Paper>
      );
    }

    const inc = selectedIncident;
    return (
      <Paper sx={{ p: 2, height: '100%', overflow: 'auto' }}>
        <Typography variant="h6" gutterBottom>
          {inc.number}
        </Typography>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          {inc.short_description || 'No description'}
        </Typography>
        <Divider sx={{ my: 1 }} />
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <DetailRow label="State" value={inc.state} />
          <DetailRow label="Priority" value={inc.priority} />
          <DetailRow label="Category" value={inc.category} />
          <DetailRow label="Assignment Group" value={inc.assignment_group} />
          <DetailRow label="Assigned To" value={inc.assigned_to} />
          <DetailRow label="Service" value={inc.business_service || inc.service_offering} />
          <DetailRow label="Opened" value={inc.opened_at} />
          <DetailRow label="Updated" value={inc.sys_updated_on} />
        </Box>
        {inc.description && (
          <>
            <Divider sx={{ my: 1 }} />
            <Typography variant="caption" color="text.secondary">Description</Typography>
            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', mt: 0.5, maxHeight: 200, overflow: 'auto' }}>
              {inc.description}
            </Typography>
          </>
        )}
        <Divider sx={{ my: 1 }} />
        <Button
          variant="contained"
          startIcon={suggestLoading ? <CircularProgress size={16} /> : <CopilotIcon />}
          onClick={handleGenerateSuggestions}
          disabled={suggestLoading}
          fullWidth
          sx={{ mt: 1 }}
        >
          {suggestLoading ? 'Generating...' : 'Generate Suggestions'}
        </Button>
      </Paper>
    );
  };

  const renderActionCards = () => {
    if (suggestLoading) {
      return (
        <Paper sx={{ p: 2, height: '100%' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <CircularProgress size={20} />
            <Typography>Analyzing incident...</Typography>
          </Box>
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} height={120} sx={{ mb: 1 }} />
          ))}
        </Paper>
      );
    }

    if (suggestError) {
      return (
        <Paper sx={{ p: 2, height: '100%' }}>
          <Alert severity="error" action={
            <Button size="small" onClick={handleGenerateSuggestions}>Retry</Button>
          }>
            {suggestError}
          </Alert>
        </Paper>
      );
    }

    if (!suggestions) {
      return (
        <Paper sx={{ p: 3, height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Box sx={{ textAlign: 'center' }}>
            <SuggestionIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
            <Typography color="text.secondary">
              {selectedIncident ? 'Click "Generate Suggestions" to get AI recommendations' : 'Select an incident first'}
            </Typography>
          </Box>
        </Paper>
      );
    }

    const cards = Array.isArray(suggestions.actionCards) ? suggestions.actionCards : [];

    return (
      <Paper sx={{ p: 2, height: '100%', overflow: 'auto' }}>
        <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <CopilotIcon color="primary" />
          Copilot Suggestions
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Generated at {new Date(suggestions.generatedAt).toLocaleString()}
        </Typography>
        <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {cards.map((card) => (
            <ActionCardComponent
              key={card.id}
              card={card}
              onCopy={() => handleCopy(card.content)}
              onApply={() => handleOpenApplyDialog(card)}
              onReject={() => handleReject(card)}
            />
          ))}
        </Box>
      </Paper>
    );
  };

  const renderSimilarAndKb = () => {
    if (!suggestions) {
      return (
        <Paper sx={{ p: 3, height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Box sx={{ textAlign: 'center' }}>
            <SimilarIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
            <Typography color="text.secondary">Similar incidents and KB articles will appear here</Typography>
          </Box>
        </Paper>
      );
    }

    const similar = Array.isArray(suggestions.similarIncidents) ? suggestions.similarIncidents : [];
    const kb = Array.isArray(suggestions.kbSuggestions) ? suggestions.kbSuggestions : [];

    return (
      <Paper sx={{ p: 2, height: '100%', overflow: 'auto' }}>
        <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <SimilarIcon color="primary" />
          Similar Incidents ({similar.length})
        </Typography>
        {similar.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            No similar incidents found in the index.
          </Typography>
        ) : (
          <List dense sx={{ mb: 2 }}>
            {similar.map((sim) => (
              <ListItem key={sim.sysId} sx={{ flexDirection: 'column', alignItems: 'flex-start', border: '1px solid', borderColor: 'divider', borderRadius: 1, mb: 1 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                  <Typography variant="body2" fontWeight={600}>{sim.number || sim.sysId}</Typography>
                  <Chip label={`Score: ${(sim.score * 100).toFixed(0)}%`} size="small" color="primary" variant="outlined" />
                </Box>
                <ListItemText
                  primary={sim.shortDescription || 'No description'}
                  secondary={sim.resolutionNotes ? `Resolution: ${sim.resolutionNotes.substring(0, 200)}${sim.resolutionNotes.length > 200 ? '...' : ''}` : undefined}
                  primaryTypographyProps={{ variant: 'body2' }}
                  secondaryTypographyProps={{ variant: 'caption' }}
                />
              </ListItem>
            ))}
          </List>
        )}

        <Divider sx={{ my: 2 }} />

        <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <KbIcon color="primary" />
          Knowledge Articles ({kb.length})
        </Typography>
        {kb.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            No matching KB articles found.
          </Typography>
        ) : (
          <List dense>
            {kb.map((article) => (
              <ListItem key={article.sysId} sx={{ flexDirection: 'column', alignItems: 'flex-start', border: '1px solid', borderColor: 'divider', borderRadius: 1, mb: 1 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                  <Typography variant="body2" fontWeight={600}>{article.number || article.sysId}</Typography>
                  <Chip label={`Score: ${(article.score * 100).toFixed(0)}%`} size="small" color="secondary" variant="outlined" />
                </Box>
                <ListItemText
                  primary={article.title || 'Untitled'}
                  secondary={article.snippet || undefined}
                  primaryTypographyProps={{ variant: 'body2' }}
                  secondaryTypographyProps={{ variant: 'caption' }}
                />
              </ListItem>
            ))}
          </List>
        )}

        <Divider sx={{ my: 2 }} />
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <InfoIcon fontSize="small" color="action" />
          <Typography variant="caption" color="text.secondary">
            Results are based on text similarity from the local incident/KB index. Index your ServiceNow data to improve results.
          </Typography>
        </Box>
      </Paper>
    );
  };

  return (
    <Box sx={{ p: 2, height: 'calc(100vh - 64px)' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <CopilotIcon color="primary" />
        <Typography variant="h5">Incident Copilot</Typography>
        {selectedIncident && (
          <Chip
            label={`${selectedIncident.number}: ${selectedIncident.short_description?.substring(0, 50) || ''}`}
            onDelete={() => {
              setSelectedIncident(null);
              setSuggestions(null);
              setStep('select');
            }}
            sx={{ ml: 2 }}
          />
        )}
      </Box>

      {step === 'select' && !selectedIncident ? (
        renderIncidentList()
      ) : (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '300px 1fr 350px' }, gap: 2, height: 'calc(100% - 48px)' }}>
          <Box sx={{ overflow: 'auto' }}>{renderIncidentContext()}</Box>
          <Box sx={{ overflow: 'auto' }}>{renderActionCards()}</Box>
          <Box sx={{ overflow: 'auto' }}>{renderSimilarAndKb()}</Box>
        </Box>
      )}

      <Dialog open={applyDialog.open} onClose={() => setApplyDialog({ ...applyDialog, open: false })} maxWidth="md" fullWidth>
        <DialogTitle>Apply to ServiceNow</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            This will add a comment to incident {selectedIncident?.number} in ServiceNow.
          </DialogContentText>
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Target Field</InputLabel>
            <Select
              value={applyDialog.targetField}
              label="Target Field"
              onChange={(e) => setApplyDialog({ ...applyDialog, targetField: e.target.value as 'work_notes' | 'additional_comments' })}
            >
              <MenuItem value="work_notes">Work Notes (internal)</MenuItem>
              <MenuItem value="additional_comments">Customer Comments (visible to customer)</MenuItem>
            </Select>
          </FormControl>
          <TextField
            multiline
            rows={8}
            fullWidth
            value={applyDialog.text}
            onChange={(e) => setApplyDialog({ ...applyDialog, text: e.target.value })}
            label="Comment Text"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setApplyDialog({ ...applyDialog, open: false })}>Cancel</Button>
          <Button
            onClick={handleApply}
            variant="contained"
            color="primary"
            disabled={applyLoading || !applyDialog.text.trim()}
            startIcon={applyLoading ? <CircularProgress size={16} /> : <ApplyIcon />}
          >
            {applyLoading ? 'Applying...' : 'Apply'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          variant="filled"
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

const DetailRow: React.FC<{ label: string; value: string | undefined | null }> = ({ label, value }) => {
  if (!value) return null;
  return (
    <Box sx={{ display: 'flex', gap: 1, alignItems: 'baseline' }}>
      <Typography variant="caption" color="text.secondary" sx={{ minWidth: 120 }}>{label}:</Typography>
      <Typography variant="body2">{value}</Typography>
    </Box>
  );
};

const ActionCardComponent: React.FC<{
  card: CopilotActionCard;
  onCopy: () => void;
  onApply: () => void;
  onReject: () => void;
}> = ({ card, onCopy, onApply, onReject }) => {
  const [expanded, setExpanded] = useState(false);
  const isLong = card.content.length > 300;
  const displayText = expanded || !isLong ? card.content : card.content.substring(0, 300) + '...';

  const getCardIcon = () => {
    switch (card.type) {
      case 'summary': return <InfoIcon fontSize="small" />;
      case 'next_best_steps': return <SuggestionIcon fontSize="small" />;
      case 'customer_update_draft': return <ApplyIcon fontSize="small" />;
      case 'work_notes_draft': return <ApplyIcon fontSize="small" />;
      default: return <InfoIcon fontSize="small" />;
    }
  };

  return (
    <Card variant="outlined">
      <CardContent sx={{ pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          {getCardIcon()}
          <Typography variant="subtitle2">{card.title}</Typography>
          <Chip
            label={`${(card.confidence * 100).toFixed(0)}%`}
            size="small"
            color={card.confidence >= 0.8 ? 'success' : card.confidence >= 0.6 ? 'warning' : 'default'}
            variant="outlined"
            sx={{ ml: 'auto' }}
          />
        </Box>
        <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', color: 'text.secondary' }}>
          {displayText}
        </Typography>
        {isLong && (
          <Button size="small" onClick={() => setExpanded(!expanded)} sx={{ mt: 0.5, p: 0 }}>
            {expanded ? 'Show less' : 'Show more'}
          </Button>
        )}
      </CardContent>
      <CardActions sx={{ pt: 0, px: 2, pb: 1 }}>
        <Tooltip title="Copy to clipboard">
          <IconButton size="small" onClick={onCopy}>
            <CopyIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        {card.canApply && (
          <Button
            size="small"
            variant="contained"
            startIcon={<ApplyIcon />}
            onClick={onApply}
          >
            Apply to {card.targetField === 'additional_comments' ? 'Customer' : 'Work Notes'}
          </Button>
        )}
        <Button size="small" color="inherit" onClick={onReject} sx={{ ml: 'auto' }}>
          Not helpful
        </Button>
      </CardActions>
    </Card>
  );
};

export default CopilotPage;
