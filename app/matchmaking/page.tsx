import { MatchmakingDashboard, MatchmakingHero, RankLadder } from "@/components/ranked/matchmaking-dashboard";
import styles from "@/components/ranked/ranked.module.css";
import { createPageMetadata } from "@/lib/metadata";

export const metadata = createPageMetadata(
  "Matchmaking Ranked",
  "Entre na fila global da AXB Ranked, dispute partidas X1 e evolua seu MMR até o Top 10 Champion.",
);

export default function MatchmakingPage() {
  return (
    <div className={styles.rankedPage}>
      <MatchmakingHero />
      <MatchmakingDashboard />
      <RankLadder />
    </div>
  );
}

