import "server-only";

import type { SupabaseClient, User } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import type {
  RankedOpponent,
  RankedPublicProfile,
  RankedTier,
} from "@/components/ranked/adapter";
import { getAuthContext } from "@/lib/ranked/auth";
import { getRankedTier } from "@/lib/ranked/ranks";
import type { RankedPrivateProfile } from "@/lib/ranked/profile";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseAdminConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import {
  getConfiguredSupportIds,
  syncConfiguredSupportUsers,
} from "@/lib/ranked/support-sync";

export type RankedRecord = Record<string, unknown>;

export interface RankedApiContext {
  readonly configured: boolean;
  readonly user: User | null;
  readonly profile: RankedPrivateProfile | null;
  readonly supabase: SupabaseClient | null;
}

export class RankedRequestError extends Error {
  readonly status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "RankedRequestError";
    this.status = status;
  }
}

export async function getRankedApiContext(): Promise<RankedApiContext> {
  const auth = await getAuthContext();
  return {
    ...auth,
    supabase: auth.configured ? await createClient() : null,
  };
}

export async function requireRankedApiContext(): Promise<
  RankedApiContext & { user: User; supabase: SupabaseClient }
> {
  const context = await getRankedApiContext();
  if (!context.configured || !context.supabase) {
    throw new RankedRequestError(
      process.env.NODE_ENV === "development"
        ? "Configure o Supabase no arquivo .env.local para usar a ranked."
        : "A ranked está temporariamente indisponível.",
      503,
    );
  }
  if (!context.user) {
    throw new RankedRequestError("Entre na sua conta para continuar.", 401);
  }
  return { ...context, user: context.user, supabase: context.supabase };
}

export function rankedErrorResponse(error: unknown): NextResponse {
  if (error instanceof RankedRequestError) {
    return NextResponse.json({ message: error.message }, { status: error.status });
  }

  const candidate = error as { message?: string; code?: string } | null;
  const message = candidate?.message?.toLocaleLowerCase("pt-BR") ?? "";
  if (candidate?.code === "42501" || message.includes("não autorizado")) {
    return NextResponse.json(
      { message: candidate?.message || "Ação não autorizada." },
      { status: 403 },
    );
  }
  if (candidate?.code === "23505") {
    return NextResponse.json(
      { message: "Essa ação já foi registrada." },
      { status: 409 },
    );
  }
  if (candidate?.code === "28000") {
    return NextResponse.json({ message: "Sua sessão expirou." }, { status: 401 });
  }
  if (candidate?.code === "P0002") {
    return NextResponse.json(
      { message: candidate.message || "Registro não encontrado." },
      { status: 404 },
    );
  }
  if (
    candidate?.code === "P0001" ||
    candidate?.code === "22023" ||
    candidate?.code === "23514"
  ) {
    return NextResponse.json(
      { message: candidate.message || "Ação incompatível com o estado atual." },
      { status: candidate.code === "22023" ? 400 : 409 },
    );
  }

  if (process.env.NODE_ENV !== "production") {
    console.error("Ranked API error", error);
  }
  return NextResponse.json(
    { message: "Não foi possível concluir a ação. Tente novamente." },
    { status: 500 },
  );
}

export function record(value: unknown): RankedRecord | null {
  return value && typeof value === "object" ? (value as RankedRecord) : null;
}

export function stringValue(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

export function nullableString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

export function numberValue(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function nullableNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function rankedTierValue(value: unknown): RankedTier | null {
  return value === "novato" ||
    value === "pro" ||
    value === "craque" ||
    value === "desafiante" ||
    value === "immortal" ||
    value === "champion"
    ? value
    : null;
}

export function getAvatarPublicUrl(
  supabase: SupabaseClient,
  avatarPath: unknown,
  version?: unknown,
): string | null {
  const path = nullableString(avatarPath);
  if (!path) return null;
  const publicUrl = supabase.storage.from("ranked-avatars").getPublicUrl(path).data
    .publicUrl;
  const versionValue = nullableString(version);
  return versionValue
    ? `${publicUrl}?v=${encodeURIComponent(versionValue)}`
    : publicUrl;
}

export function toRankedPublicProfile(
  supabase: SupabaseClient,
  value: unknown,
): RankedPublicProfile | null {
  const row = record(value);
  if (!row) return null;
  const id = stringValue(row.id);
  const username = stringValue(row.username);
  if (!id || !username) return null;

  const mmr = nullableNumber(row.mmr);
  const globalPosition = nullableNumber(row.global_position);
  const placementMatchesPlayed = numberValue(
    row.placement_matches ?? row.placementMatches,
  );

  return {
    id,
    username,
    avatarUrl: getAvatarPublicUrl(
      supabase,
      row.avatar_path ?? row.avatarPath,
      row.updated_at ?? row.updatedAt,
    ),
    wins: numberValue(row.wins),
    losses: numberValue(row.losses),
    mmr,
    tier:
      rankedTierValue(row.tier) ??
      (mmr === null ? null : getRankedTier(mmr, globalPosition)),
    globalPosition,
    placementMatchesPlayed,
    placementMatchesRequired: 5,
    createdAt: stringValue(row.created_at ?? row.createdAt, new Date(0).toISOString()),
    anonymousMode: row.anonymous_mode === true,
  };
}

export function toRankedOpponent(
  supabase: SupabaseClient,
  value: unknown,
): RankedOpponent | null {
  const profile = toRankedPublicProfile(supabase, value);
  if (!profile) return null;
  return {
    id: profile.id,
    username: profile.username,
    avatarUrl: profile.avatarUrl,
    mmr: profile.mmr,
    tier: profile.tier,
    globalPosition: profile.globalPosition,
  };
}

export function parseSupportIds(): ReadonlySet<string> {
  return new Set(getConfiguredSupportIds());
}

export async function requireSupportContext() {
  const context = await requireRankedApiContext();
  if (!isSupabaseAdminConfigured()) {
    throw new RankedRequestError("O acesso de suporte ainda não foi configurado.", 503);
  }
  const supportIds = parseSupportIds();
  if (!supportIds.has(context.user.id.toLocaleLowerCase("en-US"))) {
    throw new RankedRequestError("Acesso restrito ao suporte.", 403);
  }

  await syncConfiguredSupportUsers();
  const admin = createAdminClient();

  return { ...context, admin };
}

export function assertNoSupabaseError(
  result: { error: { message: string; code?: string } | null },
): void {
  if (result.error) throw result.error;
}
