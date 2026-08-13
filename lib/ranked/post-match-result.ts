import type {
  RankedPostMatchRankChange,
  RankedPostMatchResult,
  RankedTier,
} from "../../components/ranked/adapter.ts";
import { getRankedTier } from "./ranks.ts";

const TIER_ORDER: readonly RankedTier[] = [
  "novato",
  "pro",
  "craque",
  "desafiante",
  "immortal",
  "champion",
];

export interface BuildPostMatchResultInput {
  readonly matchId: string;
  readonly matchNumber: number;
  readonly viewerId: string;
  readonly winnerProfileId: string;
  readonly isPlacement: boolean;
  readonly placementMatchesPlayed: number;
  readonly placementMatchesRequired: number;
  readonly currentMmr: number | null;
  readonly currentTier: RankedTier | null;
  readonly oldMmr: number | null;
  readonly newMmr: number | null;
  readonly mmrDelta: number | null;
}

function compareTiers(
  previousTier: RankedTier | null,
  nextTier: RankedTier | null,
): RankedPostMatchRankChange {
  if (!previousTier || !nextTier || previousTier === nextTier) return "unchanged";
  return TIER_ORDER.indexOf(nextTier) > TIER_ORDER.indexOf(previousTier)
    ? "promoted"
    : "demoted";
}

/**
 * Creates the participant-only post-match projection. Placement values stay
 * completely hidden through match four; match five reveals only the final MMR.
 */
export function buildPostMatchResult(
  input: BuildPostMatchResultInput,
): RankedPostMatchResult {
  const outcome = input.viewerId === input.winnerProfileId ? "win" : "loss";

  if (input.isPlacement) {
    const placementPending =
      input.placementMatchesPlayed < input.placementMatchesRequired;
    return {
      matchId: input.matchId,
      matchNumber: input.matchNumber,
      outcome,
      placementPending,
      oldMmr: null,
      newMmr: placementPending ? null : input.currentMmr,
      mmrDelta: null,
      previousTier: null,
      nextTier: placementPending ? null : input.currentTier,
      rankChange: placementPending ? "unchanged" : "placement_revealed",
    };
  }

  const previousTier =
    input.oldMmr === null ? null : getRankedTier(input.oldMmr, null);
  const nextTier =
    input.newMmr === null
      ? null
      : input.currentMmr === input.newMmr && input.currentTier
        ? input.currentTier
        : getRankedTier(input.newMmr, null);

  // A player already above 2,500 who remains Champion must not receive the
  // promotion animation after every win. Exact Top-10 transitions are governed
  // by the current authoritative standing exposed as `nextTier`.
  const stablePreviousTier =
    previousTier === "immortal" &&
    nextTier === "champion" &&
    input.oldMmr !== null &&
    input.oldMmr >= 2_500
      ? "champion"
      : previousTier;

  return {
    matchId: input.matchId,
    matchNumber: input.matchNumber,
    outcome,
    placementPending: false,
    oldMmr: input.oldMmr,
    newMmr: input.newMmr,
    mmrDelta: input.mmrDelta,
    previousTier: stablePreviousTier,
    nextTier,
    rankChange: compareTiers(stablePreviousTier, nextTier),
  };
}
