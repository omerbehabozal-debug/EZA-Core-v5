/**
 * Status Badge Component
 * Shows data source status (Live/Loading/Backend Offline)
 */

'use client';

export type StatusType = 'loading' | 'live' | 'preview';

interface StatusBadgeProps {
  status?: StatusType;
  loading?: boolean;
  live?: boolean;
  className?: string;
}

export default function StatusBadge({ status, loading, live, className }: StatusBadgeProps) {
  // Support both old API (loading/live) and new API (status)
  let currentStatus: StatusType = status || (loading ? 'loading' : live ? 'live' : 'preview');

  if (currentStatus === 'loading') {
    return (
      <div className={`text-blue-600 font-semibold ${className || ''}`}>
        🔵 Loading…
      </div>
    );
  }

  if (currentStatus === 'live') {
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

