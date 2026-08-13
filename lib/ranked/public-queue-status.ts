export interface PublicQueueStatusResponse {
  readonly configured: boolean;
  readonly available: boolean;
  readonly active: boolean;
  readonly playersSearching: number;
  readonly activeLobbies: number;
  readonly checkedAt: string;
}

/**
 * Match states that still occupy a live Ranked lobby. Keep this aligned with
 * the support dashboard while exposing only the aggregate count publicly.
 */
export const PUBLIC_ACTIVE_LOBBY_STATUSES = [
  "awaiting_acceptance",
  "lobby",
  "in_progress",
  "awaiting_score",
  "awaiting_confirmation",
] as const;

export function normalizePublicQueueCount(value: unknown): number {
  const count = typeof value === "number" ? value : Number(value);
  return Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
}

export function hasPublicRankedActivity(
  playersSearching: unknown,
  activeLobbies: unknown,
): boolean {
  return (
    normalizePublicQueueCount(playersSearching) > 0 ||
    normalizePublicQueueCount(activeLobbies) > 0
  );
}
