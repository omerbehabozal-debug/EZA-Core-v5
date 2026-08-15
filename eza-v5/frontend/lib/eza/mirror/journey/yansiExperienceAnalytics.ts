/**
 * Phase 5–6.0 — Yansı experience events.
 *
 * CustomEvents remain for in-app observers.
 * Durable started/completed/skipped ingest is POST /api/mirror-network/{slug}/experience-events.
 * Observation TTL (`ezaExperience.track`) is not the durable measurement store.
 *
 * STARTED = first frozen-question engagement (not landing, preload, or IO).
 * COMPLETED = final frozen answer reveal.
 * SKIPPED = started, incomplete, left for another Yansı (completedStepCount > 0).
 */

import { buildApiUrl } from '@/lib/apiUrl';
import {
  allocateSkipEventId,
  getOrCreateYansiExperienceSession,
} from './yansiExperienceSession';

export const YANSI_EXPERIENCE_STARTED_EVENT = 'saina:yansi-experience-started';
export const YANSI_EXPERIENCE_COMPLETED_EVENT = 'saina:yansi-experience-completed';
export const YANSI_EXPERIENCE_SKIPPED_EVENT = 'saina:yansi-experience-skipped';

export const YANSI_EXPERIENCE_STARTED = 'yansi_experience_started';
export const YANSI_EXPERIENCE_COMPLETED = 'yansi_experience_completed';
export const YANSI_EXPERIENCE_SKIPPED = 'yansi_experience_skipped';

export type YansiReplayProgressSnapshot = {
  completedStepCount: number;
  replayCompleted: boolean;
  selectedCount?: number;
  journeyVersion?: number;
};

/** Conservative skip gate — started Q/A, left incomplete, not a preload/flicker. */
export function shouldRecordYansiSkip(input: {
  fromSlug: string;
  toSlug: string;
  fromProgress: YansiReplayProgressSnapshot | null | undefined;
}): boolean {
  const from = (input.fromSlug || '').trim().toLowerCase();
  const to = (input.toSlug || '').trim().toLowerCase();
  if (!from || !to || from === to) return false;
  const progress = input.fromProgress;
  if (!progress) return false;
  if (progress.replayCompleted) return false;
  if (progress.completedStepCount <= 0) return false;
  return true;
}

function optionalAuthHeader(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (typeof window === 'undefined') return headers;
  try {
    const token = localStorage.getItem('eza_token');
    if (token) headers.Authorization = `Bearer ${token}`;
  } catch {
    /* guest */
  }
  return headers;
}

function postYansiExperienceEvent(
  slug: string,
  body: Record<string, unknown>
): void {
  if (typeof window === 'undefined') return;
  const path = `/api/mirror-network/${encodeURIComponent(slug)}/experience-events`;
  void (async () => {
    try {
      await fetch(buildApiUrl(path), {
        method: 'POST',
        headers: optionalAuthHeader(),
        body: JSON.stringify(body),
        keepalive: true,
      });
    } catch {
      // Analytics must never block replay.
    }
  })();
}

export function trackYansiExperienceStarted(input: {
  slug: string;
  journeyVersion: number;
  completedStepCount?: number;
}): void {
  if (typeof window === 'undefined') return;
  const slug = input.slug.trim().toLowerCase();
  const session = getOrCreateYansiExperienceSession(slug, input.journeyVersion);
  const occurredAt = new Date().toISOString();
  window.dispatchEvent(
    new CustomEvent(YANSI_EXPERIENCE_STARTED_EVENT, {
      detail: {
        mirrorSlug: slug,
        journeyVersion: input.journeyVersion,
        completedStepCount: input.completedStepCount ?? 0,
        experienceSessionId: session.experienceSessionId,
        at: occurredAt,
      },
    })
  );
  postYansiExperienceEvent(slug, {
    eventId: session.startedEventId,
    experienceSessionId: session.experienceSessionId,
    eventType: YANSI_EXPERIENCE_STARTED,
    journeyVersion: input.journeyVersion,
    completedStepCount: input.completedStepCount ?? 0,
    occurredAt,
  });
}

export function trackYansiExperienceCompleted(input: {
  slug: string;
  journeyVersion: number;
  completedStepCount: number;
}): void {
  if (typeof window === 'undefined') return;
  const slug = input.slug.trim().toLowerCase();
  const session = getOrCreateYansiExperienceSession(slug, input.journeyVersion);
  const occurredAt = new Date().toISOString();
  window.dispatchEvent(
    new CustomEvent(YANSI_EXPERIENCE_COMPLETED_EVENT, {
      detail: {
        mirrorSlug: slug,
        journeyVersion: input.journeyVersion,
        completedStepCount: input.completedStepCount,
        experienceSessionId: session.experienceSessionId,
        at: occurredAt,
      },
    })
  );
  postYansiExperienceEvent(slug, {
    eventId: session.completedEventId,
    experienceSessionId: session.experienceSessionId,
    eventType: YANSI_EXPERIENCE_COMPLETED,
    journeyVersion: input.journeyVersion,
    completedStepCount: input.completedStepCount,
    occurredAt,
  });
}

export function trackYansiExperienceSkipped(input: {
  slug: string;
  journeyVersion: number;
  completedStepCount: number;
  selectedCount: number;
  destinationSlug?: string | null;
}): void {
  if (typeof window === 'undefined') return;
  if (
    !shouldRecordYansiSkip({
      fromSlug: input.slug,
      toSlug: input.destinationSlug || '',
      fromProgress: {
        completedStepCount: input.completedStepCount,
        replayCompleted: false,
        selectedCount: input.selectedCount,
        journeyVersion: input.journeyVersion,
      },
    })
  ) {
    return;
  }
  const slug = input.slug.trim().toLowerCase();
  const destination = (input.destinationSlug || '').trim().toLowerCase() || null;
  if (!destination) return;
  const occurredAt = new Date().toISOString();
  const ids = allocateSkipEventId(
    slug,
    input.journeyVersion,
    input.completedStepCount,
    destination
  );
  window.dispatchEvent(
    new CustomEvent(YANSI_EXPERIENCE_SKIPPED_EVENT, {
      detail: {
        mirrorSlug: slug,
        journeyVersion: input.journeyVersion,
        completedStepCount: input.completedStepCount,
        selectedCount: input.selectedCount,
        destinationSlug: destination,
        experienceSessionId: ids.experienceSessionId,
        at: occurredAt,
      },
    })
  );
  postYansiExperienceEvent(slug, {
    eventId: ids.eventId,
    experienceSessionId: ids.experienceSessionId,
    eventType: YANSI_EXPERIENCE_SKIPPED,
    journeyVersion: input.journeyVersion,
    completedStepCount: input.completedStepCount,
    destinationSlug: destination,
    occurredAt,
  });
}
