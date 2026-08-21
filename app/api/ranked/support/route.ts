import { NextResponse } from "next/server";
import { createHash, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { categories, officialPlayers } from "@/data/arena";
import type { ArenaCard, ArenaCardMatch } from "@/lib/arena-card-types";
import type {
  RankedMutationResponse,
  RankedSupportAuditEntry,
  RankedSupportAccount,
  RankedSupportHistoryMatch,
  RankedSupportMatch,
  RankedSupportQueueEntry,
  RankedSupportResponse,
  RankedSupportOfficialPlayer,
} from "@/components/ranked/adapter";
import {
  getRankedApiContext,
  nullableNumber,
  numberValue,
  parseSupportIds,
  rankedErrorResponse,
  RankedRequestError,
  record,
  requireSupportContext,
  stringValue,
  toRankedOpponent,
} from "@/lib/ranked/api-server";
import {
  AVATAR_MAX_BYTES,
  AVATAR_MAX_DIMENSION,
  getImageDimensions,
} from "@/lib/ranked/avatar";

export const dynamic = "force-dynamic";

function emptySupport(
  configured: boolean,
  authenticated: boolean,
  authorized: boolean,
): RankedSupportResponse {
  return {
    configured,
    authenticated,
    authorized,
    queue: [],
    activeLobbies: [],
    frozenMatches: [],
    matchHistory: [],
    accounts: [],
    officialPlayers: [],
    audit: [],
    arenaCards: [],
    pointsMultiplier: 1,
  };
}

const supportIntentSchema = z.discriminatedUnion("intent", [
  z.object({
    intent: z.literal("set-ranked-points-multiplier"),
    multiplier: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  }),
  z.object({
    intent: z.literal("create-arena-card"),
    name: z.string().trim().min(3).max(80),
    startsAt: z.string().datetime({ offset: true }).nullable(),
  }),
  z.object({
    intent: z.literal("update-arena-card"),
    cardId: z.string().uuid(),
    name: z.string().trim().min(3).max(80),
    startsAt: z.string().datetime({ offset: true }).nullable(),
  }),
  z.object({
    intent: z.literal("delete-arena-card"),
    cardId: z.string().uuid(),
  }),
  z.object({
    intent: z.literal("start-arena-card"),
    cardId: z.string().uuid(),
  }),
  z.object({
    intent: z.literal("upsert-arena-card-match"),
    cardId: z.string().uuid(),
    matchId: z.string().uuid().optional(),
    categoryId: z.enum(["peso-pena", "peso-medio", "peso-pesado"]),
    playerAId: z.string().min(1).max(80),
    playerBId: z.string().min(1).max(80),
    matchType: z.enum(["normal", "belt"]),
    scheduledAt: z.string().datetime({ offset: true }).nullable(),
  }),
  z.object({
    intent: z.literal("delete-arena-card-match"),
    cardId: z.string().uuid(),
    matchId: z.string().uuid(),
  }),
  z.object({
    intent: z.literal("update-arena-card-match-result"),
    cardId: z.string().uuid(),
    matchId: z.string().uuid(),
    playerAScore: z.number().int().min(0).max(999),
    playerBScore: z.number().int().min(0).max(999),
  }),
  z.object({
    intent: z.literal("finish-arena-card"),
    cardId: z.string().uuid(),
    results: z.array(z.object({
      matchId: z.string().uuid(),
      playerAScore: z.number().int().min(0).max(999),
      playerBScore: z.number().int().min(0).max(999),
    })).min(1).max(100),
  }),
  z.object({
    intent: z.literal("reset-ranked"),
    password: z.string().min(1).max(128),
  }),
  z.object({
    intent: z.literal("correct-history-match"),
    matchId: z.string().uuid(),
    playerAGoals: z.number().int().min(0).max(2_147_483_647),
    playerBGoals: z.number().int().min(0).max(2_147_483_647),
    playerAMmr: z.number().int().min(800).max(100_000),
    playerBMmr: z.number().int().min(800).max(100_000),
    internalNote: z.string().trim().min(5).max(1000),
  }),
  z.object({
    intent: z.literal("resolve-match"),
    matchId: z.string().uuid(),
    resolution: z.enum(["confirm", "walkover-a", "walkover-b", "cancel"]),
    playerAGoals: z.number().int().min(0).max(2_147_483_647).optional(),
    playerBGoals: z.number().int().min(0).max(2_147_483_647).optional(),
    internalNote: z.string().trim().max(1000).default(""),
  }),
  z.object({
    intent: z.literal("adjust-mmr"),
    profileId: z.string().uuid(),
    newMmr: z.number().int().min(800).max(100_000).optional(),
    amount: z.number().int().min(800).max(100_000).optional(),
    internalNote: z.string().trim().min(5).max(1000),
  }),
  z.object({
    intent: z.literal("set-player-nickname"),
    playerId: z.string().min(1).max(80),
    nickname: z.string().trim().min(2).max(48),
    color: z.enum(["purple", "gold", "red"]),
    internalNote: z.string().trim().max(1000).default(""),
  }),
  z.object({
    intent: z.literal("delete-player-nickname"),
    playerId: z.string().min(1).max(80),
    internalNote: z.string().trim().max(1000).default(""),
  }),
  z.object({
    intent: z.literal("set-official-player-avatar"),
    playerId: z.string().min(1).max(80),
    avatarDataUrl: z
      .string()
      .max(7_000_000)
      .regex(/^data:image\/webp;base64,[A-Za-z0-9+/]+={0,2}$/),
    internalNote: z.string().trim().max(1000).default(""),
  }),
  z.object({
    intent: z.literal("delete-official-player-avatar"),
    playerId: z.string().min(1).max(80),
    internalNote: z.string().trim().max(1000).default(""),
  }),
  z.object({
    intent: z.literal("account-action"),
    profileId: z.string().uuid(),
    action: z.enum(["freeze", "unfreeze", "ban", "unban", "penalize"]),
    durationSeconds: z.number().int().min(60).max(31_536_000).optional(),
    internalNote: z.string().trim().max(1000).default(""),
  }),
]);

const officialPlayerIds = new Set<string>(officialPlayers.map((player) => player.id));
const categoryNames = new Map<string, string>(
  categories.map((category) => [category.id, category.name]),
);
const OFFICIAL_AVATAR_BUCKET = "player-avatars";

function officialAvatarPath(playerId: string): string {
  return `official/${playerId.toLocaleLowerCase("en-US")}/avatar.webp`;
}

function decodeOfficialAvatar(dataUrl: string): Uint8Array {
  const encoded = dataUrl.slice("data:image/webp;base64,".length);
  const bytes = Buffer.from(encoded, "base64");
  const normalizedInput = encoded.replace(/=+$/u, "");
  const normalizedDecoded = bytes.toString("base64").replace(/=+$/u, "");
  if (!bytes.byteLength || normalizedDecoded !== normalizedInput) {
    throw new RankedRequestError("O arquivo WebP enviado é inválido.");
  }
  if (bytes.byteLength > AVATAR_MAX_BYTES) {
    throw new RankedRequestError("A imagem deve ter no máximo 5 MB.");
  }

  const dimensions = getImageDimensions(bytes, "image/webp");
  if (!dimensions) {
    throw new RankedRequestError("O arquivo não contém uma imagem WebP válida.");
  }
  if (dimensions.width !== dimensions.height) {
    throw new RankedRequestError("A foto oficial precisa ter formato quadrado.");
  }
  if (
    dimensions.width > AVATAR_MAX_DIMENSION ||
    dimensions.height > AVATAR_MAX_DIMENSION
  ) {
    throw new RankedRequestError("A foto oficial deve ter no máximo 2048 × 2048 pixels.");
  }
  return bytes;
}

export async function GET(request: Request) {
  try {
    const queryValue = new URL(request.url).searchParams.get("query")?.trim() ?? "";
    if (queryValue.length > 24) {
      throw new RankedRequestError("Busca de conta inválida.");
    }
    const api = await getRankedApiContext();
    if (!api.configured) return NextResponse.json(emptySupport(false, false, false));
    if (!api.user) return NextResponse.json(emptySupport(true, false, false));
    if (!parseSupportIds().has(api.user.id.toLocaleLowerCase("en-US"))) {
      return NextResponse.json(emptySupport(true, true, false));
    }

    const { admin } = await requireSupportContext();
    const historyCutoff = new Date(Date.now() - 24 * 60 * 60 * 1_000).toISOString();
    let accountsQuery = admin
      .from("ranked_profiles")
      .select("id,username,avatar_path,mmr,placement_matches,banned_at,frozen_until")
      .order("updated_at", { ascending: false })
      .limit(100);
    if (queryValue) accountsQuery = accountsQuery.ilike("username", `%${queryValue}%`);

    const [
      nicknamesResult,
      officialAvatarsResult,
      queueResult,
      activeResult,
      matchHistoryResult,
      frozenResult,
      reportsResult,
      auditResult,
      accountsResult,
      historyResult,
      penaltiesResult,
      arenaCardsResult,
      arenaCardMatchesResult,
      rankedSettingsResult,
    ] =
      await Promise.all([
        admin
          .from("arena_player_nicknames")
          .select("player_id,nickname,color"),
        admin
          .from("arena_player_avatars")
          .select("player_id,storage_path,updated_at"),
        admin
          .from("ranked_queue_entries")
          .select("profile_id,joined_at")
          .eq("status", "waiting")
          .order("joined_at", { ascending: true })
          .limit(100),
        admin
          .from("ranked_matches")
          .select("*")
          .in("status", [
            "awaiting_acceptance",
            "lobby",
            "in_progress",
            "awaiting_score",
            "awaiting_confirmation",
          ])
          .order("created_at", { ascending: true })
          .limit(100),
        admin
          .from("ranked_matches")
          .select("*")
          .eq("status", "confirmed")
          .gte("confirmed_at", historyCutoff)
          .order("confirmed_at", { ascending: false })
          .limit(200),
        admin
          .from("ranked_matches")
          .select("*")
          .in("status", ["frozen", "disputed"])
          .order("updated_at", { ascending: true })
          .limit(100),
        admin
          .from("ranked_match_reports")
          .select("match_id,category,observation,created_at")
          .eq("status", "open")
          .order("created_at", { ascending: true }),
        admin
          .from("support_audit_log")
          .select("id,action,target_type,target_id,created_at")
          .order("created_at", { ascending: false })
          .limit(50),
        accountsQuery,
        admin
          .from("ranked_username_history")
          .select("profile_id,old_username,new_username,changed_at")
          .order("changed_at", { ascending: false })
          .limit(500),
        admin
          .from("ranked_penalties")
          .select("profile_id,ends_at")
          .eq("status", "active")
          .order("created_at", { ascending: false }),
        admin
          .from("arena_cards")
          .select("id,name,status,starts_at,venue,created_at,updated_at")
          .order("created_at", { ascending: false }),
        admin
          .from("arena_card_matches")
          .select("id,card_id,position,category_id,player_a_id,player_b_id,match_type,status,scheduled_at,player_a_score,player_b_score,winner_player_id")
          .order("position", { ascending: true }),
        admin
          .from("ranked_runtime_settings")
          .select("points_multiplier")
          .eq("id", 1)
          .maybeSingle(),
      ]);
    for (const result of [
      nicknamesResult,
      officialAvatarsResult,
      queueResult,
      activeResult,
      frozenResult,
      matchHistoryResult,
      reportsResult,
      auditResult,
      accountsResult,
      historyResult,
      penaltiesResult,
      arenaCardsResult,
      arenaCardMatchesResult,
      rankedSettingsResult,
    ]) {
      if (result.error) throw result.error;
    }

    const matches = [
      ...(activeResult.data ?? []),
      ...(frozenResult.data ?? []),
      ...(matchHistoryResult.data ?? []),
    ];
    const profileIds = new Set<string>();
    for (const entry of queueResult.data ?? []) profileIds.add(entry.profile_id);
    for (const account of accountsResult.data ?? []) profileIds.add(account.id);
    for (const match of matches) {
      profileIds.add(match.player_one_id);
      profileIds.add(match.player_two_id);
    }
    const profileIdList = [...profileIds];
    const [publicProfilesResult, baseProfilesResult] = profileIdList.length
      ? await Promise.all([
          admin
            .from("ranked_public_profiles")
            .select("*")
            .in("id", profileIdList),
          admin
            .from("ranked_profiles")
            .select(
              "id,username,avatar_path,wins,losses,mmr,placement_matches,created_at,updated_at",
            )
            .in("id", profileIdList),
        ])
      : [
          { data: [], error: null },
          { data: [], error: null },
        ];
    if (publicProfilesResult.error) throw publicProfilesResult.error;
    if (baseProfilesResult.error) throw baseProfilesResult.error;

    const publicProfilesById = new Map(
      (publicProfilesResult.data ?? []).map((profile) => [
        stringValue(profile.id),
        profile,
      ]),
    );
    const baseProfilesById = new Map(
      (baseProfilesResult.data ?? []).map((profile) => [
        stringValue(profile.id),
        profile,
      ]),
    );
    const profilesById = new Map(
      (baseProfilesResult.data ?? []).map((profile) => {
        const id = stringValue(profile.id);
        return [
          id,
          publicProfilesById.get(id) ?? {
            ...profile,
            mmr: profile.placement_matches === 5 ? profile.mmr : null,
            global_position: null,
            tier: null,
          },
        ];
      }),
    );
    const reportsByMatch = new Map(
      (reportsResult.data ?? []).map((report) => [report.match_id, report]),
    );

    const mapMatch = (value: unknown): RankedSupportMatch | null => {
      const match = record(value);
      if (!match) return null;
      const playerA = toRankedOpponent(
        admin,
        profilesById.get(stringValue(match.player_one_id)),
      );
      const playerB = toRankedOpponent(
        admin,
        profilesById.get(stringValue(match.player_two_id)),
      );
      if (!playerA || !playerB) return null;
      const report = reportsByMatch.get(stringValue(match.id));
      const playerAGoals = nullableNumber(match.player_one_score);
      const playerBGoals = nullableNumber(match.player_two_score);
      return {
        id: stringValue(match.id),
        matchNumber: numberValue(match.match_number),
        state: stringValue(match.status) as RankedSupportMatch["state"],
        playerA,
        playerB,
        reportCategory: report?.category ?? null,
        reportObservation: report?.observation ?? null,
        frozenAt:
          stringValue(match.status) === "frozen" ||
          stringValue(match.status) === "disputed"
            ? stringValue(match.updated_at)
            : null,
        submittedScore:
          playerAGoals !== null && playerBGoals !== null
            ? { playerAGoals, playerBGoals }
            : null,
      };
    };

    const queue: RankedSupportQueueEntry[] = (queueResult.data ?? [])
      .map((entry) => {
        const opponent = toRankedOpponent(
          admin,
          profilesById.get(entry.profile_id),
        );
        if (!opponent) return null;
        return {
          profileId: opponent.id,
          username: opponent.username,
          tier: opponent.tier,
          joinedAt: entry.joined_at,
        };
      })
      .filter((entry): entry is RankedSupportQueueEntry => entry !== null);
    const activeLobbies = (activeResult.data ?? [])
      .map(mapMatch)
      .filter((match): match is RankedSupportMatch => match !== null);
    const frozenMatches = (frozenResult.data ?? [])
      .map(mapMatch)
      .filter((match): match is RankedSupportMatch => match !== null);
    const matchHistory = (matchHistoryResult.data ?? [])
      .map((value): RankedSupportHistoryMatch | null => {
        const mapped = mapMatch(value);
        const match = record(value);
        if (!mapped || !match) return null;
        const playerAProfile = baseProfilesById.get(mapped.playerA.id);
        const playerBProfile = baseProfilesById.get(mapped.playerB.id);
        const confirmedAt = stringValue(match.confirmed_at);
        if (!confirmedAt) return null;
        return {
          ...mapped,
          confirmedAt,
          playerACurrentMmr: nullableNumber(playerAProfile?.mmr) ?? 800,
          playerBCurrentMmr: nullableNumber(playerBProfile?.mmr) ?? 800,
        };
      })
      .filter((match): match is RankedSupportHistoryMatch => match !== null);
    const audit: RankedSupportAuditEntry[] = (auditResult.data ?? []).map((entry) => ({
      id: String(entry.id),
      action: entry.action,
      targetLabel: `${entry.target_type} ${entry.target_id}`,
      createdAt: entry.created_at,
    }));
    const usernameHistoryByProfile = new Map<
      string,
      RankedSupportAccount["usernameHistory"]
    >();
    for (const item of historyResult.data ?? []) {
      const current = usernameHistoryByProfile.get(item.profile_id) ?? [];
      usernameHistoryByProfile.set(item.profile_id, [
        ...current,
        {
          previousUsername: item.old_username,
          nextUsername: item.new_username,
          changedAt: item.changed_at,
        },
      ]);
    }
    const penaltyByProfile = new Map<string, string | null>();
    for (const item of penaltiesResult.data ?? []) {
      if (!penaltyByProfile.has(item.profile_id)) {
        penaltyByProfile.set(item.profile_id, item.ends_at);
      }
    }
    const accounts: RankedSupportAccount[] = (accountsResult.data ?? []).map(
      (account) => {
        const publicAccount = toRankedOpponent(
          admin,
          profilesById.get(account.id),
        );
        const frozenUntil = account.frozen_until as string | null;
        return {
          profileId: account.id,
          username: account.username,
          avatarUrl: publicAccount?.avatarUrl ?? null,
          mmr: account.placement_matches === 5 ? account.mmr : null,
          tier: publicAccount?.tier ?? null,
          frozen:
            Boolean(frozenUntil) && Date.parse(frozenUntil ?? "") > Date.now(),
          banned: account.banned_at !== null,
          penaltyExpiresAt: penaltyByProfile.get(account.id) ?? null,
          usernameHistory: usernameHistoryByProfile.get(account.id) ?? [],
        };
      },
    );
    const nicknamesByPlayer = new Map(
      (nicknamesResult.data ?? [])
        .filter((item) => officialPlayerIds.has(String(item.player_id)))
        .map((item) => [
          String(item.player_id),
          {
            playerId: String(item.player_id),
            nickname: String(item.nickname),
            color: item.color as "purple" | "gold" | "red",
          },
        ]),
    );
    const avatarsByPlayer = new Map(
      (officialAvatarsResult.data ?? [])
        .filter((item) => {
          const playerId = String(item.player_id);
          return (
            officialPlayerIds.has(playerId) &&
            String(item.storage_path) === officialAvatarPath(playerId)
          );
        })
        .map((item) => {
          const publicUrl = admin.storage
            .from(OFFICIAL_AVATAR_BUCKET)
            .getPublicUrl(String(item.storage_path)).data.publicUrl;
          return [
            String(item.player_id),
            `${publicUrl}?v=${encodeURIComponent(String(item.updated_at))}`,
          ];
        }),
    );
    const supportOfficialPlayers: RankedSupportOfficialPlayer[] = officialPlayers.map(
      (player) => ({
        playerId: player.id,
        name: player.name,
        categoryName:
          (player.currentCategoryId && categoryNames.get(player.currentCategoryId)) ||
          "Sem categoria",
        avatarUrl: avatarsByPlayer.get(player.id) ?? null,
        nickname: nicknamesByPlayer.get(player.id) ?? null,
      }),
    );
    const arenaMatchesByCard = new Map<string, ArenaCardMatch[]>();
    for (const match of arenaCardMatchesResult.data ?? []) {
      const mapped: ArenaCardMatch = {
        id: String(match.id),
        cardId: String(match.card_id),
        position: Number(match.position),
        categoryId: match.category_id as ArenaCardMatch["categoryId"],
        playerAId: String(match.player_a_id),
        playerBId: String(match.player_b_id),
        type: match.match_type as ArenaCardMatch["type"],
        status: match.status as ArenaCardMatch["status"],
        scheduledAt: match.scheduled_at,
        playerAScore: match.player_a_score,
        playerBScore: match.player_b_score,
        winnerPlayerId: match.winner_player_id,
      };
      const current = arenaMatchesByCard.get(mapped.cardId) ?? [];
      current.push(mapped);
      arenaMatchesByCard.set(mapped.cardId, current);
    }
    const arenaCards: ArenaCard[] = (arenaCardsResult.data ?? []).map((card) => ({
      id: String(card.id),
      name: String(card.name),
      status: card.status as ArenaCard["status"],
      startsAt: card.starts_at,
      venue: "Park",
      createdAt: String(card.created_at),
      updatedAt: String(card.updated_at),
      matches: arenaMatchesByCard.get(String(card.id)) ?? [],
    }));

    const response: RankedSupportResponse = {
      configured: true,
      authenticated: true,
      authorized: true,
      queue,
      activeLobbies,
      frozenMatches,
      matchHistory,
      accounts,
      officialPlayers: supportOfficialPlayers,
      audit,
      arenaCards,
      pointsMultiplier:
        rankedSettingsResult.data?.points_multiplier === 2 ||
        rankedSettingsResult.data?.points_multiplier === 3
          ? rankedSettingsResult.data.points_multiplier
          : 1,
    };
    return NextResponse.json(response, {
      headers: { "Cache-Control": "private, no-store, max-age=0" },
    });
  } catch (error) {
    return rankedErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const parsed = supportIntentSchema.safeParse(await request.json());
    if (!parsed.success) throw new RankedRequestError("Ação de suporte inválida.");
    const { supabase, admin, user } = await requireSupportContext();

    if (parsed.data.intent === "set-ranked-points-multiplier") {
      const result = await supabase.rpc("ranked_support_set_points_multiplier", {
        p_multiplier: parsed.data.multiplier,
      });
      if (result.error) throw result.error;
    } else if (parsed.data.intent === "set-player-nickname") {
      if (!officialPlayerIds.has(parsed.data.playerId)) {
        throw new RankedRequestError("Jogador oficial inválido.", 404);
      }
      const result = await admin.from("arena_player_nicknames").upsert({ player_id: parsed.data.playerId, nickname: parsed.data.nickname, color: parsed.data.color, updated_by: user.id }, { onConflict: "player_id" });
      if (result.error) throw result.error;
      const auditResult = await admin.from("support_audit_log").insert({ support_user_id: user.id, action: "set_player_nickname", target_type: "official_player", target_id: parsed.data.playerId, next_state: { nickname: parsed.data.nickname, color: parsed.data.color }, note: parsed.data.internalNote || "Apelido oficial atualizado pela Central de Suporte." });
      if (auditResult.error) throw auditResult.error;
    } else if (parsed.data.intent === "delete-player-nickname") {
      if (!officialPlayerIds.has(parsed.data.playerId)) {
        throw new RankedRequestError("Jogador oficial inválido.", 404);
      }
      const result = await admin.from("arena_player_nicknames").delete().eq("player_id", parsed.data.playerId);
      if (result.error) throw result.error;
      const auditResult = await admin.from("support_audit_log").insert({ support_user_id: user.id, action: "delete_player_nickname", target_type: "official_player", target_id: parsed.data.playerId, note: parsed.data.internalNote || "Apelido oficial removido pela Central de Suporte." });
      if (auditResult.error) throw auditResult.error;
    } else if (
      parsed.data.intent === "set-official-player-avatar" ||
      parsed.data.intent === "delete-official-player-avatar"
    ) {
      if (!officialPlayerIds.has(parsed.data.playerId)) {
        throw new RankedRequestError("Jogador oficial inválido.", 404);
      }
      const path = officialAvatarPath(parsed.data.playerId);
      if (parsed.data.intent === "set-official-player-avatar") {
        const bytes = decodeOfficialAvatar(parsed.data.avatarDataUrl);
        const upload = await admin.storage
          .from(OFFICIAL_AVATAR_BUCKET)
          .upload(path, bytes, {
            contentType: "image/webp",
            upsert: true,
            cacheControl: "3600",
          });
        if (upload.error) throw upload.error;
        const avatarResult = await admin
          .from("arena_player_avatars")
          .upsert(
            {
              player_id: parsed.data.playerId,
              storage_path: path,
              updated_by: user.id,
            },
            { onConflict: "player_id" },
          );
        if (avatarResult.error) throw avatarResult.error;
      } else {
        const avatarResult = await admin
          .from("arena_player_avatars")
          .delete()
          .eq("player_id", parsed.data.playerId);
        if (avatarResult.error) throw avatarResult.error;
        const removal = await admin.storage
          .from(OFFICIAL_AVATAR_BUCKET)
          .remove([path]);
        if (removal.error) throw removal.error;
      }
      const auditResult = await admin.from("support_audit_log").insert({
        support_user_id: user.id,
        action: parsed.data.intent.replaceAll("-", "_"),
        target_type: "official_player",
        target_id: parsed.data.playerId,
        ...(parsed.data.intent === "set-official-player-avatar"
          ? { next_state: { storage_path: path } }
          : { previous_state: { storage_path: path } }),
        note:
          parsed.data.internalNote ||
          (parsed.data.intent === "set-official-player-avatar"
            ? "Foto oficial atualizada pela Central de Suporte."
            : "Foto oficial removida pela Central de Suporte."),
      });
      if (auditResult.error) throw auditResult.error;
    } else if (parsed.data.intent === "create-arena-card") {
      const cardResult = await admin
        .from("arena_cards")
        .insert({
          name: parsed.data.name,
          status: "announced",
          starts_at: parsed.data.startsAt,
          venue: "Park",
          created_by: user.id,
          updated_by: user.id,
        })
        .select("id")
        .single();
      if (cardResult.error) throw cardResult.error;
      const auditResult = await admin.from("support_audit_log").insert({
        support_user_id: user.id,
        action: "create_card",
        target_type: "arena_card",
        target_id: cardResult.data.id,
        next_state: { name: parsed.data.name, status: "announced" },
        note: "Card criado pela central de suporte.",
      });
      if (auditResult.error) throw auditResult.error;
    } else if (parsed.data.intent === "update-arena-card") {
      const result = await admin
        .from("arena_cards")
        .update({ name: parsed.data.name, starts_at: parsed.data.startsAt, updated_by: user.id })
        .eq("id", parsed.data.cardId)
        .in("status", ["draft", "announced"])
        .select("id")
        .single();
      if (result.error) throw result.error;
    } else if (parsed.data.intent === "delete-arena-card") {
      const result = await admin.from("arena_cards").delete().eq("id", parsed.data.cardId);
      if (result.error) throw result.error;
      const auditResult = await admin.from("support_audit_log").insert({
        support_user_id: user.id,
        action: "delete_card",
        target_type: "arena_card",
        target_id: parsed.data.cardId,
        note: "Card excluído pela central de suporte.",
      });
      if (auditResult.error) throw auditResult.error;
    } else if (parsed.data.intent === "start-arena-card") {
      const result = await admin.rpc("arena_support_start_card", {
        p_card_id: parsed.data.cardId,
        p_support_user_id: user.id,
      });
      if (result.error) throw result.error;
    } else if (parsed.data.intent === "upsert-arena-card-match") {
      if (
        parsed.data.playerAId === parsed.data.playerBId ||
        !officialPlayerIds.has(parsed.data.playerAId) ||
        !officialPlayerIds.has(parsed.data.playerBId)
      ) {
        throw new RankedRequestError("Selecione dois jogadores oficiais diferentes.");
      }
      const cardResult = await admin
        .from("arena_cards")
        .select("status")
        .eq("id", parsed.data.cardId)
        .single();
      if (cardResult.error) throw cardResult.error;
      const cardStatus = cardResult.data?.status;
      const canEditExisting = cardStatus === "draft" || cardStatus === "announced";
      const canCreateNew = cardStatus === "draft" || cardStatus === "announced" || cardStatus === "live";
      if (parsed.data.matchId) {
        if (!canEditExisting) {
          throw new RankedRequestError("Um card iniciado ou finalizado não pode ter confrontos editados.", 409);
        }
        const result = await admin
          .from("arena_card_matches")
          .update({
            category_id: parsed.data.categoryId,
            player_a_id: parsed.data.playerAId,
            player_b_id: parsed.data.playerBId,
            match_type: parsed.data.matchType,
            scheduled_at: parsed.data.scheduledAt,
          })
          .eq("id", parsed.data.matchId)
          .eq("card_id", parsed.data.cardId)
          .select("id")
          .single();
        if (result.error) throw result.error;
      } else {
        if (!canCreateNew) {
          throw new RankedRequestError("Um card finalizado não pode receber novos confrontos.", 409);
        }
        const lastPositionResult = await admin
          .from("arena_card_matches")
          .select("position")
          .eq("card_id", parsed.data.cardId)
          .order("position", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (lastPositionResult.error) throw lastPositionResult.error;
        const result = await admin.from("arena_card_matches").insert({
          card_id: parsed.data.cardId,
          position: (lastPositionResult.data?.position ?? 0) + 1,
          category_id: parsed.data.categoryId,
          player_a_id: parsed.data.playerAId,
          player_b_id: parsed.data.playerBId,
          match_type: parsed.data.matchType,
          scheduled_at: parsed.data.scheduledAt,
          status: "announced",
        });
        if (result.error) throw result.error;
      }
    } else if (parsed.data.intent === "delete-arena-card-match") {
      const cardResult = await admin
        .from("arena_cards")
        .select("status")
        .eq("id", parsed.data.cardId)
        .single();
      if (cardResult.error) throw cardResult.error;
      if (!cardResult.data || !["draft", "announced"].includes(cardResult.data.status)) {
        throw new RankedRequestError("Um card iniciado ou finalizado não pode ser editado.", 409);
      }
      const result = await admin
        .from("arena_card_matches")
        .delete()
        .eq("id", parsed.data.matchId)
        .eq("card_id", parsed.data.cardId);
      if (result.error) throw result.error;
    } else if (parsed.data.intent === "update-arena-card-match-result") {
      if (parsed.data.playerAScore === parsed.data.playerBScore) {
        throw new RankedRequestError("Os confrontos não podem terminar empatados.");
      }
      const cardResult = await admin
        .from("arena_cards")
        .select("status")
        .eq("id", parsed.data.cardId)
        .single();
      if (cardResult.error) throw cardResult.error;
      if (!cardResult.data || cardResult.data.status !== "live") {
        throw new RankedRequestError("Só é possível registrar resultado de um card em andamento.", 409);
      }
      const result = await admin
        .from("arena_card_matches")
        .update({
          status: "finished",
          player_a_score: parsed.data.playerAScore,
          player_b_score: parsed.data.playerBScore,
          winner_player_id: parsed.data.playerAScore > parsed.data.playerBScore
            ? (await admin.from("arena_card_matches").select("player_a_id,player_b_id").eq("id", parsed.data.matchId).eq("card_id", parsed.data.cardId).single()).data?.player_a_id ?? null
            : (await admin.from("arena_card_matches").select("player_a_id,player_b_id").eq("id", parsed.data.matchId).eq("card_id", parsed.data.cardId).single()).data?.player_b_id ?? null,
        })
        .eq("id", parsed.data.matchId)
        .eq("card_id", parsed.data.cardId)
        .select("id")
        .single();
      if (result.error) throw result.error;
    } else if (parsed.data.intent === "finish-arena-card") {
      if (parsed.data.results.some((result) => result.playerAScore === result.playerBScore)) {
        throw new RankedRequestError("Os confrontos não podem terminar empatados.");
      }
      const result = await admin.rpc("arena_support_finish_card", {
        p_card_id: parsed.data.cardId,
        p_results: parsed.data.results,
        p_support_user_id: user.id,
      });
      if (result.error) throw result.error;
    } else if (parsed.data.intent === "reset-ranked") {
      const configuredPassword = process.env.RANKED_RESET_PASSWORD?.trim();
      if (!configuredPassword) {
        throw new RankedRequestError("O reset global ainda não foi configurado.", 503);
      }
      const suppliedHash = createHash("sha256").update(parsed.data.password).digest();
      const expectedHash = createHash("sha256").update(configuredPassword).digest();
      if (!timingSafeEqual(suppliedHash, expectedHash)) {
        throw new RankedRequestError("Senha de reset incorreta.", 403);
      }
      const result = await admin.rpc("ranked_support_reset_all", {
        p_support_user_id: user.id,
      });
      if (result.error) throw result.error;
    } else if (parsed.data.intent === "correct-history-match") {
      const result = await supabase.rpc("ranked_support_correct_match", {
        p_match_id: parsed.data.matchId,
        p_player_one_score: parsed.data.playerAGoals,
        p_player_two_score: parsed.data.playerBGoals,
        p_player_one_mmr: parsed.data.playerAMmr,
        p_player_two_mmr: parsed.data.playerBMmr,
        p_note: parsed.data.internalNote,
      });
      if (result.error) throw result.error;
    } else if (parsed.data.intent === "resolve-match") {
      const { data: match, error } = await supabase
        .from("ranked_matches")
        .select("player_one_id,player_two_id")
        .eq("id", parsed.data.matchId)
        .single();
      if (error) throw error;
      const isWalkover = parsed.data.resolution.startsWith("walkover");
      const winnerId =
        parsed.data.resolution === "walkover-a"
          ? match.player_one_id
          : parsed.data.resolution === "walkover-b"
            ? match.player_two_id
            : null;
      const result = await supabase.rpc("ranked_support_resolve_match", {
        p_match_id: parsed.data.matchId,
        p_action: isWalkover ? "walkover" : parsed.data.resolution,
        p_player_one_score: parsed.data.playerAGoals ?? null,
        p_player_two_score: parsed.data.playerBGoals ?? null,
        p_winner_profile_id: winnerId,
        p_note: parsed.data.internalNote || null,
      });
      if (result.error) throw result.error;
    } else if (parsed.data.intent === "adjust-mmr") {
      const newMmr = parsed.data.newMmr ?? parsed.data.amount;
      if (newMmr === undefined) throw new RankedRequestError("Informe o novo MMR.");
      const result = await supabase.rpc("ranked_support_adjust_mmr", {
        p_profile_id: parsed.data.profileId,
        p_new_mmr: newMmr,
        p_note: parsed.data.internalNote,
      });
      if (result.error) throw result.error;
    } else {
      const rpcAction = parsed.data.action;
      if (
        (rpcAction === "freeze" || rpcAction === "penalize" || rpcAction === "ban") &&
        parsed.data.durationSeconds === undefined
      ) {
        throw new RankedRequestError("Informe a duração da punição.");
      }
      if (
        rpcAction === "ban" &&
        (parsed.data.durationSeconds ?? 0) > 360_000
      ) {
        throw new RankedRequestError("O banimento pode durar no máximo 100 horas.");
      }
      const result = await supabase.rpc("ranked_support_manage_profile", {
        p_profile_id: parsed.data.profileId,
        p_action: rpcAction,
        p_duration_seconds: parsed.data.durationSeconds ?? null,
        p_note: parsed.data.internalNote || null,
      });
      if (result.error) throw result.error;
    }

    const response: RankedMutationResponse = {
      ok: true,
      message: "Ação registrada no histórico do suporte.",
    };
    return NextResponse.json(response);
  } catch (error) {
    return rankedErrorResponse(error);
  }
}
