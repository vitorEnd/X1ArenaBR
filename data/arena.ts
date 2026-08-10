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
    definition: "Quando o campeão vence um x1 valendo seu cinturão.",
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

export const officialPlayers = [
  {
    id: "itz",
    slug: "itz",
    name: "Itz",
    avatarUrl: null,
    currentCategoryId: "peso-pena",
    status: "active",
    dataStatus: "official",
  },
  {
    id: "joao00325",
    slug: "joao00325",
    name: "João00325",
    avatarUrl: null,
    currentCategoryId: "peso-medio",
    status: "active",
    dataStatus: "official",
  },
  {
    id: "vtzinn021",
    slug: "vtzinn021",
    name: "Vtzinn021",
    avatarUrl: null,
    currentCategoryId: "peso-medio",
    status: "active",
    dataStatus: "official",
  },
  {
    id: "vwyxz",
    slug: "vwyxz",
    name: "Vwyxz",
    avatarUrl: null,
    currentCategoryId: "peso-medio",
    status: "active",
    dataStatus: "official",
  },
   {
    id: "Gabbo",
    slug: "Gabbo",
    name: "Gabbo",
    avatarUrl: null,
    currentCategoryId: null,
    status: "active",
    dataStatus: "official",
  },
     {
    id: "Zeys",
    slug: "Zeys",
    name: "Zeys",
    avatarUrl: null,
    currentCategoryId: null,
    status: "active",
    dataStatus: "official",
  },
       {
    id: "ShotColt",
    slug: "ShotColt",
    name: "ShotColt",
    avatarUrl: null,
    currentCategoryId: "peso-pena",
    status: "active",
    dataStatus: "official",
  },
] as const satisfies readonly Player[];

/**
 * A Arena ainda não publicou resultados, ranking, campeões, cards ou históricos.
 * As coleções ficam vazias até que os primeiros registros oficiais sejam enviados.
 */
export const officialChampions: readonly Champion[] = [];
export const officialEvents: readonly Event[] = [];
export const officialMatches: readonly Match[] = [];
export const officialRankingEntries: readonly RankingEntry[] = [];
export const officialBeltHistory: readonly BeltHistory[] = [];
export const officialRivalries: readonly Rivalry[] = [];

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
