import "server-only";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { normalizeRankedProfile, type RankedPrivateProfile } from "./profile";

export async function getMyRankedProfile(): Promise<RankedPrivateProfile | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .rpc("ranked_get_my_profile")
    .maybeSingle();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw new Error("Não foi possível carregar o perfil ranked.");
  }

  return normalizeRankedProfile(data);
}

export async function requireRankedProfile(
  next = "/matchmaking",
): Promise<RankedPrivateProfile> {
  const profile = await getMyRankedProfile();
  if (!profile) {
    redirect(`/conta/perfil?next=${encodeURIComponent(next)}`);
  }
  return profile;
}

export async function getRankedAvatarUrl(
  avatarPath: string | null,
  version?: string,
): Promise<string | null> {
  if (!avatarPath) return null;
  const supabase = await createClient();
  const publicUrl = supabase.storage
    .from("ranked-avatars")
    .getPublicUrl(avatarPath).data.publicUrl;
  return version
    ? `${publicUrl}?v=${encodeURIComponent(version)}`
    : publicUrl;
}
