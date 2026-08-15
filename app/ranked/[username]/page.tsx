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
      // Anonymous mode changes the public username. Redirect an owner who has
      // an old bookmarked/public URL to the private account page instead of
      // showing a confusing 404.
      const { data: privateProfile } = await supabase
        .rpc("ranked_get_my_profile")
        .maybeSingle();
      const ownProfile = privateProfile as { id?: string; username?: string } | null;
      if (ownProfile?.id === authData.user.id && ownProfile.username === username) {
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
