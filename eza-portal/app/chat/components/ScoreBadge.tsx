"use client";

import { useState } from "react";

interface ScoreBadgeProps {
  score: number | string;
  level?: "low" | "medium" | "high" | "critical" | "safe" | "caution";
  label?: string;
  tooltip?: string;
}

export default function ScoreBadge({ score, level, label, tooltip }: ScoreBadgeProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  const getColor = () => {
    if (level === "critical" || level === "high") return "text-danger";
    if (level === "caution" || level === "medium") return "text-warning";
    if (level === "safe" || level === "low") return "text-accent";
    return "text-text-dim";
  };

  const getBgColor = () => {
    if (level === "critical" || level === "high") return "bg-danger/10 border-danger/30";
    if (level === "caution" || level === "medium") return "bg-warning/10 border-warning/30";
    if (level === "safe" || level === "low") return "bg-accent/10 border-accent/30";
    return "bg-panel/50 border-panel";
  };

  return (
    <div className="relative">
      <div
        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border ${getBgColor()} ${getColor()} transition-all`}
        onMouseEnter={() => tooltip && setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        {label && <span className="text-xs font-medium">{label}:</span>}
        <span className="text-sm font-semibold">{score}</span>
      </div>
      {showTooltip && tooltip && (
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 text-xs glass rounded-lg whitespace-nowrap z-50 animate-fade-in">
          {tooltip}
        </div>
      )}
    </div>
  );
}

