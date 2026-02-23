/**
 * TopologyRiskFactorsCard
 * Displays explainable risk factors that contribute to the topology risk score.
 * Phase 2 component — renders only when riskFactors data is available.
 * Shows "why this score" breakdown for engineer-credible transparency.
 */
import React from 'react';
import {
  Box,
  Typography,
  Chip,
  Tooltip,
  LinearProgress,
  Collapse,
  IconButton,
} from '@mui/material';
import TuneIcon from '@mui/icons-material/Tune';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';

import type { TopologyRiskFactor } from '../../services/grcClient';
import { getRiskFactorSeverityColor } from './topology-utils';

export interface TopologyRiskFactorsCardProps {
  /** Risk factors from Phase-2 backend */
  factors: TopologyRiskFactor[];
  /** Overall topology risk score for context */
  totalScore?: number;
}

export const TopologyRiskFactorsCard: React.FC<TopologyRiskFactorsCardProps> = ({
  factors,
  totalScore,
}) => {
  const [expanded, setExpanded] = React.useState(false);

  if (factors.length === 0) {
    return null;
  }

  // Sort by contribution descending for display
  const sorted = [...factors].sort((a, b) => b.contribution - a.contribution);

  return (
    <Box data-testid="topology-risk-factors">
      {/* Header */}
      <Box
        sx={{ display: 'flex', alignItems: 'center', gap: 0.5, cursor: 'pointer' }}
        onClick={() => setExpanded(!expanded)}
      >
        <TuneIcon fontSize="small" color="action" />
        <Typography variant="subtitle2">
          Risk Score Breakdown
        </Typography>
        {totalScore !== undefined && (
          <Chip
            label={`${totalScore}/100`}
            size="small"
            variant="outlined"
          />
        )}
        <IconButton size="small">
          {expanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
        </IconButton>
      </Box>

      <Collapse in={expanded}>
        <Box sx={{ mt: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
          {sorted.map((factor) => {
            const pct = factor.maxContribution > 0
              ? (factor.contribution / factor.maxContribution) * 100
              : 0;
            const severityColor = getRiskFactorSeverityColor(factor.severity);

            return (
              <Box key={factor.key} data-testid={`topology-risk-factor-${factor.key}`}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.25 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Chip
                      label={factor.severity}
                      size="small"
                      color={severityColor}
                      variant="outlined"
                      sx={{ height: 18, fontSize: 10, textTransform: 'uppercase' }}
                    />
                    <Typography variant="body2" fontWeight={500}>
                      {factor.label}
                    </Typography>
                  </Box>
                  <Typography variant="caption" color="text.secondary">
                    {factor.contribution.toFixed(1)} / {factor.maxContribution}
                  </Typography>
                </Box>

                <Tooltip title={factor.reason}>
                  <LinearProgress
                    variant="determinate"
                    value={Math.min(pct, 100)}
                    color={severityColor}
                    sx={{ height: 4, borderRadius: 1, mb: 0.25, cursor: 'help' }}
                  />
                </Tooltip>

                <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                  {factor.reason}
                </Typography>
              </Box>
            );
          })}
        </Box>
      </Collapse>

      {/* Compact summary when collapsed */}
      {!expanded && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
          {sorted.slice(0, 3).map((factor) => (
            <Tooltip key={factor.key} title={`${factor.label}: ${factor.reason}`}>
              <Chip
                label={`${factor.label}: ${factor.contribution.toFixed(1)}/${factor.maxContribution}`}
                size="small"
                color={getRiskFactorSeverityColor(factor.severity)}
                variant="outlined"
              />
            </Tooltip>
          ))}
          {sorted.length > 3 && (
            <Chip
              label={`+${sorted.length - 3} more`}
              size="small"
              variant="outlined"
              onClick={() => setExpanded(true)}
            />
          )}
        </Box>
      )}
    </Box>
  );
};

export default TopologyRiskFactorsCard;
