'use client';

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { cn } from '@/lib/utils';
import { ezaChartTheme } from '@/lib/eza/tokens';
import EmptyState from './EmptyState';

export interface TrendChartPoint {
  label: string;
  value: number;
}

export interface TrendChartProps {
  data: TrendChartPoint[];
  title?: string;
  valueLabel?: string;
  height?: number;
  domain?: [number, number];
  className?: string;
  emptyTitle?: string;
}

export default function TrendChart({
  data,
  title,
  valueLabel = 'Değer',
  height = 220,
  domain = [0, 100],
  className,
  emptyTitle = 'Trend için yeterli veri yok',
}: TrendChartProps) {
  if (!data.length) {
    return (
      <div className={cn('rounded-xl border border-eza-border bg-eza-surface p-4', className)}>
        {title ? <p className="mb-3 text-sm font-semibold text-eza-text">{title}</p> : null}
        <EmptyState title={emptyTitle} className="py-8" />
      </div>
    );
  }

  return (
    <div className={cn('rounded-xl border border-eza-border bg-eza-surface p-4 sm:p-5', className)}>
      {title ? <p className="mb-4 text-sm font-semibold text-eza-text">{title}</p> : null}
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={data} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
          <defs>
            <linearGradient id="ezaTrendFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={ezaChartTheme.lineStroke} stopOpacity={0.2} />
              <stop offset="100%" stopColor={ezaChartTheme.lineStroke} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={ezaChartTheme.gridStroke} vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: ezaChartTheme.tickFill }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            domain={domain}
            tick={{ fontSize: 11, fill: ezaChartTheme.tickFill }}
            axisLine={false}
            tickLine={false}
            width={36}
          />
          <Tooltip
            formatter={(value: number) => [value.toFixed(1), valueLabel]}
            contentStyle={{
              backgroundColor: ezaChartTheme.tooltipBg,
              border: `1px solid ${ezaChartTheme.tooltipBorder}`,
              borderRadius: '8px',
              fontSize: '12px',
            }}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke={ezaChartTheme.lineStroke}
            strokeWidth={2}
            fill="url(#ezaTrendFill)"
            dot={{ r: 3, fill: ezaChartTheme.lineStroke, strokeWidth: 0 }}
            activeDot={{ r: 5 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
