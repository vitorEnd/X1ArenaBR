import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { RankedProfileView } from "@/components/ranked/ranked-profile-view";
import styles from "@/components/ranked/ranked.module.css";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { getConfiguredSupportIds } from "@/lib/ranked/support-sync";

interface RankedPublicProfilePageProps {
  readonly params: Promise<{ username: string }>;
}

export async function generateMetadata({ params }: RankedPublicProfilePageProps): Promise<Metadata> {
  const { username } = await params;
  const readableName = username;
  return {
    title: `${readableName} • Perfil Ranked`,
    description: `Perfil competitivo, Elo e histórico confirmado de ${readableName} na AXB Ranked.`,
  };
}

export default async function RankedPublicProfilePage({ params }: RankedPublicProfilePageProps) {
  const { username } = await params;
  let isOwner = false;
  let isSupport = false;
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const [{ data: profile, error }, { data: authData }] = await Promise.all([
      supabase
        .from("ranked_public_profiles")
        .select("id")
        .eq("username", username)
        .maybeSingle(),
      supabase.auth.getUser(),
    ]);
    if (!error && !profile && authData.user) {
      // Anonymous mode changes the public username, but the owner must still
      // be able to open the public profile through the anonymous label.
      const { data: privateProfile } = await supabase
        .rpc("ranked_get_my_profile")
        .maybeSingle();
      const ownProfile = privateProfile as {
        id?: string;
        username?: string;
        anonymous_mode?: boolean;
        anonymous_number?: number | string | null;
      } | null;
      const anonymousUsername = ownProfile?.anonymous_mode && ownProfile.anonymous_number
        ? `Anonimo${String(ownProfile.anonymous_number).padStart(4, "0")}`
        : null;
      if (ownProfile?.id === authData.user.id && anonymousUsername === username) {
        redirect(`/ranked/${encodeURIComponent(anonymousUsername)}`);
      }
      if (ownProfile?.id === authData.user.id) {
        redirect("/conta");
      }
    }
    if (!error && !profile) notFound();
    isOwner = Boolean(profile && authData.user?.id === profile.id);
    isSupport = Boolean(
      isOwner &&
        authData.user &&
        getConfiguredSupportIds().includes(authData.user.id.toLocaleLowerCase("en-US")),
    );
  }
  return (
    <div className={styles.rankedPage}>
      <section className={styles.contentSection}>
        <div className="page-container">
          <RankedProfileView username={username} isOwner={isOwner} isSupport={isSupport} />
        </div>
      </section>
    </div>
  );
}
