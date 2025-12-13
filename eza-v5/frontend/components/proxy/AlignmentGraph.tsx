/**
 * AlignmentGraph Component - Multi-layer alignment visualization
 */

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface AlignmentGraphProps {
  alignment?: any;
  scoreBreakdown?: any;
  deception?: any;
}

export default function AlignmentGraph({ alignment, scoreBreakdown, deception }: AlignmentGraphProps) {
  // Prepare data
  const data = [
    {
      metric: 'Alignment',
      value: alignment?.alignment_score || 0,
    },
    {
      metric: 'EZA Score',
      value: scoreBreakdown?.final_score || 0,
    },
    {
      metric: 'Shield',
      value: (1 - (deception?.score || 0)) * 100 || 0,
    },
  ];

  if (!alignment && !scoreBreakdown) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Alignment Graph</h3>
        <p className="text-sm text-gray-500 text-center py-8">Analiz sonuçlarını görmek için bir mesaj gönderin.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h3 className="text-sm font-semibold text-gray-900 mb-4">Alignment Graph</h3>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
          <XAxis dataKey="metric" tick={{ fontSize: 12 }} stroke="#6B7280" />
          <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} stroke="#6B7280" />
          <Tooltip
            formatter={(value: number) => [value.toFixed(1), 'Score']}
            contentStyle={{ backgroundColor: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '8px' }}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke="#4F46E5"
            strokeWidth={2}
            dot={{ fill: '#4F46E5', r: 4 }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

