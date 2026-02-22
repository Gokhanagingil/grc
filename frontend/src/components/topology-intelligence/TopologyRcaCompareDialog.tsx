/**
 * TopologyRcaCompareDialog
 * Side-by-side comparison of two RCA hypotheses.
 */
import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Grid,
  Card,
  CardContent,
  Typography,
  Chip,
  Box,
  List,
  ListItem,
  ListItemText,
  Divider,
} from '@mui/material';
import CompareArrowsIcon from '@mui/icons-material/CompareArrows';

import type { RcaHypothesisData } from '../../services/grcClient';
import {
  getConfidenceLabel,
  getConfidenceColor,
  getRcaHypothesisTypeLabel,
  getNodeTypeShortLabel,
} from './topology-utils';

export interface TopologyRcaCompareDialogProps {
  open: boolean;
  onClose: () => void;
  hypothesis1: RcaHypothesisData | null;
  hypothesis2: RcaHypothesisData | null;
}

const HypothesisCard: React.FC<{ hypothesis: RcaHypothesisData; rank: number }> = ({ hypothesis, rank }) => {
  const confidenceColor = getConfidenceColor(hypothesis.score);

  return (
    <Card variant="outlined" sx={{ height: '100%' }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <Typography variant="h6" fontWeight={700}>#{rank}</Typography>
          <Chip
            label={`${(hypothesis.score * 100).toFixed(0)}% - ${getConfidenceLabel(hypothesis.score)}`}
            size="small"
            color={confidenceColor}
          />
        </Box>

        <Typography variant="subtitle1" fontWeight={600} gutterBottom>
          {hypothesis.suspectNodeLabel}
        </Typography>

        <Box sx={{ display: 'flex', gap: 0.5, mb: 1 }}>
          <Chip label={getNodeTypeShortLabel(hypothesis.suspectNodeType)} size="small" variant="outlined" />
          <Chip label={getRcaHypothesisTypeLabel(hypothesis.type)} size="small" variant="outlined" />
        </Box>

        <Typography variant="body2" sx={{ mb: 1.5 }}>
          {hypothesis.explanation}
        </Typography>

        {Array.isArray(hypothesis.evidence) && hypothesis.evidence.length > 0 && (
          <>
            <Divider sx={{ mb: 1 }} />
            <Typography variant="subtitle2" gutterBottom>Evidence ({hypothesis.evidence.length})</Typography>
            <List dense disablePadding>
              {hypothesis.evidence.map((ev, idx) => (
                <ListItem key={idx} disableGutters sx={{ py: 0.25 }}>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Chip label={ev.type.replace(/_/g, ' ')} size="small" variant="outlined" />
                        <Typography variant="body2">{ev.description}</Typography>
                      </Box>
                    }
                  />
                </ListItem>
              ))}
            </List>
          </>
        )}

        {Array.isArray(hypothesis.recommendedActions) && hypothesis.recommendedActions.length > 0 && (
          <>
            <Divider sx={{ my: 1 }} />
            <Typography variant="subtitle2" gutterBottom>Recommended Actions</Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
              {hypothesis.recommendedActions.map((action, idx) => (
                <Chip key={idx} label={action.label} size="small" color="primary" variant="outlined" />
              ))}
            </Box>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export const TopologyRcaCompareDialog: React.FC<TopologyRcaCompareDialogProps> = ({
  open,
  onClose,
  hypothesis1,
  hypothesis2,
}) => {
  if (!hypothesis1 || !hypothesis2) return null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth data-testid="rca-compare-dialog">
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <CompareArrowsIcon />
        Compare Top Hypotheses
      </DialogTitle>
      <DialogContent>
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <HypothesisCard hypothesis={hypothesis1} rank={1} />
          </Grid>
          <Grid item xs={12} md={6}>
            <HypothesisCard hypothesis={hypothesis2} rank={2} />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};

export default TopologyRcaCompareDialog;
