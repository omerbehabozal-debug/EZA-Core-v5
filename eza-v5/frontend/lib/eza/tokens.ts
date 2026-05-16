/**
 * EZA Governance Design System — tokens
 * Light observability theme (Linear / Notion inspired). Separate from proxy dark theme.
 */

export const ezaColors = {
  accent: '#4F46E5',
  accentMuted: '#EEF2FF',
  accentHover: '#4338CA',
  surface: '#FFFFFF',
  surfaceMuted: '#F8FAFC',
  surfaceElevated: '#FFFFFF',
  border: '#E2E8F0',
  borderStrong: '#CBD5E1',
  text: '#0F172A',
  textSecondary: '#475569',
  textMuted: '#94A3B8',
  success: '#059669',
  successMuted: '#ECFDF5',
  warning: '#D97706',
  warningMuted: '#FFFBEB',
  danger: '#DC2626',
  dangerMuted: '#FEF2F2',
  chartGrid: '#F1F5F9',
  chartLine: '#4F46E5',
  chartArea: 'rgba(79, 70, 229, 0.08)',
} as const;

export const ezaRiskColors = {
  low: { bg: '#ECFDF5', text: '#047857', border: '#A7F3D0' },
  medium: { bg: '#FFFBEB', text: '#B45309', border: '#FDE68A' },
  high: { bg: '#FFF7ED', text: '#C2410C', border: '#FDBA74' },
  critical: { bg: '#FEF2F2', text: '#B91C1C', border: '#FECACA' },
  unknown: { bg: '#F1F5F9', text: '#475569', border: '#E2E8F0' },
} as const;

export type EzaRiskLevel = keyof typeof ezaRiskColors;

export const ezaRadius = {
  sm: '0.375rem',
  md: '0.5rem',
  lg: '0.75rem',
  xl: '1rem',
  full: '9999px',
} as const;

export const ezaShadow = {
  sm: '0 1px 2px 0 rgb(15 23 42 / 0.04)',
  md: '0 4px 6px -1px rgb(15 23 42 / 0.06), 0 2px 4px -2px rgb(15 23 42 / 0.04)',
  lg: '0 10px 15px -3px rgb(15 23 42 / 0.06), 0 4px 6px -4px rgb(15 23 42 / 0.04)',
} as const;

export const ezaSpacing = {
  pageX: '1rem',
  pageY: '1.5rem',
  sectionGap: '1.5rem',
  cardPadding: '1.25rem',
} as const;

export const ezaTypography = {
  pageTitle: 'text-xl sm:text-2xl font-semibold tracking-tight text-eza-text',
  sectionTitle: 'text-sm font-semibold text-eza-text',
  label: 'text-[10px] sm:text-xs font-medium uppercase tracking-wide text-eza-text-muted',
  body: 'text-sm text-eza-text-secondary',
  mono: 'font-mono text-xs text-eza-text-secondary',
} as const;

/** Recharts defaults aligned with tokens */
export const ezaChartTheme = {
  gridStroke: ezaColors.chartGrid,
  axisStroke: ezaColors.textMuted,
  tickFill: ezaColors.textSecondary,
  lineStroke: ezaColors.chartLine,
  areaFill: ezaColors.chartArea,
  tooltipBg: ezaColors.surface,
  tooltipBorder: ezaColors.border,
} as const;
