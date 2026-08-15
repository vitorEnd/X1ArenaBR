import type { CategoryId } from "./types";

export type ArenaCardStatus = "draft" | "announced" | "live" | "finished";
export type ArenaCardMatchStatus = "announced" | "live" | "finished";
export type ArenaCardMatchType = "normal" | "belt";

export interface ArenaCardMatch {
  readonly id: string;
  readonly cardId: string;
  readonly position: number;
  readonly categoryId: CategoryId;
  readonly playerAId: string;
  readonly playerBId: string;
  readonly type: ArenaCardMatchType;
  readonly status: ArenaCardMatchStatus;
  readonly scheduledAt: string | null;
  readonly playerAScore: number | null;
  readonly playerBScore: number | null;
  readonly winnerPlayerId: string | null;
}

export interface ArenaCard {
  readonly id: string;
  readonly name: string;
  readonly status: ArenaCardStatus;
  readonly startsAt: string | null;
  readonly venue: "Park";
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly matches: readonly ArenaCardMatch[];
}
