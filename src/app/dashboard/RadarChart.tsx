'use client'

import {
  Radar,
  RadarChart as RechartsRadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip
} from 'recharts'

export default function RadarChart({ data }: { data: any[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <RechartsRadarChart cx="50%" cy="50%" outerRadius="70%" data={data}>
        <PolarGrid stroke="#333" />
        <PolarAngleAxis dataKey="domain" tick={{ fill: '#aaa', fontSize: 12 }} />
        <PolarRadiusAxis angle={30} domain={[0, 10]} tick={false} axisLine={false} />
        <Radar
          name="Average Score"
          dataKey="score"
          stroke="#4ade80"
          fill="#4ade80"
          fillOpacity={0.4}
        />
        <Tooltip 
          contentStyle={{ backgroundColor: '#111', border: '1px solid #333', borderRadius: '8px' }}
          itemStyle={{ color: '#4ade80' }}
        />
      </RechartsRadarChart>
    </ResponsiveContainer>
  )
}
