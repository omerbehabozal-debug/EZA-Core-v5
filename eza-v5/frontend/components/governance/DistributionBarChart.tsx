'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ezaChartTheme } from '@/lib/eza/tokens';
import { cn } from '@/lib/utils';
import EmptyState from '@/components/eza/EmptyState';

export interface DistributionBarChartProps {
  data: Record<string, number>;
  title?: string;
  className?: string;
  emptyTitle?: string;
}

export default function DistributionBarChart({
  data,
  title,
  className,
  emptyTitle = 'Dağılım verisi yok',
}: DistributionBarChartProps) {
  const chartData = Object.entries(data || {}).map(([name, value]) => ({
    name,
    value,
  }));

  if (!chartData.length) {
    return (
      <div className={cn('rounded-xl border border-eza-border bg-eza-surface p-4', className)}>
        {title ? <p className="mb-3 text-sm font-semibold text-eza-text">{title}</p> : null}
        <EmptyState title={emptyTitle} className="py-6" />
      </div>
    );
  }

  return (
    <div className={cn('rounded-xl border border-eza-border bg-eza-surface p-4 sm:p-5', className)}>
      {title ? <p className="mb-4 text-sm font-semibold text-eza-text">{title}</p> : null}
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={chartData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={ezaChartTheme.gridStroke} vertical={false} />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 10, fill: ezaChartTheme.tickFill }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fontSize: 11, fill: ezaChartTheme.tickFill }}
            axisLine={false}
            tickLine={false}
            width={32}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: ezaChartTheme.tooltipBg,
              border: `1px solid ${ezaChartTheme.tooltipBorder}`,
              borderRadius: '8px',
              fontSize: '12px',
            }}
          />
          <Bar dataKey="value" fill={ezaChartTheme.lineStroke} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
