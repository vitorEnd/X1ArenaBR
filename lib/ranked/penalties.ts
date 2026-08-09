import {
  RANKED_NO_ACCEPT_PENALTY_SECONDS,
  RANKED_NO_ACCEPT_STRIKES_PER_PENALTY,
} from "./constants.ts";

export interface NoAcceptProgress {
  readonly strikes: number;
  readonly penaltyLevel: number;
}

export interface NoAcceptOutcome extends NoAcceptProgress {
  readonly penaltySeconds: number | null;
}

function assertProgress(progress: NoAcceptProgress): void {
  if (!Number.isInteger(progress.strikes) || progress.strikes < 0 || progress.strikes > 2) {
    throw new RangeError("strikes must be an integer between 0 and 2.");
  }
  if (
    !Number.isInteger(progress.penaltyLevel) ||
    progress.penaltyLevel < 0 ||
    progress.penaltyLevel > RANKED_NO_ACCEPT_PENALTY_SECONDS.length
  ) {
    throw new RangeError("penaltyLevel is outside the supported progression.");
  }
}

export function recordRankedNoAccept(
  progress: NoAcceptProgress,
): NoAcceptOutcome {
  assertProgress(progress);

  if (progress.strikes + 1 < RANKED_NO_ACCEPT_STRIKES_PER_PENALTY) {
    return {
      strikes: progress.strikes + 1,
      penaltyLevel: progress.penaltyLevel,
      penaltySeconds: null,
    };
  }

  const penaltyLevel = Math.min(
    progress.penaltyLevel + 1,
    RANKED_NO_ACCEPT_PENALTY_SECONDS.length,
  );

  return {
    strikes: 0,
    penaltyLevel,
    penaltySeconds: RANKED_NO_ACCEPT_PENALTY_SECONDS[penaltyLevel - 1],
  };
}

export function resetRankedNoAcceptProgress(): NoAcceptProgress {
  return { strikes: 0, penaltyLevel: 0 };
}
