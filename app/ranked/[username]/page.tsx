import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RankedProfileView } from "@/components/ranked/ranked-profile-view";
import styles from "@/components/ranked/ranked.module.css";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

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
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("ranked_public_profiles")
      .select("id")
      .eq("username", username)
      .maybeSingle();
    if (!error && !data) notFound();
  }
  return (
    <div className={styles.rankedPage}>
      <section className={styles.contentSection}>
        <div className="page-container">
          <RankedProfileView username={username} />
        </div>
      </section>
    </div>
  );
}
