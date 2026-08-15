import {
  RANKED_MAX_LOSS_MMR,
  RANKED_MAX_WIN_MMR_GAIN,
  RANKED_MIN_LOSS_MMR,
  RANKED_MIN_WIN_MMR_GAIN,
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
  const range = RANKED_MAX_WIN_MMR_GAIN - RANKED_MIN_WIN_MMR_GAIN;
  const rawDelta = Math.round(RANKED_MIN_WIN_MMR_GAIN + range * (1 - expectedWinner));

  return Math.min(
    RANKED_MAX_WIN_MMR_GAIN,
    Math.max(RANKED_MIN_WIN_MMR_GAIN, rawDelta),
  );
}

export function calculateRankedMmrLoss(
  winnerMmr: number,
  loserMmr: number,
): number {
  const expectedWinner = calculateExpectedScore(winnerMmr, loserMmr);
  const expectedLoser = 1 - expectedWinner;
  const range = RANKED_MAX_LOSS_MMR - RANKED_MIN_LOSS_MMR;
  const rawLoss = Math.round(RANKED_MIN_LOSS_MMR + range * expectedLoser);

  return Math.min(
    RANKED_MAX_LOSS_MMR,
    Math.max(RANKED_MIN_LOSS_MMR, rawLoss),
  );
}

export function applyRankedMmrResult(
  winnerMmr: number,
  loserMmr: number,
): RankedMmrChange {
  assertMmr(winnerMmr, "winnerMmr");
  assertMmr(loserMmr, "loserMmr");

  const nominalDelta = calculateRankedMmrDelta(winnerMmr, loserMmr);
  const loserLoss = calculateRankedMmrLoss(winnerMmr, loserMmr);
  const winnerAfter = Math.trunc(winnerMmr) + nominalDelta;
  const loserAfter = Math.max(
    RANKED_MMR_FLOOR,
    Math.trunc(loserMmr) - loserLoss,
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
