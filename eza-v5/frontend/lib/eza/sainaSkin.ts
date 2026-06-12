/**
 * SAINA — Conversation Mirror design tokens (dev mock / future product surface).
 * Isolated from standaloneSkin — do not merge into EZA Standalone without sprint approval.
 */

import { cn } from '@/lib/utils';

/** Default shared atmosphere for new conversations (topic-agnostic, until mirror scene replaces it). */
export const DEFAULT_SAINA_CONVERSATION_SCENE = '/saina/default-conversation-scene.png';

/** Shared width for hero, chat card, composer, and suggestion row. */
export const SAINA_CHAT_COLUMN_WIDTH = 'min(68vw, 860px)';

/** Premium top bar search — shorter than full chat column. */
export const SAINA_SEARCH_MAX_WIDTH = '440px';

export const SAINA_COLORS = {
  background: '#F6F4EF',
  frameOuter: '#041B17',
  frameInner: '#061F1B',
  darkGreen: '#0F2B25',
  petrolBlue: '#173B45',
  nightNavy: '#0B1520',
  softGreen: '#6B8A7A',
  gold: '#D4AF37',
  goldSoft: '#D8B16A',
  amber: '#C47A3A',
  sandBeige: '#D9C4A3',
  tealShadow: '#1A4A6E',
  text: '#1E1F20',
  muted: '#6B6B62',
  glassLight: 'rgba(255,255,255,0.78)',
  glassDark: 'rgba(4,27,23,0.72)',
  sceneGlass: 'rgba(246,244,239,0.42)',
  chatColumnMaxWidth: '860px',
  chatColumnWidth: SAINA_CHAT_COLUMN_WIDTH,
  searchMaxWidth: SAINA_SEARCH_MAX_WIDTH,
  mirrorGlass: 'rgba(246,244,239,0.86)',
} as const;

