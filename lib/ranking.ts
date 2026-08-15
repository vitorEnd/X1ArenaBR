import type {
  CategoryId,
  PlayerId,
  RankingEntry,
} from "./types";

export interface CalculatedRankingEntry extends RankingEntry {
  readonly points: number;
  readonly goalDifference: number;
  readonly matchesPlayed: number;
  readonly knockouts: number;
}

export interface RankedStanding extends CalculatedRankingEntry {
  readonly position: number;
  readonly marker: `#${number}`;
}

export interface ChampionStanding extends CalculatedRankingEntry {
  readonly position: null;
  readonly marker: "C";
}

export interface RankingResult {
  readonly categoryId: CategoryId;
  readonly champion: ChampionStanding | null;
  readonly standings: readonly RankedStanding[];
}

/**
 * O resolver deve retornar todos os IDs do grupo, na ordem decidida. Um retorno
 * parcial ou inválido é ignorado para impedir uma classificação inconsistente.
 */
export type RankingTieBreakResolver = (
  tiedEntries: readonly CalculatedRankingEntry[],
) => readonly PlayerId[] | null | undefined;

export interface RankingSortOptions {
  readonly resolveHeadToHead?: RankingTieBreakResolver;
  readonly resolveOrganizationDecision?: RankingTieBreakResolver;
}

export interface BuildCategoryRankingOptions extends RankingSortOptions {
  readonly championPlayerId?: PlayerId | null;
}

export function calculateRankingPoints(wins: number, losses: number): number {
  return wins * 2 - losses;
}

export function calculateGoalDifference(
  goalsFor: number,
  goalsAgainst: number,
): number {
  return goalsFor - goalsAgainst;
}

export function calculateRankingEntry(
  entry: RankingEntry,
): CalculatedRankingEntry {
  return {
    ...entry,
    knockouts: entry.knockouts ?? 0,
    points: calculateRankingPoints(entry.wins, entry.losses),
    goalDifference: calculateGoalDifference(
      entry.goalsFor,
      entry.goalsAgainst,
    ),
    matchesPlayed: entry.wins + entry.losses,
  };
}

function compareOfficialCriteria(
  first: CalculatedRankingEntry,
  second: CalculatedRankingEntry,
): number {
  if (first.points !== second.points) {
    return second.points - first.points;
  }

  if (first.goalDifference !== second.goalDifference) {
    return second.goalDifference - first.goalDifference;
  }

  if (first.losses !== second.losses) {
    return first.losses - second.losses;
  }

  return 0;
}

function isCompleteOrder(
  orderedPlayerIds: readonly PlayerId[] | null | undefined,
  group: readonly CalculatedRankingEntry[],
): orderedPlayerIds is readonly PlayerId[] {
  if (!orderedPlayerIds || orderedPlayerIds.length !== group.length) {
    return false;
  }

  const expectedIds = new Set(group.map((entry) => entry.playerId));
  const receivedIds = new Set(orderedPlayerIds);

  if (
    expectedIds.size !== group.length ||
    receivedIds.size !== orderedPlayerIds.length
  ) {
    return false;
  }

  return orderedPlayerIds.every((playerId) => expectedIds.has(playerId));
}

function applyCompleteOrder(
  group: readonly CalculatedRankingEntry[],
  orderedPlayerIds: readonly PlayerId[],
): CalculatedRankingEntry[] {
  const orderByPlayer = new Map(
    orderedPlayerIds.map((playerId, index) => [playerId, index]),
  );

  return [...group].sort(
    (first, second) =>
      (orderByPlayer.get(first.playerId) ?? Number.MAX_SAFE_INTEGER) -
      (orderByPlayer.get(second.playerId) ?? Number.MAX_SAFE_INTEGER),
  );
}

