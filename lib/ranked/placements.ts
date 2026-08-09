import {
  RANKED_PLACEMENT_MATCHES,
  RANKED_PLACEMENT_MMR_BY_WINS,
} from "./constants.ts";
import type { RankedPlacementState } from "./types";

function assertPlacementCount(value: number, name: string): void {
  if (!Number.isInteger(value) || value < 0 || value > RANKED_PLACEMENT_MATCHES) {
    throw new RangeError(`${name} must be an integer between 0 and 5.`);
  }
}

export function getPlacementMmr(wins: number): number {
  assertPlacementCount(wins, "wins");
  return RANKED_PLACEMENT_MMR_BY_WINS[wins];
}

export function getRankedPlacementState(
  matchesPlayed: number,
  wins: number,
): RankedPlacementState {
  assertPlacementCount(matchesPlayed, "matchesPlayed");
  assertPlacementCount(wins, "wins");

  if (wins > matchesPlayed) {
    throw new RangeError("wins cannot exceed matchesPlayed.");
  }

  const complete = matchesPlayed === RANKED_PLACEMENT_MATCHES;

  return {
    matchesPlayed,
    wins,
    matchesRemaining: RANKED_PLACEMENT_MATCHES - matchesPlayed,
    complete,
    revealedMmr: complete ? getPlacementMmr(wins) : null,
  };
}

/** Internal queue estimate. Never expose this value before placement completes. */
export function getProvisionalMatchmakingMmr(wins: number): number {
  return getPlacementMmr(wins);
}
