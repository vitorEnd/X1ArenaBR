"use client";

import { motion } from "framer-motion";
import { Crown, Shield, Trophy } from "lucide-react";
import { categories, officialChampions, officialPlayers, officialRankingEntries } from "@/data/arena";
import { calculateGoalDifference } from "@/lib/ranking";

export function ChampionsGrid() {
  return (
    <div className="champions-grid">
      {categories.map((category, index) => {
        const champion = officialChampions.find((item) => item.categoryId === category.id && item.type === "official") ?? officialChampions.find((item) => item.categoryId === category.id && item.type === "interim");
        const player = champion ? officialPlayers.find((item) => item.id === champion.playerId) : null;
        const rankingEntry = champion ? officialRankingEntries.find((item) => item.playerId === champion.playerId && item.categoryId === category.id) : null;
        const hasChampion = Boolean(champion && player);
        const goalDifference = rankingEntry ? calculateGoalDifference(rankingEntry.goalsFor, rankingEntry.goalsAgainst) : null;
        return <motion.article
          key={category.id}
          className="champion-card"
          initial={{ opacity: 0, y: 28 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.35 }}
          transition={{ delay: index * 0.08 }}
          whileHover={{ y: -8 }}
        >
          <div className="champion-card__belt" aria-hidden="true">
            <span />
            <Trophy size={33} />
            <span />
          </div>
          <div className="champion-card__category">
            <Shield size={16} aria-hidden="true" />
            {category.name}
          </div>
          <span className="champion-card__c">C</span>
          <Crown className="champion-card__crown" size={34} aria-hidden="true" />
          <h3>{hasChampion ? player?.name : "Cinturão a definir"}</h3>
          <p>{hasChampion ? `${champion?.type === "interim" ? "Campeão interino" : "Campeão oficial"} da categoria.` : "A disputa pelo cinturão inaugural começa em breve."}</p>
          <dl>
            <div><dt>Defesas</dt><dd>{champion?.defenses ?? "—"}</dd></div>
            <div><dt>Vitórias</dt><dd>{rankingEntry?.wins ?? "—"}</dd></div>
            <div><dt>Derrotas</dt><dd>{rankingEntry?.losses ?? "—"}</dd></div>
            <div><dt>Saldo</dt><dd>{goalDifference === null ? "—" : `${goalDifference > 0 ? "+" : ""}${goalDifference}`}</dd></div>
          </dl>
          <div className="champion-card__footer">
            <span>Conquista</span>
            <strong>{champion ? new Date(champion.wonAt).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "AGUARDANDO PRIMEIRO CAMPEÃO"}</strong>
          </div>
        </motion.article>;
      })}
    </div>
  );
}
