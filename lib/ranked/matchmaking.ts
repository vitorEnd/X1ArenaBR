import {
  RANKED_CLOSE_MMR_DIFFERENCE,
  RANKED_CLOSE_MMR_WINDOW_MS,
} from "./constants.ts";

export interface MatchmakingCandidate {
  readonly id: string;
  readonly effectiveMmr: number;
  readonly joinedAt: number;
}

export function getRankedMmrDifference(firstMmr: number, secondMmr: number): number {
  return Math.abs(Math.trunc(firstMmr) - Math.trunc(secondMmr));
}

export function hasExpandedRankedSearch(joinedAt: number, now: number): boolean {
  return now - joinedAt >= RANKED_CLOSE_MMR_WINDOW_MS;
}

export function canPairRankedCandidate(
  searcher: MatchmakingCandidate,
  candidate: MatchmakingCandidate,
  now: number,
): boolean {
  if (searcher.id === candidate.id) return false;
  return (
    hasExpandedRankedSearch(searcher.joinedAt, now) ||
    getRankedMmrDifference(searcher.effectiveMmr, candidate.effectiveMmr) <=
      RANKED_CLOSE_MMR_DIFFERENCE
  );
}

export function compareRankedCandidates(
  searcher: MatchmakingCandidate,
  first: MatchmakingCandidate,
  second: MatchmakingCandidate,
  now: number,
): number {
  if (!hasExpandedRankedSearch(searcher.joinedAt, now)) {
    const differenceComparison =
      getRankedMmrDifference(searcher.effectiveMmr, first.effectiveMmr) -
      getRankedMmrDifference(searcher.effectiveMmr, second.effectiveMmr);
    if (differenceComparison !== 0) return differenceComparison;
  }

  return first.joinedAt - second.joinedAt || first.id.localeCompare(second.id);
}
