import type { Metadata } from "next";
import { MatchmakingDashboard } from "@/components/ranked/matchmaking-dashboard";
import styles from "@/components/ranked/ranked.module.css";

export const metadata: Metadata = {
  title: "Lobby privado • AXB Ranked",
  description: "Lobby privado de uma partida da AXB Ranked.",
  robots: { index: false, follow: false },
};

export default function MatchmakingLobbyPage() {
  return (
    <div className={styles.rankedPage}>
      <MatchmakingDashboard />
    </div>
  );
}

