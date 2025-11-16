"use client";

import { useState } from "react";

interface ScoreBreakdownProps {
  title: string;
  data: Record<string, any>;
  collapsible?: boolean;
}

export default function ScoreBreakdown({ title, data, collapsible = true }: ScoreBreakdownProps) {
  const [isOpen, setIsOpen] = useState(!collapsible);
  const [showJson, setShowJson] = useState(false);

  return (
    <div className="glass rounded-xl p-4 border border-panel/50">
      <div
        className="flex items-center justify-between cursor-pointer"
        onClick={() => collapsible && setIsOpen(!isOpen)}
      >
        <h3 className="text-sm font-semibold text-text">{title}</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowJson(!showJson);
            }}
            className="text-xs text-text-dim hover:text-text transition"
          >
            {showJson ? "📊" : "📄"}
          </button>
          {collapsible && (
            <span className="text-text-dim text-xs">{isOpen ? "▼" : "▶"}</span>
          )}
        </div>
      </div>

      {isOpen && (
        <div className="mt-3 space-y-2 animate-fade-in">
          {showJson ? (
            <pre className="text-xs text-text-dim bg-bg-light p-3 rounded-lg overflow-x-auto">
              {JSON.stringify(data, null, 2)}
            </pre>
          ) : (
            <div className="space-y-2">
              {Object.entries(data).map(([key, value]) => {
                if (value === null || value === undefined) return null;
                if (typeof value === "object") return null;

                return (
                  <div key={key} className="flex items-center justify-between">
                    <span className="text-xs text-text-dim capitalize">
                      {key.replace(/_/g, " ")}:
                    </span>
                    <span className="text-xs font-medium text-text">{String(value)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

