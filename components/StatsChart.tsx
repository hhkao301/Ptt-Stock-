import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { PttPost } from '../types';

interface Props {
  stats: PttPost['stats'];
}

const COLORS = {
  '推': '#10b981', // Green-ish
  '噓': '#ef4444', // Red
  '→': '#94a3b8', // Slate 400
};

const StatsChart: React.FC<Props> = ({ stats }) => {
  const data = [
    { name: '推', value: stats.push },
    { name: '噓', value: stats.boo },
    { name: '→', value: stats.arrow },
  ].filter(d => d.value > 0);

  if (stats.total === 0) return <div className="text-center text-gray-500">無數據</div>;

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={80}
            paddingAngle={5}
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[entry.name as keyof typeof COLORS]} />
            ))}
          </Pie>
          <Tooltip 
            contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151', color: '#f3f4f6' }}
            itemStyle={{ color: '#f3f4f6' }}
          />
          <Legend verticalAlign="bottom" height={36} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};

export default StatsChart;
