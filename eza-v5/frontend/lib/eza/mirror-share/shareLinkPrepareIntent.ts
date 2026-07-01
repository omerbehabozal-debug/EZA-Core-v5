/**
 * Share-link prepare intent — scene refresh must not be dropped while initial publish is in flight.
 */
export function shouldSkipShareLinkPrepare(options: {
  inFlight: boolean;
  refreshScene?: boolean;
}): boolean {
  return options.inFlight && !options.refreshScene;
}
