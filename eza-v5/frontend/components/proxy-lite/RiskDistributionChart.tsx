/**
 * RiskDistributionChart Component - Risk distribution visualization
 */

import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

interface RiskDistributionChartProps {
  history?: { low: number; medium: number; high: number; critical: number };
}

export default function RiskDistributionChart({ history }: RiskDistributionChartProps) {
  // Use history if available, otherwise placeholder data
  const data = history || {
    low: 60,
    medium: 25,
    high: 12,
    critical: 3,
  };

  const chartData = [
    { name: 'Düşük', value: data.low, color: '#10B981' },
    { name: 'Orta', value: data.medium, color: '#F59E0B' },
    { name: 'Yüksek', value: data.high, color: '#EF4444' },
    { name: 'Kritik', value: data.critical, color: '#DC2626' },
  ].filter(item => item.value > 0);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h3 className="text-sm font-semibold text-gray-900 mb-4">Risk Dağılımı</h3>
      {!history && (
        <p className="text-xs text-gray-500 mb-4">Örnek veri gösterilmektedir.</p>
      )}
      <ResponsiveContainer width="100%" height={250}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
            outerRadius={80}
            fill="#8884d8"
            dataKey="value"
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value: number) => [`${value}%`, 'Dağılım']}
            contentStyle={{ backgroundColor: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '8px' }}
          />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

