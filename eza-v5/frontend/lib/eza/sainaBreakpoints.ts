/**
 * SAINA responsive shell breakpoints.
 * Design language stays constant; only layout density and navigation change.
 */
export const SAINA_MOBILE_MAX_PX = 899;
export const SAINA_COMPACT_SHELL_MIN_PX = 900;
export const SAINA_FULL_DESKTOP_MIN_PX = 1280;

export const SAINA_SIDEBAR_WIDTH_PX = 288;

export const SAINA_MEDIA_MOBILE = `(max-width: ${SAINA_MOBILE_MAX_PX}px)` as const;
export const SAINA_MEDIA_COMPACT_SHELL = `(min-width: ${SAINA_COMPACT_SHELL_MIN_PX}px)` as const;
export const SAINA_MEDIA_FULL_DESKTOP = `(min-width: ${SAINA_FULL_DESKTOP_MIN_PX}px)` as const;
