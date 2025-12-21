/**
 * Info Tooltip Component
 * Displays an info icon with a tooltip on hover/click
 */

"use client";

import { useState, useRef, useEffect } from "react";

interface InfoTooltipProps {
  content: string;
  position?: "top" | "bottom" | "left" | "right";
}

export default function InfoTooltip({ content, position = "top" }: InfoTooltipProps) {
  const [isOpen, setIsOpen] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (tooltipRef.current && !tooltipRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const positionClasses = {
    top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
    bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
    left: "right-full top-1/2 -translate-y-1/2 mr-2",
    right: "left-full top-1/2 -translate-y-1/2 ml-2",
  };

  return (
    <div className="relative inline-block" ref={tooltipRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        onMouseEnter={() => setIsOpen(true)}
        onMouseLeave={() => setIsOpen(false)}
        className="inline-flex items-center justify-center w-4 h-4 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2"
        style={{
          backgroundColor: "rgba(142, 142, 147, 0.2)",
          color: "#8E8E93",
        }}
        aria-label="Bilgi"
      >
        <svg
          className="w-3 h-3"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      </button>

      {isOpen && (
        <div
          className={`absolute z-50 w-64 p-3 rounded-lg shadow-lg pointer-events-none ${positionClasses[position]}`}
          style={{
            backgroundColor: "#1C1C1E",
            border: "1px solid #2C2C2E",
            color: "#E5E5EA",
          }}
        >
          <p className="text-xs leading-relaxed" style={{ color: "#E5E5EA" }}>
            {content}
          </p>
          {/* Arrow */}
          <div
            className={`absolute w-2 h-2 rotate-45 ${
              position === "top"
                ? "top-full left-1/2 -translate-x-1/2 -mt-1"
                : position === "bottom"
                ? "bottom-full left-1/2 -translate-x-1/2 -mb-1"
                : position === "left"
                ? "left-full top-1/2 -translate-y-1/2 -ml-1"
                : "right-full top-1/2 -translate-y-1/2 -mr-1"
            }`}
            style={{
              backgroundColor: "#1C1C1E",
              borderRight: position === "left" ? "1px solid #2C2C2E" : "none",
              borderBottom: position === "top" ? "1px solid #2C2C2E" : "none",
              borderLeft: position === "right" ? "1px solid #2C2C2E" : "none",
              borderTop: position === "bottom" ? "1px solid #2C2C2E" : "none",
            }}
          />
        </div>
      )}
    </div>
  );
}

