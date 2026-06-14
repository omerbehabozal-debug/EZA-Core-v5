'use client';

import '@/lib/eza/matchMediaPolyfill';
import '@/styles/saina-transitions.css';

import { AnimatePresence, motion, type Variants } from 'framer-motion';
import { useEffect, useState, type ReactNode } from 'react';
import { SAINA_MOBILE_MAX_PX } from '@/lib/eza/sainaBreakpoints';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import type { SainaAppView } from '@/lib/eza/sainaRoutes';
import {
  resolveSainaTransitionMode,
  type SainaTransitionMode,
} from '@/lib/eza/sainaTransitionMode';

const DESKTOP_EASE = [0.22, 1, 0.36, 1] as const;

function useNarrowViewport() {
  const [narrow, setNarrow] = useState(false);

  useEffect(() => {
    const query = window.matchMedia(`(max-width: ${SAINA_MOBILE_MAX_PX}px)`);
    const update = () => setNarrow(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  return narrow;
}

function buildGlassVariants(narrow: boolean): Variants {
  if (narrow) {
    return {
      initial: {
        opacity: 0,
        filter: 'blur(4px)',
        scale: 0.997,
        y: 0,
      },
      animate: {
        opacity: 1,
        filter: 'blur(0px)',
        scale: 1,
        y: 0,
        transition: {
          duration: 0.48,
          ease: DESKTOP_EASE,
        },
      },
      exit: {
        opacity: 0,
        filter: 'blur(4px)',
        scale: 1,
        y: 0,
        transition: {
          duration: 0.36,
          ease: DESKTOP_EASE,
        },
      },
    };
  }

  return {
    initial: {
      opacity: 0,
      filter: 'blur(8px)',
      scale: 0.992,
      y: 0,
    },
    animate: {
      opacity: 1,
      filter: 'blur(0px)',
      scale: 1,
      y: 0,
      transition: {
        duration: 0.56,
        ease: DESKTOP_EASE,
      },
    },
    exit: {
      opacity: 0,
      filter: 'blur(6px)',
      scale: 0.995,
      y: 0,
      transition: {
        duration: 0.4,
        ease: DESKTOP_EASE,
      },
    },
  };
}

function buildOpacityVariants(narrow: boolean): Variants {
  return {
    initial: {
      opacity: 0,
      y: 0,
    },
    animate: {
      opacity: 1,
      y: 0,
      transition: {
        duration: narrow ? 0.42 : 0.5,
        ease: DESKTOP_EASE,
      },
    },
    exit: {
      opacity: 0,
      y: 0,
      transition: {
        duration: narrow ? 0.32 : 0.36,
        ease: DESKTOP_EASE,
      },
    },
  };
}

function buildVariants(narrow: boolean, mode: SainaTransitionMode): Variants {
  return mode === 'glass' ? buildGlassVariants(narrow) : buildOpacityVariants(narrow);
}

type SainaRouteTransitionProps = {
  routeKey: SainaAppView;
  children: ReactNode;
};

export default function SainaRouteTransition({ routeKey, children }: SainaRouteTransitionProps) {
  const reducedMotion = useReducedMotion();
  const narrow = useNarrowViewport();
  const [mode, setMode] = useState<SainaTransitionMode>(() => resolveSainaTransitionMode());
  const variants = buildVariants(narrow, mode);

  useEffect(() => {
    setMode(resolveSainaTransitionMode());
  }, []);

  if (reducedMotion) {
    return (
      <div
        className="saina-route-transition saina-route-transition--reduced"
        data-saina-route={routeKey}
      >
        {children}
      </div>
    );
  }

  const transitionClass =
    mode === 'glass' ? 'saina-route-transition' : 'saina-route-transition saina-route-transition--opacity';

  return (
    <AnimatePresence mode="sync" initial={false}>
      <motion.div
        key={routeKey}
        className={transitionClass}
        data-saina-route={routeKey}
        variants={variants}
        initial="initial"
        animate="animate"
        exit="exit"
        style={
          mode === 'glass'
            ? { willChange: 'opacity, filter', transformOrigin: 'center center' }
            : { willChange: 'opacity' }
        }
      >
        <div className="saina-route-transition-glow" aria-hidden />
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
