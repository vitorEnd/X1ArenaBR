export interface RankedPrivateProfile {
  readonly id: string;
  readonly username: string;
  readonly avatarPath: string | null;
  readonly wins: number;
  readonly losses: number;
  readonly mmr: number;
  readonly provisionalMmr: number;
  readonly placementMatches: number;
  readonly placementWins: number;
  readonly mmrReachedAt: string;
  readonly lastUsernameChangedAt: string | null;
  readonly queueStrikeCount: number;
  readonly noAcceptPenaltyLevel: number;
  readonly frozenUntil: string | null;
  readonly bannedAt: string | null;
  readonly banReason: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly anonymousMode: boolean;
  readonly anonymousNumber: number | null;
}

type ProfileRecord = Record<string, unknown>;

function numberValue(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

export function normalizeRankedProfile(
  value: unknown,
): RankedPrivateProfile | null {
  if (!value || typeof value !== "object") return null;
  const row = value as ProfileRecord;
  if (typeof row.id !== "string" || typeof row.username !== "string") {
    return null;
  }

  return {
    id: row.id,
    username: row.username,
    avatarPath: nullableString(row.avatar_path),
    wins: numberValue(row.wins),
    losses: numberValue(row.losses),
    mmr: numberValue(row.mmr, 800),
    provisionalMmr: numberValue(row.provisional_mmr, 800),
    placementMatches: numberValue(row.placement_matches),
    placementWins: numberValue(row.placement_wins),
    mmrReachedAt: nullableString(row.mmr_reached_at) ?? new Date(0).toISOString(),
    lastUsernameChangedAt: nullableString(row.last_username_changed_at),
    queueStrikeCount: numberValue(row.queue_strike_count),
    noAcceptPenaltyLevel: numberValue(row.no_accept_penalty_level),
    frozenUntil: nullableString(row.frozen_until),
    bannedAt: nullableString(row.banned_at),
    banReason: nullableString(row.ban_reason),
    createdAt: nullableString(row.created_at) ?? new Date(0).toISOString(),
    updatedAt: nullableString(row.updated_at) ?? new Date(0).toISOString(),
    anonymousMode: row.anonymous_mode === true,
    anonymousNumber: numberValue(row.anonymous_number, 0) || null,
  };
}

export function getUsernameChangeAvailableAt(
  profile: Pick<RankedPrivateProfile, "lastUsernameChangedAt">,
): Date | null {
  if (!profile.lastUsernameChangedAt) return null;
  const changedAt = Date.parse(profile.lastUsernameChangedAt);
  if (!Number.isFinite(changedAt)) return null;
  return new Date(changedAt + 3 * 60 * 60 * 1_000);
}

export function isUsernameChangeAvailable(
  profile: Pick<RankedPrivateProfile, "lastUsernameChangedAt">,
  now = Date.now(),
): boolean {
  const availableAt = getUsernameChangeAvailableAt(profile);
  return !availableAt || availableAt.getTime() <= now;
}
