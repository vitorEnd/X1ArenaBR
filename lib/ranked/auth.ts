import "server-only";

import type { User } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { getSafeNextPath } from "./auth-validation";
import { normalizeRankedProfile, type RankedPrivateProfile } from "./profile";

export interface AuthContext {
  readonly configured: boolean;
  readonly user: User | null;
  readonly profile: RankedPrivateProfile | null;
}

export async function getAuthContext(): Promise<AuthContext> {
  if (!isSupabaseConfigured()) {
    return { configured: false, user: null, profile: null };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    return { configured: true, user: null, profile: null };
  }

  const { data: profileData, error: profileError } = await supabase
    .rpc("ranked_get_my_profile")
    .maybeSingle();

  if (profileError && profileError.code !== "PGRST116") {
    throw new Error("Não foi possível carregar sua conta ranked.");
  }

  return {
    configured: true,
    user: data.user,
    profile: normalizeRankedProfile(profileData),
  };
}

export async function requireUser(next = "/conta"): Promise<User> {
  const safeNext = getSafeNextPath(next);
  if (!isSupabaseConfigured()) {
    redirect(`/auth/entrar?next=${encodeURIComponent(safeNext)}`);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    redirect(`/auth/entrar?next=${encodeURIComponent(safeNext)}`);
  }
  return data.user;
}

export function getLinkedProviders(user: User): readonly string[] {
  const providers = user.identities?.map((identity) => identity.provider) ?? [];
  return [...new Set(providers)];
}
