export type ArenaCardScoreDraft = {
  readonly a: string;
  readonly b: string;
};

export function canAddArenaCardMatch(status: string): boolean {
  return status === "draft" || status === "announced" || status === "live";
}

export function canEditArenaCardMatch(status: string, isNew: boolean): boolean {
  if (isNew) return canAddArenaCardMatch(status);
  return status === "draft" || status === "announced";
}

export function hasCompleteArenaCardResults<T extends { readonly id: string }>(
  matches: readonly T[],
  scores: Record<string, ArenaCardScoreDraft>,
): boolean {
  if (matches.length === 0) return false;

  return matches.every((match) => {
    const draft = scores[match.id];
    if (!draft) return false;
    if (draft.a.trim() === "" || draft.b.trim() === "") return false;

    const playerAScore = Number.parseInt(draft.a, 10);
    const playerBScore = Number.parseInt(draft.b, 10);

    return (
      Number.isInteger(playerAScore) &&
      Number.isInteger(playerBScore) &&
      playerAScore >= 0 &&
      playerBScore >= 0 &&
      playerAScore !== playerBScore
    );
  });
}
