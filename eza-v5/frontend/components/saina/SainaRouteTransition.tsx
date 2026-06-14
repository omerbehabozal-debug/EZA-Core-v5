'use client';

import '@/styles/saina-transitions.css';

import { AnimatePresence, motion, type Variants } from 'framer-motion';
import { useEffect, useState, type ReactNode } from 'react';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import type { SainaAppView } from '@/lib/eza/sainaRoutes';

const DESKTOP_EASE = [0.22, 1, 0.36, 1] as const;

function useNarrowViewport() {
  const [narrow, setNarrow] = useState(false);

  useEffect(() => {
    const query = window.matchMedia('(max-width: 1023px)');
    const update = () => setNarrow(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  return narrow;
}

function buildVariants(narrow: boolean): Variants {
  const enterBlur = narrow ? '6px' : '10px';
  const exitBlur = narrow ? '6px' : '8px';

  return {
    initial: {
      opacity: 0,
      filter: `blur(${enterBlur})`,
      y: narrow ? 12 : 18,
      scale: 0.985,
    },
    animate: {
      opacity: 1,
      filter: 'blur(0px)',
      y: 0,
      scale: 1,
      transition: {
        duration: narrow ? 0.48 : 0.62,
        ease: DESKTOP_EASE,
      },
    },
    exit: {
      opacity: 0,
      filter: `blur(${exitBlur})`,
      scale: 0.985,
      transition: {
        duration: narrow ? 0.34 : 0.42,
        ease: DESKTOP_EASE,
      },
    },
  };
}

type SainaRouteTransitionProps = {
  routeKey: SainaAppView;
  children: ReactNode;
};

export default function SainaRouteTransition({ routeKey, children }: SainaRouteTransitionProps) {
  const reducedMotion = useReducedMotion();
  const narrow = useNarrowViewport();
  const variants = buildVariants(narrow);

  if (reducedMotion) {
    return (
      <div className="saina-route-transition saina-route-transition--reduced" data-saina-route={routeKey}>
        {children}
      </div>
    );
  }

  return (
    <AnimatePresence mode="sync" initial={false}>
      <motion.div
        key={routeKey}
        className="saina-route-transition"
        data-saina-route={routeKey}
        variants={variants}
        initial="initial"
        animate="animate"
        exit="exit"
        style={{ willChange: 'transform, opacity, filter' }}
      >
        <div className="saina-route-transition-glow" aria-hidden />
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
