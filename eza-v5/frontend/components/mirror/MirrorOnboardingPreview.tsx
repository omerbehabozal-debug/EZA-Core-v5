'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import Image from 'next/image';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  MIRROR_ONBOARDING_PREVIEW_BADGE,
  MIRROR_ONBOARDING_PREVIEW_LABEL,
} from '@/lib/eza/mirror/copy';
import { ONBOARDING_PREVIEW_SLIDES } from '@/lib/eza/mirror/onboardingPreviewSlides';

/** Genişlik tek eksen — yükseklik görselin doğal 9:16 oranından gelir. */
const PREVIEW_WIDTH = 'w-[min(100%,16rem)] sm:w-[17rem]';

const SWIPE_THRESHOLD_PX = 40;
const WHEEL_THRESHOLD_PX = 40;
const WHEEL_BURST_GAP_MS = 45;
const WHEEL_IDLE_MS = 80;
const SLIDE_MS = 320;
const SLIDE_EASING = 'cubic-bezier(0.32, 0.72, 0, 1)';
const SLIDE_TRANSITION = `transform ${SLIDE_MS}ms ${SLIDE_EASING}`;

function normalizeWheelDeltaX(event: WheelEvent, viewportWidth: number): number {
  let delta = event.deltaX;
  if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) delta *= 16;
  else if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE) delta *= viewportWidth;
  return delta;
}

const IMAGE_CLASS = cn(
  'pointer-events-none block h-auto w-full select-none',
  'rounded-[1.25rem]',
  'shadow-[0_12px_40px_-16px_rgba(99,102,241,0.38)]',
  'ring-1 ring-white/75'
);

export interface MirrorOnboardingPreviewProps {
  className?: string;
}

