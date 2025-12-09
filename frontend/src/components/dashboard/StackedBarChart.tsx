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
} from 'recharts';

interface StackedBarChartProps {
  data: Array<Record<string, string | number>>;
  xAxisKey: string;
  bars: Array<{
    dataKey: string;
    name: string;
    color: string;
    stackId?: string;
  }>;
  height?: number;
  showLegend?: boolean;
  layout?: 'horizontal' | 'vertical';
}

export const StackedBarChart: React.FC<StackedBarChartProps> = ({
  data,
  xAxisKey,
  bars,
  height = 300,
  showLegend = true,
  layout = 'horizontal',
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
              <XAxis dataKey={xAxisKey} tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
            </>
          ) : (
            <>
              <XAxis type="number" tick={{ fontSize: 12 }} />
              <YAxis dataKey={xAxisKey} type="category" tick={{ fontSize: 12 }} width={100} />
            </>
          )}
          <Tooltip />
          {showLegend && <Legend />}
          {bars.map((bar) => (
            <Bar
              key={bar.dataKey}
              dataKey={bar.dataKey}
              name={bar.name}
              fill={bar.color}
              stackId={bar.stackId || 'stack'}
              radius={bar.stackId ? undefined : [4, 4, 0, 0]}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </Box>
  );
};
