/**
 * Same-tab bridge: Ayna early "Yansı oluştur" → ChatInner Review open.
 *
 * Review lifecycle stays owned by StandaloneChatInner (handleEarlyYansiCreate).
 * Observation only requests; it does not mark windows or generate.
 */

export const EARLY_YANSI_REVIEW_REQUEST_EVENT = 'eza:early-yansi-review-request';

/** Fired after Journey mutations that affect the Ayna early-create CTA. */
export const EARLY_YANSI_UI_SYNC_EVENT = 'eza:early-yansi-ui-sync';

export type EarlyYansiReviewRequestDetail = {
  conversationId: string;
};

export type EarlyYansiUiSyncDetail = {
  conversationId: string;
};

export function requestEarlyYansiReview(conversationId: string): void {
  if (typeof window === 'undefined') return;
  const id = conversationId.trim();
  if (!id) return;
  window.dispatchEvent(
    new CustomEvent<EarlyYansiReviewRequestDetail>(EARLY_YANSI_REVIEW_REQUEST_EVENT, {
      detail: { conversationId: id },
    })
  );
}

export function notifyEarlyYansiUiSync(conversationId: string): void {
  if (typeof window === 'undefined') return;
  const id = conversationId.trim();
  if (!id) return;
  window.dispatchEvent(
    new CustomEvent<EarlyYansiUiSyncDetail>(EARLY_YANSI_UI_SYNC_EVENT, {
      detail: { conversationId: id },
    })
  );
}
