export type CategoryId = "peso-pena" | "peso-medio" | "peso-pesado";

export type PlayerId = string;
export type EventId = string;
export type MatchId = string;

/** Todos os registros publicados pertencem ao conjunto oficial da Arena. */
export type DataStatus = "official";

export interface AttributeRange {
  readonly min: number;
  readonly max: number;
}

export interface Category {
  readonly id: CategoryId;
  readonly slug: CategoryId;
  readonly name: string;
  readonly shortName: string;
  readonly description: string;
  readonly limits: {
    readonly height: AttributeRange;
    readonly width: AttributeRange;
    readonly boost: AttributeRange;
  };
  readonly otherAttributesFree: boolean;
  readonly dataStatus: "official";
}

export type PlayerStatus = "active" | "inactive";
export type PlayerNicknameColor = "purple" | "gold" | "red";

export interface PlayerNickname {
  readonly playerId: PlayerId;
  readonly nickname: string;
  readonly color: PlayerNicknameColor;
}

export interface Player {
  readonly id: PlayerId;
  readonly slug: string;
  readonly name: string;
  readonly avatarUrl: string | null;
  readonly currentCategoryId: CategoryId | null;
  readonly status: PlayerStatus;
  readonly joinedAt?: string | null;
  readonly dataStatus: DataStatus;
}

export type MatchOutcome = "win" | "loss";

export interface OrganizationRankingDecision {
  /** Menor valor recebe prioridade. So e usado dentro de um grupo empatado. */
  readonly order: number;
  readonly reason?: string;
  readonly decidedAt?: string;
}

export interface RankingEntry {
  readonly playerId: PlayerId;
  readonly categoryId: CategoryId;
  readonly wins: number;
  readonly losses: number;
  readonly goalsFor: number;
  readonly goalsAgainst: number;
  readonly knockouts?: number;
  readonly recentForm: readonly MatchOutcome[];
  readonly organizationDecision?: OrganizationRankingDecision;
  readonly dataStatus: DataStatus;
}

export type ChampionType = "official" | "interim";

export interface Champion {
  readonly id: string;
  readonly playerId: PlayerId;
  readonly categoryId: CategoryId;
  readonly type: ChampionType;
  readonly defenses: number;
  readonly wonAt: string;
  readonly dataStatus: DataStatus;
}

export type EventStatus =
  | "announced"
  | "registration-open"
  | "confirmed"
  | "finished"
  | "postponed"
  | "cancelled";

export interface Event {
  readonly id: EventId;
  readonly slug: string;
  readonly name: string;
  readonly startsAt: string;
  readonly timeZone: "America/Sao_Paulo";
  readonly venue: "Park";
  readonly status: EventStatus;
  readonly matchIds: readonly MatchId[];
  readonly dataStatus: DataStatus;
}

export type MatchType =
  | "normal"
  | "challenge"
  | "rematch"
  | "belt"
  | "unification";

export type MatchStatus =
  | "awaiting"
  | "confirmed"
  | "finished"
  | "cancelled";

export type MatchResultMethod =
  | "regular"
  | "golden-goal"
  | "knockout"
  | "walkover";

export interface MatchScore {
  readonly playerA: number;
  readonly playerB: number;
}

export interface MatchResult {
  readonly winnerId: PlayerId;
  /** W.O. nao recebe um placar presumido; nesse caso score deve ser null. */
  readonly score: MatchScore | null;
  readonly method: MatchResultMethod;
}

export interface Match {
  readonly id: MatchId;
  readonly eventId: EventId;
  readonly categoryId: CategoryId;
  readonly playerAId: PlayerId;
  readonly playerBId: PlayerId;
  readonly type: MatchType;
  readonly status: MatchStatus;
  readonly scheduledAt: string | null;
  readonly result: MatchResult | null;
  readonly dataStatus: DataStatus;
}

export type BeltHistoryAction =
  | "won"
  | "defended"
  | "lost"
  | "vacated"
  | "unified";

export interface BeltHistory {
  readonly id: string;
  readonly categoryId: CategoryId;
  readonly playerId: PlayerId;
  readonly championType: ChampionType;
  readonly action: BeltHistoryAction;
  readonly occurredAt: string;
  readonly matchId: MatchId | null;
  readonly dataStatus: DataStatus;
}

export interface Rivalry {
  readonly id: string;
  readonly slug: string;
  readonly playerIds: readonly [PlayerId, PlayerId];
  readonly matchIds: readonly MatchId[];
  readonly status: "active" | "historic";
  readonly dataStatus: DataStatus;
}

export interface GlossaryEntry {
  readonly term: string;
  readonly definition: string;
}

export interface ArenaCreator {
  readonly id: string;
  readonly name: string;
}
