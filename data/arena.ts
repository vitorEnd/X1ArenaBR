import type {
  ArenaCreator,
  BeltHistory,
  Category,
  Champion,
  Event,
  GlossaryEntry,
  Match,
  Player,
  RankingEntry,
  Rivalry,
} from "../lib/types";

export const DISCORD_URL = "https://discord.gg/DsB6udDVeh";
export const ARENA_NAME = "WOF Arena X1 BR";
export const ARENA_SHORT_NAME = "AXB";
export const ARENA_VENUE = "Park";

export const DEMO_DATA_LABEL = "DADOS DEMONSTRATIVOS — NÃO OFICIAIS";
export const DEMO_DATA_NOTICE =
  "Os nomes e números desta área existem apenas para demonstrar a interface. Não representam jogadores, campeões ou resultados oficiais da AXB.";

export const categories = [
  {
    id: "peso-pena",
    slug: "peso-pena",
    name: "Peso Pena",
    shortName: "Pena",
    description: "Agilidade máxima com dimensões mínimas.",
    limits: {
      height: { min: 0, max: 0 },
      width: { min: 0, max: 0 },
      boost: { min: 0, max: 3 },
    },
    otherAttributesFree: true,
    dataStatus: "official",
  },
  {
    id: "peso-medio",
    slug: "peso-medio",
    name: "Peso Médio",
    shortName: "Médio",
    description: "Equilíbrio entre dimensão e impulso.",
    limits: {
      height: { min: 1, max: 4 },
      width: { min: 1, max: 4 },
      boost: { min: 0, max: 6 },
    },
    otherAttributesFree: true,
    dataStatus: "official",
  },
  {
    id: "peso-pesado",
    slug: "peso-pesado",
    name: "Peso Pesado",
    shortName: "Pesado",
    description: "Dimensões elevadas e impulso liberado até o limite.",
    limits: {
      height: { min: 5, max: 10 },
      width: { min: 5, max: 10 },
      boost: { min: 0, max: 10 },
    },
    otherAttributesFree: true,
    dataStatus: "official",
  },
] as const satisfies readonly Category[];

export const creators = [
  { id: "itz", name: "Itz" },
  { id: "vtzinn021", name: "Vtzinn021" },
  { id: "apenas-joao00325", name: "Apenas João00325" },
] as const satisfies readonly ArenaCreator[];

export const tickerMessages = [
  "EVENTOS SEMANAIS",
  "TODOS OS X1 ACONTECEM NO PARK",
  "RANKING CONTÍNUO",
  "TRÊS CATEGORIAS",
  "DESAFIOS E REVANCHES",
  "CINTURÕES EM DISPUTA",
  "ENTRE PARA A ARENA",
] as const;

export const howItWorks = [
  "Entre no Discord",
  "Escolha sua categoria",
  "Inscreva-se no evento",
  "Dispute seus x1s",
  "Some pontos",
  "Suba no ranking",
  "Entre no Top 5",
  "Desafie o campeão",
  "Conquiste e defenda o cinturão",
] as const;

export const glossary = [
  {
    term: "Evento",
    definition: "Dia em que acontecem os x1s da semana.",
  },
  {
    term: "Ranking",
    definition: "Lista que mostra a posição de cada jogador.",
  },
  {
    term: "Top 5",
    definition: "Os cinco primeiros jogadores do ranking.",
  },
  {
    term: "Campeão — C",
    definition: "Jogador que possui o cinturão da categoria.",
  },
  {
    term: "Desafio",
    definition: "Pedido para enfrentar o campeão pelo cinturão.",
  },
  {
    term: "Defesa",
    definition:
      "Quando o campeão vence um x1 valendo seu cinturão.",
  },
  {
    term: "Campeão interino",
    definition:
      "Campeão temporário que mantém uma categoria ativa enquanto o campeão oficial está ocupado com outro cinturão.",
  },
  {
    term: "Unificação",
    definition:
      "X1 entre o campeão oficial e o interino para decidir o único campeão.",
  },
  {
    term: "W.O.",
    definition:
      "Vitória automática porque o adversário não apareceu ou desistiu depois do prazo.",
  },
  {
    term: "Gol de ouro",
    definition:
      "Depois de um empate, o primeiro jogador que fizer um gol vence.",
  },
  {
    term: "Nocaute",
    definition:
      "Vitória por pelo menos três gols de diferença sem sofrer nenhum gol.",
  },
] as const satisfies readonly GlossaryEntry[];

