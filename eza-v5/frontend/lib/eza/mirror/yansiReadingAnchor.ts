/** Presentation changes preserve the visible turn, not a document pixel. */
export type ReadingAnchor = { root: HTMLElement; turn: HTMLElement | null; offset: number; top: number };
export function captureReadingAnchor(root: HTMLElement | null): ReadingAnchor | null {
  if (!root) return null;
  const viewport = root.getBoundingClientRect();
  const turn = Array.from(root.querySelectorAll<HTMLElement>('.saina-msg-row')).find((row) => {
    const box = row.getBoundingClientRect();
    return box.bottom > viewport.top && box.top < viewport.bottom;
  }) ?? null;
  return { root, turn, offset: turn ? turn.getBoundingClientRect().top - viewport.top : 0, top: root.scrollTop };
}
export function restoreReadingAnchor(anchor: ReadingAnchor | null): void {
  if (!anchor) return;
  const { root, turn } = anchor;
  root.scrollTop = turn && root.contains(turn)
    ? root.scrollTop + turn.getBoundingClientRect().top - root.getBoundingClientRect().top - anchor.offset
    : anchor.top;
}
