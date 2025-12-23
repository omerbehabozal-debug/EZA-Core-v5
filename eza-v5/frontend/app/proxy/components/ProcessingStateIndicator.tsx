/**
 * Processing State Indicator
 * Calm, intentional, trustworthy processing feedback
 */

"use client";

import { useEffect, useState } from "react";

interface ProcessingStateIndicatorProps {
  message: string;
  isProcessing: boolean;
  className?: string;
}

export default function ProcessingStateIndicator({
  message,
  isProcessing,
  className = "",
}: ProcessingStateIndicatorProps) {
  const [announcement, setAnnouncement] = useState("");

  // Announce state changes for screen readers
  useEffect(() => {
    if (message) {
      setAnnouncement(message);
      // Clear announcement after screen reader has time to read it
      const timer = setTimeout(() => setAnnouncement(""), 1000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  // Debug: Log when component should render
  useEffect(() => {
    if (isProcessing && message) {
      console.log('[ProcessingStateIndicator] Rendering with message:', message);
    } else {
      console.log('[ProcessingStateIndicator] Not rendering - isProcessing:', isProcessing, 'message:', message);
    }
  }, [isProcessing, message]);

  if (!isProcessing || !message) {
    return null;
  }

  return (
    <div 
      className={`space-y-3 ${className}`}
      style={{
        padding: '12px',
        borderRadius: '8px',
        backgroundColor: 'rgba(31, 41, 55, 0.5)', // Subtle dark background for visibility
      }}
    >
      {/* Screen reader announcement */}
      <div
        className="sr-only"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {announcement}
      </div>

      {/* Processing indicator */}
      <div className="flex items-center gap-3">
        {/* Subtle pulsing dot */}
        <div
          className="flex-shrink-0 processing-dot-container"
          style={{
            width: "8px",
            height: "8px",
          }}
        >
          <div
            className="rounded-full processing-dot"
            style={{
              width: "8px",
              height: "8px",
              backgroundColor: "#6B7280", // Neutral gray
            }}
          />
        </div>

        {/* Message */}
        <p
          className="text-sm"
          style={{
            color: "#9CA3AF", // Soft gray text
            fontWeight: 400,
          }}
        >
          {message}
        </p>
      </div>

      {/* Micro-trust message */}
      <p
        className="text-xs"
        style={{
          color: "#6B7280", // Muted gray
          fontStyle: "italic",
          marginTop: "4px",
        }}
      >
        Bu aşamada içerik kaydedilmez, yalnızca analiz edilir.
      </p>

      {/* Subtle animated line (optional, can be removed if too busy) */}
      <div
        className="h-px overflow-hidden processing-line-container"
        style={{
          backgroundColor: "#1F2937", // Dark background
        }}
      >
        <div
          className="h-full processing-line"
          style={{
            width: "30%",
            backgroundColor: "#4B5563", // Soft gray
          }}
        />
      </div>

      {/* CSS animations */}
      <style jsx global>{`
        @keyframes pulse-subtle {
          0%,
          100% {
            opacity: 0.4;
          }
          50% {
            opacity: 0.8;
          }
        }

        @keyframes slide-subtle {
          0% {
            transform: translateX(-100%);
          }
          50% {
            transform: translateX(400%);
          }
          100% {
            transform: translateX(-100%);
          }
        }

        .processing-dot {
          animation: pulse-subtle 2s ease-in-out infinite;
        }

        .processing-line {
          animation: slide-subtle 3s ease-in-out infinite;
        }

        /* Respect reduced motion preference */
        @media (prefers-reduced-motion: reduce) {
          .processing-dot,
          .processing-line {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
          }
        }
      `}</style>
    </div>
  );
}

