import React, { useState, useCallback } from 'react';
import {
  Box,
  Typography,
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
  Drawer,
} from '@mui/material';
import {
  AutoAwesome as CopilotIcon,
  ContentCopy as CopyIcon,
  Send as ApplyIcon,
  Lightbulb as SuggestionIcon,
  Article as KbIcon,
  History as SimilarIcon,
  Info as InfoIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import {
  copilotApi,
  CopilotSuggestResponse,
  CopilotActionCard,
  CopilotApplyRequest,
} from '../../services/grcClient';

interface CopilotPanelProps {
  open: boolean;
  onClose: () => void;
  incidentSysId: string;
  incidentNumber: string;
}

export const CopilotPanel: React.FC<CopilotPanelProps> = ({
  open,
  onClose,
  incidentSysId,
  incidentNumber,
}) => {
  const { user } = useAuth();
  const tid = user?.tenantId || localStorage.getItem('tenantId') || '';

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

  const handleGenerateSuggestions = useCallback(async () => {
    if (!tid || !incidentSysId) return;
    setSuggestLoading(true);
    setSuggestError(null);
    try {
      const result = await copilotApi.suggest(tid, incidentSysId);
      setSuggestions(result);
      try {
        await copilotApi.recordLearningEvent(tid, {
          incidentSysId,
          eventType: 'SUGGESTION_SHOWN',
          actionType: 'all',
        });
      } catch {
        // Learning event recording is best-effort
      }
    } catch (err) {
      setSuggestError(err instanceof Error ? err.message : 'Failed to generate suggestions');
    } finally {
      setSuggestLoading(false);
    }
  }, [tid, incidentSysId]);

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
    if (!tid || !incidentSysId || !applyDialog.card) return;
    setApplyLoading(true);
    try {
      const payload: CopilotApplyRequest = {
        actionType: applyDialog.card.type,
        targetField: applyDialog.targetField,
        text: applyDialog.text,
      };
      await copilotApi.apply(tid, incidentSysId, payload);
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
  }, [tid, incidentSysId, applyDialog]);

  const handleReject = useCallback(async (card: CopilotActionCard) => {
    if (!tid || !incidentSysId) return;
    try {
      await copilotApi.recordLearningEvent(tid, {
        incidentSysId,
        eventType: 'SUGGESTION_REJECTED',
        actionType: card.type,
      });
      setSnackbar({ open: true, message: 'Feedback recorded', severity: 'success' });
    } catch {
      // Best effort
    }
  }, [tid, incidentSysId]);

  const cards = suggestions ? (Array.isArray(suggestions.actionCards) ? suggestions.actionCards : []) : [];
  const similar = suggestions ? (Array.isArray(suggestions.similarIncidents) ? suggestions.similarIncidents : []) : [];
  const kb = suggestions ? (Array.isArray(suggestions.kbSuggestions) ? suggestions.kbSuggestions : []) : [];

  return (
    <>
      <Drawer
        anchor="right"
        open={open}
        onClose={onClose}
        PaperProps={{ sx: { width: { xs: '100%', sm: 480 }, p: 0 } }}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
            <CopilotIcon color="primary" />
            <Typography variant="h6" sx={{ flex: 1 }}>Copilot</Typography>
            <Chip label={incidentNumber} size="small" variant="outlined" />
            <IconButton onClick={onClose} size="small">
              <CloseIcon />
            </IconButton>
          </Box>

          <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
            {!suggestions && !suggestLoading && !suggestError && (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <CopilotIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
                <Typography color="text.secondary" gutterBottom>
                  Get AI-powered suggestions for this incident
                </Typography>
                <Button
                  variant="contained"
                  startIcon={<CopilotIcon />}
                  onClick={handleGenerateSuggestions}
                  sx={{ mt: 2 }}
                >
                  Generate Suggestions
                </Button>
              </Box>
            )}

            {suggestLoading && (
              <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <CircularProgress size={20} />
                  <Typography>Analyzing incident...</Typography>
                </Box>
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} height={120} sx={{ mb: 1 }} />
                ))}
              </Box>
            )}

            {suggestError && (
              <Alert severity="error" action={
                <Button size="small" onClick={handleGenerateSuggestions}>Retry</Button>
              }>
                {suggestError}
              </Alert>
            )}

            {suggestions && !suggestLoading && (
              <>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                  <Typography variant="subtitle1" fontWeight={600}>
                    Suggestions
                  </Typography>
                  <Button size="small" onClick={handleGenerateSuggestions} startIcon={<CopilotIcon />}>
                    Regenerate
                  </Button>
                </Box>
                <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block' }}>
                  Generated at {new Date(suggestions.generatedAt).toLocaleString()}
                </Typography>

                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mb: 3 }}>
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

                {(similar.length > 0 || kb.length > 0) && (
                  <>
                    <Divider sx={{ my: 2 }} />
                    {similar.length > 0 && (
                      <>
                        <Typography variant="subtitle2" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                          <SimilarIcon fontSize="small" color="primary" />
                          Similar Incidents ({similar.length})
                        </Typography>
                        <List dense sx={{ mb: 2 }}>
                          {similar.map((sim) => (
                            <ListItem key={sim.sysId} sx={{ flexDirection: 'column', alignItems: 'flex-start', border: '1px solid', borderColor: 'divider', borderRadius: 1, mb: 1, px: 1.5 }}>
                              <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                                <Typography variant="body2" fontWeight={600}>{sim.number || sim.sysId}</Typography>
                                <Chip label={`${(sim.score * 100).toFixed(0)}%`} size="small" color="primary" variant="outlined" />
                              </Box>
                              <ListItemText
                                primary={sim.shortDescription || 'No description'}
                                secondary={sim.resolutionNotes ? `Resolution: ${sim.resolutionNotes.substring(0, 150)}${sim.resolutionNotes.length > 150 ? '...' : ''}` : undefined}
                                primaryTypographyProps={{ variant: 'body2' }}
                                secondaryTypographyProps={{ variant: 'caption' }}
                              />
                            </ListItem>
                          ))}
                        </List>
                      </>
                    )}
                    {kb.length > 0 && (
                      <>
                        <Typography variant="subtitle2" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                          <KbIcon fontSize="small" color="primary" />
                          Knowledge Articles ({kb.length})
                        </Typography>
                        <List dense>
                          {kb.map((article) => (
                            <ListItem key={article.sysId} sx={{ flexDirection: 'column', alignItems: 'flex-start', border: '1px solid', borderColor: 'divider', borderRadius: 1, mb: 1, px: 1.5 }}>
                              <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                                <Typography variant="body2" fontWeight={600}>{article.number || article.sysId}</Typography>
                                <Chip label={`${(article.score * 100).toFixed(0)}%`} size="small" color="secondary" variant="outlined" />
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
                      </>
                    )}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                      <InfoIcon fontSize="small" color="action" />
                      <Typography variant="caption" color="text.secondary">
                        Results based on text similarity from the local index.
                      </Typography>
                    </Box>
                  </>
                )}
              </>
            )}
          </Box>
        </Box>
      </Drawer>

      <Dialog open={applyDialog.open} onClose={() => setApplyDialog({ ...applyDialog, open: false })} maxWidth="md" fullWidth>
        <DialogTitle>Apply to ServiceNow</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            This will add a comment to incident {incidentNumber} in ServiceNow.
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
    </>
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

export default CopilotPanel;
