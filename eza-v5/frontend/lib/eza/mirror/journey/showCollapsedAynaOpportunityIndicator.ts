/**
 * Collapsed-Ayna silent opportunity hint.
 * Does not open Ayna — visual only when the control is collapsed.
 */
export function showCollapsedAynaOpportunityIndicator(input: {
  aynaClosed: boolean;
  earlyCreateAvailable: boolean;
}): boolean {
  return Boolean(input.aynaClosed && input.earlyCreateAvailable);
}