export const arenaRules = {
  competition: {
    summary:
      "A WOF Arena X1 BR é uma competição semanal de x1 do World of Football.",
    format:
      "Não existe chaveamento, mata-mata ou eliminação. Cada evento possui vários x1s separados. Vencer melhora a posição do jogador; perder não o elimina da Arena.",
    playerHistory: [
      "Vitórias e derrotas",
      "Pontos no ranking",
      "Saldo de gols",
      "Rivalidades e revanches",
      "Desafios",
      "Cinturões",
      "Defesas de cinturão",
    ],
    rankingContinuity:
      "O ranking é contínuo. Não existem temporadas e os resultados nunca são apagados.",
    venue: "Todos os eventos acontecem no Park.",
  },
  firstCategory:
    "Na primeira inscrição, o jogador escolhe em qual categoria deseja começar.",
  categoryChange: {
    eligibility:
      "O jogador pode mudar de categoria depois de completar cinco x1s.",
    carries: [
      "Todas as vitórias e derrotas",
      "O saldo de gols",
      "Os Pontos de Ranking",
    ],
    placement:
      "Sua posição na nova categoria é calculada automaticamente pelos pontos.",
    previousMatches:
      "Os cinco x1s anteriores continuam válidos e o jogador não precisa realizar outros cinco x1s para desafiar um campeão.",
    championException:
      "Um campeão pode desafiar o cinturão de outra categoria como exceção, mas precisa usar os atributos permitidos naquela categoria.",
  },
  scoring: {
    win: 2,
    loss: -1,
    formula: "Pontos de Ranking = (vitórias × 2) − derrotas",
  },
  goalDifference: {
    formula: "Saldo de gols = gols marcados − gols sofridos",
  },
  tieBreakers: [
    "Maior saldo de gols",
    "Menor número de derrotas",
    "Vencedor do confronto direto",
    "Se nunca houve confronto direto, decisão da organização",
  ],
  inactivePlayer:
    "O jogador inativo não é removido e não perde pontos automaticamente. Outros jogadores ativos podem ultrapassá-lo.",
  formerChampion:
    "Quando um campeão perde o cinturão, a organização decide em qual posição ele retorna ao ranking.",
} as const;

/**
 * Não há campeões, cards ou resultados oficiais fornecidos. Estas coleções
 * permanecem vazias para que a interface apresente os estados corretos.
 */
export const officialChampions: readonly Champion[] = [];
export const officialEvents: readonly Event[] = [];
export const officialMatches: readonly Match[] = [];
export const officialPlayers: readonly Player[] = [];
export const officialRankingEntries: readonly RankingEntry[] = [];
export const officialBeltHistory: readonly BeltHistory[] = [];
export const officialRivalries: readonly Rivalry[] = [];

export const examplePlayers = [
  {
    id: "example-pena-01",
    slug: "jogador-exemplo-pena-01",
    name: "Jogador Exemplo P01",
    avatarUrl: null,
    currentCategoryId: "peso-pena",
    status: "active",
    dataStatus: "example",
  },
  {
    id: "example-pena-02",
    slug: "jogador-exemplo-pena-02",
    name: "Jogador Exemplo P02",
    avatarUrl: null,
    currentCategoryId: "peso-pena",
    status: "active",
    dataStatus: "example",
  },
  {
    id: "example-pena-03",
    slug: "jogador-exemplo-pena-03",
    name: "Jogador Exemplo P03",
    avatarUrl: null,
    currentCategoryId: "peso-pena",
    status: "active",
    dataStatus: "example",
  },
  {
    id: "example-pena-04",
    slug: "jogador-exemplo-pena-04",
    name: "Jogador Exemplo P04",
    avatarUrl: null,
    currentCategoryId: "peso-pena",
    status: "inactive",
    dataStatus: "example",
  },
  {
    id: "example-medio-01",
    slug: "jogador-exemplo-medio-01",
    name: "Jogador Exemplo M01",
    avatarUrl: null,
    currentCategoryId: "peso-medio",
    status: "active",
    dataStatus: "example",
  },
  {
    id: "example-medio-02",
    slug: "jogador-exemplo-medio-02",
    name: "Jogador Exemplo M02",
    avatarUrl: null,
    currentCategoryId: "peso-medio",
    status: "active",
    dataStatus: "example",
  },
  {
    id: "example-medio-03",
    slug: "jogador-exemplo-medio-03",
    name: "Jogador Exemplo M03",
    avatarUrl: null,
    currentCategoryId: "peso-medio",
    status: "active",
    dataStatus: "example",
  },
  {
    id: "example-medio-04",
    slug: "jogador-exemplo-medio-04",
    name: "Jogador Exemplo M04",
    avatarUrl: null,
    currentCategoryId: "peso-medio",
    status: "active",
    dataStatus: "example",
  },
  {
    id: "example-pesado-01",
    slug: "jogador-exemplo-pesado-01",
    name: "Jogador Exemplo G01",
    avatarUrl: null,
    currentCategoryId: "peso-pesado",
    status: "active",
    dataStatus: "example",
  },
  {
    id: "example-pesado-02",
    slug: "jogador-exemplo-pesado-02",
    name: "Jogador Exemplo G02",
    avatarUrl: null,
    currentCategoryId: "peso-pesado",
    status: "active",
    dataStatus: "example",
  },
  {
    id: "example-pesado-03",
    slug: "jogador-exemplo-pesado-03",
    name: "Jogador Exemplo G03",
    avatarUrl: null,
    currentCategoryId: "peso-pesado",
    status: "active",
    dataStatus: "example",
  },
  {
    id: "example-pesado-04",
    slug: "jogador-exemplo-pesado-04",
    name: "Jogador Exemplo G04",
    avatarUrl: null,
    currentCategoryId: "peso-pesado",
    status: "inactive",
    dataStatus: "example",
  },
] as const satisfies readonly Player[];

