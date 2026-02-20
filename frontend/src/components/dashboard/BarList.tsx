import React from 'react';
import { Box, Typography, LinearProgress, Tooltip } from '@mui/material';

interface BarListItem {
  label: string;
  value: number;
  color?: string;
  onClick?: () => void;
}

interface BarListProps {
  items: BarListItem[];
  maxValue?: number;
  showValues?: boolean;
  valueFormatter?: (value: number) => string;
  barHeight?: number;
}

export const BarList: React.FC<BarListProps> = ({
  items,
  maxValue,
  showValues = true,
  valueFormatter = (v) => v.toString(),
  barHeight = 8,
}) => {
  const max = maxValue || Math.max(...items.map(item => item.value), 1);

  return (
    <Box sx={{ width: '100%' }}>
      {items.map((item, index) => {
        const percentage = (item.value / max) * 100;
        return (
          <Box
            key={index}
            sx={{
              mb: 1.5,
              cursor: item.onClick ? 'pointer' : 'default',
              '&:hover': item.onClick ? { opacity: 0.8 } : {},
            }}
            onClick={item.onClick}
          >
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
              <Tooltip title={item.label}>
                <Typography
                  variant="body2"
                  sx={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    maxWidth: '70%',
                  }}
                >
                  {item.label}
                </Typography>
              </Tooltip>
              {showValues && (
                <Typography variant="body2" fontWeight="bold">
                  {valueFormatter(item.value)}
                </Typography>
              )}
            </Box>
            <LinearProgress
              variant="determinate"
              value={percentage}
              sx={{
                height: barHeight,
                borderRadius: barHeight / 2,
                backgroundColor: 'grey.200',
                '& .MuiLinearProgress-bar': {
                  backgroundColor: item.color || '#1976d2',
                  borderRadius: barHeight / 2,
                },
              }}
            />
          </Box>
        );
      })}
    </Box>
  );
};
