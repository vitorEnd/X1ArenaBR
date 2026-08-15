import type { RankedTier } from "./types";

export const RANKED_MMR_FLOOR = 800;
export const RANKED_PLACEMENT_MATCHES = 5;
export const RANKED_USERNAME_COOLDOWN_MS = 3 * 60 * 60 * 1_000;
export const RANKED_ACCEPTANCE_WINDOW_MS = 15_000;
export const RANKED_CLOSE_MMR_WINDOW_MS = 60_000;
export const RANKED_CLOSE_MMR_DIFFERENCE = 150;
export const RANKED_QUEUE_HEARTBEAT_TIMEOUT_MS = 20_000;
export const RANKED_SCORE_WINDOW_MS = 3 * 60 * 1_000;
export const RANKED_CONFIRMATION_WINDOW_MS = 3 * 60 * 1_000;
export const RANKED_LEADERBOARD_LIMIT = 50;
export const RANKED_CHAMPION_LIMIT = 10;
export const RANKED_CHAMPION_MIN_MMR = 2_500;
export const RANKED_MIN_WIN_MMR_GAIN = 30;
export const RANKED_MAX_WIN_MMR_GAIN = 40;
export const RANKED_MIN_LOSS_MMR = 10;
export const RANKED_MAX_LOSS_MMR = 15;

export const RANKED_TIER_ORDER = [
  "novato",
  "pro",
  "craque",
  "desafiante",
  "immortal",
  "champion",
] as const satisfies readonly RankedTier[];

export const RANKED_TIER_LABELS: Readonly<Record<RankedTier, string>> = {
  novato: "Novato",
  pro: "Pro",
  craque: "Craque",
  desafiante: "Desafiante",
  immortal: "Immortal",
  champion: "Champion",
};

export interface RankedTierRange {
  readonly tier: Exclude<RankedTier, "champion">;
  readonly minMmr: number;
  readonly maxMmr: number | null;
}

/**
 * Champion is positional, so it is intentionally absent from these base ranges.
 * A 2,500+ player outside the global Top 10 remains Immortal.
 */
export const RANKED_BASE_TIER_RANGES = [
  { tier: "novato", minMmr: 800, maxMmr: 999 },
  { tier: "pro", minMmr: 1_000, maxMmr: 1_249 },
  { tier: "craque", minMmr: 1_250, maxMmr: 1_799 },
  { tier: "desafiante", minMmr: 1_800, maxMmr: 2_099 },
  { tier: "immortal", minMmr: 2_100, maxMmr: null },
] as const satisfies readonly RankedTierRange[];

export const RANKED_PLACEMENT_MMR_BY_WINS = [
  800,
  900,
  1_000,
  1_100,
  1_200,
  1_400,
] as const;

/** Durations for each progressive no-accept penalty level, in seconds. */
export const RANKED_NO_ACCEPT_PENALTY_SECONDS = [
  60,
  10 * 60,
  30 * 60,
  60 * 60,
  6 * 60 * 60,
  24 * 60 * 60,
  36 * 60 * 60,
  48 * 60 * 60,
  60 * 60 * 60,
] as const;

export const RANKED_NO_ACCEPT_STRIKES_PER_PENALTY = 3;