function getStoredOrganizationOrder(
  group: readonly CalculatedRankingEntry[],
): readonly PlayerId[] | null {
  const hasCompleteDecision = group.every(
    (entry) =>
      entry.organizationDecision &&
      Number.isFinite(entry.organizationDecision.order),
  );

  if (!hasCompleteDecision) {
    return null;
  }

  const decisionOrders = group.map(
    (entry) => entry.organizationDecision?.order,
  );

  if (new Set(decisionOrders).size !== group.length) {
    return null;
  }

  return [...group]
    .sort(
      (first, second) =>
        (first.organizationDecision?.order ?? Number.MAX_SAFE_INTEGER) -
        (second.organizationDecision?.order ?? Number.MAX_SAFE_INTEGER),
    )
    .map((entry) => entry.playerId);
}

function resolveTieGroup(
  group: readonly CalculatedRankingEntry[],
  options: RankingSortOptions,
): CalculatedRankingEntry[] {
  const headToHeadOrder = options.resolveHeadToHead?.([...group]);

  if (isCompleteOrder(headToHeadOrder, group)) {
    return applyCompleteOrder(group, headToHeadOrder);
  }

  const organizationOrder =
    options.resolveOrganizationDecision?.([...group]) ??
    getStoredOrganizationOrder(group);

  if (isCompleteOrder(organizationOrder, group)) {
    return applyCompleteOrder(group, organizationOrder);
  }

  return [...group];
}

/**
 * Aplica pontos, saldo e os critérios oficiais sem alterar o array recebido.
 * A estabilidade preserva a ordem de origem quando nenhum desempate foi
 * oficialmente resolvido.
 */
export function sortRankingEntries(
  entries: readonly RankingEntry[],
  options: RankingSortOptions = {},
): CalculatedRankingEntry[] {
  const sortedByOfficialCriteria = entries
    .map((entry, sourceIndex) => ({
      entry: calculateRankingEntry(entry),
      sourceIndex,
    }))
    .sort(
      (first, second) =>
        compareOfficialCriteria(first.entry, second.entry) ||
        first.sourceIndex - second.sourceIndex,
    );

  const resolved: CalculatedRankingEntry[] = [];
  let groupStart = 0;

  while (groupStart < sortedByOfficialCriteria.length) {
    let groupEnd = groupStart + 1;

    while (
      groupEnd < sortedByOfficialCriteria.length &&
      compareOfficialCriteria(
        sortedByOfficialCriteria[groupStart].entry,
        sortedByOfficialCriteria[groupEnd].entry,
      ) === 0
    ) {
      groupEnd += 1;
    }

    const group = sortedByOfficialCriteria
      .slice(groupStart, groupEnd)
      .map(({ entry }) => entry);

    resolved.push(
      ...(group.length > 1 ? resolveTieGroup(group, options) : group),
    );
    groupStart = groupEnd;
  }

  return resolved;
}

export function separateChampion(
  entries: readonly CalculatedRankingEntry[],
  championPlayerId: PlayerId | null | undefined,
): {
  readonly champion: ChampionStanding | null;
  readonly challengers: readonly CalculatedRankingEntry[];
} {
  if (!championPlayerId) {
    return { champion: null, challengers: [...entries] };
  }

  const championEntry = entries.find(
    (entry) => entry.playerId === championPlayerId,
  );

  if (!championEntry) {
    return { champion: null, challengers: [...entries] };
  }

  return {
    champion: {
      ...championEntry,
      position: null,
      marker: "C",
    },
    challengers: entries.filter(
      (entry) => entry.playerId !== championPlayerId,
    ),
  };
}

export function buildCategoryRanking(
  entries: readonly RankingEntry[],
  categoryId: CategoryId,
  options: BuildCategoryRankingOptions = {},
): RankingResult {
  const categoryEntries = entries.filter(
    (entry) => entry.categoryId === categoryId,
  );
  const calculatedEntries = categoryEntries.map(calculateRankingEntry);
  const { champion, challengers } = separateChampion(
    calculatedEntries,
    options.championPlayerId,
  );
  const standings = sortRankingEntries(challengers, options).map(
    (entry, index): RankedStanding => {
      const position = index + 1;

      return {
        ...entry,
        position,
        marker: `#${position}`,
      };
    },
  );

  return {
    categoryId,
    champion,
    standings,
  };
}