export const sainaSkin = {
  page: 'min-h-[100dvh] w-full overflow-hidden bg-[#F6F4EF] text-[#1E1F20]',

  shell: 'flex h-[100dvh] min-h-0 w-full',

  /* Sidebar */
  sidebar:
    'flex h-full w-[280px] shrink-0 flex-col border-r border-[#0F3D32]/8 bg-[#F6F4EF]/95 backdrop-blur-md lg:w-[300px]',
  sidebarInner: 'flex min-h-0 flex-1 flex-col gap-4 overflow-hidden p-4',
  brandMark:
    'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#D8B16A]/30 to-[#0F3D32]/15 ring-1 ring-[#D8B16A]/35',
  brandTitle: 'text-[15px] font-semibold tracking-[-0.02em] text-[#0F3D32]',
  brandTagline: 'text-[10px] font-medium uppercase tracking-[0.14em] text-[#6B6B62]',
  brandPowered: 'text-[10px] text-[#6B8A7A]',

  sectionLabel:
    'px-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#6B6B62]/90',

  newChatBtn:
    'flex w-full items-center justify-center gap-2 rounded-xl border border-[#0F3D32]/12 bg-white/50 px-3 py-2.5 text-sm font-medium text-[#0F3D32] backdrop-blur-sm transition hover:border-[#0F3D32]/22 hover:bg-white/80',

  convList: 'flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto overscroll-contain pr-0.5',
  convRow:
    'group flex w-full items-start gap-2.5 rounded-2xl p-2 text-left transition hover:bg-white/45',
  convRowActive:
    'bg-gradient-to-r from-[#0F3D32] to-[#1a5245] text-white shadow-[0_8px_24px_rgba(15,61,50,0.22)]',
  convThumb:
    'h-11 w-11 shrink-0 overflow-hidden rounded-xl bg-[#D8B16A]/20 ring-1 ring-black/5',
  convTitle: 'truncate text-[13px] font-semibold leading-tight',
  convPreview: 'mt-0.5 line-clamp-2 text-[11px] leading-snug opacity-80',
  convMeta: 'mt-1 text-[10px] opacity-60',

  premiumCard:
    'rounded-2xl border border-[#D8B16A]/35 bg-gradient-to-br from-[#D8B16A]/18 via-white/55 to-[#0F3D32]/6 p-3.5 backdrop-blur-md',
  premiumBadge: 'text-[10px] font-semibold uppercase tracking-[0.1em] text-[#0F3D32]/80',
  premiumTitle: 'mt-1 text-sm font-semibold text-[#0F3D32]',
  premiumBody: 'mt-1 text-xs leading-relaxed text-[#6B6B62]',
  quotaBar: 'mt-3 h-1.5 overflow-hidden rounded-full bg-[#0F3D32]/10',
  quotaFill: 'h-full rounded-full bg-gradient-to-r from-[#D8B16A] to-[#0F3D32]',
  quotaLabel: 'mt-1.5 flex justify-between text-[10px] text-[#6B6B62]',

  profileCard:
    'flex items-center gap-2.5 rounded-2xl border border-[#0F3D32]/8 bg-white/45 p-2.5 backdrop-blur-sm',
  profileAvatar:
    'flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#0F3D32] text-xs font-semibold text-[#F6F4EF]',
  profileName: 'text-sm font-medium text-[#1E1F20]',
  profilePlan: 'text-[10px] font-medium text-[#D8B16A]',

  /* Main column */
  main: 'flex min-h-0 min-w-0 flex-1 flex-col',
  topBar:
    'flex shrink-0 items-center justify-end gap-2 border-b border-[#0F3D32]/6 bg-[#F6F4EF]/80 px-4 py-3 backdrop-blur-md lg:px-6',
  searchWrap: 'relative hidden max-w-xs flex-1 sm:block',
  searchInput:
    'w-full rounded-full border border-[#0F3D32]/10 bg-white/55 py-2 pl-9 pr-4 text-sm text-[#1E1F20] placeholder:text-[#6B6B62]/70 focus:border-[#0F3D32]/25 focus:outline-none focus:ring-2 focus:ring-[#D8B16A]/25',
  iconBtn:
    'flex h-9 w-9 items-center justify-center rounded-full border border-[#0F3D32]/10 bg-white/50 text-[#0F3D32] transition hover:bg-white/80',

  hero:
    'relative min-h-[200px] shrink-0 overflow-hidden sm:min-h-[240px] lg:min-h-[280px]',
  heroOverlay:
    'pointer-events-none absolute inset-0 bg-gradient-to-t from-[#F6F4EF] via-[#F6F4EF]/20 to-transparent',
  heroContent: 'relative z-10 flex h-full flex-col justify-end p-4 sm:p-6 lg:p-8',
  heroPill:
    'inline-flex w-fit items-center rounded-full border border-white/40 bg-white/25 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.08em] text-white backdrop-blur-md',
  heroTitle: 'mt-3 max-w-2xl text-2xl font-semibold tracking-[-0.03em] text-white sm:text-3xl',
  heroSubtitle: 'mt-2 max-w-xl text-sm leading-relaxed text-white/88',
  metaRow: 'mt-4 flex flex-wrap gap-2',
  metaCard:
    'rounded-xl border border-white/25 bg-white/15 px-3 py-2 text-xs text-white/90 backdrop-blur-md',

  chatScroll: 'min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6 lg:px-8',
  chatCard:
    'mx-auto max-w-3xl rounded-[28px] border border-[#0F3D32]/8 bg-white/72 p-5 shadow-[0_20px_60px_rgba(15,61,50,0.06)] backdrop-blur-xl sm:p-6',
  msgUser:
    'ml-auto max-w-[88%] rounded-2xl rounded-br-md bg-[#0F3D32]/8 px-4 py-3 text-sm leading-relaxed text-[#1E1F20]',
  msgAi:
    'mr-auto max-w-[92%] rounded-2xl rounded-bl-md border border-[#D8B16A]/25 bg-white/80 px-4 py-3 text-sm leading-relaxed text-[#1E1F20] shadow-sm',
  msgLabel: 'mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-[#6B8A7A]',

  composerWrap:
    'shrink-0 border-t border-[#0F3D32]/6 bg-[#F6F4EF]/90 px-4 py-4 backdrop-blur-md sm:px-6 lg:px-8',
  composerInner: 'mx-auto max-w-3xl',
  composerBox:
    'flex items-center gap-2 rounded-2xl border border-[#0F3D32]/10 bg-white/72 px-3 py-2 shadow-sm backdrop-blur-md',
  composerInput:
    'min-w-0 flex-1 bg-transparent px-1 py-2 text-sm text-[#1E1F20] placeholder:text-[#6B6B62]/75 focus:outline-none',
  sendBtn:
    'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#0F3D32] text-white transition hover:bg-[#0a2f27]',
  chipsRow: 'mt-3 flex flex-wrap gap-2',
  chip:
    'rounded-full border border-[#0F3D32]/12 bg-white/55 px-3 py-1.5 text-xs text-[#0F3D32] transition hover:border-[#D8B16A]/45 hover:bg-white/85',

  /* Mirror panel */
  mirrorPanel:
    'flex h-full w-full shrink-0 flex-col border-l border-[#0F3D32]/8 bg-[#F6F4EF]/92 backdrop-blur-md lg:w-[360px]',
  mirrorInner: 'flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4 lg:p-5',
  mirrorTitle: 'text-lg font-semibold tracking-[-0.02em] text-[#0F3D32]',
  mirrorSubtitle: 'mt-1 text-xs leading-relaxed text-[#6B6B62]',

  emptyCard:
    'rounded-[24px] border border-[#0F3D32]/10 bg-white/65 p-5 text-center backdrop-blur-md',
  primaryBtn:
    'mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[#0F3D32] px-4 py-3 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(15,61,50,0.2)] transition hover:bg-[#0a2f27]',
  checklist: 'space-y-2.5',
  checklistItem: 'flex items-start gap-2.5 text-xs leading-relaxed text-[#6B6B62]',
  checklistDot: 'mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[#D8B16A]',

  readyCard:
    'rounded-[24px] border border-[#D8B16A]/35 bg-gradient-to-br from-[#D8B16A]/12 via-white/70 to-white/50 p-4 backdrop-blur-md',
  previewThumb:
    'mt-3 aspect-[9/16] max-h-48 w-full overflow-hidden rounded-2xl bg-gradient-to-br from-[#0F3D32] via-[#6B8A7A] to-[#D8B16A]/60 ring-1 ring-[#D8B16A]/30',
  secondaryBtn:
    'flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-[#0F3D32]/15 bg-white/60 px-3 py-2 text-xs font-medium text-[#0F3D32] transition hover:bg-white/90',

  upsellCard:
    'rounded-2xl border border-[#D8B16A]/30 bg-[#D8B16A]/10 p-4 text-center',
  upsellBtn:
    'mt-3 w-full rounded-xl border border-[#0F3D32]/20 bg-white/70 py-2 text-xs font-semibold text-[#0F3D32] transition hover:bg-white',

  /* Modal */
  modalBackdrop: 'fixed inset-0 z-50 flex items-center justify-center bg-[#0F3D32]/55 p-4 backdrop-blur-sm',
  modalCard:
    'relative max-h-[92dvh] w-full max-w-lg overflow-hidden rounded-[28px] border border-[#D8B16A]/35 bg-[#F6F4EF] shadow-2xl',
  modalClose:
    'absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/80 text-[#0F3D32] transition hover:bg-white',

  /* Mobile tabs */
  mobileTabBar:
    'flex shrink-0 border-t border-[#0F3D32]/8 bg-white/70 backdrop-blur-md lg:hidden',
  mobileTab:
    'flex flex-1 items-center justify-center gap-1.5 py-3 text-xs font-medium text-[#6B6B62]',
  mobileTabActive: 'text-[#0F3D32]',

  footerNote:
    'shrink-0 py-2 text-center text-[10px] text-[#6B6B62]/70',
} as const;

export function sainaCn(...parts: Array<string | false | null | undefined>): string {
  return cn(...parts);
}
