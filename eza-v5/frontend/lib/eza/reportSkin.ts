/**
 * Etkileşim Raporu — görsel dil (vay-be / Apple Health tarzı).
 * Standalone chat mavisi (standalone-primary) burada kullanılmaz.
 */

export const reportSkin = {
  canvas:
    'report-canvas min-h-full bg-stone-50',

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

  /** Hero altı — çok küçük, dikkat dağıtmaz */
  heroMuted:
    'mt-10 max-w-sm text-[11px] leading-relaxed text-stone-400/90 sm:text-xs',

  heroHowLink:
    'mt-6 text-sm font-medium text-report-accent/90 underline-offset-4 hover:text-report-accent hover:underline',

  scrollHint:
    'mt-20 flex flex-col items-center gap-0.5 text-[10px] tracking-wide text-stone-400/80 transition-colors hover:text-stone-500',

  /** Son etkileşim — editorial satır */
  featuredBlock: 'mt-10 max-w-lg space-y-10',

  featuredRow: 'flex gap-4',

  featuredEmoji: 'mt-1 text-base leading-none opacity-90',

  featuredLabel: 'text-[11px] font-medium uppercase tracking-[0.08em] text-stone-400',

  featuredSentence: 'mt-1.5 text-[15px] leading-relaxed text-stone-800',

  featuredFootnote: 'mt-12 text-xs leading-relaxed text-stone-400',

  /** Nasıl hesaplandı — hafif, güven odaklı */
  evidenceSoft:
    'rounded-xl bg-stone-50/80 px-4 py-4 sm:px-5 sm:py-5',

  evidenceValue: 'mt-1 text-lg font-medium text-stone-900',

  trendCredibility:
    'mb-6 text-sm leading-relaxed text-stone-500 italic',

  tendencySoft:
    'rounded-lg border-0 bg-stone-50/60 px-4 py-4',

  sectionTitle: 'text-lg font-semibold tracking-[-0.02em] text-stone-900 sm:text-xl',

  sectionSub: 'mt-1 text-sm text-stone-600',

  detailsWrap:
    'border-t border-stone-200/50 px-4 sm:px-0',

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

  /** Günlük gözlem kartı — retention, dashboard değil */
  dailyCard:
    'mx-auto max-w-2xl rounded-2xl border border-stone-200/50 bg-white/75 px-6 py-8 shadow-[0_8px_32px_rgba(28,25,23,0.04)] backdrop-blur-sm sm:px-8',

  dailyEyebrow:
    'text-[11px] font-semibold uppercase tracking-[0.1em] text-report-ink-soft',

  dailySub: 'mt-1 text-sm text-stone-500',

  dailyHeadline:
    'mt-5 text-xl font-medium leading-snug tracking-[-0.02em] text-stone-900 sm:text-[1.35rem]',

  dailyManset:
    'mt-5 text-base font-medium tracking-[-0.01em] text-stone-800 sm:text-lg',

  dailyMirrorBlock: 'mt-6 space-y-5 border-t border-stone-200/40 pt-6',

  dailyMirrorRow: 'space-y-1',

  dailyMirrorLabel:
    'text-[10px] font-semibold uppercase tracking-[0.12em] text-stone-400',

  dailyMirrorSentence: 'text-[15px] leading-relaxed text-stone-800',

  dailySupport: 'mt-6 text-sm leading-relaxed text-stone-500',

  dailyTone: 'mt-2 text-xs text-stone-400',

  dailyPill:
    'rounded-full bg-stone-100/90 px-2.5 py-0.5 text-[10px] font-medium text-stone-600',

  dailyYesterday: 'mt-5 text-xs text-stone-400',

  dailyWeekRow: 'mt-6 flex justify-between gap-1 sm:gap-2',

  dailyWeekCell:
    'flex min-w-0 flex-1 flex-col items-center gap-1 rounded-lg px-0.5 py-1.5 text-center',

  dailyWeekCellToday: 'bg-stone-100/80',

  dailyWeekLabel: 'text-[9px] font-medium uppercase tracking-wide text-stone-400',

  dailyFriday: 'mt-5 text-xs leading-relaxed text-stone-500',
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