export default function MirrorOnboardingPreview({ className }: MirrorOnboardingPreviewProps) {
  const slideCount = ONBOARDING_PREVIEW_SLIDES.length;
  const [active, setActive] = useState(0);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const viewportRef = useRef<HTMLDivElement>(null);
  const dragStartX = useRef(0);
  const dragPointerId = useRef<number | null>(null);
  const isDraggingRef = useRef(false);
  const activeRef = useRef(0);
  const wheelGestureRef = useRef({ accum: 0, lastEventAt: 0, committed: false });
  const wheelIdleTimerRef = useRef<number | null>(null);

  activeRef.current = active;

  const goTo = useCallback(
    (index: number) => {
      if (slideCount === 0) return;
      setActive(((index % slideCount) + slideCount) % slideCount);
      setDragOffset(0);
    },
    [slideCount]
  );

  const stepSlide = useCallback(
    (direction: -1 | 1) => {
      if (direction < 0) goTo(activeRef.current + 1);
      else goTo(activeRef.current - 1);
    },
    [goTo]
  );

  const goPrev = useCallback(() => stepSlide(1), [stepSlide]);
  const goNext = useCallback(() => stepSlide(-1), [stepSlide]);

  const clampDragOffset = useCallback(
    (delta: number, viewportWidth: number) => {
      const current = activeRef.current;
      const maxPull = viewportWidth * 0.38;
      const clamped = Math.max(-maxPull, Math.min(maxPull, delta));

      if (current === 0 && clamped > 0) return clamped * 0.32;
      if (current === slideCount - 1 && clamped < 0) return clamped * 0.32;
      return clamped;
    },
    [slideCount]
  );

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport || slideCount <= 1) return;

    const resetWheelGesture = () => {
      wheelGestureRef.current = { accum: 0, lastEventAt: 0, committed: false };
      wheelIdleTimerRef.current = null;
    };

    const scheduleWheelIdle = () => {
      if (wheelIdleTimerRef.current !== null) {
        window.clearTimeout(wheelIdleTimerRef.current);
      }
      wheelIdleTimerRef.current = window.setTimeout(resetWheelGesture, WHEEL_IDLE_MS);
    };

    const onWheel = (event: WheelEvent) => {
      if (Math.abs(event.deltaX) <= Math.abs(event.deltaY)) return;

      event.preventDefault();

      const now = performance.now();
      const gesture = wheelGestureRef.current;
      const delta = normalizeWheelDeltaX(event, viewport.clientWidth);

      if (now - gesture.lastEventAt >= WHEEL_BURST_GAP_MS) {
        gesture.accum = 0;
        gesture.committed = false;
      }
      gesture.lastEventAt = now;

      if (gesture.committed) {
        scheduleWheelIdle();
        return;
      }

      gesture.accum += delta;

      if (Math.abs(gesture.accum) < WHEEL_THRESHOLD_PX) {
        scheduleWheelIdle();
        return;
      }

      stepSlide(gesture.accum < 0 ? -1 : 1);
      gesture.committed = true;
      gesture.accum = 0;
      scheduleWheelIdle();
    };

    viewport.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      viewport.removeEventListener('wheel', onWheel);
      if (wheelIdleTimerRef.current !== null) {
        window.clearTimeout(wheelIdleTimerRef.current);
      }
    };
  }, [slideCount, stepSlide]);

  const onTrackPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (slideCount <= 1 || event.button !== 0) return;
    dragStartX.current = event.clientX;
    dragPointerId.current = event.pointerId;
    isDraggingRef.current = true;
    setIsDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onTrackPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current || dragPointerId.current !== event.pointerId) return;
    const delta = event.clientX - dragStartX.current;
    const width = viewportRef.current?.clientWidth ?? 272;
    setDragOffset(clampDragOffset(delta, width));
  };

  const finishDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current || dragPointerId.current !== event.pointerId) return;

    const delta = event.clientX - dragStartX.current;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    isDraggingRef.current = false;
    dragPointerId.current = null;
    setIsDragging(false);

    if (Math.abs(delta) >= SWIPE_THRESHOLD_PX) {
      stepSlide(delta < 0 ? -1 : 1);
    } else {
      setDragOffset(0);
    }
  };

  const trackStyle = {
    transform: `translateX(calc(-${active * 100}% + ${dragOffset}px))`,
    transition: isDragging ? 'none' : SLIDE_TRANSITION,
  };

  return (
    <div className={cn('flex w-full flex-col items-center gap-2', className)}>
      <span className="text-[11px] font-medium tracking-wide text-stone-500">
        {MIRROR_ONBOARDING_PREVIEW_LABEL}
      </span>

      <div
        className={cn('relative shrink-0', PREVIEW_WIDTH)}
        role="region"
        aria-roledescription="carousel"
        aria-label="Örnek ayna kartları"
      >
        <div
          ref={viewportRef}
          className="overflow-hidden rounded-[1.25rem] touch-pan-y"
        >
          <div
            className="flex select-none"
            style={trackStyle}
            onPointerDown={onTrackPointerDown}
            onPointerMove={onTrackPointerMove}
            onPointerUp={finishDrag}
            onPointerCancel={finishDrag}
          >
            {ONBOARDING_PREVIEW_SLIDES.map((slide, index) => (
              <div
                key={slide.id}
                className="relative min-w-full shrink-0 grow-0 basis-full"
                aria-hidden={index !== active}
              >
                <Image
                  src={slide.src}
                  alt={slide.alt}
                  width={540}
                  height={960}
                  priority={index === 0}
                  sizes="(max-width: 640px) 256px, 272px"
                  className={IMAGE_CLASS}
                  draggable={false}
                />
                <span
                  className={cn(
                    'pointer-events-none absolute left-1/2 top-[2.5%] z-10 -translate-x-1/2 whitespace-nowrap',
                    'rounded-full border border-white/70 bg-white/92 px-2.5 py-0.5',
                    'text-[9px] font-semibold tracking-wide text-stone-600 sm:text-[10px]',
                    'shadow-md backdrop-blur-sm'
                  )}
                >
                  {MIRROR_ONBOARDING_PREVIEW_BADGE}
                </span>
              </div>
            ))}
          </div>
        </div>

        {slideCount > 1 ? (
          <>
            <button
              type="button"
              onClick={goPrev}
              className={cn(
                'absolute -left-3 top-[42%] z-20 -translate-y-1/2 sm:-left-3.5',
                'flex h-8 w-8 items-center justify-center rounded-full',
                'border border-white/80 bg-white/95 text-stone-600 shadow-md',
                'transition-colors hover:bg-white hover:text-stone-900',
                'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-violet-400'
              )}
              aria-label="Önceki örnek"
            >
              <ChevronLeft className="h-4 w-4" strokeWidth={2} aria-hidden />
            </button>
            <button
              type="button"
              onClick={goNext}
              className={cn(
                'absolute -right-3 top-[42%] z-20 -translate-y-1/2 sm:-right-3.5',
                'flex h-8 w-8 items-center justify-center rounded-full',
                'border border-white/80 bg-white/95 text-stone-600 shadow-md',
                'transition-colors hover:bg-white hover:text-stone-900',
                'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-violet-400'
              )}
              aria-label="Sonraki örnek"
            >
              <ChevronRight className="h-4 w-4" strokeWidth={2} aria-hidden />
            </button>
          </>
        ) : null}
      </div>

      {slideCount > 1 ? (
        <div
          className="flex items-center justify-center gap-1.5 pt-0.5"
          role="tablist"
          aria-label="Örnek kart seçimi"
        >
          {ONBOARDING_PREVIEW_SLIDES.map((item, index) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={index === active}
              aria-label={item.label}
              onClick={() => goTo(index)}
              className={cn(
                'h-1.5 rounded-full transition-all duration-200',
                index === active
                  ? 'w-5 bg-violet-500'
                  : 'w-1.5 bg-stone-300 hover:bg-stone-400'
              )}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
