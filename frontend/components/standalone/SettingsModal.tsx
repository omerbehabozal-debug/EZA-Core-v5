/**
 * SettingsModal Component - Apple Settings Sheet Style
 * Updated for Standalone: SAFE-only switch and minimal Proxy-Lite info
 */

import { Shield } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  safeOnlyMode: boolean;
  onSafeOnlyModeChange: (enabled: boolean) => void;
}

export default function SettingsModal({ 
  isOpen, 
  onClose, 
  safeOnlyMode, 
  onSafeOnlyModeChange 
}: SettingsModalProps) {
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartY, setDragStartY] = useState<number | null>(null);
  const [currentDragY, setCurrentDragY] = useState<number | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);

  // Minimum swipe distance to trigger close
  const minSwipeDistance = 50;

  // Handle drag from handle bar or header
  const startDrag = (clientY: number) => {
    setDragStartY(clientY);
    setCurrentDragY(clientY);
    setIsDragging(true);
  };

  const updateDrag = (clientY: number) => {
    if (isDragging && dragStartY !== null) {
      setCurrentDragY(clientY);
      const deltaY = clientY - dragStartY;
      if (deltaY > 0 && contentRef.current) {
        // Visual feedback: move modal down
        contentRef.current.style.transform = `translateY(${Math.min(deltaY, 200)}px)`;
        contentRef.current.style.transition = 'none';
      }
    }
  };

  const endDrag = () => {
    if (dragStartY !== null && currentDragY !== null) {
      const distance = currentDragY - dragStartY;
      if (distance > minSwipeDistance) {
        onClose();
      } else {
        // Reset position
        if (contentRef.current) {
          contentRef.current.style.transform = '';
          contentRef.current.style.transition = '';
        }
      }
    }
    setIsDragging(false);
    setDragStartY(null);
    setCurrentDragY(null);
  };

  // Touch events for mobile
  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientY);
    const target = e.target as HTMLElement;
    if (handleRef.current?.contains(target) || headerRef.current?.contains(target)) {
      startDrag(e.targetTouches[0].clientY);
    }
  };

  const onTouchMove = (e: React.TouchEvent) => {
    const currentY = e.targetTouches[0].clientY;
    setTouchEnd(currentY);
    
    if (isDragging && dragStartY !== null) {
      updateDrag(currentY);
      e.preventDefault();
    } else {
      // Check if user is scrolling down within the modal content
      const content = contentRef.current;
      if (content) {
        const scrollTop = content.scrollTop;
        const isAtTop = scrollTop === 0;
        
        // Only allow swipe down if at the top of the content
        if (isAtTop && touchStart !== null) {
          const deltaY = currentY - touchStart;
          
          // If swiping down from top, start dragging
          if (deltaY > 10) {
            const target = e.target as HTMLElement;
            if (handleRef.current?.contains(target) || headerRef.current?.contains(target)) {
              startDrag(currentY);
              e.preventDefault();
            }
          }
        }
      }
    }
  };

  const onTouchEnd = () => {
    if (isDragging) {
      endDrag();
    } else {
      if (!touchStart || !touchEnd) return;
      
      const distance = touchStart - touchEnd;
      const isDownSwipe = touchEnd > touchStart;
      
      // Check if modal is at the top and user swiped down
      const content = contentRef.current;
      if (content && content.scrollTop === 0 && isDownSwipe && distance > minSwipeDistance) {
        onClose();
      }
    }
    
    setTouchStart(null);
    setTouchEnd(null);
  };

  // Mouse events for desktop/touchpad
  const onMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // Only left mouse button
    const target = e.target as HTMLElement;
    if (handleRef.current?.contains(target) || headerRef.current?.contains(target)) {
      startDrag(e.clientY);
      e.preventDefault();
    }
  };

  const onMouseMove = (e: React.MouseEvent) => {
    if (isDragging && dragStartY !== null) {
      updateDrag(e.clientY);
      e.preventDefault();
    }
  };

  const onMouseUp = () => {
    if (isDragging) {
      endDrag();
    }
  };

  // Wheel event for touchpad scroll down
  const onWheel = (e: React.WheelEvent) => {
    const content = contentRef.current;
    if (content) {
      const scrollTop = content.scrollTop;
      const isAtTop = scrollTop === 0;
      
      // If at top and scrolling down, close modal
      if (isAtTop && e.deltaY > 0) {
        const target = e.target as HTMLElement;
        // Only close if scrolling on handle or header area
        if (handleRef.current?.contains(target) || headerRef.current?.contains(target)) {
          onClose();
        } else if (e.deltaY > 100) {
          // Large scroll down gesture
          onClose();
        }
      }
    }
  };

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 animate-fade-in"
        onClick={onClose}
      />
      
      {/* Modal Sheet */}
      <div 
        ref={modalRef}
        className="fixed bottom-0 left-0 right-0 z-50 animate-slide-up safe-area-bottom"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        onWheel={onWheel}
        style={{ touchAction: 'pan-y' }}
      >
        <div 
          ref={contentRef}
          className="max-w-2xl mx-auto bg-white/90 backdrop-blur-xl rounded-t-2xl sm:rounded-t-3xl shadow-2xl border-t border-gray-200/80 max-h-[90vh] overflow-y-auto"
        >
          {/* Handle Bar */}
          <div 
            ref={handleRef}
            className="flex justify-center pt-3 pb-2 cursor-grab active:cursor-grabbing select-none"
            style={{ userSelect: 'none', WebkitUserSelect: 'none' }}
          >
            <div className="w-12 h-1.5 bg-gray-300 rounded-full" />
          </div>
          
          {/* Header */}
          <div 
            ref={headerRef}
            className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200/80 flex items-center justify-center sticky top-0 bg-white/90 backdrop-blur-sm cursor-grab active:cursor-grabbing select-none"
            style={{ userSelect: 'none', WebkitUserSelect: 'none' }}
          >
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900">Ayarlar</h2>
          </div>
          
          {/* Content */}
          <div className="px-4 sm:px-6 py-4 space-y-1">
            {/* SAFE-only Switch */}
            <div className="w-full flex items-center justify-between p-3 sm:p-4 rounded-xl sm:rounded-2xl hover:bg-gray-50 active:bg-gray-100 transition-colors touch-manipulation">
              <div className="flex items-center space-x-2 sm:space-x-3 flex-1 min-w-0">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-green-100 flex items-center justify-center flex-shrink-0">
                  <Shield className="w-4 h-4 sm:w-5 sm:h-5 text-green-600" />
                </div>
                <div className="text-left min-w-0 flex-1">
                  <p className="text-sm sm:text-[15px] font-medium text-gray-900">SAFE-only Modu</p>
                  <p className="text-[10px] sm:text-xs text-gray-500">Güvenli cevaplar için rewrite aktif</p>
                </div>
              </div>
              {/* Toggle Switch */}
              <button
                onClick={() => onSafeOnlyModeChange(!safeOnlyMode)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 touch-manipulation ${
                  safeOnlyMode ? 'bg-green-500' : 'bg-gray-300'
                }`}
                aria-label={safeOnlyMode ? 'Disable SAFE-only mode' : 'Enable SAFE-only mode'}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    safeOnlyMode ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
            
            {/* Proxy-Lite Info (Minimal - No button, no link) */}
            <div className="w-full p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-gray-50/50">
              <p className="text-[10px] sm:text-xs text-gray-600 leading-relaxed">
                Risk skorlarının nasıl hesaplandığını merak ediyorsanız, Proxy-Lite modunda detaylı analizleri inceleyebilirsiniz.
              </p>
              <p className="text-[10px] sm:text-xs text-gray-600 leading-relaxed mt-2">
                Tarayıcıdan: proxy-lite.ezacore.ai
              </p>
            </div>
          </div>
          
          {/* Footer - Removed for minimal design */}
        </div>
      </div>
    </>
  );
}

