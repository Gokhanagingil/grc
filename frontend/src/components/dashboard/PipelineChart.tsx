import React from 'react';
import { Box } from '@mui/material';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts';

interface PipelineChartProps {
  data: Array<{
    name: string;
    value: number;
    color?: string;
  }>;
  height?: number;
  layout?: 'horizontal' | 'vertical';
  showLegend?: boolean;
  colors?: string[];
}

const DEFAULT_COLORS = [
  '#90caf9',
  '#64b5f6',
  '#42a5f5',
  '#2196f3',
  '#1e88e5',
  '#1976d2',
];

export const PipelineChart: React.FC<PipelineChartProps> = ({
  data,
  height = 300,
  layout = 'horizontal',
  showLegend = false,
  colors = DEFAULT_COLORS,
}) => {
  return (
    <Box sx={{ width: '100%', height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout={layout}
          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          {layout === 'horizontal' ? (
            <>
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
            </>
          ) : (
            <>
              <XAxis type="number" tick={{ fontSize: 12 }} />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 12 }} width={100} />
            </>
          )}
          <Tooltip />
          {showLegend && <Legend />}
          <Bar dataKey="value" name="Count" radius={[4, 4, 0, 0]}>
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.color || colors[index % colors.length]}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Box>
  );
};
