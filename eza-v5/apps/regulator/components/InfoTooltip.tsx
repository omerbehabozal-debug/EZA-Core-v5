/**
 * Info Tooltip Component
 * 
 * Premium non-intrusive tooltip for micro-explanations
 * Uses ⓘ icon with hover/click tooltip
 * Prevents cursor collision with smart positioning
 */

'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

interface InfoTooltipProps {
  text: string;
  className?: string;
  position?: 'top' | 'bottom' | 'left' | 'right' | 'auto';
}

export function InfoTooltip({ 
  text, 
  className = '',
  position = 'auto'
}: InfoTooltipProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState<'top' | 'bottom' | 'left' | 'right'>('bottom');
  const tooltipRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Calculate optimal position to avoid cursor collision
  useEffect(() => {
    if (!isOpen || position !== 'auto' || !buttonRef.current) return;

    // Use requestAnimationFrame to ensure tooltip is rendered
    requestAnimationFrame(() => {
      if (!tooltipRef.current || !buttonRef.current) return;

      const buttonRect = buttonRef.current.getBoundingClientRect();
      const tooltipRect = tooltipRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      // Check available space in each direction (with safe margin for cursor)
      const spaceTop = buttonRect.top;
      const spaceBottom = viewportHeight - buttonRect.bottom;
      const spaceLeft = buttonRect.left;
      const spaceRight = viewportWidth - buttonRect.right;

      // Prefer bottom (most natural), but ensure enough space and cursor won't collide
      // Add extra margin (24px) to prevent cursor collision
      if (spaceBottom >= tooltipRect.height + 24 && spaceBottom > spaceTop) {
        setTooltipPosition('bottom');
      } else if (spaceTop >= tooltipRect.height + 24) {
        setTooltipPosition('top');
      } else if (spaceRight >= tooltipRect.width + 24) {
        setTooltipPosition('right');
      } else if (spaceLeft >= tooltipRect.width + 24) {
        setTooltipPosition('left');
      } else {
        // Fallback to bottom with offset
        setTooltipPosition('bottom');
      }
    });
  }, [isOpen, position]);

  const getTooltipClasses = () => {
    const baseClasses = 'absolute z-[9999] px-4 py-3 text-sm text-gray-50 bg-gradient-to-br from-gray-800 via-gray-900 to-gray-800 rounded-xl shadow-2xl max-w-xs border border-gray-700/50 backdrop-blur-sm transition-all duration-300 ease-out will-change-[opacity,transform]';
    
    const positionClasses = {
      bottom: 'top-full mt-4 left-1/2 -translate-x-1/2',
      top: 'bottom-full mb-4 left-1/2 -translate-x-1/2',
      right: 'left-full ml-4 top-1/2 -translate-y-1/2',
      left: 'right-full mr-4 top-1/2 -translate-y-1/2',
    };

    const arrowClasses = {
      bottom: 'absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-gradient-to-br from-gray-800 to-gray-900 border-l border-t border-gray-700/50 transform rotate-45',
      top: 'absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-gradient-to-br from-gray-800 to-gray-900 border-r border-b border-gray-700/50 transform rotate-45',
      right: 'absolute -left-1.5 top-1/2 -translate-y-1/2 w-3 h-3 bg-gradient-to-br from-gray-800 to-gray-900 border-l border-b border-gray-700/50 transform rotate-45',
      left: 'absolute -right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 bg-gradient-to-br from-gray-800 to-gray-900 border-r border-t border-gray-700/50 transform rotate-45',
    };

    const finalPosition = position === 'auto' ? tooltipPosition : position;

    return {
      container: `${baseClasses} ${positionClasses[finalPosition]} ${isOpen ? 'opacity-100 scale-100 pointer-events-auto' : 'opacity-0 scale-95 pointer-events-none'}`,
      arrow: arrowClasses[finalPosition],
    };
  };

  const handleMouseEnter = useCallback(() => {
    // Clear any pending close timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setIsOpen(true);
  }, []);

  const handleMouseLeave = useCallback(() => {
    // Small delay to allow cursor to move to tooltip
    timeoutRef.current = setTimeout(() => {
      setIsOpen(false);
      timeoutRef.current = null;
    }, 200);
  }, []);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const tooltipClasses = getTooltipClasses();

  return (
    <span className={`inline-flex items-center relative ${className}`}>
      <button
        ref={buttonRef}
        type="button"
        className="inline-flex items-center justify-center w-5 h-5 ml-1.5 text-gray-400 hover:text-regulator-primary focus:outline-none transition-colors duration-200 rounded-full hover:bg-gray-100 focus:ring-2 focus:ring-regulator-primary focus:ring-offset-1"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Bilgi"
      >
        <svg
          className="w-4 h-4"
          fill="currentColor"
          viewBox="0 0 20 20"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            fillRule="evenodd"
            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
            clipRule="evenodd"
          />
        </svg>
      </button>
      {isOpen && (
        <div
          ref={tooltipRef}
          className={tooltipClasses.container}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          role="tooltip"
        >
          <div className={tooltipClasses.arrow}></div>
          <p className="whitespace-normal leading-relaxed text-gray-50 font-normal">
            {text}
          </p>
        </div>
      )}
    </span>
  );
}

