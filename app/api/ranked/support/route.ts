import { NextResponse } from "next/server";
import { createHash, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import type {
  RankedMutationResponse,
  RankedSupportAuditEntry,
  RankedSupportAccount,
  RankedSupportHistoryMatch,
  RankedSupportMatch,
  RankedSupportQueueEntry,
  RankedSupportResponse,
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
    audit: [],
  };
}

const supportIntentSchema = z.discriminatedUnion("intent", [
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
    intent: z.literal("account-action"),
    profileId: z.string().uuid(),
    action: z.enum(["freeze", "unfreeze", "ban", "unban", "penalize"]),
    durationSeconds: z.number().int().min(60).max(31_536_000).optional(),
    internalNote: z.string().trim().max(1000).default(""),
  }),
]);

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
      queueResult,
      activeResult,
      matchHistoryResult,
      frozenResult,
      reportsResult,
      auditResult,
      accountsResult,
      historyResult,
      penaltiesResult,
    ] =
      await Promise.all([
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
      ]);
    for (const result of [
      queueResult,
      activeResult,
      frozenResult,
      matchHistoryResult,
      reportsResult,
      auditResult,
      accountsResult,
      historyResult,
      penaltiesResult,
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

    const response: RankedSupportResponse = {
      configured: true,
      authenticated: true,
      authorized: true,
      queue,
      activeLobbies,
      frozenMatches,
      matchHistory,
      accounts,
      audit,
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

    if (parsed.data.intent === "reset-ranked") {
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
