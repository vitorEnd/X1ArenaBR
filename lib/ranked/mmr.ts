import {
  RANKED_ELO_K_FACTOR,
  RANKED_MAX_MMR_DELTA,
  RANKED_MIN_MMR_DELTA,
  RANKED_MMR_FLOOR,
} from "./constants.ts";
import type { RankedMmrChange } from "./types";

function assertMmr(value: number, name: string): void {
  if (!Number.isFinite(value) || value < RANKED_MMR_FLOOR) {
    throw new RangeError(`${name} must be at least ${RANKED_MMR_FLOOR}.`);
  }
}

export function calculateExpectedScore(
  playerMmr: number,
  opponentMmr: number,
): number {
  assertMmr(playerMmr, "playerMmr");
  assertMmr(opponentMmr, "opponentMmr");

  return 1 / (1 + 10 ** ((opponentMmr - playerMmr) / 400));
}

export function calculateRankedMmrDelta(
  winnerMmr: number,
  loserMmr: number,
): number {
  const expectedWinner = calculateExpectedScore(winnerMmr, loserMmr);
  const rawDelta = Math.round(RANKED_ELO_K_FACTOR * (1 - expectedWinner));

  return Math.min(
    RANKED_MAX_MMR_DELTA,
    Math.max(RANKED_MIN_MMR_DELTA, rawDelta),
  );
}

export function applyRankedMmrResult(
  winnerMmr: number,
  loserMmr: number,
): RankedMmrChange {
  assertMmr(winnerMmr, "winnerMmr");
  assertMmr(loserMmr, "loserMmr");

  const nominalDelta = calculateRankedMmrDelta(winnerMmr, loserMmr);
  const winnerAfter = Math.trunc(winnerMmr) + nominalDelta;
  const loserAfter = Math.max(
    RANKED_MMR_FLOOR,
    Math.trunc(loserMmr) - nominalDelta,
  );

  return {
    winnerBefore: Math.trunc(winnerMmr),
    winnerAfter,
    loserBefore: Math.trunc(loserMmr),
    loserAfter,
    nominalDelta,
    winnerDelta: winnerAfter - Math.trunc(winnerMmr),
    loserDelta: loserAfter - Math.trunc(loserMmr),
  };
}
