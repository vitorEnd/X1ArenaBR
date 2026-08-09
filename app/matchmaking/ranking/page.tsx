import { Trophy } from "lucide-react";
import { RankedLeaderboard } from "@/components/ranked/ranked-leaderboard";
import styles from "@/components/ranked/ranked.module.css";
import { createPageMetadata } from "@/lib/metadata";

export const metadata = createPageMetadata(
  "Top 50 Ranked",
  "Classificação global da AXB Ranked por MMR, Elo, vitórias e derrotas.",
);

export default function MatchmakingRankingPage() {
  return (
    <div className={styles.rankedPage}>
      <header className={styles.rankedHero}>
        <div className="page-container">
          <div className={styles.heroGrid}>
            <div>
              <span className={styles.eyebrow}>Classificação global • Top 50</span>
              <h1 className={styles.heroTitle}>O topo não <span>espera.</span></h1>
              <p className={styles.heroLead}>
                A ordem é decidida por MMR, vitórias, derrotas e pelo momento em que cada marca foi alcançada.
              </p>
            </div>
            <div className={styles.heroRail}>
              <div><Trophy aria-hidden="true" /><p><span>Elite da Arena</span><strong>2.500+ e Top 10</strong></p></div>
            </div>
          </div>
        </div>
      </header>
      <section className={styles.contentSection}>
        <div className="page-container">
          <RankedLeaderboard />
        </div>
      </section>
    </div>
  );
}

