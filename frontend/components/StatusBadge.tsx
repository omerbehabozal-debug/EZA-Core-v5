/**
 * Status Badge Component
 * Shows data source status (Live/Loading/Backend Offline)
 */

'use client';

interface StatusBadgeProps {
  loading?: boolean;
  live?: boolean;
  className?: string;
}

export default function StatusBadge({ loading, live, className }: StatusBadgeProps) {
  if (loading) {
    return (
      <div className={`text-blue-600 font-semibold ${className || ''}`}>
        🔵 Loading…
      </div>
    );
  }

  if (live) {
    return (
      <div className={`text-green-600 font-semibold ${className || ''}`}>
        🟢 Live data loaded
      </div>
    );
  }

  return (
    <div className={`text-red-600 font-semibold ${className || ''}`}>
      🔴 Backend offline
    </div>
  );
}

