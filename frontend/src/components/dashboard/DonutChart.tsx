import React from 'react';
import { Box, Typography } from '@mui/material';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from 'recharts';

interface DonutChartProps {
  data: Array<{
    name: string;
    value: number;
    color: string;
  }>;
  height?: number;
  innerRadius?: number;
  outerRadius?: number;
  showLegend?: boolean;
  centerLabel?: string;
  centerValue?: string | number;
}

export const DonutChart: React.FC<DonutChartProps> = ({
  data,
  height = 300,
  innerRadius = 60,
  outerRadius = 80,
  showLegend = true,
  centerLabel,
  centerValue,
}) => {
  const total = data.reduce((sum, item) => sum + item.value, 0);

  return (
    <Box sx={{ width: '100%', height, position: 'relative' }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={innerRadius}
            outerRadius={outerRadius}
            paddingAngle={2}
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value: number, name: string) => [
              `${value} (${((value / total) * 100).toFixed(1)}%)`,
              name,
            ]}
          />
          {showLegend && <Legend />}
        </PieChart>
      </ResponsiveContainer>
      {(centerLabel || centerValue) && (
        <Box
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            textAlign: 'center',
            pointerEvents: 'none',
          }}
        >
          {centerValue && (
            <Typography variant="h4" fontWeight="bold">
              {centerValue}
            </Typography>
          )}
          {centerLabel && (
            <Typography variant="body2" color="textSecondary">
              {centerLabel}
            </Typography>
          )}
        </Box>
      )}
    </Box>
  );
};
