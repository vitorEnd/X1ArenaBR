export interface MatchmakingCandidate {
  readonly id: string;
  readonly effectiveMmr: number;
  readonly joinedAt: number;
}

export function getRankedMmrDifference(firstMmr: number, secondMmr: number): number {
  return Math.abs(Math.trunc(firstMmr) - Math.trunc(secondMmr));
}

export function hasExpandedRankedSearch(joinedAt: number, now: number): boolean {
  void joinedAt;
  void now;
  return true;
}

export function canPairRankedCandidate(
  searcher: MatchmakingCandidate,
  candidate: MatchmakingCandidate,
  now: number,
): boolean {
  if (searcher.id === candidate.id) return false;
  return hasExpandedRankedSearch(searcher.joinedAt, now);
}

export function compareRankedCandidates(
  searcher: MatchmakingCandidate,
  first: MatchmakingCandidate,
  second: MatchmakingCandidate,
  now: number,
): number {
 void now;
 return first.joinedAt - second.joinedAt || first.id.localeCompare(second.id);
}
