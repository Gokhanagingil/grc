/**
 * TopologyExplainabilityPanel
 * Shows the risk factor breakdown, contributing factors,
 * and evidence paths for topology impact analysis.
 */
import React from 'react';
import {
  Box,
  Typography,
  List,
  ListItem,
  ListItemText,
  Chip,
  Skeleton,
  Alert,
  Collapse,
  IconButton,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import RouteIcon from '@mui/icons-material/Route';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';

import type { TopologyImpactResponseData, TopologyImpactPath, FragilitySignal } from '../../services/grcClient';
import { getFragilitySignalLabel } from './topology-utils';

export interface TopologyExplainabilityPanelProps {
  impact: TopologyImpactResponseData | null;
  loading: boolean;
}

export const TopologyExplainabilityPanel: React.FC<TopologyExplainabilityPanelProps> = ({
  impact,
  loading,
}) => {
  const [expandedPath, setExpandedPath] = React.useState<number | null>(null);
  const [showSignals, setShowSignals] = React.useState(false);

  if (loading) {
    return (
      <Box data-testid="topology-explainability-panel">
        <Skeleton variant="text" width="50%" />
        <Skeleton variant="rectangular" height={60} sx={{ borderRadius: 1, mb: 1 }} />
        <Skeleton variant="rectangular" height={60} sx={{ borderRadius: 1 }} />
      </Box>
    );
  }

  if (!impact) {
    return (
      <Box data-testid="topology-explainability-panel">
        <Alert severity="info" icon={<InfoOutlinedIcon />}>
          No topology analysis data available for explainability breakdown.
        </Alert>
      </Box>
    );
  }

  const { topPaths, fragilitySignals, riskExplanation } = impact;
  const safeTopPaths: TopologyImpactPath[] = Array.isArray(topPaths) ? topPaths : [];
  const safeFragilitySignals: FragilitySignal[] = Array.isArray(fragilitySignals) ? fragilitySignals : [];

  return (
    <Box data-testid="topology-explainability-panel">
      {/* Risk explanation */}
      {riskExplanation && (
        <Alert severity="info" sx={{ mb: 2 }} icon={<InfoOutlinedIcon />}>
          <Typography variant="body2">{riskExplanation}</Typography>
        </Alert>
      )}

      {/* Top dependency paths */}
      {safeTopPaths.length > 0 && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle2" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <RouteIcon sx={{ fontSize: 16 }} />
            Top Dependency Paths ({safeTopPaths.length})
          </Typography>
          <List dense disablePadding>
            {safeTopPaths.slice(0, 10).map((path, idx) => (
              <React.Fragment key={idx}>
                <ListItem
                  disableGutters
                  sx={{ py: 0.5, cursor: 'pointer' }}
                  onClick={() => setExpandedPath(expandedPath === idx ? null : idx)}
                  data-testid={`topology-path-${idx}`}
                >
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Chip label={`Depth ${path.depth}`} size="small" variant="outlined" />
                        <Typography variant="body2" fontWeight={500} noWrap sx={{ flex: 1 }}>
                          {Array.isArray(path.nodeLabels) ? path.nodeLabels.join(' → ') : 'Unknown path'}
                        </Typography>
                        <IconButton size="small">
                          {expandedPath === idx ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                        </IconButton>
                      </Box>
                    }
                  />
                </ListItem>
                <Collapse in={expandedPath === idx}>
                  <Box sx={{ pl: 2, pb: 1 }}>
                    {Array.isArray(path.nodeLabels) && path.nodeLabels.map((label, nIdx) => (
                      <Box key={nIdx} sx={{ display: 'flex', alignItems: 'center', gap: 0.5, py: 0.25 }}>
                        <Typography variant="caption" color="text.secondary">
                          {nIdx + 1}.
                        </Typography>
                        <Typography variant="body2">{label}</Typography>
                        {nIdx < path.nodeLabels.length - 1 && Array.isArray(path.relationTypes) && path.relationTypes[nIdx] && (
                          <Chip label={path.relationTypes[nIdx]} size="small" variant="outlined" sx={{ ml: 0.5 }} />
                        )}
                      </Box>
                    ))}
                  </Box>
                </Collapse>
              </React.Fragment>
            ))}
          </List>
        </Box>
      )}

      {/* Fragility signals detail */}
      {safeFragilitySignals.length > 0 && (
        <Box>
          <Box
            sx={{ display: 'flex', alignItems: 'center', gap: 0.5, cursor: 'pointer' }}
            onClick={() => setShowSignals(!showSignals)}
          >
            <Typography variant="subtitle2">
              Fragility Signals Detail ({safeFragilitySignals.length})
            </Typography>
            <IconButton size="small">
              {showSignals ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
            </IconButton>
          </Box>
          <Collapse in={showSignals}>
            <List dense disablePadding>
              {safeFragilitySignals.map((signal, idx) => (
                <ListItem key={idx} disableGutters sx={{ py: 0.25 }}>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Chip
                          label={getFragilitySignalLabel(signal.type)}
                          size="small"
                          color={signal.severity >= 70 ? 'error' : signal.severity >= 40 ? 'warning' : 'info'}
                          variant="outlined"
                        />
                        <Typography variant="body2" fontWeight={500}>
                          {signal.nodeLabel}
                        </Typography>
                      </Box>
                    }
                    secondary={
                      <Typography variant="caption" color="text.secondary">
                        {signal.reason} (severity: {signal.severity})
                      </Typography>
                    }
                  />
                </ListItem>
              ))}
            </List>
          </Collapse>
        </Box>
      )}

      {/* Empty state for paths + signals */}
      {safeTopPaths.length === 0 && safeFragilitySignals.length === 0 && (
        <Typography variant="body2" color="text.secondary">
          No detailed dependency paths or fragility signals found in this analysis.
        </Typography>
      )}
    </Box>
  );
};

export default TopologyExplainabilityPanel;
