import React from 'react';
import { Box } from '@mui/material';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface TrendChartProps {
  data: Array<Record<string, string | number>>;
  xAxisKey: string;
  lines: Array<{
    dataKey: string;
    name: string;
    color: string;
    strokeDasharray?: string;
  }>;
  height?: number;
  showGrid?: boolean;
  showLegend?: boolean;
}

export const TrendChart: React.FC<TrendChartProps> = ({
  data,
  xAxisKey,
  lines,
  height = 300,
  showGrid = true,
  showLegend = true,
}) => {
  return (
    <Box sx={{ width: '100%', height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          {showGrid && <CartesianGrid strokeDasharray="3 3" />}
          <XAxis dataKey={xAxisKey} tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip />
          {showLegend && <Legend />}
          {lines.map((line) => (
            <Line
              key={line.dataKey}
              type="monotone"
              dataKey={line.dataKey}
              name={line.name}
              stroke={line.color}
              strokeDasharray={line.strokeDasharray}
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </Box>
  );
};
