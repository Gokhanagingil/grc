/**
 * TopologyImpactBucketsCard
 * Visualizes impact bucket breakdown: direct, downstream, critical-path, unknown-confidence.
 * Phase 2 component — renders only when impactBuckets data is available.
 */
import React from 'react';
import {
  Box,
  Typography,
  Chip,
  Tooltip,
} from '@mui/material';
import DirectionsIcon from '@mui/icons-material/Directions';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import PriorityHighIcon from '@mui/icons-material/PriorityHigh';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';

import type { ImpactBucketsSummary } from '../../services/grcClient';

export interface TopologyImpactBucketsCardProps {
  /** Impact buckets summary from Phase-2 backend */
  buckets: ImpactBucketsSummary;
}

interface BucketConfig {
  key: keyof ImpactBucketsSummary;
  label: string;
  description: string;
  color: 'error' | 'warning' | 'info' | 'success';
  icon: React.ReactNode;
}

const BUCKET_CONFIGS: BucketConfig[] = [
  {
    key: 'criticalPath',
    label: 'Critical Path',
    description: 'High-criticality or service-connected nodes on critical dependency paths',
    color: 'error',
    icon: <PriorityHighIcon fontSize="small" />,
  },
  {
    key: 'direct',
    label: 'Direct',
    description: 'Nodes directly connected to root CIs (depth 1)',
    color: 'warning',
    icon: <DirectionsIcon fontSize="small" />,
  },
  {
    key: 'downstream',
    label: 'Downstream',
    description: 'Nodes reachable via downstream dependency chain (depth > 1)',
    color: 'info',
    icon: <AccountTreeIcon fontSize="small" />,
  },
  {
    key: 'unknownConfidence',
    label: 'Unknown Confidence',
    description: 'Nodes with incomplete data (missing class info or isolated)',
    color: 'success',
    icon: <HelpOutlineIcon fontSize="small" />,
  },
];

export const TopologyImpactBucketsCard: React.FC<TopologyImpactBucketsCardProps> = ({
  buckets,
}) => {
  const total = buckets.direct + buckets.downstream + buckets.criticalPath + buckets.unknownConfidence;

  if (total === 0) {
    return (
      <Box data-testid="topology-buckets">
        <Typography variant="subtitle2" gutterBottom>
          Impact Distribution
        </Typography>
        <Typography variant="body2" color="text.secondary">
          No impacted nodes to classify.
        </Typography>
      </Box>
    );
  }

  return (
    <Box data-testid="topology-buckets">
      <Typography variant="subtitle2" gutterBottom>
        Impact Distribution ({total} nodes)
      </Typography>

      {/* Stacked progress bar */}
      <Box sx={{ display: 'flex', height: 8, borderRadius: 1, overflow: 'hidden', mb: 1.5 }}>
        {BUCKET_CONFIGS.map((cfg) => {
          const count = buckets[cfg.key];
          if (count === 0) return null;
          const pct = (count / total) * 100;
          return (
            <Tooltip key={cfg.key} title={`${cfg.label}: ${count} (${pct.toFixed(0)}%)`}>
              <Box
                sx={{
                  width: `${pct}%`,
                  bgcolor: `${cfg.color}.main`,
                  minWidth: count > 0 ? 4 : 0,
                }}
              />
            </Tooltip>
          );
        })}
      </Box>

      {/* Bucket chips */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
        {BUCKET_CONFIGS.map((cfg) => {
          const count = buckets[cfg.key];
          if (count === 0) return null;
          return (
            <Tooltip key={cfg.key} title={cfg.description}>
              <Chip
                icon={cfg.icon as React.ReactElement}
                label={`${cfg.label}: ${count}`}
                size="small"
                color={cfg.color}
                variant="outlined"
                data-testid={`topology-bucket-${cfg.key}`}
              />
            </Tooltip>
          );
        })}
      </Box>
    </Box>
  );
};

export default TopologyImpactBucketsCard;
