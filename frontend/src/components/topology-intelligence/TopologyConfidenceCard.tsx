/**
 * TopologyConfidenceCard
 * Displays topology completeness confidence score, label, and degrading factors.
 * Phase 2 component — renders only when completenessConfidence data is available.
 * Shows warnings when confidence is low to avoid false precision.
 */
import React from 'react';
import {
  Box,
  Typography,
  Chip,
  Alert,
  AlertTitle,
  Tooltip,
  LinearProgress,
  Collapse,
  IconButton,
} from '@mui/material';
import VerifiedIcon from '@mui/icons-material/Verified';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';

import type { TopologyCompletenessConfidence } from '../../services/grcClient';
import {
  getCompletenessConfidenceLabel,
  getCompletenessConfidenceColor,
} from './topology-utils';

export interface TopologyConfidenceCardProps {
  /** Completeness confidence data from Phase-2 backend */
  confidence: TopologyCompletenessConfidence;
}

/** Human-readable labels for degrading factor codes */
const DEGRADING_FACTOR_LABELS: Record<string, string> = {
  MISSING_CLASS_SEMANTICS: 'Missing CI Class Information',
  ISOLATED_NODES: 'Isolated Nodes (No Relationships)',
  NO_HEALTH_RULES: 'No Health Rule Validation',
  GRAPH_TRUNCATED: 'Graph Truncated (Too Many Nodes)',
};

export const TopologyConfidenceCard: React.FC<TopologyConfidenceCardProps> = ({
  confidence,
}) => {
  const [showFactors, setShowFactors] = React.useState(false);
  const color = getCompletenessConfidenceColor(confidence.score);
  const label = getCompletenessConfidenceLabel(confidence.score);
  const isLow = confidence.score < 60;

  return (
    <Box data-testid="topology-confidence-warning">
      {/* Confidence header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <VerifiedIcon color={color} fontSize="small" />
        <Typography variant="subtitle2">
          Data Completeness
        </Typography>
        <Chip
          label={`${confidence.score}/100 — ${label}`}
          size="small"
          color={color}
          variant="outlined"
          data-testid="topology-confidence-score"
        />
      </Box>

      {/* Progress bar */}
      <LinearProgress
        variant="determinate"
        value={Math.min(confidence.score, 100)}
        color={color}
        sx={{ height: 6, borderRadius: 1, mb: 1 }}
      />

      {/* Low confidence warning */}
      {isLow && (
        <Alert
          severity="warning"
          icon={<WarningAmberIcon fontSize="small" />}
          sx={{ py: 0.5, mb: 1 }}
          data-testid="topology-confidence-low-warning"
        >
          <AlertTitle sx={{ fontSize: '0.8rem', mb: 0 }}>Limited Data Quality</AlertTitle>
          <Typography variant="caption">
            Topology analysis is based on incomplete data. Results should be interpreted with caution.
            {confidence.missingClassCount > 0 && (
              <> {confidence.missingClassCount} CI{confidence.missingClassCount !== 1 ? 's' : ''} missing class information.</>
            )}
            {confidence.isolatedNodeCount > 0 && (
              <> {confidence.isolatedNodeCount} isolated node{confidence.isolatedNodeCount !== 1 ? 's' : ''} detected.</>
            )}
          </Typography>
        </Alert>
      )}

      {/* Health rules status */}
      {!confidence.healthRulesAvailable && (
        <Chip
          icon={<InfoOutlinedIcon fontSize="small" />}
          label="Health rules not available — confidence capped"
          size="small"
          variant="outlined"
          color="warning"
          sx={{ mb: 1 }}
          data-testid="topology-confidence-no-health-rules"
        />
      )}

      {/* Degrading factors toggle */}
      {confidence.degradingFactors.length > 0 && (
        <>
          <Box
            sx={{ display: 'flex', alignItems: 'center', gap: 0.5, cursor: 'pointer' }}
            onClick={() => setShowFactors(!showFactors)}
          >
            <Typography variant="caption" color="text.secondary">
              {confidence.degradingFactors.length} degrading factor{confidence.degradingFactors.length !== 1 ? 's' : ''}
            </Typography>
            <IconButton size="small">
              {showFactors ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
            </IconButton>
          </Box>
          <Collapse in={showFactors}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, pl: 1 }}>
              {confidence.degradingFactors.map((factor, idx) => (
                <Tooltip
                  key={idx}
                  title={factor.description}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Chip
                      label={DEGRADING_FACTOR_LABELS[factor.code] ?? factor.code}
                      size="small"
                      variant="outlined"
                      color={factor.impact >= 20 ? 'error' : factor.impact >= 10 ? 'warning' : 'info'}
                    />
                    <Typography variant="caption" color="text.secondary">
                      -{factor.impact} points
                    </Typography>
                  </Box>
                </Tooltip>
              ))}
            </Box>
          </Collapse>
        </>
      )}
    </Box>
  );
};

export default TopologyConfidenceCard;
