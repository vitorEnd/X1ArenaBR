import {
  RANKED_BASE_TIER_RANGES,
  RANKED_CHAMPION_LIMIT,
  RANKED_CHAMPION_MIN_MMR,
  RANKED_MMR_FLOOR,
  RANKED_TIER_LABELS,
} from "./constants.ts";
import type { RankedTier } from "./types";

export interface RankedStandingInput {
  readonly id: string;
  readonly mmr: number;
  readonly wins: number;
  readonly losses: number;
  /** ISO timestamp for when the current MMR was reached. */
  readonly mmrReachedAt: string;
}

export interface RankedStanding extends RankedStandingInput {
  readonly globalPosition: number;
  readonly tier: RankedTier;
}

export function getBaseRankedTier(mmr: number): Exclude<RankedTier, "champion"> {
  const normalizedMmr = Math.max(RANKED_MMR_FLOOR, Math.trunc(mmr));

  for (const range of RANKED_BASE_TIER_RANGES) {
    if (range.maxMmr === null || normalizedMmr <= range.maxMmr) {
      return range.tier;
    }
  }

  return "immortal";
}

export function isRankedChampion(mmr: number, globalPosition: number | null): boolean {
  return (
    mmr >= RANKED_CHAMPION_MIN_MMR &&
    globalPosition !== null &&
    globalPosition >= 1 &&
    globalPosition <= RANKED_CHAMPION_LIMIT
  );
}

export function getRankedTier(
  mmr: number,
  globalPosition: number | null = null,
): RankedTier {
  return isRankedChampion(mmr, globalPosition)
    ? "champion"
    : getBaseRankedTier(mmr);
}

export function formatRankedTier(
  mmr: number,
  globalPosition: number | null = null,
  locale = "pt-BR",
): string {
  if (isRankedChampion(mmr, globalPosition)) {
    return `TOP ${globalPosition} • ${Math.trunc(mmr).toLocaleString(locale)} MMR`;
  }

  return RANKED_TIER_LABELS[getBaseRankedTier(mmr)];
}

/**
 * Produces the official global order without mutating the input.
 */
export function buildRankedStandings(
  entries: readonly RankedStandingInput[],
): readonly RankedStanding[] {
  return [...entries]
    .sort((first, second) => {
      if (first.mmr !== second.mmr) return second.mmr - first.mmr;
      if (first.wins !== second.wins) return second.wins - first.wins;
      if (first.losses !== second.losses) return first.losses - second.losses;

      const reachedAtComparison = first.mmrReachedAt.localeCompare(
        second.mmrReachedAt,
      );

      return reachedAtComparison || first.id.localeCompare(second.id);
    })
    .map((entry, index) => {
      const globalPosition = index + 1;

      return {
        ...entry,
        globalPosition,
        tier: getRankedTier(entry.mmr, globalPosition),
      };
    });
}