export const exampleRankingEntries = [
  {
    playerId: "example-pena-01",
    categoryId: "peso-pena",
    wins: 6,
    losses: 1,
    goalsFor: 23,
    goalsAgainst: 11,
    recentForm: ["win", "win", "loss", "win", "win"],
    dataStatus: "example",
  },
  {
    playerId: "example-pena-02",
    categoryId: "peso-pena",
    wins: 5,
    losses: 0,
    goalsFor: 18,
    goalsAgainst: 8,
    recentForm: ["win", "win", "win", "win", "win"],
    dataStatus: "example",
  },
  {
    playerId: "example-pena-03",
    categoryId: "peso-pena",
    wins: 4,
    losses: 1,
    goalsFor: 16,
    goalsAgainst: 10,
    recentForm: ["loss", "win", "win", "win", "win"],
    dataStatus: "example",
  },
  {
    playerId: "example-pena-04",
    categoryId: "peso-pena",
    wins: 3,
    losses: 2,
    goalsFor: 15,
    goalsAgainst: 13,
    recentForm: ["loss", "win", "loss", "win", "win"],
    dataStatus: "example",
  },
  {
    playerId: "example-medio-01",
    categoryId: "peso-medio",
    wins: 7,
    losses: 2,
    goalsFor: 27,
    goalsAgainst: 14,
    recentForm: ["win", "loss", "win", "win", "win"],
    dataStatus: "example",
  },
  {
    playerId: "example-medio-02",
    categoryId: "peso-medio",
    wins: 6,
    losses: 1,
    goalsFor: 22,
    goalsAgainst: 12,
    recentForm: ["win", "win", "loss", "win", "win"],
    dataStatus: "example",
  },
  {
    playerId: "example-medio-03",
    categoryId: "peso-medio",
    wins: 5,
    losses: 2,
    goalsFor: 21,
    goalsAgainst: 16,
    recentForm: ["loss", "win", "win", "loss", "win"],
    dataStatus: "example",
  },
  {
    playerId: "example-medio-04",
    categoryId: "peso-medio",
    wins: 3,
    losses: 3,
    goalsFor: 17,
    goalsAgainst: 18,
    recentForm: ["loss", "loss", "win", "loss", "win"],
    dataStatus: "example",
  },
  {
    playerId: "example-pesado-01",
    categoryId: "peso-pesado",
    wins: 8,
    losses: 2,
    goalsFor: 32,
    goalsAgainst: 17,
    recentForm: ["win", "win", "win", "loss", "win"],
    dataStatus: "example",
  },
  {
    playerId: "example-pesado-02",
    categoryId: "peso-pesado",
    wins: 7,
    losses: 1,
    goalsFor: 28,
    goalsAgainst: 15,
    recentForm: ["win", "win", "loss", "win", "win"],
    dataStatus: "example",
  },
  {
    playerId: "example-pesado-03",
    categoryId: "peso-pesado",
    wins: 5,
    losses: 3,
    goalsFor: 24,
    goalsAgainst: 20,
    recentForm: ["loss", "win", "loss", "win", "win"],
    dataStatus: "example",
  },
  {
    playerId: "example-pesado-04",
    categoryId: "peso-pesado",
    wins: 4,
    losses: 4,
    goalsFor: 22,
    goalsAgainst: 23,
    recentForm: ["loss", "win", "loss", "loss", "win"],
    dataStatus: "example",
  },
] as const satisfies readonly RankingEntry[];

