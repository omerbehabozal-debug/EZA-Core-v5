"use client";

export default function LoadingSkeleton() {
  return (
    <div className="w-full p-4 space-y-4 animate-pulse-soft">
      {/* Radial Skeleton */}
      <div className="flex items-center justify-center">
        <div className="w-24 h-24 rounded-full bg-panel/50 border-4 border-panel" />
      </div>

      {/* Bar Skeletons */}
      {[1, 2, 3].map((i) => (
        <div key={i} className="space-y-2">
          <div className="h-3 bg-panel/50 rounded w-1/3" />
          <div className="h-8 bg-panel/50 rounded" />
        </div>
      ))}
    </div>
  );
}

