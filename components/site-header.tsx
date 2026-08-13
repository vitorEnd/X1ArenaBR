import { normalizeRankedProfile } from "@/lib/ranked/profile";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import {
  SiteHeaderClient,
  type HeaderAccount,
} from "./site-header-client";

function metadataText(
  metadata: Record<string, unknown>,
  ...keys: readonly string[]
): string | null {
  for (const key of keys) {
    const value = metadata[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

async function getHeaderAccount(): Promise<HeaderAccount | null> {
  if (!isSupabaseConfigured()) return null;

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) return null;

    const { data: profileData } = await supabase
      .rpc("ranked_get_my_profile")
      .maybeSingle();
    const profile = normalizeRankedProfile(profileData);
    const metadata = data.user.user_metadata ?? {};
    const email = data.user.email ?? null;
    const fallbackName =
      metadataText(
        metadata,
        "full_name",
        "global_name",
        "name",
        "user_name",
        "preferred_username",
      ) ??
      email?.split("@")[0] ??
      "Minha conta";
    const avatarFromProvider = metadataText(metadata, "avatar_url", "picture");
    const avatarUrl = profile?.avatarPath
      ? supabase.storage
          .from("ranked-avatars")
          .getPublicUrl(profile.avatarPath).data.publicUrl
      : avatarFromProvider;

    return {
      name: profile?.username ?? fallbackName,
      email,
      avatarUrl: avatarUrl ?? null,
      hasRankedProfile: Boolean(profile),
    };
  } catch {
    // The global navigation must remain available during a transient API outage.
    return null;
  }
}

export async function SiteHeader() {
  return <SiteHeaderClient account={await getHeaderAccount()} />;
}
