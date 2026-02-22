/**
 * TopologyInsightBanner
 * Compact warning/info banner for topology intelligence insights.
 * Used in Change detail and Major Incident detail pages.
 */
import React from 'react';
import {
  Alert,
  AlertTitle,
  Box,
  Button,
  Typography,
} from '@mui/material';
import HubIcon from '@mui/icons-material/Hub';
import RefreshIcon from '@mui/icons-material/Refresh';
import VisibilityIcon from '@mui/icons-material/Visibility';

import type { TopologyImpactResponseData, RcaTopologyHypothesesResponseData } from '../../services/grcClient';
import { getTopologyRiskLevel, getImpactSummaryText, getRcaSummaryText } from './topology-utils';

export type TopologyInsightContext = 'change' | 'major_incident';

export interface TopologyInsightBannerProps {
  /** Context: change or major_incident */
  context: TopologyInsightContext;
  /** Change topology impact (for change context) */
  changeImpact?: TopologyImpactResponseData | null;
  /** RCA data (for major_incident context) */
  rcaData?: RcaTopologyHypothesesResponseData | null;
  /** Navigate to the topology section/tab */
  onViewDetails?: () => void;
  /** Trigger recalculation */
  onRecalculate?: () => void;
  /** Is recalculating */
  recalculating?: boolean;
}

export const TopologyInsightBanner: React.FC<TopologyInsightBannerProps> = ({
  context,
  changeImpact,
  rcaData,
  onViewDetails,
  onRecalculate,
  recalculating = false,
}) => {
  // Change context
  if (context === 'change') {
    if (!changeImpact) return null;

    const riskLevel = getTopologyRiskLevel(changeImpact.topologyRiskScore);
    const isHighRisk = riskLevel === 'CRITICAL' || riskLevel === 'HIGH';
    const summaryText = getImpactSummaryText(changeImpact);

    if (!isHighRisk && changeImpact.fragilitySignals.length === 0) return null;

    return (
      <Alert
        severity={isHighRisk ? 'warning' : 'info'}
        icon={<HubIcon />}
        data-testid="topology-insight-banner"
        sx={{ mb: 2 }}
        action={
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            {onViewDetails && (
              <Button color="inherit" size="small" startIcon={<VisibilityIcon />} onClick={onViewDetails}>
                View Details
              </Button>
            )}
            {onRecalculate && (
              <Button color="inherit" size="small" startIcon={<RefreshIcon />} onClick={onRecalculate} disabled={recalculating}>
                {recalculating ? 'Recalculating...' : 'Refresh'}
              </Button>
            )}
          </Box>
        }
      >
        <AlertTitle>Topology Impact: {riskLevel}</AlertTitle>
        <Typography variant="body2">
          This change affects {summaryText}.
          {changeImpact.fragilitySignals.length > 0 && (
            <> {changeImpact.fragilitySignals.length} fragility signal{changeImpact.fragilitySignals.length !== 1 ? 's' : ''} detected.</>
          )}
          {changeImpact.metrics.crossServicePropagation && (
            <> Impact propagates across {changeImpact.metrics.crossServiceCount} service boundaries.</>
          )}
        </Typography>
      </Alert>
    );
  }

  // Major incident context
  if (context === 'major_incident') {
    if (!rcaData || !Array.isArray(rcaData.hypotheses) || rcaData.hypotheses.length === 0) return null;

    const topHypothesis = rcaData.hypotheses[0];
    const summaryText = getRcaSummaryText(rcaData.hypotheses);
    const hasHighConfidence = topHypothesis && topHypothesis.score >= 0.6;

    return (
      <Alert
        severity={hasHighConfidence ? 'warning' : 'info'}
        icon={<HubIcon />}
        data-testid="topology-insight-banner"
        sx={{ mb: 2 }}
        action={
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            {onViewDetails && (
              <Button color="inherit" size="small" startIcon={<VisibilityIcon />} onClick={onViewDetails}>
                View Hypotheses
              </Button>
            )}
            {onRecalculate && (
              <Button color="inherit" size="small" startIcon={<RefreshIcon />} onClick={onRecalculate} disabled={recalculating}>
                {recalculating ? 'Recalculating...' : 'Refresh'}
              </Button>
            )}
          </Box>
        }
      >
        <AlertTitle>RCA Topology Analysis</AlertTitle>
        <Typography variant="body2">
          Topology suggests {rcaData.hypotheses.length} likely root cause candidate{rcaData.hypotheses.length !== 1 ? 's' : ''}.{' '}
          {summaryText}.
        </Typography>
      </Alert>
    );
  }

  return null;
};

export default TopologyInsightBanner;
