import React from 'react';
import { Box, Typography, Tooltip } from '@mui/material';

interface HeatmapCell {
  label: string;
  value: number;
  color?: string;
}

interface HeatmapRow {
  rowLabel: string;
  cells: HeatmapCell[];
}

interface HeatmapProps {
  data: HeatmapRow[];
  columnLabels: string[];
  title?: string;
  colorScale?: {
    min: string;
    mid: string;
    max: string;
  };
  onCellClick?: (rowLabel: string, columnLabel: string, value: number) => void;
}

const getColorForValue = (
  value: number,
  maxValue: number,
  colorScale: { min: string; mid: string; max: string }
): string => {
  if (value === 0) return '#f5f5f5';
  const ratio = Math.min(value / Math.max(maxValue, 1), 1);
  
  if (ratio < 0.5) {
    return colorScale.min;
  } else if (ratio < 0.75) {
    return colorScale.mid;
  }
  return colorScale.max;
};

export const Heatmap: React.FC<HeatmapProps> = ({
  data,
  columnLabels,
  title,
  colorScale = { min: '#fff3e0', mid: '#ffb74d', max: '#e65100' },
  onCellClick,
}) => {
  const maxValue = Math.max(
    ...data.flatMap(row => row.cells.map(cell => cell.value)),
    1
  );

  return (
    <Box>
      {title && (
        <Typography variant="subtitle2" gutterBottom>
          {title}
        </Typography>
      )}
      <Box sx={{ overflowX: 'auto' }}>
        <Box sx={{ display: 'inline-block', minWidth: '100%' }}>
          <Box sx={{ display: 'flex', mb: 1, pl: '120px' }}>
            {columnLabels.map((label, index) => (
              <Box
                key={index}
                sx={{
                  width: 60,
                  textAlign: 'center',
                  fontSize: '0.75rem',
                  fontWeight: 'bold',
                  color: 'text.secondary',
                }}
              >
                {label}
              </Box>
            ))}
          </Box>
          {data.map((row, rowIndex) => (
            <Box key={rowIndex} sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
              <Box
                sx={{
                  width: 120,
                  pr: 1,
                  fontSize: '0.75rem',
                  fontWeight: 500,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                <Tooltip title={row.rowLabel}>
                  <span>{row.rowLabel}</span>
                </Tooltip>
              </Box>
              {row.cells.map((cell, cellIndex) => (
                <Tooltip
                  key={cellIndex}
                  title={`${row.rowLabel} - ${columnLabels[cellIndex]}: ${cell.value}`}
                >
                  <Box
                    sx={{
                      width: 60,
                      height: 32,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: cell.color || getColorForValue(cell.value, maxValue, colorScale),
                      borderRadius: 0.5,
                      cursor: onCellClick ? 'pointer' : 'default',
                      fontSize: '0.75rem',
                      fontWeight: cell.value > 0 ? 'bold' : 'normal',
                      color: cell.value > maxValue * 0.5 ? 'white' : 'text.primary',
                      transition: 'transform 0.1s',
                      '&:hover': onCellClick ? {
                        transform: 'scale(1.05)',
                        boxShadow: 2,
                      } : {},
                    }}
                    onClick={() => onCellClick?.(row.rowLabel, columnLabels[cellIndex], cell.value)}
                  >
                    {cell.value > 0 ? cell.value : '-'}
                  </Box>
                </Tooltip>
              ))}
            </Box>
          ))}
        </Box>
      </Box>
    </Box>
  );
};