/**
 * Cards e resultados exclusivamente demonstrativos. Servem para validar a
 * experiência de eventos e históricos sem se passar por registros da Arena.
 */
export const exampleEvents = [
  {
    id: "example-event-upcoming",
    slug: "card-demonstrativo-futuro",
    name: "Card demonstrativo",
    startsAt: "2026-08-15T20:00:00-03:00",
    timeZone: "America/Sao_Paulo",
    venue: "Park",
    status: "confirmed",
    matchIds: ["example-match-04", "example-match-05", "example-match-06"],
    dataStatus: "example",
  },
  {
    id: "example-event-history",
    slug: "historico-demonstrativo",
    name: "Histórico demonstrativo",
    startsAt: "2026-07-26T20:00:00-03:00",
    timeZone: "America/Sao_Paulo",
    venue: "Park",
    status: "finished",
    matchIds: ["example-match-01", "example-match-02", "example-match-03"],
    dataStatus: "example",
  },
] as const satisfies readonly Event[];

export const exampleMatches = [
  {
    id: "example-match-01",
    eventId: "example-event-history",
    categoryId: "peso-pena",
    playerAId: "example-pena-01",
    playerBId: "example-pena-02",
    type: "rematch",
    status: "finished",
    scheduledAt: "2026-07-26T20:00:00-03:00",
    result: {
      winnerId: "example-pena-01",
      score: { playerA: 4, playerB: 2 },
      method: "regular",
    },
    dataStatus: "example",
  },
  {
    id: "example-match-02",
    eventId: "example-event-history",
    categoryId: "peso-medio",
    playerAId: "example-medio-01",
    playerBId: "example-medio-03",
    type: "normal",
    status: "finished",
    scheduledAt: "2026-07-26T20:35:00-03:00",
    result: {
      winnerId: "example-medio-03",
      score: { playerA: 2, playerB: 3 },
      method: "golden-goal",
    },
    dataStatus: "example",
  },
  {
    id: "example-match-03",
    eventId: "example-event-history",
    categoryId: "peso-pesado",
    playerAId: "example-pesado-02",
    playerBId: "example-pesado-03",
    type: "challenge",
    status: "finished",
    scheduledAt: "2026-07-26T21:10:00-03:00",
    result: {
      winnerId: "example-pesado-02",
      score: { playerA: 3, playerB: 0 },
      method: "knockout",
    },
    dataStatus: "example",
  },
  {
    id: "example-match-04",
    eventId: "example-event-upcoming",
    categoryId: "peso-pena",
    playerAId: "example-pena-03",
    playerBId: "example-pena-04",
    type: "normal",
    status: "confirmed",
    scheduledAt: "2026-08-15T20:00:00-03:00",
    result: null,
    dataStatus: "example",
  },
  {
    id: "example-match-05",
    eventId: "example-event-upcoming",
    categoryId: "peso-medio",
    playerAId: "example-medio-02",
    playerBId: "example-medio-04",
    type: "rematch",
    status: "confirmed",
    scheduledAt: "2026-08-15T20:35:00-03:00",
    result: null,
    dataStatus: "example",
  },
  {
    id: "example-match-06",
    eventId: "example-event-upcoming",
    categoryId: "peso-pesado",
    playerAId: "example-pesado-01",
    playerBId: "example-pesado-04",
    type: "belt",
    status: "awaiting",
    scheduledAt: "2026-08-15T21:10:00-03:00",
    result: null,
    dataStatus: "example",
  },
] as const satisfies readonly Match[];

export const officialArenaData = {
  categories,
  players: officialPlayers,
  rankingEntries: officialRankingEntries,
  champions: officialChampions,
  events: officialEvents,
  matches: officialMatches,
  beltHistory: officialBeltHistory,
  rivalries: officialRivalries,
  glossary,
  rules: arenaRules,
} as const;

export const exampleArenaData = {
  label: DEMO_DATA_LABEL,
  notice: DEMO_DATA_NOTICE,
  players: examplePlayers,
  rankingEntries: exampleRankingEntries,
  events: exampleEvents,
  matches: exampleMatches,
} as const;
