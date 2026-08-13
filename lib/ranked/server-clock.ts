const MAX_CLOCK_OFFSET_MS = 24 * 60 * 60 * 1_000;

/**
 * Estimates the difference between the browser clock and the authoritative
 * database clock. The request midpoint compensates for most network latency.
 */
export function calculateServerClockOffset(
  serverNow: string | null | undefined,
  requestStartedAt: number,
  responseReceivedAt: number,
) {
  if (!serverNow) return 0;

  const serverTimestamp = Date.parse(serverNow);
  if (!Number.isFinite(serverTimestamp)) return 0;

  const midpoint = requestStartedAt + (responseReceivedAt - requestStartedAt) / 2;
  const offset = serverTimestamp - midpoint;

  return Math.abs(offset) <= MAX_CLOCK_OFFSET_MS ? offset : 0;
}

export function getAuthoritativeNow(clientNow: number, clockOffsetMs: number) {
  return clientNow + clockOffsetMs;
}

export function getRemainingSeconds(deadline: string, authoritativeNow: number) {
  const deadlineTimestamp = Date.parse(deadline);
  if (!Number.isFinite(deadlineTimestamp)) return 0;
  return Math.max(0, Math.ceil((deadlineTimestamp - authoritativeNow) / 1_000));
}
