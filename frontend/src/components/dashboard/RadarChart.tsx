import React from 'react';
import { Box } from '@mui/material';
import {
  RadarChart as RechartsRadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Legend,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';

interface RadarChartProps {
  data: Array<Record<string, string | number>>;
  dataKey: string;
  nameKey: string;
  series: Array<{
    dataKey: string;
    name: string;
    color: string;
    fillOpacity?: number;
  }>;
  height?: number;
  showLegend?: boolean;
}

export const RadarChart: React.FC<RadarChartProps> = ({
  data,
  nameKey,
  series,
  height = 300,
  showLegend = true,
}) => {
  return (
    <Box sx={{ width: '100%', height }}>
      <ResponsiveContainer width="100%" height="100%">
        <RechartsRadarChart cx="50%" cy="50%" outerRadius="80%" data={data}>
          <PolarGrid />
          <PolarAngleAxis dataKey={nameKey} tick={{ fontSize: 11 }} />
          <PolarRadiusAxis angle={30} domain={[0, 1]} tick={{ fontSize: 10 }} />
          <Tooltip
            formatter={(value: number) => `${(value * 100).toFixed(0)}%`}
          />
          {series.map((s) => (
            <Radar
              key={s.dataKey}
              name={s.name}
              dataKey={s.dataKey}
              stroke={s.color}
              fill={s.color}
              fillOpacity={s.fillOpacity ?? 0.3}
            />
          ))}
          {showLegend && <Legend />}
        </RechartsRadarChart>
      </ResponsiveContainer>
    </Box>
  );
};
