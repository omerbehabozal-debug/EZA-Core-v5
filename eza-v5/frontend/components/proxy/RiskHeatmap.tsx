/**
 * RiskHeatmap Component - Engine risk visualization
 */

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface RiskHeatmapProps {
  inputAnalysis?: any;
  outputAnalysis?: any;
  deception?: any;
  psychPressure?: any;
  legalRisk?: any;
}

export default function RiskHeatmap({ inputAnalysis, outputAnalysis, deception, psychPressure, legalRisk }: RiskHeatmapProps) {
  // Prepare data for heatmap
  const data = [
    {
      engine: 'Intent',
      risk: inputAnalysis?.risk_score || 0,
    },
    {
      engine: 'Output',
      risk: outputAnalysis?.risk_score || 0,
    },
    {
      engine: 'Deception',
      risk: deception?.score || 0,
    },
    {
      engine: 'Psych',
      risk: psychPressure?.score || 0,
    },
    {
      engine: 'Legal',
      risk: legalRisk?.risk_score || 0,
    },
  ];

  const getColor = (value: number) => {
    if (value > 0.7) return '#EF4444'; // red
    if (value > 0.4) return '#F59E0B'; // amber
    return '#10B981'; // green
  };

  if (!inputAnalysis && !outputAnalysis) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Risk Heatmap</h3>
        <p className="text-sm text-gray-500 text-center py-8">Analiz sonuçlarını görmek için bir mesaj gönderin.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h3 className="text-sm font-semibold text-gray-900 mb-4">Risk Heatmap</h3>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
          <XAxis type="number" domain={[0, 1]} tick={{ fontSize: 12 }} stroke="#6B7280" />
          <YAxis dataKey="engine" type="category" tick={{ fontSize: 12 }} stroke="#6B7280" width={60} />
          <Tooltip
            formatter={(value: number) => [(value * 100).toFixed(1) + '%', 'Risk']}
            contentStyle={{ backgroundColor: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '8px' }}
          />
          <Bar dataKey="risk" radius={[0, 8, 8, 0]}>
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={getColor(entry.risk)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

