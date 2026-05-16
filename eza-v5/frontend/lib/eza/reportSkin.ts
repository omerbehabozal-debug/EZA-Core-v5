/**
 * Etkileşim Raporu — görsel dil (vay-be / Apple Health tarzı).
 * Standalone chat mavisi (standalone-primary) burada kullanılmaz.
 */

export const reportSkin = {
  canvas:
    'report-canvas min-h-full bg-gradient-to-b from-stone-50/90 via-report-surface to-white',

  heroSection:
    'relative flex min-h-[min(88vh,760px)] flex-col items-center justify-center px-4 py-12 text-center sm:px-8',

  heroGlow:
    'pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_75%_55%_at_50%_0%,rgba(13,148,136,0.14),transparent_55%),radial-gradient(ellipse_60%_40%_at_80%_100%,rgba(120,113,108,0.06),transparent)]',

  eyebrow:
    'text-xs font-semibold uppercase tracking-[0.12em] text-report-ink-soft',

  link: 'text-sm font-medium text-report-accent transition-colors hover:text-report-accent-hover hover:underline',

  wowQuote:
    'mt-6 max-w-xl text-2xl font-medium leading-snug tracking-[-0.03em] text-stone-900 sm:text-3xl sm:leading-tight',

  heroSub: 'mt-4 max-w-lg text-sm leading-relaxed text-stone-600',

  heroMuted: 'mt-6 max-w-md text-sm leading-relaxed text-stone-500',

  sectionTitle: 'text-lg font-semibold tracking-[-0.02em] text-stone-900 sm:text-xl',

  sectionSub: 'mt-1 text-sm text-stone-600',

  detailsWrap:
    'border-t border-stone-200/60 bg-gradient-to-b from-white/50 to-transparent px-4 sm:px-0',

  metricCard:
    '!border-stone-200/70 !bg-white/90 shadow-[0_1px_3px_rgba(28,25,23,0.04)] [&_p]:!text-stone-900 [&_.text-eza-text-muted]:!text-stone-500 [&_.text-eza-text-secondary]:!text-stone-600',

  tendencyCard: 'rounded-xl border border-stone-200/60 bg-white/80 p-4 shadow-sm',

  tendencyBadge: 'shrink-0 rounded-full bg-report-muted px-2 py-0.5 text-xs font-medium text-report-ink',

  tendencyBarTrack: 'mt-3 h-1.5 overflow-hidden rounded-full bg-stone-200/50',

  tendencyBarFill: 'h-full rounded-full bg-gradient-to-r from-report-accent to-teal-500/90',

  intensityBar: 'flex-1 rounded-t bg-gradient-to-t from-report-accent/25 to-report-accent/55',

  chart:
    '!border-stone-200/60 !bg-white/85 [&_.recharts-area]:opacity-100',

  disclaimer: 'pb-10 text-center text-xs leading-relaxed text-stone-500',
} as const;

export const reportChartTheme = {
  gridStroke: '#F5F5F4',
  axisStroke: '#A8A29E',
  tickFill: '#78716C',
  lineStroke: '#0D9488',
  areaFill: 'rgba(13, 148, 136, 0.12)',
  tooltipBg: '#FFFFFF',
  tooltipBorder: '#D6D3D1',
} as const;
