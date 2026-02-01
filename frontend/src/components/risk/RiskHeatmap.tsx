import React from 'react';
import {
  Box,
  Typography,
  Paper,
  Tooltip,
  CircularProgress,
} from '@mui/material';

export interface HeatmapCell {
  likelihood: number;
  impact: number;
  count: number;
  band: string;
}

export interface HeatmapData {
  inherent: HeatmapCell[];
  residual: HeatmapCell[];
  totalRisks: number;
}

interface RiskHeatmapProps {
  data: HeatmapData | null;
  loading?: boolean;
  type?: 'inherent' | 'residual';
  onCellClick?: (likelihood: number, impact: number) => void;
}

const LIKELIHOOD_LABELS = ['Rare', 'Unlikely', 'Possible', 'Likely', 'Almost Certain'];
const IMPACT_LABELS = ['Negligible', 'Minor', 'Moderate', 'Major', 'Catastrophic'];

const getBandColor = (band: string): string => {
  switch (band?.toUpperCase()) {
    case 'CRITICAL':
      return '#d32f2f';
    case 'HIGH':
      return '#f57c00';
    case 'MEDIUM':
      return '#fbc02d';
    case 'LOW':
      return '#388e3c';
    default:
      return '#e0e0e0';
  }
};

const getScoreBand = (likelihood: number, impact: number): string => {
  const score = likelihood * impact;
  if (score >= 16) return 'CRITICAL';
  if (score >= 10) return 'HIGH';
  if (score >= 5) return 'MEDIUM';
  return 'LOW';
};

export const RiskHeatmap: React.FC<RiskHeatmapProps> = ({
  data,
  loading = false,
  type = 'inherent',
  onCellClick,
}) => {
  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight={300}>
        <CircularProgress />
      </Box>
    );
  }

  if (!data) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight={300}>
        <Typography color="text.secondary">No heatmap data available</Typography>
      </Box>
    );
  }

  const cells = type === 'inherent' ? data.inherent : data.residual;
  const cellMap = new Map<string, HeatmapCell>();
  cells.forEach((cell) => {
    cellMap.set(`${cell.likelihood}-${cell.impact}`, cell);
  });

  const grid: (HeatmapCell | null)[][] = [];
  for (let likelihood = 5; likelihood >= 1; likelihood--) {
    const row: (HeatmapCell | null)[] = [];
    for (let impact = 1; impact <= 5; impact++) {
      const cell = cellMap.get(`${likelihood}-${impact}`);
      row.push(cell || { likelihood, impact, count: 0, band: getScoreBand(likelihood, impact) });
    }
    grid.push(row);
  }

  return (
    <Paper sx={{ p: 2 }}>
      <Typography variant="h6" gutterBottom>
        {type === 'inherent' ? 'Inherent Risk Heatmap' : 'Residual Risk Heatmap'}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Total Risks: {data.totalRisks}
      </Typography>

      <Box sx={{ display: 'flex', gap: 1 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', mr: 1 }}>
          <Typography
            variant="caption"
            sx={{
              writingMode: 'vertical-rl',
              textOrientation: 'mixed',
              transform: 'rotate(180deg)',
              textAlign: 'center',
              fontWeight: 'bold',
            }}
          >
            Likelihood
          </Typography>
        </Box>

        <Box>
          <Box sx={{ display: 'flex', mb: 0.5, ml: 4 }}>
            {IMPACT_LABELS.map((label, idx) => (
              <Box
                key={idx}
                sx={{
                  width: 60,
                  textAlign: 'center',
                  fontSize: '0.7rem',
                  color: 'text.secondary',
                }}
              >
                {label}
              </Box>
            ))}
          </Box>

          {grid.map((row, rowIdx) => (
            <Box key={rowIdx} sx={{ display: 'flex', alignItems: 'center' }}>
              <Box
                sx={{
                  width: 30,
                  textAlign: 'right',
                  pr: 1,
                  fontSize: '0.7rem',
                  color: 'text.secondary',
                }}
              >
                {LIKELIHOOD_LABELS[4 - rowIdx]}
              </Box>
              {row.map((cell, colIdx) => {
                const band = cell?.band || getScoreBand(5 - rowIdx, colIdx + 1);
                const count = cell?.count || 0;
                return (
                  <Tooltip
                    key={colIdx}
                    title={`Likelihood: ${5 - rowIdx}, Impact: ${colIdx + 1}, Count: ${count}, Band: ${band}`}
                  >
                    <Box
                      onClick={() => onCellClick?.(5 - rowIdx, colIdx + 1)}
                      sx={{
                        width: 60,
                        height: 40,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: getBandColor(band),
                        color: count > 0 ? '#fff' : 'rgba(255,255,255,0.5)',
                        fontWeight: count > 0 ? 'bold' : 'normal',
                        fontSize: '0.9rem',
                        border: '1px solid rgba(255,255,255,0.3)',
                        cursor: onCellClick ? 'pointer' : 'default',
                        '&:hover': onCellClick
                          ? {
                              opacity: 0.8,
                              transform: 'scale(1.05)',
                            }
                          : {},
                        transition: 'all 0.2s',
                      }}
                    >
                      {count > 0 ? count : ''}
                    </Box>
                  </Tooltip>
                );
              })}
            </Box>
          ))}

          <Box sx={{ textAlign: 'center', mt: 1, ml: 4 }}>
            <Typography variant="caption" sx={{ fontWeight: 'bold', color: 'text.secondary' }}>
              Impact
            </Typography>
          </Box>
        </Box>
      </Box>

      <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, mt: 2 }}>
        {['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map((band) => (
          <Box key={band} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Box
              sx={{
                width: 16,
                height: 16,
                backgroundColor: getBandColor(band),
                borderRadius: 1,
              }}
            />
            <Typography variant="caption">{band}</Typography>
          </Box>
        ))}
      </Box>
    </Paper>
  );
};

export default RiskHeatmap;
